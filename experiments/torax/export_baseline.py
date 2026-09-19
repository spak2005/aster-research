"""Run the frozen baseline once and write a contract-shaped recording JSON.

This is a baseline snapshot, not a completed investigation.
"""

from __future__ import annotations

import json
from pathlib import Path

from experiments.torax import preset
from services.research.executor import ExecutionBudget, execute
from services.research.frames import extract_frames, sha256_file
from services.research.metrics import extract_from_path
from services.research.recording import (
    empty_recording,
    event,
    experiment_record,
)
from services.research.validation import baseline_config

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public" / "recordings"
RECORDING_ID = "torax-iterhybrid-baseline-1s"


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    config = baseline_config()
    result = execute(
        config,
        ExecutionBudget(timeout_s=180),
        experiment_id="baseline-h06",
    )
    if not result.ok or not result.output_nc:
        raise SystemExit(f"baseline run failed: {result.error}")

    metrics = extract_from_path(result.output_nc)
    import xarray as xr

    tree = xr.open_datatree(result.output_nc)
    try:
        frames = extract_frames(tree)
    finally:
        tree.close()

    peak = max(
        metrics.peak_ion_temperature_kev,
        metrics.peak_electron_temperature_kev,
        1.0,
    )
    scale_hi = max(25.0, float(int(peak) + 2))
    digest = sha256_file(result.output_nc)
    artifact_path = str(Path(result.output_nc))
    try:
        artifact_path = str(Path(result.output_nc).resolve().relative_to(ROOT))
    except ValueError:
        artifact_path = result.output_nc
    checks = [
        {"name": c.name, "status": c.status, "detail": c.detail}
        for c in metrics.checks
    ]
    hyp_id = "hyp-baseline"
    exp_id = "exp-baseline"
    run_id = RECORDING_ID
    recording = empty_recording(
        run_id=run_id,
        title="ITER-hybrid baseline snapshot",
        description=(
            "Genuine TORAX 1.4.3 baseline at the frozen 1.0 s, 51 MW heating "
            "point. Not a completed investigation: no agent loop and no "
            "candidate comparison have been recorded in this file yet."
        ),
        model="none (baseline snapshot)",
        seed=0,
        limitations=[
            "Baseline-only export; research loop not yet run.",
            "Horizon is 1.0 s, shortened from the documented 5 s example.",
            "Constant transport, heat-only evolution; not QLKNN.",
            "Schematic 3D reconstruction of radial profiles, not turbulence.",
        ],
        status="completed",
        mode="recorded",
    )
    recording["baseline_id"] = exp_id
    recording["best_experiment_id"] = None
    recording["temperature_scale_kev"] = [0.0, scale_hi]
    recording["budget"] = {
        "max_experiments": 6,
        "completed_experiments": 1,
        "wall_time_s": result.wall_time_s,
    }
    recording["provenance"]["raw_artifact_path"] = artifact_path
    recording["hypotheses"] = [
        {
            "id": hyp_id,
            "parent_id": None,
            "title": "Record the frozen ITER-hybrid heating baseline",
            "prediction": "The baseline completes and exposes E_fusion in joules.",
            "status": "inconclusive",
            "assessment": (
                "Baseline ran. Investigation is not complete; no candidate has "
                "been compared in this recording."
            ),
            "experiment_ids": [exp_id],
            "evidence_ids": [exp_id],
            "created_sequence": 1,
            "resolved_sequence": 5,
        }
    ]
    recording["experiments"] = [
        experiment_record(
            experiment_id=exp_id,
            hypothesis_id=hyp_id,
            label="ITER-hybrid baseline",
            role="baseline",
            config=config,
            metrics=metrics.as_contract_metrics(),
            frames=frames,
            artifacts=[
                {
                    "label": "torax-netcdf",
                    "path": artifact_path,
                    "sha256": digest,
                }
            ],
            checks=checks,
            wall_time_s=result.wall_time_s,
        )
    ]
    recording["events"] = [
        event(
            run_id=run_id,
            sequence=0,
            event_type="run.started",
            title="Baseline snapshot started",
            summary=preset.QUESTION,
            payload={"preset": "fixed-energy"},
        ),
        event(
            run_id=run_id,
            sequence=1,
            event_type="hypothesis.proposed",
            title="Record the frozen baseline",
            summary="Measure E_fusion at documented generic_heat settings.",
            hypothesis_id=hyp_id,
        ),
        event(
            run_id=run_id,
            sequence=2,
            event_type="experiment.requested",
            title="Request baseline",
            summary="location=0.127 width=0.073 P=51 MW t=1 s",
            hypothesis_id=hyp_id,
            experiment_id=exp_id,
            payload=config.as_contract_dict(),
        ),
        event(
            run_id=run_id,
            sequence=3,
            event_type="experiment.started",
            title="Baseline running",
            summary="TORAX 1.4.3 sequential worker",
            hypothesis_id=hyp_id,
            experiment_id=exp_id,
        ),
        event(
            run_id=run_id,
            sequence=4,
            event_type="experiment.completed",
            title="Baseline completed",
            summary=(
                f"E_fusion={metrics.fusion_energy_mj:.3f} MJ, "
                f"E_aux={metrics.heating_energy_mj:.3f} MJ"
            ),
            hypothesis_id=hyp_id,
            experiment_id=exp_id,
            evidence_ids=[exp_id],
            payload=metrics.as_contract_metrics(),
        ),
        event(
            run_id=run_id,
            sequence=5,
            event_type="conclusion.recorded",
            title="Investigation not complete",
            summary="Baseline snapshot only. No candidate comparison in this file.",
            hypothesis_id=hyp_id,
            evidence_ids=[exp_id],
        ),
        event(
            run_id=run_id,
            sequence=6,
            event_type="run.completed",
            title="Snapshot export finished",
            summary="Recording marked inconclusive pending the research loop.",
        ),
    ]
    recording["conclusion"] = {
        "status": "inconclusive",
        "title": "Baseline snapshot only",
        "summary": (
            f"Measured baseline integrated fusion energy "
            f"{metrics.fusion_energy_mj:.3f} MJ over 1.0 s at 51 MJ heating. "
            "This file is not a completed investigation."
        ),
        "evidence_ids": [exp_id],
    }

    out = PUBLIC / f"{RECORDING_ID}.json"
    out.write_text(json.dumps(recording, indent=2) + "\n")
    index = [
        {
            "id": RECORDING_ID,
            "title": recording["title"],
            "description": recording["description"],
            "path": f"/recordings/{RECORDING_ID}.json",
            "mode": "recorded",
            "created_at": recording["created_at"],
        }
    ]
    (PUBLIC / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(f"wrote {out} frames={len(frames)} E_fusion_MJ={metrics.fusion_energy_mj}")


if __name__ == "__main__":
    main()
