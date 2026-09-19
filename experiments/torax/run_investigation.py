"""Run a genuine bounded TORAX investigation with the Cursor ask-mode proposer."""

from __future__ import annotations

import json
import os
from pathlib import Path

from experiments.torax import preset
from services.research.orchestrator import Investigation, RunBudget

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public" / "recordings"
RECORDING_ID = "torax-iterhybrid-fixed-energy-v1"


def main() -> None:
    os.environ.setdefault("JAX_PLATFORMS", "cpu")
    os.environ.setdefault("XLA_PYTHON_CLIENT_PREALLOCATE", "false")
    inv = Investigation(
        question=preset.QUESTION,
        budget=RunBudget(max_experiments=6, seed=7, timeout_s=180),
        run_id=RECORDING_ID,
    )
    last = inv.run_closed_loop()
    recording = inv.recording
    recording["mode"] = "recorded"
    recording["id"] = RECORDING_ID
    PUBLIC.mkdir(parents=True, exist_ok=True)
    out = PUBLIC / f"{RECORDING_ID}.json"
    out.write_text(json.dumps(recording, indent=2, default=str) + "\n")
    index_path = PUBLIC / "index.json"
    entries = []
    if index_path.exists():
        entries = json.loads(index_path.read_text())
    entries = [item for item in entries if item.get("id") != RECORDING_ID]
    entries.insert(
        0,
        {
            "id": RECORDING_ID,
            "title": recording["title"],
            "description": recording["description"],
            "path": f"/recordings/{RECORDING_ID}.json",
            "mode": "recorded",
            "created_at": recording["created_at"],
        },
    )
    index_path.write_text(json.dumps(entries, indent=2) + "\n")
    print(
        json.dumps(
            {
                "out": str(out),
                "status": recording["status"],
                "conclusion": recording["conclusion"],
                "n_experiments": len(recording["experiments"]),
                "n_events": len(recording["events"]),
                "last": {k: last.get(k) for k in ("status", "proposer_error") if k in last or True},
            },
            indent=2,
            default=str,
        )
    )


if __name__ == "__main__":
    main()
