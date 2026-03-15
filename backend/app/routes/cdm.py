from fastapi import APIRouter, Query
from typing import Optional
from app.services.spacetrack import load_cdm_cache, fetch_cdm_public

router = APIRouter()


def deduplicate_cdms(cdms: list) -> list:
    # Deduplicate CDMs by pairing min(sat1,sat2)+max(sat1,sat2)+TCA.
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


def _build_pair_key(sat1: str, sat2: str) -> str:
    """Build consistent pair key from two satellite names."""
    sorted_names = sorted([sat1.upper(), sat2.upper()])
    return f"{sorted_names[0]}__{sorted_names[1]}"


def _extract_cdm_summary(cdm: dict) -> dict:
    """Extract key fields from a CDM for timeline visualization."""
    return {
        "cdm_id": cdm.get("CDM_ID", ""),
        "tca": cdm.get("TCA", ""),
        "created": cdm.get("CREATION_DATE", cdm.get("TCA", "")),
        "miss_distance_km": _safe_float(cdm.get("MISS_DISTANCE", 0)),
        "miss_distance_unit": cdm.get("MISS_DISTANCE_UNIT", "km"),
        "probability_of_collision": _safe_float(cdm.get("P_C", 0)),
        "relative_velocity_km_s": _safe_float(cdm.get("RELATIVE_VELOCITY", 0)),
        "relative_velocity_unit": cdm.get("RELATIVE_VELOCITY_UNIT", "km/s"),
        "sat1_name": cdm.get("SAT_1_NAME", ""),
        "sat1_id": cdm.get("SAT_1_ID", ""),
        "sat2_name": cdm.get("SAT_2_NAME", ""),
        "sat2_id": cdm.get("SAT_2_ID", ""),
        "risk_threshold_crossed": _is_above_threshold(cdm),
    }


