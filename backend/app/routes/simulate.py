import os
from fastapi import APIRouter, Request
from datetime import datetime, timezone
import heapq
import time
import math
import itertools
import random
import threading

from ml_logic.classifier import classify_conjunction
from ml_logic.avoidance import recommend_maneuver
from app.services.tle_fetcher import get_local_timestamp, get_tle_lines, parse_tle_text, refresh_all_caches
from app.services.orbit_real import tle_to_position, distance_km as dist3d, teme_to_geodetic

router = APIRouter()

EARTH_RADIUS_KM = 6371.0
MAX_SATELLITES = max(120, int(os.getenv("SIMULATION_PUBLIC_OBJECT_LIMIT", "500")))
LOCAL_TLE_COUNT_LIMIT = 1000000
SIMULATION_CACHE_TTL_SECONDS = max(300, int(os.getenv("SIMULATION_CACHE_TTL_SECONDS", "3600")))
TLE_BACKGROUND_REFRESH_SECONDS = 900  # 15 minutes
CLOSEST_PAIR_COUNT = 20
_SIMULATION_CACHE_LOCK = threading.Lock()
_SIMULATION_CACHE_CONDITION = threading.Condition(_SIMULATION_CACHE_LOCK)
_SIMULATION_CACHE = {
    "payload": None,
    "catalog_stamp": None,
    "expires_at": 0.0,
    "building": False,
    "norad_ids": set(),  # Track satellite IDs for change detection
}
_SATELLITE_CHANGE_LOG = {
    "last_update": None,
    "added": [],
    "removed": [],
    "total_changes": 0,
}
_TLE_REFRESH_THREAD: threading.Thread | None = None
_TLE_REFRESH_LOCK = threading.Lock()


def _start_tle_background_refresh():
    """Start background thread to refresh TLE caches periodically."""
    global _TLE_REFRESH_THREAD

    def _refresh_loop():
        while True:
            try:
                time.sleep(TLE_BACKGROUND_REFRESH_SECONDS)
                print("[SIMULATE] Triggering background TLE cache refresh...")
                refresh_all_caches(force=False)
                print("[SIMULATE] Background TLE cache refresh completed")
            except Exception as exc:
                print(f"[SIMULATE] Background TLE refresh failed: {exc}")

    with _TLE_REFRESH_LOCK:
        if _TLE_REFRESH_THREAD is None or not _TLE_REFRESH_THREAD.is_alive():
            _TLE_REFRESH_THREAD = threading.Thread(
                target=_refresh_loop,
                name="simulate-tle-refresh",
                daemon=True,
            )
            _TLE_REFRESH_THREAD.start()
            print("[SIMULATE] Background TLE refresh thread started")

# Fallback satellite positions using circular orbit approximation
def _orb(a: float, inc_deg: float, raan_deg: float, anom_deg: float):
    inc  = math.radians(inc_deg)
    raan = math.radians(raan_deg)
    anom = math.radians(anom_deg)
    xo, yo = a * math.cos(anom), a * math.sin(anom)
    x =  xo * math.cos(raan) - yo * math.cos(inc) * math.sin(raan)
    y =  xo * math.sin(raan) + yo * math.cos(inc) * math.cos(raan)
    z =  yo * math.sin(inc)
    return (x, y, z)

