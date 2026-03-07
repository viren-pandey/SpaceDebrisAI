---
title: Space Debris Collision AI
emoji: 🛸
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# Space Debris Collision AI — Backend API

FastAPI backend for real-time space debris collision risk analysis and maneuver recommendations.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/simulate` | Run conjunction simulation |
| GET | `/satellites` | List tracked satellites |
| GET | `/tracker` | Real-time satellite positions |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ALLOWED_ORIGIN` | Comma-separated list of allowed CORS origins (e.g. your frontend URL) |
