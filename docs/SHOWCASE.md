# SpaceDebrisAI — Visual Showcase

> Live deployment: **https://virenn77-spacedebrisai.hf.space**  
> GitHub: **https://github.com/viren-pandey/SpaceDebrisAI**

---

## 1. Live Backend API — `/simulate`

Real SGP4 orbital data served from the Hugging Face Space backend.  
200 satellites, 19 900 pairs screened, risk classified per conjunction.

![API Response](screenshots/01-api-response.png)

```
GET https://virenn77-spacedebrisai.hf.space/simulate
→ Returns: closest_pairs[], satellites[], mode, meta, timestamp_utc
```

---

## 2. Dashboard — Hero Section

The landing page hero with the **ORBITAL COLLISION MONITOR** typographic stack,  
live screening status badge, and the real-time conjunction ticker at the bottom.

![Dashboard Hero](screenshots/02-dashboard-hero.png)

**What's shown:**
- `SCREENING ACTIVE` status pill (green, pulsing dot)
- Typographic hero: ORBITAL (white) / COLLISION (cyan fill) / MONITOR (ghost outline)
- Live scrolling ticker showing all satellite pairs + risk levels + distances

---

## 3. Navbar & Logo Animation

The `SpaceDebrisAI` brand text with per-letter fall-in animation on page load.  
Each of the 13 characters drops from 20 px above with a 55 ms stagger.  
`AI` renders in the cyan accent color (`var(--accent)`).

![Navbar Logo](screenshots/03-navbar-logo.png)

---

## 4. RiskPanel — Conjunction Hero Card

The auto-advancing hero card showing the highest-priority active conjunction.  
Auto-advances every 5 seconds; the cyan progress line sweeps as a visual countdown.

![RiskPanel](screenshots/04-risk-panel.png)

**What's shown:**
- Risk badge: **MEDIUM** (amber) with pulsing dot
- Counter: **5 of 20** — arrow nav + 5 s auto-advance
- Closest approach: **8.20 km** (large display number)
- Before / After maneuver comparison panels
- `View full conjunction detail →` click-through link
- UTC timestamp bottom-right

---

## 5. Satellites Page — 200 Active Satellites

All 200 tracked spacecraft from the CelesTrak GP feed, shown as expandable cards.

![Satellites Page](screenshots/05-satellites-page.png)

**Stats bar:**
| Stat | Value |
|---|---|
| Pairs screened | 19 900 |
| CRITICAL | 2 |
| HIGH RISK | 2 |
| NOMINAL | 196 |

**Registry:** Each card shows country, mission type, orbital regime (LEO / GEO / Sun-sync), and live geodetic position.

---

## 6. Live Orbital Tracker

Real-time world map with all satellites plotted by latitude/longitude.  
Positions computed client-side using the Orbital Object Toolkit (OOTK) from live TLE data.

![Tracker Page](screenshots/06-tracker-page.png)

**What's shown:**
- **163 satellites live** (163/200 with valid real-time positions)
- 36 unavailable (TLE propagation errors — expected for decayed objects)
- Refresh button to recompute all positions instantly
- Satellite icons plotted on a dark SVG world map

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · FastAPI · SGP4 · CelesTrak |
| ML Logic | Custom altitude-weighted risk classifier + maneuver engine |
| Frontend | React 19 · Vite 7 · React Router v6 |
| Styling | Pure CSS · CSS custom properties · two-theme system |
| Analytics | Vercel Analytics |
| Hosting | Hugging Face Spaces (backend) · Vercel (frontend) |
| Repo | GitHub — `viren-pandey/SpaceDebrisAI` |
