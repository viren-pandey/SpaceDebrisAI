from pathlib import Path
import requests

# Current CelesTrak GP API endpoints (tried in order until one succeeds)
# 'visual' gives ~100 varied satellites (ISS, Hubble, Tiangong, weather sats…)
_CELESTRAK_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
]

# Local TLE file (200 satellites, always available offline)
_LOCAL_TLE_FILE = Path(__file__).parent.parent / "data" / "tles.txt"


def _parse_tle_text(text: str, limit: int) -> list:
    """Parse raw 3-line TLE text into (name, line1, line2) tuples."""
    lines = [l.strip() for l in text.splitlines() if l.strip() and not l.startswith("---")]
    tles = []
    i = 0
    while i < len(lines) - 2:
        name  = lines[i]
        line1 = lines[i + 1]
        line2 = lines[i + 2]
        if line1.startswith("1 ") and line2.startswith("2 "):
            tles.append((name, line1, line2))
            i += 3
        else:
            i += 1
        if len(tles) >= limit:
            break
    return tles


def fetch_tles_local(limit: int = 200) -> list:
    """Read TLEs from the bundled local tles.txt file."""
    try:
        text = _LOCAL_TLE_FILE.read_text(encoding="utf-8")
        return _parse_tle_text(text, limit)
    except Exception as exc:
        print(f"Local TLE read failed: {exc}")
        return []


def fetch_tles(limit: int = 25) -> list:
    """Fetch TLE sets from CelesTrak; falls back to local file if unreachable.
    Returns list of (name, line1, line2)."""
    for url in _CELESTRAK_URLS:
        try:
            response = requests.get(url, timeout=3)
            response.raise_for_status()
            tles = _parse_tle_text(response.text, limit)
            if tles:
                return tles
        except Exception as exc:
            print(f"TLE fetch failed ({url}): {exc}")

    # All CelesTrak attempts failed — use local bundled TLE data
    print("Falling back to local TLE file.")
    return fetch_tles_local(limit)

