# SpaceDebrisAI explained end-to-end

This file is the brain dump for anyone who wants to grok how SpaceDebrisAI is built—from the orbital physics driving the backend to the live frontend animations, APIs, and tracker experiences. Think of it as “teach a donkey how to build it from scratch”: start with the basic concepts, then walk through the plumbing in a logical sequence. All code references are in this repository; follow the section headers to jump to the relevant files.

---

## 1. Orbital physics primitives

- **Two-Line Elements (TLEs)**: Every satellite or debris object is described by two 69-character lines (`line1` and `line2`) plus an optional name. `line1` stores orbital epoch, inclination, RAAN, and mean motion, while `line2` stores eccentricity, argument of perigee, mean anomaly, and mean motion derivative. The parser in `backend/app/services/tle_fetcher.py` groups the raw file into 3-line blocks (name + `1 ...` + `2 ...`) and discards malformed or nameless entries.
- **SGP4 propagation**: `sgp4.api.Satrec.twoline2rv` turns the TLE lines into a satellite record. Passing the current UTC Julian date into `sgp4()` returns the TEME (True Equator Mean Equinox) position vector `r` (kilometres) and the error code `e`. Negative `e` or out-of-bounds results terminate the propagation. We also compute the Euclidean altitude from the vector and filter out anything below 100 km or above 50 000 km—these values typically mean the TLE decayed or is corrupt.
- **TEME → geodetic**: The backend converts the TEME vector into latitude, longitude, and altitude using the IAU 1982 GMST formula. We rotate the vector into Earth-Centred Earth-Fixed (ECEF) coordinates, then apply Bowring’s iteration with the WGS-84 ellipsoid constants (`a = 6378.137 km`, `e² = 0.00669437999`) to solve for latitude/altitude with metre-level precision. The result is rounded and returned to clients.
- **Distance math**: The `distance_km()` helper just computes the Euclidean distance between two TEME vectors. It drives the conjunction screening and feeds risk classification with the instantaneous separation.

## 2. TLE ingestion, caching, and refresh pipeline

- **KeepTrack catalog**: The HTTP client hits `https://api.keeptrack.space/v4/sats` and serializes the JSON catalog into `name`, `tle1`, `tle2` lines. We verify every block still complies with the TLE prefixes before writing a newline-separated catalog.
- **Local cache**: Data lives in `backend/app/data/satellites.tle` with the last-update hash in `last_update.txt`. The backend periodically (hourly) refreshes the cache via `refresh_loop()` or the `scripts/download_tles.py` helper that manually runs the `fetch_tles_spacetrack()` path. When the cache is missing, we fall back to the bundled `_SIMULATED_TLE_TEXT` of seven legacy satellites.
- **Parsing helpers**: `_parse_tle_text()` trims empty lines, normalizes names (drops leading `0 ` from Space-Track-style names), and records `(name, line1, line2)` tuples. `fetch_tles_local()` exposes the first `limit` entries, while `fetch_tles_with_source()` returns the payload plus a string like `"local"` or `"simulation"` so the API can annotate its metadata.
- **Threaded refresh**: `start_refresh_thread()` spawns a daemon that re-fetches the catalog every `3600` seconds. It guards concurrent refreshes with `_REFRESH_LOCK` and prints status so you can tail the logs. The whole system is ready for cron or manual runs—`scripts/download_tles.py` can be added to a scheduler to write a fresh `satellites.tle` using the same logic.

## 3. FastAPI endpoints and metadata

- **`/satellites`** (`backend/app/routes/satellites.py`):
  - Reads 500 TLEs from the local cache, propagates each via SGP4/`tle_to_position()`, converts to lat/lon/alt, then returns the list with metadata (`count`, `errors`, `timestamp`). Altitudes use the same validation guard as the simulation, so malformed entries never leak into the public feed.
