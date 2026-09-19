"""Budget, failure, and cancellation tests."""

from __future__ import annotations

import unittest

from experiments.torax import preset
from services.research.executor import ExecutionBudget, ExecutionResult
from services.research.models import Decision
from services.research.orchestrator import Investigation, RunBudget
from services.research.validation import HeatingConfig
from tests.research.test_loop import _executor_factory


class BudgetTests(unittest.TestCase):
    def test_rejects_out_of_range_max_experiments(self) -> None:
        with self.assertRaises(ValueError):
            RunBudget(max_experiments=2)
        with self.assertRaises(ValueError):
            RunBudget(max_experiments=13)

    def test_closed_loop_stops_on_proposer_stop(self) -> None:
        energies = {
            (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5)): 100.0e6,
        }
        inv = Investigation(
            budget=RunBudget(max_experiments=3, seed=0),
            proposer=lambda ctx: Decision(
                ok=True,
                action="stop",
                hypothesis="enough",
                prediction="stop",
                rationale="baseline is enough for this test",
            ),
            executor=_executor_factory(energies),
            run_id="test-budget-stop",
        )
        last = inv.run_closed_loop()
        self.assertEqual(last["status"], "stopped")
        self.assertEqual(inv.recording["budget"]["completed_experiments"], 1)

    def test_cancel_prevents_further_experiments(self) -> None:
        energies = {
            (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5)): 100.0e6,
            (0.4, 0.15): 90.0e6,
        }
        inv = Investigation(
            budget=RunBudget(max_experiments=4),
            proposer=lambda ctx: Decision(
                ok=True,
                action="experiment",
                hypothesis="keep going",
                prediction="x",
                heating_location=0.4,
                heating_width=0.15,
            ),
            executor=_executor_factory(energies),
            run_id="test-cancel",
        )
        inv.start()
        inv.run_baseline()
        inv.request_cancel()
        result = inv.apply_decision(
            Decision(
                ok=True,
                action="experiment",
                hypothesis="after cancel",
                prediction="x",
                heating_location=0.4,
                heating_width=0.15,
            )
        )
        self.assertEqual(result["status"], "canceled")
        self.assertEqual(len(inv.recording["experiments"]), 1)

    def test_failed_executor_consumes_budget(self) -> None:
        def boom(config: HeatingConfig, budget: ExecutionBudget, experiment_id: str) -> ExecutionResult:
            return ExecutionResult(
                experiment_id=experiment_id,
                ok=False,
                wall_time_s=0.01,
                output_nc=None,
                error="simulated failure",
                timed_out=False,
                config=config,
                n_rho=25,
                chi_timestep_prefactor=50.0,
            )

        inv = Investigation(
            budget=RunBudget(max_experiments=3),
            proposer=lambda ctx: Decision(ok=True, action="stop", hypothesis="", prediction=""),
            executor=boom,
            run_id="test-fail-budget",
        )
        inv.start()
        failed = inv.run_baseline()
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(inv.recording["budget"]["completed_experiments"], 1)


if __name__ == "__main__":
    unittest.main()
