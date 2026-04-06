from ml_logic.risk_engine import calculate_risk
import math

_LEO_MAX  = 500   # km
_MEO_MAX  = 2000  # km


def _compute_relative_velocity(v1: tuple, v2: tuple) -> float:
    """Compute relative velocity magnitude in km/s."""
    dv = (v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2])
    return math.sqrt(dv[0]**2 + dv[1]**2 + dv[2]**2)


def classify_conjunction(distance_km: float, altitude_km: float = 400.0, 
                         v1: tuple = None, v2: tuple = None) -> dict:
    """
    Classify risk for a satellite pair, adjusted by orbital altitude and relative velocity.
    
    Args:
        distance_km: Current separation distance
        altitude_km: Average altitude of the pair
        v1: Velocity vector of satellite 1 (km/s) - optional
        v2: Velocity vector of satellite 2 (km/s) - optional
    """
    base = calculate_risk(distance_km)

    # LEO is more dangerous — higher debris density and less time to maneuver
    if altitude_km < _LEO_MAX:
        alt_factor = 1.20
    elif altitude_km < _MEO_MAX:
        alt_factor = 1.00
    else:
        alt_factor = 0.80

    # Velocity factor: higher relative velocity = higher risk
    vel_factor = 1.0
    rel_vel_km_s = 0.0
    if v1 is not None and v2 is not None:
        rel_vel_km_s = _compute_relative_velocity(v1, v2)
        # Scale factor: 7 km/s is typical max for LEO, scale from 1.0 to 1.3
        vel_factor = 1.0 + min(rel_vel_km_s / 10.0, 0.3)

    # Combined factor
    combined_factor = alt_factor * vel_factor
    adjusted_score = min(int(base["score"] * combined_factor), 100)

    if adjusted_score >= 85:
        level = "CRITICAL"
        msg = "Imminent collision risk. Emergency maneuver required immediately."
    elif adjusted_score >= 60:
        level = "HIGH"
        msg = "Critical proximity detected. Immediate maneuver recommended."
    elif adjusted_score >= 30:
        level = "MEDIUM"
        msg = "Potential conjunction risk. Monitor closely and prepare maneuver."
    else:
        level = "LOW"
        msg = "Safe orbital separation — nominal trajectory."

    result = {
        "level":           level,
        "score":           adjusted_score,
        "message":         msg,
        "altitude_factor": alt_factor,
    }
    
    if v1 is not None and v2 is not None:
        result["relative_velocity_km_s"] = round(rel_vel_km_s, 3)
        result["velocity_factor"] = round(vel_factor, 3)
    
    return result
