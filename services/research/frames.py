"""Profile-frame export from TORAX outputs. No invented temperatures."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr

from services.research.metrics import J_PER_MJ, W_PER_MW, _as_dataset, _require

MAX_FRAMES = 16


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _rho_and_temps(
    profiles: xr.Dataset, t_e: np.ndarray, t_i: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (rho, T_e, T_i) on a shared radial grid.

    TORAX may store temperatures on rho_cell_norm or rho_norm (cell plus
    boundaries). Missing coordinates raise rather than being invented.
    """
    if t_e.shape != t_i.shape:
        raise ValueError(f"T_e shape {t_e.shape} != T_i shape {t_i.shape}")
    for name in ("rho_cell_norm", "rho_norm", "rho_face_norm"):
        if name in profiles.coords and profiles.coords[name].size == t_e.shape[-1]:
            rho = np.asarray(profiles.coords[name].values, dtype=float)
            return rho, t_e, t_i
        if name in profiles.dims and profiles.sizes[name] == t_e.shape[-1]:
            # coordinate may live on the parent tree; caller passes it via values
            pass
    if "rho_cell_norm" in profiles:
        rho = np.asarray(profiles["rho_cell_norm"].values, dtype=float)
        if rho.ndim == 1 and rho.size == t_e.shape[-1]:
            return rho, t_e, t_i
    raise KeyError("no radial coordinate matching T_e/T_i length")


def extract_frames(
    data_tree: xr.DataTree,
    *,
    max_frames: int = MAX_FRAMES,
    rho: np.ndarray | None = None,
) -> list[dict[str, Any]]:
    scalars = _as_dataset(data_tree["scalars"])
    profiles = _as_dataset(data_tree["profiles"])
    times = np.asarray(data_tree["time"].values, dtype=float)
    t_e = np.asarray(_require(profiles, "T_e").values, dtype=float)
    t_i = np.asarray(_require(profiles, "T_i").values, dtype=float)
    p_fusion = np.asarray(_require(scalars, "P_fusion").values, dtype=float)
    e_fusion = np.asarray(_require(scalars, "E_fusion").values, dtype=float)
    e_aux = np.asarray(_require(scalars, "E_aux_total").values, dtype=float)

    if rho is None:
        try:
            rho_vals, t_e, t_i = _rho_and_temps(profiles, t_e, t_i)
        except KeyError:
            if "rho_cell_norm" in data_tree.coords:
                rho_vals = np.asarray(data_tree.coords["rho_cell_norm"].values, dtype=float)
                if rho_vals.size != t_e.shape[-1] and "rho_norm" in data_tree.coords:
                    rho_vals = np.asarray(data_tree.coords["rho_norm"].values, dtype=float)
                if rho_vals.size != t_e.shape[-1]:
                    raise
            elif "rho_norm" in data_tree.coords:
                rho_vals = np.asarray(data_tree.coords["rho_norm"].values, dtype=float)
            else:
                raise
    else:
        rho_vals = np.asarray(rho, dtype=float)

    if rho_vals.size != t_e.shape[-1]:
        raise ValueError(
            f"rho length {rho_vals.size} != temperature length {t_e.shape[-1]}"
        )

    n_times = times.size
    if n_times == 0:
        raise ValueError("no time samples")
    if n_times <= max_frames:
        indices = list(range(n_times))
    else:
        indices = sorted(
            set(
                np.linspace(0, n_times - 1, max_frames, dtype=int).tolist()
                + [0, n_times - 1]
            )
        )

    frames: list[dict[str, Any]] = []
    for index in indices:
        frames.append(
            {
                "time_s": float(times[index]),
                "rho": [float(x) for x in rho_vals],
                "electron_temperature_kev": [float(x) for x in t_e[index]],
                "ion_temperature_kev": [float(x) for x in t_i[index]],
                "fusion_power_mw": float(p_fusion[index] / W_PER_MW),
                "cumulative_fusion_energy_mj": float(e_fusion[index] / J_PER_MJ),
                "cumulative_heating_energy_mj": float(e_aux[index] / J_PER_MJ),
            }
        )
    return frames
