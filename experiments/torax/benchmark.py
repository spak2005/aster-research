"""Bounded TORAX Gate A benchmark: baseline, changed heating, refinement.

Uses the canonical project interpreter. Does not install packages.
Run:

  PYTHONPATH=. /path/to/science-harness/.venv/bin/python -m experiments.torax.benchmark
"""

from __future__ import annotations

import json
import os
import resource
import threading
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Bound JAX before importing TORAX/JAX.
os.environ.setdefault("JAX_PLATFORMS", "cpu")
os.environ.setdefault("XLA_PYTHON_CLIENT_PREALLOCATE", "false")
os.environ.setdefault("XLA_PYTHON_CLIENT_ALLOCATOR", "platform")

from experiments.torax import preset

ROOT = Path(__file__).resolve().parents[2]
OUT_JSON = ROOT / "docs" / "science" / "benchmark-measurements.json"


class MemorySampler:
    def __init__(self, interval_s: float = 0.2) -> None:
        self.interval_s = interval_s
        self.peak_rss_bytes = 0
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _rss(self) -> int:
        # ru_maxrss is bytes on macOS, kilobytes on Linux.
        return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

    def _run(self) -> None:
        while not self._stop.wait(self.interval_s):
            self.peak_rss_bytes = max(self.peak_rss_bytes, self._rss())

    def __enter__(self) -> "MemorySampler":
        self.peak_rss_bytes = self._rss()
        self._thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self._stop.set()
        self._thread.join(timeout=2)
        self.peak_rss_bytes = max(self.peak_rss_bytes, self._rss())


def _joules_to_mj(value: float) -> float:
    return float(value) / 1.0e6


def _watts_to_mw(value: float) -> float:
    return float(value) / 1.0e6


def extract_summary(data_tree: Any, history: Any) -> dict[str, Any]:
    import numpy as np

    scalars = data_tree["scalars"]
    profiles = data_tree["profiles"]
    e_fusion_j = np.asarray(scalars["E_fusion"].values, dtype=float)
    p_fusion_w = np.asarray(scalars["P_fusion"].values, dtype=float)
    e_aux_j = np.asarray(scalars["E_aux_total"].values, dtype=float)
    times = np.asarray(data_tree["time"].values, dtype=float)
    t_e = np.asarray(profiles["T_e"].values, dtype=float)
    t_i = np.asarray(profiles["T_i"].values, dtype=float)
    sim_error = np.asarray(data_tree["numerics"]["sim_error"].values).reshape(-1)[0]
    sim_status = np.asarray(data_tree["numerics"]["sim_status"].values).reshape(-1)[0]
    return {
        "sim_error": sim_error.item() if hasattr(sim_error, "item") else sim_error,
        "sim_status": str(sim_status),
        "history_sim_error": str(history.sim_error),
        "n_times": int(times.size),
        "t_initial_s": float(times[0]),
        "t_final_s": float(times[-1]),
        "E_fusion_J": float(e_fusion_j[-1]),
        "fusion_energy_mj": _joules_to_mj(e_fusion_j[-1]),
        "P_fusion_W_final": float(p_fusion_w[-1]),
        "fusion_power_mw_final": _watts_to_mw(p_fusion_w[-1]),
        "E_aux_total_J": float(e_aux_j[-1]),
        "heating_energy_mj": _joules_to_mj(e_aux_j[-1]),
        "peak_ion_temperature_kev": float(np.nanmax(t_i)),
        "peak_electron_temperature_kev": float(np.nanmax(t_e)),
        "finite_outputs": bool(
            np.isfinite(e_fusion_j).all()
            and np.isfinite(p_fusion_w).all()
            and np.isfinite(t_i).all()
            and np.isfinite(t_e).all()
        ),
        "has_E_fusion": "E_fusion" in scalars,
        "has_P_fusion": "P_fusion" in scalars,
        "has_E_aux_total": "E_aux_total" in scalars,
        "has_T_e": "T_e" in profiles,
        "has_T_i": "T_i" in profiles,
    }


