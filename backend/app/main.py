import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.tle_fetcher import start_background_refresh
from app.services.usage_metrics import RateLimitMiddleware


def _warm_simulation_cache():
    """Pre-warm the simulation cache on startup."""
    try:
        from app.routes.simulate import _get_cached_simulation
        _get_cached_simulation()
        print("Simulation cache warmed successfully")
    except Exception as exc:
        print(f"Warning: Could not warm simulation cache: {exc}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Do not block app startup on remote TLE refresh. HF Spaces can return 503
    # if lifespan work stalls or remote catalog fetches are degraded.
    start_background_refresh()
    
    # Warm simulation cache in background (don't block startup)
    threading.Thread(target=_warm_simulation_cache, daemon=True).start()
    yield


app = FastAPI(lifespan=lifespan)

_extra = os.getenv("ALLOWED_ORIGIN", "")
_origins = [
    "*",
    "https://spacedebrisai.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
    "http://localhost:3000",
    "http://localhost:4173",
]
if _extra:
    _origins.extend(o.strip() for o in _extra.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

from app.routes.simulate import router as simulate_router
from app.routes.health import router as health_router
from app.routes.tracker import router as tracker_router
from app.routes.satellites import router as satellites_router
from app.routes.usage import router as usage_router
from app.routes.api_keys import router as api_keys_router
from app.routes.risk import router as risk_router
from app.routes.cascade import router as cascade_router
from app.routes.shell import router as shell_router
from app.routes.spaceweather import router as spaceweather_router

app.include_router(simulate_router)
app.include_router(health_router)
app.include_router(tracker_router)
app.include_router(satellites_router)
app.include_router(usage_router)
app.include_router(api_keys_router)
app.include_router(risk_router)
app.include_router(cascade_router)
app.include_router(shell_router)
app.include_router(spaceweather_router)

from app.routes.cdm import router as cdm_router
app.include_router(cdm_router)
