from __future__ import annotations

import math
from typing import Dict


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def compute_sigma(A_cross: float, r_miss: float) -> float:
    """Compute the collision susceptibility term from cross-section and miss distance."""
    if A_cross <= 0 or r_miss <= 0:
        return 0.0
    return _clamp(1.0 - math.exp(-(A_cross / (4.0 * math.pi * r_miss))))


def compute_omega(N_shell: float, rho_local: float, rho_critical: float = 3.2e-8) -> float:
    """Compute the shell cascade amplification term."""
    if N_shell <= 0 or rho_local <= 0 or rho_critical <= 0:
        return 0.0
    return _clamp(math.tanh((N_shell * rho_local) / rho_critical))


def compute_psi(tca_hours: float, k: float = 1.8, T_ref: float = 72) -> float:
    """Compute the temporal urgency term from hours until closest approach."""
    if T_ref <= 0:
        return 0.0
    return _clamp(1.0 / (1.0 + math.exp(-k * (tca_hours / T_ref))))


def compute_phi(dv_budget: float, eta: float, dv_required: float) -> float:
    """Compute the maneuver resilience term and clamp it to the [0, 1] range."""
    if dv_required < 0:
        dv_required = 0.0
    return _clamp(1.0 - ((dv_budget * eta) / (dv_required + 0.01)))


def compute_odri(sigma: float, omega: float, psi: float, phi: float) -> float:
    """Combine all ODRI factors into a single risk score."""
    return _clamp(sigma * omega * psi * phi)


def project_odri(
    odri: float,
    delta_t: float,
    delta_F107: float,
    delta_rho: float,
    tau_drag: float,
) -> float:
    """Project the ODRI score forward using the supplied forecast parameters."""
    if tau_drag <= 0:
        tau_drag = 1.0
    projected = (
        odri * math.exp(0.003 * delta_t)
        + 0.0012 * delta_F107
        + 0.004 * delta_rho
        - 0.2 * (1.0 - math.exp(-delta_t / tau_drag))
    )
    return _clamp(projected)


def classify_odri(score: float) -> Dict[str, str]:
    """Map an ODRI score to a user-facing risk band and recommendation."""
    score = _clamp(score)
    if score >= 0.85:
        return {
            "risk_level": "CRITICAL",
            "recommendation": "Initiate immediate conjunction review, maneuver screening, and shell traffic controls.",
        }
    if score >= 0.65:
        return {
            "risk_level": "WARNING",
            "recommendation": "Prioritize operator coordination, refine tracking, and prepare mitigation burns.",
        }
    if score >= 0.45:
        return {
            "risk_level": "ADVISORY",
            "recommendation": "Increase monitoring cadence and review shell congestion before new operations.",
        }
    if score >= 0.25:
        return {
            "risk_level": "ELEVATED",
            "recommendation": "Maintain watch status and validate projected density growth against mission plans.",
        }
    return {
        "risk_level": "NOMINAL",
        "recommendation": "Continue routine monitoring; no immediate cascade mitigation action is indicated.",
    }