- **`/simulate`** (`backend/app/routes/simulate.py`):
  - Calls `fetch_tles_with_source(limit=500)` to get the public slice (or simulation fallback).
  - Builds `valid_sats` by keeping only propagated objects whose altitude passes the `100–50 000 km` gate.
  - Generates N-choose-2 pairs using `itertools.combinations`, calculates distances with `distance_km`, and classifies them through the (very simple) ML risk engine.
  - `classify_conjunction()` (history) returns a risk level and score based on the current separation; `recommend_maneuver()` suggests a delta-v; the middleware builds the after-state risk as well.
  - The `closest_pairs` list keeps the 20 smallest distances, while `meta` contains `satellites`, `public_objects`, `pairs_checked`, `processing_ms`, `tle_records`, and `tle_source`. Clients display `meta` to show how much of the cache is modeled.
  - Satellite positions are recomputed for the detail view so the `/simulate` response includes a clean `satellites` array with names, lat/lon/alt values.
- **`/tracker/positions`** (`backend/app/routes/tracker.py`):
  - Reuses the TLE cache (limit 500 entries) and returns each object’s NORAD ID, position, timestamp, and a `raw` sub-object with the original lines. Downstream consumers use the NORAD ID to look up metadata from `frontend/src/data/satellites.js`.
  - This endpoint powers the Tracker page, which refreshes it every 30–60 seconds depending on the component.
- **`/health`**: FastAPI’s default health check tells you whether the backend is alive. The docs page encourages calling it first before hitting data endpoints.

## 4. Risk/AI logic

- **Risk engine**: The very small `ml_logic/risk_engine.py` currently considers only the separation distance:
  - < 2 km → `HIGH` (score ~80)
  - 2–5 km → `MEDIUM`
  - > 5 km → `LOW`
- **Pair ranking**: The dashboard’s `RiskPanel` resorts the list by risk level (CRITICAL, HIGH, MEDIUM, LOW) and distance, auto-advancing every 5 s through a carousel that exposes the highest-priority conjunction first. Clicking the panel opens `/conjunction/:id`, where the details are rendered with metadata from `SAT_DB`.
- **Maneuver placeholder**: `recommend_maneuver()` (stubbed) simply returns a text string showing how you might raise separation. The UI surfaces it when the backend includes `maneuver` text.

## 5. Frontend architecture

### 5.1 App shell and polling

- `frontend/src/App.jsx` is the root shell. It keeps a `theme` state on `document.documentElement` (`data-theme="dark"` or `light`) and uses `localStorage`. It also wraps the routes in `AuthProvider` and `BrowserRouter`.
- `fetchSimulation()` in `frontend/src/api/backend.js` hits `${VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space"}/simulate` with `cache: "no-store"`, so you can override the URL for local testing. A `useEffect` in `AppShell` polls `/simulate` every 60 s and keeps a `hasLoadedSimulationRef` to avoid flicker on route changes.

### 5.2 Dashboard + stats

- `Dashboard.jsx` reads `data.meta` to show:
  - `TLE records` (from `meta.tle_records`)
  - `Public objects` (either `meta.public_objects` or `meta.satellites`)
  - `Pairs screened` and `Processing time`
  - `mode` + `tle_source` for the stat subtext
- `RiskPanel.jsx` is the animated danger card. It:
  - Sorts pairs by risk level/distance and auto-rotates with a timer
  - Renders a glow background (`rp-glow-blob`), progress line, and gradient badges whose colours are derived from `RISK_COLORS`
  - Tracks clicks to `/conjunction/:id` with the pair data in location state
- `SimulationContext.jsx` renders a faux terminal that consumes the same `data.meta` values the backend already provides. It presents sections like `SYSTEM`, `THIS RUN`, and `CLOCK`, with ANSI-style dots and a blinking cursor.
- `SatelliteTable.jsx` lists the 20 closest pairs, colours them by risk, and shows before/after distances plus the manoeuvre string. Colours tap into inline CSS variables such as `--row-accent`.
- `SatelliteTable` and `RiskPanel` share CSS in `frontend/src/index.css` around line 80 onwards—glows, neon text, and card borders rely on gradients and `background: rgba(...)` to create a terminal-like hero.