SIMULATED_SATS = [
    # (name, position, norad_id)
    ("ISS (ZARYA)",        _orb(6779, 51.6,  45.0, 123.000), 25544),
    ("PROGRESS MS-24",     _orb(6779, 51.6,  45.0, 123.025), 58400),  # ~3 km  CRITICAL
    ("STARLINK-3456",      _orb(6921, 53.0, 120.0, 210.000), 44713),
    ("STARLINK-3457",      _orb(6921, 53.0, 120.0, 210.115), 44714),  # ~14 km MEDIUM
    ("TERRA",              _orb(7076, 98.2, 310.0,  87.000), 25994),
    ("AQUA",               _orb(7076, 98.2, 310.0,  87.400), 27424),  # ~49 km LOW
    ("NOAA 18",            _orb(7222, 99.0, 210.0,  45.0), 28654),
    ("SENTINEL-1A",        _orb(7064, 98.2,  55.0, 160.0), 39384),
    ("LANDSAT 8",          _orb(7076, 98.2, 130.0, 290.0), 39084),
    ("COSMOS 2533",        _orb(6771, 65.0, 180.0, 310.0), 44594),
    ("NOAA 20",            _orb(7195, 98.74, 190.0,  75.0), 43206),
    ("SUOMI-NPP",          _orb(7195, 98.74, 200.0,  75.5), 37849),  # closer pair
    ("SENTINEL-2A",        _orb(7157, 98.57,  80.0, 200.0), 40697),
    ("SENTINEL-2B",        _orb(7157, 98.57,  80.5, 200.0), 42063),
    ("GRACE-FO A",         _orb(6861, 89.0,  10.0,  30.0), 43476),
    ("GRACE-FO B",         _orb(6861, 89.0,  10.0,  31.8), 43477),  # 220 km behind
    ("IRIDIUM 91",         _orb(7152, 86.4,  35.0, 100.0), 24793),
    ("IRIDIUM NEXT-101",   _orb(7152, 86.4,  95.0, 100.0), 42960),
    ("METOP-B",            _orb(7188, 98.7, 270.0, 150.0), 38771),
    ("METOP-C",            _orb(7188, 98.7, 270.0, 152.0), 43641),
]


def _altitude(pos):
    return math.sqrt(pos[0]**2 + pos[1]**2 + pos[2]**2) - EARTH_RADIUS_KM


def calculate_tca_and_pc(pos1: tuple, pos2: tuple, v1: tuple, v2: tuple):
    """
    Calculate Time of Closest Approach (TCA) and Probability of Collision (Pc).
    Uses simplified relative motion model.
    Returns: (tca_datetime, miss_distance_km, pc_value, pc_scientific, confidence)
    """
    from datetime import timedelta
    
    r_rel = (pos1[0] - pos2[0], pos1[1] - pos2[1], pos1[2] - pos2[2])
    v_rel = (v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2])
    
    a = v_rel[0]**2 + v_rel[1]**2 + v_rel[2]**2
    b = 2 * (r_rel[0]*v_rel[0] + r_rel[1]*v_rel[1] + r_rel[2]*v_rel[2])
    c = r_rel[0]**2 + r_rel[1]**2 + r_rel[2]**2
    
    if a > 0:
        discriminant = b**2 - 4*a*c
        if discriminant >= 0:
            t1 = (-b - math.sqrt(discriminant)) / (2*a)
            t2 = (-b + math.sqrt(discriminant)) / (2*a)
            if t1 > 0:
                t_tca = t1
            elif t2 > 0:
                t_tca = t2
            else:
                t_tca = 0
        else:
            t_tca = 0
    else:
        t_tca = 0
    
    t_tca = max(0, min(t_tca, 86400))
    
    miss_distance = math.sqrt(c)
    if a > 0 and t_tca > 0:
        future_pos1 = (pos1[0] + v1[0]*t_tca, pos1[1] + v1[1]*t_tca, pos1[2] + v1[2]*t_tca)
        future_pos2 = (pos2[0] + v2[0]*t_tca, pos2[1] + v2[1]*t_tca, pos2[2] + v2[2]*t_tca)
        miss_distance = math.sqrt(
            (future_pos1[0]-future_pos2[0])**2 + 
            (future_pos1[1]-future_pos2[1])**2 + 
            (future_pos1[2]-future_pos2[2])**2
        )
    
    combined_radius_km = 0.005
    uncertainty_km = max(miss_distance * 0.1, 0.1)
    
    if miss_distance < 0.001:
        miss_distance = 0.001
    
    pc = (combined_radius_km**2) / (4 * uncertainty_km**2) * math.exp(-miss_distance**2 / (4 * uncertainty_km**2))
    pc = min(pc, 1.0)
    
    pc_scientific = f"{pc:.2e}"
    
    if pc > 1e-4:
        confidence = "HIGH"
    elif pc > 1e-6:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"
    
    tca_time = datetime.now(timezone.utc) + timedelta(seconds=t_tca)
    
    return tca_time, miss_distance, pc, pc_scientific, confidence


