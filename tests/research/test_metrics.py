"""Unit tests for metric extraction. Uses a synthetic TORAX-shaped DataTree."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import xarray as xr

from services.research.metrics import extract_from_path, extract_metrics


def _tree() -> xr.DataTree:
    time = np.array([0.0, 0.5, 1.0])
    rho = np.array([0.2, 0.5, 0.8])
    root = xr.Dataset(coords={"time": time, "rho_cell_norm": rho})
    scalars = xr.Dataset(
        {
            "E_fusion": ("time", np.array([0.0, 40.0e6, 80.0e6])),
            "P_fusion": ("time", np.array([0.0, 90.0e6, 100.0e6])),
            "E_aux_total": ("time", np.array([0.0, 25.5e6, 51.0e6])),
        },
        coords={"time": time},
    )
    t_i = np.array([[8.0, 9.0, 7.0], [9.0, 10.0, 7.5], [11.0, 12.5, 8.0]])
    t_e = t_i + 1.0
    profiles = xr.Dataset(
        {
            "T_i": (("time", "rho_cell_norm"), t_i),
            "T_e": (("time", "rho_cell_norm"), t_e),
        },
        coords={"time": time, "rho_cell_norm": rho},
    )
    numerics = xr.Dataset({"sim_error": 0, "sim_status": "completed"})
    return xr.DataTree(
        dataset=root,
        children={
            "scalars": xr.DataTree(dataset=scalars),
            "profiles": xr.DataTree(dataset=profiles),
            "numerics": xr.DataTree(dataset=numerics),
        },
    )


class MetricsTests(unittest.TestCase):
    def test_converts_joules_to_mj(self) -> None:
        metrics = extract_metrics(_tree(), baseline_fusion_energy_mj=100.0)
        self.assertAlmostEqual(metrics.fusion_energy_mj, 80.0)
        self.assertAlmostEqual(metrics.heating_energy_mj, 51.0)
        self.assertAlmostEqual(metrics.fusion_power_mw_final, 100.0)
        self.assertAlmostEqual(metrics.peak_ion_temperature_kev, 12.5)
        self.assertAlmostEqual(metrics.improvement_pct, -20.0)
        names = {check.name: check.status for check in metrics.checks}
        self.assertEqual(names["finite_outputs"], "passed")
        self.assertEqual(names["horizon"], "passed")
        self.assertEqual(names["fixed_energy"], "passed")

    def test_missing_objective_is_an_error(self) -> None:
        time = np.array([0.0, 1.0])
        root = xr.Dataset(coords={"time": time})
        scalars = xr.Dataset(
            {
                "P_fusion": ("time", np.array([0.0, 1.0])),
                "E_aux_total": ("time", np.array([0.0, 51.0e6])),
            },
            coords={"time": time},
        )
        profiles = xr.Dataset(
            {
                "T_i": (("time", "rho_cell_norm"), np.ones((2, 2))),
                "T_e": (("time", "rho_cell_norm"), np.ones((2, 2))),
            },
            coords={"time": time, "rho_cell_norm": [0.3, 0.7]},
        )
        tree = xr.DataTree(
            dataset=root,
            children={
                "scalars": xr.DataTree(dataset=scalars),
                "profiles": xr.DataTree(dataset=profiles),
            },
        )
        with self.assertRaises(KeyError):
            extract_metrics(tree)

    def test_roundtrip_netcdf(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "out.nc"
            _tree().to_netcdf(path)
            metrics = extract_from_path(path)
            self.assertAlmostEqual(metrics.fusion_energy_mj, 80.0)


if __name__ == "__main__":
    unittest.main()
