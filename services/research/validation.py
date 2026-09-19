"""Typed heating-config validation and frozen energy bounds.

Agent-facing knobs are only heating location and width. Power, duration,
geometry, and objective are filled from the frozen preset and rejected if
the request tries to change them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from experiments.torax import preset

POWER_MW = preset.P_TOTAL_W / 1.0e6
POWER_TOLERANCE_MW = 1.0e-6
DURATION_TOLERANCE_S = 1.0e-9


@dataclass(frozen=True)
class HeatingConfig:
    heating_location: float
    heating_width: float
    heating_power_mw: float = POWER_MW
    duration_s: float = preset.T_FINAL_S

    def as_contract_dict(self) -> dict[str, float]:
        return {
            "heating_location": float(self.heating_location),
            "heating_width": float(self.heating_width),
            "heating_power_mw": float(self.heating_power_mw),
            "duration_s": float(self.duration_s),
        }


@dataclass(frozen=True)
class ValidationResult:
    accepted: bool
    config: HeatingConfig | None
    errors: list[str] = field(default_factory=list)


def describe() -> dict[str, Any]:
    return {
        "simulator": "TORAX",
        "version_note": "torax 1.4.3",
        "question": preset.QUESTION,
        "controls": {
            "heating_location": {
                "units": "rho_norm",
                "bounds": list(preset.LOCATION_BOUNDS),
                "baseline": preset.BASELINE_LOCATION,
            },
            "heating_width": {
                "units": "rho_norm",
                "bounds": list(preset.WIDTH_BOUNDS),
                "baseline": preset.BASELINE_WIDTH,
            },
        },
        "frozen": {
            "heating_power_mw": POWER_MW,
            "duration_s": preset.T_FINAL_S,
            "electron_heat_fraction": preset.ELECTRON_HEAT_FRACTION,
            "objective": preset.OBJECTIVE,
            "objective_units": preset.OBJECTIVE_UNITS,
            "objective_field": preset.OBJECTIVE_FIELD,
        },
        "observables": [
            "E_fusion [J] → fusion_energy_mj",
            "P_fusion [W] → fusion_power_mw",
            "E_aux_total [J] → heating_energy_mj",
            "T_e [keV]",
            "T_i [keV]",
        ],
        "supported_checks": ["fixed_energy", "bounds", "finite_outputs", "horizon"],
    }


def _as_float(value: Any, name: str, errors: list[str]) -> float | None:
    if value is None:
        errors.append(f"{name} is required")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        errors.append(f"{name} must be a finite number")
        return None
    if number != number or number in (float("inf"), float("-inf")):
        errors.append(f"{name} must be finite")
        return None
    return number


def validate(request: Mapping[str, Any] | None) -> ValidationResult:
    """Accept or reject a heating request. Never mutates TORAX itself."""
    errors: list[str] = []
    if not isinstance(request, Mapping):
        return ValidationResult(False, None, ["request must be an object"])

    unknown = sorted(
        key
        for key in request.keys()
        if key
        not in {
            "heating_location",
            "heating_width",
            "heating_power_mw",
            "duration_s",
        }
    )
    if unknown:
        errors.append(f"unsupported keys: {', '.join(unknown)}")

    location = _as_float(request.get("heating_location"), "heating_location", errors)
    width = _as_float(request.get("heating_width"), "heating_width", errors)

    if "heating_power_mw" in request:
        power = _as_float(request.get("heating_power_mw"), "heating_power_mw", errors)
        if power is not None and abs(power - POWER_MW) > POWER_TOLERANCE_MW:
            errors.append(
                f"heating_power_mw must equal frozen {POWER_MW} MW (fixed energy)"
            )
    else:
        power = POWER_MW

    if "duration_s" in request:
        duration = _as_float(request.get("duration_s"), "duration_s", errors)
        if (
            duration is not None
            and abs(duration - preset.T_FINAL_S) > DURATION_TOLERANCE_S
        ):
            errors.append(
                f"duration_s must equal frozen {preset.T_FINAL_S} s (fixed energy)"
            )
    else:
        duration = preset.T_FINAL_S

    if location is not None:
        lo, hi = preset.LOCATION_BOUNDS
        if location < lo or location > hi:
            errors.append(f"heating_location {location} outside [{lo}, {hi}]")

    if width is not None:
        lo, hi = preset.WIDTH_BOUNDS
        if width < lo or width > hi:
            errors.append(f"heating_width {width} outside [{lo}, {hi}]")

    if errors:
        return ValidationResult(False, None, errors)

    assert location is not None and width is not None and power is not None
    assert duration is not None
    return ValidationResult(
        True,
        HeatingConfig(
            heating_location=location,
            heating_width=width,
            heating_power_mw=power,
            duration_s=duration,
        ),
        [],
    )


def baseline_config() -> HeatingConfig:
    return HeatingConfig(
        heating_location=preset.BASELINE_LOCATION,
        heating_width=preset.BASELINE_WIDTH,
    )
