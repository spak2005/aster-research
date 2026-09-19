"""Deterministic equal-budget grid/random heating comparison.

This is a control, not agent research. Do not label its output as an
investigation conclusion.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable, Sequence

from experiments.torax import preset
from services.research.validation import HeatingConfig, baseline_config, validate

ControlRunner = Callable[[HeatingConfig], dict]


def _in_bounds_location(value: float) -> float:
    lo, hi = preset.LOCATION_BOUNDS
    return min(hi, max(lo, value))


def _in_bounds_width(value: float) -> float:
    lo, hi = preset.WIDTH_BOUNDS
    return min(hi, max(lo, value))


def grid_points() -> list[HeatingConfig]:
    """Small interior grid. Excludes the exact baseline point."""
    locations = (0.15, 0.35, 0.55)
    widths = (0.08, 0.18)
    configs: list[HeatingConfig] = []
    seen: set[tuple[float, float]] = set()
    baseline = (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5))
    for loc in locations:
        for width in widths:
            key = (round(loc, 5), round(width, 5))
            if key == baseline or key in seen:
                continue
            seen.add(key)
            result = validate({"heating_location": loc, "heating_width": width})
            if result.accepted and result.config is not None:
                configs.append(result.config)
    return configs


def random_points(seed: int, count: int) -> list[HeatingConfig]:
    rng = random.Random(seed)
    lo_l, hi_l = preset.LOCATION_BOUNDS
    lo_w, hi_w = preset.WIDTH_BOUNDS
    configs: list[HeatingConfig] = []
    for _ in range(count):
        loc = rng.uniform(lo_l, hi_l)
        width = rng.uniform(lo_w, hi_w)
        result = validate({"heating_location": loc, "heating_width": width})
        if not result.accepted or result.config is None:
            loc = _in_bounds_location(loc)
            width = _in_bounds_width(width)
            result = validate({"heating_location": loc, "heating_width": width})
        assert result.config is not None
        configs.append(result.config)
    return configs


def comparison_set(seed: int, budget: int) -> list[HeatingConfig]:
    """Baseline first, then grid, then seeded random, truncated to budget."""
    ordered = [baseline_config()]
    for cfg in grid_points() + random_points(seed, max(budget, 1)):
        key = (
            round(cfg.heating_location, 5),
            round(cfg.heating_width, 5),
        )
        existing = {
            (round(item.heating_location, 5), round(item.heating_width, 5))
            for item in ordered
        }
        if key not in existing:
            ordered.append(cfg)
        if len(ordered) >= budget:
            break
    return ordered[:budget]


@dataclass
class ComparisonResult:
    kind: str  # "grid-random-control"
    seed: int
    configs: list[HeatingConfig]
    outcomes: list[dict]


def run_comparison(
    seed: int,
    budget: int,
    runner: ControlRunner,
) -> ComparisonResult:
    configs = comparison_set(seed, budget)
    outcomes = []
    for cfg in configs:
        outcome = runner(cfg)
        outcome = {
            **outcome,
            "role": "baseline" if cfg == configs[0] else "control",
            "config": cfg.as_contract_dict(),
        }
        outcomes.append(outcome)
    return ComparisonResult(
        kind="grid-random-control",
        seed=seed,
        configs=configs,
        outcomes=outcomes,
    )
