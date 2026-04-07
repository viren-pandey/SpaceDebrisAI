import json
import os
import sys
import time
from urllib import error, request


SPACE_REPO_ID = os.getenv("HF_SPACE_REPO_ID", "Virenn77/SpaceDebrisAI")
SPACE_BASE_URL = os.getenv("HF_SPACE_BASE_URL", "https://virenn77-spacedebrisai.hf.space").rstrip("/")
HF_TOKEN = os.getenv("HF_TOKEN", "")
SIM_TIMEOUT_SECONDS = int(os.getenv("WATCHDOG_SIM_TIMEOUT_SECONDS", "45"))
HEALTH_TIMEOUT_SECONDS = int(os.getenv("WATCHDOG_HEALTH_TIMEOUT_SECONDS", "15"))


def http_json(url: str, timeout: int) -> tuple[int, object]:
    req = request.Request(url, headers={"User-Agent": "space-watchdog/1.0"})
    with request.urlopen(req, timeout=timeout) as response:
        payload = response.read().decode("utf-8")
        return response.status, json.loads(payload) if payload else {}


def restart_space() -> None:
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is required to restart the Space.")
    api_url = f"https://huggingface.co/api/spaces/{SPACE_REPO_ID}/restart"
    req = request.Request(
        api_url,
        method="POST",
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "User-Agent": "space-watchdog/1.0",
        },
    )
    with request.urlopen(req, timeout=30) as response:
        print(f"Restart requested: HTTP {response.status}")


def main() -> int:
    print(f"Checking {SPACE_BASE_URL} at {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")

    health_url = f"{SPACE_BASE_URL}/health"
    simulate_url = f"{SPACE_BASE_URL}/simulate"

    try:
        health_status, health_payload = http_json(health_url, HEALTH_TIMEOUT_SECONDS)
        print(f"/health -> {health_status} | {health_payload.get('status', 'no-status')}")
    except Exception as exc:
        print(f"/health failed: {exc}")
        restart_space()
        return 0

    try:
        simulate_status, simulate_payload = http_json(simulate_url, SIM_TIMEOUT_SECONDS)
        closest_pairs = len((simulate_payload or {}).get("closest_pairs", []))
        print(f"/simulate -> {simulate_status} | closest_pairs={closest_pairs}")
        return 0
    except error.HTTPError as exc:
        print(f"/simulate HTTP error: {exc.code}")
    except Exception as exc:
        print(f"/simulate failed: {exc}")

    restart_space()
    return 0


if __name__ == "__main__":
    sys.exit(main())
