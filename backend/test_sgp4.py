from sgp4.api import Satrec, jday
from datetime import datetime

line1 = "1 25544U 98067A   24016.54870370  .00016717  00000+0  10270-3 0  9995"
line2 = "2 25544  51.6423  39.2611 0005045  54.1882  57.5897 15.50023796436516"

sat = Satrec.twoline2rv(line1, line2)

now = datetime.utcnow()
jd, fr = jday(
    now.year,
    now.month,
    now.day,
    now.hour,
    now.minute,
    now.second,
)

e, r, v = sat.sgp4(jd, fr)

print("Position (km):", r)
print("Velocity (km/s):", v)
