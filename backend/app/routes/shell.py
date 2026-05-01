"""
Shell Intelligence - Orbital Instability Index (OII) endpoint.

Computes shell-level risk metrics including:
- OII score (0-100)
- Object count and density
- Maneuver cluster probability
- Congestion index
- Recommended actions
"""
from __future__ import annotations

import math
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from sgp4.api import Satrec, jday

from app.services.tle_fetcher import get_tle_lines, parse_tle_text

router = APIRouter()

EARTH_RADIUS_KM = 6371.0
DEFAULT_SHELL_THICKNESS_KM = 75.0
SHELL_CACHE_TTL_SECONDS = 300

SHELL_DEFINITIONS = {
    "LEO_VERY_LOW": (160, 250, "Very Low Earth Orbit - ISS, Crewed missions"),
    "LEO_LOW": (250, 500, "Low Earth Orbit - Earth observation, Small satellites"),
    "LEO_HIGH": (500, 700, "LEO - Constellation shells (Starlink, OneWeb)"),
    "LEO_SUPER": (700, 900, "Super LEO - Sun-synchronous orbit"),
    "MEO": (2000, 35786, "Medium Earth Orbit - GNSS constellations"),
    "GEO": (35786, 35886, "Geostationary Orbit - Communications satellites"),
}

CONSTELLATION_RANGES = {
    "STARLINK": (44000, 49000),
    "ONEWEB": (44000, 45000),
    "GPS": (20000, 26000),
    "GALILEO": (28000, 33000),
    "GLONASS": (24000, 29000),
    "BEIDOU": (36000, 41000),
}

