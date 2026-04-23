from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, index=True, nullable=False)
    name = Column(String(100), default="")
    password_hash = Column(String(200), nullable=False)
    daily_poll_limit = Column(Integer, default=10000)
    polls_today = Column(Integer, default=0)
    polls_reset_at = Column(DateTime, default=func.now())
    is_banned = Column(Boolean, default=False)
    ban_reason = Column(Text, default="")
    banned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    key_hash = Column(String(200), unique=True, nullable=False)
    key_prefix = Column(String(10), nullable=False)
    label = Column(String(100), default="")
    last_used = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

class ContactRequest(Base):
    __tablename__ = "contact_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    name = Column(String(100), default="")
    email = Column(String(200), nullable=False)
    subject = Column(String(200), default="")
    message = Column(Text, default="")
    status = Column(String(20), default="new")
    submitted_at = Column(DateTime, default=func.now())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String(20), default="all")
    target_user_id = Column(Integer, nullable=True)
    message = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=func.now())
