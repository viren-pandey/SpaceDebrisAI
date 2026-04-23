from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, List

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class LoginAttempt:
    timestamp: datetime
    email: str
    ip: str
    user_agent: str | None
    success: bool
    failure_reason: str | None = None
    forwarded_for: str | None = None
    country: str | None = None
    city: str | None = None


class LoginLogStore:
    def __init__(self, max_entries: int = 1000) -> None:
        self._lock = Lock()
        self._entries: List[LoginAttempt] = []
        self._max_entries = max_entries

    def log_attempt(
        self,
        email: str,
        ip: str,
        user_agent: str | None,
        success: bool,
        failure_reason: str | None = None,
        forwarded_for: str | None = None,
    ) -> None:
        attempt = LoginAttempt(
            timestamp=_utc_now(),
            email=email,
            ip=ip,
            user_agent=user_agent,
            success=success,
            failure_reason=failure_reason,
            forwarded_for=forwarded_for,
        )
        with self._lock:
            self._entries.append(attempt)
            if len(self._entries) > self._max_entries:
                self._entries = self._entries[-self._max_entries:]

    def get_recent(self, limit: int = 100) -> List[Dict[str, object]]:
        with self._lock:
            entries = sorted(self._entries, key=lambda e: e.timestamp, reverse=True)[:limit]
            return [self._to_dict(e) for e in entries]

    def get_by_ip(self, ip: str, limit: int = 50) -> List[Dict[str, object]]:
        with self._lock:
            entries = [e for e in self._entries if e.ip == ip][-limit:]
            return [self._to_dict(e) for e in entries]

    def get_by_email(self, email: str, limit: int = 50) -> List[Dict[str, object]]:
        with self._lock:
            entries = [e for e in self._entries if e.email.lower() == email.lower()][-limit:]
            return [self._to_dict(e) for e in entries]

    def get_failed_count(self, minutes: int = 15) -> int:
        with self._lock:
            cutoff = _utc_now().timestamp() - (minutes * 60)
            return sum(1 for e in self._entries if not e.success and e.timestamp.timestamp() > cutoff)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def _to_dict(self, entry: LoginAttempt) -> Dict[str, object]:
        return {
            "timestamp": entry.timestamp.isoformat(),
            "email": entry.email,
            "ip": entry.ip,
            "user_agent": entry.user_agent,
            "success": entry.success,
            "failure_reason": entry.failure_reason,
            "forwarded_for": entry.forwarded_for,
        }


_log_store = LoginLogStore()


def log_login_attempt(
    email: str,
    request: Request,
    success: bool,
    failure_reason: str | None = None,
) -> None:
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    user_agent = request.headers.get("User-Agent")
    _log_store.log_attempt(
        email=email,
        ip=ip,
        user_agent=user_agent,
        success=success,
        failure_reason=failure_reason,
        forwarded_for=forwarded,
    )


def get_login_logs(limit: int = 100) -> List[Dict[str, object]]:
    return _log_store.get_recent(limit)


def get_login_logs_by_ip(ip: str, limit: int = 50) -> List[Dict[str, object]]:
    return _log_store.get_by_ip(ip, limit)


def get_login_logs_by_email(email: str, limit: int = 50) -> List[Dict[str, object]]:
    return _log_store.get_by_email(email, limit)


def get_failed_login_count(minutes: int = 15) -> int:
    return _log_store.get_failed_count(minutes)
