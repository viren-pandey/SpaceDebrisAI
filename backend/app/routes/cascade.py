from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.cascade_ai import generate_cascade_response
from app.services.odri_engine import get_cascade_snapshot

router = APIRouter(prefix="/cascade", tags=["cascade"])


class CascadeContextRequest(BaseModel):
    include_live_odri: bool = True
    sat_ids: list[str] = Field(default_factory=list)


class CascadeAskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    context: CascadeContextRequest = Field(default_factory=CascadeContextRequest)


@router.post("/ask")
async def cascade_ask(payload: CascadeAskRequest):
    """Answer a natural-language cascade question using the live ODRI snapshot."""
    snapshot = get_cascade_snapshot(
        limit=10,
        focus_sat_ids=payload.context.sat_ids,
    )
    return await generate_cascade_response(
        question=payload.question,
        snapshot=snapshot,
        include_live_odri=payload.context.include_live_odri,
    )
