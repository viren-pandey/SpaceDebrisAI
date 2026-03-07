from fastapi import APIRouter
from datetime import datetime, timezone

from app.services.tle_fetcher import fetch_tles_local
from app.services.orbit_real import tle_to_position, teme_to_geodetic

router = APIRouter()


@router.get("/satellites")
def get_satellites():
    """Return real-time positions for all tracked satellites (SGP4 propagation)."""
    tles = fetch_tles_local(limit=200)
    now_utc = datetime.now(timezone.utc)

    result = []
    errors = 0
    for name, l1, l2 in tles:
        pos = tle_to_position(l1, l2)
        if pos is None:
            errors += 1
            continue
        try:
            lat, lon, alt = teme_to_geodetic(pos, utc_dt=now_utc)
        except Exception:
            errors += 1
            continue
        result.append({
            "name":      name,
            "lat":       lat,
            "lon":       lon,
            "alt_km":    alt,
            "tle_line1": l1.strip(),
            "tle_line2": l2.strip(),
        })

    return {
        "count":     len(result),
        "errors":    errors,
        "timestamp": now_utc.isoformat(),
        "satellites": result,
    }
