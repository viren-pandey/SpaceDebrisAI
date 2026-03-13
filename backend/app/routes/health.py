import os
from fastapi import APIRouter
from pathlib import Path
from app.services.tle_fetcher import get_local_timestamp

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
