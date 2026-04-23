import os
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.services.login_log import (
    get_login_logs,
    get_login_logs_by_ip,
    get_login_logs_by_email,
    get_failed_login_count,
    log_login_attempt,
)

router = APIRouter()

ADMIN_KEY = os.getenv("USAGE_ADMIN_KEY")


def _require_admin(request: Request) -> None:
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail="Usage admin key not configured")
    provided = request.headers.get("X-Admin-Key")
    if provided != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")


class LoginAttemptRequest(BaseModel):
    email: str
    success: bool
    failure_reason: str | None = None


@router.post("/admin/login-attempt")
def record_login_attempt(request: Request, payload: LoginAttemptRequest):
    """Record a login attempt (called from frontend after every login attempt)."""
    log_login_attempt(
        email=payload.email,
        request=request,
        success=payload.success,
        failure_reason=payload.failure_reason,
    )
    return {"status": "ok"}


@router.get("/admin/login-logs")
def fetch_login_logs(
    request: Request,
    limit: int = Query(default=100, le=500),
    ip: str | None = None,
    email: str | None = None,
):
    """Fetch login attempt logs."""
    _require_admin(request)

    if ip:
        return {"logs": get_login_logs_by_ip(ip, limit)}
    if email:
        return {"logs": get_login_logs_by_email(email, limit)}
    return {"logs": get_login_logs(limit)}


@router.get("/admin/login-logs/stats")
def login_log_stats(request: Request):
    """Get login log statistics."""
    _require_admin(request)
    return {
        "failed_last_15min": get_failed_login_count(15),
        "failed_last_60min": get_failed_login_count(60),
    }
