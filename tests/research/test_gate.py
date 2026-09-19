"""Conclusion gate tests. Thresholds are frozen; these tests do not retune them."""

from __future__ import annotations

import unittest

from services.research import gate

SEARCH = {
    "heating_power_mw": 51.0,
    "duration_s": 1.0,
    "n_rho": 25,
    "chi_timestep_prefactor": 50.0,
}
REFINED = {
    "heating_power_mw": 51.0,
    "duration_s": 1.0,
    "n_rho": 40,
    "chi_timestep_prefactor": 25.0,
}
BASE_HEAT = {"heating_location": 0.12, "heating_width": 0.07}
CAND_HEAT = {"heating_location": 0.05, "heating_width": 0.05}
UNRELATED_HEAT = {"heating_location": 0.50, "heating_width": 0.20}


def _exp(
    role: str,
    fusion: float,
    status: str = "completed",
    *,
    heating: dict[str, float] | None = None,
    grid: dict[str, float] | None = None,
    label: str | None = None,
) -> dict:
    heat = heating if heating is not None else (BASE_HEAT if role == "baseline" else CAND_HEAT)
    extra = dict(SEARCH if grid is None else grid)
    return {
        "id": f"{role}-{fusion}",
        "role": role,
        "status": status,
        "label": label or role,
        "config": {**heat, **extra},
        "metrics": {
            "fusion_energy_mj": fusion,
            "heating_energy_mj": 51.0,
            "peak_ion_temperature_kev": 16.0,
            "improvement_pct": None,
        },
    }


def _supported_bundle() -> list[dict]:
    return [
        _exp("baseline", 100.0, heating=BASE_HEAT, grid=SEARCH),
        _exp("candidate", 108.0, heating=CAND_HEAT, grid=SEARCH),
        _exp("verification", 99.0, heating=BASE_HEAT, grid=REFINED, label="baseline_refined"),
        _exp("verification", 107.0, heating=CAND_HEAT, grid=REFINED, label="candidate_refined"),
        _exp(
            "verification",
            106.0,
            heating={"heating_location": 0.08, "heating_width": 0.05},
            grid=SEARCH,
            label="candidate_location_perturbation",
        ),
    ]


class GateTests(unittest.TestCase):
    def test_no_baseline_is_inconclusive(self) -> None:
        result = gate.assess({"experiments": []})
        self.assertEqual(result["conclusion"], "inconclusive")

    def test_failed_baseline_is_inconclusive(self) -> None:
        result = gate.assess({"experiments": [_exp("baseline", 100.0, status="failed")]})
        self.assertEqual(result["conclusion"], "inconclusive")

    def test_zero_baseline_is_inconclusive(self) -> None:
        result = gate.assess({"experiments": [_exp("baseline", 0.0)]})
        self.assertEqual(result["conclusion"], "inconclusive")
        self.assertTrue(any("finite and positive" in r for r in result["reasons"]))

    def test_small_gain_is_inconclusive(self) -> None:
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0),
                    _exp("candidate", 102.0),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "inconclusive")

    def test_unverified_gain_is_inconclusive(self) -> None:
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0),
                    _exp("candidate", 110.0),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "inconclusive")
        self.assertTrue(any("missing predeclared checks" in r for r in result["reasons"]))

    def test_absent_perturbation_is_inconclusive(self) -> None:
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0, heating=BASE_HEAT, grid=SEARCH),
                    _exp("candidate", 108.0, heating=CAND_HEAT, grid=SEARCH),
                    _exp("verification", 99.0, heating=BASE_HEAT, grid=REFINED, label="baseline_refined"),
                    _exp("verification", 107.0, heating=CAND_HEAT, grid=REFINED, label="candidate_refined"),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "inconclusive")
        self.assertTrue(any("location perturbation" in r for r in result["reasons"]))
        self.assertNotEqual(result["conclusion"], "supported")

    def test_unrelated_refinement_does_not_count_as_finalist_check(self) -> None:
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0, heating=BASE_HEAT, grid=SEARCH),
                    _exp("candidate", 108.0, heating=CAND_HEAT, grid=SEARCH),
                    _exp("verification", 99.0, heating=BASE_HEAT, grid=REFINED, label="baseline_refined"),
                    _exp(
                        "verification",
                        200.0,
                        heating=UNRELATED_HEAT,
                        grid=REFINED,
                        label="candidate_refined",
                    ),
                    _exp(
                        "verification",
                        106.0,
                        heating={"heating_location": 0.08, "heating_width": 0.05},
                        grid=SEARCH,
                        label="candidate_location_perturbation",
                    ),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "inconclusive")
        self.assertTrue(any("refined candidate" in r for r in result["reasons"]))
        self.assertNotEqual(result["conclusion"], "supported")

    def test_label_alone_does_not_bind_baseline_refinement(self) -> None:
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0, heating=BASE_HEAT, grid=SEARCH),
                    _exp("candidate", 108.0, heating=CAND_HEAT, grid=SEARCH),
                    _exp(
                        "verification",
                        99.0,
                        heating=CAND_HEAT,
                        grid=REFINED,
                        label="baseline_refined",
                    ),
                    _exp("verification", 107.0, heating=CAND_HEAT, grid=REFINED, label="candidate_refined"),
                    _exp(
                        "verification",
                        106.0,
                        heating={"heating_location": 0.08, "heating_width": 0.05},
                        grid=SEARCH,
                        label="candidate_location_perturbation",
                    ),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "inconclusive")
        self.assertTrue(any("refined baseline" in r for r in result["reasons"]))

    def test_refinement_loss_is_refuted(self) -> None:
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0),
                    _exp("candidate", 110.0),
                    _exp("verification", 100.0, heating=BASE_HEAT, grid=REFINED, label="baseline_refined"),
                    _exp("verification", 101.0, heating=CAND_HEAT, grid=REFINED, label="candidate_refined"),
                    _exp(
                        "verification",
                        106.0,
                        heating={"heating_location": 0.08, "heating_width": 0.05},
                        grid=SEARCH,
                        label="candidate_location_perturbation",
                    ),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "refuted")

    def test_grid_disagreement_uses_declared_rel_tol(self) -> None:
        # search 110 vs refined 106 is 3.64% disagreement, above
        # REFINEMENT_REL_TOL=0.03 and below the old unexplained *4 (=0.12).
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0),
                    _exp("candidate", 110.0),
                    _exp("verification", 99.0, heating=BASE_HEAT, grid=REFINED, label="baseline_refined"),
                    _exp("verification", 106.0, heating=CAND_HEAT, grid=REFINED, label="candidate_refined"),
                    _exp(
                        "verification",
                        106.0,
                        heating={"heating_location": 0.08, "heating_width": 0.05},
                        grid=SEARCH,
                        label="candidate_location_perturbation",
                    ),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "inconclusive")
        self.assertTrue(any("REFINEMENT_REL_TOL" in r for r in result["reasons"]))

    def test_verified_gain_is_supported(self) -> None:
        result = gate.assess({"experiments": _supported_bundle()})
        self.assertEqual(result["conclusion"], "supported")

    def test_mismatched_power_is_not_ranked(self) -> None:
        result = gate.assess(
            {
                "experiments": [
                    _exp("baseline", 100.0),
                    _exp(
                        "candidate",
                        200.0,
                        heating=CAND_HEAT,
                        grid={**SEARCH, "heating_power_mw": 99.0},
                    ),
                ]
            }
        )
        self.assertEqual(result["conclusion"], "inconclusive")
        self.assertTrue(any("no completed search-grid candidate" in r for r in result["reasons"]))


if __name__ == "__main__":
    unittest.main()
