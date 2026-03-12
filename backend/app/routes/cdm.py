from fastapi import APIRouter
from app.services.spacetrack import load_cdm_cache, fetch_cdm_public

router = APIRouter()

@router.get("/cdm")
async def get_cdm():
    """
    Returns real Conjunction Data Messages from Space-Track.org
    These are actual close approach events screened by US Space Force.
    """
    cdms = load_cdm_cache()
    return {
        "source": "Space-Track.org — 18th Space Defense Squadron",
        "description": "Real operational conjunction screening data",
        "count": len(cdms),
        "conjunctions": cdms[:50]  # return top 50
    }

@router.post("/cdm/refresh")
async def refresh_cdm():
    cdms = fetch_cdm_public()
    return {"status": "refreshed", "count": len(cdms)}
