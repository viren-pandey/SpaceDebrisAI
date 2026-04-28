from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query

from app.services.space_weather import (
    get_space_weather,
    get_drag_conditions,
    update_cache,
)
from app.utils.json_safe import make_json_safe

router = APIRouter()


def _utc_now():
    return datetime.now(timezone.utc)


@router.get("/spaceweather")
async def space_weather():
    try:
        weather = get_space_weather()
        return make_json_safe({
            "timestamp_utc": _utc_now().isoformat(),
            "geomagnetic": {
                "kp_index": weather.get("kp_current", 0),
                "kp_trend": weather.get("kp_trend", "unknown"),
                "kp_3hr_history": weather.get("kp_3hr", []),
                "storm_scale": weather.get("geomag_scales", {}),
            },
            "solar": {
                "f107_flux": weather.get("solar_flux_f107", 0),
                "sunspot_number": weather.get("sunspot_number", 0),
            },
            "xray": {
                "current_flux": weather.get("xray_flux", "A0.0"),
                "flare_class": weather.get("xray_class", "A"),
                "flare_active": weather.get("flare_active", False),
            },
            "atmospheric": {
                "density_multiplier_400km": weather.get("atmospheric_density_multiplier", 1.0),
                "last_updated": weather.get("last_updated"),
            },
        })
    except Exception as exc:
        print(f"[SPACEWEATHER] Error: {exc}")
        return make_json_safe({
            "timestamp_utc": _utc_now().isoformat(),
            "geomagnetic": {"kp_index": 0, "kp_trend": "unknown", "kp_3hr_history": [], "storm_scale": {}},
            "solar": {"f107_flux": 0, "sunspot_number": 0},
            "xray": {"current_flux": "A0.0", "flare_class": "A", "flare_active": False},
            "atmospheric": {"density_multiplier_400km": 1.0, "last_updated": None},
            "error": str(exc),
        })


@router.post("/spaceweather/refresh")
async def refresh_space_weather():
    try:
        weather = update_cache()
        return make_json_safe({"status": "refreshed", "data": weather})
    except Exception as exc:
        print(f"[SPACEWEATHER/REFRESH] Error: {exc}")
        return make_json_safe({"status": "error", "data": {}})


@router.get("/spaceweather/drag")
async def drag_estimate(
    altitude_km: float = Query(default=400.0, ge=100, le=1000),
):
    try:
        drag = get_drag_conditions(altitude_km)
        return make_json_safe({
            "timestamp_utc": _utc_now().isoformat(),
            **drag,
        })
    except Exception as exc:
        print(f"[SPACEWEATHER/DRAG] Error: {exc}")
        return make_json_safe({
            "timestamp_utc": _utc_now().isoformat(),
            "altitude_km": altitude_km,
            "estimated_decay_km_per_day": 0.005,
            "density_multiplier": 1.0,
            "urgency": "LOW",
            "message": "Nominal drag conditions (fallback)",
        })
