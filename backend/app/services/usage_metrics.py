from __future__ import annotations

import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Iterable, List

from app.services.api_keys import (
    AUTO_BAN_AFTER_VIOLATIONS,
    MAX_REQUESTS_PER_MINUTE,
    MIN_POLL_INTERVAL_SECONDS,
    ban_api_key,
    validate_api_key,
)


@dataclass
class ActivePollingRequest:
    identifier: str
    email: str | None
    ip: str
    endpoint: str
    started_at: datetime
    last_poll: datetime
    poll_count: int = 1

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
    minute_window: List[float] = field(default_factory=list)
    violation_count: int = 0
    last_violation_at: datetime | None = None

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
        now_ts = timestamp.timestamp()
        self.minute_window = [ts for ts in self.minute_window if now_ts - ts <= 60]
        self.minute_window.append(now_ts)

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
    POLLING_ENDPOINTS = {"satellites", "simulate", "tracker", "cdm"}

    def __init__(self) -> None:
        self._lock = Lock()
        self._records: Dict[str, UsageRecord] = {}
        self._total_requests = 0
        self._banned_identifiers: Dict[str, Dict[str, object]] = {}
        self._banned_ips: Dict[str, Dict[str, object]] = {}
        self._active_polls: Dict[str, ActivePollingRequest] = {}

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
        api_key = request.headers.get("X-API-Key")
        if api_key:
            validate_api_key(api_key)
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
            self._enforce_limits(record, identifier, ip, endpoint, api_key)

    def _enforce_limits(
        self,
        record: UsageRecord,
        identifier: str,
        ip: str,
        endpoint: str,
        api_key: str | None,
    ) -> None:
        rpm = len(record.minute_window)
        if rpm > MAX_REQUESTS_PER_MINUTE:
            self._register_violation(
                record,
                identifier,
                ip,
                api_key,
                f"Exceeded {MAX_REQUESTS_PER_MINUTE} requests per minute",
            )
        if endpoint in self.POLLING_ENDPOINTS and record.last_interval is not None and record.last_interval < MIN_POLL_INTERVAL_SECONDS:
            self._register_violation(
                record,
                identifier,
                ip,
                api_key,
                f"Polling faster than {MIN_POLL_INTERVAL_SECONDS} seconds is not allowed",
            )

    def _register_violation(
        self,
        record: UsageRecord,
        identifier: str,
        ip: str,
        api_key: str | None,
        reason: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        if record.last_violation_at is None or (now - record.last_violation_at).total_seconds() > 900:
            record.violation_count = 0
        record.violation_count += 1
        record.last_violation_at = now
        if record.violation_count >= AUTO_BAN_AFTER_VIOLATIONS:
            if api_key:
                ban_api_key(api_key, reason)
                self._banned_identifiers[identifier] = {"reason": reason, "at": now.isoformat()}
                raise HTTPException(status_code=403, detail=f"API key banned: {reason}")
            self._banned_ips[ip] = {"reason": reason, "at": now.isoformat()}
            raise HTTPException(status_code=403, detail=f"Client banned: {reason}")
        raise HTTPException(
            status_code=429,
            detail=f"{reason}. Repeated violations trigger an automatic ban.",
        )

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

    def start_polling(self, request: Request, endpoint: str) -> None:
        identifier, email = self._identify(request)
        ip = self._current_ip(request)
        timestamp = datetime.now(timezone.utc)
        with self._lock:
            poll_key = f"{identifier}:{endpoint}"
            if poll_key in self._active_polls:
                self._active_polls[poll_key].last_poll = timestamp
                self._active_polls[poll_key].poll_count += 1
            else:
                self._active_polls[poll_key] = ActivePollingRequest(
                    identifier=identifier,
                    email=email,
                    ip=ip,
                    endpoint=endpoint,
                    started_at=timestamp,
                    last_poll=timestamp,
                )

    def stop_polling(self, request: Request, endpoint: str) -> None:
        identifier, _ = self._identify(request)
        with self._lock:
            poll_key = f"{identifier}:{endpoint}"
            self._active_polls.pop(poll_key, None)

    def get_active_polls(self) -> List[Dict[str, object]]:
        with self._lock:
            now = datetime.now(timezone.utc)
            active = []
            for key, poll in self._active_polls.items():
                active_duration = (now - poll.started_at).total_seconds()
                if active_duration > 300:
                    continue
                active.append({
                    "identifier": poll.identifier,
                    "email": poll.email,
                    "ip": poll.ip,
                    "endpoint": poll.endpoint,
                    "started_at": poll.started_at.isoformat(),
                    "last_poll": poll.last_poll.isoformat(),
                    "poll_count": poll.poll_count,
                    "active_seconds": round(active_duration),
                })
            return sorted(active, key=lambda x: x["active_seconds"], reverse=True)

    def get_congestion_stats(self) -> Dict[str, object]:
        with self._lock:
            now = datetime.now(timezone.utc)
            polls = list(self._active_polls.values())
            endpoint_counts: Dict[str, int] = {}
            for poll in polls:
                endpoint_counts[poll.endpoint] = endpoint_counts.get(poll.endpoint, 0) + 1
            unique_users = len(set(p.identifier for p in polls))
            return {
                "total_active_connections": len(polls),
                "unique_users_polling": unique_users,
                "by_endpoint": endpoint_counts,
                "timestamp": now.isoformat(),
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
        "active_polls": _tracker.get_active_polls(),
    }


def start_polling(request: Request, endpoint: str) -> None:
    _tracker.start_polling(request, endpoint)


def stop_polling(request: Request, endpoint: str) -> None:
    _tracker.stop_polling(request, endpoint)


def get_active_polls() -> List[Dict[str, object]]:
    return _tracker.get_active_polls()


def get_congestion_stats() -> Dict[str, object]:
    return _tracker.get_congestion_stats()
