from __future__ import annotations

import json
import secrets
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Dict

from fastapi import HTTPException

TERMS_VERSION = "2026-03-22-public-fair-use"
MIN_POLL_INTERVAL_SECONDS = 10
MAX_REQUESTS_PER_MINUTE = 60
AUTO_BAN_AFTER_VIOLATIONS = 3
STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "api_keys.json"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _utc_now().isoformat()


def _clean_seed(seed: str) -> str:
    alnum = "".join(ch for ch in seed.lower() if ch.isalnum())
    return (alnum[:8] or "public").ljust(8, "0")


def _make_key(seed: str) -> str:
    stamp = format(int(_utc_now().timestamp()), "x")[-8:]
    token = secrets.token_hex(6)
    return f"sdai_{_clean_seed(seed)}{stamp}{token}_live"


@dataclass
class ApiKeyRecord:
    key: str
    key_id: str
    email: str
    owner_id: str | None
    label: str | None
    active: bool
    created_at: str
    terms_version: str
    terms_accepted_at: str
    last_seen_at: str | None = None
    revoked_at: str | None = None
    banned_at: str | None = None
    ban_reason: str | None = None


class ApiKeyRegistry:
    def __init__(self, store_path: Path) -> None:
        self._store_path = store_path
        self._lock = Lock()
        self._records: Dict[str, ApiKeyRecord] = {}
        self._load()

    def _load(self) -> None:
        if not self._store_path.exists():
            return
        try:
            payload = json.loads(self._store_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        records = payload.get("records", {})
        self._records = {
            key: ApiKeyRecord(**value)
            for key, value in records.items()
        }

    def _save(self) -> None:
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "terms_version": TERMS_VERSION,
            "updated_at": _iso_now(),
            "records": {
                key: asdict(record)
                for key, record in self._records.items()
            },
        }
        self._store_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def issue_key(
        self,
        *,
        email: str,
        accepted_terms: bool,
        owner_id: str | None = None,
        label: str | None = None,
    ) -> ApiKeyRecord:
        email_normalized = email.strip().lower()
        if not email_normalized:
            raise HTTPException(status_code=400, detail="Email is required")
        if not accepted_terms:
            raise HTTPException(status_code=400, detail="Polling terms must be accepted")

        with self._lock:
            self._deactivate_existing(owner_id=owner_id, email=email_normalized)
            key = _make_key(owner_id or email_normalized)
            record = ApiKeyRecord(
                key=key,
                key_id=secrets.token_hex(8),
                email=email_normalized,
                owner_id=owner_id,
                label=label,
                active=True,
                created_at=_iso_now(),
                terms_version=TERMS_VERSION,
                terms_accepted_at=_iso_now(),
            )
            self._records[key] = record
            self._save()
            return record

    def _deactivate_existing(self, *, owner_id: str | None, email: str) -> None:
        for record in self._records.values():
            same_owner = owner_id and record.owner_id == owner_id
            same_email = record.email == email
            if record.active and (same_owner or same_email):
                record.active = False
                record.revoked_at = _iso_now()

    def revoke_key(self, key: str) -> None:
        with self._lock:
            record = self._records.get(key)
            if not record:
                raise HTTPException(status_code=404, detail="API key not found")
            record.active = False
            record.revoked_at = _iso_now()
            self._save()

    def validate_key(self, key: str) -> ApiKeyRecord:
        with self._lock:
            record = self._records.get(key)
            if not record:
                raise HTTPException(status_code=401, detail="Unknown API key")
            if record.banned_at:
                raise HTTPException(status_code=403, detail=f"API key banned: {record.ban_reason or 'fair-use violation'}")
            if not record.active:
                raise HTTPException(status_code=403, detail="API key is inactive")
            if record.terms_version != TERMS_VERSION or not record.terms_accepted_at:
                raise HTTPException(status_code=403, detail="Polling terms have not been accepted for this key")
            record.last_seen_at = _iso_now()
            self._save()
            return record

    def ban_key(self, key: str, reason: str) -> None:
        with self._lock:
            record = self._records.get(key)
            if not record:
                return
            record.active = False
            record.banned_at = _iso_now()
            record.ban_reason = reason
            self._save()

    def policy(self) -> dict:
        return {
            "terms_version": TERMS_VERSION,
            "min_poll_interval_seconds": MIN_POLL_INTERVAL_SECONDS,
            "max_requests_per_minute": MAX_REQUESTS_PER_MINUTE,
            "auto_ban_after_violations": AUTO_BAN_AFTER_VIOLATIONS,
        }


_registry = ApiKeyRegistry(STORE_PATH)


def issue_api_key(*, email: str, accepted_terms: bool, owner_id: str | None = None, label: str | None = None) -> ApiKeyRecord:
    return _registry.issue_key(email=email, accepted_terms=accepted_terms, owner_id=owner_id, label=label)


def revoke_api_key(key: str) -> None:
    _registry.revoke_key(key)


def validate_api_key(key: str) -> ApiKeyRecord:
    return _registry.validate_key(key)


def ban_api_key(key: str, reason: str) -> None:
    _registry.ban_key(key, reason)


def is_owner_key(key: str) -> bool:
    record = _registry._records.get(key)
    return record is not None and record.owner_id is not None and record.active


def get_api_key_policy() -> dict:
    return _registry.policy()