def _safe_float(value, default=0.0) -> float:
    """Safely convert value to float."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _is_above_threshold(cdm: dict) -> bool:
    """Check if CDM is above typical maneuver threshold (Pc > 1e-4)."""
    pc = _safe_float(cdm.get("P_C", 0))
    return pc > 1e-4


def _build_timelines(cdms: list) -> dict:
    """
    Group CDMs by object pair and build timelines.
    
    Returns dict mapping pair_key -> sorted list of CDMs showing evolution.
    """
    timelines = {}
    
    for cdm in cdms:
        sat1 = cdm.get("SAT_1_NAME", "")
        sat2 = cdm.get("SAT_2_NAME", "")
        if not sat1 or not sat2:
            continue
        
        pair_key = _build_pair_key(sat1, sat2)
        if pair_key not in timelines:
            timelines[pair_key] = {
                "sat1": sat1,
                "sat2": sat2,
                "cdms": [],
                "miss_distance_trend": "unknown",
                "pc_trend": "unknown",
                "max_pc": 0,
                "min_miss_distance_km": float("inf"),
            }
        
        summary = _extract_cdm_summary(cdm)
        timelines[pair_key]["cdms"].append(summary)
        
        # Track extremes
        pc = summary["probability_of_collision"]
        miss = summary["miss_distance_km"]
        if pc > timelines[pair_key]["max_pc"]:
            timelines[pair_key]["max_pc"] = pc
        if miss < timelines[pair_key]["min_miss_distance_km"]:
            timelines[pair_key]["min_miss_distance_km"] = miss
    
    # Sort CDMs by TCA and compute trends
    for pair_key, data in timelines.items():
        data["cdms"].sort(key=lambda x: x["tca"])
        data["cdm_count"] = len(data["cdms"])
        
        # Compute trends
        if len(data["cdms"]) >= 2:
            first_miss = data["cdms"][0]["miss_distance_km"]
            last_miss = data["cdms"][-1]["miss_distance_km"]
            first_pc = data["cdms"][0]["probability_of_collision"]
            last_pc = data["cdms"][-1]["probability_of_collision"]
            
            if last_miss < first_miss * 0.8:
                data["miss_distance_trend"] = "decreasing"
            elif last_miss > first_miss * 1.2:
                data["miss_distance_trend"] = "increasing"
            else:
                data["miss_distance_trend"] = "stable"
            
            if last_pc > first_pc * 1.5:
                data["pc_trend"] = "increasing"
            elif last_pc < first_pc * 0.7:
                data["pc_trend"] = "decreasing"
            else:
                data["pc_trend"] = "stable"
    
    return timelines


@router.get("/cdm")
async def get_cdm(
    limit: int = Query(default=50, ge=1, le=200, description="Number of CDMs to return"),
):
    # Returns real Conjunction Data Messages from Space-Track.org
    # These are actual close approach events screened by US Space Force.
    cdms = load_cdm_cache()
    unique_cdms = deduplicate_cdms(cdms)
    return {
        "source": "Space-Track.org — 18th Space Defense Squadron",
        "description": "Real operational conjunction screening data",
        "count": len(unique_cdms),
        "original_count": len(cdms),
        "conjunctions": unique_cdms[:limit]
    }


@router.post("/cdm/refresh")
async def refresh_cdm():
    cdms = fetch_cdm_public()
    unique = deduplicate_cdms(cdms)
    return {"status": "refreshed", "count": len(unique), "original_count": len(cdms)}


@router.get("/cdm/timeline")
async def cdm_timeline(
    sat1: Optional[str] = Query(default=None, description="First satellite name filter"),
    sat2: Optional[str] = Query(default=None, description="Second satellite name filter"),
    min_pc: float = Query(default=1e-6, description="Minimum Pc threshold"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of timelines to return"),
):
    """
    Get CDM timelines showing evolution of conjunction risk over time.
    
    For high-risk pairs, this shows how miss distance and Pc have changed
    across consecutive CDMs - critical for understanding if a situation is
    improving or deteriorating.
    
    The SCOUT X-1 R/B vs FENGYUN 1C DEB case (miss distance narrowing from
    484m to 21m over 7 CDMs) would appear here as a "decreasing" trend with
    Pc values climbing.
    """
    cdms = load_cdm_cache()
    unique_cdms = deduplicate_cdms(cdms)
    
    # Filter by Pc threshold
    filtered = [c for c in unique_cdms if _safe_float(c.get("P_C", 0)) >= min_pc]
    
    # Build timelines
    timelines = _build_timelines(filtered)
    
    # Apply satellite filters if specified
    if sat1 or sat2:
        filtered_timelines = {}
        sat1_upper = sat1.upper() if sat1 else ""
        sat2_upper = sat2.upper() if sat2 else ""
        
        for key, data in timelines.items():
            name1 = data["sat1"].upper()
            name2 = data["sat2"].upper()
            
            match = False
            if sat1 and sat2:
                match = (sat1_upper in name1 and sat2_upper in name2) or \
                        (sat1_upper in name2 and sat2_upper in name1)
            elif sat1:
                match = sat1_upper in name1 or sat1_upper in name2
            
            if match:
                filtered_timelines[key] = data
        
        timelines = filtered_timelines
    
    # Sort by max Pc descending (most dangerous first)
    sorted_timelines = sorted(
        timelines.values(),
        key=lambda x: x.get("max_pc", 0),
        reverse=True
    )
    
    return {
        "source": "Space-Track.org — 18th Space Defense Squadron",
        "description": "CDM timeline evolution for tracked conjunction events",
        "timeline_count": len(sorted_timelines),
        "timelines": sorted_timelines[:limit],
    }


@router.get("/cdm/highrisk")
async def highrisk_cdm(
    threshold_pc: float = Query(default=1e-4, description="Pc threshold for high-risk"),
    limit: int = Query(default=10, ge=1, le=50, description="Number of pairs to return"),
):
    """
    Get high-risk conjunction pairs sorted by probability of collision.
    
    Returns the most dangerous current conjunction events that may
    require operator action or maneuver planning.
    """
    cdms = load_cdm_cache()
    unique_cdms = deduplicate_cdms(cdms)
    
    # Filter to high-risk CDMs
    high_risk = [
        _extract_cdm_summary(c) for c in unique_cdms
        if _safe_float(c.get("P_C", 0)) >= threshold_pc
    ]
    
    # Sort by Pc descending
    high_risk.sort(key=lambda x: x["probability_of_collision"], reverse=True)
    
    return {
        "source": "Space-Track.org — 18th Space Defense Squadron",
        "description": f"Conjunctions with Pc >= {threshold_pc}",
        "count": len(high_risk),
        "threshold_pc": threshold_pc,
        "conjunctions": high_risk[:limit],
    }
