from __future__ import annotations

import os
from typing import Any, Dict, Iterable, List

import httpx


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def _detect_affected_systems(question: str, snapshot: Dict[str, Any]) -> List[str]:
    lowered = question.lower()
    systems: List[str] = []
    keyword_map = [
        ("GPS", ["gps", "navigation", "positioning"]),
        ("ISS", ["iss", "station", "crew", "astronaut"]),
        ("Starlink", ["starlink", "internet", "broadband", "connectivity"]),
        ("OneWeb", ["oneweb"]),
        ("Launch Windows", ["launch", "window", "trajectory"]),
        ("Satellite Communications", ["communication", "communications", "signal", "satcom"]),
        ("Solar Observation", ["solar", "sun", "space weather", "f10.7"]),
    ]
    for system, keywords in keyword_map:
        if any(word in lowered for word in keywords):
            systems.append(system)

    top_names = " ".join(item["object_name"].lower() for item in snapshot.get("top_objects", []))
    if "starlink" in top_names and "Starlink" not in systems:
        systems.append("Starlink")
    if any("iss" in item["object_name"].lower() for item in snapshot.get("top_objects", [])) and "ISS" not in systems:
        systems.append("ISS")
    return systems[:5] or ["Satellite Communications", "Launch Windows"]


def compute_risk_relevance(question: str, snapshot: Dict[str, Any], include_live_odri: bool) -> float:
    """Estimate how strongly the answer is tied to the live ODRI snapshot."""
    if not include_live_odri:
        return 0.18
    lowered = question.lower()
    live_keywords = ["risk", "debris", "cascade", "kessler", "odri", "iss", "gps", "starlink", "solar"]
    overlap = sum(1 for keyword in live_keywords if keyword in lowered)
    focus_bonus = 0.1 if snapshot.get("focused_objects") else 0.0
    warning_bonus = min(len(snapshot.get("warnings", [])) * 0.04, 0.16)
    return _clamp(0.45 + overlap * 0.06 + focus_bonus + warning_bonus)


def _summarize_top_objects(objects: Iterable[Dict[str, Any]]) -> str:
    parts = []
    for item in list(objects)[:5]:
        parts.append(
            f"{item['object_name']} (ODRI {item['odri']:.3f}, {item['risk_level']}, shell {item['inputs']['shell_floor_km']} km)"
        )
    return "; ".join(parts) if parts else "No elevated objects were found in the current cache."


def build_context_string(question: str, snapshot: Dict[str, Any]) -> str:
    """Assemble grounded live context for the cascade answer generator."""
    top_objects = snapshot.get("top_objects", [])
    focused = snapshot.get("focused_objects", [])
    summary = snapshot.get("summary", {})
    warnings = snapshot.get("warnings", [])
    return (
        f"Question: {question}\n"
        f"Current highest risk objects: {_summarize_top_objects(top_objects)}\n"
        f"Focused objects: {_summarize_top_objects(focused)}\n"
        f"Average shell density: {summary.get('average_shell_density', 0.0):.3e}\n"
        f"Average ODRI: {summary.get('average_odri', 0.0):.3f}\n"
        f"Active conjunction warnings: {len(warnings)}\n"
        f"Cascade threat level: {snapshot.get('cascade_threat_level', 'NOMINAL')}\n"
    )


def _fallback_answer(question: str, snapshot: Dict[str, Any], affected_systems: List[str]) -> str:
    top_objects = snapshot.get("top_objects", [])
    summary = snapshot.get("summary", {})
    highest = top_objects[0] if top_objects else None
    highest_label = (
        f"{highest['object_name']} at ODRI {highest['odri']:.3f} ({highest['risk_level']})"
        if highest
        else "no currently elevated object"
    )
    systems = ", ".join(affected_systems)
    warning_count = len(snapshot.get("warnings", []))

    return (
        f"### Cascade Assessment\n"
        f"Your question points to **{systems}**. In the current live snapshot, the highest tracked object risk is **{highest_label}**, "
        f"while the catalog-wide average ODRI is **{summary.get('average_odri', 0.0):.3f}**.\n\n"
        f"### What That Means\n"
        f"Orbital debris cascading raises mission risk when dense shells accumulate unresolved conjunctions and operators lose maneuver margin. "
        f"Right now there are **{warning_count} active conjunction warnings** represented in the live ODRI context, which means downstream effects can propagate into service continuity, launch planning, and crewed operations if density continues to climb.\n\n"
        f"### Practical Interpretation\n"
        f"For this scenario, watch the highest-risk shell, monitor how quickly projected ODRI moves toward the warning band, and prioritize assets with low maneuver resilience. "
        f"That is the fastest way to translate the live debris picture into Earth-impact consequences."
    )


async def _groq_answer(question: str, context: str) -> str | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You explain orbital debris cascading in plain language. "
                    "Ground every answer in the supplied live ODRI data, do not invent measurements, and use concise markdown."
                ),
            },
            {
                "role": "user",
                "content": f"{context}\nAnswer the user's question: {question}",
            },
        ],
        "temperature": 0.35,
    }
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except Exception:
        return None

    choices = data.get("choices", [])
    if not choices:
        return None
    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()
    return None


async def generate_cascade_response(question: str, snapshot: Dict[str, Any], include_live_odri: bool) -> Dict[str, Any]:
    """Generate the structured cascade answer payload."""
    affected_systems = _detect_affected_systems(question, snapshot)
    risk_relevance = compute_risk_relevance(question, snapshot, include_live_odri)
    context = build_context_string(question, snapshot)
    answer = await _groq_answer(question, context)
    if not answer:
        answer = _fallback_answer(question, snapshot, affected_systems)

    return {
        "answer": answer,
        "risk_relevance": risk_relevance,
        "affected_systems": affected_systems,
        "odri_snapshot": {
            "top_objects": snapshot.get("top_objects", []),
            "focused_objects": snapshot.get("focused_objects", []),
            "summary": snapshot.get("summary", {}),
            "warnings": snapshot.get("warnings", []),
        },
        "cascade_threat_level": snapshot.get("cascade_threat_level", "NOMINAL"),
    }
