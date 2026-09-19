"""Extract TORAX observables with explicit units.

Objective: integrated fusion power as MJ, from TORAX `E_fusion` (joules).
Never invent missing fields.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr

from experiments.torax import preset
from services.research.validation import POWER_MW

J_PER_MJ = 1.0e6
W_PER_MW = 1.0e6
ENERGY_MATCH_TOLERANCE_MJ = 0.05  # 50 kJ against a 51 MJ budget


@dataclass
class Check:
    name: str
    status: str  # passed | failed | pending | inconclusive
    detail: str


@dataclass
class ExtractedMetrics:
    fusion_energy_mj: float
    heating_energy_mj: float
    peak_ion_temperature_kev: float
    peak_electron_temperature_kev: float
    fusion_power_mw_final: float
    t_final_s: float
    n_times: int
    improvement_pct: float | None
    checks: list[Check] = field(default_factory=list)
    source_fields: dict[str, str] = field(default_factory=dict)

    def as_contract_metrics(self) -> dict[str, Any]:
        return {
            "fusion_energy_mj": self.fusion_energy_mj,
            "heating_energy_mj": self.heating_energy_mj,
            "peak_ion_temperature_kev": self.peak_ion_temperature_kev,
            "improvement_pct": self.improvement_pct,
            "peak_electron_temperature_kev": self.peak_electron_temperature_kev,
            "fusion_power_mw_final": self.fusion_power_mw_final,
            "t_final_s": self.t_final_s,
        }


def _as_dataset(node: xr.DataTree | xr.Dataset) -> xr.Dataset:
    if isinstance(node, xr.Dataset):
        return node
    if hasattr(node, "to_dataset"):
        return node.to_dataset()
    raise TypeError(f"cannot read dataset from {type(node)}")


def _require(group: xr.Dataset, name: str) -> xr.DataArray:
    if name not in group:
        raise KeyError(
            f"TORAX output missing {name}; cannot invent the objective"
        )
    return group[name]


def load_datatree(path: str | Path) -> xr.DataTree:
    return xr.open_datatree(path)


def extract_metrics(
    data_tree: xr.DataTree,
    *,
    baseline_fusion_energy_mj: float | None = None,
    expected_duration_s: float = preset.T_FINAL_S,
    expected_heating_mj: float | None = None,
) -> ExtractedMetrics:
    if expected_heating_mj is None:
        expected_heating_mj = POWER_MW * expected_duration_s

    scalars = _as_dataset(data_tree["scalars"])
    profiles = _as_dataset(data_tree["profiles"])
    e_fusion_j = np.asarray(_require(scalars, "E_fusion").values, dtype=float)
    p_fusion_w = np.asarray(_require(scalars, "P_fusion").values, dtype=float)
    e_aux_j = np.asarray(_require(scalars, "E_aux_total").values, dtype=float)
    t_i = np.asarray(_require(profiles, "T_i").values, dtype=float)
    t_e = np.asarray(_require(profiles, "T_e").values, dtype=float)
    times = np.asarray(data_tree["time"].values, dtype=float)

    fusion_energy_mj = float(e_fusion_j[-1] / J_PER_MJ)
    heating_energy_mj = float(e_aux_j[-1] / J_PER_MJ)
    t_final_s = float(times[-1])
    improvement_pct = None
    if baseline_fusion_energy_mj not in (None, 0):
        improvement_pct = (
            (fusion_energy_mj - baseline_fusion_energy_mj)
            / abs(baseline_fusion_energy_mj)
            * 100.0
        )

    checks: list[Check] = []
    finite = bool(
        np.isfinite(e_fusion_j).all()
        and np.isfinite(p_fusion_w).all()
        and np.isfinite(t_i).all()
        and np.isfinite(t_e).all()
    )
    checks.append(
        Check(
            "finite_outputs",
            "passed" if finite else "failed",
            "all extracted arrays finite" if finite else "non-finite values present",
        )
    )
    horizon_ok = abs(t_final_s - expected_duration_s) <= 1.0e-3 * max(
        expected_duration_s, 1.0
    )
    checks.append(
        Check(
            "horizon",
            "passed" if horizon_ok else "failed",
            f"t_final={t_final_s}s expected {expected_duration_s}s",
        )
    )
    energy_ok = abs(heating_energy_mj - expected_heating_mj) <= ENERGY_MATCH_TOLERANCE_MJ
    checks.append(
        Check(
            "fixed_energy",
            "passed" if energy_ok else "failed",
            f"E_aux_total={heating_energy_mj:.6f} MJ expected {expected_heating_mj:.6f} MJ",
        )
    )

    return ExtractedMetrics(
        fusion_energy_mj=fusion_energy_mj,
        heating_energy_mj=heating_energy_mj,
        peak_ion_temperature_kev=float(np.nanmax(t_i)),
        peak_electron_temperature_kev=float(np.nanmax(t_e)),
        fusion_power_mw_final=float(p_fusion_w[-1] / W_PER_MW),
        t_final_s=t_final_s,
        n_times=int(times.size),
        improvement_pct=None if improvement_pct is None else float(improvement_pct),
        checks=checks,
        source_fields={
            "fusion_energy_mj": "PostProcessedOutputs.E_fusion [J] / 1e6",
            "fusion_power_mw": "PostProcessedOutputs.P_fusion [W] / 1e6",
            "heating_energy_mj": "PostProcessedOutputs.E_aux_total [J] / 1e6",
            "temperatures": "core_profiles T_e, T_i [keV]",
        },
    )


def extract_from_path(
    path: str | Path, **kwargs: Any
) -> ExtractedMetrics:
    tree = load_datatree(path)
    try:
        return extract_metrics(tree, **kwargs)
    finally:
        tree.close()
