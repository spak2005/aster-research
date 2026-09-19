"""Closed-loop investigation: hypothesis → validated experiment → evidence.

The proposer is injected. This module never treats a grid sweep as research.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from experiments.torax import preset
from services.research.events import EventLog
from services.research.executor import ExecutionBudget, ExecutionResult, execute
from services.research.frames import extract_frames, sha256_file
from services.research.metrics import extract_from_path
from services.research.models import Decision, propose, recorded_model_name
from services.research.recording import (
    atomic_write_json,
    empty_recording,
    experiment_record,
    new_id,
    utcnow,
)
from services.research.validation import HeatingConfig, baseline_config, validate
from services.research.verification import SEARCH_BUDGET, verification_cases

ROOT = Path(__file__).resolve().parents[2]
RUNS_DIR = Path(__file__).resolve().parents[2] / "runtime" / "runs"

Proposer = Callable[[dict[str, Any]], Decision]
ExecutorFn = Callable[[HeatingConfig, ExecutionBudget, str], ExecutionResult]


def _default_executor(
    config: HeatingConfig, budget: ExecutionBudget, experiment_id: str
) -> ExecutionResult:
    return execute(config, budget, experiment_id=experiment_id)


def _grid_matches(experiment: dict[str, Any], budget: ExecutionBudget) -> bool:
    config = experiment.get("config") or {}
    try:
        n_rho = int(config.get("n_rho"))
    except (TypeError, ValueError):
        return False
    try:
        chi = float(config.get("chi_timestep_prefactor"))
    except (TypeError, ValueError):
        return False
    return n_rho == int(budget.n_rho) and abs(chi - float(budget.chi_timestep_prefactor)) < 1e-9


@dataclass
class RunBudget:
    max_experiments: int = 6
    timeout_s: float = 180.0
    seed: int = 0
    search_slots: int | None = None
    verification_slots: int = 0
    max_proposal_attempts: int | None = None

    def __post_init__(self) -> None:
        if self.max_experiments < 3 or self.max_experiments > 12:
            raise ValueError("max_experiments must be between 3 and 12")
        if self.verification_slots < 0:
            raise ValueError("verification_slots must be >= 0")
        search = self.max_experiments - self.verification_slots if self.search_slots is None else self.search_slots
        if search < 1:
            raise ValueError("search_slots must be at least 1")
        if search + self.verification_slots > self.max_experiments:
            raise ValueError("search_slots + verification_slots exceeds max_experiments")
        self.search_slots = search
        if self.max_proposal_attempts is None:
            self.max_proposal_attempts = max(12, 2 * search)


class Investigation:
    def __init__(
        self,
        question: str = preset.QUESTION,
        budget: RunBudget | None = None,
        proposer: Proposer | None = None,
        executor: ExecutorFn | None = None,
        run_id: str | None = None,
        title: str | None = None,
        model: str | None = None,
        limitations: list[str] | None = None,
        mode: str = "live",
        search_role: str = "candidate",
    ) -> None:
        self.budget = budget or RunBudget()
        self.proposer = proposer or propose
        self.executor = executor or _default_executor
        self.run_id = run_id or new_id("run-")
        self.dir = RUNS_DIR / self.run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        (self.dir / "proposals").mkdir(exist_ok=True)
        (self.dir / "logs").mkdir(exist_ok=True)
        self.log = EventLog(self.dir / "events.jsonl")
        self.cancel = threading.Event()
        self.recording = empty_recording(
            run_id=self.run_id,
            title=title or "Fixed-energy heating-profile investigation",
            description=question,
            model=model if model is not None else recorded_model_name(),
            seed=self.budget.seed,
            limitations=limitations
            or [
                "Horizon is 1.0 s, shortened from the documented 5 s example.",
                "Constant transport and heat-only evolution.",
                "Numerical model, not experimental validation.",
                "Cancel is cooperative: honored between experiments, not mid-JAX step.",
            ],
            status="running",
            mode=mode,
            max_experiments=self.budget.max_experiments,
            search_slots=int(self.budget.search_slots or 0),
            verification_slots=self.budget.verification_slots,
        )
        self.recording["question"] = question
        self._baseline_mj: float | None = None
        self._proposal_attempts = 0
        self._proposal_seq = 0
        self._last_proposal_path: Path | None = None
        self._frozen_finalist: dict[str, Any] | None = None
        self.search_role = search_role
        self._lock = threading.Lock()
        self._persist()

    def _persist(self) -> None:
        atomic_write_json(self.dir / "recording.json", self.recording)

    def _emit(self, **kwargs: Any) -> dict[str, Any]:
        item = self.log.append(run_id=self.run_id, **kwargs)
        self.recording["events"] = self.log.events
        self._persist()
        return item

    def _search_completed(self) -> int:
        return sum(
            1
            for exp in self.recording["experiments"]
            if exp.get("role") in {"baseline", "candidate", "control"}
        )

    def _verification_completed(self) -> int:
        return sum(1 for exp in self.recording["experiments"] if exp.get("role") == "verification")

    def remaining(self) -> int:
        return (
            self.budget.max_experiments
            - self.recording["budget"]["completed_experiments"]
        )

    def remaining_search(self) -> int:
        return max(0, int(self.budget.search_slots or 0) - self._search_completed())

    def remaining_verification(self) -> int:
        return max(0, self.budget.verification_slots - self._verification_completed())

    def context(self) -> dict[str, Any]:
        experiments = []
        for exp in self.recording["experiments"]:
            experiments.append(
                {
                    "id": exp["id"],
                    "role": exp["role"],
                    "status": exp["status"],
                    "config": exp["config"],
                    "metrics": {
                        k: exp["metrics"].get(k)
                        for k in (
                            "fusion_energy_mj",
                            "heating_energy_mj",
                            "peak_ion_temperature_kev",
                            "improvement_pct",
                        )
                    },
                    "checks": exp["checks"],
                }
            )
        return {
            "question": self.recording["question"],
            "objective": preset.OBJECTIVE,
            "objective_units": preset.OBJECTIVE_UNITS,
            "location_bounds": list(preset.LOCATION_BOUNDS),
            "width_bounds": list(preset.WIDTH_BOUNDS),
            "frozen_power_mw": 51.0,
            "frozen_duration_s": preset.T_FINAL_S,
            "baseline_fusion_energy_mj": self._baseline_mj,
            "completed_experiments": self.recording["budget"]["completed_experiments"],
            "max_experiments": self.budget.max_experiments,
            "remaining": self.remaining(),
            "search_budget": {
                "used": self._search_completed(),
                "max": self.budget.search_slots,
                "remaining": self.remaining_search(),
            },
            "verification_budget": {
                "reserved": self.budget.verification_slots,
                "used": self._verification_completed(),
                "remaining": self.remaining_verification(),
                "note": "Verification runs only after the search finalist is frozen.",
            },
            "proposal_attempts": self._proposal_attempts,
            "max_proposal_attempts": self.budget.max_proposal_attempts,
            "frozen_finalist_id": None if self._frozen_finalist is None else self._frozen_finalist["id"],
            "hypotheses": [
                {
                    "id": hyp["id"],
                    "title": hyp["title"],
                    "prediction": hyp["prediction"],
                    "status": hyp["status"],
                    "assessment": hyp["assessment"],
                }
                for hyp in self.recording["hypotheses"]
            ],
            "experiments": experiments,
            "canceled": self.cancel.is_set(),
        }

    def request_cancel(self) -> None:
        self.cancel.set()

    def start(self) -> None:
        self._emit(
            event_type="run.started",
            title="Investigation started",
            summary=self.recording["question"],
            payload={
                "seed": self.budget.seed,
                "max_experiments": self.budget.max_experiments,
                "search_slots": self.budget.search_slots,
                "verification_slots": self.budget.verification_slots,
                "model": self.recording["model"],
            },
        )
        self._persist()

    def _link_experiment(self, hypothesis_id: str, experiment_id: str) -> None:
        for hyp in self.recording["hypotheses"]:
            if hyp["id"] == hypothesis_id:
                if experiment_id not in hyp["experiment_ids"]:
                    hyp["experiment_ids"].append(experiment_id)
                if experiment_id not in hyp["evidence_ids"]:
                    hyp["evidence_ids"].append(experiment_id)

    def run_baseline(self) -> dict[str, Any]:
        hyp_id = new_id("hyp-")
        self.recording["hypotheses"].append(
            {
                "id": hyp_id,
                "parent_id": None,
                "title": "Measure the frozen ITER-hybrid heating baseline",
                "prediction": "E_fusion is finite and heating energy is 51 MJ at 1.0 s.",
                "status": "running",
                "assessment": "",
                "experiment_ids": [],
                "evidence_ids": [],
                "created_sequence": self.log.next_sequence(),
            }
        )
        self._emit(
            event_type="hypothesis.proposed",
            title="Baseline hypothesis",
            summary="The documented generic_heat settings are the reference.",
            hypothesis_id=hyp_id,
            payload={
                "prediction": "E_fusion is finite and heating energy is 51 MJ at 1.0 s."
            },
        )
        exp = self._run_experiment(
            hypothesis_id=hyp_id,
            config=baseline_config(),
            role="baseline",
            label="ITER-hybrid baseline",
            budget=ExecutionBudget(timeout_s=self.budget.timeout_s),
        )
        if exp["status"] != "completed":
            self._assess(
                hyp_id,
                f"Baseline failed: {exp.get('error') or 'solver error'}. Not used as a measured zero reference.",
                "abandoned",
            )
            self._fail_run("baseline failed")
            return exp
        fusion = exp["metrics"].get("fusion_energy_mj")
        try:
            fusion_f = float(fusion)
        except (TypeError, ValueError):
            fusion_f = float("nan")
        if not (fusion_f == fusion_f and fusion_f > 0):
            self._assess(
                hyp_id,
                "Baseline metrics were not finite and positive. Study stopped.",
                "abandoned",
            )
            self._fail_run("baseline failed")
            return exp
        self._baseline_mj = fusion_f
        self.recording["baseline_id"] = exp["id"]
        self._assess(
            hyp_id,
            (
                f"Baseline E_fusion={self._baseline_mj} MJ at 51 MJ heating. "
                "Reference only; not an improvement claim."
            ),
            status="inconclusive",
        )
        return exp

    def apply_decision(self, decision: Decision) -> dict[str, Any]:
        """Turn a proposer decision into revise/branch/stop or an experiment."""
        if self.cancel.is_set():
            return self._fail_run("canceled")
        if self.recording["status"] in {"failed", "canceled"}:
            return {"status": self.recording["status"]}
        if decision.action == "verify":
            return self._reject_early_verify(decision)
        if self.remaining_search() <= 0 and decision.action in {"experiment", "revise"}:
            decision = Decision(
                ok=True,
                action="stop",
                hypothesis=decision.hypothesis or "search budget exhausted",
                prediction="no further search experiments",
                rationale="search_slots reached; verification is reserved",
            )
        if decision.action == "stop":
            return self.apply_stop(decision)
        if decision.action == "revise":
            return self.apply_revise(decision)
        if decision.action == "experiment":
            return self._decision_experiment(decision)
        return {"status": "ignored", "decision": decision.as_dict()}

    def _reject_early_verify(self, decision: Decision) -> dict[str, Any]:
        self._emit(
            event_type="hypothesis.revised",
            title="Verification withheld until freeze",
            summary="Verification slots are reserved for the frozen finalist.",
            payload=decision.as_dict(),
        )
        return {
            "status": "rejected",
            "reason": "verification reserved until the search finalist is frozen",
        }

    def apply_stop(self, decision: Decision) -> dict[str, Any]:
        parent = self.recording["hypotheses"][-1]["id"] if self.recording["hypotheses"] else None
        summary = decision.rationale or decision.hypothesis or "Proposer requested stop."
        if parent:
            self._assess(parent, summary, "abandoned")
        self._emit(
            event_type="hypothesis.revised",
            title="Stop requested",
            summary=summary,
            hypothesis_id=parent,
            payload=decision.as_dict(),
        )
        return {"status": "stopped", "decision": decision.as_dict()}

    def apply_revise(self, decision: Decision) -> dict[str, Any]:
        parent = self.recording["hypotheses"][-1]["id"] if self.recording["hypotheses"] else None
        self._emit(
            event_type="hypothesis.revised",
            title=decision.hypothesis or "Revised hypothesis",
            summary=decision.prediction,
            hypothesis_id=parent,
            payload=decision.as_dict(),
        )
        if parent and any(
            hyp["id"] != parent and hyp.get("parent_id") == (
                self.recording["hypotheses"][0]["id"] if self.recording["hypotheses"] else None
            )
            for hyp in self.recording["hypotheses"]
        ):
            self._emit(
                event_type="branch.created",
                title="Branch from revised hypothesis",
                summary=decision.hypothesis or "branch",
                hypothesis_id=parent,
                parent_id=parent,
            )
        return self._decision_experiment(decision)

    def apply_branch(self, decision: Decision, parent_id: str | None = None) -> dict[str, Any]:
        parent_id = parent_id or (
            self.recording["hypotheses"][0]["id"] if self.recording["hypotheses"] else None
        )
        self._emit(
            event_type="branch.created",
            title=decision.hypothesis or "Branch",
            summary=decision.prediction,
            parent_id=parent_id,
            payload=decision.as_dict(),
        )
        return self._decision_experiment(decision)

    def freeze_finalist(self) -> dict[str, Any] | None:
        """Freeze the best completed search-grid candidate before verification."""
        ranked = [
            exp
            for exp in self.recording["experiments"]
            if exp.get("role") in {"candidate", "control"}
            and exp.get("status") == "completed"
            and _grid_matches(exp, SEARCH_BUDGET)
        ]
        if not ranked:
            return None
        best = max(ranked, key=lambda exp: float((exp.get("metrics") or {}).get("fusion_energy_mj") or float("-inf")))
        self._frozen_finalist = best
        self.recording["best_experiment_id"] = best["id"]
        self._emit(
            event_type="verification.requested",
            title="Finalist frozen",
            summary=f"Frozen finalist {best['id']} before reserved checks",
            hypothesis_id=best.get("hypothesis_id"),
            experiment_id=best["id"],
            evidence_ids=[best["id"]],
            payload={
                "frozen_finalist_id": best["id"],
                "config": best.get("config"),
                "metrics": best.get("metrics"),
            },
        )
        self._persist()
        return best

    def run_verification(
        self, candidate: HeatingConfig, hypothesis_id: str | None = None
    ) -> dict[str, Any]:
        hyp_id = hypothesis_id or (
            self.recording["hypotheses"][-1]["id"] if self.recording["hypotheses"] else new_id("hyp-")
        )
        outcomes = []
        for case in verification_cases(candidate):
            if self.cancel.is_set() or self.remaining() <= 0 or self.remaining_verification() <= 0:
                break
            outcomes.append(
                self._run_experiment(
                    hypothesis_id=hyp_id,
                    config=case.config,
                    role="verification",
                    label=case.name,
                    budget=case.budget,
                )
            )
        self._emit(
            event_type="verification.completed",
            title="Verification finished",
            summary=f"{len(outcomes)} verification runs",
            hypothesis_id=hyp_id,
            evidence_ids=[item["id"] for item in outcomes],
        )
        return {"status": "verified", "experiments": outcomes}

    def freeze_and_verify(self) -> dict[str, Any]:
        frozen = self.freeze_finalist()
        if frozen is None:
            return {"status": "no_finalist"}
        cfg = HeatingConfig(
            heating_location=float(frozen["config"]["heating_location"]),
            heating_width=float(frozen["config"]["heating_width"]),
            heating_power_mw=float(frozen["config"]["heating_power_mw"]),
            duration_s=float(frozen["config"]["duration_s"]),
        )
        return self.run_verification(cfg, hypothesis_id=frozen.get("hypothesis_id"))

    def _decision_experiment(self, decision: Decision) -> dict[str, Any]:
        parent_id = (
            self.recording["hypotheses"][-1]["id"]
            if self.recording["hypotheses"]
            else None
        )
        hyp_id = new_id("hyp-")
        self.recording["hypotheses"].append(
            {
                "id": hyp_id,
                "parent_id": parent_id,
                "title": decision.hypothesis or "Heating-profile hypothesis",
                "prediction": decision.prediction,
                "status": "running",
                "assessment": "",
                "experiment_ids": [],
                "evidence_ids": [],
                "created_sequence": self.log.next_sequence(),
            }
        )
        self._emit(
            event_type="hypothesis.proposed",
            title=decision.hypothesis or "Hypothesis",
            summary=decision.prediction,
            hypothesis_id=hyp_id,
            parent_id=parent_id,
            payload=decision.as_dict(),
        )
        if decision.heating_location is None or decision.heating_width is None:
            self._assess(hyp_id, "Proposer omitted heating parameters.", "abandoned")
            return {"status": "rejected", "reason": "missing heating parameters"}
        validated = validate(
            {
                "heating_location": decision.heating_location,
                "heating_width": decision.heating_width,
            }
        )
        if not validated.accepted or validated.config is None:
            self._assess(
                hyp_id,
                "Rejected by harness validation: " + "; ".join(validated.errors),
                "abandoned",
            )
            return {"status": "rejected", "errors": validated.errors}
        exp = self._run_experiment(
            hypothesis_id=hyp_id,
            config=validated.config,
            role=self.search_role,
            label=decision.hypothesis or "candidate",
            budget=ExecutionBudget(timeout_s=self.budget.timeout_s),
            proposal_path=self._last_proposal_path,
        )
        if exp["status"] != "completed":
            self._assess(
                hyp_id,
                f"Experiment failed: {exp.get('error') or 'solver error'}",
                "abandoned",
            )
            return {"status": "experiment_failed", "experiment": exp}
        fusion = exp["metrics"].get("fusion_energy_mj")
        delta = None
        if self._baseline_mj is not None and fusion is not None:
            delta = float(fusion) - self._baseline_mj
        assessment = (
            f"Measured E_fusion={fusion} MJ "
            f"(Δ vs baseline {delta} MJ). Prediction: {decision.prediction}"
        )
        self._assess(hyp_id, assessment, "inconclusive")
        return {"status": "experiment_completed", "experiment": exp}

    def _run_experiment(
        self,
        *,
        hypothesis_id: str,
        config: HeatingConfig,
        role: str,
        label: str,
        budget: ExecutionBudget | None = None,
        proposal_path: Path | None = None,
    ) -> dict[str, Any]:
        exp_id = new_id("exp-")
        exec_budget = budget or ExecutionBudget(timeout_s=self.budget.timeout_s)
        self._emit(
            event_type="experiment.requested",
            title=f"Request {role}",
            summary=json.dumps(config.as_contract_dict()),
            hypothesis_id=hypothesis_id,
            experiment_id=exp_id,
            payload={**config.as_contract_dict(), "n_rho": exec_budget.n_rho},
        )
        self._emit(
            event_type="experiment.started",
            title=f"{role} started",
            summary=label,
            hypothesis_id=hypothesis_id,
            experiment_id=exp_id,
        )
        result = self.executor(config, exec_budget, exp_id)
        if not result.ok or not result.output_nc:
            failed = experiment_record(
                experiment_id=exp_id,
                hypothesis_id=hypothesis_id,
                label=label,
                role=role,
                config=config,
                budget=exec_budget,
                metrics={
                    "fusion_energy_mj": 0.0,
                    "heating_energy_mj": 0.0,
                    "peak_ion_temperature_kev": 0.0,
                    "improvement_pct": None,
                },
                frames=[],
                artifacts=[],
                checks=[
                    {
                        "name": "solver_success",
                        "status": "failed",
                        "detail": result.error or "failed",
                    }
                ],
                wall_time_s=result.wall_time_s,
                status="failed",
                error=result.error,
            )
            self.recording["experiments"].append(failed)
            self.recording["budget"]["completed_experiments"] += 1
            self.recording["budget"]["wall_time_s"] += result.wall_time_s
            self._link_experiment(hypothesis_id, exp_id)
            self._emit(
                event_type="experiment.failed",
                title=f"{role} failed",
                summary=result.error or "unknown",
                hypothesis_id=hypothesis_id,
                experiment_id=exp_id,
                evidence_ids=[exp_id],
                payload=result.as_dict(),
            )
            self._persist()
            return failed

        metrics = extract_from_path(
            result.output_nc,
            baseline_fusion_energy_mj=self._baseline_mj,
        )
        import xarray as xr

        tree = xr.open_datatree(result.output_nc)
        try:
            frames = extract_frames(tree)
        finally:
            tree.close()
        try:
            artifact_path = str(Path(result.output_nc).resolve().relative_to(ROOT))
        except ValueError:
            artifact_path = result.output_nc
        artifacts = [
            {
                "label": "torax-netcdf",
                "path": artifact_path,
                "sha256": sha256_file(result.output_nc),
            }
        ]
        if proposal_path is not None and proposal_path.exists():
            artifacts.append(
                {
                    "label": "proposer-decision",
                    "path": str(proposal_path),
                    "sha256": sha256_file(proposal_path),
                }
            )
        record = experiment_record(
            experiment_id=exp_id,
            hypothesis_id=hypothesis_id,
            label=label,
            role=role,
            config=config,
            budget=exec_budget,
            metrics=metrics.as_contract_metrics(),
            frames=frames,
            artifacts=artifacts,
            checks=[
                {"name": c.name, "status": c.status, "detail": c.detail}
                for c in metrics.checks
            ]
            + [
                {
                    "name": "solver_success",
                    "status": "passed",
                    "detail": str(result.sim_status),
                }
            ],
            wall_time_s=result.wall_time_s,
        )
        self.recording["experiments"].append(record)
        self.recording["budget"]["completed_experiments"] += 1
        self.recording["budget"]["wall_time_s"] += result.wall_time_s
        self._link_experiment(hypothesis_id, exp_id)
        peak = max(
            metrics.peak_ion_temperature_kev,
            metrics.peak_electron_temperature_kev,
            self.recording["temperature_scale_kev"][1],
        )
        self.recording["temperature_scale_kev"] = [0.0, float(max(25.0, peak))]
        self._emit(
            event_type="experiment.completed",
            title=f"{role} completed",
            summary=(
                f"E_fusion={metrics.fusion_energy_mj:.4f} MJ "
                f"E_aux={metrics.heating_energy_mj:.4f} MJ"
            ),
            hypothesis_id=hypothesis_id,
            experiment_id=exp_id,
            evidence_ids=[exp_id],
            payload=metrics.as_contract_metrics(),
        )
        self._persist()
        return record

    def _assess(self, hypothesis_id: str, text: str, status: str) -> None:
        for hyp in self.recording["hypotheses"]:
            if hyp["id"] == hypothesis_id:
                hyp["assessment"] = text
                hyp["status"] = status
                hyp["resolved_sequence"] = self.log.next_sequence()
        self._emit(
            event_type="assessment.recorded",
            title="Assessment",
            summary=text,
            hypothesis_id=hypothesis_id,
            payload={"status": status},
        )

    def _fail_run(self, reason: str) -> dict[str, Any]:
        status = "canceled" if reason == "canceled" else "failed"
        self.recording["status"] = status
        self.recording["conclusion"] = {
            "status": "inconclusive",
            "title": "Run failed" if status == "failed" else "Run canceled",
            "summary": reason,
            "evidence_ids": [
                exp["id"] for exp in self.recording["experiments"]
            ],
        }
        self._emit(
            event_type="run.canceled" if status == "canceled" else "run.failed",
            title=reason,
            summary=reason,
        )
        self._persist()
        return {"status": status, "reason": reason}

    def _record_proposal(self, context: dict[str, Any], decision: Decision) -> Path:
        self._proposal_seq += 1
        seq = self._proposal_seq
        summary = {
            "model": self.recording["model"],
            "recorded_at": utcnow(),
            "context": context,
            "decision": decision.as_dict(),
        }
        path = self.dir / "proposals" / f"{seq:04d}.json"
        atomic_write_json(path, summary)
        self._last_proposal_path = path
        if decision.raw_text:
            (self.dir / "logs" / f"proposer-{seq:04d}.stdout.txt").write_text(
                decision.raw_text
            )
        if decision.envelope:
            atomic_write_json(self.dir / "logs" / f"proposer-{seq:04d}.envelope.json", decision.envelope)
        return path

    def run_closed_loop(self, *, include_baseline: bool = True) -> dict[str, Any]:
        """Sequential propose → validate → run until stop, cancel, or budget."""
        if not self.log.events:
            self.start()
        if include_baseline and not self.recording["experiments"]:
            baseline = self.run_baseline()
            if baseline.get("status") != "completed" or self.recording["status"] == "failed":
                return {"status": "failed", "reason": "baseline failed"}
        last: dict[str, Any] = {"status": "started"}
        max_attempts = int(self.budget.max_proposal_attempts or 12)
        while (
            self.remaining_search() > 0
            and self._proposal_attempts < max_attempts
            and not self.cancel.is_set()
            and self.recording["status"] == "running"
        ):
            decision = self.propose_next()
            self._proposal_attempts += 1
            if not decision.ok:
                last = {"status": "rejected", "reason": decision.error or "invalid decision"}
                if self._proposal_attempts >= max_attempts:
                    last = self.apply_stop(
                        Decision(
                            ok=True,
                            action="stop",
                            hypothesis="proposal attempt bound reached",
                            prediction="no further experiments",
                            rationale=decision.error or "too many invalid proposals",
                        )
                    )
                    last["proposer_error"] = decision.error
                    break
                continue
            last = self.apply_decision(decision)
            if last.get("status") in {"stopped", "canceled", "failed"}:
                break
        if (
            self.recording["status"] == "running"
            and self._proposal_attempts >= max_attempts
            and self.remaining_search() > 0
            and last.get("status") not in {"stopped", "canceled", "failed"}
        ):
            last = self.apply_stop(
                Decision(
                    ok=True,
                    action="stop",
                    hypothesis="proposal attempt bound reached",
                    prediction="no further experiments",
                    rationale="too many invalid or rejected proposals without consuming leftover search slots",
                )
            )
        if (
            self.recording["status"] == "running"
            and not self.cancel.is_set()
            and self.budget.verification_slots > 0
            and self.remaining_verification() > 0
        ):
            last = self.freeze_and_verify()
        if self.cancel.is_set() and self.recording["status"] == "running":
            last = self._fail_run("canceled")
            return last
        if self.recording["status"] == "failed":
            return last
        last["conclusion"] = self.finish()
        self._persist()
        return last

    def propose_next(self) -> Decision:
        ctx = self.context()
        decision = self.proposer(ctx)
        self._record_proposal(ctx, decision)
        return decision

    def finish(self) -> dict[str, Any]:
        from services.research.gate import apply_gate

        if self.recording["status"] == "failed":
            return self.recording["conclusion"]
        conclusion = apply_gate(self.recording)
        self._emit(
            event_type="conclusion.recorded",
            title=conclusion["title"],
            summary=conclusion["summary"],
            evidence_ids=conclusion["evidence_ids"],
            payload={"status": conclusion["status"]},
        )
        self._emit(
            event_type="run.completed",
            title="Run completed",
            summary=conclusion["summary"],
        )
        self._persist()
        return conclusion
