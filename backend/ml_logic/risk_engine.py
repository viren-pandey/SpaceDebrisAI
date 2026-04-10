"""
Risk Engine for Orbital Conjunction Assessment

This module converts inter-satellite distance (km)
into a structured collision risk assessment.
"""

# -------------------------------
# Risk thresholds (kilometers)
# -------------------------------

HIGH_RISK_THRESHOLD_KM = 5.0
MEDIUM_RISK_THRESHOLD_KM = 20.0


def calculate_risk(distance_km: float) -> dict:
    """
    Calculate collision risk based on distance.

    Args:
        distance_km (float): Minimum separation distance in kilometers

    Returns:
        dict: Structured risk assessment
    """

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
