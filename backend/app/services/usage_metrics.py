from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Iterable, List

from fastapi import HTTPException, Request


@dataclass
class UsageRecord:
    identifier: str
    email: str | None = None
    last_ip: str | None = None
    first_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    total_requests: int = 0
    endpoints: Counter[str] = field(default_factory=Counter)
    prev_timestamp: datetime | None = None
    total_interval: float = 0.0
    last_interval: float | None = None
    last_endpoint: str | None = None

    def update(self, endpoint: str, timestamp: datetime) -> None:
        if self.total_requests == 0:
            self.first_seen = timestamp
        if self.prev_timestamp:
            interval = (timestamp - self.prev_timestamp).total_seconds()
            self.last_interval = interval
            self.total_interval += interval
        self.prev_timestamp = timestamp
        self.last_seen = timestamp
        self.total_requests += 1
        self.endpoints[endpoint] += 1
        self.last_endpoint = endpoint

    def touch_email(self, email: str | None) -> None:
        if email:
            self.email = email.lower()

    def touch_ip(self, ip: str | None) -> None:
        if ip:
            self.last_ip = ip

    def to_dict(self) -> Dict[str, object]:
        duration_seconds = max((self.last_seen - self.first_seen).total_seconds(), 1e-6)
        rate_per_minute = (self.total_requests / (duration_seconds / 60.0)) if self.total_requests else 0.0
        avg_interval = (self.total_interval / (self.total_requests - 1)) if self.total_requests > 1 else None
        return {
            "identifier": self.identifier,
            "email": self.email,
            "last_ip": self.last_ip,
            "first_seen": self.first_seen.isoformat(),
            "last_seen": self.last_seen.isoformat(),
            "total_requests": self.total_requests,
            "endpoints": dict(self.endpoints),
            "last_endpoint": self.last_endpoint,
            "avg_interval_seconds": avg_interval,
            "last_interval_seconds": self.last_interval,
            "requests_per_minute": round(rate_per_minute, 2),
        }


class UsageTracker:
    def __init__(self) -> None:
        self._lock = Lock()
        self._records: Dict[str, UsageRecord] = {}
        self._total_requests = 0
        self._banned_identifiers: Dict[str, Dict[str, object]] = {}
        self._banned_ips: Dict[str, Dict[str, object]] = {}

    def _identify(self, request: Request) -> tuple[str, str | None]:
        user_email = request.headers.get("X-User-Email")
        if user_email:
            return f"user:{user_email.lower()}", user_email.lower()
        key = request.headers.get("X-API-Key")
        if key:
            return f"api-key:{key}", None
        client = request.client.host if request.client else "unknown"
        return f"ip:{client}", None

    def _current_ip(self, request: Request) -> str:
        return request.client.host if request.client else "unknown"

    def _raise_if_banned(self, identifier: str, ip: str) -> None:
        if identifier in self._banned_identifiers:
            reason = self._banned_identifiers[identifier]["reason"]
            raise HTTPException(status_code=403, detail=f"Disabled identifier ({reason or 'no reason provided'})")
        if ip in self._banned_ips:
            reason = self._banned_ips[ip]["reason"]
            raise HTTPException(status_code=403, detail=f"Blocked IP ({reason or 'no reason provided'})")

    def record(self, request: Request, endpoint: str) -> None:
        identifier, email = self._identify(request)
        ip = self._current_ip(request)
        timestamp = datetime.now(timezone.utc)
        with self._lock:
            self._raise_if_banned(identifier, ip)

            record = self._records.get(identifier)
            if not record:
                record = UsageRecord(identifier=identifier)
                self._records[identifier] = record
            record.touch_email(email)
            record.touch_ip(ip)
            record.update(endpoint, timestamp)
            self._total_requests += 1

    def snapshot(self) -> Iterable[Dict[str, object]]:
        with self._lock:
            return [record.to_dict() for record in sorted(
                self._records.values(),
                key=lambda r: r.total_requests,
                reverse=True,
            )]

    def total_requests(self) -> int:
        with self._lock:
            return self._total_requests

    def ban_identifier(self, identifier: str, reason: str | None = None) -> None:
        with self._lock:
            self._banned_identifiers[identifier] = {
                "reason": reason,
                "at": datetime.now(timezone.utc).isoformat(),
            }

    def ban_ip(self, ip: str, reason: str | None = None) -> None:
        with self._lock:
            self._banned_ips[ip] = {"reason": reason, "at": datetime.now(timezone.utc).isoformat()}

    def unban_identifier(self, identifier: str) -> None:
        with self._lock:
            self._banned_identifiers.pop(identifier, None)

    def unban_ip(self, ip: str) -> None:
        with self._lock:
            self._banned_ips.pop(ip, None)

    def identifiers_by_email(self, email: str) -> List[str]:
        email_lower = email.lower()
        with self._lock:
            return [record.identifier for record in self._records.values() if record.email == email_lower]

    def banlist(self) -> Dict[str, Dict[str, object]]:
        with self._lock:
            return {
                "identifiers": dict(self._banned_identifiers),
                "ips": dict(self._banned_ips),
            }


_tracker = UsageTracker()


def record_request_usage(request: Request, endpoint: str) -> None:
    _tracker.record(request, endpoint)


def ban_identifier(identifier: str, reason: str | None = None) -> None:
    _tracker.ban_identifier(identifier, reason)


def ban_ip(ip: str, reason: str | None = None) -> None:
    _tracker.ban_ip(ip, reason)


def unban_identifier(identifier: str) -> None:
    _tracker.unban_identifier(identifier)


def unban_ip(ip: str) -> None:
    _tracker.unban_ip(ip)


def identifiers_by_email(email: str) -> List[str]:
    return _tracker.identifiers_by_email(email)


def get_usage_snapshot() -> Dict[str, object]:
    return {
        "total_requests": _tracker.total_requests(),
        "buckets": _tracker.snapshot(),
        "banlist": _tracker.banlist(),
    }
