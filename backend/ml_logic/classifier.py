from ml_logic.risk_engine import calculate_risk

_LEO_MAX  = 500   # km
_MEO_MAX  = 2000  # km


def classify_conjunction(distance_km: float, altitude_km: float = 400.0) -> dict:
    """Classify risk for a satellite pair, adjusted by orbital altitude."""
    base = calculate_risk(distance_km)

    # LEO is more dangerous — higher debris density and less time to maneuver
    if altitude_km < _LEO_MAX:
        factor = 1.20
    elif altitude_km < _MEO_MAX:
        factor = 1.00
    else:
        factor = 0.80

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
