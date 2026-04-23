import math

HIGH_RISK_THRESHOLD_KM = 5.0
MEDIUM_RISK_THRESHOLD_KM = 20.0
LOW_RISK_THRESHOLD_KM = 100.0


def calculate_risk(distance_km: float) -> dict:
    """
    Returns a risk dict for the given separation distance.
    
    Uses continuous exponential decay scoring:
    - Score decays exponentially with distance
    - Provides meaningful differentiation across all distance ranges
    - Scores range from 95 (very close) to ~5 (far away)
    """
    
    # Exponential decay model: score = 95 * exp(-distance / scale)
    # Scale factor controls decay rate (smaller = steeper decay)
    scale_km = 15.0  # At 15km, score drops to ~35% of max
    
    # Calculate continuous score using exponential decay
    raw_score = 95.0 * math.exp(-distance_km / scale_km)
    score = max(5, min(95, int(raw_score)))
    
    # Determine level based on score
    if score >= 70:
        level = "HIGH"
        message = "Critical proximity detected. Immediate maneuver recommended."
    elif score >= 35:
        level = "MEDIUM"
        message = "Potential conjunction risk. Monitoring advised."
    elif score >= 15:
        level = "LOW"
        message = "Minor proximity noted. Routine monitoring sufficient."
    else:
        level = "NOMINAL"
        message = "Safe orbital separation."

    return {
        "level": level,
        "score": score,
        "message": message,
        "distance_km": round(distance_km, 2),
    }