def _estimate_velocity(pos: tuple, alt_km: float) -> tuple:
    """Estimate orbital velocity for a circular orbit at given altitude."""
    mu = 398600.4418
    r = EARTH_RADIUS_KM + alt_km
    v = math.sqrt(mu / r)
    if pos[0] == 0 and pos[1] == 0:
        return (v, 0, 0)
    mag = math.sqrt(pos[0]**2 + pos[1]**2 + pos[2]**2)
    return (pos[0]/mag * v, pos[1]/mag * v, pos[2]/mag * v)


def _build_pairs(sats: list, mode: str) -> dict:
    """
    Build conjunction pairs from satellite list using spatial binning.
    sats: list of (name, pos, norad_id) tuples
    """
    t0 = time.time()

    closest_heap = []
    pairs_checked = 0
    max_distance_threshold = 5000  # Skip pairs further than 5000 km
    
    # Pre-compute altitudes and group by altitude shell (500km bins)
    shell_size = 500  # km
    shells = {}
    for i, (name, pos, norad_id) in enumerate(sats):
        alt = _altitude(pos)
        shell_key = int(alt / shell_size)
        if shell_key not in shells:
            shells[shell_key] = []
        shells[shell_key].append((i, name, pos, norad_id))
    
    # Only check adjacent shells (within threshold)
    checked_pairs = set()
    
    for shell_key, satellites in shells.items():
        for i, n1, p1, id1 in satellites:
            # Check satellites in current and adjacent shells
            for offset in [-1, 0, 1]:
                neighbor_key = shell_key + offset
                if neighbor_key not in shells:
                    continue
                for j, n2, p2, id2 in shells[neighbor_key]:
                    if j <= i:
                        continue
                    pair_key = (min(i, j), max(i, j))
                    if pair_key in checked_pairs:
                        continue
                    checked_pairs.add(pair_key)
                    
                    if id1 is not None and id2 is not None and id1 == id2:
                        continue
                    
                    d = dist3d(p1, p2)
                    if d < 0.5 or d > max_distance_threshold:
                        continue
                    
                    pairs_checked += 1
                    entry = (-d, n1, p1, n2, p2, id1, id2)
                    if len(closest_heap) < CLOSEST_PAIR_COUNT:
                        heapq.heappush(closest_heap, entry)
                        continue
                    if d < -closest_heap[0][0]:
                        heapq.heapreplace(closest_heap, entry)

    closest = []
    for item in sorted(closest_heap, key=lambda item: -item[0]):
        neg_dist, n1, p1, n2, p2, id1, id2 = item
        d = -neg_dist
        alt1 = _altitude(p1)
        alt2 = _altitude(p2)
        alt = (alt1 + alt2) / 2.0
        
        v1 = _estimate_velocity(p1, alt1)
        v2 = _estimate_velocity(p2, alt2)
        
        dv = (v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2])
        rel_vel_km_s = math.sqrt(dv[0]**2 + dv[1]**2 + dv[2]**2)
        
        tca_time, tca_miss, pc, pc_scientific, confidence = calculate_tca_and_pc(p1, p2, v1, v2)
        
        risk_before = classify_conjunction(d, alt, v1, v2)
        maneuver = recommend_maneuver(d, risk_before)
        risk_after = classify_conjunction(maneuver["new_distance_km"], alt, v1, v2)
        closest.append({
            "satellites": [n1, n2],
            "norad_ids": [id1, id2],
            "tca_time": tca_time.isoformat() if tca_time else None,
            "miss_distance_km": round(tca_miss, 2),
            "probability_of_collision": pc,
            "pc_scientific": pc_scientific,
            "confidence": confidence,
            "relative_velocity_km_s": round(rel_vel_km_s, 3),
            "before": {"distance_km": round(d, 2), "risk": risk_before},
            "after": {
                "distance_km": maneuver["new_distance_km"],
                "risk": risk_after,
            },
            "maneuver": maneuver["action"],
        })

    ms = round((time.time() - t0) * 1000, 1)
    return {
        "closest_pairs": closest,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "pairs_checked": pairs_checked,
            "processing_ms": ms,
        },
        "mode": mode,
    }


