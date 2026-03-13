import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.services.tle_fetcher import refresh_all_caches, start_background_refresh


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        refresh_all_caches(force=True)
    except Exception as exc:
        print(f"TLE startup refresh failed; continuing with local cache: {exc}")
    start_background_refresh()
    yield


app = FastAPI(lifespan=lifespan)

_extra = os.getenv("ALLOWED_ORIGIN", "")
_origins = [
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

from app.routes.simulate import router as simulate_router
from app.routes.health import router as health_router
from app.routes.tracker import router as tracker_router
from app.routes.satellites import router as satellites_router
from app.routes.usage import router as usage_router

app.include_router(simulate_router)
app.include_router(health_router)
app.include_router(tracker_router)
app.include_router(satellites_router)
app.include_router(usage_router)
from app.routes.cdm import router as cdm_router
app.include_router(cdm_router)
