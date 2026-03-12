from fastapi import APIRouter
from app.services.spacetrack import load_cdm_cache, fetch_cdm_public

router = APIRouter()


def deduplicate_cdms(cdms: list) -> list:
    """Deduplicate CDMs by pairing min(sat1,sat2)+max(sat1,sat2)+TCA."""
    seen = set()
    unique = []
    for cdm in cdms:
        sat1 = cdm.get("SAT_1_NAME", "")
        sat2 = cdm.get("SAT_2_NAME", "")
        tca = cdm.get("TCA", "")
        pair_key = tuple(sorted([sat1, sat2])) + (tca,)
        if pair_key not in seen:
            seen.add(pair_key)
            unique.append(cdm)
    return unique


@router.get("/cdm")
async def get_cdm():
    """
    Returns real Conjunction Data Messages from Space-Track.org
    These are actual close approach events screened by US Space Force.
    """
    cdms = load_cdm_cache()
    unique_cdms = deduplicate_cdms(cdms)
    return {
        "source": "Space-Track.org — 18th Space Defense Squadron",
        "description": "Real operational conjunction screening data",
        "count": len(unique_cdms),
        "original_count": len(cdms),
        "conjunctions": unique_cdms[:50]
    }


@router.post("/cdm/refresh")
async def refresh_cdm():
    cdms = fetch_cdm_public()
    unique = deduplicate_cdms(cdms)
    return {"status": "refreshed", "count": len(unique), "original_count": len(cdms)}
