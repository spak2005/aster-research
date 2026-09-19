"""Profile frame export tests."""

from __future__ import annotations

import unittest

import numpy as np
import xarray as xr

from services.research.frames import extract_frames


def _tree(n_times: int = 5, n_rho: int = 4) -> xr.DataTree:
    time = np.linspace(0.0, 1.0, n_times)
    rho = np.linspace(0.1, 0.9, n_rho)
    t_i = np.outer(1 + time, 8 + rho)
    t_e = t_i + 0.5
    root = xr.Dataset(coords={"time": time, "rho_cell_norm": rho})
    scalars = xr.Dataset(
        {
            "E_fusion": ("time", 10.0e6 * time),
            "P_fusion": ("time", 20.0e6 * np.ones(n_times)),
            "E_aux_total": ("time", 51.0e6 * time),
        },
        coords={"time": time},
    )
    profiles = xr.Dataset(
        {
            "T_i": (("time", "rho_cell_norm"), t_i),
            "T_e": (("time", "rho_cell_norm"), t_e),
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


class FrameTests(unittest.TestCase):
    def test_frames_use_real_temperatures_and_rho(self) -> None:
        frames = extract_frames(_tree())
        self.assertGreaterEqual(len(frames), 2)
        first, last = frames[0], frames[-1]
        self.assertEqual(first["time_s"], 0.0)
        self.assertEqual(last["time_s"], 1.0)
        self.assertEqual(len(first["rho"]), 4)
        self.assertEqual(len(first["electron_temperature_kev"]), 4)
        self.assertAlmostEqual(last["cumulative_heating_energy_mj"], 51.0)
        self.assertAlmostEqual(last["fusion_power_mw"], 20.0)

    def test_subsamples_but_keeps_endpoints(self) -> None:
        frames = extract_frames(_tree(n_times=40), max_frames=8)
        self.assertLessEqual(len(frames), 8)
        self.assertEqual(frames[0]["time_s"], 0.0)
        self.assertEqual(frames[-1]["time_s"], 1.0)


if __name__ == "__main__":
    unittest.main()
