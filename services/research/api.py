"""Local research API. Bind 127.0.0.1:8765. One worker.

Localhost only. Existing user authorization does not permit unlimited compute.
Cancel is cooperative: honored between experiments, not mid-JAX step.
"""

from __future__ import annotations

import json
import re
import threading
from typing import Any, Callable

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from experiments.torax import preset
from services.research.orchestrator import RUNS_DIR, Investigation, RunBudget

app = FastAPI(title="Aster research harness", version="0.1.0")
_LOCK = threading.Lock()
_RUNS: dict[str, Investigation] = {}
_WORKER: threading.Thread | None = None
_WORKER_RESERVED = False
_FACTORY: dict[str, Callable[..., Any]] = {}
_RUN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")


class CreateRun(BaseModel):
    question: str = preset.QUESTION
    preset: str = "fixed-energy"
    max_experiments: int = Field(default=6, ge=3, le=12)
    seed: int = 0
    search_slots: int | None = Field(default=None, ge=1, le=12)
    verification_slots: int | None = Field(default=None, ge=0, le=11)


def _budget_for(body: CreateRun) -> RunBudget:
    verification = body.verification_slots
    if verification is None:
        available = body.max_experiments - (body.search_slots if body.search_slots is not None else 2)
        verification = max(0, min(3, available))
    try:
        return RunBudget(max_experiments=body.max_experiments, seed=body.seed,
                         search_slots=body.search_slots, verification_slots=verification)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


def _torax_ready() -> bool:
    import importlib.util

    return importlib.util.find_spec("torax") is not None


def _safe_run_id(run_id: str) -> str:
    if not _RUN_ID_RE.fullmatch(run_id) or ".." in run_id or "/" in run_id or "\\" in run_id:
        raise HTTPException(400, "invalid run id")
    return run_id


def _summaries() -> list[dict[str, Any]]:
    items = []
    if RUNS_DIR.exists():
        for rec in sorted(RUNS_DIR.glob("*/recording.json")):
            try:
                data = json.loads(rec.read_text())
            except json.JSONDecodeError:
                continue
            items.append(
                {
                    "id": data.get("id"),
                    "status": data.get("status"),
                    "title": data.get("title"),
                    "created_at": data.get("created_at"),
                    "completed_experiments": data.get("budget", {}).get(
                        "completed_experiments"
                    ),
                }
            )
    return items


def _get_run(run_id: str) -> Investigation | dict[str, Any]:
    run_id = _safe_run_id(run_id)
    with _LOCK:
        inv = _RUNS.get(run_id)
    if inv is None:
        rec = RUNS_DIR / run_id / "recording.json"
        if not rec.exists():
            raise HTTPException(404, f"run {run_id} not found")
        try:
            return json.loads(rec.read_text())
        except json.JSONDecodeError as exc:
            raise HTTPException(409, f"run {run_id} recording is not readable yet") from exc
    return inv


def _reserve_worker() -> None:
    global _WORKER_RESERVED
    with _LOCK:
        if _WORKER_RESERVED or (_WORKER is not None and _WORKER.is_alive()):
            raise HTTPException(409, "one research worker is already running")
        _WORKER_RESERVED = True


def _release_worker() -> None:
    global _WORKER_RESERVED
    with _LOCK:
        _WORKER_RESERVED = False


@app.get("/api/health")
@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "simulator": "TORAX",
        "ready": _torax_ready(),
        "bind": "127.0.0.1:8765",
        "workers": 1,
        "cancel": "cooperative",
    }


@app.get("/api/runs")
@app.get("/runs")
def list_runs() -> list[dict[str, Any]]:
    return _summaries()


def _launch(inv: Investigation) -> None:
    global _WORKER

    def _run() -> None:
        try:
            inv.run_closed_loop()
        except Exception as exc:  # noqa: BLE001
            inv._fail_run(f"worker exception: {exc}")
        finally:
            _release_worker()

    with _LOCK:
        _WORKER = threading.Thread(target=_run, name="research-worker", daemon=True)
        _WORKER.start()


@app.post("/api/runs")
@app.post("/runs")
def create_run(body: CreateRun) -> dict[str, str]:
    if body.preset != "fixed-energy":
        raise HTTPException(400, "only preset 'fixed-energy' is supported")
    budget = _budget_for(body)
    _reserve_worker()
    try:
        kwargs: dict[str, Any] = {}
        if "executor" in _FACTORY:
            kwargs["executor"] = _FACTORY["executor"]
        if "proposer" in _FACTORY:
            kwargs["proposer"] = _FACTORY["proposer"]
        inv = Investigation(
            question=body.question,
            budget=budget,
            **kwargs,
        )
        with _LOCK:
            _RUNS[inv.run_id] = inv
        inv.start()
        _launch(inv)
        return {"id": inv.run_id, "status": inv.recording["status"]}
    except HTTPException:
        _release_worker()
        raise
    except Exception:
        _release_worker()
        raise


@app.get("/api/runs/{run_id}")
@app.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    inv = _get_run(run_id)
    if isinstance(inv, Investigation):
        return inv.recording
    return inv


@app.get("/api/runs/{run_id}/events")
@app.get("/runs/{run_id}/events")
def get_events(run_id: str, after: int = 0) -> list[dict[str, Any]]:
    inv = _get_run(run_id)
    events = inv.recording["events"] if isinstance(inv, Investigation) else inv["events"]
    return [item for item in events if int(item["sequence"]) > after]


@app.post("/api/runs/{run_id}/cancel")
@app.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str) -> dict[str, str]:
    run_id = _safe_run_id(run_id)
    with _LOCK:
        inv = _RUNS.get(run_id)
    if inv is None:
        raise HTTPException(404, f"run {run_id} not found or not live")
    inv.request_cancel()
    return {"id": run_id, "status": "cancel_requested"}
