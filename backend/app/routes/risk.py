from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.odri_engine import (
    get_odri_for_satellite,
    get_odri_snapshot,
)
from app.utils.json_safe import make_json_safe

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/odri")
def get_odri(
    sat_id: str | None = Query(default=None, description="NORAD id or satellite name"),
    delta_t: float = Query(default=7.0, ge=0.0, le=365.0, description="Projection horizon in days"),
    limit: int = Query(default=10, ge=1, le=25, description="Number of top objects when sat_id is omitted"),
):
    try:
        if sat_id:
            result = get_odri_for_satellite(sat_id, delta_t=delta_t)
        else:
            result = get_odri_snapshot(limit=limit)
        return make_json_safe(result)
    except Exception as exc:
        print(f"[RISK/ODRI] Error: {exc}")
        if sat_id:
            return make_json_safe({"detail": f"Satellite '{sat_id}' not found", "odri": None})
        return make_json_safe({"items": [], "summary": {}, "timeline": []})