### 5.3 Satellite and conjunction pages

- `Satellites.jsx` renders a registry grid of every entry in `frontend/src/data/satellites.js`. Each card:
  - Mirrors the risk status (critical/high/nominal) computed by scanning `data.closest_pairs`
  - Animates the card entrance with `--card-delay` to create a staggered layout
  - Includes international metadata (country, orbit, purpose) and toggles expanded details when clicked
- `ConjunctionDetail.jsx` reads location state but refetches `/simulate` if needed. It:
  - Displays the before/after risk boxes with risk chips and distances
  - Shows satellite metadata from `SAT_DB` (country, purpose, description) and the latest SGP4 lat/lon/alt
  - Has a “View in Tracker” link to jump to `/tracker`

### 5.4 API page and key management

- `ApiPage.jsx` is the product portal:
  - Supabase-backed API keys (via `supabase.js` and `AuthContext`). Users can generate, regenerate, revoke, or copy keys.
  - Guest keys: generated by `mkKey()` and stored in `localStorage` when the user choose “Continue without account”. Warnings protect browser-only storage.
  - Premium announcement component (blue box) that advertises the $10 paid tier with cards for objects/polling; the hero references the 500-object public slice and the 34 000+ cached TLE catalog.
  - Code samples injected from `LANG_CODE` strings with live keys (`heroPreviewKey`) and `Copy` buttons.
  - Endpoint cards summarizing `/health`, `/satellites`, `/simulate`, `/tracker/positions`, and a link to Swagger at `${BASE}/docs`.
  - Rate limit cards highlight the 500 public objects, 34 k cached records, and 5 s announced polling limit.

### 5.5 Docs page

- `Docs.jsx` rebuilds the OpenAPI reference. It has:
  - A sticky sidebar with smooth scrolling
  - Reusable `Code` component (`.docs-code-wrap`) for HTTP/bash/json snippets; copies to clipboard and shows “Copied”
  - Section headings, tables, and endpoint cards that mirror actual FastAPI responses (CRITICAL exposures, meta fields, etc.)
  - Light/dark theme compatibility: we added `[data-theme="light"]` overrides in `index.css` (lines ~3760) to keep code blocks, tables, and endpoint cards legible by swapping backgrounds, borders, text colours, and highlights.

### 5.6 Tracker experiences

- `TrackerPage.jsx` and `SatelliteTracker.jsx` provide two views:
  - `TrackerPage` is a standalone route with an SVG world map, equity landmasses, lat/lon grid, equator/polar circle lines, and an interactive legend.
  - It polls `/tracker/positions` every 60 s, merges the backend positions with `SAT_DB`, and renders:
    - Animated ground tracks computed by OOTK (`new Satellite(...).lla(t)`)
    - Custom `WorldMapBg` polygons (manual land-mass coordinates)
    - SVG circles that glow and reveal satellite names on hover/selection
    - A floating info card with lat/lon/alt/az/el/orbit/NORAD data, plus a spinner/refresh button.
  - `SatelliteTracker` (a smaller component used on the dashboard) reuses the same API but refreshes every 30 s and renders a simplified hover card plus a grid of mini cards with roster stats.
  - Both tracker views keep a `positions` array, handle errors (`positions.error`), and show `lastUpdate` timestamps.

### 5.7 Animations and styling patterns

- `SatelliteBackground.jsx` generates 180 random `star` divs and 5 `satellite-streak` divs. Each star uses inline `twinkle` animation with randomized duration/delay; the streaks animate across the screen while CSS `@keyframes twinkle` toggles opacity and scale.
- `Navbar.jsx` animates the brand letters sequentially using `animationDelay` and toggles the theme via two SVG icons (sun/moon). The mobile menu uses a hamburger button with `open` CSS class.
- Many cards rely on gradients and neon glow (see `.rp-glow-blob`, `.ap-hero`, `.tracker-pill`). The CSS defines color variables (`--accent`, `--text-bright`, `--green`, `--red`) that themes switch via `[data-theme="light"]` overrides near line 60 of `index.css`.
- The `RiskPanel` progress line uses CSS custom properties (`--rp-rgb`) to tune the glow; `SimulationContext` uses a terminal-style palette with a blinking cursor.
- `TrackerPage` and `SatelliteTracker` use `SVG` filters (`feGaussianBlur`, `feMerge`) to add halo glows, while hero sections drop `radial-gradient`s for ambient lighting.

