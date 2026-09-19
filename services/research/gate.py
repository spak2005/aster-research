"""Deterministic conclusion gate. Agent text cannot raise the verdict."""

from __future__ import annotations

from typing import Any

from services.research.verification import MIN_IMPROVEMENT_PCT, REFINEMENT_REL_TOL


def _completed(exps: list[dict[str, Any]], role: str) -> list[dict[str, Any]]:
    return [
        exp
        for exp in exps
        if exp.get("role") == role and exp.get("status") == "completed"
    ]


def _fusion(exp: dict[str, Any] | None) -> float | None:
    if not exp:
        return None
    value = exp.get("metrics", {}).get("fusion_energy_mj")
    return None if value is None else float(value)


def _checks_ok(exp: dict[str, Any]) -> bool:
    checks = exp.get("checks") or []
    if not checks:
        return False
    return all(item.get("status") == "passed" for item in checks)


def conclude(recording: dict[str, Any]) -> dict[str, Any]:
    experiments = recording.get("experiments") or []
    baselines = _completed(experiments, "baseline")
    candidates = _completed(experiments, "candidate")
    verifications = _completed(experiments, "verification")
    failed = [exp for exp in experiments if exp.get("status") == "failed"]

    if not baselines:
        return {
            "status": "inconclusive",
            "title": "No baseline",
            "summary": "The gate requires a completed baseline before any claim.",
            "evidence_ids": [exp["id"] for exp in failed],
        }

    baseline = baselines[0]
    baseline_mj = _fusion(baseline)
    evidence = [baseline["id"]]

    if baseline_mj is None or not _checks_ok(baseline):
        return {
            "status": "inconclusive",
            "title": "Baseline checks failed",
            "summary": "Baseline fusion energy is missing or checks did not pass.",
            "evidence_ids": evidence,
        }

    ranked = []
    for cand in candidates:
        fusion = _fusion(cand)
        if fusion is None or not _checks_ok(cand):
            continue
        improvement_pct = (fusion - baseline_mj) / abs(baseline_mj) * 100.0
        ranked.append((improvement_pct, cand, fusion))
    ranked.sort(key=lambda item: item[0], reverse=True)

    if not ranked or ranked[0][0] < MIN_IMPROVEMENT_PCT:
        best = ranked[0][1] if ranked else None
        if best:
            evidence.append(best["id"])
        summary = (
            f"No candidate improved integrated E_fusion by at least "
            f"{MIN_IMPROVEMENT_PCT}% versus baseline {baseline_mj:.3f} MJ."
        )
        if ranked:
            summary += f" Best apparent change: {ranked[0][0]:.2f}%."
        if failed:
            summary += " Failed simulations cannot receive a supported label."
        return {
            "status": "inconclusive",
            "title": "No verified improvement",
            "summary": summary,
            "evidence_ids": evidence,
        }

    improvement_pct, finalist, fusion = ranked[0]
    evidence.append(finalist["id"])

    refined_base = next(
        (exp for exp in verifications if exp.get("label") == "baseline_refined"),
        None,
    )
    refined_cand = next(
        (exp for exp in verifications if exp.get("label") == "candidate_refined"),
        None,
    )
    perturbed = next(
        (
            exp
            for exp in verifications
            if exp.get("label") == "candidate_location_perturbation"
        ),
        None,
    )

    if refined_base is None or refined_cand is None:
        return {
            "status": "inconclusive",
            "title": "Improvement not verified",
            "summary": (
                f"Apparent gain {improvement_pct:.2f}% on the search grid is "
                "below the supported label until refinement checks run."
            ),
            "evidence_ids": evidence,
        }

    rb = _fusion(refined_base)
    rc = _fusion(refined_cand)
    evidence.extend([refined_base["id"], refined_cand["id"]])
    if rb is None or rc is None or not _checks_ok(refined_base) or not _checks_ok(refined_cand):
        return {
            "status": "inconclusive",
            "title": "Refinement checks incomplete",
            "summary": "Refined runs did not both complete with passing checks.",
            "evidence_ids": evidence,
        }

    refined_pct = (rc - rb) / abs(rb) * 100.0
    if refined_pct < MIN_IMPROVEMENT_PCT:
        return {
            "status": "refuted",
            "title": "Apparent gain did not survive refinement",
            "summary": (
                f"Search-grid gain {improvement_pct:.2f}% became {refined_pct:.2f}% "
                f"on n_rho={refined_cand.get('config', {})} after refinement "
                f"(threshold {MIN_IMPROVEMENT_PCT}%)."
            ),
            "evidence_ids": evidence,
        }

    if abs(fusion - rc) / max(abs(fusion), 1e-9) > REFINEMENT_REL_TOL * 4:
        # large disagreement between grids: do not support
        return {
            "status": "inconclusive",
            "title": "Grid disagreement",
            "summary": (
                f"Search-grid E_fusion {fusion:.3f} MJ vs refined {rc:.3f} MJ "
                "disagrees enough that the gain is not supported."
            ),
            "evidence_ids": evidence,
        }

    if perturbed is not None:
        evidence.append(perturbed["id"])
        pf = _fusion(perturbed)
        if pf is None or not _checks_ok(perturbed) or pf <= baseline_mj:
            return {
                "status": "refuted",
                "title": "Gain vanished under location perturbation",
                "summary": (
                    "Frozen +0.03 rho perturbation did not stay above baseline."
                ),
                "evidence_ids": evidence,
            }

    return {
        "status": "supported",
        "title": "Verified modest improvement",
        "summary": (
            f"Candidate {finalist['id']} improved E_fusion by {improvement_pct:.2f}% "
            f"on the search grid and {refined_pct:.2f}% after refinement "
            f"(threshold {MIN_IMPROVEMENT_PCT}%)."
        ),
        "evidence_ids": evidence,
        "best_experiment_id": finalist["id"],
    }


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
