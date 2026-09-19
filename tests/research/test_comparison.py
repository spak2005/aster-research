"""Deterministic comparison-set tests. Does not run TORAX."""

from __future__ import annotations

import unittest

from services.research.comparison import comparison_set, run_comparison
from services.research.validation import POWER_MW, baseline_config


class ComparisonTests(unittest.TestCase):
    def test_same_seed_same_set(self) -> None:
        a = comparison_set(7, 6)
        b = comparison_set(7, 6)
        self.assertEqual(
            [c.as_contract_dict() for c in a],
            [c.as_contract_dict() for c in b],
        )

    def test_starts_with_baseline_and_frozen_energy(self) -> None:
        configs = comparison_set(1, 5)
        self.assertEqual(
            configs[0].as_contract_dict(),
            baseline_config().as_contract_dict(),
        )
        for cfg in configs:
            self.assertEqual(cfg.heating_power_mw, POWER_MW)
            self.assertEqual(cfg.duration_s, 1.0)

    def test_runner_labels_controls(self) -> None:
        result = run_comparison(
            seed=3,
            budget=3,
            runner=lambda cfg: {"fusion_energy_mj": 1.0, "ok": True},
        )
        self.assertEqual(result.kind, "grid-random-control")
        self.assertEqual(result.outcomes[0]["role"], "baseline")
        self.assertEqual(result.outcomes[1]["role"], "control")


if __name__ == "__main__":
    unittest.main()