## 6. Scripts, tooling, and env

- **Backend**:
  - Install dependencies inside `backend/.venv` with `pip install -r backend/requirements.txt`.
  - Run the server: `cd backend && uvicorn app.main:app --reload --port 8000`.
  - The backend expects `SPACETRACK_EMAIL` and `SPACETRACK_PASSWORD` in `.env` for future authenticated downloads; the `.env.example` mirrors these placeholders so the `scripts/download_tles.py` helper can log in manually if you connect it to Space-Track (currently the main fetcher uses KeepTrack).
  - The `scripts/download_tles.py` script loads `app.services.tle_fetcher.fetch_tles_spacetrack`, writes the refreshed `satellites.tle`, and prints the number of records. Drop it into a cron job or GitHub Action to keep the cache current.
  - If you want workstation-specific secrets, store them in `.env.local` (same folder). The backend load order prioritizes `.env.local`, so place your Supabase project URL, anon key, and Space-Track credentials there before copying into `.env` for deployment.

- **Frontend**:
  - Install `npm install` in `frontend`.
  - Use `npm run dev` to run Vite with HMR; `npm run build` creates production assets (`vite build` warns about large chunks but succeeds).
  - Environment picks:
    - `VITE_API_URL` (default: `https://virenn77-spacedebrisai.hf.space`) to target a different backend.
    - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required for the API key management experience; without them the page falls back to “Supabase not configured”.
  - The `/api` route stores guest keys in `localStorage` keys `sdai_guest_api_key` and `sdai_guest_email`, while the Supabase user flow keeps the profile key persistent.

## 7. Building the experience from scratch

1. Populate the backend cache: run `scripts/download_tles.py` or let the refresh thread pull KeepTrack once the backend starts. A full download gives you 34 368 TLEs (currently the number in `satellites.tle`).
2. Start the backend (you can run `python -m uvicorn app.main:app --reload` inside `backend`).
3. Run `npm run dev` inside the `frontend` folder. Set `VITE_API_URL=http://127.0.0.1:8000` when starting Vite if you want the frontend to hit the local backend. Toggle the theme via the button in the navbar.
4. On the frontend, visit `/` for the dashboard, `/satellites` for the registry, `/tracker` for the tracker page, `/api` for the key portal, `/docs` for Swagger-style reference, `/login` for authentication, and `/about` for the project story. All of them pull from the shared `/simulate` data.

## 8. Extensions and notes

- The `SAT_DB` metadata (500 entries) sits in `frontend/src/data/satellites.js`. Keep it updated with new constellations and NORAD IDs as the backend TLE catalog grows.
- When you want to add a new animation or page:
  - Build a React component with the desired logic (use `useMemo` for random arrays, `useEffect` for polling).
  - Style it in `frontend/src/index.css` using existing utility classes (`.db-hero`, `.ap-section`, `.tracker-section`, etc.).
  - Tie it to a route in `App.jsx`, and add a nav link in `Navbar.jsx`.
- You can enhance the risk engine by replacing `ml_logic/risk_engine.py` with a proper classifier, or plug in `ml_logic/avoidance.py` for delta-v estimation.
- For production, host the backend (FastAPI + Uvicorn) behind a reverse proxy, and point the frontend `VITE_API_URL` to that host. Use `npm run build` to create static assets and serve them via Vercel/Netlify or Docker.

This document should keep evolving as you tune the physics, add premium tiers, or ship new UI flows. Read the relevant file references when you follow along, and keep the theme consistent by reusing the CSS variables.
