"""Sequential TORAX execution with a single worker and a timeout.

In-process runs keep JAX warm inside the local API. Isolated (spawned)
runs can be terminated on timeout; they pay a cold import and are used
for killable budgets and tests.
"""

from __future__ import annotations

import json
import os
import threading
import time
import traceback
import uuid
from dataclasses import dataclass
from multiprocessing import get_context
from pathlib import Path
from typing import Any, Callable

from experiments.torax import preset
from services.research.validation import HeatingConfig

ROOT = Path(__file__).resolve().parents[2]
RUNTIME_DIR = Path(os.environ.get("HARNESS_RUNTIME_DIR", ROOT / "runtime"))
EXPERIMENT_DIR = RUNTIME_DIR / "experiments"

_LOCK = threading.Lock()
DEFAULT_TIMEOUT_S = 180.0


@dataclass(frozen=True)
class ExecutionBudget:
    timeout_s: float = DEFAULT_TIMEOUT_S
    n_rho: int = preset.N_RHO
    chi_timestep_prefactor: float = preset.CHI_TIMESTEP_PREFACTOR
    max_dt_s: float = preset.MAX_DT_S
    isolated: bool = False


@dataclass
class ExecutionResult:
    experiment_id: str
    ok: bool
    wall_time_s: float
    output_nc: str | None
    error: str | None
    timed_out: bool
    config: HeatingConfig
    n_rho: int
    chi_timestep_prefactor: float
    sim_error: Any = None
    sim_status: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "ok": self.ok,
            "wall_time_s": self.wall_time_s,
            "output_nc": self.output_nc,
            "error": self.error,
            "timed_out": self.timed_out,
            "config": self.config.as_contract_dict(),
            "n_rho": self.n_rho,
            "chi_timestep_prefactor": self.chi_timestep_prefactor,
            "sim_error": self.sim_error,
            "sim_status": self.sim_status,
        }


def _torax_dict(config: HeatingConfig, budget: ExecutionBudget) -> dict[str, Any]:
    return preset.base_config(
        heating_location=config.heating_location,
        heating_width=config.heating_width,
        n_rho=budget.n_rho,
        t_final_s=config.duration_s,
        chi_timestep_prefactor=budget.chi_timestep_prefactor,
        max_dt_s=budget.max_dt_s,
    )


def _simulate(config: HeatingConfig, budget: ExecutionBudget, dest: Path) -> dict[str, Any]:
    os.environ.setdefault("JAX_PLATFORMS", "cpu")
    os.environ.setdefault("XLA_PYTHON_CLIENT_PREALLOCATE", "false")
    import torax

    dest.mkdir(parents=True, exist_ok=True)
    cfg = torax.ToraxConfig.from_dict(_torax_dict(config, budget))
    data_tree, history = torax.run_simulation(cfg, progress_bar=False)
    nc_path = dest / "output.nc"
    data_tree.to_netcdf(nc_path)
    sim_error = data_tree["numerics"]["sim_error"].values.reshape(-1)[0]
    sim_status = str(data_tree["numerics"]["sim_status"].values.reshape(-1)[0])
    sim_error_value = sim_error.item() if hasattr(sim_error, "item") else sim_error
    ok = str(sim_status).lower() == "completed" and str(history.sim_error) == "SimError.NO_ERROR"
    return {
        "ok": bool(ok),
        "output_nc": str(nc_path),
        "error": None if ok else f"sim_status={sim_status} sim_error={history.sim_error}",
        "sim_error": sim_error_value,
        "sim_status": sim_status,
    }


