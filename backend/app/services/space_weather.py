"""
Space Weather Service - NOAA SWPC Integration.

Fetches and caches space weather data from NOAA's Space Weather Prediction Center:
- Kp index (geomagnetic activity)
- Solar flux (F10.7 cm)
- X-ray flux (solar flare detection)
- Geomagnetic storm alerts
- Atmospheric drag estimates
"""
from __future__ import annotations

import math
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests

# NOAA SWPC API endpoints
SWPC_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
SWPC_SFLUX_URL = "https://services.swpc.noaa.gov/products/solar-cycle/observed-solar-cycle-indices.json"
SWPC_XRAY_URL = "https://services.swpc.noaa.gov/json/goes/xf10cm.json"
SWPC_GEOMAG_ALERTS_URL = "https://services.swpc.noaa.gov/products/noaa-scale.json"
SWPC_F107_81DAY_URL = "https://services.swpc.noaa.gov/products/noaa-solar-indices.json"

# Cache settings
CACHE_TTL_SECONDS = 900  # 15 minutes
BACKGROUND_REFRESH_SECONDS = 900

# Kp index thresholds
KP_NOMINAL = 4       # Below this is quiet
KP_UNSETTLED = 5     # Unsettled conditions
KP_STORM = 6         # Minor storm
KP_MAJOR_STORM = 7   # Major storm
KP_SEVERE_STORM = 8  # Severe storm
KP_EXTREME = 9       # Extreme storm

# Drag model constants
DRAG_BASE_ALTITUDE_KM = 400.0
DRAG_DECAY_EXPONENT = -0.02  # Drag decreases exponentially with altitude

