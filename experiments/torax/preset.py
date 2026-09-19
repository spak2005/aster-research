"""Frozen TORAX demonstration preset.

Documented ancestor: `torax.examples.iterhybrid_predictor_corrector`.
Horizon, transport, and evolved equations are deliberately reduced from that
example so a laptop-class CPU can finish Gate A and a short closed loop.
Heating power, electron/ion split, geometry, and D-T mix stay frozen.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping

# --- Frozen scientific question ---
QUESTION = (
    "At fixed total heating energy, can the system find a heating profile "
    "that improves integrated simulated fusion energy, and does that "
    "improvement survive stricter checks?"
)
OBJECTIVE = "integrated_P_fusion"
OBJECTIVE_UNITS = "MJ"
OBJECTIVE_FIELD = "E_fusion"  # TORAX post-processed output, joules
OBJECTIVE_POWER_FIELD = "P_fusion"  # watts; P_fusion = 5 * P_alpha_total
HEATING_ENERGY_FIELD = "E_aux_total"  # joules

# Proposed plan used 5 s. Bound to 1.0 s after inspecting TORAX 1.4.3
# iterhybrid_predictor_corrector (t_final=5) and the need for several
# sequential CPU runs on an 18 GB M3 Pro. All candidates share this horizon
# and the same P_total, so energy budget remains comparable.
T_FINAL_S = 1.0
PROPOSED_T_FINAL_S = 5.0

# ITER-hybrid generic_heat defaults from the documented example.
BASELINE_LOCATION = 0.12741589640723575
BASELINE_WIDTH = 0.07280908366127758
P_TOTAL_W = 51.0e6
ELECTRON_HEAT_FRACTION = 0.68

# Search bounds (normalized rho). Width must stay inside the domain.
LOCATION_BOUNDS = (0.05, 0.80)
WIDTH_BOUNDS = (0.05, 0.35)

N_RHO = 25
N_RHO_REFINED = 40
CHI_TIMESTEP_PREFACTOR = 50.0
CHI_TIMESTEP_PREFACTOR_REFINED = 25.0
MAX_DT_S = 0.2

GEOMETRY = {
    "major_radius_m": 6.2,
    "minor_radius_m": 2.0,
    "elongation": 1.7,  # schematic ITER-like; renderer uses this constant
}

SOFTWARE_NOTES = {
    "torax_example": "iterhybrid_predictor_corrector",
    "transport": "constant (QLKNN replaced for CPU budget)",
    "evolve_current": False,
    "evolve_density": False,
    "resistivity_multiplier_in_example": 200,
    "horizon_s": T_FINAL_S,
    "proposed_horizon_s": PROPOSED_T_FINAL_S,
}


def heating_energy_mj(duration_s: float = T_FINAL_S, power_w: float = P_TOTAL_W) -> float:
    """Fixed injected heating energy for the frozen duration, in MJ."""
    return (power_w * duration_s) / 1.0e6


def base_config(
    *,
    heating_location: float = BASELINE_LOCATION,
    heating_width: float = BASELINE_WIDTH,
    n_rho: int = N_RHO,
    t_final_s: float = T_FINAL_S,
    chi_timestep_prefactor: float = CHI_TIMESTEP_PREFACTOR,
    max_dt_s: float = MAX_DT_S,
) -> dict[str, Any]:
    """Return a TORAX config dict. Callers must not mutate the result in place."""
    return {
        "plasma_composition": {
            "main_ion": {"D": 0.5, "T": 0.5},
            "impurity": "Ne",
            "Z_eff": 1.6,
        },
        "profile_conditions": {
            "Ip": 10.5e6,
            "T_i": {0.0: {0.0: 15.0, 1.0: 0.2}},
            "T_i_right_bc": 0.2,
            "T_e": {0.0: {0.0: 15.0, 1.0: 0.2}},
            "T_e_right_bc": 0.2,
            "n_e_right_bc": 0.25e20,
            "n_e_nbar_is_fGW": True,
            "normalize_n_e_to_nbar": True,
            "nbar": 0.8,
            "n_e": {0: {0.0: 1.5, 1.0: 1.0}},
        },
        "numerics": {
            "t_final": t_final_s,
            "exact_t_final": True,
            "evolve_ion_heat": True,
            "evolve_electron_heat": True,
            "evolve_current": False,
            "evolve_density": False,
            "max_dt": max_dt_s,
            "chi_timestep_prefactor": chi_timestep_prefactor,
        },
        "geometry": {
            "geometry_type": "chease",
            "geometry_file": "iterhybrid.mat2cols",
            "Ip_from_parameters": True,
            "R_major": GEOMETRY["major_radius_m"],
            "a_minor": GEOMETRY["minor_radius_m"],
            "B_0": 5.3,
            "n_rho": n_rho,
        },
        "neoclassical": {"bootstrap_current": {}},
        "sources": {
            "generic_heat": {
                "gaussian_location": heating_location,
                "gaussian_width": heating_width,
                "P_total": P_TOTAL_W,
                "electron_heat_fraction": ELECTRON_HEAT_FRACTION,
            },
            "fusion": {},
            "ei_exchange": {},
            "ohmic": {},
        },
        "pedestal": {},
        "transport": {"model_name": "constant"},
        "solver": {"solver_type": "linear"},
        "time_step_calculator": {"calculator_type": "chi"},
    }


def with_heating(
    config: Mapping[str, Any],
    *,
    heating_location: float,
    heating_width: float,
) -> dict[str, Any]:
    updated = deepcopy(dict(config))
    heat = updated["sources"]["generic_heat"]
    heat["gaussian_location"] = heating_location
    heat["gaussian_width"] = heating_width
    return updated
