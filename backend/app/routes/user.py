from fastapi import APIRouter, HTTPException, Request, Response, Cookie
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from app.auth import decode_token, hash_password
from app.database import get_db
from app.models import User, ApiKey, ContactRequest
import secrets

router = APIRouter(prefix="/user", tags=["user"])

def get_current_user(token: str = None) -> User:
    if not token:
        raise HTTPException(401, {"error": "Authentication required"})
    email = decode_token(token)
    if not email:
        raise HTTPException(401, {"error": "Invalid token"})
    db = next(get_db())
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, {"error": "User not found"})
    if user.is_banned:
        raise HTTPException(403, {"error": "Account banned"})
    return user

@router.get("/poll-usage")
def poll_usage(request: Request):
    token = request.cookies.get("token") or request.headers.get("X-Token")
    user = get_current_user(token)
    return {
        "polls_used_today": user.polls_today or 0,
        "daily_poll_limit": user.daily_poll_limit or 10000,
        "reset_in_seconds": 86400
    }

@router.get("/me")
def get_me(request: Request):
    token = request.cookies.get("token") or request.headers.get("X-Token")
    user = get_current_user(token)
    return {"id": user.id, "email": user.email, "name": user.name or "", "daily_poll_limit": user.daily_poll_limit, "created_at": user.created_at}

@router.get("/usage/history")
def usage_history(request: Request):
    return [{"date": date.today().isoformat(), "polls": 0}]

@router.get("/api-keys")
def get_api_keys(request: Request):
    token = request.cookies.get("token") or request.headers.get("X-Token")
    user = get_current_user(token)
    db = next(get_db())
    keys = db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.is_active == True).all()
    return [{"id": k.id, "label": k.label, "key_prefix": k.key_prefix, "key_suffix": "****", "created_at": k.created_at, "last_used": k.last_used, "is_active": k.is_active} for k in keys]

class CreateKeyRequest(BaseModel):
    label: str

@router.post("/api-keys")
def create_key(request: Request, body: CreateKeyRequest):
    token = request.cookies.get("token") or request.headers.get("X-Token")
    user = get_current_user(token)
    db = next(get_db())
    key = f"sdai_{secrets.token_urlsafe(32)}"
    key_hash = hash(key)
    prefix = key[:8]
    new_key = ApiKey(user_id=user.id, key_hash=str(key_hash), key_prefix=prefix, label=body.label)
    db.add(new_key)
    db.commit()
    return {"id": new_key.id, "key": key, "label": body.label, "key_prefix": prefix, "key_suffix": key[-4:], "created_at": new_key.created_at.isoformat(), "is_active": True}

@router.delete("/api-keys/{key_id}")
def revoke_key(request: Request, key_id: int):
    token = request.cookies.get("token") or request.headers.get("X-Token")
    user = get_current_user(token)
    db = next(get_db())
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if key:
        key.is_active = False
        db.commit()
    return {"ok": True}

class ContactRequestBody(BaseModel):
    name: str
    email: str
    subject: str
    message: str

@router.post("/contact")
def contact(request: Request, body: ContactRequestBody):
    token = request.cookies.get("token") or request.headers.get("X-Token")
    try:
        user = get_current_user(token)
        user_id = user.id
    except:
        user_id = None
    db = next(get_db())
    contact = ContactRequest(user_id=user_id, name=body.name, email=body.email, subject=body.subject, message=body.message)
    db.add(contact)
    db.commit()
    return {"ok": True, "message": "Contact request submitted"}
