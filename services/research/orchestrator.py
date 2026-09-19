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
from services.research.models import Decision, propose
from services.research.recording import (
    empty_recording,
    experiment_record,
    new_id,
    utcnow,
)
from services.research.validation import HeatingConfig, baseline_config, validate
from services.research.verification import verification_cases

ROOT = Path(__file__).resolve().parents[2]
RUNS_DIR = Path(__file__).resolve().parents[2] / "runtime" / "runs"

Proposer = Callable[[dict[str, Any]], Decision]
ExecutorFn = Callable[[HeatingConfig, ExecutionBudget, str], ExecutionResult]


def _default_executor(
    config: HeatingConfig, budget: ExecutionBudget, experiment_id: str
) -> ExecutionResult:
    return execute(config, budget, experiment_id=experiment_id)


@dataclass
class RunBudget:
    max_experiments: int = 6
    timeout_s: float = 180.0
    seed: int = 0

    def __post_init__(self) -> None:
        if self.max_experiments < 3 or self.max_experiments > 12:
            raise ValueError("max_experiments must be between 3 and 12")


class Investigation:
    def __init__(
        self,
        question: str = preset.QUESTION,
        budget: RunBudget | None = None,
        proposer: Proposer | None = None,
        executor: ExecutorFn | None = None,
        run_id: str | None = None,
    ) -> None:
        self.budget = budget or RunBudget()
        self.proposer = proposer or propose
        self.executor = executor or _default_executor
        self.run_id = run_id or new_id("run-")
        self.dir = RUNS_DIR / self.run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.log = EventLog(self.dir / "events.jsonl")
        self.cancel = threading.Event()
        self.recording = empty_recording(
            run_id=self.run_id,
            title="Fixed-energy heating-profile investigation",
            description=question,
            model="cursor-grok-4.6-high-fast",
            seed=self.budget.seed,
            limitations=[
                "Horizon is 1.0 s, shortened from the documented 5 s example.",
                "Constant transport and heat-only evolution.",
                "Numerical model, not experimental validation.",
            ],
            status="running",
            mode="live",
        )
        self.recording["question"] = question
        self.recording["budget"]["max_experiments"] = self.budget.max_experiments
        self._baseline_mj: float | None = None
        self._lock = threading.Lock()
        self._persist()

    def _persist(self) -> None:
        (self.dir / "recording.json").write_text(
            json.dumps(self.recording, indent=2, default=str) + "\n"
        )

    def _emit(self, **kwargs: Any) -> dict[str, Any]:
        item = self.log.append(run_id=self.run_id, **kwargs)
        self.recording["events"] = self.log.events
        self._persist()
        return item

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
            "remaining": self.budget.max_experiments
            - self.recording["budget"]["completed_experiments"],
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

    def remaining(self) -> int:
        return (
            self.budget.max_experiments
            - self.recording["budget"]["completed_experiments"]
        )

    def start(self) -> None:
        self._emit(
            event_type="run.started",
            title="Investigation started",
            summary=self.recording["question"],
            payload={"seed": self.budget.seed, "max_experiments": self.budget.max_experiments},
        )
        self._persist()

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
        )
        self._baseline_mj = exp["metrics"].get("fusion_energy_mj")
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
        if self.remaining() <= 0 and decision.action in {"experiment", "revise"}:
            decision = Decision(
                ok=True,
                action="stop",
                hypothesis=decision.hypothesis or "budget exhausted",
                prediction="no further experiments",
                rationale="max_experiments reached",
            )
        if decision.action == "stop":
            return self.apply_stop(decision)
        if decision.action == "revise":
            return self.apply_revise(decision)
        if decision.action == "verify":
            return self.run_verification_from_decision(decision)
        if decision.action == "experiment":
            return self._decision_experiment(decision)
        return {"status": "ignored", "decision": decision.as_dict()}

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

    def run_verification_from_decision(self, decision: Decision) -> dict[str, Any]:
        candidate_exp = None
        for exp in reversed(self.recording["experiments"]):
            if exp["role"] == "candidate" and exp["status"] == "completed":
                candidate_exp = exp
                break
        if candidate_exp is None:
            return self.apply_stop(
                Decision(
                    ok=True,
                    action="stop",
                    hypothesis="verify without a candidate",
                    prediction="cannot verify",
                    rationale="no completed candidate to refine",
                )
            )
        cfg = HeatingConfig(
            heating_location=float(candidate_exp["config"]["heating_location"]),
            heating_width=float(candidate_exp["config"]["heating_width"]),
        )
        return self.run_verification(cfg, hypothesis_id=candidate_exp["hypothesis_id"])

    def run_verification(
        self, candidate: HeatingConfig, hypothesis_id: str | None = None
    ) -> dict[str, Any]:
        hyp_id = hypothesis_id or (
            self.recording["hypotheses"][-1]["id"] if self.recording["hypotheses"] else new_id("hyp-")
        )
        self._emit(
            event_type="verification.requested",
            title="Verification requested",
            summary="Refined grid plus frozen location perturbation",
            hypothesis_id=hyp_id,
        )
        outcomes = []
        for case in verification_cases(candidate):
            if self.cancel.is_set() or self.remaining() <= 0:
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
            role="candidate",
            label=decision.hypothesis or "candidate",
        )
        fusion = exp["metrics"].get("fusion_energy_mj")
        delta = None
        if self._baseline_mj and fusion is not None:
            delta = fusion - self._baseline_mj
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
    ) -> dict[str, Any]:
        exp_id = new_id("exp-")
        self._emit(
            event_type="experiment.requested",
            title=f"Request {role}",
            summary=json.dumps(config.as_contract_dict()),
            hypothesis_id=hypothesis_id,
            experiment_id=exp_id,
            payload=config.as_contract_dict(),
        )
        self._emit(
            event_type="experiment.started",
            title=f"{role} started",
            summary=label,
            hypothesis_id=hypothesis_id,
            experiment_id=exp_id,
        )
        exec_budget = budget or ExecutionBudget(timeout_s=self.budget.timeout_s)
        result = self.executor(config, exec_budget, exp_id)
        if not result.ok or not result.output_nc:
            self._emit(
                event_type="experiment.failed",
                title=f"{role} failed",
                summary=result.error or "unknown",
                hypothesis_id=hypothesis_id,
                experiment_id=exp_id,
                payload=result.as_dict(),
            )
            failed = experiment_record(
                experiment_id=exp_id,
                hypothesis_id=hypothesis_id,
                label=label,
                role=role,
                config=config,
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
        record = experiment_record(
            experiment_id=exp_id,
            hypothesis_id=hypothesis_id,
            label=label,
            role=role,
            config=config,
            metrics=metrics.as_contract_metrics(),
            frames=frames,
            artifacts=[
                {
                    "label": "torax-netcdf",
                    "path": artifact_path,
                    "sha256": sha256_file(result.output_nc),
                }
            ],
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
        for hyp in self.recording["hypotheses"]:
            if hyp["id"] == hypothesis_id:
                hyp["experiment_ids"].append(exp_id)
                hyp["evidence_ids"].append(exp_id)
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
        self.recording["status"] = "canceled" if reason == "canceled" else "failed"
        self._emit(
            event_type="run.canceled" if reason == "canceled" else "run.failed",
            title=reason,
            summary=reason,
        )
        self._persist()
        return {"status": reason}

    def run_closed_loop(self, *, include_baseline: bool = True) -> dict[str, Any]:
        """Sequential propose → validate → run until stop, cancel, or budget."""
        if not self.log.events:
            self.start()
        if include_baseline and not self.recording["experiments"]:
            self.run_baseline()
        last: dict[str, Any] = {"status": "started"}
        while self.remaining() > 0 and not self.cancel.is_set():
            decision = self.propose_next()
            if not decision.ok:
                last = self.apply_stop(
                    Decision(
                        ok=True,
                        action="stop",
                        hypothesis="proposer failed",
                        prediction="no further experiments",
                        rationale=decision.error or "proposer error",
                    )
                )
                last["proposer_error"] = decision.error
                break
            last = self.apply_decision(decision)
            if last.get("status") in {"stopped", "canceled", "failed", "verified"}:
                break
        if self.cancel.is_set() and self.recording["status"] == "running":
            last = self._fail_run("canceled")
        self._persist()
        return last

    def propose_next(self) -> Decision:
        return self.proposer(self.context())
