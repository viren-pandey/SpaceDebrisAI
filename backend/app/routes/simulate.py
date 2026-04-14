from fastapi import APIRouter
from datetime import datetime, timezone
import time
import math
import itertools
import random

from ml_logic.classifier import classify_conjunction
from ml_logic.avoidance import recommend_maneuver
from app.services.tle_fetcher import fetch_tles_with_source
from app.services.orbit_real import tle_to_position, distance_km as dist3d, teme_to_geodetic

router = APIRouter()

EARTH_RADIUS_KM = 6371.0
MAX_SATELLITES = 5000
LOCAL_TLE_COUNT_LIMIT = 1000000

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


def _build_pairs(sats: list, mode: str) -> dict:
    t0 = time.time()

    all_pairs = []
    for (n1, p1), (n2, p2) in itertools.combinations(sats, 2):
        d = dist3d(p1, p2)
        if d < 0.5:  # skip co-located objects
            continue
        alt = (_altitude(p1) + _altitude(p2)) / 2.0
        risk_before  = classify_conjunction(d, alt)
        maneuver     = recommend_maneuver(d, risk_before)
        risk_after   = classify_conjunction(maneuver["new_distance_km"], alt)
        all_pairs.append({
            "_dist":      d,
            "satellites": [n1, n2],
            "before":     {"distance_km": round(d, 2), "risk": risk_before},
            "after":      {
                "distance_km": maneuver["new_distance_km"],
                "risk":        risk_after,
            },
            "maneuver":   maneuver["action"],
        })

    all_pairs.sort(key=lambda p: p["_dist"])
    closest = all_pairs[:20]
    for p in closest:
        p.pop("_dist", None)

    ms = round((time.time() - t0) * 1000, 1)
    return {
        "closest_pairs": closest,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "pairs_checked": len(all_pairs),
            "processing_ms": ms,
        },
        "mode": mode,
    }


@router.get("/simulate")
def simulate():
    all_tles, source = fetch_tles_with_source(limit=LOCAL_TLE_COUNT_LIMIT)
    total_catalog = len(all_tles)
    if source == "local":
        random.shuffle(all_tles)
    selected_tles = all_tles[:MAX_SATELLITES]

    valid_sats = []
    for name, l1, l2 in selected_tles:
        pos = tle_to_position(l1, l2)
        if pos is not None:
            valid_sats.append((name, pos))

    sats_for_pairs = valid_sats if len(valid_sats) >= 3 else SIMULATED_SATS
    mode_label = source if len(valid_sats) >= 3 else "simulation"

    result = _build_pairs(sats_for_pairs, mode=mode_label)
    result["meta"] = {
        "total_catalog": total_catalog,
        "satellites_screened": len(sats_for_pairs),
        "pairs_checked": result["meta"]["pairs_checked"],
        "processing_ms": result["meta"]["processing_ms"],
    }

    now_utc = datetime.now(timezone.utc)
    sat_positions = []
    for name, pos in sats_for_pairs:
        try:
            lat, lon, alt = teme_to_geodetic(pos, utc_dt=now_utc)
            sat_positions.append({"name": name, "lat": lat, "lon": lon, "alt_km": alt})
        except Exception:
            pass
    result["satellites"] = sat_positions

    return result


