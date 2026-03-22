from __future__ import annotations

import math
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Dict, List

from fastapi import HTTPException
from sgp4.api import Satrec, jday

from app.services.odri import (
    classify_odri,
    compute_odri,
    compute_omega,
    compute_phi,
    compute_psi,
    compute_sigma,
    project_odri,
)
from app.services.spacetrack import load_cdm_cache
from app.services.tle_fetcher import get_local_timestamp, get_tle_lines, parse_tle_text

EARTH_RADIUS_KM = 6371.0
SHELL_THICKNESS_KM = 75.0
ODRI_OBJECT_LIMIT = 320
SNAPSHOT_TTL_SECONDS = 300
TIMELINE_DAYS = 30
TOP_OBJECT_LIMIT = 10


@dataclass
class ODRIObject:
    sat_id: str
    name: str
    line1: str
    line2: str
    altitude_km: float
    shell_floor_km: int
    position: tuple[float, float, float]
    velocity: tuple[float, float, float]
    nearest_distance_km: float = 1.0
    relative_speed_km_s: float = 0.0


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _norm(vec: tuple[float, float, float]) -> float:
    return math.sqrt((vec[0] ** 2) + (vec[1] ** 2) + (vec[2] ** 2))


def _distance(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.sqrt(((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2))


def _velocity_delta(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.sqrt(((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2))


def _parse_sat_id(line1: str, name: str) -> str:
    if len(line1) >= 7:
        return line1[2:7].strip()
    return name.strip().lower().replace(" ", "-")


def _compute_state(line1: str, line2: str, at_time: datetime) -> tuple[tuple[float, float, float], tuple[float, float, float]] | None:
    sat = Satrec.twoline2rv(line1, line2)
    jd, fr = jday(
        at_time.year,
        at_time.month,
        at_time.day,
        at_time.hour,
        at_time.minute,
        at_time.second + at_time.microsecond / 1e6,
    )
    error, position, velocity = sat.sgp4(jd, fr)
    if error != 0:
        return None
    altitude_km = _norm(position) - EARTH_RADIUS_KM
    if altitude_km < 100 or altitude_km > 50000:
        return None
    return position, velocity


def _shell_volume(shell_floor_km: int) -> float:
    inner = EARTH_RADIUS_KM + shell_floor_km
    outer = inner + SHELL_THICKNESS_KM
    return (4.0 / 3.0) * math.pi * ((outer ** 3) - (inner ** 3))


def _estimate_cross_section(name: str, altitude_km: float) -> float:
    upper_name = name.upper()
    if "ISS" in upper_name:
        return 420.0
    if "STARLINK" in upper_name or "ONEWEB" in upper_name:
        return 28.0
    if "HUBBLE" in upper_name:
        return 55.0
    if "R/B" in upper_name or "ROCKET" in upper_name:
        return 14.0
    if "DEB" in upper_name or "DEBRIS" in upper_name:
        return 2.2
    if altitude_km < 1000:
        return 18.0
    if altitude_km < 20000:
        return 12.0
    return 20.0


def _estimate_maneuver_profile(name: str, altitude_km: float) -> tuple[float, float]:
    upper_name = name.upper()
    if "ISS" in upper_name:
        return 8.5, 0.96
    if "DEB" in upper_name or "DEBRIS" in upper_name or "R/B" in upper_name or "ROCKET" in upper_name:
        return 0.0, 0.0
    if "STARLINK" in upper_name or "ONEWEB" in upper_name:
        return 2.2, 0.9
    if altitude_km < 2000:
        return 1.1, 0.74
    return 0.55, 0.42


def _estimate_dv_required(r_miss: float, tca_hours: float, shell_count: int) -> float:
    urgency = 0.8 if tca_hours < 24 else 0.45 if tca_hours < 72 else 0.18
    distance_term = 2.2 / (r_miss + 5.0)
    density_term = min(shell_count / 400.0, 0.65)
    return 0.05 + urgency + distance_term + density_term


def _estimate_projection_factors(altitude_km: float, rho_local: float, delta_t: float) -> tuple[float, float, float]:
    solar_gain = max(0.0, (1200.0 - min(altitude_km, 1200.0)) / 120.0)
    delta_f107 = solar_gain * max(delta_t, 0.0)
    delta_rho = rho_local * (1.0 + (0.15 * max(delta_t, 0.0)))
    tau_drag = max(18.0, 240.0 - min(altitude_km, 1200.0) * 0.12)
    return delta_f107, delta_rho, tau_drag


def _trend_label(projected: float, current: float) -> str:
    delta = projected - current
    if delta > 0.03:
        return "worse"
    if delta < -0.03:
        return "improving"
    return "stable"


def _parse_future_hours(tca_raw: str | None, now: datetime) -> float | None:
    if not tca_raw:
        return None
    try:
        tca_dt = datetime.fromisoformat(str(tca_raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if tca_dt.tzinfo is None:
        tca_dt = tca_dt.replace(tzinfo=timezone.utc)
    delta_hours = (tca_dt - now).total_seconds() / 3600.0
    if delta_hours <= 0:
        return None
    return delta_hours


def _build_cdm_map(now: datetime) -> Dict[str, Dict[str, Any]]:
    by_sat: Dict[str, Dict[str, Any]] = {}
    for item in load_cdm_cache():
        sat_ids = [str(item.get("SAT_1_ID") or "").strip(), str(item.get("SAT_2_ID") or "").strip()]
        miss_distance = float(item.get("MIN_RNG") or 0.0)
        tca_hours = _parse_future_hours(item.get("TCA"), now)
        if not sat_ids[0] or not sat_ids[1] or tca_hours is None:
            continue
        entry = {
            "tca_hours": tca_hours,
            "miss_distance_km": miss_distance if miss_distance > 0 else None,
            "warning": {
                "sat_1_name": item.get("SAT_1_NAME"),
                "sat_2_name": item.get("SAT_2_NAME"),
                "pc": item.get("PC"),
                "tca": item.get("TCA"),
                "miss_distance_km": miss_distance,
            },
        }
        for sat_id in sat_ids:
            existing = by_sat.get(sat_id)
            if existing is None or (entry["miss_distance_km"] or 1e12) < (existing["miss_distance_km"] or 1e12):
                by_sat[sat_id] = entry
    return by_sat


def _resolve_affected_shell_density(objects: List[ODRIObject]) -> Dict[int, Dict[str, float]]:
    shell_counts: Dict[int, int] = {}
    for obj in objects:
        shell_counts[obj.shell_floor_km] = shell_counts.get(obj.shell_floor_km, 0) + 1
    shell_metrics: Dict[int, Dict[str, float]] = {}
    for shell_floor, count in shell_counts.items():
        shell_metrics[shell_floor] = {
            "count": float(count),
            "rho_local": count / _shell_volume(shell_floor),
        }
    return shell_metrics


def _build_objects(now: datetime) -> List[ODRIObject]:
    tle_text = "\n".join(get_tle_lines("debris_merged"))
    raw_tles = parse_tle_text(tle_text, limit=ODRI_OBJECT_LIMIT)
    objects: List[ODRIObject] = []
    for name, line1, line2 in raw_tles:
        state = _compute_state(line1, line2, now)
        if state is None:
            continue
        position, velocity = state
        altitude_km = _norm(position) - EARTH_RADIUS_KM
        shell_floor = int(max(0, altitude_km) // SHELL_THICKNESS_KM) * int(SHELL_THICKNESS_KM)
        objects.append(
            ODRIObject(
                sat_id=_parse_sat_id(line1, name),
                name=name,
                line1=line1,
                line2=line2,
                altitude_km=altitude_km,
                shell_floor_km=shell_floor,
                position=position,
                velocity=velocity,
            )
        )
    return objects


def _compute_neighbor_metrics(objects: List[ODRIObject]) -> None:
    for index, left in enumerate(objects):
        nearest_distance = float("inf")
        nearest_speed = 0.0
        for j in range(index + 1, len(objects)):
            right = objects[j]
            distance_km = _distance(left.position, right.position)
            if distance_km < nearest_distance:
                nearest_distance = distance_km
                nearest_speed = _velocity_delta(left.velocity, right.velocity)
            if distance_km < right.nearest_distance_km:
                right.nearest_distance_km = distance_km
                right.relative_speed_km_s = _velocity_delta(left.velocity, right.velocity)
        if nearest_distance != float("inf"):
            left.nearest_distance_km = nearest_distance
            left.relative_speed_km_s = nearest_speed


def _serialize_object(
    obj: ODRIObject,
    shell_metrics: Dict[int, Dict[str, float]],
    cdm_map: Dict[str, Dict[str, Any]],
    now: datetime,
) -> Dict[str, Any]:
    shell_info = shell_metrics.get(obj.shell_floor_km, {"count": 1.0, "rho_local": 0.0})
    shell_count = int(shell_info["count"])
    rho_local = float(shell_info["rho_local"])

    cdm = cdm_map.get(obj.sat_id)
    if cdm and cdm.get("miss_distance_km"):
        r_miss = float(cdm["miss_distance_km"])
        tca_hours = float(cdm["tca_hours"])
        warning = cdm.get("warning")
    else:
        r_miss = max(obj.nearest_distance_km, 0.1)
        rel_speed = max(obj.relative_speed_km_s, 0.5)
        tca_hours = min(240.0, max(1.0, (r_miss / rel_speed) / 3600.0 * 1000.0))
        warning = None

    cross_section = _estimate_cross_section(obj.name, obj.altitude_km)
    sigma = compute_sigma(cross_section, r_miss)
    omega = compute_omega(shell_count, rho_local)
    psi = compute_psi(tca_hours)
    dv_budget, eta = _estimate_maneuver_profile(obj.name, obj.altitude_km)
    dv_required = _estimate_dv_required(r_miss, tca_hours, shell_count)
    phi = compute_phi(dv_budget, eta, dv_required)
    odri_score = compute_odri(sigma, omega, psi, phi)
    classification = classify_odri(odri_score)

    return {
        "sat_id": obj.sat_id,
        "object_name": obj.name,
        "norad_id": obj.sat_id,
        "odri": odri_score,
        "timestamp": now.isoformat(),
        "components": {
            "sigma_collision": sigma,
            "omega_cascade": omega,
            "psi_temporal": psi,
            "phi_maneuver": phi,
        },
        "inputs": {
            "A_cross": cross_section,
            "r_miss": r_miss,
            "N_shell": shell_count,
            "rho_local": rho_local,
            "tca_hours": tca_hours,
            "dv_budget": dv_budget,
            "eta": eta,
            "dv_required": dv_required,
            "altitude_km": obj.altitude_km,
            "shell_floor_km": obj.shell_floor_km,
            "nearest_distance_km": obj.nearest_distance_km,
            "relative_speed_km_s": obj.relative_speed_km_s,
        },
        "risk_level": classification["risk_level"],
        "recommendation": classification["recommendation"],
        "warning": warning,
    }


class ODRISnapshotCache:
    def __init__(self) -> None:
        self._lock = Lock()
        self._payload: Dict[str, Any] | None = None
        self._expires_at = 0.0

    def _build_snapshot(self) -> Dict[str, Any]:
        now = _utc_now()
        objects = _build_objects(now)
        _compute_neighbor_metrics(objects)
        shell_metrics = _resolve_affected_shell_density(objects)
        cdm_map = _build_cdm_map(now)
        serialized = [_serialize_object(obj, shell_metrics, cdm_map, now) for obj in objects]
        serialized.sort(key=lambda item: item["odri"], reverse=True)

        average_odri = sum(item["odri"] for item in serialized) / max(len(serialized), 1)
        average_rho = sum(item["inputs"]["rho_local"] for item in serialized) / max(len(serialized), 1)
        risk_counts: Dict[str, int] = {}
        for item in serialized:
            level = item["risk_level"]
            risk_counts[level] = risk_counts.get(level, 0) + 1

        summary = {
            "tracked_count": len(serialized),
            "average_odri": average_odri,
            "average_shell_density": average_rho,
            "active_conjunction_warnings": len(cdm_map),
            "risk_counts": risk_counts,
            "cache_timestamp": get_local_timestamp(),
            "updated_at": now.isoformat(),
        }
        timeline = build_average_timeline(serialized, days=TIMELINE_DAYS, base_date=now)

        return {
            "objects": serialized,
            "summary": summary,
            "timeline": timeline,
            "top_objects": serialized[:TOP_OBJECT_LIMIT],
        }

    def get(self) -> Dict[str, Any]:
        now = time.time()
        with self._lock:
            if self._payload is not None and now < self._expires_at:
                return self._payload
            self._payload = self._build_snapshot()
            self._expires_at = now + SNAPSHOT_TTL_SECONDS
            return self._payload


_snapshot_cache = ODRISnapshotCache()


def build_projected_object(item: Dict[str, Any], delta_t: float) -> Dict[str, Any]:
    """Return a single ODRI object payload with projection fields applied."""
    projected = dict(item)
    delta_f107, delta_rho, tau_drag = _estimate_projection_factors(
        float(item["inputs"]["altitude_km"]),
        float(item["inputs"]["rho_local"]),
        delta_t,
    )
    projected_odri = project_odri(item["odri"], delta_t, delta_f107, delta_rho, tau_drag)
    projected_classification = classify_odri(projected_odri)
    projected["projected_odri"] = projected_odri
    projected["projection_days"] = delta_t
    projected["projection_inputs"] = {
        "delta_t": delta_t,
        "delta_F107": delta_f107,
        "delta_rho_local": delta_rho,
        "tau_drag": tau_drag,
    }
    projected["projected_risk_level"] = projected_classification["risk_level"]
    projected["trend"] = _trend_label(projected_odri, item["odri"])
    return projected


def build_average_timeline(objects: List[Dict[str, Any]], days: int, base_date: datetime | None = None) -> List[Dict[str, Any]]:
    """Build a projected average-ODRI line for the next N days."""
    base_date = base_date or _utc_now()
    timeline: List[Dict[str, Any]] = []
    if not objects:
        return timeline

    for day in range(1, days + 1):
        projected_scores = []
        for item in objects:
            delta_f107, delta_rho, tau_drag = _estimate_projection_factors(
                float(item["inputs"]["altitude_km"]),
                float(item["inputs"]["rho_local"]),
                float(day),
            )
            projected_scores.append(project_odri(item["odri"], float(day), delta_f107, delta_rho, tau_drag))
        average_score = sum(projected_scores) / max(len(projected_scores), 1)
        classification = classify_odri(average_score)
        timeline.append(
            {
                "date": (base_date + timedelta(days=day)).date().isoformat(),
                "projected_odri": average_score,
                "critical_threshold": 0.85,
                "risk_level": classification["risk_level"],
            }
        )
    return timeline


def get_odri_snapshot(limit: int = TOP_OBJECT_LIMIT) -> Dict[str, Any]:
    """Return the cached ODRI snapshot with the requested number of top objects."""
    snapshot = _snapshot_cache.get()
    return {
        "items": [build_projected_object(item, 7.0) for item in snapshot["top_objects"][:limit]],
        "summary": snapshot["summary"],
        "timeline": snapshot["timeline"],
    }


def get_odri_for_satellite(sat_id: str, delta_t: float = 7.0) -> Dict[str, Any]:
    """Resolve one cached object by NORAD id or name and return its live ODRI payload."""
    normalized = sat_id.strip().lower()
    snapshot = _snapshot_cache.get()
    for item in snapshot["objects"]:
        if item["sat_id"].lower() == normalized or item["object_name"].lower() == normalized:
            return build_projected_object(item, delta_t)
    raise HTTPException(status_code=404, detail=f"Satellite '{sat_id}' was not found in the cached TLE set")


def get_top_odri_objects(limit: int = TOP_OBJECT_LIMIT, delta_t: float = 7.0) -> List[Dict[str, Any]]:
    """Return the highest-risk cached ODRI objects with projections applied."""
    snapshot = _snapshot_cache.get()
    return [build_projected_object(item, delta_t) for item in snapshot["top_objects"][:limit]]


def get_cascade_snapshot(limit: int = TOP_OBJECT_LIMIT, focus_sat_ids: List[str] | None = None) -> Dict[str, Any]:
    """Build the live ODRI context payload used by the cascade analysis endpoint."""
    snapshot = _snapshot_cache.get()
    top_objects = [build_projected_object(item, 7.0) for item in snapshot["top_objects"][:limit]]
    focus_sat_ids = focus_sat_ids or []
    focus_set = {sat_id.strip().lower() for sat_id in focus_sat_ids if sat_id.strip()}
    focused = [
        build_projected_object(item, 7.0)
        for item in snapshot["objects"]
        if item["sat_id"].lower() in focus_set or item["object_name"].lower() in focus_set
    ]

    max_score = max((item["odri"] for item in top_objects), default=0.0)
    threat_level = classify_odri(max_score)["risk_level"]
    warnings = [
        item["warning"]
        for item in top_objects
        if item.get("warning") is not None
    ]
    return {
        "top_objects": top_objects,
        "focused_objects": focused,
        "summary": snapshot["summary"],
        "timeline": snapshot["timeline"],
        "warnings": warnings,
        "cascade_threat_level": threat_level,
    }
