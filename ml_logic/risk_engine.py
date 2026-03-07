def calculate_risk(distance_km: float):
    if distance_km < 2:
        return {"risk": "HIGH", "score": 80}
    elif distance_km < 5:
        return {"risk": "MEDIUM", "score": 50}
    else:
        return {"risk": "LOW", "score": 10}
