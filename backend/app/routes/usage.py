import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.usage_metrics import (
    ban_identifier,
    ban_ip,
    get_active_polls,
    get_congestion_stats,
    get_usage_snapshot,
    identifiers_by_email,
    start_polling,
    stop_polling,
    unban_identifier,
    unban_ip,
)

router = APIRouter()

ADMIN_KEY = os.getenv("USAGE_ADMIN_KEY")


def _require_admin(request: Request) -> None:
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail="Usage admin key not configured")
    provided = request.headers.get("X-Admin-Key")
    if provided != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")


class UsageBanRequest(BaseModel):
    identifier: str | None = None
    email: str | None = None
    ip: str | None = None
    reason: str | None = None


@router.get("/usage")
def usage_report(request: Request):
    """Expose in-memory usage statistics for the deployed API."""
    _require_admin(request)
    return get_usage_snapshot()


@router.post("/usage/revoke")
def revoke_usage(request: Request, payload: UsageBanRequest):
    _require_admin(request)
    revoked = []
    if payload.identifier:
        ban_identifier(payload.identifier, payload.reason)
        revoked.append({"type": "identifier", "value": payload.identifier})
    if payload.ip:
        ban_ip(payload.ip, payload.reason)
        revoked.append({"type": "ip", "value": payload.ip})
    if payload.email:
        matches = identifiers_by_email(payload.email)
        for ident in matches:
            ban_identifier(ident, payload.reason or f"email {payload.email} revoked")
            revoked.append({"type": "identifier", "value": ident})
    if not revoked:
        raise HTTPException(status_code=400, detail="Provide identifier, email, or IP to revoke")
    return {"status": "ok", "revoked": revoked}


@router.post("/usage/unban")
def unban_usage(request: Request, payload: UsageBanRequest):
    _require_admin(request)
    unbanned = []
    if payload.identifier:
        unban_identifier(payload.identifier)
        unbanned.append({"type": "identifier", "value": payload.identifier})
    if payload.ip:
        unban_ip(payload.ip)
        unbanned.append({"type": "ip", "value": payload.ip})
    if not unbanned:
        raise HTTPException(status_code=400, detail="Provide identifier or IP to unblock")
    return {"status": "ok", "unbanned": unbanned}


@router.get("/usage/polls")
def get_polls(request: Request):
    """Get active polling requests."""
    _require_admin(request)
    return {"polls": get_active_polls()}


@router.get("/usage/congestion")
def get_congestion(request: Request):
    """Get congestion statistics."""
    _require_admin(request)
    return get_congestion_stats()
