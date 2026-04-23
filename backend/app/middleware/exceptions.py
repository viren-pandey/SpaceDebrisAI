import traceback
import os
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


DEBUG = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")


async def exception_logging_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        path = request.url.path
        tb = traceback.format_exc()
        print(f"[ERROR] {path}\n{tb}")
        if DEBUG:
            return JSONResponse(
                status_code=500,
                content={
                    "detail": str(exc),
                    "error_type": type(exc).__name__,
                    "path": path,
                    "traceback": tb.split("\n"),
                },
            )
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error_type": type(exc).__name__,
                "path": path,
            },
        )


def add_exception_logging(app):
    app.add_middleware(BaseHTTPMiddleware, dispatch=exception_logging_middleware)
