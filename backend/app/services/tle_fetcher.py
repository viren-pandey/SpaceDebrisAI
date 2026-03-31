import json
import os
import threading
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

_KEEPTRACK_API_KEY = os.getenv("KEEPTRACK_API_KEY", "")
_KEEPTRACK_HEADERS = {"X-API-Key": _KEEPTRACK_API_KEY} if _KEEPTRACK_API_KEY else {}

_KEEPTRACK_FULL_URL = "https://api.keeptrack.space/v4/sats"
_KEEPTRACK_LEO_DEBRIS_URL = "https://api.keeptrack.space/v4/sats/leo/debris"
_KEEPTRACK_ALL_DEBRIS_URL = "https://api.keeptrack.space/v4/sats/debris"
_KEEPTRACK_LAST_UPDATE_URL = "https://api.keeptrack.space/v4/catalog/last-update"

_CELESTRAK_LEO_DEBRIS_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP= debris&FORMAT=tle"
_CELESTRAK_ALL_DEBRIS_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP= operational&FORMAT=tle"
_CELESTRAK_STARLINK_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP= starlink&FORMAT=tle"
_CELESTRAK_LAST_UPDATE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP= last-30-days&FORMAT=tle"

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_FULL_TLE_FILE = _DATA_DIR / "satellites.tle"
_LEO_DEBRIS_FILE = _DATA_DIR / "debris_leo.tle"
_ALL_DEBRIS_FILE = _DATA_DIR / "debris_all.tle"
_LAST_UPDATE_FILE = _DATA_DIR / "last_update.txt"

_REFRESH_INTERVAL_SECONDS = 3600
_REFRESH_LOCK = threading.Lock()
_REFRESH_THREAD_LOCK = threading.Lock()
_REFRESH_THREAD: threading.Thread | None = None