def run_case(name: str, config_dict: dict[str, Any]) -> dict[str, Any]:
    import torax

    wall0 = time.perf_counter()
    with MemorySampler() as sampler:
        try:
            cfg = torax.ToraxConfig.from_dict(config_dict)
            data_tree, history = torax.run_simulation(cfg, progress_bar=False)
            summary = extract_summary(data_tree, history)
            status = str(summary["sim_status"]).lower()
            err = summary["sim_error"]
            summary["ok"] = (
                status == "completed"
                and summary["finite_outputs"]
                and (err in (0, "0", "NO_ERROR") or err == 0)
            )
            summary["error"] = None
        except Exception as exc:  # noqa: BLE001 — record actual failure for Gate A
            summary = {
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc(),
            }
    wall = time.perf_counter() - wall0
    heat = config_dict["sources"]["generic_heat"]
    return {
        "name": name,
        "wall_time_s": wall,
        "peak_rss_bytes": sampler.peak_rss_bytes,
        "heating_location": heat["gaussian_location"],
        "heating_width": heat["gaussian_width"],
        "P_total_W": heat["P_total"],
        "n_rho": config_dict["geometry"]["n_rho"],
        "t_final_s": config_dict["numerics"]["t_final"],
        "chi_timestep_prefactor": config_dict["numerics"]["chi_timestep_prefactor"],
        **summary,
    }


def main() -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc).isoformat()
    import_wall0 = time.perf_counter()
    import torax
    import_wall = time.perf_counter() - import_wall0

    baseline_cfg = preset.base_config()
    changed_cfg = preset.with_heating(
        baseline_cfg,
        heating_location=0.40,
        heating_width=0.15,
    )
    refined_cfg = preset.base_config(
        n_rho=preset.N_RHO_REFINED,
        chi_timestep_prefactor=preset.CHI_TIMESTEP_PREFACTOR_REFINED,
    )

    print("running baseline (cold compile + solve)...", flush=True)
    baseline = run_case("baseline_cold", baseline_cfg)
    print(
        f"  wall={baseline['wall_time_s']:.1f}s ok={baseline.get('ok')} "
        f"E_fusion_MJ={baseline.get('fusion_energy_mj')}",
        flush=True,
    )

    print("running changed heating (warm)...", flush=True)
    changed = run_case("changed_heating_warm", changed_cfg)
    print(
        f"  wall={changed['wall_time_s']:.1f}s ok={changed.get('ok')} "
        f"E_fusion_MJ={changed.get('fusion_energy_mj')}",
        flush=True,
    )

    print("running refined baseline...", flush=True)
    refined = run_case("baseline_refined", refined_cfg)
    print(
        f"  wall={refined['wall_time_s']:.1f}s ok={refined.get('ok')} "
        f"E_fusion_MJ={refined.get('fusion_energy_mj')}",
        flush=True,
    )

    metric_exists = all(
        case.get("ok") and "fusion_energy_mj" in case
        for case in (baseline, changed, refined)
    )
    delta = None
    if baseline.get("ok") and changed.get("ok"):
        delta = float(changed["fusion_energy_mj"]) - float(baseline["fusion_energy_mj"])
    payload = {
        "created_at": started,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "interpreter": os.environ.get("RESEARCH_PYTHON", "science-harness .venv"),
        "torax_version": getattr(torax, "__version__", "unknown"),
        "import_wall_s": import_wall,
        "horizon": {
            "t_final_s": preset.T_FINAL_S,
            "proposed_t_final_s": preset.PROPOSED_T_FINAL_S,
            "reason": (
                "Shortened from the documented 5 s ITER-hybrid example so several "
                "sequential CPU experiments fit the laptop budget. Power and duration "
                "are identical across candidates, so injected heating energy is fixed."
            ),
        },
        "objective": {
            "name": preset.OBJECTIVE,
            "display_units": preset.OBJECTIVE_UNITS,
            "torax_field": preset.OBJECTIVE_FIELD,
            "torax_field_units": "J",
            "power_field": preset.OBJECTIVE_POWER_FIELD,
            "power_field_units": "W",
            "conversion": "fusion_energy_mj = E_fusion / 1e6",
            "doc": "PostProcessedOutputs.P_fusion is generated fusion power (5*P_alpha_total) [W]; E_fusion is its time integral [J].",
        },
        "notes": preset.SOFTWARE_NOTES,
        "cases": [baseline, changed, refined],
        "heating_changes_metric": bool(
            delta is not None and abs(delta) > 0.0 and metric_exists
        ),
        "delta_changed_minus_baseline_mj": delta,
        "gate_a_metric_exists": metric_exists,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, default=str) + "\n")
    print(f"wrote {OUT_JSON}", flush=True)
    if not metric_exists:
        raise SystemExit("Gate A failed: metric missing or a case did not complete")


if __name__ == "__main__":
    main()
