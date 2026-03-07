from sgp4.api import Satrec, jday
from datetime import datetime, timezone
import math

def tle_to_position(line1, line2):
    sat = Satrec.twoline2rv(line1, line2)

    now = datetime.utcnow()
    jd, fr = jday(
        now.year, now.month, now.day,
        now.hour, now.minute, now.second
    )

    e, r, v = sat.sgp4(jd, fr)

    if e != 0:
        print("SGP4 ERROR CODE:", e)
        return None

    return r

def distance_km(p1, p2):
    return math.sqrt(
        (p1[0] - p2[0]) ** 2 +
        (p1[1] - p2[1]) ** 2 +
        (p1[2] - p2[2]) ** 2
    )


def teme_to_geodetic(r, utc_dt=None):
    """Convert a TEME position vector (km) → (lat_deg, lon_deg, alt_km).

    Uses a simplified GMST rotation (TEME→ECEF) followed by
    Bowring's iterative geodetic conversion (WGS-84).
    """
    if utc_dt is None:
        utc_dt = datetime.now(timezone.utc)

    jd, fr = jday(
        utc_dt.year, utc_dt.month, utc_dt.day,
        utc_dt.hour, utc_dt.minute,
        utc_dt.second + utc_dt.microsecond / 1e6,
    )
    jd_full = jd + fr

    # GMST (degrees) — IAU 1982 model
    T = (jd_full - 2451545.0) / 36525.0
    gmst_deg = (100.4606184 + 36000.77004 * T + 0.000387933 * T * T) % 360.0
    gmst_rad = math.radians(gmst_deg)

    x, y, z = r
    # Rotate TEME → ECEF around Z-axis by −GMST
    cos_g = math.cos(-gmst_rad)
    sin_g = math.sin(-gmst_rad)
    xe = x * cos_g - y * sin_g
    ye = x * sin_g + y * cos_g
    ze = z

    # WGS-84
    a  = 6378.137          # km, semi-major axis
    e2 = 0.00669437999014  # first eccentricity squared

    lon_deg = math.degrees(math.atan2(ye, xe))
    p = math.sqrt(xe * xe + ye * ye)

    # Bowring iterative (5 steps → sub-mm accuracy)
    lat = math.atan2(ze, p * (1 - e2))
    for _ in range(5):
        sin_lat = math.sin(lat)
        N = a / math.sqrt(1 - e2 * sin_lat * sin_lat)
        lat = math.atan2(ze + e2 * N * sin_lat, p)

    lat_deg  = math.degrees(lat)
    sin_lat  = math.sin(lat)
    cos_lat  = math.cos(lat)
    N        = a / math.sqrt(1 - e2 * sin_lat * sin_lat)
    alt_km   = (p / cos_lat - N) if abs(cos_lat) > 1e-6 else (
        abs(ze) / abs(sin_lat) - N * (1 - e2)
    )

    return round(lat_deg, 4), round(lon_deg, 4), round(alt_km, 2)