TLE_FILE = _FULL_TLE_FILE

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
HUBBLE SPACE TELESCOPE
1 20580U 90037B   25344.50000000  .00000000  00000-0  50000-4 0  9999
2 20580  28.4700 287.9500 0003000  300.0000  50.0000 15.09999999224091
STARLINK-1007
1 44713U 19074AE  25344.50000000  .00000211  00000-0  20750-4 0  9994
2 44713  53.0537 126.4825 0001752 89.8766 270.2546 15.21970799256421
STARLINK-1113
1 44958U 19096N   25344.50000000  .00000219  00000-0  21130-4 0  9995
2 44958  53.0547  89.3256 0001588 84.6259 275.5005 15.21972279256721
STARLINK-1459
1 45569U 20030J   25344.50000000  .00000222  00000-0  21070-4 0  9992
2 45569  53.0549  53.1234 0001618 83.5674 276.5625 15.21974589256425
STARLINK-1637
1 46133U 20057W   25344.50000000  .00000230  00000-0  22240-4 0  9993
2 46133  53.0550  38.4521 0001595 85.1234 274.9989 15.21978969256727
STARLINK-2213
1 48725U 21021AK  25344.50000000  .00000235  00000-0  22370-4 0  9995
2 48725  53.0552  25.1234 0001567 82.3456 277.7856 15.21981239256921
STARLINK-3619
1 51889U 20222S   25344.50000000  .00000240  00000-0  23050-4 0  9996
2 51889  53.0553  18.7654 0001554 81.2345 278.8967 15.21984569257123
STARLINK-3622
1 51892U 20222V   25344.50000000  .00000242  00000-0  23210-4 0  9997
2 51892  53.0554  18.9876 0001548 80.9876 279.1434 15.21984899257125
STARLINK-3632
1 51903U 20222AK  25344.50000000  .00000238  00000-0  22680-4 0  9998
2 51903  53.0555  19.1234 0001542 80.7654 279.3656 15.21985129257127
STARLINK-3808
1 52404U 21032S   25344.50000000  .00000245  00000-0  23560-4 0  9999
2 52404  53.0556  15.4321 0001539 79.8765 280.2545 15.21987899257321
"""


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


def _write_last_update(value: str) -> None:
    _ensure_data_dir()
    _write_text_atomic(_LAST_UPDATE_FILE, value)


def fetch_remote_last_update() -> str:
    response = requests.get(_KEEPTRACK_LAST_UPDATE_URL, headers=_KEEPTRACK_HEADERS, timeout=10)
    response.raise_for_status()
    try:
        payload = response.json()
    except ValueError:
        payload = response.text.strip()
    return _normalize_last_update(payload)


def _fetch_from_url(url: str) -> str:
    response = requests.get(url, headers=_KEEPTRACK_HEADERS, timeout=30)
    response.raise_for_status()
    tle_text = ""
    try:
        tle_text = _serialize_keeptrack_catalog(response.json())
    except ValueError:
        tle_text = response.text.strip()

    if not tle_text:
        raise RuntimeError(f"KeepTrack returned an empty TLE payload for {url}")
    return tle_text


def _fetch_celestrak_urls(urls: list[str]) -> str:
    all_lines = []
    for url in urls:
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            text = response.text.strip()
            if text:
                all_lines.append(text)
        except Exception:
            continue
    if not all_lines:
        raise RuntimeError("All CelesTrak sources failed")
    return "\n".join(all_lines)


def _fetch_all_caches() -> dict[str, str]:
    result = {}
    
    for cache_name, keeptrack_url, celestrak_urls in [
        ("full", _KEEPTRACK_FULL_URL, [_CELESTRAK_STARLINK_URL, _CELESTRAK_LAST_UPDATE_URL]),
        ("debris_leo", _KEEPTRACK_LEO_DEBRIS_URL, [_CELESTRAK_LEO_DEBRIS_URL]),
        ("debris_all", _KEEPTRACK_ALL_DEBRIS_URL, [_CELESTRAK_LEO_DEBRIS_URL, _CELESTRAK_STARLINK_URL]),
    ]:
        try:
            result[cache_name] = _fetch_from_url(keeptrack_url)
        except Exception as exc:
            print(f"KeepTrack failed for {cache_name}, trying CelesTrak: {exc}")
            try:
                result[cache_name] = _fetch_celestrak_urls(celestrak_urls)
            except Exception as exc2:
                print(f"CelesTrak also failed for {cache_name}: {exc2}")
                raise
    
    return result


def _cache_needs_refresh(remote_last_update: str) -> bool:
    if not _FULL_TLE_FILE.exists():
        return True
    local_value = _read_last_update()
    if not local_value:
        return True
    return remote_last_update != local_value


def fetch_and_cache(force: bool = False) -> bool:
    with _REFRESH_LOCK:
        remote_last_update: str | None = None

        try:
            remote_last_update = fetch_remote_last_update()
        except Exception as exc:
            print(f"TLE last-update check failed: {exc}")
            if not force:
                all_exist = _FULL_TLE_FILE.exists() and _LEO_DEBRIS_FILE.exists() and _ALL_DEBRIS_FILE.exists()
                if all_exist:
                    print(f"Keeping local cache due to last-update check failure: {exc}")
                    return False
            print(f"Proceeding with refresh despite last-update check failure: {exc}")

        if not force and remote_last_update and not _cache_needs_refresh(remote_last_update):
            return False

        try:
            caches = _fetch_all_caches()
        except Exception as exc:
            all_exist = _FULL_TLE_FILE.exists() and _LEO_DEBRIS_FILE.exists() and _ALL_DEBRIS_FILE.exists()
            if all_exist:
                print(f"TLE catalog fetch failed; keeping local cache: {exc}")
                return False
            raise

        _ensure_data_dir()
        _write_text_atomic(_FULL_TLE_FILE, caches["full"].rstrip() + "\n")
        _write_text_atomic(_LEO_DEBRIS_FILE, caches["debris_leo"].rstrip() + "\n")
        _write_text_atomic(_ALL_DEBRIS_FILE, caches["debris_all"].rstrip() + "\n")

        if remote_last_update is not None:
            _write_last_update(remote_last_update)

        print(f"TLE caches updated: {_FULL_TLE_FILE}, {_LEO_DEBRIS_FILE}, {_ALL_DEBRIS_FILE}")
        return True


def refresh_all_caches(force: bool = False) -> bool:
    return fetch_and_cache(force=force)


def _trigger_force_refresh() -> None:
    fetch_and_cache(force=True)


def _caches_are_empty() -> bool:
    try:
        full_content = _FULL_TLE_FILE.read_text(encoding="utf-8").strip()
        leo_content = _LEO_DEBRIS_FILE.read_text(encoding="utf-8").strip()
        all_content = _ALL_DEBRIS_FILE.read_text(encoding="utf-8").strip()
        return not (full_content or leo_content or all_content)
    except FileNotFoundError:
        return True


def _ensure_initial_cache() -> None:
    if _caches_are_empty():
        print("Cache files empty or missing, forcing initial TLE refresh...")
        try:
            refresh_all_caches(force=True)
            print("Initial TLE cache refresh completed")
        except Exception as exc:
            print(f"Initial TLE cache refresh failed: {exc}")


def start_background_refresh() -> None:
    _ensure_initial_cache()
    start_refresh_thread()


def _get_norad_id_from_tle_line1(line1: str) -> str | None:
    if len(line1) < 7:
        return None
    return line1[2:7]


def get_tle_lines(cache: str = "full") -> list[str]:
    def _safe_read(path: Path) -> list[str]:
        try:
            return path.read_text(encoding="utf-8").splitlines()
        except FileNotFoundError:
            return []

    def _read_non_empty(path: Path) -> list[str]:
        lines = _safe_read(path)
        return lines if any(line.strip() for line in lines) else []

    if cache == "full":
        full_lines = _read_non_empty(_FULL_TLE_FILE)
        if not full_lines:
            try:
                _trigger_force_refresh()
            except Exception as exc:
                print(f"TLE refresh failed: {exc}")
            full_lines = _read_non_empty(_FULL_TLE_FILE)
        if full_lines:
            return full_lines
        print("Full TLE cache is empty, falling back to merged debris cache")
        return get_tle_lines("debris_merged")
    elif cache == "debris_leo":
        leo_lines = _read_non_empty(_LEO_DEBRIS_FILE)
        if not leo_lines:
            try:
                _trigger_force_refresh()
            except Exception as exc:
                print(f"TLE refresh failed: {exc}")
            leo_lines = _read_non_empty(_LEO_DEBRIS_FILE)
        return leo_lines
    elif cache == "debris_all":
        all_lines = _read_non_empty(_ALL_DEBRIS_FILE)
        if not all_lines:
            try:
                _trigger_force_refresh()
            except Exception as exc:
                print(f"TLE refresh failed: {exc}")
            all_lines = _read_non_empty(_ALL_DEBRIS_FILE)
        return all_lines
    elif cache == "debris_merged":
        leo_lines = _read_non_empty(_LEO_DEBRIS_FILE)
        all_lines = _read_non_empty(_ALL_DEBRIS_FILE)

        if not leo_lines and not all_lines:
            try:
                _trigger_force_refresh()
            except Exception as exc:
                print(f"TLE refresh failed: {exc}")
            leo_lines = _read_non_empty(_LEO_DEBRIS_FILE)
            all_lines = _read_non_empty(_ALL_DEBRIS_FILE)

        if not leo_lines and not all_lines:
            print("No TLE data available, returning empty list")
            return []

        seen_ids: set[str] = set()
        merged: list[str] = []

        for line in leo_lines:
            stripped = line.strip()
            if not stripped:
                merged.append(stripped)
                continue
            if stripped.startswith("1 "):
                norad_id = _get_norad_id_from_tle_line1(stripped)
                if norad_id and norad_id not in seen_ids:
                    seen_ids.add(norad_id)
                    merged.append(stripped)
            else:
                merged.append(stripped)

        for line in all_lines:
            stripped = line.strip()
            if not stripped:
                merged.append(stripped)
                continue
            if stripped.startswith("1 "):
                norad_id = _get_norad_id_from_tle_line1(stripped)
                if norad_id and norad_id not in seen_ids:
                    seen_ids.add(norad_id)
                    merged.append(stripped)
            else:
                merged.append(stripped)

        return merged
    else:
        raise ValueError(f"Unknown cache type: {cache}. Valid options: 'full', 'debris_leo', 'debris_all', 'debris_merged'")


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


def _parse_tle_text(text: str, limit: int) -> list:
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
            i += 2
        else:
            i += 1
        if len(tles) >= limit:
            break
    return tles


def parse_tle_text(text: str, limit: int) -> list:
    return _parse_tle_text(text, limit)


def fetch_tles_local(limit: int = 200) -> list:
    try:
        tle_text = "\n".join(get_tle_lines("full"))
        return _parse_tle_text(tle_text, limit)
    except Exception as exc:
        print(f"Local TLE read failed: {exc}")
        return []


def fetch_tles_simulated(limit: int = 200) -> list:
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


def get_local_timestamp() -> str | None:
    return _read_last_update()


def should_refresh(remote_last_update: str | None = None) -> bool:
    if not _FULL_TLE_FILE.exists():
        return True

    remote_value = remote_last_update or fetch_remote_last_update()
    local_value = _read_last_update()
    if not local_value:
        return True
    return remote_value != local_value


def load_tles_from_cache() -> str:
    try:
        full_text = _FULL_TLE_FILE.read_text(encoding="utf-8")
        if full_text.strip():
            return full_text
        print("Full TLE cache is empty. Trying merged debris cache...")
    except FileNotFoundError:
        print("Local TLE cache is missing. Trying CelesTrak as fallback...")
    except Exception as exc:
        print(f"Local TLE cache read failed: {exc}")

    merged_lines = get_tle_lines("debris_merged")
    if merged_lines:
        print("Using merged debris cache as fallback for TLE data")
        return "\n".join(merged_lines)
    
    try:
        celestrak_data = _fetch_celestrak_urls([_CELESTRAK_LEO_DEBRIS_URL, _CELESTRAK_STARLINK_URL])
        if celestrak_data.strip():
            print("Successfully fetched TLE data from CelesTrak")
            return celestrak_data
    except Exception as exc:
        print(f"CelesTrak fallback also failed: {exc}")
    
    print("Falling back to bundled simulated TLE data.")
    return _SIMULATED_TLE_TEXT


def fetch_remote_tles() -> str:
    try:
        return _fetch_from_url(_KEEPTRACK_FULL_URL)
    except Exception as exc:
        print(f"KeepTrack fetch failed, trying CelesTrak: {exc}")
        return _fetch_celestrak_urls([_CELESTRAK_LEO_DEBRIS_URL, _CELESTRAK_STARLINK_URL])


def fetch_tles_spacetrack() -> str:
    return fetch_remote_tles()


def get_remote_timestamp() -> str:
    try:
        return fetch_remote_last_update()
    except Exception:
        return "celestrak-fallback"
