"""Conclusion gate tests. Failed runs cannot be labeled supported."""

from __future__ import annotations

import unittest

from services.research.gate import conclude
from services.research.verification import MIN_IMPROVEMENT_PCT


def _exp(exp_id: str, role: str, fusion: float, status: str = "completed", label: str = "") -> dict:
    return {
        "id": exp_id,
        "role": role,
        "label": label or role,
        "status": status,
        "metrics": {
            "fusion_energy_mj": fusion,
            "heating_energy_mj": 51.0,
            "peak_ion_temperature_kev": 12.0,
            "improvement_pct": None,
        },
        "checks": [
            {"name": "finite_outputs", "status": "passed", "detail": "ok"},
            {"name": "horizon", "status": "passed", "detail": "ok"},
            {"name": "fixed_energy", "status": "passed", "detail": "ok"},
            {"name": "solver_success", "status": "passed", "detail": "completed"},
        ],
        "config": {},
    }


class GateTests(unittest.TestCase):
    def test_no_candidate_is_inconclusive(self) -> None:
        result = conclude({"experiments": [_exp("b", "baseline", 100.0)]})
        self.assertEqual(result["status"], "inconclusive")

    def test_failed_simulation_cannot_be_supported(self) -> None:
        result = conclude(
            {
                "experiments": [
                    _exp("b", "baseline", 100.0),
                    _exp("c", "candidate", 200.0, status="failed"),
                ]
            }
        )
        self.assertNotEqual(result["status"], "supported")

    def test_small_gain_is_inconclusive(self) -> None:
        gain = 100.0 * (1 + (MIN_IMPROVEMENT_PCT - 1) / 100.0)
        result = conclude(
            {
                "experiments": [
                    _exp("b", "baseline", 100.0),
                    _exp("c", "candidate", gain),
                ]
            }
        )
        self.assertEqual(result["status"], "inconclusive")

    def test_unverified_large_gain_is_inconclusive(self) -> None:
        result = conclude(
            {
                "experiments": [
                    _exp("b", "baseline", 100.0),
                    _exp("c", "candidate", 120.0),
                ]
            }
        )
        self.assertEqual(result["status"], "inconclusive")
        self.assertIn("not verified", result["summary"].lower() + result["title"].lower())

    def test_verified_gain_is_supported(self) -> None:
        result = conclude(
            {
                "experiments": [
                    _exp("b", "baseline", 100.0),
                    _exp("c", "candidate", 120.0),
                    _exp("br", "verification", 100.0, label="baseline_refined"),
                    _exp("cr", "verification", 118.0, label="candidate_refined"),
                    _exp("p", "verification", 115.0, label="candidate_location_perturbation"),
                ]
            }
        )
        self.assertEqual(result["status"], "supported")

    def test_refinement_loss_is_refuted(self) -> None:
        result = conclude(
            {
                "experiments": [
                    _exp("b", "baseline", 100.0),
                    _exp("c", "candidate", 120.0),
                    _exp("br", "verification", 100.0, label="baseline_refined"),
                    _exp("cr", "verification", 101.0, label="candidate_refined"),
                ]
            }
        )
        self.assertEqual(result["status"], "refuted")


if __name__ == "__main__":
    unittest.main()
