---
title: SpaceDebrisAI
emoji: 🛰️
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

<div align="center">

<img src="https://private-user-images.githubusercontent.com/128834400/559700741-ae450fc3-6eb3-47ee-8003-b7746dadf420.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzI4ODU2MDEsIm5iZiI6MTc3Mjg4NTMwMSwicGF0aCI6Ii8xMjg4MzQ0MDAvNTU5NzAwNzQxLWFlNDUwZmMzLTZlYjMtNDdlZS04MDAzLWI3NzQ2ZGFkZjQyMC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwMzA3JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDMwN1QxMjA4MjFaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT03MDJkZjM0MTU2ODdmOTY3ZjdhOWU4YzBhMTMzZmEwYTc5MjkyMmNiODBjYzg2YzFiMzc4ZmZjZGIxOWYwMjg0JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.RsmD4sEzlD3VqhVldx5xiV_wQMlmCbdif72VsErCm-g" width="50%" alt="SpaceDebrisAI — Orbital Collision Monitor"/>

<br/>

# 🛰️ SpaceDebrisAI

### Real-time Satellite Conjunction Monitoring & Collision Risk Assessment

<br/>

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-spacedebrisai.vercel.app-00f5c4?style=for-the-badge)](https://spacedebrisai.vercel.app/)
[![API](https://img.shields.io/badge/API-HuggingFace%20Spaces-FF9D00?style=for-the-badge&logo=huggingface&logoColor=white)](https://virenn77-spacedebrisai.hf.space/simulate)

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)

<br/>

> Built solo for a hackathon .
> Couldn't attend in person — so I went home and built it anyway.

</div>

---

## 🌍 What Is This?

There are **27,000+ tracked objects** orbiting Earth at 28,000 km/h right now — dead satellites, old rocket stages, debris from past collisions. When any two come dangerously close, it's called a **conjunction**. At orbital velocity, a single bolt hitting a satellite delivers the energy of a hand grenade.

**SpaceDebrisAI** simulates the exact pipeline that NASA, ESA, and SpaceX run every single day:

| Step | What happens |
|---|---|
| 1 | Fetch live TLE data from CelesTrak |
| 2 | Propagate positions using real SGP4 orbital physics |
| 3 | Screen every satellite pair for proximity (19,900 pairs for 200 sats) |
| 4 | Classify collision risk: `LOW` → `MEDIUM` → `HIGH` → `CRITICAL` |
| 5 | Recommend the exact avoidance maneuver needed |
| 6 | Show everything on a live real-time dashboard |

---

## 📸 Screenshots

<table>
<tr>
<td width="50%" valign="top">

### Risk Panel

<img src="https://private-user-images.githubusercontent.com/128834400/559700737-e3b5ce50-9d3b-4095-9988-483d9988d42f.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzI4ODU2MDEsIm5iZiI6MTc3Mjg4NTMwMSwicGF0aCI6Ii8xMjg4MzQ0MDAvNTU5NzAwNzM3LWUzYjVjZTUwLTlkM2ItNDA5NS05OTg4LTQ4M2Q5OTg4ZDQyZi5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwMzA3JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDMwN1QxMjA4MjFaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT00MmQxNjcxODc3YjQxNzUwZDE0NjJmNjI0NGZjODMxM2Q5NzBiOTk3MjNmODZmNTEzMTY4OTdjY2I1NDg2ZTI5JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.G9cTRkKD9n0vUQnBsyMk9uerBFm4Ggp_sFMH1_lgwFE" width="100%" alt="Dashboard Risk Panel"/>

Hero card cycles through all detected conjunctions — auto-advances every 5s sorted by risk. Shows current separation, post-maneuver separation, and recommended action side by side.

</td>
<td width="50%" valign="top">

### Satellite Registry

<img src="https://private-user-images.githubusercontent.com/128834400/559700741-ae450fc3-6eb3-47ee-8003-b7746dadf420.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzI4ODU2MDEsIm5iZiI6MTc3Mjg4NTMwMSwicGF0aCI6Ii8xMjg4MzQ0MDAvNTU5NzAwNzQxLWFlNDUwZmMzLTZlYjMtNDdlZS04MDAzLWI3NzQ2ZGFkZjQyMC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwMzA3JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDMwN1QxMjA4MjFaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT03MDJkZjM0MTU2ODdmOTY3ZjdhOWU4YzBhMTMzZmEwYTc5MjkyMmNiODBjYzg2YzFiMzc4ZmZjZGIxOWYwMjg0JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.RsmD4sEzlD3VqhVldx5xiV_wQMlmCbdif72VsErCm-g" width="100%" alt="Satellites Page"/>

200 satellites tracked in one run — 19,900 pairs screened, 2 CRITICAL and 2 HIGH flagged. Full registry with ISRO missions highlighted.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Live Tracker

<img src="https://private-user-images.githubusercontent.com/128834400/559700738-c4b618ff-b3c3-4fd3-814b-3efb876eb268.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzI4ODU2MDEsIm5iZiI6MTc3Mjg4NTMwMSwicGF0aCI6Ii8xMjg4MzQ0MDAvNTU5NzAwNzM4LWM0YjYxOGZmLWIzYzMtNGZkMy04MTRiLTNlZmI4NzZlYjI2OC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwMzA3JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDMwN1QxMjA4MjFaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT01NTk0MmM5MTM5YTc1MDhjNmQ5MjI2NmI2YzUwNzQyZTk1Njk1YWVkZGNiMzdmYWIwOTMyZmUyMWMyYWRkNGUyJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.esBdMlj2Zj9gok8TRLRMalXHAueuIQB6Em6nceDkvdY"  height = "100%" width="100%" alt="Live Satellite Tracker"/>

Real-time orbital positions via KeepTrack API + OOTK. 163 satellites live-plotted on a world map from live TLE data.

</td>
<td width="50%" valign="top">

### Live API

<img src="https://private-user-images.githubusercontent.com/128834400/559700740-f4afce43-c36b-4210-92d5-077ed439b044.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzI4ODU2MDEsIm5iZiI6MTc3Mjg4NTMwMSwicGF0aCI6Ii8xMjg4MzQ0MDAvNTU5NzAwNzQwLWY0YWZjZTQzLWMzNmItNDIxMC05MmQ1LTA3N2VkNDM5YjA0NC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYwMzA3JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MDMwN1QxMjA4MjFaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT02YWE4MjFjYTdjYjBmNGZhNDNlYmE0YTc5ZTM1MWY0NTU0OTVkZmIyZjRjZGRjNjNiMGQyOTk3YmUyMDdmMjljJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.utgd4vzFq8iVjEZ5Yfvu6WKtcWEpIJT6IRWa_L-1zmM" width="100%" alt="Live API Response"/>

Raw `/simulate` response. GSAT-15 ↔ EOS-03 at 2.26 km (HIGH, score 72). STUDSAT-2B ↔ ANAND at 2.82 km (CRITICAL, score 90).

</td>
</tr>
</table>

---

## 🧠 How It Works

### Orbital Propagation

Each satellite's position is calculated from a **TLE (Two-Line Element set)** — the standard compact format for orbital data, updated multiple times per day. The `sgp4` Python library propagates each TLE to the current timestamp, outputting a precise 3D position vector.

Position is then converted through:
```
TEME (inertial frame)  →  ECEF (Earth-fixed)  →  Geodetic (lat / lon / alt)
```
Using GMST rotation + Bowring's iterative algorithm on the WGS-84 ellipsoid — the same model GPS uses.

### Risk Classification

```
Distance       Base Score     Altitude Factor              Final Level
────────────────────────────────────────────────────────────────────────
< 2 km     →   80             LEO  (< 500 km)   × 1.20    CRITICAL  ≥ 85
2 – 5 km   →   50             MEO  (< 2000 km)  × 1.00    HIGH      ≥ 60
> 5 km     →   10             GEO  (> 2000 km)  × 0.80    MEDIUM    ≥ 30
                                                           LOW       < 30
```

LEO gets a 1.2× penalty — it's the most congested orbital band with the highest debris density and fastest relative velocities (~15 km/s).

### Avoidance Maneuvers

| Risk Level | Recommended Action |
|---|---|
| 🔴 CRITICAL | Altitude boost **+25 km** — execute within 3 orbits |
| 🟠 HIGH | Altitude boost **+15 km** |
| 🟡 MEDIUM | Altitude boost **+8 km** |
| 🟢 LOW | No action required |

Post-maneuver separation is re-classified automatically to confirm the fix works — dashboard shows before **and** after.

---

## 🏗️ Architecture

```
Browser  (React 19 SPA)
    │
    │  GET /simulate   ← one request, full payload on page load
    ▼
FastAPI Backend  (port 8000)
    ├── /simulate         main conjunction pipeline
    ├── /satellites        all tracked satellite positions
    ├── /tracker/positions world map data
    └── /health
    │
    ├── Tier 1: CelesTrak GP live feed   (real TLEs)
    ├── Tier 2: Local .tle file          (cached fallback)
    └── Tier 3: 20 simulated satellites  (always works)
    │
    ▼
SGP4 Propagator  →  TEME → ECEF → Geodetic
    ▼
ML Risk Engine   →  classifier.py  +  avoidance.py
    ▼
JSON  →  React renders dashboard
```

`mode: "real"` | `"local"` | `"simulated"` in every response tells you which tier ran.

---

## 🔌 API Reference

**Live base URL:** `https://virenn77-spacedebrisai.hf.space`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/simulate` | Full pipeline — positions, risk levels, maneuvers |
| `GET` | `/satellites` | All tracked satellite positions |
| `GET` | `/tracker/positions` | World map position data |
| `GET` | `/health` | Liveness check |
| `GET` | `/docs` | Interactive Swagger UI |

<details>
<summary><b>📄 Example <code>GET /simulate</code> response</b></summary>

```json
{
  "mode": "real",
  "timestamp_utc": "2026-03-07T11:42:30Z",
  "meta": {
    "satellites": 200,
    "pairs_checked": 19900,
    "processing_ms": 144.2
  },
  "closest_pairs": [
    {
      "satellites": ["STUDSAT-2B", "ANAND (PIXXEL-1)"],
      "before": {
        "distance_km": 2.82,
        "risk": {
          "level": "CRITICAL",
          "score": 90,
          "message": "Imminent collision risk. Emergency maneuver required immediately.",
          "altitude_factor": 1.2
        }
      },
      "after": {
        "distance_km": 27.82,
        "risk": { "level": "LOW", "score": 12 }
      },
      "maneuver": "Altitude boost +25 km — execute within 3 orbits"
    },
    {
      "satellites": ["GSAT-15", "EOS-03 (GISAT-1)"],
      "before": {
        "distance_km": 2.26,
        "risk": {
          "level": "HIGH",
          "score": 72,
          "message": "Critical proximity detected. Immediate maneuver recommended.",
          "altitude_factor": 0.8
        }
      },
      "after": {
        "distance_km": 17.26,
        "risk": { "level": "MEDIUM", "score": 40 }
      },
      "maneuver": "Altitude boost +15 km — execute within 3 orbits"
    }
  ]
}
```

</details>

---

## 🚀 Running Locally

### Docker (recommended)

```bash
git clone https://github.com/viren-pandey/SpaceDebrisAI.git
cd SpaceDebrisAI
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |

### Manual Setup

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend  (new terminal)
cd frontend
npm install && npm run dev
```

---

## 📁 Project Structure

```
SpaceDebrisAI/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI + CORS
│   │   ├── routes/          # simulate, satellites, tracker, health
│   │   └── services/        # SGP4 propagator, TLE fetcher
│   └── ml_logic/            # risk_engine, classifier, avoidance
├── frontend/
│   └── src/
│       ├── App.jsx           # theme + data fetch + routing
│       ├── components/       # Navbar, RiskPanel, SatelliteTable, Stars
│       ├── pages/            # Dashboard, Satellites, Tracker, About
│       └── index.css         # all styles (~3100 lines, pure CSS)
├── docs/screenshots/         # README images
├── docker-compose.yml
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.11 · FastAPI · uvicorn |
| Orbital Physics | `sgp4` Python library (NORAD standard) |
| TLE Data | CelesTrak GP live feed |
| Frontend | React 19 · Vite 7 · React Router v6 |
| Styling | Pure CSS · CSS custom properties (~3100 lines, no Tailwind) |
| Live Tracker | KeepTrack API · OOTK (Orbital Object Toolkit) |
| Frontend Deploy | Vercel |
| Backend Deploy | HuggingFace Spaces |
| Containerization | Docker · docker-compose |

---

## 📖 Background

Built solo for a **hackathon on 7th February 2026**. I couldn't attend in person — so I built it at home and shipped it anyway.

The problem is real. Conjunction screening like this runs 24/7 at NASA, ESA, and SpaceX. The ISS performs an avoidance maneuver roughly once a year. One unchecked collision can trigger Kessler Syndrome — a debris cascade that makes entire orbital shells permanently unusable for generations.

SpaceDebrisAI replicates that pipeline end-to-end: real orbital physics, live satellite data, ML risk classification, and a production-grade full-stack application.

---

## 🤝 Contributing

Pull requests welcome. Open an issue first for major changes.

```bash
git checkout -b feature/your-feature
git commit -m "Add your feature"
git push origin feature/your-feature
# → Open a pull request
```

---

<div align="center">

**[spacedebrisai.vercel.app](https://spacedebrisai.vercel.app/)** &nbsp;·&nbsp; Built by [Viren Pandey](https://github.com/viren-pandey)

*"The sky is not falling. But parts of it are."* 🛰️

</div>