def _extract_norad_id(line1: str) -> int | None:
    """Extract NORAD catalog number from TLE line 1."""
    try:
        return int(line1[2:7].strip())
    except (ValueError, IndexError):
        return None


# Known active constellation name patterns (case-insensitive)
ACTIVE_CONSTELLATION_PATTERNS = [
    "STARLINK", "ONEWEB", "IRIDIUM", "GPS", "GALILEO", "GLONASS", "BEIDOU",
    "SES-", "EUTELSAT", "INTELSAT", "VIASTAR", "ARABSAT", "TURKSAT",
    "NOAA", "METOP", "SENTINEL", "LANDSAT", "TERRA", "AQUA", "SUOMI",
    "ISS", "TIANGONG", "HST", "HUBBLE", "JWST", "GOES", "HIMAWARI",
    "ELECTRO-L", "FY-", "ZY-", "HY-", "GEO-KOMPSAT",
    "COSMOS", "FENGYUN", "YAOGAN",  # Recent operational
]

# NORAD ID ranges for active operational satellites (approximate)
ACTIVE_NORAD_RANGES = [
    (20000, 99999),  # Modern operational satellites
]


def _is_active_satellite(name: str, norad_id: int | None) -> bool:
    """Check if a satellite is likely an active operational satellite."""
    name_upper = name.upper()
    
    # Check by name pattern
    for pattern in ACTIVE_CONSTELLATION_PATTERNS:
        if pattern in name_upper:
            return True
    
    # Check by NORAD ID range (newer IDs are more likely active)
    if norad_id is not None:
        for low, high in ACTIVE_NORAD_RANGES:
            if low <= norad_id <= high:
                # But exclude if name indicates debris
                if "DEB" in name_upper or "R/B" in name_upper or "FRAG" in name_upper:
                    continue
                return True
    
    return False


def _select_public_tles(all_tles: list, catalog_stamp: str | None) -> list:
    """
    Select TLEs for public demo, prioritizing active constellation satellites.
    Ensures the demo includes real operators, not just Cold War debris.
    """
    if len(all_tles) <= MAX_SATELLITES:
        return list(all_tles)

    # Separate active satellites from debris
    active_sats = []
    debris_and_old = []
    
    for tle in all_tles:
        name, l1, l2 = tle[0], tle[1], tle[2]
        norad_id = tle[3] if len(tle) > 3 else None
        
        if _is_active_satellite(name, norad_id):
            active_sats.append(tle)
        else:
            debris_and_old.append(tle)
    
    # Shuffle both groups
    random.shuffle(active_sats)
    random.shuffle(debris_and_old)
    
    # Fill with active satellites first (up to 60% of max), then debris
    active_limit = int(MAX_SATELLITES * 0.6)
    selected_active = active_sats[:active_limit]
    remaining_slots = MAX_SATELLITES - len(selected_active)
    selected_debris = debris_and_old[:remaining_slots]
    
    # Combine and shuffle final selection for variety
    selected = selected_active + selected_debris
    random.shuffle(selected)
    
    return selected


