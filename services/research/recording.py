"""Build a contract-shaped Recording dict from real experiments."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from experiments.torax import preset
from services.research.validation import HeatingConfig


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def new_id(prefix: str = "") -> str:
    token = uuid.uuid4().hex[:10]
    return f"{prefix}{token}" if prefix else token


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


def experiment_record(
    *,
    experiment_id: str,
    hypothesis_id: str,
    label: str,
    role: str,
    config: HeatingConfig,
    metrics: dict[str, Any],
    frames: list[dict[str, Any]],
    artifacts: list[dict[str, Any]],
    checks: list[dict[str, Any]],
    wall_time_s: float,
    status: str = "completed",
    error: str | None = None,
) -> dict[str, Any]:
    record = {
        "id": experiment_id,
        "hypothesis_id": hypothesis_id,
        "label": label,
        "role": role,
        "status": status,
        "config": config.as_contract_dict(),
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
) -> dict[str, Any]:
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
            },
            "seed": seed,
            "objective": preset.OBJECTIVE,
            "objective_units": preset.OBJECTIVE_UNITS,
            "config_hash": "iterhybrid-fixed-energy-v1",
        },
        "budget": {
            "max_experiments": 6,
            "completed_experiments": 0,
            "wall_time_s": 0.0,
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
