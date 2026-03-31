import os
import sys

os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.services.tle_fetcher import start_background_refresh
from app.services.usage_metrics import RateLimitMiddleware

@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_background_refresh()
    yield

app = FastAPI(lifespan=lifespan, title="SpaceDebrisAI API")

_allowed_origins = [
    "https://spacedebrisai.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
from app.routes.cdm import router as cdm_router

app.include_router(simulate_router)
app.include_router(health_router)
app.include_router(tracker_router)
app.include_router(satellites_router)
app.include_router(usage_router)
app.include_router(api_keys_router)
app.include_router(risk_router)
app.include_router(cascade_router)
app.include_router(cdm_router)
