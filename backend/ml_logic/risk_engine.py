HIGH_RISK_THRESHOLD_KM = 5.0
MEDIUM_RISK_THRESHOLD_KM = 20.0


def calculate_risk(distance_km: float) -> dict:
    """Returns a risk dict for the given separation distance."""

    if distance_km <= HIGH_RISK_THRESHOLD_KM:
        return {
            "level": "HIGH",
            "score": 90,
            "message": "Critical proximity detected. Immediate maneuver recommended."
        }

    if distance_km <= MEDIUM_RISK_THRESHOLD_KM:
        return {
            "level": "MEDIUM",
            "score": 50,
            "message": "Potential conjunction risk. Monitoring advised."
        }

    return {
        "level": "LOW",
        "score": 10,
        "message": "Safe orbital separation."
    }
