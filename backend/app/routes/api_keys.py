from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.api_keys import (
    get_api_key_policy,
    issue_api_key,
    revoke_api_key,
)

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


class IssueApiKeyRequest(BaseModel):
    email: str
    accepted_terms: bool
    owner_id: str | None = None
    label: str | None = None


class RevokeApiKeyRequest(BaseModel):
    key: str


@router.get("/policy")
def api_key_policy():
    return get_api_key_policy()


@router.post("/issue")
def create_api_key(payload: IssueApiKeyRequest):
    if "@" not in payload.email:
        raise HTTPException(status_code=400, detail="A valid email address is required")
    record = issue_api_key(
        email=payload.email,
        accepted_terms=payload.accepted_terms,
        owner_id=payload.owner_id,
        label=payload.label,
    )
    return {
        "key": record.key,
        "key_id": record.key_id,
        "email": record.email,
        "terms_version": record.terms_version,
        "created_at": record.created_at,
        "policy": get_api_key_policy(),
    }


@router.post("/revoke")
def remove_api_key(payload: RevokeApiKeyRequest):
    revoke_api_key(payload.key)
    return {"status": "revoked"}