def _dedup_by_norad(tles: list) -> list:
    """Deduplicate TLEs by NORAD ID, keeping first occurrence."""
    seen_ids = set()
    result = []
    for name, l1, l2 in tles:
        norad_id = _extract_norad_id(l2)  # NORAD ID is in line 2
        if norad_id is None:
            result.append((name, l1, l2, None))
            continue
        if norad_id not in seen_ids:
            seen_ids.add(norad_id)
            result.append((name, l1, l2, norad_id))
    return result


def _build_simulation_snapshot() -> dict:
    raw_tle_lines = get_tle_lines(cache="debris_merged")
    raw_tles = "\n".join(raw_tle_lines)
    all_tles = parse_tle_text(raw_tles, limit=LOCAL_TLE_COUNT_LIMIT)
    
    # Deduplicate by NORAD ID before selection
    deduped_tles = _dedup_by_norad(all_tles)
    total_catalog = len(deduped_tles)
    
    catalog_stamp = get_local_timestamp()
    selected_tles = _select_public_tles(deduped_tles, catalog_stamp)

    valid_sats = []
    current_norad_ids = set()
    for name, l1, l2, norad_id in selected_tles:
        pos = tle_to_position(l1, l2)
        if pos is not None:
            valid_sats.append((name, pos, norad_id))
            if norad_id is not None:
                current_norad_ids.add(norad_id)

    sats_for_pairs = valid_sats if len(valid_sats) >= 3 else SIMULATED_SATS
    mode_label = "local" if len(valid_sats) >= 3 else "simulation"
    tle_source = "cache" if mode_label == "local" else "simulation"

    result = _build_pairs(sats_for_pairs, mode=mode_label)

    now_utc = datetime.now(timezone.utc)
    sat_positions = []
    for sat_data in sats_for_pairs:
        name = sat_data[0]
        pos = sat_data[1]
        norad_id = sat_data[2] if len(sat_data) > 2 else None
        try:
            lat, lon, alt = teme_to_geodetic(pos, utc_dt=now_utc)
            sat_positions.append({
                "name": name, 
                "lat": lat, 
                "lon": lon, 
                "alt_km": alt,
                "norad_id": norad_id,
            })
        except Exception:
            pass

    # Track changes from previous catalog
    prev_norad_ids = _SIMULATION_CACHE.get("norad_ids", set())
    added_ids = current_norad_ids - prev_norad_ids
    removed_ids = prev_norad_ids - current_norad_ids
    
    # Get names for added/removed satellites
    name_map = {tle[3]: tle[0] for tle in selected_tles if tle[3] is not None}
    added_sats = [{"norad_id": nid, "name": name_map.get(nid, "Unknown")} for nid in added_ids]
    removed_sats = [{"norad_id": nid} for nid in removed_ids]
    
    # Log changes if there are any
    if added_ids or removed_ids:
        print(f"[SIMULATE] Catalog changes: +{len(added_ids)} added, -{len(removed_ids)} removed")
        print(f"[SIMULATE] Added: {added_sats[:5]}{'...' if len(added_sats) > 5 else ''}")
        print(f"[SIMULATE] Removed: {removed_sats[:5]}{'...' if len(removed_sats) > 5 else ''}")
    
    # Update change log
    _SATELLITE_CHANGE_LOG["last_update"] = datetime.now(timezone.utc).isoformat()
    _SATELLITE_CHANGE_LOG["added"] = added_sats
    _SATELLITE_CHANGE_LOG["removed"] = removed_sats
    _SATELLITE_CHANGE_LOG["total_changes"] = len(added_ids) + len(removed_ids)
    
    # Update cache with current NORAD IDs
    _SIMULATION_CACHE["norad_ids"] = current_norad_ids

    result["meta"] = {
        "satellites": len(sat_positions),
        "public_objects": len(selected_tles),
        "total_tle_records": total_catalog,
        "deduplicated_records": total_catalog,
        "tle_source": tle_source,
        "satellites_screened": len(sats_for_pairs),
        "pairs_checked": result["meta"]["pairs_checked"],
        "processing_ms": result["meta"]["processing_ms"],
        "cache_last_update": catalog_stamp,
        "catalog_changes": {
            "added": len(added_ids),
            "removed": len(removed_ids),
        },
    }
    result["satellites"] = sat_positions

    return result