_cache = {
    "kp_current": None,
    "kp_3hr": [],
    "solar_flux_f107": None,
    "xray_flux": None,
    "geomag_scales": None,
    "atmospheric_density_multiplier": 1.0,
    "last_updated": None,
    "expires_at": 0.0,
}
_cache_lock = threading.Lock()
_refresh_thread = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_float(value, default=0.0) -> float:
    """Safely convert value to float."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def fetch_kp_index() -> dict:
    """Fetch current Kp index from NOAA SWPC."""
    try:
        resp = requests.get(SWPC_KP_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        if not data or len(data) < 2:
            return {"kp_current": 0, "kp_3hr": [], "trend": "unknown"}
        
        # Data format: [[time_tag, kp_value, ...], ...]
        # Most recent entries
        recent = data[-8:]  # Last 24 hours (8 x 3-hour intervals)
        kp_values = []
        for entry in recent:
            if len(entry) >= 2:
                kp_values.append({
                    "time": entry[0],
                    "kp": _safe_float(entry[1]),
                })
        
        current_kp = kp_values[-1]["kp"] if kp_values else 0
        
        # Calculate trend
        if len(kp_values) >= 2:
            recent_avg = sum(v["kp"] for v in kp_values[-2:]) / 2
            older_avg = sum(v["kp"] for v in kp_values[-4:-2]) / 2 if len(kp_values) >= 4 else recent_avg
            if recent_avg > older_avg + 1:
                trend = "rising"
            elif recent_avg < older_avg - 1:
                trend = "falling"
            else:
                trend = "stable"
        else:
            trend = "unknown"
        
        return {
            "kp_current": round(current_kp, 1),
            "kp_3hr": kp_values[-4:],  # Last 12 hours
            "trend": trend,
        }
    except Exception as e:
        return {"kp_current": 0, "kp_3hr": [], "trend": "unknown", "error": str(e)}


def fetch_solar_flux() -> dict:
    """Fetch solar flux (F10.7 cm) from NOAA SWPC."""
    try:
        resp = requests.get(SWPC_SFLUX_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        if not data or len(data) < 2:
            return {"f107_observed": 0, "f107_adjusted": 0, "sunspot_number": 0}
        
        # Find most recent entry
        headers = data[0] if data[0] else []
        latest = data[-1]
        
        # Map headers to values
        result = {}
        for i, header in enumerate(headers):
            if i < len(latest):
                result[header] = _safe_float(latest[i])
        
        return {
            "f107_observed": result.get("observed_flux", 0),
            "f107_adjusted": result.get("adjusted_flux", 0),
            "sunspot_number": result.get("ssn", 0),
            "date": result.get("time-tag", ""),
        }
    except Exception as e:
        return {"f107_observed": 0, "f107_adjusted": 0, "sunspot_number": 0, "error": str(e)}


def fetch_xray_flux() -> dict:
    """Fetch X-ray flux (solar flare detection) from NOAA GOES satellites."""
    try:
        resp = requests.get(SWPC_XRAY_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        if not data:
            return {"current_flux": "A0.0", "class": "A", "flare_active": False}
        
        latest = data[-1]
        flux_long = latest.get("flux", "A0.0")
        
        # Parse X-ray class
        flux_class = flux_long[0] if flux_long else "A"
        flare_active = flux_class in ("M", "X")
        
        return {
            "current_flux": flux_long,
            "class": flux_class,
            "flare_active": flare_active,
            "timestamp": latest.get("time_tag", ""),
        }
    except Exception as e:
        return {"current_flux": "A0.0", "class": "A", "flare_active": False, "error": str(e)}


def fetch_geomag_scales() -> dict:
    """Fetch current NOAA geomagnetic storm scales."""
    try:
        resp = requests.get(SWPC_GEOMAG_ALERTS_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        if not data:
            return {"kp_scale": 0, "storm_level": "G0", "description": "Quiet"}
        
        # Extract geomagnetic scale
        kp_scale = data.get("G", data.get("Kp", 0))
        storm_level = f"G{kp_scale}" if kp_scale else "G0"
        
        descriptions = {
            "G0": "Quiet",
            "G1": "Minor storm - Weak power grid fluctuations",
            "G2": "Moderate storm - High-latitude power systems affected",
            "G3": "Strong storm - Corrective actions for satellites required",
            "G4": "Severe storm - Widespread voltage control problems",
            "G5": "Extreme storm - Widespread voltage control problems, transformers damaged",
        }
        
        return {
            "kp_scale": kp_scale,
            "storm_level": storm_level,
            "description": descriptions.get(storm_level, "Unknown"),
        }
    except Exception as e:
        return {"kp_scale": 0, "storm_level": "G0", "description": "Quiet", "error": str(e)}


def compute_atmospheric_density_multiplier(kp: float, f107: float, altitude_km: float) -> float:
    """
    Compute atmospheric density multiplier for drag calculations.
    
    During geomagnetic storms, the upper atmosphere expands, increasing drag
    on LEO satellites. This is especially impactful at altitudes below 600km.
    
    Args:
        kp: Current Kp index (0-9)
        f107: Solar flux at 10.7cm wavelength (sfu)
        altitude_km: Orbital altitude in km
    
    Returns:
        Multiplier (1.0 = nominal, >1.0 = increased drag)
    """
    # Base density at reference altitude
    base_density = 1.0
    
    # Kp effect: exponential increase during storms
    # Kp=4 is nominal, Kp=9 can increase density by 5-10x at 400km
    if kp > 4:
        kp_factor = 1.0 + 0.5 * (kp - 4) ** 1.5
    else:
        kp_factor = 1.0
    
    # F10.7 effect: solar heating increases density
    # F10.7 ~70 is solar minimum, ~200 is solar maximum
    f107_baseline = 100.0
    f107_factor = 1.0 + 0.3 * ((f107 - f107_baseline) / 100.0) if f107 > 0 else 1.0
    
    # Altitude effect: lower altitudes see bigger density changes
    # At 200km, effect is ~3x stronger than at 800km
    altitude_factor = math.exp(DRAG_DECAY_EXPONENT * (altitude_km - DRAG_BASE_ALTITUDE_KM))
    altitude_factor = max(0.3, min(3.0, altitude_factor))
    
    combined = kp_factor * f107_factor * altitude_factor
    
    return max(0.5, min(combined, 15.0))


def compute_drag_estimate(altitude_km: float, decay_rate_km_per_day: float = 0.0) -> dict:
    """
    Estimate atmospheric drag impact at given altitude.
    
    Returns estimated altitude decay and maneuver urgency.
    """
    density_mult = _cache.get("atmospheric_density_multiplier", 1.0)
    
    # Baseline decay rate (km/day) at 400km during solar minimum
    baseline_decay_400 = 0.005  # ~5m per day
    
    # Scale with altitude (exponential decay)
    altitude_ratio = math.exp(-0.005 * (altitude_km - 400))
    estimated_decay = baseline_decay_400 * altitude_ratio * density_mult
    
    # Urgency classification
    if estimated_decay > 0.1:  # >100m/day
        urgency = "CRITICAL"
        message = "Severe drag - immediate orbit maintenance required"
    elif estimated_decay > 0.05:  # >50m/day
        urgency = "HIGH"
        message = "High drag - schedule orbit correction within 24h"
    elif estimated_decay > 0.01:  # >10m/day
        urgency = "MEDIUM"
        message = "Elevated drag - monitor and plan correction"
    else:
        urgency = "LOW"
        message = "Nominal drag conditions"
    
    return {
        "altitude_km": altitude_km,
        "estimated_decay_km_per_day": round(estimated_decay, 4),
        "density_multiplier": round(density_mult, 2),
        "urgency": urgency,
        "message": message,
    }


def update_cache():
    """Fetch latest space weather data and update cache."""
    global _cache
    
    kp_data = fetch_kp_index()
    solar_data = fetch_solar_flux()
    xray_data = fetch_xray_flux()
    geomag_data = fetch_geomag_scales()
    
    kp = kp_data.get("kp_current", 0)
    f107 = solar_data.get("f107_adjusted", 0) or solar_data.get("f107_observed", 0)
    
    # Compute density multiplier for LEO (400km reference)
    density_mult = compute_atmospheric_density_multiplier(kp, f107, 400.0)
    
    with _cache_lock:
        _cache = {
            "kp_current": kp,
            "kp_3hr": kp_data.get("kp_3hr", []),
            "kp_trend": kp_data.get("trend", "unknown"),
            "solar_flux_f107": f107,
            "sunspot_number": solar_data.get("sunspot_number", 0),
            "xray_flux": xray_data.get("current_flux", "A0.0"),
            "xray_class": xray_data.get("class", "A"),
            "flare_active": xray_data.get("flare_active", False),
            "geomag_scales": geomag_data,
            "atmospheric_density_multiplier": density_mult,
            "last_updated": _utc_now().isoformat(),
            "expires_at": time.time() + CACHE_TTL_SECONDS,
        }
    
    return _cache


def get_space_weather() -> dict:
    """Get current space weather conditions, fetching if cache expired."""
    now = time.time()
    
    with _cache_lock:
        if _cache["last_updated"] and now < _cache["expires_at"]:
            return dict(_cache)
    
    # Cache expired, fetch new data
    return update_cache()


def get_drag_conditions(altitude_km: float) -> dict:
    """Get drag conditions at specific altitude."""
    weather = get_space_weather()
    return compute_drag_estimate(altitude_km, weather.get("atmospheric_density_multiplier", 1.0))


def _background_refresh():
    """Background thread to refresh space weather data."""
    while True:
        try:
            time.sleep(BACKGROUND_REFRESH_SECONDS)
            update_cache()
        except Exception:
            pass


def start_background_refresh():
    """Start background thread for space weather updates."""
    global _refresh_thread
    if _refresh_thread is None or not _refresh_thread.is_alive():
        _refresh_thread = threading.Thread(
            target=_background_refresh,
            name="space-weather-refresh",
            daemon=True,
        )
        _refresh_thread.start()


# Initialize on module load
start_background_refresh()
