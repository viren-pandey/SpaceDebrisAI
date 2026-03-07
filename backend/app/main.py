from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes.simulate import router as simulate_router
from app.routes.health import router as health_router
from app.routes.tracker import router as tracker_router
from app.routes.satellites import router as satellites_router

app.include_router(simulate_router)
app.include_router(health_router)
app.include_router(tracker_router)
app.include_router(satellites_router)
