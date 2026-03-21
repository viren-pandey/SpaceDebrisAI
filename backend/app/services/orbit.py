from sgp4.api import Satrec, jday
from datetime import datetime, timedelta, timezone
import numpy as np
from scipy.stats import norm
import math

def calculate_tca(sat1, sat2, steps=144, step_seconds=600):
    now = datetime.now(timezone.utc)
    min_dist = float('inf')
    tca_time = now
    rel_vel_at_tca = 0.0

    for i in range(steps):
        t = now + timedelta(seconds=i * step_seconds)
        jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second + t.microsecond/1e6)

        e1, r1, v1 = sat1.sgp4(jd, fr)
        e2, r2, v2 = sat2.sgp4(jd, fr)

        if e1 != 0 or e2 != 0:
            continue

        r1, r2 = np.array(r1), np.array(r2)
        v1, v2 = np.array(v1), np.array(v2)

        dist = np.linalg.norm(r1 - r2)
        rel_vel = np.linalg.norm(v1 - v2)

        if dist < min_dist:
            min_dist = dist
            tca_time = t
            rel_vel_at_tca = rel_vel

    return min_dist, tca_time, rel_vel_at_tca

def probability_of_collision(miss_distance_km, sigma_km=1.0, hard_body_radius_km=0.01):
    if miss_distance_km <= 0:
        return 1.0
    pc = norm.cdf(hard_body_radius_km, loc=miss_distance_km, scale=sigma_km)
    return float(pc)

def pc_to_risk_level(pc):
    if pc >= 1e-4:
        return "CRITICAL"
    elif pc >= 1e-5:
        return "HIGH"
    elif pc >= 1e-6:
        return "MEDIUM"
    else:
        return "LOW"

def tle_age_hours(satrec):
    yr = satrec.epochyr
    year = 2000 + yr if yr < 57 else 1900 + yr
    epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=satrec.epochdays - 1)
    age = datetime.now(timezone.utc) - epoch
    return age.total_seconds() / 3600

MAX_TLE_AGE_HOURS = 72

def confidence_level(age1_hours, age2_hours):
    max_age = max(age1_hours, age2_hours)
    if max_age < 24:
        return "HIGH"
    elif max_age < 72:
        return "MEDIUM"
    else:
        return "LOW"
