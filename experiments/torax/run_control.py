"""Equal-total-budget deterministic control. This is NOT model-led research."""

from __future__ import annotations

import os
from pathlib import Path

from experiments.torax import preset
from services.research.comparison import comparison_set
from services.research.export import package_recording
from services.research.models import Decision
from services.research.orchestrator import Investigation, RunBudget

ROOT = Path(__file__).resolve().parents[2]
RECORDING_ID = "torax-iterhybrid-fixed-energy-control-9"


def main() -> None:
    os.environ.setdefault("JAX_PLATFORMS", "cpu")
    os.environ.setdefault("XLA_PYTHON_CLIENT_PREALLOCATE", "false")
    dest = ROOT / "public" / "recordings" / f"{RECORDING_ID}.json"
    if dest.exists():
        raise SystemExit(f"refusing to overwrite existing {dest}")
    # Same 6+3 allocation as v2 so totals are comparable. Explicitly not adaptive.
    queued = comparison_set(seed=11, budget=6)[1:]

    def proposer(ctx: dict) -> Decision:
        del ctx
        if not queued:
            return Decision(
                ok=True,
                action="stop",
                hypothesis="Deterministic control search complete (NO MODEL)",
                prediction="no further control points",
                rationale="control grid/random set exhausted",
            )
        cfg = queued.pop(0)
        return Decision(
            ok=True,
            action="experiment",
            hypothesis="Deterministic control heating point (NO MODEL)",
            prediction="Record E_fusion at this predeclared location/width",
            heating_location=cfg.heating_location,
            heating_width=cfg.heating_width,
            rationale="grid then seeded-random control; not a model proposal",
        )

    inv = Investigation(
        question=preset.QUESTION,
        budget=RunBudget(
            max_experiments=9,
            search_slots=6,
            verification_slots=3,
            seed=11,
            timeout_s=180,
        ),
        proposer=proposer,
        run_id=RECORDING_ID,
        title="Deterministic equal-budget control (NO MODEL)",
        model="none (deterministic control)",
        search_role="control",
        limitations=[
            "This recording is a deterministic grid/random control. It is not adaptive research.",
            "No research model was queried. Do not label this as agent-led investigation.",
            "Same frozen preset, 51 MW × 1.0 s, constant transport.",
            "Allocation matches v2: 6 SEARCH solver calls (baseline + 5 control points) plus 3 verification of the frozen best search-grid control point.",
            "Equal total budget does not by itself prove a model beat or lost to control.",
            "Horizon is 1.0 s, shortened from the documented 5 s example.",
        ],
    )
    last = inv.run_closed_loop()
    recording = inv.recording
    recording["mode"] = "recorded"
    recording["id"] = RECORDING_ID
    out = package_recording(recording, public_id=RECORDING_ID)
    print(
        {
            "out": str(out),
            "status": recording["status"],
            "conclusion": recording["conclusion"],
            "n_experiments": len(recording["experiments"]),
            "model": recording["model"],
            "last_status": last.get("status"),
            "kind": "deterministic-control",
        }
    )


if __name__ == "__main__":
    main()
