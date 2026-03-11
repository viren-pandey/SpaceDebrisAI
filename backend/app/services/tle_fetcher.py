import json
import threading
import time
from pathlib import Path

import requests

_KEEPTRACK_SATS_URL = "https://api.keeptrack.space/v4/sats"
_KEEPTRACK_LAST_UPDATE_URL = "https://api.keeptrack.space/v4/catalog/last-update"
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_LOCAL_TLE_FILE = _DATA_DIR / "satellites.tle"
_LAST_UPDATE_FILE = _DATA_DIR / "last_update.txt"
_REFRESH_INTERVAL_SECONDS = 3600
_REFRESH_LOCK = threading.Lock()
_REFRESH_THREAD_LOCK = threading.Lock()
_REFRESH_THREAD: threading.Thread | None = None
TLE_FILE = _LOCAL_TLE_FILE
TIMESTAMP_FILE = _LAST_UPDATE_FILE

_SIMULATED_TLE_TEXT = """ISS (ZARYA)
1 25544U 98067A   25344.60000000  .00016717  00000-0  10270-3 0  9001
2 25544  51.6431 191.5076 0004702  87.9229 326.2149 15.49904961391551
NOAA 15
1 25338U 98030A   25344.53125000  .00000074  00000-0  69723-4 0  9993
2 25338  98.7488  70.9790 0012263 349.4921  10.5124 14.25907782153215
NOAA 18
1 28654U 05018A   25344.48437500  .00000081  00000-0  65195-4 0  9992
2 28654  99.0369 109.2600 0013483  73.4173 286.8892 14.12549790772307
NOAA 19
1 33591U 09005A   25344.50760185  .00000070  00000-0  60801-4 0  9997
2 33591  99.1946  53.8829 0014175 166.5661 193.5913 14.12310721867631
METOP-B
1 38771U 12049A   25344.52597222  .00000054  00000-0  49234-4 0  9998
2 38771  98.7255  58.9543 0001680 109.3822 250.7548 14.21491256694541
"""


def _parse_tle_text(text: str, limit: int) -> list:
    """Parse raw 3-line TLE text into (name, line1, line2) tuples."""
    lines = [l.strip() for l in text.splitlines() if l.strip() and not l.startswith("---")]
    tles = []
    i = 0
    while i < len(lines) - 2:
        block = lines[i:i + 3]
        name, line1, line2 = block
        if name.startswith("0 "):
            name = name[2:].strip()
        if (
            name
            and not name.startswith("1 ")
            and not name.startswith("2 ")
            and line1.startswith("1 ")
            and line2.startswith("2 ")
        ):
            tles.append((name, line1, line2))
            i += 3
        elif lines[i].startswith("1 ") and lines[i + 1].startswith("2 "):
            # Space-Track 2-line payloads have no object name; skip them instead of
            # sliding by one line and accidentally using line 2 as the name.
            i += 2
        else:
            i += 1
        if len(tles) >= limit:
            break
    return tles


def parse_tle_text(text: str, limit: int) -> list:
    return _parse_tle_text(text, limit)


def _ensure_data_dir() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)


def _write_text_atomic(path: Path, text: str) -> None:
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(text, encoding="utf-8")
    temp_path.replace(path)


def _normalize_last_update(payload: object) -> str:
    if isinstance(payload, (dict, list)):
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return str(payload).strip()


def _serialize_keeptrack_catalog(payload: object) -> str:
    if not isinstance(payload, list):
        raise RuntimeError("KeepTrack returned an unexpected catalog payload.")

    lines: list[str] = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or item.get("altName") or f"OBJECT {index}").strip()
        line1 = str(item.get("tle1") or "").strip()
        line2 = str(item.get("tle2") or "").strip()

        if not name or not line1.startswith("1 ") or not line2.startswith("2 "):
            continue

        lines.extend([name, line1, line2, ""])

    return "\n".join(lines).strip()


def _read_last_update() -> str | None:
    try:
        value = _LAST_UPDATE_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return None
    return value or None


def fetch_remote_last_update() -> str:
    response = requests.get(_KEEPTRACK_LAST_UPDATE_URL, timeout=10)
    response.raise_for_status()
    try:
        payload = response.json()
    except ValueError:
        payload = response.text.strip()
    return _normalize_last_update(payload)