def _get_cached_simulation() -> dict:
    catalog_stamp = get_local_timestamp() or "cache-missing"
    now = time.time()

    with _SIMULATION_CACHE_CONDITION:
        while True:
            cached_payload = _SIMULATION_CACHE["payload"]
            if (
                cached_payload is not None
                and _SIMULATION_CACHE["catalog_stamp"] == catalog_stamp
                and now < _SIMULATION_CACHE["expires_at"]
            ):
                return cached_payload

            if not _SIMULATION_CACHE["building"]:
                _SIMULATION_CACHE["building"] = True
                break

            _SIMULATION_CACHE_CONDITION.wait(timeout=5)
            now = time.time()

    try:
        result = _build_simulation_snapshot()
    finally:
        completed_at = time.time()
        with _SIMULATION_CACHE_CONDITION:
            _SIMULATION_CACHE["building"] = False
            if "result" in locals():
                _SIMULATION_CACHE["payload"] = result
                _SIMULATION_CACHE["catalog_stamp"] = catalog_stamp
                _SIMULATION_CACHE["expires_at"] = completed_at + SIMULATION_CACHE_TTL_SECONDS
            _SIMULATION_CACHE_CONDITION.notify_all()

    return result


@router.get("/simulate")
async def simulate(request: Request):
    force = request.query_params.get("refresh", "").lower() in ("1", "true", "yes")
    if force:
        print("[SIMULATE] Force refresh requested, triggering TLE cache refresh...")
        refresh_all_caches(force=True)
        with _SIMULATION_CACHE_CONDITION:
            _SIMULATION_CACHE["expires_at"] = 0
    return _get_cached_simulation()


@router.get("/simulate/high-risk")
async def get_high_risk_collisions(request: Request, threshold: str = "HIGH"):
    """
    Get high-risk collision events filtered by risk level.
    threshold: CRITICAL, HIGH, MEDIUM (default: HIGH)
    """
    data = _get_cached_simulation()
    risk_levels = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1}
    min_level = risk_levels.get(threshold.upper(), 2)
    
    high_risk = []
    for pair in data.get("closest_pairs", []):
        risk = pair.get("before", {}).get("risk", {})
        level = risk.get("level", "LOW")
        level_val = risk_levels.get(level, 0)
        if level_val >= min_level:
            high_risk.append({
                "satellites": pair["satellites"],
                "norad_ids": pair.get("norad_ids", []),
                "miss_distance_km": pair.get("miss_distance_km"),
                "probability_of_collision": pair.get("probability_of_collision"),
                "relative_velocity_km_s": pair.get("relative_velocity_km_s"),
                "risk_level": level,
                "risk_score": risk.get("score"),
                "maneuver": pair.get("maneuver"),
                "tca_time": pair.get("tca_time"),
            })
    
    return {
        "threshold": threshold.upper(),
        "count": len(high_risk),
        "high_risk_collisions": high_risk,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/simulate/stats")
async def get_simulation_stats():
    """Get simulation statistics and change summary."""
    data = _get_cached_simulation()
    meta = data.get("meta", {})
    
    risk_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for pair in data.get("closest_pairs", []):
        level = pair.get("before", {}).get("risk", {}).get("level", "LOW")
        if level in risk_counts:
            risk_counts[level] += 1
    
    return {
        "satellites_screened": meta.get("satellites_screened", 0),
        "total_catalog_records": meta.get("total_tle_records", 0),
        "pairs_checked": meta.get("pairs_checked", 0),
        "processing_ms": meta.get("processing_ms", 0),
        "tle_source": meta.get("tle_source", "unknown"),
        "catalog_changes": meta.get("catalog_changes", {"added": 0, "removed": 0}),
        "risk_distribution": risk_counts,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


# Start background refresh thread on module load
_start_tle_background_refresh()
