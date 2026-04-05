import os
from fastapi import APIRouter
from pathlib import Path
from app.services.tle_fetcher import get_local_timestamp, refresh_all_caches, _KEEPTRACK_API_KEY

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SATELLITES_FILE = DATA_DIR / "satellites.tle"
DEBRIS_LEO_FILE = DATA_DIR / "debris_leo.tle"
DEBRIS_ALL_FILE = DATA_DIR / "debris_all.tle"


def get_cache_info(file_path: Path) -> dict:
    exists = file_path.exists()
    if not exists:
        return {"exists": False, "size_bytes": 0, "record_count": 0}
    
    size = file_path.stat().st_size
    try:
        content = file_path.read_text(encoding="utf-8")
        non_empty_lines = sum(1 for line in content.splitlines() if line.strip())
        record_count = non_empty_lines // 3
    except Exception:
        record_count = 0
    
    return {
        "exists": True,
        "size_bytes": size,
        "record_count": record_count,
    }


@router.get("/health")
def health():
    satellites_info = get_cache_info(SATELLITES_FILE)
    debris_leo_info = get_cache_info(DEBRIS_LEO_FILE)
    debris_all_info = get_cache_info(DEBRIS_ALL_FILE)

    return {
        "status": "ok the server is running",
        "cache": {
            "satellites": satellites_info,
            "debris_leo": debris_leo_info,
            "debris_all": debris_all_info,
            "last_update": get_local_timestamp(),
        },
    }


@router.post("/health/refresh")
def refresh_cache():
    """Force refresh all TLE caches from KeepTrack API."""
    try:
        refresh_all_caches(force=True)
        return {"status": "refreshed", "cache": {
            "satellites": get_cache_info(SATELLITES_FILE),
            "debris_leo": get_cache_info(DEBRIS_LEO_FILE),
            "debris_all": get_cache_info(DEBRIS_ALL_FILE),
            "last_update": get_local_timestamp(),
        }}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/health/debug")
def health_debug():
    """Debug endpoint to check API key and cache status."""
    api_key_loaded = bool(_KEEPTRACK_API_KEY)
    return {
        "api_key_loaded": api_key_loaded,
        "api_key_prefix": _KEEPTRACK_API_KEY[:10] + "..." if api_key_loaded else None,
        "env_var_value": os.getenv("KEEPTRACK_API_KEY", "NOT SET"),
    }
