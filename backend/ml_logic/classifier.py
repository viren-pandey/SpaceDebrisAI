"""Multi-factor conjunction risk classifier.

Combines distance-based risk from the risk engine with an altitude
adjustment factor: low-earth orbit conjunctions are more dangerous
because debris density is higher and maneuver time is shorter.
"""

from ml_logic.risk_engine import calculate_risk

# Altitude bands (km)
_LEO_MAX  = 500
_MEO_MAX  = 2000


def classify_conjunction(distance_km: float, altitude_km: float = 400.0) -> dict:
    """
    Classify conjunction risk for a satellite pair.

    Args:
        distance_km:  3-D separation distance between the two objects.
        altitude_km:  Mean orbital altitude of the pair (km above surface).

    Returns:
        dict with keys: level, score, message, altitude_factor
    """
    base = calculate_risk(distance_km)

    # Altitude danger factor
    if altitude_km < _LEO_MAX:
        factor = 1.20   # LEO — most debris, fastest response needed
    elif altitude_km < _MEO_MAX:
        factor = 1.00   # MEO — nominal
    else:
        factor = 0.80   # HEO / GEO — slower relative velocities

    adjusted_score = min(int(base["score"] * factor), 100)

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

    return {
        "level":           level,
        "score":           adjusted_score,
        "message":         msg,
        "altitude_factor": factor,
    }
