"""Malformed configs and frozen-energy enforcement."""

from __future__ import annotations

import unittest

from experiments.torax import preset
from services.research.validation import POWER_MW, baseline_config, describe, validate


class ValidateHeatingConfigTests(unittest.TestCase):
    def test_baseline_is_accepted(self) -> None:
        cfg = baseline_config()
        result = validate(cfg.as_contract_dict())
        self.assertTrue(result.accepted)
        self.assertEqual(result.errors, [])
        self.assertIsNotNone(result.config)

    def test_describe_exposes_bounds_and_frozen_power(self) -> None:
        info = describe()
        self.assertEqual(info["frozen"]["heating_power_mw"], POWER_MW)
        self.assertEqual(info["frozen"]["duration_s"], preset.T_FINAL_S)
        self.assertEqual(
            info["controls"]["heating_location"]["bounds"],
            list(preset.LOCATION_BOUNDS),
        )

    def test_rejects_non_object(self) -> None:
        result = validate(None)  # type: ignore[arg-type]
        self.assertFalse(result.accepted)

    def test_rejects_location_out_of_bounds(self) -> None:
        result = validate(
            {"heating_location": 0.99, "heating_width": 0.1}
        )
        self.assertFalse(result.accepted)
        self.assertTrue(any("heating_location" in err for err in result.errors))

    def test_rejects_width_out_of_bounds(self) -> None:
        result = validate(
            {"heating_location": 0.2, "heating_width": 0.01}
        )
        self.assertFalse(result.accepted)
        self.assertTrue(any("heating_width" in err for err in result.errors))

    def test_rejects_power_change(self) -> None:
        result = validate(
            {
                "heating_location": 0.2,
                "heating_width": 0.1,
                "heating_power_mw": POWER_MW * 2,
            }
        )
        self.assertFalse(result.accepted)
        self.assertTrue(any("heating_power_mw" in err for err in result.errors))

    def test_rejects_duration_change(self) -> None:
        result = validate(
            {
                "heating_location": 0.2,
                "heating_width": 0.1,
                "duration_s": 5.0,
            }
        )
        self.assertFalse(result.accepted)
        self.assertTrue(any("duration_s" in err for err in result.errors))

    def test_rejects_unknown_keys(self) -> None:
        result = validate(
            {
                "heating_location": 0.2,
                "heating_width": 0.1,
                "n_rho": 99,
            }
        )
        self.assertFalse(result.accepted)
        self.assertTrue(any("unsupported keys" in err for err in result.errors))

    def test_rejects_nan(self) -> None:
        result = validate(
            {"heating_location": float("nan"), "heating_width": 0.1}
        )
        self.assertFalse(result.accepted)

    def test_fills_frozen_power_when_omitted(self) -> None:
        result = validate({"heating_location": 0.2, "heating_width": 0.1})
        self.assertTrue(result.accepted)
        assert result.config is not None
        self.assertEqual(result.config.heating_power_mw, POWER_MW)
        self.assertEqual(result.config.duration_s, preset.T_FINAL_S)


if __name__ == "__main__":
    unittest.main()
