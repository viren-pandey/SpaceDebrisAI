import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware.exceptions import add_exception_logging
from app.services.tle_fetcher import start_background_refresh
from app.services.usage_metrics import RateLimitMiddleware


def _startup_diagnostics():
    print("=== STARTUP DIAGNOSTICS ===")
    env_vars = ["KEEPTRACK_API_KEY", "SPACETRACK_EMAIL", "SPACETRACK_PASSWORD", "DEBUG", "SIMULATION_PUBLIC_OBJECT_LIMIT"]
    for var in env_vars:
        print(f"  ENV {var}: {'SET' if os.getenv(var) else 'NOT SET'}")

    data_dir = Path(__file__).resolve().parent.parent / "data"
    print(f"  DATA_DIR: {data_dir} (exists={data_dir.exists()})")
    for fname in ["satellites.tle", "debris_leo.tle", "debris_all.tle", "cdm_cache.json"]:
        fpath = data_dir / fname
        print(f"  {fname}: exists={fpath.exists()}, size={fpath.stat().st_size if fpath.exists() else 0}")

    try:
        from app.services.odri import compute_odri
        print("  ODRI module: OK")
    except Exception as exc:
        print(f"  ODRI module: FAIL ({exc})")

    try:
        from sgp4.api import Satrec
        print("  SGP4 library: OK")
    except Exception as exc:
        print(f"  SGP4 library: FAIL ({exc})")
    print("=== END DIAGNOSTICS ===")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.database import engine, Base
    Base.metadata.create_all(bind=engine)
    print("Database tables created/verified")
    _startup_diagnostics()
    start_background_refresh()
    threading.Thread(target=_warm_simulation_cache, daemon=True).start()
    yield


def _warm_simulation_cache():
    try:
        from app.routes.simulate import _get_cached_simulation
        _get_cached_simulation()
        print("Simulation cache warmed successfully")
    except Exception as exc:
        print(f"Warning: Could not warm simulation cache: {exc}")


app = FastAPI(lifespan=lifespan)
add_exception_logging(app)

_extra = os.getenv("ALLOWED_ORIGIN", "")
_origins = [
    "https://spacedebrisai.vercel.app",
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174",
    "http://localhost:5175", "http://127.0.0.1:5175",
    "http://localhost:5176", "http://127.0.0.1:5176",
    "http://localhost:3000", "http://localhost:4173",
    "http://localhost:5177", "http://127.0.0.1:5177",
    "http://localhost:5178", "http://127.0.0.1:5178",
    "http://localhost:5179", "http://127.0.0.1:5179",
    "http://localhost:5180", "http://127.0.0.1:5180",
]
if _extra:
    _origins.extend(o.strip() for o in _extra.split(",") if o.strip())

app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RateLimitMiddleware)


@app.get("/healthz")
def healthz():
    return {"ok": True}


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
from app.routes.login_logs import router as login_logs_router
from app.routes.user import router as user_router
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router

app.include_router(cdm_router)
app.include_router(login_logs_router)
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(auth_router)