def _isolated_worker(payload: dict[str, Any], dest: str, queue: Any) -> None:
    try:
        config = HeatingConfig(**payload["config"])
        budget = ExecutionBudget(**payload["budget"])
        result = _simulate(config, budget, Path(dest))
        queue.put(("ok", result))
    except Exception as exc:  # noqa: BLE001
        queue.put(("err", f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"))


def _run_isolated(config: HeatingConfig, budget: ExecutionBudget, dest: Path) -> dict[str, Any]:
    ctx = get_context("spawn")
    queue = ctx.Queue()
    payload = {
        "config": config.as_contract_dict(),
        "budget": {
            "timeout_s": budget.timeout_s,
            "n_rho": budget.n_rho,
            "chi_timestep_prefactor": budget.chi_timestep_prefactor,
            "max_dt_s": budget.max_dt_s,
            "isolated": True,
        },
    }
    proc = ctx.Process(target=_isolated_worker, args=(payload, str(dest), queue))
    proc.start()
    proc.join(budget.timeout_s)
    if proc.is_alive():
        proc.terminate()
        proc.join(5)
        return {
            "ok": False,
            "output_nc": None,
            "error": f"timeout after {budget.timeout_s}s",
            "timed_out": True,
            "sim_error": None,
            "sim_status": None,
        }
    if queue.empty():
        return {
            "ok": False,
            "output_nc": None,
            "error": "isolated worker exited without a result",
            "timed_out": False,
            "sim_error": None,
            "sim_status": None,
        }
    status, body = queue.get()
    if status == "err":
        return {
            "ok": False,
            "output_nc": None,
            "error": body,
            "timed_out": False,
            "sim_error": None,
            "sim_status": None,
        }
    body["timed_out"] = False
    return body


def execute(
    config: HeatingConfig,
    budget: ExecutionBudget | None = None,
    *,
    experiment_id: str | None = None,
    runner: Callable[[HeatingConfig, ExecutionBudget, Path], dict[str, Any]] | None = None,
) -> ExecutionResult:
    """Run one experiment. Blocks until the single worker is free."""
    budget = budget or ExecutionBudget()
    experiment_id = experiment_id or uuid.uuid4().hex[:12]
    dest = EXPERIMENT_DIR / experiment_id
    acquired = _LOCK.acquire(timeout=budget.timeout_s)
    if not acquired:
        return ExecutionResult(
            experiment_id=experiment_id,
            ok=False,
            wall_time_s=0.0,
            output_nc=None,
            error="executor busy beyond timeout",
            timed_out=True,
            config=config,
            n_rho=budget.n_rho,
            chi_timestep_prefactor=budget.chi_timestep_prefactor,
        )
    wall0 = time.perf_counter()
    timed_out = False
    try:
        dest.mkdir(parents=True, exist_ok=True)
        if runner is not None:
            raw = runner(config, budget, dest)
        elif budget.isolated:
            raw = _run_isolated(config, budget, dest)
        else:
            raw = _simulate(config, budget, dest)
        timed_out = bool(raw.get("timed_out"))
        wall = time.perf_counter() - wall0
        if not timed_out and wall > budget.timeout_s:
            timed_out = True
            raw = {
                **raw,
                "ok": False,
                "error": f"timeout after {wall:.1f}s (limit {budget.timeout_s}s)",
                "timed_out": True,
            }
        result = ExecutionResult(
            experiment_id=experiment_id,
            ok=bool(raw.get("ok")),
            wall_time_s=wall,
            output_nc=raw.get("output_nc"),
            error=raw.get("error"),
            timed_out=timed_out,
            config=config,
            n_rho=budget.n_rho,
            chi_timestep_prefactor=budget.chi_timestep_prefactor,
            sim_error=raw.get("sim_error"),
            sim_status=raw.get("sim_status"),
        )
        (dest / "meta.json").write_text(json.dumps(result.as_dict(), indent=2, default=str) + "\n")
        return result
    except Exception as exc:  # noqa: BLE001
        wall = time.perf_counter() - wall0
        result = ExecutionResult(
            experiment_id=experiment_id,
            ok=False,
            wall_time_s=wall,
            output_nc=None,
            error=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}",
            timed_out=False,
            config=config,
            n_rho=budget.n_rho,
            chi_timestep_prefactor=budget.chi_timestep_prefactor,
        )
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "meta.json").write_text(json.dumps(result.as_dict(), indent=2, default=str) + "\n")
        return result
    finally:
        _LOCK.release()
