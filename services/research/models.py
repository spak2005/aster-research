"""Credential-safe research proposer: Cursor CLI in ask mode.

This process is not the scientific judge. It only returns a parsed decision.
No filesystem tools are requested; ask mode is read-only.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

AGENT_BIN = os.environ.get("CURSOR_AGENT_BIN", shutil.which("agent") or "agent")
RESEARCH_MODEL = os.environ.get(
    "RESEARCH_MODEL", "cursor-grok-4.6-high-fast"
)
DEFAULT_TIMEOUT_S = 120
ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Decision:
    ok: bool
    action: str  # experiment | verify | revise | stop
    hypothesis: str
    prediction: str
    heating_location: float | None = None
    heating_width: float | None = None
    rationale: str = ""
    raw_text: str = ""
    error: str | None = None
    envelope: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "action": self.action,
            "hypothesis": self.hypothesis,
            "prediction": self.prediction,
            "heating_location": self.heating_location,
            "heating_width": self.heating_width,
            "rationale": self.rationale,
            "error": self.error,
        }


def _extract_json_object(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    candidates: list[str] = []
    fenced = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, flags=re.S)
    candidates.extend(fenced)
    # Last object-looking span.
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end > start:
        candidates.append(stripped[start : end + 1])
    for blob in candidates:
        try:
            parsed = json.loads(blob)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def parse_agent_stdout(stdout: str) -> Decision:
    """Parse Cursor --output-format json envelope, then the decision object."""
    envelope: dict[str, Any] = {}
    text = stdout.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            envelope = parsed
            if "result" in parsed:
                result_body = parsed["result"]
                if isinstance(result_body, dict) and {
                    "action",
                    "hypothesis",
                    "prediction",
                }.issubset(result_body.keys()):
                    return _decision_from_mapping(result_body, stdout, envelope)
                if isinstance(result_body, str):
                    text = result_body
            elif "message" in parsed and isinstance(parsed["message"], str):
                text = parsed["message"]
            elif {
                "action",
                "hypothesis",
                "prediction",
            }.issubset(parsed.keys()):
                return _decision_from_mapping(parsed, stdout, envelope)
    except json.JSONDecodeError:
        # Cursor may emit a JSON line plus trailing logs; try line-wise.
        for line in reversed(stdout.splitlines()):
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                envelope = parsed
                if "result" in parsed and isinstance(parsed["result"], str):
                    text = parsed["result"]
                break

    body = _extract_json_object(text) or _extract_json_object(stdout)
    if body is None:
        return Decision(
            ok=False,
            action="stop",
            hypothesis="",
            prediction="",
            error="proposer returned no JSON decision",
            raw_text=stdout,
            envelope=envelope,
        )
    return _decision_from_mapping(body, stdout, envelope)


def _decision_from_mapping(
    body: dict[str, Any], raw: str, envelope: dict[str, Any]
) -> Decision:
    action = str(body.get("action", "")).strip().lower()
    if action not in {"experiment", "verify", "revise", "stop"}:
        return Decision(
            ok=False,
            action="stop",
            hypothesis=str(body.get("hypothesis", "")),
            prediction=str(body.get("prediction", "")),
            error=f"unsupported action {action!r}",
            raw_text=raw,
            envelope=envelope,
        )
    location = body.get("heating_location")
    width = body.get("heating_width")
    try:
        loc_f = float(location) if location is not None else None
        width_f = float(width) if width is not None else None
    except (TypeError, ValueError):
        return Decision(
            ok=False,
            action="stop",
            hypothesis=str(body.get("hypothesis", "")),
            prediction=str(body.get("prediction", "")),
            error="heating_location/width must be numbers",
            raw_text=raw,
            envelope=envelope,
        )
    return Decision(
        ok=True,
        action=action,
        hypothesis=str(body.get("hypothesis", "")).strip(),
        prediction=str(body.get("prediction", "")).strip(),
        heating_location=loc_f,
        heating_width=width_f,
        rationale=str(body.get("rationale", "")).strip(),
        raw_text=raw,
        envelope=envelope,
    )


def build_prompt(context: dict[str, Any]) -> str:
    return (
        "You are the scientific proposer for a bounded TORAX heating-profile "
        "search. You do not run tools. You do not edit files. Reply with ONE "
        "JSON object and nothing else, using this shape:\n"
        '{"action":"experiment"|"verify"|"revise"|"stop",'
        '"hypothesis":"short",'
        '"prediction":"short measurable prediction",'
        '"heating_location":number|null,'
        '"heating_width":number|null,'
        '"rationale":"why this next step given the measured evidence"}\n'
        "Rules:\n"
        "- Inspect the measured results. The next experiment must depend on them.\n"
        "- Only heating_location and heating_width may change.\n"
        f"- location in {context.get('location_bounds')}, "
        f"width in {context.get('width_bounds')}.\n"
        "- Power 51 MW and duration 1.0 s are frozen.\n"
        "- Objective is integrated P_fusion as E_fusion/1e6 megajoules.\n"
        "- action=experiment requires location and width.\n"
        "- action=verify if a candidate looks better and needs a refined grid.\n"
        "- action=stop if budget is gone or further search is not justified.\n"
        "- Do not claim discovery. Do not invent metrics.\n\n"
        f"CONTEXT:\n{json.dumps(context, indent=2, default=str)}\n"
    )


def propose(
    context: dict[str, Any],
    *,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    cwd: str | Path | None = None,
) -> Decision:
    prompt = build_prompt(context)
    workdir = Path(cwd) if cwd else Path(
        os.environ.get("RESEARCH_PROPOSER_CWD", ROOT / "runtime" / "proposer")
    )
    workdir.mkdir(parents=True, exist_ok=True)
    cmd = [
        AGENT_BIN,
        "--print",
        "--mode",
        "ask",
        "--trust",
        "--model",
        RESEARCH_MODEL,
        "--output-format",
        "json",
        prompt,
    ]
    try:
        completed = subprocess.run(
            cmd,
            cwd=str(workdir),
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired:
        return Decision(
            ok=False,
            action="stop",
            hypothesis="",
            prediction="",
            error=f"proposer timed out after {timeout_s}s",
        )
    except FileNotFoundError:
        return Decision(
            ok=False,
            action="stop",
            hypothesis="",
            prediction="",
            error=f"agent CLI not found: {AGENT_BIN}",
        )
    if completed.returncode != 0:
        return Decision(
            ok=False,
            action="stop",
            hypothesis="",
            prediction="",
            error=f"agent exit {completed.returncode}: {completed.stderr[-2000:]}",
            raw_text=completed.stdout,
        )
    return parse_agent_stdout(completed.stdout)
