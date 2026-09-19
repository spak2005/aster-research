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
        self.assertEqual(inv.recording["status"], "failed")
        self.assertIsNone(inv._baseline_mj)
        self.assertIn(failed["id"], inv.recording["hypotheses"][0]["experiment_ids"])
        self.assertIn("failed", inv.recording["hypotheses"][0]["assessment"].lower())
        self.assertNotIn("Measured E_fusion=0", inv.recording["hypotheses"][0]["assessment"])

    def test_invalid_proposals_do_not_consume_experiment_slots(self) -> None:
        energies = {
            (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5)): 100.0e6,
        }
        inv = Investigation(
            budget=RunBudget(max_experiments=4, max_proposal_attempts=3, seed=0),
            proposer=lambda ctx: Decision(
                ok=True,
                action="experiment",
                hypothesis="out of bounds",
                prediction="none",
                heating_location=0.99,
                heating_width=0.1,
            ),
            executor=_executor_factory(energies),
            run_id="test-reject-bound",
        )
        last = inv.run_closed_loop()
        self.assertEqual(inv.recording["budget"]["completed_experiments"], 1)
        roles = [exp["role"] for exp in inv.recording["experiments"]]
        self.assertEqual(roles, ["baseline"])
        self.assertGreaterEqual(inv._proposal_attempts, 3)
        self.assertIn(last["status"], {"stopped", "completed"})

    def test_verification_uses_frozen_finalist_not_latest_label(self) -> None:
        energies = {
            (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5)): 100.0e6,
            (0.05, 0.05): 110.0e6,
            (0.4, 0.15): 90.0e6,
        }
        decisions = iter(
            [
                Decision(
                    ok=True,
                    action="experiment",
                    hypothesis="on-axis",
                    prediction="higher",
                    heating_location=0.05,
                    heating_width=0.05,
                ),
                Decision(
                    ok=True,
                    action="experiment",
                    hypothesis="off-axis worse",
                    prediction="lower",
                    heating_location=0.4,
                    heating_width=0.15,
                ),
                Decision(ok=True, action="stop", hypothesis="stop", prediction="stop", rationale="done"),
            ]
        )
        inv = Investigation(
            budget=RunBudget(
                max_experiments=6,
                search_slots=3,
                verification_slots=3,
                seed=0,
            ),
            proposer=lambda ctx: next(decisions),
            executor=_executor_factory(energies),
            run_id="test-freeze-finalist",
        )
        inv.run_closed_loop()
        self.assertIsNotNone(inv._frozen_finalist)
        self.assertAlmostEqual(inv._frozen_finalist["config"]["heating_location"], 0.05)
        labels = [exp["label"] for exp in inv.recording["experiments"] if exp["role"] == "verification"]
        self.assertEqual(
            labels,
            ["baseline_refined", "candidate_refined", "candidate_location_perturbation"],
        )
        refined = next(exp for exp in inv.recording["experiments"] if exp["label"] == "candidate_refined")
        self.assertAlmostEqual(refined["config"]["heating_location"], 0.05)
        self.assertEqual(refined["config"]["n_rho"], 40)


if __name__ == "__main__":
    unittest.main()
