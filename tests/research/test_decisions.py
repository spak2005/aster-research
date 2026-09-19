"""Revision, branch, and stop decision tests."""

from __future__ import annotations

import unittest
from tests.research.isolation import IsolatedResearchTest

from experiments.torax import preset
from services.research.models import Decision
from services.research.orchestrator import Investigation, RunBudget
from tests.research.test_loop import _executor_factory


class DecisionTests(IsolatedResearchTest):
    def _inv(self, run_id: str) -> Investigation:
        energies = {
            (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5)): 100.0e6,
            (0.3, 0.12): 95.0e6,
        }
        inv = Investigation(
            budget=RunBudget(max_experiments=5, seed=2),
            proposer=lambda ctx: Decision(ok=True, action="stop", hypothesis="", prediction=""),
            executor=_executor_factory(energies),
            run_id=run_id,
        )
        inv.start()
        inv.run_baseline()
        return inv

    def test_stop_does_not_add_experiment(self) -> None:
        inv = self._inv("test-stop")
        before = len(inv.recording["experiments"])
        result = inv.apply_stop(
            Decision(
                ok=True,
                action="stop",
                hypothesis="No promising direction",
                prediction="further runs would not beat baseline",
                rationale="off-axis already worse in prior evidence",
            )
        )
        self.assertEqual(result["status"], "stopped")
        self.assertEqual(len(inv.recording["experiments"]), before)
        types = [e["type"] for e in inv.recording["events"]]
        self.assertIn("hypothesis.revised", types)
        self.assertEqual(inv.recording["hypotheses"][-1]["status"], "abandoned")

    def test_revise_records_parent_and_new_experiment(self) -> None:
        inv = self._inv("test-revise")
        result = inv.apply_revise(
            Decision(
                ok=True,
                action="revise",
                hypothesis="Try a modestly off-axis but still core-peaked profile",
                prediction="E_fusion still below baseline",
                heating_location=0.3,
                heating_width=0.12,
                rationale="baseline core heating was hotter",
            )
        )
        self.assertEqual(result["status"], "experiment_completed")
        types = [e["type"] for e in inv.recording["events"]]
        self.assertIn("hypothesis.revised", types)
        self.assertEqual(inv.recording["hypotheses"][-1]["parent_id"], inv.recording["hypotheses"][0]["id"])

    def test_branch_emits_branch_created(self) -> None:
        inv = self._inv("test-branch")
        inv.apply_branch(
            Decision(
                ok=True,
                action="experiment",
                hypothesis="Independent wider-heating branch",
                prediction="Worse fusion than baseline",
                heating_location=0.3,
                heating_width=0.12,
            )
        )
        types = [e["type"] for e in inv.recording["events"]]
        self.assertIn("branch.created", types)


if __name__ == "__main__":
    unittest.main()
