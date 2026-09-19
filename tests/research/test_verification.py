"""Frozen verification-case tests."""

from __future__ import annotations

import unittest

from experiments.torax import preset
from services.research.validation import HeatingConfig
from services.research.verification import (
    MIN_IMPROVEMENT_PCT,
    PERTURBATION_DRHO,
    verification_cases,
)


class VerificationTests(unittest.TestCase):
    def test_cases_are_deterministic_and_frozen(self) -> None:
        cfg = HeatingConfig(heating_location=0.25, heating_width=0.10)
        a = verification_cases(cfg)
        b = verification_cases(cfg)
        self.assertEqual([c.name for c in a], [c.name for c in b])
        self.assertEqual(a[0].config.heating_location, preset.BASELINE_LOCATION)
        self.assertEqual(a[1].n_rho if hasattr(a[1], "n_rho") else a[1].budget.n_rho, preset.N_RHO_REFINED)
        self.assertAlmostEqual(
            a[2].config.heating_location,
            0.25 + PERTURBATION_DRHO,
        )
        self.assertGreater(MIN_IMPROVEMENT_PCT, 1.2)

    def test_perturbation_clips_to_bounds(self) -> None:
        cfg = HeatingConfig(heating_location=0.79, heating_width=0.10)
        cases = verification_cases(cfg)
        self.assertLessEqual(cases[2].config.heating_location, preset.LOCATION_BOUNDS[1])


if __name__ == "__main__":
    unittest.main()
