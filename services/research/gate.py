"""Deterministic conclusion gate. Thresholds are frozen after Gate A.

A supported result requires ALL predeclared verification checks, matched to
the actual heating config and grid of the baseline / frozen finalist — not
to experiment labels. Missing checks are inconclusive.
"""

from __future__ import annotations

import math
from typing import Any

from experiments.torax import preset
from services.research.validation import HeatingConfig
from services.research.verification import SEARCH_BUDGET, verification_cases

MIN_IMPROVEMENT_PCT = 5.0
REFINEMENT_REL_TOL = 0.03
PERTURBATION_DRHO = 0.03
_FLOAT_ATOL = 1e-9


def _finite_positive(value: Any) -> bool:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number) and number > 0.0


def _finite(value: Any) -> bool:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number)


def _close(left: Any, right: Any, atol: float = _FLOAT_ATOL) -> bool:
    try:
        return math.isclose(float(left), float(right), rel_tol=0.0, abs_tol=atol)
    except (TypeError, ValueError):
        return False


def _heating_matches(experiment: dict[str, Any], heating: HeatingConfig) -> bool:
    config = experiment.get("config") or {}
    return (
        _close(config.get("heating_location"), heating.heating_location, atol=1e-8)
        and _close(config.get("heating_width"), heating.heating_width, atol=1e-8)
        and _close(config.get("heating_power_mw"), heating.heating_power_mw, atol=1e-6)
        and _close(config.get("duration_s"), heating.duration_s, atol=1e-9)
    )


def _grid_matches(experiment: dict[str, Any], *, n_rho: int, chi_timestep_prefactor: float) -> bool:
    config = experiment.get("config") or {}
    try:
        recorded_n_rho = int(config.get("n_rho"))
    except (TypeError, ValueError):
        return False
    return recorded_n_rho == int(n_rho) and _close(
        config.get("chi_timestep_prefactor"),
        chi_timestep_prefactor,
        atol=1e-9,
    )


def _find_completed(
    experiments: list[dict[str, Any]],
    *,
    heating: HeatingConfig,
    n_rho: int,
    chi_timestep_prefactor: float,
) -> dict[str, Any] | None:
    matches = [
        experiment
        for experiment in experiments
        if experiment.get("status") == "completed"
        and _heating_matches(experiment, heating)
        and _grid_matches(experiment, n_rho=n_rho, chi_timestep_prefactor=chi_timestep_prefactor)
    ]
    return matches[0] if matches else None


def _search_grid_ok(experiment: dict[str, Any]) -> bool:
    return _grid_matches(
        experiment,
        n_rho=SEARCH_BUDGET.n_rho,
        chi_timestep_prefactor=SEARCH_BUDGET.chi_timestep_prefactor,
    )


def _baseline_heating(baseline: dict[str, Any]) -> HeatingConfig | None:
    config = baseline.get("config") or {}
    try:
        return HeatingConfig(
            heating_location=float(config["heating_location"]),
            heating_width=float(config["heating_width"]),
            heating_power_mw=float(config["heating_power_mw"]),
            duration_s=float(config["duration_s"]),
        )
    except (KeyError, TypeError, ValueError):
        return None


