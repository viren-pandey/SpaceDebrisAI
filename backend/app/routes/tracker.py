from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.services.orbit_real import tle_to_position, teme_to_geodetic
from app.services.tle_fetcher import get_local_timestamp, get_tle_lines, parse_tle_text
from app.services.usage_metrics import record_request_usage

router = APIRouter()

TRACKER_TLE_LIMIT = 500


def _extract_norad_id(line1: str) -> int | None:
    try:
        return int(line1[2:7])
    except (TypeError, ValueError):
        return None


@router.get("/tracker/positions")
async def tracker_positions(request: Request, filter: str = "all"):
    record_request_usage(request, "tracker")
    
    if filter == "leo_debris":
        cache = "debris_leo"
    elif filter == "all_debris":
        cache = "debris_all"
    else:
        cache = "full"
    
    raw_tle_lines = get_tle_lines(cache=cache)
    raw_tles = "\n".join(raw_tle_lines)
    tles = parse_tle_text(raw_tles, limit=TRACKER_TLE_LIMIT)
    now_utc = datetime.now(timezone.utc)
    timestamp = int(now_utc.timestamp())

    results = []
    errors = 0

    for name, line1, line2 in tles:
        norad_id = _extract_norad_id(line1)
        if norad_id is None:
            errors += 1
            continue

        position = tle_to_position(line1, line2)
        if position is None:
            errors += 1
            continue

        try:
            lat, lon, alt = teme_to_geodetic(position, utc_dt=now_utc)
        except Exception:
            errors += 1
            continue

        results.append({
            "noradId": norad_id,
            "name": name,
            "satname": name,
            "lat": lat,
            "lon": lon,
            "alt": alt,
            "timestamp": timestamp,
            "azimuth": None,
            "elevation": None,
            "raw": {
                "NAME": name,
                "TLE_LINE_1": line1.strip(),
                "TLE_LINE_2": line2.strip(),
            },
        })

    return {
        "source": "cache",
        "count": len(results),
        "errors": errors,
        "satellites": results,
        "cached_at": get_local_timestamp() or timestamp,
    }
