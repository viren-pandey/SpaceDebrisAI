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
from app.services.tle_fetcher import get_local_timestamp, load_tles_from_cache, parse_tle_text
from app.services.orbit_real import tle_to_position, distance_km as dist3d, teme_to_geodetic
from app.services.usage_metrics import record_request_usage

router = APIRouter()

EARTH_RADIUS_KM = 6371.0
MAX_SATELLITES = 2000
LOCAL_TLE_COUNT_LIMIT = 1000000
SIMULATION_CACHE_TTL_SECONDS = 300
CLOSEST_PAIR_COUNT = 20
_SIMULATION_CACHE_LOCK = threading.Lock()
_SIMULATION_CACHE = {
    "payload": None,
    "catalog_stamp": None,
    "expires_at": 0.0,
}

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
    ("ISS (ZARYA)",        _orb(6779, 51.6,  45.0, 123.000)),
    ("PROGRESS MS-24",     _orb(6779, 51.6,  45.0, 123.025)),  # ~3 km  CRITICAL
    ("STARLINK-3456",      _orb(6921, 53.0, 120.0, 210.000)),
    ("STARLINK-3457",      _orb(6921, 53.0, 120.0, 210.115)),  # ~14 km MEDIUM
    ("TERRA",              _orb(7076, 98.2, 310.0,  87.000)),
    ("AQUA",               _orb(7076, 98.2, 310.0,  87.400)),  # ~49 km LOW
    ("NOAA 18",            _orb(7222, 99.0, 210.0,  45.0)),
    ("SENTINEL-1A",        _orb(7064, 98.2,  55.0, 160.0)),
    ("LANDSAT 8",          _orb(7076, 98.2, 130.0, 290.0)),
    ("COSMOS 2533",        _orb(6771, 65.0, 180.0, 310.0)),
    ("NOAA 20",            _orb(7195, 98.74, 190.0,  75.0)),
    ("SUOMI-NPP",          _orb(7195, 98.74, 200.0,  75.5)),   # closer pair
    ("SENTINEL-2A",        _orb(7157, 98.57,  80.0, 200.0)),
    ("SENTINEL-2B",        _orb(7157, 98.57,  80.5, 200.0)),
    ("GRACE-FO A",         _orb(6861, 89.0,  10.0,  30.0)),
    ("GRACE-FO B",         _orb(6861, 89.0,  10.0,  31.8)),    # 220 km behind
    ("IRIDIUM 91",         _orb(7152, 86.4,  35.0, 100.0)),
    ("IRIDIUM NEXT-101",   _orb(7152, 86.4,  95.0, 100.0)),
    ("METOP-B",            _orb(7188, 98.7, 270.0, 150.0)),
    ("METOP-C",            _orb(7188, 98.7, 270.0, 152.0)),
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
    t0 = time.time()

    closest_heap = []
    pairs_checked = 0
    for (n1, p1), (n2, p2) in itertools.combinations(sats, 2):
        d = dist3d(p1, p2)
        if d < 0.5:  # skip co-located objects
            continue
        pairs_checked += 1
        entry = (-d, n1, p1, n2, p2)
        if len(closest_heap) < CLOSEST_PAIR_COUNT:
            heapq.heappush(closest_heap, entry)
            continue
        if d < -closest_heap[0][0]:
            heapq.heapreplace(closest_heap, entry)

    closest = []
    for neg_dist, n1, p1, n2, p2 in sorted(closest_heap, key=lambda item: -item[0]):
        d = -neg_dist
        alt1 = _altitude(p1)
        alt2 = _altitude(p2)
        alt = (alt1 + alt2) / 2.0
        
        v1 = _estimate_velocity(p1, alt1)
        v2 = _estimate_velocity(p2, alt2)
        
        tca_time, tca_miss, pc, pc_scientific, confidence = calculate_tca_and_pc(p1, p2, v1, v2)
        
        risk_before = classify_conjunction(d, alt)
        maneuver = recommend_maneuver(d, risk_before)
        risk_after = classify_conjunction(maneuver["new_distance_km"], alt)
        closest.append({
            "satellites": [n1, n2],
            "tca_time": tca_time.isoformat() if tca_time else None,
            "miss_distance_km": round(tca_miss, 2),
            "probability_of_collision": pc,
            "pc_scientific": pc_scientific,
            "confidence": confidence,
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


def _select_public_tles(all_tles: list, catalog_stamp: str | None) -> list:
    if len(all_tles) <= MAX_SATELLITES:
        return list(all_tles)

    # Shuffle before slicing for public selection
    tle_blocks = list(all_tles)
    import random
    random.shuffle(tle_blocks)
    selected = tle_blocks[:MAX_SATELLITES]
    return selected


def _build_simulation_snapshot() -> dict:
    raw_tles = load_tles_from_cache()
    all_tles = parse_tle_text(raw_tles, limit=LOCAL_TLE_COUNT_LIMIT)
    total_catalog = len(all_tles)
    catalog_stamp = get_local_timestamp()
    selected_tles = _select_public_tles(all_tles, catalog_stamp)

    valid_sats = []
    for name, l1, l2 in selected_tles:
        pos = tle_to_position(l1, l2)
        if pos is not None:
            valid_sats.append((name, pos))

    sats_for_pairs = valid_sats if len(valid_sats) >= 3 else SIMULATED_SATS
    mode_label = "local" if len(valid_sats) >= 3 else "simulation"
    tle_source = "cache" if mode_label == "local" else "simulation"

    result = _build_pairs(sats_for_pairs, mode=mode_label)

    now_utc = datetime.now(timezone.utc)
    sat_positions = []
    for name, pos in sats_for_pairs:
        try:
            lat, lon, alt = teme_to_geodetic(pos, utc_dt=now_utc)
            sat_positions.append({"name": name, "lat": lat, "lon": lon, "alt_km": alt})
        except Exception:
            pass

    result["meta"] = {
        "satellites": len(sat_positions),
        "public_objects": len(selected_tles),
        "tle_records": total_catalog,
        "tle_source": tle_source,
        "total_catalog": total_catalog,
        "satellites_screened": len(sats_for_pairs),
        "pairs_checked": result["meta"]["pairs_checked"],
        "processing_ms": result["meta"]["processing_ms"],
        "cache_last_update": catalog_stamp,
    }
    result["satellites"] = sat_positions

    return result


def _get_cached_simulation() -> dict:
    catalog_stamp = get_local_timestamp() or "cache-missing"
    now = time.time()

    with _SIMULATION_CACHE_LOCK:
        cached_payload = _SIMULATION_CACHE["payload"]
        if (
            cached_payload is not None
            and _SIMULATION_CACHE["catalog_stamp"] == catalog_stamp
            and now < _SIMULATION_CACHE["expires_at"]
        ):
            return cached_payload

    result = _build_simulation_snapshot()

    with _SIMULATION_CACHE_LOCK:
        _SIMULATION_CACHE["payload"] = result
        _SIMULATION_CACHE["catalog_stamp"] = catalog_stamp
        _SIMULATION_CACHE["expires_at"] = now + SIMULATION_CACHE_TTL_SECONDS

    return result


@router.get("/simulate")
async def simulate(request: Request):
    record_request_usage(request, "simulate")
    return _get_cached_simulation()
