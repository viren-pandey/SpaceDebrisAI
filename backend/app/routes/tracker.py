import asyncio
import time

import httpx
from fastapi import APIRouter

router = APIRouter()

N2YO_KEY  = "S2Q3WD-YRGKVA-9Y84VW-5ODD"
N2YO_BASE = "https://api.n2yo.com/rest/v1/satellite"

# All 15 satellites from the frontend SAT_DB — same NORAD IDs
TRACKED = {
    25544: "ISS (ZARYA)",
    57329: "PROGRESS MS-24",
    53544: "STARLINK-3456",
    53545: "STARLINK-3457",
    25994: "TERRA",
    27424: "AQUA",
    28654: "NOAA 18",
    39634: "SENTINEL-1A",
    39084: "LANDSAT 8",
    44390: "COSMOS 2533",
    44804: "CARTOSAT-3",
    45677: "RISAT-2BR1",
    37389: "RESOURCESAT-2",
    40930: "ASTROSAT",
    45026: "GSAT-30",
}

# Simple in-memory cache — reduces N2YO API transactions
_cache: dict = {"ts": 0.0, "data": []}
CACHE_TTL = 120  # seconds (2 min)


@router.get("/tracker/positions")
async def tracker_positions():
    """Return current lat/lon/alt for all tracked satellites via N2YO REST API."""
    global _cache
    now = time.time()

    if now - _cache["ts"] < CACHE_TTL and _cache["data"]:
        return {"source": "cache", "satellites": _cache["data"], "cached_at": int(_cache["ts"])}

    async def fetch_one(client: httpx.AsyncClient, norad_id: int, name: str) -> dict:
        url = (
            f"{N2YO_BASE}/positions/{norad_id}/0/0/0/1"
            f"&apiKey={N2YO_KEY}"
        )
        try:
            r = await client.get(url, follow_redirects=True)
            d = r.json()
            pos = d.get("positions", [{}])[0]
            info = d.get("info", {})
            return {
                "noradId":   norad_id,
                "name":      name,
                "satname":   info.get("satname", name),
                "lat":       round(pos.get("satlatitude",  0), 4),
                "lon":       round(pos.get("satlongitude", 0), 4),
                "alt":       round(pos.get("sataltitude",  0), 1),
                "azimuth":   round(pos.get("azimuth",      0), 1),
                "elevation": round(pos.get("elevation",    0), 1),
                "timestamp": pos.get("timestamp", 0),
            }
        except Exception as exc:
            return {
                "noradId": norad_id, "name": name,
                "lat": 0, "lon": 0, "alt": 0,
                "error": str(exc),
            }

    async with httpx.AsyncClient(timeout=15.0) as client:
        tasks = [fetch_one(client, nid, nm) for nid, nm in TRACKED.items()]
        results = list(await asyncio.gather(*tasks))

    _cache = {"ts": now, "data": results}
    return {"source": "live", "satellites": results, "fetched_at": int(now)}
