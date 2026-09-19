"""Refinement and frozen perturbation checks.

Thresholds were frozen from Gate A (1.2% refined-vs-baseline scatter;
off-axis 1-point change was −16%). They are not tuned after the
closed loop.
"""

from __future__ import annotations

from dataclasses import dataclass

from experiments.torax import preset
from services.research.executor import ExecutionBudget
from services.research.validation import HeatingConfig, baseline_config, validate

MIN_IMPROVEMENT_PCT = 5.0
REFINEMENT_REL_TOL = 0.03
PERTURBATION_DRHO = 0.03
SEARCH_BUDGET = ExecutionBudget(timeout_s=180)
REFINED_BUDGET = ExecutionBudget(
    timeout_s=180,
    n_rho=preset.N_RHO_REFINED,
    chi_timestep_prefactor=preset.CHI_TIMESTEP_PREFACTOR_REFINED,
)


@dataclass(frozen=True)
class VerificationCase:
    name: str
    config: HeatingConfig
    budget: ExecutionBudget
    kind: str  # refine | perturb | baseline_refine


def _clip_location(value: float) -> float:
    lo, hi = preset.LOCATION_BOUNDS
    return min(hi, max(lo, value))


def verification_cases(candidate: HeatingConfig) -> list[VerificationCase]:
    """Deterministic checks. Candidate must already be frozen as finalist."""
    refined = REFINED_BUDGET
    production = SEARCH_BUDGET
    perturbed = validate(
        {
            "heating_location": _clip_location(
                candidate.heating_location + PERTURBATION_DRHO
            ),
            "heating_width": candidate.heating_width,
        }
    )
    if not perturbed.accepted or perturbed.config is None:
        raise ValueError("perturbation left the allowed domain")
    return [
        VerificationCase(
            name="baseline_refined",
            config=baseline_config(),
            budget=refined,
            kind="baseline_refine",
        ),
        VerificationCase(
            name="candidate_refined",
            config=candidate,
            budget=refined,
            kind="refine",
        ),
        VerificationCase(
            name="candidate_location_perturbation",
            config=perturbed.config,
            budget=production,
            kind="perturb",
        ),
    ]
