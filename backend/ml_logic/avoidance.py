from ml_logic.risk_engine import calculate_risk

# altitude boost in km per risk level
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
    """Returns the recommended maneuver and estimated post-burn separation."""
    level      = risk.get("level", "LOW").upper()
    delta      = _DELTA.get(level, 0.0)
    action     = _ACTIONS.get(level, _ACTIONS["LOW"])
    new_dist   = round(distance_km + delta, 2)

    return {
        "action":          action,
        "delta_km":        delta,
        "new_distance_km": new_dist,
    }