def get_remote_timestamp() -> str:
    return fetch_remote_last_update()


def fetch_remote_tles() -> str:
    """Fetch the full TLE catalog from KeepTrack."""
    response = requests.get(_KEEPTRACK_SATS_URL, timeout=30)
    response.raise_for_status()
    tle_text = ""
    try:
        tle_text = _serialize_keeptrack_catalog(response.json())
    except ValueError:
        tle_text = response.text.strip()

    if not tle_text:
        raise RuntimeError("KeepTrack returned an empty TLE payload.")
    if not _parse_tle_text(tle_text, 1):
        raise RuntimeError("KeepTrack returned no valid TLE records.")
    return tle_text


def fetch_tles_spacetrack() -> str:
    """Backward-compatible wrapper for scripts that download the raw TLE catalog."""
    return fetch_remote_tles()


def get_local_timestamp() -> str | None:
    return _read_last_update()


def should_refresh(remote_last_update: str | None = None) -> bool:
    if not _LOCAL_TLE_FILE.exists():
        return True

    remote_value = remote_last_update or fetch_remote_last_update()
    local_value = _read_last_update()
    if not local_value:
        return True
    return remote_value != local_value


def fetch_and_cache(force: bool = False) -> bool:
    with _REFRESH_LOCK:
        remote_last_update: str | None = None

        if force:
            try:
                remote_last_update = fetch_remote_last_update()
            except Exception as exc:
                print(f"TLE last-update check failed during forced refresh: {exc}")
        else:
            try:
                remote_last_update = fetch_remote_last_update()
            except Exception as exc:
                if _LOCAL_TLE_FILE.exists():
                    print(f"TLE refresh check failed; keeping local cache: {exc}")
                    return False
                print(
                    "TLE cache missing; last-update check failed, "
                    f"attempting direct catalog fetch: {exc}"
                )
            else:
                if not should_refresh(remote_last_update):
                    return False

        try:
            tle_text = fetch_remote_tles()
        except Exception as exc:
            if _LOCAL_TLE_FILE.exists():
                print(f"TLE catalog fetch failed; keeping local cache: {exc}")
                return False
            raise
        _ensure_data_dir()
        _write_text_atomic(_LOCAL_TLE_FILE, tle_text.rstrip() + "\n")
        if remote_last_update is not None:
            _write_text_atomic(_LAST_UPDATE_FILE, remote_last_update)
        print(f"TLE cache updated: {_LOCAL_TLE_FILE}")
        return True


def load_tles_from_cache() -> str:
    try:
        return _LOCAL_TLE_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        print("Local TLE cache is missing. Falling back to bundled simulated TLE data.")
    except Exception as exc:
        print(f"Local TLE cache read failed: {exc}")
    return _SIMULATED_TLE_TEXT


def refresh_loop() -> None:
    while True:
        try:
            fetch_and_cache()
        except Exception as exc:
            print(f"TLE refresh failed: {exc}")
        time.sleep(_REFRESH_INTERVAL_SECONDS)


def start_refresh_thread() -> None:
    global _REFRESH_THREAD

    with _REFRESH_THREAD_LOCK:
        if _REFRESH_THREAD and _REFRESH_THREAD.is_alive():
            return
        _ensure_data_dir()
        _REFRESH_THREAD = threading.Thread(
            target=refresh_loop,
            name="tle-refresh",
            daemon=True,
        )
        _REFRESH_THREAD.start()


def fetch_tles_local(limit: int = 200) -> list:
    """Read TLEs from the bundled local satellites.tle file."""
    try:
        return _parse_tle_text(load_tles_from_cache(), limit)
    except Exception as exc:
        print(f"Local TLE read failed: {exc}")
        return []


def fetch_tles_simulated(limit: int = 200) -> list:
    """Return a small bundled TLE set when the local cache is unavailable."""
    return _parse_tle_text(_SIMULATED_TLE_TEXT, limit)


def fetch_tles_with_source(limit: int = 25) -> tuple[list, str]:
    tles = fetch_tles_local(limit)
    if tles:
        return tles, "local"

    print("Local TLE cache unavailable. Falling back to bundled simulated TLE data.")
    return fetch_tles_simulated(limit), "simulation"


def fetch_tles(limit: int = 25) -> list:
    tles, _source = fetch_tles_with_source(limit)
    return tles
