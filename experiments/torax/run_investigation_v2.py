"""Run a genuine bounded TORAX investigation with reserved verification slots.

Does not overwrite the completed v1 ledger.
"""

from __future__ import annotations

import os
from pathlib import Path

from experiments.torax import preset
from services.research.export import package_recording
from services.research.orchestrator import Investigation, RunBudget

ROOT = Path(__file__).resolve().parents[2]
RECORDING_ID = "torax-iterhybrid-fixed-energy-v2"
V1_ID = "torax-iterhybrid-fixed-energy-v1"


def main() -> None:
    os.environ.setdefault("JAX_PLATFORMS", "cpu")
    os.environ.setdefault("XLA_PYTHON_CLIENT_PREALLOCATE", "false")
    v1 = ROOT / "public" / "recordings" / f"{V1_ID}.json"
    if not v1.exists():
        raise SystemExit(f"refusing to run v2 without preserved v1 at {v1}")
    dest = ROOT / "public" / "recordings" / f"{RECORDING_ID}.json"
    if dest.exists():
        raise SystemExit(f"refusing to overwrite existing {dest}")
    inv = Investigation(
        question=preset.QUESTION,
        budget=RunBudget(
            max_experiments=9,
            search_slots=6,
            verification_slots=3,
            seed=11,
            timeout_s=180,
        ),
        run_id=RECORDING_ID,
        title="Fixed-energy heating-profile investigation (v2, reserved verification)",
        limitations=[
            "Horizon is 1.0 s, shortened from the documented 5 s example.",
            "Constant transport and heat-only evolution.",
            "Numerical model, not experimental validation.",
            "Total budget 9 solver calls: 6 SEARCH (baseline + candidates) plus 3 reserved verification (refined baseline, refined frozen finalist, location perturbation).",
            "Cancel is cooperative: honored between experiments, not mid-JAX step.",
            "v1 six-experiment run is preserved separately with its incomplete verification.",
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
            "n_events": len(recording["events"]),
            "search_slots": recording["budget"].get("search_slots"),
            "verification_slots": recording["budget"].get("verification_slots"),
            "model": recording["model"],
            "last_status": last.get("status"),
        }
    )


if __name__ == "__main__":
    main()
