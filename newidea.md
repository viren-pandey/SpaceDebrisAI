## SpaceDebrisAI — Upgrades & Requirements

### 1. Newly Required Dependencies & Setup

- Add `scipy` to `requirements.txt` and install it:
    ```bash
    pip install scipy
    ```
- Add `requests` to `requirements.txt` and install it:
    ```bash
    pip install requests
    ```
- Add Space-Track credentials to `.env.example`:
    ```
    SPACETRACK_EMAIL=your_email@example.com
    SPACETRACK_PASSWORD=your_password
    ```

---

### 2. TCA & Probability of Collision Upgrade

**Replace instantaneous distance with Time of Closest Approach (TCA) and Probability of Collision (Pc):**

- Implement TCA calculation by propagating both satellites forward over 24 hours in 10-minute steps, finding the minimum separation.
- Use `scipy.stats.norm` for Pc calculation, based on miss distance, uncertainty, and hard body radius.
- Filter out TLEs older than 72 hours before screening.
- Update pair result structure to include TCA, Pc, risk level, TLE age, and confidence scoring.

---

### 3. Space-Track CDM Integration

**Add a new endpoint `/cdm` to fetch real Conjunction Data Messages from Space-Track.org:**

- Create `backend/app/services/spacetrack.py` for CDM fetching and caching.
- Create `backend/app/routes/cdm.py` for API endpoints.
- Register the CDM router in `main.py` and add CDM refresh to startup.
- Return top 50 conjunctions from cache or fetch.

---

### 4. Summary of Upgrades

| Before | After |
|---|---|
| Instantaneous distance | TCA over 24hr window |
| No uncertainty | Probability of Collision (Pc) |
| No freshness check | TLE age filter + confidence scoring |
| No real data | Actual Space Force CDM data via Space-Track |
| "CS student demo" | "Open source SSA research tool" |

---

**Register at space-track.org before running CDM integration.**

---

**Next Steps:**
1. Implement TCA and Pc logic in screening engine.
2. Add TLE freshness filter and confidence scoring.
3. Integrate Space-Track CDM endpoints and caching.
4. Update requirements and environment files.
5. Test all new features for crisp, error-free operation.

    for i in range(steps):
        t = now + timedelta(seconds=i * step_seconds)
        jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second + t.microsecond/1e6)

        e1, r1, v1 = sat1.sgp4(jd, fr)
        e2, r2, v2 = sat2.sgp4(jd, fr)

        if e1 != 0 or e2 != 0:
            continue

        r1, r2 = np.array(r1), np.array(r2)
        v1, v2 = np.array(v1), np.array(v2)

        diff = r1 - r2
        dist = np.linalg.norm(diff)
        rel_vel = np.linalg.norm(v1 - v2)

        distances.append(dist)
        times.append(t)
        positions.append((r1, r2, rel_vel))

        if dist < min_dist:
            min_dist = dist
            tca_time = t
            rel_vel_at_tca = rel_vel

    return min_dist, tca_time, rel_vel_at_tca
```

**2. Add Probability of Collision calculation**

```python
from scipy.stats import norm
import math

def probability_of_collision(miss_distance_km, sigma_km=1.0, hard_body_radius_km=0.01):
    """
    Simplified 1D Pc calculation.
    miss_distance_km: TCA minimum distance
    sigma_km: combined position uncertainty (default 1km for TLE-based data)
    hard_body_radius_km: combined physical size of both objects (default 10m)
    
    Returns Pc as float between 0 and 1
    """
    if miss_distance_km <= 0:
        return 1.0
    
    # combined uncertainty — for TLE data conservatively assume 1km sigma
    combined_sigma = sigma_km
    
    # probability that objects are within hard body radius of each other
    pc = norm.cdf(hard_body_radius_km, loc=miss_distance_km, scale=combined_sigma)
    return float(pc)

def pc_to_risk_level(pc):
    """
    ESA/NASA standard Pc thresholds
    """
    if pc >= 1e-4:      # 0.01%
        return "CRITICAL"
    elif pc >= 1e-5:    # 0.001%
        return "HIGH"
    elif pc >= 1e-6:    # 0.0001%
        return "MEDIUM"
    else:
        return "LOW"
```

**3. Add TLE freshness filter**

```python
from datetime import datetime, timedelta, timezone

def tle_age_hours(satrec):
    """
    Calculate age of TLE epoch in hours
    """
    yr = satrec.epochyr
    year = 2000 + yr if yr < 57 else 1900 + yr
    epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=satrec.epochdays - 1)
    age = datetime.now(timezone.utc) - epoch
    return age.total_seconds() / 3600