def assess(recording: dict[str, Any]) -> dict[str, Any]:
    """Return conclusion + reasons. Never invents a supported claim."""
    experiments = recording.get("experiments") or []
    baselines = [e for e in experiments if e.get("role") == "baseline"]
    if not baselines:
        return {"conclusion": "inconclusive", "reasons": ["no baseline experiment"]}
    baseline = baselines[0]
    if baseline.get("status") != "completed":
        return {"conclusion": "inconclusive", "reasons": ["baseline did not complete"]}
    metrics = baseline.get("metrics") or {}
    fusion = metrics.get("fusion_energy_mj")
    heating = metrics.get("heating_energy_mj")
    if not _finite_positive(fusion) or not _finite_positive(heating):
        return {
            "conclusion": "inconclusive",
            "reasons": ["baseline metrics are not finite and positive"],
        }
    baseline_heating = _baseline_heating(baseline)
    if baseline_heating is None:
        return {"conclusion": "inconclusive", "reasons": ["baseline heating config is missing"]}
    if not _search_grid_ok(baseline):
        return {
            "conclusion": "inconclusive",
            "reasons": ["baseline grid settings do not match the declared search grid"],
        }

    candidates = [
        e
        for e in experiments
        if e.get("role") in {"candidate", "control"}
        and e.get("status") == "completed"
        and _search_grid_ok(e)
        and _close((e.get("config") or {}).get("heating_power_mw"), baseline_heating.heating_power_mw, atol=1e-6)
        and _close((e.get("config") or {}).get("duration_s"), baseline_heating.duration_s, atol=1e-9)
        and _finite((e.get("metrics") or {}).get("fusion_energy_mj"))
    ]
    ranked = sorted(candidates, key=lambda e: float(e["metrics"]["fusion_energy_mj"]), reverse=True)
    if not ranked:
        return {"conclusion": "inconclusive", "reasons": ["no completed search-grid candidate"]}
    best = ranked[0]
    best_mj = float(best["metrics"]["fusion_energy_mj"])
    gain_pct = 100.0 * (best_mj - float(fusion)) / float(fusion)
    if gain_pct < MIN_IMPROVEMENT_PCT:
        return {
            "conclusion": "inconclusive",
            "reasons": [
                f"best matched-grid candidate gain {gain_pct:.2f}% is below {MIN_IMPROVEMENT_PCT}% threshold"
            ],
        }

    try:
        finalist = HeatingConfig(
            heating_location=float(best["config"]["heating_location"]),
            heating_width=float(best["config"]["heating_width"]),
            heating_power_mw=float(best["config"]["heating_power_mw"]),
            duration_s=float(best["config"]["duration_s"]),
        )
    except (KeyError, TypeError, ValueError):
        return {"conclusion": "inconclusive", "reasons": ["finalist heating config is missing"]}

    cases = verification_cases(finalist)
    refined_baseline = _find_completed(
        experiments,
        heating=baseline_heating,
        n_rho=cases[0].budget.n_rho,
        chi_timestep_prefactor=cases[0].budget.chi_timestep_prefactor,
    )
    refined_candidate = _find_completed(
        experiments,
        heating=finalist,
        n_rho=cases[1].budget.n_rho,
        chi_timestep_prefactor=cases[1].budget.chi_timestep_prefactor,
    )
    perturbed = _find_completed(
        experiments,
        heating=cases[2].config,
        n_rho=cases[2].budget.n_rho,
        chi_timestep_prefactor=cases[2].budget.chi_timestep_prefactor,
    )
    missing: list[str] = []
    if refined_baseline is None:
        missing.append("refined baseline (baseline heating + refined grid)")
    if refined_candidate is None:
        missing.append("refined candidate (finalist heating + refined grid)")
    if perturbed is None:
        missing.append("location perturbation (perturbed heating + search grid)")
    if missing:
        return {
            "conclusion": "inconclusive",
            "reasons": ["missing predeclared checks: " + "; ".join(missing)],
        }

    rb = (refined_baseline.get("metrics") or {}).get("fusion_energy_mj")
    rc = (refined_candidate.get("metrics") or {}).get("fusion_energy_mj")
    pf = (perturbed.get("metrics") or {}).get("fusion_energy_mj")
    if not _finite_positive(rb) or not _finite_positive(rc) or not _finite_positive(pf):
        return {"conclusion": "inconclusive", "reasons": ["verification metrics are not finite and positive"]}
    refined_pct = 100.0 * (float(rc) - float(rb)) / float(rb)
    if refined_pct < MIN_IMPROVEMENT_PCT:
        return {
            "conclusion": "refuted",
            "reasons": [
                f"refined-grid gain {refined_pct:.2f}% is below {MIN_IMPROVEMENT_PCT}% (matched heating + grid)"
            ],
        }
    rel = abs(best_mj - float(rc)) / max(abs(best_mj), 1e-12)
    if rel > REFINEMENT_REL_TOL:
        return {
            "conclusion": "inconclusive",
            "reasons": [
                f"search-grid vs refined-grid disagreement {rel:.2%} exceeds REFINEMENT_REL_TOL={REFINEMENT_REL_TOL}"
            ],
        }
    if float(pf) <= float(fusion):
        return {
            "conclusion": "refuted",
            "reasons": ["location perturbation dropped fusion energy to or below matched-grid baseline"],
        }
    return {
        "conclusion": "supported",
        "reasons": [
            f"matched-grid gain {gain_pct:.2f}% and refined-grid gain {refined_pct:.2f}% both exceed {MIN_IMPROVEMENT_PCT}%",
            "all three predeclared checks matched heating config and grid",
            "location perturbation remained above baseline",
        ],
    }


def conclude(recording: dict[str, Any]) -> dict[str, Any]:
    verdict = assess(recording)
    status = verdict["conclusion"]
    summary = "; ".join(verdict["reasons"])
    titles = {
        "supported": "Verified modest improvement",
        "refuted": "Candidate failed verification",
        "inconclusive": "Inconclusive",
    }
    evidence = [
        experiment["id"]
        for experiment in recording.get("experiments") or []
        if experiment.get("status") == "completed"
    ]
    result: dict[str, Any] = {
        "status": status,
        "title": titles[status],
        "summary": summary,
        "evidence_ids": evidence,
    }
    if status == "supported":
        ranked = [
            experiment
            for experiment in recording.get("experiments") or []
            if experiment.get("role") in {"candidate", "control"} and experiment.get("status") == "completed"
        ]
        if ranked:
            best = max(ranked, key=lambda item: float((item.get("metrics") or {}).get("fusion_energy_mj") or 0.0))
            result["best_experiment_id"] = best["id"]
    return result


def apply_gate(recording: dict[str, Any]) -> dict[str, Any]:
    conclusion = conclude(recording)
    recording["conclusion"] = {
        "status": conclusion["status"],
        "title": conclusion["title"],
        "summary": conclusion["summary"],
        "evidence_ids": conclusion["evidence_ids"],
    }
    if conclusion.get("best_experiment_id"):
        recording["best_experiment_id"] = conclusion["best_experiment_id"]
    if recording.get("status") == "running":
        recording["status"] = "completed"
    return conclusion
