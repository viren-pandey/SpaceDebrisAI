from fastapi import APIRouter, HTTPException, Response, Cookie, Header
from app.schemas import UserCreate, UserLogin
from app.auth import hash_password, verify_password, create_token, decode_token
from app.database import get_db
from app.models import User
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
def register(user_data: UserCreate):
    db = next(get_db())
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(400, {"error": "Email already registered"})
    hashed = hash_password(user_data.password)
    user = User(email=user_data.email, name=user_data.name, password_hash=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.email)
    response = Response()
    response.set_cookie(key="token", value=token, httponly=True, samesite="lax", max_age=86400*7)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}

@router.post("/login")
def login(credentials: UserLogin):
    db = next(get_db())
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(401, {"error": "Invalid credentials"})
    if user.is_banned:
        raise HTTPException(403, {"error": "Account banned"})
    token = create_token(user.email)
    response = Response()
    response.set_cookie(key="token", value=token, httponly=True, samesite="lax", max_age=86400*7)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "daily_poll_limit": user.daily_poll_limit}}

@router.post("/logout")
def logout():
    response = Response()
    response.delete_cookie(key="token")
    return {"ok": True}

@router.get("/me")
def get_me(token: Optional[str] = Cookie(None), x_token: Optional[str] = Header(None, alias="X-Token")):
    token_str = token or x_token
    if not token_str:
        raise HTTPException(401, {"error": "Not authenticated"})
    email = decode_token(token_str)
    if not email:
        raise HTTPException(401, {"error": "Invalid or expired token"})
    db = next(get_db())
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, {"error": "User not found"})
    return {"id": user.id, "email": user.email, "name": user.name, "daily_poll_limit": user.daily_poll_limit, "is_banned": user.is_banned}
