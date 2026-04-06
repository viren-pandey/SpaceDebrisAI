from fastapi import APIRouter
from pathlib import Path
from app.services.tle_fetcher import get_local_timestamp, refresh_all_caches, get_tle_lines, parse_tle_text

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SATELLITES_FILE = DATA_DIR / "satellites.tle"
DEBRIS_LEO_FILE = DATA_DIR / "debris_leo.tle"
DEBRIS_ALL_FILE = DATA_DIR / "debris_all.tle"


def _extract_norad_id(line1: str) -> int | None:
    """Extract NORAD catalog number from TLE line 1."""
    try:
        return int(line1[2:7].strip())
    except (ValueError, IndexError):
        return None


def get_cache_info(file_path: Path, deduplicate: bool = False) -> dict:
    exists = file_path.exists()
    if not exists:
        return {"exists": False, "size_bytes": 0, "record_count": 0, "unique_objects": 0}
    
    size = file_path.stat().st_size
    unique_count = 0
    try:
        content = file_path.read_text(encoding="utf-8")
        non_empty_lines = sum(1 for line in content.splitlines() if line.strip())
        record_count = non_empty_lines // 3
        
        if deduplicate and record_count > 0:
            seen_ids = set()
            lines = content.splitlines()
            i = 0
            while i < len(lines) - 1:
                line = lines[i].strip()
                if line.startswith("2 "):
                    norad_id = _extract_norad_id(line)
                    if norad_id and norad_id not in seen_ids:
                        seen_ids.add(norad_id)
                        unique_count += 1
                i += 1
        else:
            unique_count = record_count
    except Exception:
        record_count = 0
        unique_count = 0
    
    return {
        "exists": True,
        "size_bytes": size,
        "record_count": record_count,
        "unique_objects": unique_count,
    }


@router.get("/health")
def health():
    satellites_info = get_cache_info(SATELLITES_FILE, deduplicate=True)
    debris_leo_info = get_cache_info(DEBRIS_LEO_FILE, deduplicate=True)
    debris_all_info = get_cache_info(DEBRIS_ALL_FILE, deduplicate=True)

    total_records = (
        satellites_info["record_count"] 
        + debris_leo_info["record_count"] 
        + debris_all_info["record_count"]
    )
    total_unique = (
        satellites_info["unique_objects"]
        + debris_leo_info["unique_objects"]
        + debris_all_info["unique_objects"]
    )

    return {
        "status": "ok the server is running",
        "catalog": {
            "total_tle_records": total_records,
            "total_unique_objects": total_unique,
        },
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
        satellites_info = get_cache_info(SATELLITES_FILE, deduplicate=True)
        debris_leo_info = get_cache_info(DEBRIS_LEO_FILE, deduplicate=True)
        debris_all_info = get_cache_info(DEBRIS_ALL_FILE, deduplicate=True)
        
        total_records = (
            satellites_info["record_count"] 
            + debris_leo_info["record_count"] 
            + debris_all_info["record_count"]
        )
        total_unique = (
            satellites_info["unique_objects"]
            + debris_leo_info["unique_objects"]
            + debris_all_info["unique_objects"]
        )
        
        return {"status": "refreshed", "catalog": {
            "total_tle_records": total_records,
            "total_unique_objects": total_unique,
        }, "cache": {
            "satellites": satellites_info,
            "debris_leo": debris_leo_info,
            "debris_all": debris_all_info,
            "last_update": get_local_timestamp(),
        }}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def _check_api_key_status() -> bool:
    """Internal function to check if API key is configured."""
    import os
    return bool(os.getenv("KEEPTRACK_API_KEY"))
