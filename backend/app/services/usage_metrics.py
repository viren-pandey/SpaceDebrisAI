from __future__ import annotations

import math
import os
from collections import Counter, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Deque, Dict, Iterable, List

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.services.api_keys import (
    OWNER_EMAIL,
    OWNER_API_KEY,
    get_api_key_policy,
    validate_api_key,
    is_owner_key,
)


# ── Owner / Admin identity ────────────────────────────────────────────────────
# Primary owner identity is email. A second env-var-backed key is also checked.
OWNER_EMAIL = os.getenv("OWNER_EMAIL", "pandeyviren68@gmail.com").strip().lower()
OWNER_API_KEY = os.getenv("OWNER_API_KEY", "").strip()
OWNER_NAME = "Viren Pandey"

# Owner tier: practically unlimited, just not infinite to prevent accidental overload.
OWNER_MAX_REQUESTS_PER_MINUTE = 10_000
OWNER_MIN_POLL_INTERVAL_SECONDS = 0.5  # essentially no polling restriction


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _csv_env(name: str) -> set[str]:
    return {
        value.strip().lower()
        for value in os.getenv(name, "").split(",")
        if value.strip()
    }


@dataclass
class ActivePollingRequest:
    identifier: str
    email: str | None
    ip: str
    endpoint: str
    started_at: datetime
    last_poll: datetime
    poll_count: int = 1


@dataclass
class UsageRecord:
    identifier: str
    email: str | None = None
    last_ip: str | None = None
    first_seen: datetime = field(default_factory=_utc_now)
    last_seen: datetime = field(default_factory=_utc_now)
    total_requests: int = 0
    endpoints: Counter[str] = field(default_factory=Counter)
    prev_timestamp: datetime | None = None
    total_interval: float = 0.0
    last_interval: float | None = None
    last_endpoint: str | None = None
    minute_window: Deque[float] = field(default_factory=deque)
    endpoint_last_request: Dict[str, float] = field(default_factory=dict)
    violation_count: int = 0
    last_violation_at: datetime | None = None

    def touch_email(self, email: str | None) -> None:
        if email:
            self.email = email.lower()

    def touch_ip(self, ip: str | None) -> None:
        if ip:
            self.last_ip = ip

    def prune_minute_window(self, now_ts: float) -> None:
        while self.minute_window and now_ts - self.minute_window[0] >= 60:
            self.minute_window.popleft()

    def register_request(self, endpoint: str, timestamp: datetime) -> None:
        if self.total_requests == 0:
            self.first_seen = timestamp
        if self.prev_timestamp:
            interval = (timestamp - self.prev_timestamp).total_seconds()
            self.last_interval = interval
            self.total_interval += interval

        now_ts = timestamp.timestamp()
        self.prune_minute_window(now_ts)
        self.minute_window.append(now_ts)
        self.endpoint_last_request[endpoint] = now_ts
        self.prev_timestamp = timestamp
        self.last_seen = timestamp
        self.total_requests += 1
        self.endpoints[endpoint] += 1
        self.last_endpoint = endpoint

    def register_violation(self, timestamp: datetime) -> int:
        if self.last_violation_at is None or (timestamp - self.last_violation_at).total_seconds() > 900:
            self.violation_count = 0
        self.violation_count += 1
        self.last_violation_at = timestamp
        return self.violation_count

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
            "window_requests_last_60s": len(self.minute_window),
            "violation_count": self.violation_count,
            "last_violation_at": self.last_violation_at.isoformat() if self.last_violation_at else None,
        }