# filter out TLEs older than 72 hours before screening
MAX_TLE_AGE_HOURS = 72
fresh_satellites = [s for s in satellites if tle_age_hours(s.satrec) < MAX_TLE_AGE_HOURS]
```

**4. Update pair result structure**

Each pair in the response should now return:

```python
{
    "sat1_name": "ISS",
    "sat2_name": "COSMOS 2251 DEB",
    "tca_time": "2026-03-12T14:32:00Z",
    "miss_distance_km": 4.21,
    "relative_velocity_km_s": 14.3,
    "probability_of_collision": 0.0000023,
    "pc_scientific": "2.3e-6",
    "risk": "MEDIUM",
    "tle_age_sat1_hours": 6.2,
    "tle_age_sat2_hours": 18.4,
    "confidence": "HIGH"   # HIGH if both TLEs < 24hrs, MEDIUM < 72hrs, LOW > 72hrs
}
```

**5. Add confidence scoring based on TLE age**

```python
def confidence_level(age1_hours, age2_hours):
    max_age = max(age1_hours, age2_hours)
    if max_age < 24:
        return "HIGH"
    elif max_age < 72:
        return "MEDIUM"
    else:
        return "LOW"
```

**Do not change the caching system, health endpoint, or frontend. Only upgrade the screening math.**

---

## Codex Prompt 2 — Space-Track CDM Integration

---

Add a new endpoint `GET /cdm` that fetches real Conjunction Data Messages from Space-Track.org and returns them alongside SpaceDebrisAI's own screening results.

**Install required dependency:**
```bash
pip install requests
```

**Add to `.env.example`:**
```
SPACETRACK_EMAIL=your_email@example.com
SPACETRACK_PASSWORD=your_password
```

**Create `backend/app/services/spacetrack.py`:**

```python
import requests
import os
import json
from datetime import datetime, timezone

SPACETRACK_BASE = "https://www.space-track.org"
CDM_CACHE_FILE = "backend/app/data/cdm_cache.json"

session = requests.Session()

def login_spacetrack():
    resp = session.post(
        f"{SPACETRACK_BASE}/ajaxauth/login",
        data={
            "identity": os.getenv("SPACETRACK_EMAIL"),
            "password": os.getenv("SPACETRACK_PASSWORD")
        },
        timeout=15
    )
    resp.raise_for_status()

def fetch_cdm_public():
    """
    Fetch recent public CDMs from Space-Track.
    These are real conjunction events screened by 18th Space Defense Squadron.
    """
    try:
        login_spacetrack()
        resp = session.get(
            f"{SPACETRACK_BASE}/basicspacedata/query/class/cdm_public"
            f"/TCA/>now-7/orderby/TCA asc/format/json",
            timeout=30
        )
        resp.raise_for_status()
        cdms = resp.json()

        # cache locally
        with open(CDM_CACHE_FILE, "w") as f:
            json.dump({
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "cdms": cdms
            }, f)

        return cdms

    except Exception as e:
        print(f"[CDM] Fetch failed: {e}")
        # return cached if available
        try:
            with open(CDM_CACHE_FILE) as f:
                return json.load(f)["cdms"]
        except:
            return []

def load_cdm_cache():
    try:
        with open(CDM_CACHE_FILE) as f:
            return json.load(f)["cdms"]
    except:
        return []
```

**Create `backend/app/routes/cdm.py`:**

```python
from fastapi import APIRouter
from app.services.spacetrack import load_cdm_cache, fetch_cdm_public

router = APIRouter()

@router.get("/cdm")
async def get_cdm():
    """
    Returns real Conjunction Data Messages from Space-Track.org
    These are actual close approach events screened by US Space Force.
    """
    cdms = load_cdm_cache()
    
    return {
        "source": "Space-Track.org — 18th Space Defense Squadron",
        "description": "Real operational conjunction screening data",
        "count": len(cdms),
        "conjunctions": cdms[:50]  # return top 50
    }

@router.post("/cdm/refresh")
async def refresh_cdm():
    cdms = fetch_cdm_public()
    return {"status": "refreshed", "count": len(cdms)}
```

**Register in `main.py`:**
```python
from app.routes.cdm import router as cdm_router
app.include_router(cdm_router)
```

**Add CDM refresh to startup:**
```python
@app.on_event("startup")
async def startup_event():
    fetch_and_cache_tles()      # existing
    fetch_cdm_public()          # new — fetch real CDMs on startup
    threading.Thread(target=refresh_loop, daemon=True).start()
```

**Do not change simulate, satellites, tracker, or health endpoints.**

---

## after both prompts are done your app goes from

| before | after |
|---|---|
| instantaneous distance | Time of Closest Approach over 24hr window |
| no uncertainty | Probability of Collision with ESA thresholds |
| no freshness check | TLE age filter + confidence scoring |
| no real data | actual Space Force CDM data via Space-Track |
| "CS student demo" | "open source SSA research tool" |

register at space-track.org first before running Prompt 2 — you need credentials. 🛰️🔥