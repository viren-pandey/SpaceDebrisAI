from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: str
    name: str = ""

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(UserBase):
    id: int
    daily_poll_limit: int = 10000
    is_banned: bool = False
    created_at: datetime

class TokenPayload(BaseModel):
    sub: str
    exp: int
    iat: int
