"""Local research API. Bind 127.0.0.1:8765. One worker."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from experiments.torax import preset
from services.research.orchestrator import RUNS_DIR, Investigation, RunBudget

app = FastAPI(title="Aster research harness", version="0.1.0")
_LOCK = threading.Lock()
_RUNS: dict[str, Investigation] = {}
_WORKER: threading.Thread | None = None
_FACTORY: dict[str, Callable[..., Any]] = {}


class CreateRun(BaseModel):
    question: str = preset.QUESTION
    preset: str = "fixed-energy"
    max_experiments: int = Field(default=6, ge=3, le=12)
    seed: int = 0


def _torax_ready() -> bool:
    import importlib.util

    return importlib.util.find_spec("torax") is not None


def _summaries() -> list[dict[str, Any]]:
    items = []
    if RUNS_DIR.exists():
        for rec in sorted(RUNS_DIR.glob("*/recording.json")):
            import json

            data = json.loads(rec.read_text())
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


def _get_run(run_id: str) -> Investigation:
    with _LOCK:
        inv = _RUNS.get(run_id)
    if inv is None:
        rec = RUNS_DIR / run_id / "recording.json"
        if not rec.exists():
            raise HTTPException(404, f"run {run_id} not found")
        import json

        return json.loads(rec.read_text())  # type: ignore[return-value]
    return inv


@app.get("/api/health")
@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "simulator": "TORAX", "ready": _torax_ready()}


@app.get("/api/runs")
@app.get("/runs")
def list_runs() -> list[dict[str, Any]]:
    return _summaries()


def _launch(inv: Investigation) -> None:
    global _WORKER
    with _LOCK:
        if _WORKER is not None and _WORKER.is_alive():
            return

        def _run() -> None:
            try:
                inv.run_closed_loop()
            finally:
                pass

        _WORKER = threading.Thread(target=_run, name="research-worker", daemon=True)
        _WORKER.start()


@app.post("/api/runs")
@app.post("/runs")
def create_run(body: CreateRun) -> dict[str, str]:
    if body.preset != "fixed-energy":
        raise HTTPException(400, "only preset 'fixed-energy' is supported")
    kwargs: dict[str, Any] = {}
    if "executor" in _FACTORY:
        kwargs["executor"] = _FACTORY["executor"]
    if "proposer" in _FACTORY:
        kwargs["proposer"] = _FACTORY["proposer"]
    inv = Investigation(
        question=body.question,
        budget=RunBudget(max_experiments=body.max_experiments, seed=body.seed),
        **kwargs,
    )
    with _LOCK:
        if _WORKER is not None and _WORKER.is_alive():
            raise HTTPException(409, "one research worker is already running")
        _RUNS[inv.run_id] = inv
    inv.start()
    _launch(inv)
    return {"id": inv.run_id, "status": inv.recording["status"]}


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
    with _LOCK:
        inv = _RUNS.get(run_id)
    if inv is None:
        raise HTTPException(404, f"run {run_id} not found or not live")
    inv.request_cancel()
    return {"id": run_id, "status": "cancel_requested"}
