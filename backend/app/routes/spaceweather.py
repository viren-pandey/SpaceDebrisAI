"""
Space Weather API - NOAA SWPC integration.

Endpoints for real-time space weather data and atmospheric drag estimates.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query

from app.services.space_weather import (
    get_space_weather,
    get_drag_conditions,
    update_cache,
)

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/spaceweather")
async def space_weather():
    """
    Get current space weather conditions from NOAA SWPC.
    
    Returns:
    - Kp index: Geomagnetic activity (0-9 scale)
    - Solar flux F10.7: Solar radio emission at 10.7cm (indicator of EUV)
    - X-ray flux: Current solar flare activity
    - Geomagnetic storm scale: NOAA G-scale (G0-G5)
    - Atmospheric density multiplier: Drag impact factor for LEO
    """
    weather = get_space_weather()
    
    return {
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
    }


@router.post("/spaceweather/refresh")
async def refresh_space_weather():
    """Force refresh space weather data from NOAA SWPC."""
    weather = update_cache()
    return {"status": "refreshed", "data": weather}


@router.get("/spaceweather/drag")
async def drag_estimate(
    altitude_km: float = Query(default=400.0, ge=100, le=1000, description="Orbital altitude in km"),
):
    """
    Get atmospheric drag estimate at specified altitude.
    
    Returns estimated orbital decay rate and maneuver urgency based on
    current space weather conditions.
    """
    drag = get_drag_conditions(altitude_km)
    
    return {
        "timestamp_utc": _utc_now().isoformat(),
        **drag,
    }
