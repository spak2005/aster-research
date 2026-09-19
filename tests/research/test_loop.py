"""Decision-loop tests with a fake executor. No live TORAX, no live agent."""

from __future__ import annotations

import unittest
from tests.research.isolation import IsolatedResearchTest
from pathlib import Path

import numpy as np
import xarray as xr

from services.research.executor import ExecutionBudget, ExecutionResult
from services.research.models import Decision
from services.research.orchestrator import Investigation, RunBudget
from services.research.validation import HeatingConfig


def _tree(e_fusion_j: float) -> xr.DataTree:
    time = np.array([0.0, 1.0])
    rho = np.array([0.2, 0.8])
    root = xr.Dataset(coords={"time": time, "rho_cell_norm": rho})
    scalars = xr.Dataset(
        {
            "E_fusion": ("time", np.array([0.0, e_fusion_j])),
            "P_fusion": ("time", np.array([0.0, 1.0e8])),
            "E_aux_total": ("time", np.array([0.0, 51.0e6])),
        },
        coords={"time": time},
    )
    profiles = xr.Dataset(
        {
            "T_i": (("time", "rho_cell_norm"), np.array([[10.0, 8.0], [12.0, 9.0]])),
            "T_e": (("time", "rho_cell_norm"), np.array([[11.0, 8.5], [13.0, 9.5]])),
        },
        coords={"time": time, "rho_cell_norm": rho},
    )
    return xr.DataTree(
        dataset=root,
        children={
            "scalars": xr.DataTree(dataset=scalars),
            "profiles": xr.DataTree(dataset=profiles),
        },
    )


def _executor_factory(energies: dict[tuple[float, float], float]):
    def runner(config: HeatingConfig, budget: ExecutionBudget, experiment_id: str) -> ExecutionResult:
        from services.research.executor import EXPERIMENT_DIR

        dest = EXPERIMENT_DIR / experiment_id
        dest.mkdir(parents=True, exist_ok=True)
        key = (round(config.heating_location, 5), round(config.heating_width, 5))
        energy = energies.get(key, 80.0e6)
        nc = dest / "output.nc"
        _tree(energy).to_netcdf(nc)
        return ExecutionResult(
            experiment_id=experiment_id,
            ok=True,
            wall_time_s=0.01,
            output_nc=str(nc),
            error=None,
            timed_out=False,
            config=config,
            n_rho=budget.n_rho,
            chi_timestep_prefactor=budget.chi_timestep_prefactor,
            max_dt_s=budget.max_dt_s,
            sim_error=0,
            sim_status="completed",
        )

    return runner


class LoopTests(IsolatedResearchTest):
    def test_baseline_then_candidate_records_prediction_first(self) -> None:
        from experiments.torax import preset

        energies = {
            (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5)): 100.0e6,
            (0.4, 0.15): 90.0e6,
        }
        inv = Investigation(
            budget=RunBudget(max_experiments=4, seed=1),
            proposer=lambda ctx: Decision(
                ok=True,
                action="experiment",
                hypothesis="Off-axis heating reduces fusion energy",
                prediction="E_fusion below the 100 MJ baseline",
                heating_location=0.4,
                heating_width=0.15,
                rationale="core heating produced higher T_i",
            ),
            executor=_executor_factory(energies),
            run_id="test-loop-1",
        )
        inv.start()
        baseline = inv.run_baseline()
        self.assertEqual(baseline["role"], "baseline")
        self.assertAlmostEqual(baseline["metrics"]["fusion_energy_mj"], 100.0)
        types_before = [e["type"] for e in inv.recording["events"]]
        self.assertIn("hypothesis.proposed", types_before)
        self.assertIn("experiment.completed", types_before)
        decision = inv.propose_next()
        self.assertEqual(decision.prediction, "E_fusion below the 100 MJ baseline")
        applied = inv.apply_decision(decision)
        self.assertEqual(applied["status"], "experiment_completed")
        types = [e["type"] for e in inv.recording["events"]]
        hyp_idx = types.index("hypothesis.proposed", types_before.index("hypothesis.proposed") + 1)
        req_idx = max(i for i, t in enumerate(types) if t == "experiment.requested")
        self.assertLess(hyp_idx, req_idx)
        candidate = inv.recording["experiments"][-1]
        self.assertAlmostEqual(candidate["metrics"]["fusion_energy_mj"], 90.0)
        self.assertLess(candidate["metrics"]["improvement_pct"], 0)

    def test_rejects_out_of_bounds_decision(self) -> None:
        inv = Investigation(
            budget=RunBudget(max_experiments=3),
            proposer=lambda ctx: Decision(ok=True, action="stop", hypothesis="", prediction=""),
            executor=_executor_factory({}),
            run_id="test-loop-reject",
        )
        inv.start()
        inv.run_baseline()
        result = inv.apply_decision(
            Decision(
                ok=True,
                action="experiment",
                hypothesis="invalid",
                prediction="none",
                heating_location=0.99,
                heating_width=0.1,
            )
        )
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(inv.recording["hypotheses"][-1]["status"], "abandoned")


if __name__ == "__main__":
    unittest.main()
