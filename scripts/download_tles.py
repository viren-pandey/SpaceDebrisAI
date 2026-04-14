from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
OUTPUT_PATH = BACKEND_DIR / "app" / "data" / "satellites.tle"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.tle_fetcher import _parse_tle_text, fetch_tles_spacetrack


def main() -> None:
    raw_tles = fetch_tles_spacetrack()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(raw_tles.rstrip() + "\n", encoding="utf-8")

    tle_count = len(_parse_tle_text(raw_tles, 10**9))
    print(f"Downloaded {tle_count} TLEs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
