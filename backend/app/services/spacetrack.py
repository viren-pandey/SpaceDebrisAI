import requests
import os
import json
from datetime import datetime, timezone
from pathlib import Path

SPACETRACK_BASE = "https://www.space-track.org"
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CDM_CACHE_FILE = BASE_DIR / "app" / "data" / "cdm_cache.json"

_loaded = False
def _load_env():
    global _loaded
    if _loaded:
        return
    env_file = BASE_DIR.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().strip().split("\n"):
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    _loaded = True

session = requests.Session()

def login_spacetrack():
    _load_env()
    resp = session.post(
        f"{SPACETRACK_BASE}/ajaxauth/login",
        data={
            "identity": os.getenv("SPACETRACK_EMAIL"),
            "password": os.getenv("SPACETRACK_PASSWORD")
        },
        timeout=15
    )
    resp.raise_for_status()

def fetch_cdm_public():
    """
    Fetch recent public CDMs from Space-Track.
    These are real conjunction events screened by 18th Space Defense Squadron.
    """
    try:
        login_spacetrack()
        resp = session.get(
            f"{SPACETRACK_BASE}/basicspacedata/query/class/cdm_public"
            f"/TCA/>now-7/orderby/TCA asc/format/json",
            timeout=30
        )
        resp.raise_for_status()
        cdms = resp.json()

        with open(CDM_CACHE_FILE, "w") as f:
            json.dump({
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "cdms": cdms
            }, f)

        return cdms

    except Exception as e:
        print(f"[CDM] Fetch failed: {e}")
        try:
            with open(CDM_CACHE_FILE) as f:
                return json.load(f)["cdms"]
        except:
            return []

def load_cdm_cache():
    try:
        with open(CDM_CACHE_FILE) as f:
            return json.load(f)["cdms"]
    except:
        return []
