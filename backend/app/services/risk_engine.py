from app.services.orbit import calculate_tca, probability_of_collision, pc_to_risk_level, tle_age_hours, confidence_level, MAX_TLE_AGE_HOURS


def screen_pairs(satellites):
    fresh_satellites = [s for s in satellites if tle_age_hours(s.satrec) < MAX_TLE_AGE_HOURS]
    results = []
    for i, sat1 in enumerate(fresh_satellites):
        for sat2 in fresh_satellites[i+1:]:
            min_dist, tca_time, rel_vel = calculate_tca(sat1.satrec, sat2.satrec)
            pc = probability_of_collision(min_dist)
            risk = pc_to_risk_level(pc)
            age1 = tle_age_hours(sat1.satrec)
            age2 = tle_age_hours(sat2.satrec)
            confidence = confidence_level(age1, age2)
            results.append({
                "sat1_name": sat1.name,
                "sat2_name": sat2.name,
                "tca_time": tca_time.isoformat(),
                "miss_distance_km": min_dist,
                "relative_velocity_km_s": rel_vel,
                "probability_of_collision": pc,
                "pc_scientific": f"{pc:.2e}",
                "risk": risk,
                "tle_age_sat1_hours": age1,
                "tle_age_sat2_hours": age2,
                "confidence": confidence
            })
    return results
