import os
from pathlib import Path

import requests

# CelesTrak endpoints tried in order
_CELESTRAK_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
]

_SPACETRACK_LOGIN_URL = "https://www.space-track.org/ajaxauth/login"
_SPACETRACK_TLE_URL = (
    "https://www.space-track.org/basicspacedata/query/"
    "class/gp/OBJECT_TYPE/DEBRIS/format/3le"
)
_LOCAL_TLE_FILE = Path(__file__).parent.parent / "data" / "satellites.tle"
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"

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


def _load_repo_env() -> None:
    """Populate missing process env vars from the repo root .env file."""
    if not _ENV_FILE.exists():
        return

    try:
        for raw_line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value:
                os.environ.setdefault(key, value)
    except Exception as exc:
        print(f"Failed to load .env file: {exc}")


def fetch_tles_spacetrack() -> str:
    """Fetch debris TLEs from Space-Track and return the raw TLE text."""
    _load_repo_env()
    email = os.getenv("SPACETRACK_EMAIL")
    password = os.getenv("SPACETRACK_PASSWORD")
    if not email or not password:
        raise RuntimeError(
            "Space-Track credentials are missing. Set SPACETRACK_EMAIL and "
            "SPACETRACK_PASSWORD."
        )

    with requests.Session() as session:
        login_response = session.post(
            _SPACETRACK_LOGIN_URL,
            data={"identity": email, "password": password},
            timeout=10,
        )
        login_response.raise_for_status()

        tle_response = session.get(_SPACETRACK_TLE_URL, timeout=10)
        tle_response.raise_for_status()

    tle_text = tle_response.text.strip()
    if not tle_text:
        raise RuntimeError("Space-Track returned an empty TLE payload.")
    if not _parse_tle_text(tle_text, 1):
        raise RuntimeError("Space-Track returned no valid TLE records.")
    return tle_text


def fetch_tles_local(limit: int = 200) -> list:
    """Read TLEs from the bundled local satellites.tle file."""
    try:
        text = _LOCAL_TLE_FILE.read_text(encoding="utf-8")
        return _parse_tle_text(text, limit)
    except Exception as exc:
        print(f"Local TLE read failed: {exc}")
        return []


def fetch_tles_simulated(limit: int = 200) -> list:
    """Return a small bundled TLE set when all live and local sources fail."""
    return _parse_tle_text(_SIMULATED_TLE_TEXT, limit)


def fetch_tles(limit: int = 25) -> list:
    for url in _CELESTRAK_URLS:
        try:
            response = requests.get(url, timeout=3)
            response.raise_for_status()
            tles = _parse_tle_text(response.text, limit)
            if tles:
                return tles
        except Exception as exc:
            print(f"TLE fetch failed ({url}): {exc}")

    try:
        tles = _parse_tle_text(fetch_tles_spacetrack(), limit)
        if tles:
            return tles
    except Exception as exc:
        print(f"TLE fetch failed (Space-Track): {exc}")

    print("Falling back to local TLE file.")
    tles = fetch_tles_local(limit)
    if tles:
        return tles

    print("Falling back to bundled simulated TLE data.")
    return fetch_tles_simulated(limit)
