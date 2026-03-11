from fastapi import APIRouter
from app.services.tle_fetcher import TLE_FILE, get_local_timestamp

router = APIRouter()

@router.get("/health")
def health():
    tle_exists = TLE_FILE.exists()
    tle_size = TLE_FILE.stat().st_size if tle_exists else 0

    return {
        "status": "ok",
        "cache": {
            "exists": tle_exists,
            "size_bytes": tle_size,
            "last_update": get_local_timestamp(),
        },
    }
