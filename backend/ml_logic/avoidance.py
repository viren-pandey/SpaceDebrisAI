"""Maneuver recommendation engine.

Given the current separation distance and risk level, recommends
a collision-avoidance maneuver and estimates the post-maneuver
separation.
"""

from ml_logic.risk_engine import calculate_risk

# Delta-v altitude boosts in km by risk level
_DELTA = {
    "CRITICAL": 25.0,
    "HIGH":     15.0,
    "MEDIUM":    8.0,
    "LOW":       0.0,
}

_ACTIONS = {
    "CRITICAL": "Emergency altitude boost +25 km — execute within 1 orbit",
    "HIGH":     "Altitude boost +15 km — execute within 3 orbits",
    "MEDIUM":   "Precautionary altitude boost +8 km — schedule at next pass",
    "LOW":      "No maneuver required — maintain nominal trajectory",
}


def recommend_maneuver(distance_km: float, risk: dict) -> dict:
    """
    Recommend an avoidance maneuver for a conjunction pair.

    Args:
        distance_km:  Current separation distance (km).
        risk:         Risk dict from classify_conjunction / calculate_risk.

    Returns:
        dict with keys: action, delta_km, new_distance_km
    """
    level      = risk.get("level", "LOW").upper()
    delta      = _DELTA.get(level, 0.0)
    action     = _ACTIONS.get(level, _ACTIONS["LOW"])
    new_dist   = round(distance_km + delta, 2)

    return {
        "action":          action,
        "delta_km":        delta,
        "new_distance_km": new_dist,
    }
