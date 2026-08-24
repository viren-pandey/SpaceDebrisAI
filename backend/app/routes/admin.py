from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from datetime import datetime
import json
import os
from fastapi import Depends
from app.auth import create_token

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_KEY = os.getenv("USAGE_ADMIN_KEY")
if not ADMIN_KEY:
    raise RuntimeError("USAGE_ADMIN_KEY environment variable must be set")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")
if not ADMIN_EMAIL or not ADMIN_PASSWORD_HASH:
    raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD_HASH must be set")

DATA_DIR = os.path.join(os.path.dirname(__file__), "../../data")

class AdminLoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def admin_login(credentials: AdminLoginRequest):
    from app.auth import verify_password
    if credentials.email != ADMIN_EMAIL or not verify_password(credentials.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(401, {"error": "Invalid credentials"})
    token = create_token(ADMIN_EMAIL)
    return {"token": token, "user": {"email": ADMIN_EMAIL, "is_owner": True}}

def check_admin_key(x_admin_key: str):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(403, {"error": "Forbidden"})

@router.get("/contact-requests")
def get_contacts(x_admin_key: str = Header(default="")):
    check_admin_key(x_admin_key)
    path = os.path.join(DATA_DIR, "contacts.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []

class PollLimitUpdate(BaseModel):
    email: str
    daily_poll_limit: int

@router.put("/users/poll-limit")
def update_poll_limit(x_admin_key: str = Header(default=""), body: PollLimitUpdate = None):
    check_admin_key(x_admin_key)
    users_path = os.path.join(DATA_DIR, "users.json")
    users = {}
    if os.path.exists(users_path):
        with open(users_path) as f:
            users = json.load(f)
    email = body.email
    if email in users:
        users[email]["daily_poll_limit"] = body.daily_poll_limit
    else:
        users[email] = {"daily_poll_limit": body.daily_poll_limit, "polls_today": 0, "created_at": datetime.now().isoformat()}
    with open(users_path, "w") as f:
        json.dump(users, f, default=str)
    return {"ok": True, "email": email, "daily_poll_limit": body.daily_poll_limit}

@router.post("/users/bulk-reset-limits")
def bulk_reset_limits(x_admin_key: str = Header(default="")):
    check_admin_key(x_admin_key)
    users_path = os.path.join(DATA_DIR, "users.json")
    users = {}
    if os.path.exists(users_path):
        with open(users_path) as f:
            users = json.load(f)
    for email in users:
        users[email]["daily_poll_limit"] = 10000
    with open(users_path, "w") as f:
        json.dump(users, f, default=str)
    return {"ok": True, "message": "All limits reset to 10,000"}
