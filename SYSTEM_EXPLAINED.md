# SpaceDebrisAI — Complete System Explanation
### For Interviews, Reviews, and Deep-Dives

> **How to read this doc:** Every chapter can stand alone. Start from Chapter 1 for a full walkthrough, or jump to any chapter if an interviewer asks about a specific layer. Each point is self-contained and jargon is explained inline.

---

## Table of Contents

1. [Project Overview — What It Is and Why It Exists](#1-project-overview)
2. [Architecture — How All the Pieces Fit Together](#2-architecture)
3. [Backend — FastAPI Server](#3-backend--fastapi-server)
4. [Orbital Mechanics — TLEs and SGP4](#4-orbital-mechanics--tles-and-sgp4)
5. [The Simulation Pipeline — `/simulate` Endpoint](#5-the-simulation-pipeline)
6. [ML Logic — Risk Engine, Classifier, Avoidance](#6-ml-logic)
7. [Frontend — React 19 Application](#7-frontend--react-19-application)
8. [App Shell — `App.jsx` (Router, Theme, Data Fetch)](#8-app-shell--appjsx)
9. [Navigation Bar — Animations, Theme Toggle, Mobile](#9-navigation-bar)
10. [Dashboard Page — Hero, Ticker, Stats, Panels](#10-dashboard-page)
11. [RiskPanel Component — Hero Card with Auto-Advance](#11-riskpanel-component)
12. [SatelliteBackground — Stars and Streaks](#12-satellitebackground--stars-and-streaks)
13. [Styling System — CSS Variables, Themes, Responsive](#13-styling-system)
14. [Letter-Fall Logo Animation — CSS Keyframes Deep Dive](#14-letter-fall-logo-animation)
15. [RiskPanel Progress Bar Animation — CSS + React Trick](#15-riskpanel-progress-bar-animation)
16. [Other Pages — Satellites, Tracker, About, ConjunctionDetail](#16-other-pages)
17. [Data Flow — End-to-End Request Lifecycle](#17-data-flow--end-to-end)
18. [Project Structure Walkthrough](#18-project-structure)
19. [Quick Interview Q&A Cheat Sheet](#19-quick-interview-qa)

---

## 1. Project Overview

### What is SpaceDebrisAI?

- **SpaceDebrisAI** is a full-stack real-time satellite conjunction monitoring system.
- A **conjunction** is when two objects in orbit come dangerously close — within a few kilometers — creating a collision risk.
- The system continuously tracks satellites, calculates their positions using real orbital physics, detects close approaches (conjunctions), classifies the risk level, and recommends avoidance maneuvers — all powered by a Python backend and a React frontend.

### Why does this matter in the real world?

- There are over 27,000 tracked objects in Earth orbit.
- A single collision can create thousands of new debris fragments (Kessler Syndrome).
- Agencies like NASA, ESA, and SpaceX run conjunction screening every day.
- This project simulates that pipeline at a smaller scale.

### Tech stack at a glance

| Layer | Technology |
|---|---|
| Backend API | Python 3.11 + FastAPI |
| Orbital propagation | SGP4 (`sgp4` Python library) |
| Risk classification | Custom Python ML logic |
| TLE data source | CelesTrak (live) with simulated fallback |
| Frontend | React 19 + Vite 7 |
| Routing | React Router v6 |
| Styling | Pure CSS with CSS custom properties |
| Containerization | Docker + docker-compose |

---

## 2. Architecture

### System layers (top-to-bottom)

```
┌─────────────────────────────────────────────────┐
│              Browser (React 19 SPA)             │
│   Navbar │ Dashboard │ Satellites │ Tracker     │
│   About  │ ConjunctionDetail                    │
└──────────────────────┬──────────────────────────┘
                       │ HTTP fetch (JSON)
                       ▼
┌─────────────────────────────────────────────────┐
│            FastAPI Backend (port 8000)          │
│  /simulate  /health  /tracker/positions         │
│  /satellites                                    │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴─────────────┐
          ▼                          ▼
┌──────────────────┐      ┌──────────────────────┐
│  CelesTrak API   │      │  Simulated positions  │
│  (live TLE feed) │      │  (Keplerian fallback) │
└──────────────────┘      └──────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│               SGP4 Propagator                   │
│  TLE → TEME position vectors (x, y, z in km)   │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              ML Logic Layer                     │
│  classifier.py → risk score + level            │
│  avoidance.py  → maneuver recommendation       │
└─────────────────────────────────────────────────┘
```

### Communication protocol

- The frontend makes a **single HTTP GET** to `http://127.0.0.1:8000/simulate` on page load.
- No WebSocket, no polling — one request, full JSON payload.
- The backend processes everything server-side and returns a complete data object.

---

## 3. Backend — FastAPI Server

**File: `backend/app/main.py`**

### How FastAPI is set up

1. `app = FastAPI()` — creates the application instance.
2. `CORSMiddleware` is added to allow the React dev server (port 5173/5175) to call the API without browser blocking (CORS = Cross-Origin Resource Sharing).
3. Four routers are attached:
   - `simulate_router` → handles `/simulate`
   - `health_router` → handles `/health`
   - `tracker_router` → handles `/tracker/positions`
   - `satellites_router` → handles `/satellites`

### CORS — why it's needed

- The browser blocks requests between different origins by default (different ports count as different origins).
- The allowed origins list includes: `localhost:5173`, `localhost:5175`, `localhost:5176`, `localhost:3000`.
- Without this, the frontend would get a `CORS error` and never receive data.

### Running the server

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

- `--reload` = auto-restart when code changes (dev mode only).
- `app.main:app` = Python module path `app/main.py`, the object named `app`.

---

## 4. Orbital Mechanics — TLEs and SGP4

**Files: `backend/app/services/orbit_real.py`, `backend/app/services/tle_fetcher.py`**

### What is a TLE?

- **Two-Line Element set** — a standardized compact format for describing a satellite's orbit.
- Looks like this:

```
ISS (ZARYA)
1 25544U 98067A   24001.00000000  .00002182  00000-0  47467-4 0  9997
2 25544  51.6416  39.4032 0000765  83.7540 276.3620 15.49581838433878
```

- Line 1 contains: satellite catalog number, classification, launch date, drag term, epoch.
- Line 2 contains: inclination, right ascension, eccentricity, argument of perigee, mean anomaly, mean motion.
- Every tracked object has a TLE updated multiple times per day.

### What is SGP4?

- **Simplified General Perturbations 4** — the standard algorithm used by NORAD, NASA, and all major space agencies.
- Takes a TLE + a specific date/time → outputs: position `(x, y, z)` in km and velocity `(vx, vy, vz)` in km/s.
- The position is in **TEME** (True Equator, Mean Equinox) frame — an Earth-centered inertial coordinate system.
- The Python library `sgp4` wraps the reference Fortran implementation.

### How `tle_to_position()` works (step by step)

```python
def tle_to_position(line1, line2):
    sat = Satrec.twoline2rv(line1, line2)   # parse TLE into satellite record
    now = datetime.utcnow()
    jd, fr = jday(now.year, now.month, now.day,
                  now.hour, now.minute, now.second)  # convert to Julian date
    e, r, v = sat.sgp4(jd, fr)              # propagate to current time
    if e != 0: return None                  # error code != 0 means bad TLE
    return r                                # r = [x, y, z] in km (TEME)
```

- **Julian Date**: astronomers measure time as a continuous count of days since Jan 1, 4713 BC — SGP4 requires this format.
- `jd + fr` = integer part + fractional part (split for floating-point precision).

### TEME → Latitude/Longitude/Altitude conversion

```python
def teme_to_geodetic(r, utc_dt):
    # 1. Compute GMST (Greenwich Mean Sidereal Time)
    #    — how much Earth has rotated since J2000 epoch
    # 2. Rotate TEME frame → ECEF (Earth-Centered, Earth-Fixed)
    #    by rotating around Z-axis by −GMST
    # 3. Run Bowring's iterative algorithm (5 iterations) on ECEF
    #    → lat, lon, alt with WGS-84 ellipsoid (sub-mm accuracy)
```

- **ECEF** = coordinate system that rotates with Earth (x points at 0° lon, z points at North Pole).
- **WGS-84** = the standard Earth ellipsoid model (the same one GPS uses).
- This gives you the familiar latitude/longitude/altitude that maps can display.

---

## 5. The Simulation Pipeline

**File: `backend/app/routes/simulate.py`**

### What `/simulate` returns

The endpoint returns a JSON object containing:

```json
{
  "mode": "real" or "simulated",
  "timestamp_utc": "2024-...",
  "meta": {
    "satellites": 20,
    "pairs_checked": 190,
    "processing_ms": 42
  },
  "satellites": [...],
  "closest_pairs": [...]
}
```

### Step-by-step pipeline inside the endpoint

**Step 1 — Try to fetch live TLEs from CelesTrak**
- Calls `fetch_tles()` which hits the CelesTrak GP data feed.
- If it fails (network down, rate-limited), falls back to `fetch_tles_local()` (local `.tle` file).
- If both fail, uses `SIMULATED_SATS` — 20 satellites with pre-computed Keplerian positions.

**Step 2 — Propagate all satellite positions with SGP4**
- For each TLE pair (line1, line2), calls `tle_to_position()`.
- Converts the TEME vector to geodetic coordinates with `teme_to_geodetic()`.
- Builds a list of `(name, position_vector)` tuples.

**Step 3 — Screen all pairs (`_build_pairs`)**
- Uses `itertools.combinations(sats, 2)` to generate every possible pair.
- For N satellites, this gives N×(N−1)/2 pairs (190 pairs for 20 satellites).
- For each pair, computes 3D Euclidean distance.
- Skips pairs closer than 0.5 km (physically co-located objects = data artifacts like docked modules).

**Step 4 — Classify risk for each pair**
- Calls `classify_conjunction(distance_km, altitude_km)` from the ML logic layer.
- Returns `{ level, score, message, altitude_factor }`.

**Step 5 — Recommend maneuver**
- Calls `recommend_maneuver(distance_km, risk_dict)`.
- Returns `{ action, delta_km, new_distance_km }`.
- Classifies risk again on the post-maneuver separation to prove the maneuver works.

**Step 6 — Sort by proximity, return top results**
- Sorts all pairs by distance (closest first).
- Returns the top 10 closest pairs as `closest_pairs`.
- Returns the full satellite geodetic positions as `satellites`.

### Simulated fallback satellites

The 20 simulated satellites are placed with `_orb(a, inc, raan, anom)`:

- `a` = semi-major axis (km from Earth center) = 6371 + altitude
- `inc` = inclination (degrees) — angle of orbit plane to equator
- `raan` = right ascension of ascending node (degrees) — orientation of orbit plane
- `anom` = mean anomaly (degrees) — where in the orbit the satellite currently is

The simulated set intentionally includes designed-close pairs:
- **ISS ↔ PROGRESS MS-24** → ~3 km → CRITICAL risk
- **STARLINK-3456 ↔ STARLINK-3457** → ~14 km → MEDIUM risk
- **TERRA ↔ AQUA** → ~49 km → LOW risk

---

## 6. ML Logic

**Files: `backend/ml_logic/risk_engine.py`, `backend/ml_logic/classifier.py`, `backend/ml_logic/avoidance.py`**

### risk_engine.py — Base distance thresholds

```python
def calculate_risk(distance_km):
    if distance_km < 2:   return { "risk": "HIGH",   "score": 80 }
    elif distance_km < 5: return { "risk": "MEDIUM",  "score": 50 }
    else:                 return { "risk": "LOW",     "score": 10 }
```

- This is the foundational rule: the closer two objects are, the higher the score.
- Scores are on a 0–100 scale.

### classifier.py — Altitude-weighted multi-tier classification

The classifier **wraps** the risk engine and applies an altitude factor:

```
LEO  (< 500 km)    → factor = 1.20  (20% more dangerous — densest debris region)
MEO  (< 2000 km)   → factor = 1.00  (baseline)
HEO/GEO (> 2000 km)→ factor = 0.80  (slower relative velocities, more time to react)
```

**Final score** = `min(base_score × altitude_factor, 100)`

**Risk thresholds on adjusted score:**

| Adjusted Score | Level | Message |
|---|---|---|
| ≥ 85 | CRITICAL | Emergency maneuver required immediately |
| ≥ 60 | HIGH | Immediate maneuver recommended |
| ≥ 30 | MEDIUM | Monitor closely, prepare maneuver |
| < 30 | LOW | Safe orbital separation |

**Example:** ISS vs PROGRESS at 3 km, altitude 408 km (LEO):
- Base score = 50 (distance < 5 km)
- × 1.20 altitude factor = 60 → **HIGH** risk

**Example:** ISS vs PROGRESS at 2.8 km, altitude 408 km:
- Base score = 80 (distance < 2 km)
- × 1.20 = 96 → **CRITICAL**

### avoidance.py — Maneuver recommendation engine

```python
_DELTA = {
    "CRITICAL": 25.0,   # km altitude boost
    "HIGH":     15.0,
    "MEDIUM":    8.0,
    "LOW":       0.0,
}
```

- For each risk level, the engine recommends raising the satellite's orbit by a fixed altitude.
- `new_distance_km = current_distance + delta_km`
- This is a simplified model — real systems use the actual delta-v in m/s and propagate the new orbit.
- The "after maneuver" risk is then re-classified using the same classifier to show the improvement.

**Why altitude boost?** Raising orbit by ΔH km physically separates the satellite from the debris/other object, since they're no longer on the same orbital plane crossing.

---

## 7. Frontend — React 19 Application

**Root: `frontend/src/`**

### Tech choices

- **React 19** — latest stable version; uses the standard `useState`/`useEffect` hook model.
- **Vite 7** — build tool. Much faster than Webpack. In dev mode it serves ES modules directly to the browser (no bundling step).
- **React Router v6** — client-side routing via `<BrowserRouter>` and `<Routes>`.
- **Pure CSS** — no Tailwind, no CSS-in-JS, no external UI library. All styling is hand-crafted in `index.css` using CSS custom properties.

### Fonts

- `--font: 'Figtree'` → body text, labels, buttons.
- `--display: 'Montserrat'` → large hero headings.
- Both loaded from Google Fonts via `@import` in `index.css`.

### Pages registered in the router

| Route | Component | Purpose |
|---|---|---|
| `/` | `Dashboard` | Main landing — hero, risk panel, table |
| `/satellites` | `Satellites` | List of all tracked satellites |
| `/tracker` | `Tracker` | Live map of satellite positions |
| `/conjunction/:id` | `ConjunctionDetail` | Detail view for one conjunction |
| `/api` | `ApiPage` | API documentation page |
| `/about` | `About` | How it works, tech stack |

---

## 8. App Shell — `App.jsx`

**File: `frontend/src/App.jsx`**

This is the root component — everything renders inside it.

### Theme system

```jsx
const [theme, setTheme] = useState(
  () => localStorage.getItem("sd-theme") || "dark"
);

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("sd-theme", theme);
}, [theme]);
```

- On first load, reads the saved theme from `localStorage` (defaults to `"dark"`).
- Every time `theme` changes, sets `data-theme="dark"` or `data-theme="light"` on the `<html>` element.
- CSS then responds via `[data-theme="light"] { ... }` override blocks.
- The theme preference **survives page refreshes** because it's stored in `localStorage`.

### Data fetch

```jsx
useEffect(() => {
  fetchSimulation()
    .then((d) => { setData(d); setLoading(false); })
    .catch((err) => { setError(err.message); setLoading(false); });
}, []);
```

- Runs once on mount (`[]` dependency = run once).
- Calls `fetchSimulation()` from `api/backend.js` → `GET http://127.0.0.1:8000/simulate`.
- Sets `data`, `loading`, `error` state.
- These three props are passed down to every page component.

### SatelliteBackground — dark mode only

```jsx
{theme === "dark" && <SatelliteBackground />}
```

- The animated star field is only rendered in dark mode.
- In light mode it's not in the DOM at all (saves GPU/CPU).

### Live status

- `live={!loading && !error}` — the navbar shows a green "Live" dot only when data loaded successfully.

---

## 9. Navigation Bar

**File: `frontend/src/components/Navbar.jsx`**

### Structure

The navbar has four sections inside `.navbar-inner`:

1. **Brand** (logo text with letter-fall animation)
2. **Desktop nav links** (Dashboard, Satellites, Tracker, About)
3. **Right controls** (theme toggle, live status pill, hamburger button)
4. **Mobile drawer** (slides in when hamburger is clicked)

### Letter-fall animation — how it's built

```jsx
const BRAND = [
  { chars: "Space",  base: 0 },
  { chars: "Debris", base: 5 },
  { chars: "AI",     base: 11, accent: true },
];
```

- `BRAND` is a data array — three groups of characters.
- `base` is the letter's global index offset (Space = letters 0–4, Debris = 5–10, AI = 11–12).
- `accent: true` makes AI letters render in the accent color (`var(--accent)` = cyan/teal).

```jsx
{BRAND.map(({ chars, base, accent }) =>
  chars.split("").map((ch, i) => (
    <span
      key={base + i}
      className="nb-letter"
      style={{
        animationDelay: `${(base + i) * 0.055}s`,
        color: accent ? "var(--accent)" : undefined,
      }}
    >
      {ch}
    </span>
  ))
)}
```

- Each character is individually wrapped in a `<span className="nb-letter">`.
- The `animationDelay` is staggered: letter 0 starts at 0s, letter 1 at 0.055s, letter 2 at 0.110s, etc.
- Total: 13 letters × 55ms stagger = last letter appears at 0.66s after page load.
- The CSS class `nb-letter` applies the `nb-fall` keyframe animation.

### Active nav link highlighting

```jsx
className={({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link"}
```

- React Router's `<NavLink>` provides `isActive` automatically.
- `end={to === "/"}` on the Dashboard link prevents it from staying active on all pages (because every route starts with `/`).

### Theme toggle button

- Renders a sun SVG in dark mode (click to go light).
- Renders a moon SVG in light mode (click to go dark).
- Calls `onToggleTheme` which is `() => setTheme(t => t === "dark" ? "light" : "dark")` in `App.jsx`.

### Mobile hamburger

```jsx
const [menuOpen, setMenuOpen] = useState(false);
<button
  className={`hamburger${menuOpen ? " open" : ""}`}
  onClick={() => setMenuOpen((v) => !v)}
>
  <span /><span /><span />
</button>
```

- Three `<span>` elements styled as horizontal bars (the classic hamburger icon).
- When `menuOpen` is true, CSS transforms the bars into an X shape (`.hamburger.open span` rules).
- The mobile drawer is conditionally rendered:
  ```jsx
  {menuOpen && <div className="mobile-drawer">...</div>}
  ```

---

## 10. Dashboard Page

**File: `frontend/src/pages/Dashboard.jsx`**

The dashboard is the main page — it assembles several sections:

### Hero section

```jsx
<h1 className="db-hero-h1">
  <span>ORBITAL</span>
  <span className="accent-line">COLLISION</span>
  <span className="ghost-line">MONITOR</span>
</h1>
```

- Three lines stacked vertically.
- `accent-line` = filled cyan/teal color.
- `ghost-line` = outline text (CSS `text-stroke` or border effect).
- The eyebrow line "Real-time orbital conjunction monitoring" sits above.

### Live ticker

```jsx
<div className="db-ticker">
  <div className="db-ticker-track">
    {[...tickerItems, ...tickerItems].map((pair, i) => (
      <span key={i} className="db-ticker-item">...
```

- The items are **duplicated** (`[...tickerItems, ...tickerItems]`) so the scroll loop appears seamless.
- CSS `@keyframes` moves the `.db-ticker-track` continuously from 0% to −50%.
- When the track has scrolled one full copy's width (50% of the doubled total), it snaps back to 0% — creating an infinite loop illusion.

### Stats band

Four `<StatCard>` components showing:
- Satellites tracked (from local `SAT_DB` count)
- Pairs screened (from `data.meta.pairs_checked`)
- Processing time in milliseconds
- Data mode ("real" or "simulated")

### Loading and error states

```jsx
{loading && <div className="loading-state"><div className="spinner" />...</div>}
{error   && <div className="error-state"><p>{error}</p></div>}
```

- The spinner is a pure CSS circle with a rotating border — no gif, no library.
- Error state shows the string message from the failed fetch.

### Main panels

```jsx
<div className="db-main">
  <RiskPanel data={data} />
  <SimulationContext data={data} />
</div>
```

- These two panels sit side-by-side on desktop (CSS grid or flex).
- On mobile they stack vertically.

---

## 11. RiskPanel Component

**File: `frontend/src/components/RiskPanel.jsx`**

This is the most complex component — a hero card that cycles through all detected conjunctions.

### Data flow

1. Receives `data` prop from Dashboard.
2. Sorts `data.closest_pairs` by risk level then distance:
   ```js
   const sorted = [...data.closest_pairs].sort((a, b) => {
     const al = RISK_ORDER[a.before.risk?.level ?? "LOW"] ?? 3;
     const bl = RISK_ORDER[b.before.risk?.level ?? "LOW"] ?? 3;
     if (al !== bl) return al - bl;
     return a.before.distance_km - b.before.distance_km;
   });
   ```
   - CRITICAL always shows first, then HIGH, MEDIUM, LOW.
   - Within same risk level, closer pairs show first.

### Auto-advance — the timer system

```js
const AUTO_ADVANCE_MS = 5000;  // 5 seconds
const timerRef = useRef(null);

const resetTimer = useCallback(() => {
  if (timerRef.current) clearInterval(timerRef.current);   // stop old timer
  timerRef.current = setInterval(() => {
    setIdx((i) => (i + 1 < total ? i + 1 : 0));            // advance or wrap
  }, AUTO_ADVANCE_MS);
}, [total]);

useEffect(() => {
  resetTimer();                                            // start timer on mount
  return () => clearInterval(timerRef.current);           // cleanup on unmount
}, [resetTimer]);
```

- `useRef` is used (not `useState`) because the timer ID doesn't need to trigger a re-render.
- `useCallback` memoizes `resetTimer` so its reference only changes when `total` changes — preventing infinite `useEffect` loops.
- When the user clicks an arrow, `go()` is called instead of `setIdx()` directly:
  ```js
  function go(next) {
    setIdx(next);
    resetTimer();   // reset the 5s countdown after manual navigation
  }
  ```

### Risk color system

```js
const RISK_COLORS = {
  CRITICAL: "239,68,68",    // red
  HIGH:     "249,115,22",   // orange
  MEDIUM:   "245,158,11",   // amber
  LOW:      "34,197,94",    // green
};
```

- Colors stored as raw RGB values so they can be used with `rgba()` for transparency effects.
- The ambient glow blob behind the card picks up `--rp-rgb` CSS variable set from the active pair's risk color.

### Click to detail

- The whole card body is wrapped in `onClick={handleClick}`.
- `handleClick` uses `useNavigate()` from React Router to push to `/conjunction/:id`.
- Passes the full pair data, satellites array, and timestamp via `state` (React Router's location state mechanism — no URL pollution).

### Card visual sections

- **Top accent bar** — colored stripe matching risk level.
- **Progress line** — sweeps across the accent bar in 5 seconds (see Chapter 15).
- **Header row** — left: pulse dot + risk badge + "CONJUNCTION ALERT" label. Right: prev/next arrows + counter.
- **Satellite names** — both object names with a ✕ between them.
- **Distance hero** — large number showing closest approach in km.
- **Before/After panel** — side-by-side comparison of risk before and after the recommended maneuver.
- **Action bar** — the specific maneuver recommendation text.

---

## 12. SatelliteBackground — Stars and Streaks

**File: `frontend/src/components/SatelliteBackground.jsx`**

### Stars

```js
const stars = useMemo(() =>
  Array.from({ length: 180 }, (_, i) => ({
    top:      `${Math.random() * 100}%`,
    left:     `${Math.random() * 100}%`,
    size:     Math.random() * 2.2 + 0.4,       // 0.4–2.6px
    delay:    `${(Math.random() * 9).toFixed(2)}s`,
    duration: `${(3 + Math.random() * 6).toFixed(2)}s`,
  })), []);
```

- 180 `<div className="star">` elements, each an absolutely positioned tiny circle.
- `useMemo([])` means positions are computed once on mount and never recalculated.
- Each star has:
  - Random position (`top`/`left` as percentages).
  - Random size (0.4–2.6px — the smaller ones look more distant).
  - Random `animationDuration` (3–9s) and `animationDelay` (0–9s) for the `twinkle` animation.
- The `twinkle` keyframe cycles `opacity` between ~15% and 100% to simulate atmospheric shimmer.

### Satellite streaks

- 5 `<div className="star-streak">` elements positioned at random vertical positions.
- Animated with CSS `@keyframes` to slide horizontally across the screen.
- Represent passing satellites — thin horizontal lines with a gradient tail.

### Ambient glow overlays

Three absolutely-positioned `<div>` elements with `radial-gradient` backgrounds:
1. Blue glow at the top center (simulates atmospheric scatter).
2. Purple/indigo glow at bottom-right.
3. Soft blue glow at top-left.

These create the sense of depth and space atmosphere without any image files.

---

## 13. Styling System

**File: `frontend/src/index.css` (~3100 lines)**

### CSS custom properties (variables)

All colors and spacing live in `:root {}`:

```css
:root {
  --bg:          #020617;    /* page background */
  --surface:     #0f172a;    /* card backgrounds */
  --surface-t:   rgba(15,23,42,0.85); /* semi-transparent cards */
  --border:      rgba(148,163,184,0.12);
  --accent:      #38bdf8;    /* primary cyan-blue */
  --accent-glow: rgba(56,189,248,0.18);
  --text:        #cbd5e1;    /* body text */
  --text-bright: #ffffff;    /* headings, labels */
  --text-dim:    #94a3b8;    /* secondary text */
  --text-faint:  #64748b;    /* placeholder text */
  --mono:        'Courier New', monospace;
  --font:        'Figtree', sans-serif;
  --display:     'Montserrat', sans-serif;
}
```

### Light theme overrides

```css
[data-theme="light"] {
  --bg:          #f0f4f8;
  --surface:     #ffffff;
  --text:        #1e293b;
  --text-bright: #0d1b2a;   /* dark navy for contrast on white */
  --accent:      #0284c7;
  /* ...all variables re-defined... */
}
```

- The `[data-theme="light"]` selector on `<html>` overrides every variable.
- Because all components use variables (not hard-coded colors), the entire UI switches theme without touching any component code.
- Every former `color: #fff` was replaced with `color: var(--text-bright)` so it correctly becomes dark on light backgrounds.

### Responsive breakpoints

```css
@media (max-width: 900px) {
  /* tablet layout — 2-column grids become 1-column */
}
@media (max-width: 540px) {
  /* phone layout — smaller fonts, full-width elements */
}
```

- `900px` = tablet threshold.
- `540px` = phone threshold.
- Layouts shift from multi-column flex/grid to single-column stacks.

---

## 14. Letter-Fall Logo Animation

This section explains exactly how the "SpaceDebrisAI" letter-by-letter fall animation works.

### The CSS

```css
.nb-letter {
  display: inline-block;    /* needed for transform to work on inline elements */
  opacity: 0;               /* starts invisible */
  animation: nb-fall 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  /* 'forwards' = keep the final state (visible) after the animation ends */
}

@keyframes nb-fall {
  from {
    opacity: 0;
    transform: translateY(-20px);  /* starts 20px above its position */
  }
  to {
    opacity: 1;
    transform: translateY(0);      /* drops into its natural position */
  }
}
```

### The React

```jsx
<span
  className="nb-letter"
  style={{
    animationDelay: `${(base + i) * 0.055}s`,
  }}
>
  {ch}
</span>
```

- `base + i` = global letter index (0 to 12 for 13 letters total).
- `× 0.055s` = 55 milliseconds stagger between letters.
- The CSS animation says: "wait `animationDelay` seconds, then run `nb-fall` for 0.4s".
- Result: letter S falls first at 0s, then P at 55ms, then A at 110ms, and so on.

### The easing curve explained

- `cubic-bezier(0.22, 1, 0.36, 1)` = "ease-out" style that overshoots slightly and settles — gives a bouncy, springy feel.
- Values are control points for a Bézier curve: fast start, decelerates quickly at end.

### Why `display: inline-block`?

- `transform` and `opacity` animations don't work on default inline elements (`<span>` is inline by default).
- `inline-block` makes the span behave like a block for layout purposes but still flows inline with other text.

---

## 15. RiskPanel Progress Bar Animation

This is the 5-second sweep line across the top accent bar of the risk card.

### The CSS

```css
.rp-accent-bar {
  position: relative;   /* needed for the child to be positioned relative to this */
  overflow: hidden;     /* clip the line so it doesn't extend outside the bar */
}

.rp-progress-line {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 0%;            /* starts with no width */
  background: var(--rp-prog-color);
  animation: rp-sweep 5s linear forwards;
  /* linear = constant speed, forwards = stay at 100% when done */
}

@keyframes rp-sweep {
  from { width: 0%; }
  to   { width: 100%; }
}
```

### The React trick — `key` prop for animation reset

```jsx
<div className="rp-progress-line" key={idx} style={{ "--rp-prog-color": `rgb(${rgb})` }} />
```

- `key={idx}` is the critical part.
- React re-mounts an element when its `key` changes.
- When `idx` changes (card advances), React removes the old `.rp-progress-line` from the DOM and inserts a new one.
- The new element has no prior animation state, so the CSS animation starts from `width: 0%` again.
- This is the simplest way to reset a CSS animation — no JavaScript, no classList manipulation.

### Color system

- `--rp-prog-color` is a CSS custom property set inline.
- Its value is `rgb(239, 68, 68)` for CRITICAL, `rgb(249, 115, 22)` for HIGH, etc.
- This means the progress bar's color matches the risk level automatically.

---

## 16. Other Pages

### About Page (`pages/About.jsx`)

- Static informational page — no API calls.
- **Steps grid:** 4 cards showing the pipeline: TLE → SGP4 → Risk → AI.
- **Tech stack grid:** 8 tech cards, each with a small colored accent bar using `--tc` CSS variable (set inline per card).

### Satellites Page (`pages/Satellites.jsx`)

- Shows all tracked satellites as cards.
- Data comes from the same `data` prop (passed from App.jsx through Dashboard routing).
- Each card shows: name, lat/lon, altitude, risk level badge.

### Tracker Page (`pages/Tracker.jsx`)

- Makes a separate API call to `/tracker/positions`.
- Renders a world map with satellite dots plotted by latitude/longitude.
- Uses a KeepTrack/OOTK integration for position data.

### ConjunctionDetail Page (`pages/ConjunctionDetail.jsx`)

- Accessed at `/conjunction/:id`.
- Receives the full pair data via `useLocation().state` (no API re-fetch needed).
- Shows: full satellite names, before/after distance, risk level, recommended maneuver, altitude.

### ApiPage (`pages/ApiPage.jsx`)

- Developer documentation page.
- Shows the available API endpoints with example request/response JSON.
- No API calls — purely static documentation.

---

## 17. Data Flow — End-to-End

Here is the complete journey from browser open to rendered dashboard:

```
1. User opens http://localhost:5173 in browser
   └─ Vite serves index.html + React bundle

2. App.jsx mounts
   ├─ Reads localStorage("sd-theme") → sets theme on <html>
   ├─ Renders <Navbar> (letters start falling animation immediately)
   ├─ Renders <SatelliteBackground> stars & streaks (dark mode only)
   └─ Fires GET http://127.0.0.1:8000/simulate

3. FastAPI /simulate endpoint runs
   ├─ Tries CelesTrak fetch (2s timeout)
   │   ├─ Success: SGP4-propagate all TLEs to NOW
   │   └─ Failure: use SIMULATED_SATS positions
   ├─ For every pair of N satellites (N×(N-1)/2 pairs):
   │   ├─ distance_km = Euclidean 3D distance
   │   ├─ classify_conjunction(distance, altitude)
   │   │   └─ calculate_risk(distance) × altitude_factor → level + score
   │   └─ recommend_maneuver(distance, risk) → action + new_distance
   └─ Returns JSON: { mode, meta, satellites, closest_pairs }

4. React receives JSON → setData(json) → setLoading(false)
   └─ Dashboard re-renders with data:

5. Dashboard renders:
   ├─ Hero h1 (CSS animations on ORBITAL/COLLISION/MONITOR)
   ├─ Ticker (scrolling list, pairs doubled for seamless loop)
   ├─ Stats band (SAT_COUNT, pairs_checked, processing_ms, mode)
   ├─ RiskPanel:
   │   ├─ Sorts closest_pairs by (risk_level, distance)
   │   ├─ Starts 5s auto-advance timer (useEffect + setInterval)
   │   ├─ Renders card for idx=0 (most critical pair)
   │   └─ CSS progress line sweeps 0%→100% in 5s
   ├─ SimulationContext (mode, metadata)
   └─ SatelliteTable (all pairs in a table)
```

---

## 18. Project Structure

```
SpaceDebrisCollisionAI/
│
├── backend/                         ← Python FastAPI server
│   ├── app/
│   │   ├── main.py                  ← FastAPI instance + CORS + routers
│   │   ├── config.py                ← Config values
│   │   ├── routes/
│   │   │   ├── simulate.py          ← /simulate: the main pipeline
│   │   │   ├── health.py            ← /health: liveness check
│   │   │   ├── tracker.py           ← /tracker/positions
│   │   │   └── satellites.py        ← /satellites
│   │   └── services/
│   │       ├── orbit_real.py        ← SGP4 propagator + TEME→geodetic
│   │       ├── tle_fetcher.py       ← CelesTrak / local TLE fetching
│   │       ├── proximity.py         ← proximity utilities
│   │       └── data_loader.py       ← TLE file loading
│   └── ml_logic/
│       ├── risk_engine.py           ← Base distance → risk score
│       ├── classifier.py            ← Altitude-weighted risk level
│       └── avoidance.py             ← Maneuver recommendations
│
├── frontend/                        ← React 19 + Vite SPA
│   └── src/
│       ├── App.jsx                  ← Root: router, theme, data fetch
│       ├── api/
│       │   └── backend.js           ← fetch wrappers for API calls
│       ├── components/
│       │   ├── Navbar.jsx           ← Navigation + letter animation
│       │   ├── RiskPanel.jsx        ← Hero conjunction card
│       │   ├── SatelliteBackground.jsx ← Stars + streaks
│       │   ├── SatelliteTable.jsx   ← All pairs table
│       │   ├── SimulationContext.jsx ← Metadata panel
│       │   ├── Footer.jsx           ← Page footer
│       │   ├── InfoPanel.jsx        ← Context sidebar
│       │   └── Stars.jsx            ← Simple stars div
│       ├── pages/
│       │   ├── Dashboard.jsx        ← Main landing page
│       │   ├── Satellites.jsx       ← Satellite cards
│       │   ├── Tracker.jsx          ← World map tracker
│       │   ├── About.jsx            ← System explainer
│       │   ├── ConjunctionDetail.jsx ← Single conjunction detail
│       │   └── ApiPage.jsx          ← API docs page
│       └── index.css                ← All styles, ~3100 lines
│
├── ml_logic/                        ← Root-level ML stubs (older)
├── scripts/                         ← Utility scripts
├── docker-compose.yml               ← Container orchestration
├── .gitignore                       ← Excludes venv, dist, caches
└── SYSTEM_EXPLAINED.md              ← This file
```

---

## 19. Quick Interview Q&A

**Q: What is a conjunction?**
> Two orbiting objects coming within a dangerous threshold distance of each other — typically measured in km. Below ~5 km is considered to need monitoring; below ~2 km triggers emergency protocols.

**Q: How do you calculate satellite positions?**
> We use the SGP4 orbital propagation model. A TLE (Two-Line Element set) describes a satellite's orbit. SGP4 takes the TLE + a timestamp → outputs a 3D position vector (x, y, z in km) in the TEME inertial frame. We then convert TEME → geodetic (lat/lon/alt) using GMST rotation + WGS-84 ellipsoid model.

**Q: Why is the altitude factor important in risk classification?**
> LEO (below 500 km) is the most congested region with the highest debris density. Objects at LEO also travel at ~7.8 km/s — collision speeds are highest, and less time exists to react. So the same 4 km separation at 400 km altitude is more dangerous than at 2000 km. The classifier multiplies the base risk score by 1.2 in LEO.

**Q: How does the auto-advance timer work without getting stale closures?**
> `useCallback` wraps `resetTimer` so its identity only changes when `total` changes. `useRef` holds the interval ID without triggering re-renders. When `total` changes, `resetTimer` gets a new stable reference, which triggers `useEffect` to restart the interval with the correct `total` in scope.

**Q: How does the CSS animation reset when the card changes?**
> By changing the `key` prop on the `.rp-progress-line` element to match `idx`. React unmounts the old element and mounts a fresh one when the key changes. The fresh element starts the CSS `rp-sweep` animation from `width: 0%` — no JavaScript animation manipulation needed.

**Q: How does the theme system work?**
> Setting `data-theme="light"` on `<html>` activates `[data-theme="light"]` selector blocks in CSS. All colors use CSS custom properties (`--text-bright`, `--surface`, etc.), which are re-defined in the light theme block. The preference is saved to `localStorage` so it persists across page reloads.

**Q: What happens if CelesTrak is unreachable?**
> The backend has a three-tier fallback:
> 1. Live CelesTrak GP feed.
> 2. Local TLE file (`app/data/satellites.tle`).
> 3. 20 hand-crafted simulated satellites with designed-close pairs that cover all four risk levels.

**Q: How does the ticker loop seamlessly?**
> The conjunction items array is duplicated (`[...items, ...items]`). A CSS `@keyframes` animation translates the container from `translateX(0)` to `translateX(-50%)`. At −50%, the visual is identical to 0% (second half = exact copy of first half). The animation loops — the viewer never sees a jump.

**Q: What is `itertools.combinations` doing in the backend?**
> It generates every unique pair from a list without repetition and without order (A,B is the same as B,A). For 20 satellites it generates 20!/(2!×18!) = 190 pairs. This is the O(N²) conjunction screening step.

**Q: Why use `useRef` instead of `useState` for the timer ID?**
> Timer IDs don't need to trigger re-renders when they change. `useState` would cause an unnecessary re-render every time the timer was set. `useRef` gives a mutable container that persists across renders without causing any re-render.

---

*Generated from the actual codebase — every detail in this document corresponds to real code in the repository.*