class UsageTracker:
    def __init__(self) -> None:
        self._lock = Lock()
        self._records: Dict[str, UsageRecord] = {}
        self._total_requests = 0
        self._banned_identifiers: Dict[str, Dict[str, object]] = {}
        self._banned_ips: Dict[str, Dict[str, object]] = {}
        self._active_polls: Dict[str, ActivePollingRequest] = {}
        self._exempt_ips = {"127.0.0.1", "::1", "localhost"} | _csv_env("RATE_LIMIT_EXEMPT_IPS")
        self._exempt_emails = _csv_env("RATE_LIMIT_EXEMPT_EMAILS")
        self._exempt_api_keys = _csv_env("RATE_LIMIT_EXEMPT_API_KEYS")

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

    def _resolve_endpoint(self, request: Request) -> str:
        path = request.url.path.rstrip("/")
        return path or "/"

    def _is_owner(self, email: str | None, api_key: str | None, identifier: str) -> bool:
        if email and email.lower() == OWNER_EMAIL:
            return True
        if api_key and api_key == OWNER_API_KEY and OWNER_API_KEY:
            return True
        if api_key and is_owner_key(api_key):
            return True
        if identifier.lower().replace("user:", "") == OWNER_EMAIL:
            return True
        return False

    def _is_exempt(self, request: Request, identifier: str, email: str | None, ip: str, api_key: str | None) -> bool:
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        forwarded_candidates = [
            part.strip().lower()
            for part in forwarded_for.split(",")
            if part.strip()
        ]
        if ip.lower() in self._exempt_ips or any(candidate in self._exempt_ips for candidate in forwarded_candidates):
            return True
        if email and email.lower() in self._exempt_emails:
            return True
        if api_key and api_key.lower() in self._exempt_api_keys:
            return True
        if identifier.lower() in self._exempt_emails or identifier.lower() in self._exempt_api_keys:
            return True
        # Owner identity bypasses standard rate limits (but is still recorded for audit)
        if self._is_owner(email, api_key, identifier):
            return True
        return False

    def _raise_if_banned(self, identifier: str, ip: str) -> None:
        if identifier in self._banned_identifiers:
            reason = self._banned_identifiers[identifier]["reason"]
            raise HTTPException(status_code=403, detail=f"Disabled identifier ({reason or 'no reason provided'})")
        if ip in self._banned_ips:
            reason = self._banned_ips[ip]["reason"]
            raise HTTPException(status_code=403, detail=f"Blocked IP ({reason or 'no reason provided'})")

    def _get_or_create_record(self, identifier: str) -> UsageRecord:
        record = self._records.get(identifier)
        if record is None:
            record = UsageRecord(identifier=identifier)
            self._records[identifier] = record
        return record

    def _check_rate_limits(self, record: UsageRecord, endpoint: str, now_ts: float, is_owner: bool = False) -> tuple[str, int] | None:
        record.prune_minute_window(now_ts)

        if is_owner:
            # Owner tier: very high limit, essentially no polling restriction
            owner_limit = OWNER_MAX_REQUESTS_PER_MINUTE
            if len(record.minute_window) >= owner_limit:
                retry_after = max(1, math.ceil(60 - (now_ts - record.minute_window[0])))
                reason = f"Exceeded {owner_limit} requests per minute (owner tier)"
                return reason, retry_after
            owner_interval = OWNER_MIN_POLL_INTERVAL_SECONDS
            last_endpoint_ts = record.endpoint_last_request.get(endpoint)
            if last_endpoint_ts is not None:
                elapsed = now_ts - last_endpoint_ts
                if elapsed < owner_interval:
                    retry_after = max(1, math.ceil(owner_interval - elapsed))
                    reason = f"Polling faster than {owner_interval}s is not allowed for {endpoint} (owner tier)"
                    return reason, retry_after
            return None

        if len(record.minute_window) >= MAX_REQUESTS_PER_MINUTE:
            retry_after = max(1, math.ceil(60 - (now_ts - record.minute_window[0])))
            reason = f"Exceeded {MAX_REQUESTS_PER_MINUTE} requests per minute"
            return reason, retry_after

        last_endpoint_ts = record.endpoint_last_request.get(endpoint)
        if last_endpoint_ts is not None:
            elapsed = now_ts - last_endpoint_ts
            if elapsed < MIN_POLL_INTERVAL_SECONDS:
                retry_after = max(1, math.ceil(MIN_POLL_INTERVAL_SECONDS - elapsed))
                reason = f"Polling faster than {MIN_POLL_INTERVAL_SECONDS} seconds is not allowed for {endpoint}"
                return reason, retry_after

        return None

    def _register_ban(
        self,
        *,
        identifier: str,
        ip: str,
        api_key: str | None,
        reason: str,
        timestamp: datetime,
    ) -> None:
        if api_key:
            ban_api_key(api_key, reason)
            self._banned_identifiers[identifier] = {"reason": reason, "at": timestamp.isoformat()}
            raise HTTPException(status_code=403, detail=f"API key banned: {reason}")

        self._banned_ips[ip] = {"reason": reason, "at": timestamp.isoformat()}
        raise HTTPException(status_code=403, detail=f"Client banned: {reason}")

    # ── public read-only endpoints that don't need API key auth ───────────────
    _PUBLIC_PATHS = frozenset([
        "/simulate", "/simulate/changes", "/simulate/explain",
        "/simulate/audit", "/simulate/stats", "/simulate/high-risk",
        "/health",
    ])

    def _is_public_path(self, path: str) -> bool:
        p = path.rstrip("/")
        return p in self._PUBLIC_PATHS or p.startswith("/health")

    def observe_request(self, request: Request) -> str:
        """
        Returns the applied tier: "owner" or "standard".
        Raises HTTPException on rate-limit violation or ban.
        """
        if request.method.upper() == "OPTIONS":
            return "standard"

        identifier, email = self._identify(request)
        ip = self._current_ip(request)
        endpoint = self._resolve_endpoint(request)
        timestamp = _utc_now()
        now_ts = timestamp.timestamp()
        api_key = request.headers.get("X-API-Key")

        # Detect owner identity
        is_owner = self._is_owner(email, api_key, identifier)

        # Audit log owner bypass access
        if is_owner:
            print(
                f"[OWNER ACCESS] {OWNER_NAME} ({OWNER_EMAIL}) | "
                f"endpoint={endpoint} | ip={ip} | "
                f"identifier={identifier} | ts={timestamp.isoformat()}"
            )

        # Skip API key validation for public read-only endpoints
        if api_key and not self._is_public_path(endpoint):
            validate_api_key(api_key)

        if self._is_exempt(request, identifier, email, ip, api_key):
            with self._lock:
                record = self._get_or_create_record(identifier)
                record.touch_email(email)
                record.touch_ip(ip)
                record.register_request(endpoint, timestamp)
                self._total_requests += 1
            return "owner" if is_owner else "standard"

        with self._lock:
            self._raise_if_banned(identifier, ip)

            record = self._get_or_create_record(identifier)
            record.touch_email(email)
            record.touch_ip(ip)

            if api_key:
                violation = self._check_rate_limits(record, endpoint, now_ts, is_owner=is_owner)
                if violation is not None:
                    reason, retry_after = violation
                    violation_count = record.register_violation(timestamp)
                    if violation_count >= AUTO_BAN_AFTER_VIOLATIONS:
                        self._register_ban(
                            identifier=identifier,
                            ip=ip,
                            api_key=api_key,
                            reason=reason,
                            timestamp=timestamp,
                        )
                    raise HTTPException(
                        status_code=429,
                        detail=f"{reason}. Repeated violations trigger an automatic ban.",
                        headers={"Retry-After": str(retry_after)},
                    )

            record.register_request(endpoint, timestamp)
            self._total_requests += 1
            return "owner" if is_owner else "standard"

    def snapshot(self) -> Iterable[Dict[str, object]]:
        with self._lock:
            return [
                record.to_dict()
                for record in sorted(self._records.values(), key=lambda r: r.total_requests, reverse=True)
            ]

    def total_requests(self) -> int:
        with self._lock:
            return self._total_requests

    def ban_identifier(self, identifier: str, reason: str | None = None) -> None:
        with self._lock:
            self._banned_identifiers[identifier] = {
                "reason": reason,
                "at": _utc_now().isoformat(),
            }

    def ban_ip(self, ip: str, reason: str | None = None) -> None:
        with self._lock:
            self._banned_ips[ip] = {"reason": reason, "at": _utc_now().isoformat()}

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
        timestamp = _utc_now()
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
            now = _utc_now()
            active = []
            for poll in self._active_polls.values():
                active_duration = (now - poll.started_at).total_seconds()
                if active_duration > 300:
                    continue
                active.append(
                    {
                        "identifier": poll.identifier,
                        "email": poll.email,
                        "ip": poll.ip,
                        "endpoint": poll.endpoint,
                        "started_at": poll.started_at.isoformat(),
                        "last_poll": poll.last_poll.isoformat(),
                        "poll_count": poll.poll_count,
                        "active_seconds": round(active_duration),
                    }
                )
            return sorted(active, key=lambda x: x["active_seconds"], reverse=True)

    def get_congestion_stats(self) -> Dict[str, object]:
        with self._lock:
            now = _utc_now()
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


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            tier = _tracker.observe_request(request)
        except HTTPException as exc:
            payload = {"detail": exc.detail}
            return JSONResponse(status_code=exc.status_code, content=payload, headers=exc.headers)
        response = await call_next(request)
        response.headers["X-Rate-Limit-Tier"] = tier
        return response


_tracker = UsageTracker()


def record_request_usage(request: Request, endpoint: str) -> None:
    _tracker.observe_request(request)


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
