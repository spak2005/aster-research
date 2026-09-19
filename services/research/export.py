"""Copy a recording and its linked artifacts into public/recordings/."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from services.research.frames import sha256_file
from services.research.recording import atomic_write_json

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public" / "recordings"


def _copy_artifact(src: Path, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return sha256_file(dest)


def package_recording(
    recording: dict[str, Any],
    *,
    public_id: str,
    extra_files: list[tuple[Path, str]] | None = None,
) -> Path:
    """Rewrite artifact paths to /recordings/<id>/... and copy files beside the JSON.

    Existing v1 recordings are not rewritten by this helper.
    """
    dest_json = PUBLIC / f"{public_id}.json"
    artifact_root = PUBLIC / public_id
    packaged = json.loads(json.dumps(recording, default=str))
    packaged["id"] = public_id
    for experiment in packaged.get("experiments") or []:
        new_artifacts = []
        for artifact in experiment.get("artifacts") or []:
            label = str(artifact.get("label") or "artifact")
            src = Path(str(artifact.get("path") or ""))
            if not src.is_absolute():
                src = ROOT / src
            suffix = src.suffix or ".bin"
            safe_label = label.replace(" ", "-")
            rel = Path(public_id) / experiment["id"] / f"{safe_label}{suffix}"
            dest = PUBLIC / rel
            if src.exists():
                digest = _copy_artifact(src, dest)
            else:
                digest = artifact.get("sha256") or ""
            new_artifacts.append(
                {
                    "label": label,
                    "path": f"/recordings/{rel.as_posix()}",
                    "sha256": digest,
                }
            )
        experiment["artifacts"] = new_artifacts
    for src, rel_posix in extra_files or []:
        dest = PUBLIC / public_id / rel_posix
        if src.exists():
            _copy_artifact(src, dest)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    atomic_write_json(dest_json, packaged)
    _upsert_index(packaged, public_id)
    return dest_json


def _upsert_index(recording: dict[str, Any], public_id: str) -> None:
    index_path = PUBLIC / "index.json"
    entries: list[dict[str, Any]] = []
    if index_path.exists():
        entries = json.loads(index_path.read_text())
    entries = [item for item in entries if item.get("id") != public_id]
    entries.insert(
        0,
        {
            "id": public_id,
            "title": recording.get("title"),
            "description": recording.get("description"),
            "path": f"/recordings/{public_id}.json",
            "mode": recording.get("mode", "recorded"),
            "created_at": recording.get("created_at"),
        },
    )
    atomic_write_json(index_path, entries)
