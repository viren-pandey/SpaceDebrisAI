from fastapi import APIRouter
from datetime import datetime, timezone
import time
import math
import itertools

from ml_logic.classifier import classify_conjunction
from ml_logic.avoidance import recommend_maneuver
from app.services.tle_fetcher import fetch_tles, fetch_tles_local
from app.services.orbit_real import tle_to_position, distance_km as dist3d, teme_to_geodetic

router = APIRouter()

EARTH_RADIUS_KM = 6371.0

# ── Simulated satellite positions (fallback when CelesTrak is unreachable) ────
#    Uses Keplerian circular-orbit approximation so positions are realistic.
def _orb(a: float, inc_deg: float, raan_deg: float, anom_deg: float):
    """Return an approximate TEME position vector (km) for a circular orbit."""
    inc  = math.radians(inc_deg)
    raan = math.radians(raan_deg)
    anom = math.radians(anom_deg)
    xo, yo = a * math.cos(anom), a * math.sin(anom)
    x =  xo * math.cos(raan) - yo * math.cos(inc) * math.sin(raan)
    y =  xo * math.sin(raan) + yo * math.cos(inc) * math.cos(raan)
    z =  yo * math.sin(inc)
    return (x, y, z)

# Designed so the closest pairs span CRITICAL / MEDIUM / LOW risk levels:
#   ISS ↔ PROGRESS MS-24  ~3 km   → CRITICAL (LEO altitude boost ×1.2)
#   STARLINK-3456 ↔ 3457  ~14 km  → MEDIUM
#   TERRA ↔ AQUA           ~49 km  → LOW
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
    # Extended set — representative of all risk zones and orbital shells
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
    """Core logic: compute all pairs, classify risk, recommend maneuvers."""
    t0 = time.time()

    all_pairs = []
    for (n1, p1), (n2, p2) in itertools.combinations(sats, 2):
        d = dist3d(p1, p2)
        # Skip pairs that are physically co-located (docked modules, data artefacts)
        if d < 0.5:
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
            "satellites":    len(sats),
            "pairs_checked": len(all_pairs),
            "processing_ms": ms,
        },
        "mode": mode,
    }


@router.get("/simulate")
def simulate():
    # ── Load all 200 satellites from the local TLE database ───────────────────
    #    (CelesTrak is tried as an optional refresh but we never wait more than
    #     1 second for it; the local file is always authoritative for /simulate.)
    live_mode = False
    tles = fetch_tles_local(limit=200)

    try:
        import requests as _req
        r = _req.get(
            "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
            timeout=1,
        )
        r.raise_for_status()
        from app.services.tle_fetcher import _parse_tle_text
        ct_tles = _parse_tle_text(r.text, 200)
        if len(ct_tles) >= 200:
            tles = ct_tles
            live_mode = True
    except Exception:
        pass  # silently use local

    # SGP4-propagate every TLE → TEME position vector
    valid_sats = []
    for name, l1, l2 in tles:
        pos = tle_to_position(l1, l2)
        if pos is not None:
            valid_sats.append((name, pos))

    sats_for_pairs = valid_sats if len(valid_sats) >= 3 else SIMULATED_SATS
    mode_label = "live" if live_mode else ("local" if valid_sats else "simulation")

    result = _build_pairs(sats_for_pairs, mode=mode_label)
    result["meta"]["satellites"] = len(sats_for_pairs)

    # Build per-satellite position list (lat/lon/alt for all tracked objects)
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


