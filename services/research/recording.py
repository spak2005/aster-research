"""Build a contract-shaped Recording dict from real experiments."""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from experiments.torax import preset
from services.research.executor import ExecutionBudget, solver_config_hash
from services.research.validation import HeatingConfig


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def new_id(prefix: str = "") -> str:
    token = uuid.uuid4().hex[:10]
    return f"{prefix}{token}" if prefix else token


def atomic_write_json(path: Path, payload: Any) -> None:
    """Write JSON via a same-directory temp file then os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, indent=2, default=str) + "\n"
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def event(
    *,
    run_id: str,
    sequence: int,
    event_type: str,
    title: str,
    summary: str,
    timestamp: str | None = None,
    hypothesis_id: str | None = None,
    experiment_id: str | None = None,
    parent_id: str | None = None,
    evidence_ids: list[str] | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "schema_version": "1.0",
        "event_id": new_id("ev-"),
        "run_id": run_id,
        "sequence": sequence,
        "timestamp": timestamp or utcnow(),
        "type": event_type,
        "title": title,
        "summary": summary,
        "evidence_ids": evidence_ids or [],
        "payload": payload or {},
    }
    if hypothesis_id is not None:
        body["hypothesis_id"] = hypothesis_id
    if experiment_id is not None:
        body["experiment_id"] = experiment_id
    if parent_id is not None:
        body["parent_id"] = parent_id
    return body


def experiment_config_dict(
    config: HeatingConfig,
    budget: ExecutionBudget,
) -> dict[str, Any]:
    return {
        **config.as_contract_dict(),
        "n_rho": int(budget.n_rho),
        "chi_timestep_prefactor": float(budget.chi_timestep_prefactor),
        "max_dt_s": float(budget.max_dt_s),
        "transport": "constant",
        "preset": "fixed-energy",
        "config_hash": solver_config_hash(config, budget),
    }


def experiment_record(
    *,
    experiment_id: str,
    hypothesis_id: str,
    label: str,
    role: str,
    config: HeatingConfig,
    budget: ExecutionBudget | None = None,
    metrics: dict[str, Any],
    frames: list[dict[str, Any]],
    artifacts: list[dict[str, Any]],
    checks: list[dict[str, Any]],
    wall_time_s: float,
    status: str = "completed",
    error: str | None = None,
) -> dict[str, Any]:
    exec_budget = budget or ExecutionBudget()
    record = {
        "id": experiment_id,
        "hypothesis_id": hypothesis_id,
        "label": label,
        "role": role,
        "status": status,
        "config": experiment_config_dict(config, exec_budget),
        "metrics": metrics,
        "frames": frames,
        "artifacts": artifacts,
        "checks": checks,
        "wall_time_s": wall_time_s,
    }
    if error:
        record["error"] = error
    return record


def empty_recording(
    *,
    run_id: str,
    title: str,
    description: str,
    model: str,
    seed: int,
    limitations: list[str],
    status: str = "running",
    mode: str = "recorded",
    max_experiments: int = 6,
    search_slots: int = 6,
    verification_slots: int = 0,
) -> dict[str, Any]:
    provenance_hash = solver_config_hash(
        HeatingConfig(
            heating_location=preset.BASELINE_LOCATION,
            heating_width=preset.BASELINE_WIDTH,
        ),
        ExecutionBudget(),
    )
    return {
        "schema_version": "1.0",
        "id": run_id,
        "title": title,
        "question": preset.QUESTION,
        "created_at": utcnow(),
        "mode": mode,
        "status": status,
        "simulator": "TORAX 1.4.3",
        "model": model,
        "description": description,
        "limitations": limitations,
        "provenance": {
            "software_versions": {
                "torax": "1.4.3",
                "preset": "iterhybrid_predictor_corrector_bounded",
                "transport": "constant",
            },
            "seed": seed,
            "objective": preset.OBJECTIVE,
            "objective_units": preset.OBJECTIVE_UNITS,
            "config_hash": provenance_hash,
        },
        "budget": {
            "max_experiments": max_experiments,
            "completed_experiments": 0,
            "wall_time_s": 0.0,
            "search_slots": search_slots,
            "verification_slots": verification_slots,
        },
        "baseline_id": "",
        "best_experiment_id": None,
        "temperature_scale_kev": [0.0, 25.0],
        "geometry": dict(preset.GEOMETRY),
        "hypotheses": [],
        "experiments": [],
        "events": [],
        "conclusion": {
            "status": "inconclusive",
            "title": "Investigation not complete",
            "summary": "No closed-loop conclusion yet.",
            "evidence_ids": [],
        },
    }