_shell_cache = {
    "data": None,
    "expires_at": 0.0,
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _norm(vec: tuple) -> float:
    return math.sqrt(vec[0]**2 + vec[1]**2 + vec[2]**2)


def _parse_norad_id(line2: str) -> Optional[int]:
    """Extract NORAD catalog number from TLE line 2."""
    try:
        return int(line2[2:7].strip())
    except (ValueError, IndexError):
        return None


def _get_orbit_period_minutes(altitude_km: float) -> float:
    """Calculate orbital period in minutes for circular orbit at given altitude."""
    mu = 398600.4418  # Earth's gravitational parameter (km^3/s^2)
    r = EARTH_RADIUS_KM + altitude_km
    period_seconds = 2 * math.pi * math.sqrt(r**3 / mu)
    return period_seconds / 60.0


def _classify_constellation(norad_id: Optional[int], name: str) -> str:
    """Classify object by constellation using NORAD ID ranges."""
    name_upper = name.upper()
    
    if "STARLINK" in name_upper:
        return "STARLINK"
    if "ONEWEB" in name_upper:
        return "ONEWEB"
    if "GPS" in name_upper:
        return "GPS"
    if "GALILEO" in name_upper:
        return "GALILEO"
    if "GLONASS" in name_upper:
        return "GLONASS"
    if "BEIDOU" in name_upper or "COMPASS" in name_upper:
        return "BEIDOU"
    if "IRIDIUM" in name_upper:
        return "IRIDIUM"
    if "SES" in name_upper or "EUTELSAT" in name_upper:
        return "GEO_OPERATOR"
    if "DEB" in name_upper or "R/B" in name_upper or "FRAG" in name_upper:
        return "DEBRIS"
    
    if norad_id is not None:
        for constellation, (low, high) in CONSTELLATION_RANGES.items():
            if low <= norad_id <= high:
                return constellation
    
    return "OTHER"


def _compute_shell_metrics(objects: List[dict], shell_floor_km: int, shell_ceil_km: float) -> dict:
    """Compute shell-level instability metrics."""
    shell_mid = (shell_floor_km + shell_ceil_km) / 2.0
    shell_height = shell_ceil_km - shell_floor_km
    shell_volume_km3 = _shell_volume(shell_floor_km, shell_ceil_km)
    
    active_count = sum(1 for o in objects if o["constellation"] not in ("DEBRIS", "OTHER"))
    debris_count = sum(1 for o in objects if o["constellation"] == "DEBRIS")
    total_count = len(objects)
    
    density_per_mkm3 = (total_count / shell_volume_km3) * 1e6 if shell_volume_km3 > 0 else 0
    
    constellation_counts = {}
    for o in objects:
        c = o["constellation"]
        constellation_counts[c] = constellation_counts.get(c, 0) + 1
    
    diversity = 0.0
    for count in constellation_counts.values():
        p = count / total_count if total_count > 0 else 0
        if p > 0:
            diversity -= p * math.log2(p)
    
    congestion_index = _compute_congestion_index(objects, shell_mid)
    
    maneuver_cluster_prob = _estimate_maneuver_probability(objects, constellation_counts, total_count)
    
    oii = _compute_oii(
        total_count=total_count,
        density=density_per_mkm3,
        congestion=congestion_index,
        maneuver_prob=maneuver_cluster_prob,
        diversity=diversity,
        altitude_km=shell_mid,
    )
    
    if oii >= 75:
        risk_level = "CRITICAL"
        recommendation = "Immediate monitoring required. High cascade risk."
    elif oii >= 50:
        risk_level = "HIGH"
        recommendation = "Enhanced monitoring. Prepare maneuver contingencies."
    elif oii >= 30:
        risk_level = "MEDIUM"
        recommendation = "Standard monitoring. Track constellation activity."
    else:
        risk_level = "LOW"
        recommendation = "Nominal conditions. Routine monitoring sufficient."
    
    return {
        "shell_altitude_km": shell_floor_km,
        "shell_ceil_km": shell_ceil_km,
        "shell_midpoint_km": shell_mid,
        "shell_height_km": shell_height,
        "object_count": total_count,
        "active_satellites": active_count,
        "debris_count": debris_count,
        "density_per_million_km3": round(density_per_mkm3, 4),
        "constellation_diversity": round(diversity, 3),
        "congestion_index": round(congestion_index, 3),
        "maneuver_cluster_probability": round(maneuver_cluster_prob, 3),
        "oii_score": round(oii, 1),
        "risk_level": risk_level,
        "recommendation": recommendation,
        "constellations": dict(constellation_counts),
    }


def _shell_volume(floor_km: float, ceil_km: float) -> float:
    """Calculate volume of shell between two altitudes."""
    inner = EARTH_RADIUS_KM + floor_km
    outer = EARTH_RADIUS_KM + ceil_km
    return (4.0 / 3.0) * math.pi * (outer**3 - inner**3)


def _compute_congestion_index(objects: List[dict], shell_mid_km: float) -> float:
    """
    Compute congestion index based on relative proximity of objects.
    Returns value 0-1, where 1 is highly congested.
    """
    if len(objects) < 2:
        return 0.0
    
    close_pairs = 0
    total_pairs = 0
    
    for i, o1 in enumerate(objects):
        for o2 in objects[i+1:]:
            total_pairs += 1
            alt_diff = abs(o1["altitude_km"] - o2["altitude_km"])
            if alt_diff < 25:  # Very close altitude
                close_pairs += 1
    
    if total_pairs == 0:
        return 0.0
    
    expected_close = total_pairs * 0.01
    congestion = min(close_pairs / max(expected_close, 1), 3.0) / 3.0
    
    return congestion


def _estimate_maneuver_probability(objects: List[dict], constellation_counts: dict, total: int) -> float:
    """
    Estimate probability of coordinated maneuvers in the shell.
    Higher for shells dominated by large constellations.
    """
    if total == 0:
        return 0.0
    
    max_constellation = max(constellation_counts.values()) if constellation_counts else 0
    dominance_ratio = max_constellation / total
    
    active_count = sum(c for k, c in constellation_counts.items() if k not in ("DEBRIS", "OTHER"))
    active_ratio = active_count / total
    
    mega_constellation_bonus = 0.0
    for name in ("STARLINK", "ONEWEB"):
        if name in constellation_counts:
            mega_constellation_bonus += 0.1
    
    prob = (dominance_ratio * 0.3) + (active_ratio * 0.4) + mega_constellation_bonus
    return min(prob, 1.0)


def _compute_oii(
    total_count: int,
    density: float,
    congestion: float,
    maneuver_prob: float,
    diversity: float,
    altitude_km: float,
) -> float:
    """
    Compute Orbital Instability Index (0-100).
    
    Components:
    - Density factor: higher density = higher instability
    - Congestion factor: clustering increases collision risk
    - Maneuver factor: coordinated maneuvers create geometry changes
    - Diversity factor: mixed constellations increase interaction complexity
    - Altitude factor: LEO is more unstable due to drag and higher velocities
    """
    density_score = min(density * 2, 30)
    
    congestion_score = congestion * 25
    
    maneuver_score = maneuver_prob * 25
    
    diversity_score = min(diversity * 2, 10)
    
    if altitude_km < 500:
        alt_factor = 1.2
    elif altitude_km < 2000:
        alt_factor = 1.0
    else:
        alt_factor = 0.8
    
    count_factor = min(math.log10(max(total_count, 1) + 1) / 2, 1.5)
    
    raw_oii = (density_score + congestion_score + maneuver_score + diversity_score) * alt_factor * count_factor
    
    return min(max(raw_oii, 0), 100)


def _build_shell_data() -> dict:
    """Build complete shell analysis from TLE data."""
    t0 = time.time()
    
    tle_lines = get_tle_lines(cache="debris_merged")
    tle_text = "\n".join(tle_lines)
    tles = parse_tle_text(tle_text, limit=100000)
    
    from app.services.orbit_real import tle_to_position
    
    objects_by_shell: Dict[int, List[dict]] = {}
    
    for name, line1, line2 in tles[:20000]:  # Limit for performance
        norad_id = _parse_norad_id(line2)
        pos = tle_to_position(line1, line2)
        if pos is None:
            continue
        
        altitude = _norm(pos) - EARTH_RADIUS_KM
        if altitude < 100 or altitude > 50000:
            continue
        
        shell_floor = int(altitude // DEFAULT_SHELL_THICKNESS_KM) * DEFAULT_SHELL_THICKNESS_KM
        constellation = _classify_constellation(norad_id, name)
        
        obj = {
            "name": name,
            "norad_id": norad_id,
            "altitude_km": round(altitude, 2),
            "constellation": constellation,
            "position": pos,
        }
        
        if shell_floor not in objects_by_shell:
            objects_by_shell[shell_floor] = []
        objects_by_shell[shell_floor].append(obj)
    
    shell_analyses = []
    for floor_km in sorted(objects_by_shell.keys()):
        objects = objects_by_shell[floor_km]
        if len(objects) < 2:
            continue
        
        ceil_km = floor_km + DEFAULT_SHELL_THICKNESS_KM
        metrics = _compute_shell_metrics(objects, floor_km, ceil_km)
        shell_analyses.append(metrics)
    
    shell_analyses.sort(key=lambda x: x["oii_score"], reverse=True)
    
    processing_ms = round((time.time() - t0) * 1000, 1)
    
    return {
        "timestamp_utc": _utc_now().isoformat(),
        "shell_count": len(shell_analyses),
        "total_objects_analyzed": sum(s["object_count"] for s in shell_analyses),
        "processing_ms": processing_ms,
        "shells": shell_analyses[:50],  # Top 50 shells
    }


@router.get("/shell/instability")
async def get_shell_instability(
    altitude_km: Optional[int] = Query(default=None, description="Specific altitude (km) to analyze"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of shells to return"),
):
    """
    Get Orbital Instability Index (OII) for orbital shells.
    
    Returns shell-level risk metrics including:
    - OII score (0-100): Overall instability indicator
    - Object count: Total tracked objects in shell
    - Density: Objects per million cubic km
    - Congestion index: Clustering measure (0-1)
    - Maneuver cluster probability: Likelihood of coordinated maneuvers
    - Constellation breakdown: Objects by constellation/operator
    """
    data = _build_shell_data()
    
    shells = data["shells"]
    
    if altitude_km is not None:
        target_floor = (altitude_km // DEFAULT_SHELL_THICKNESS_KM) * DEFAULT_SHELL_THICKNESS_KM
        shells = [s for s in shells if s["shell_altitude_km"] == target_floor]
        
        if not shells:
            return {
                "timestamp_utc": _utc_now().isoformat(),
                "altitude_km": altitude_km,
                "shell_altitude_km": target_floor,
                "shell_ceil_km": target_floor + DEFAULT_SHELL_THICKNESS_KM,
                "oii_score": 0,
                "risk_level": "NOMINAL",
                "object_count": 0,
                "message": "No tracked objects found at this altitude",
            }
    
    return {
        "timestamp_utc": data["timestamp_utc"],
        "shell_count": len(shells),
        "total_objects_analyzed": data["total_objects_analyzed"],
        "processing_ms": data["processing_ms"],
        "shells": shells[:limit],
    }


@router.get("/shell/instability/{altitude_km:path}")
async def get_shell_instability_at_altitude(altitude_km: int):
    """
    Get OII for a specific altitude band.
    
    The altitude is bucketed to the nearest 75km shell.
    """
    return await get_shell_instability(altitude_km=altitude_km, limit=1)
