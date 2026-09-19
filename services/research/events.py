"""Append-only research event log. Existing events are never rewritten."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from services.research.recording import event as make_event


class EventLogError(ValueError):
    pass


class EventLog:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._events: list[dict[str, Any]] = []
        if self.path.exists():
            self._events = [
                json.loads(line)
                for line in self.path.read_text().splitlines()
                if line.strip()
            ]
            self._assert_monotonic(self._events)

    @staticmethod
    def _assert_monotonic(events: Iterable[dict[str, Any]]) -> None:
        seen_ids: set[str] = set()
        last = -1
        for item in events:
            seq = int(item["sequence"])
            eid = str(item["event_id"])
            if seq <= last:
                raise EventLogError(f"non-monotonic sequence {seq} after {last}")
            if eid in seen_ids:
                raise EventLogError(f"duplicate event_id {eid}")
            seen_ids.add(eid)
            last = seq

    @property
    def events(self) -> list[dict[str, Any]]:
        return list(self._events)

    def next_sequence(self) -> int:
        if not self._events:
            return 0
        return int(self._events[-1]["sequence"]) + 1

    def append(self, **kwargs: Any) -> dict[str, Any]:
        if "sequence" not in kwargs:
            kwargs["sequence"] = self.next_sequence()
        item = make_event(**kwargs)
        candidate = self._events + [item]
        self._assert_monotonic(candidate)
        with self.path.open("a") as handle:
            handle.write(json.dumps(item) + "\n")
        self._events.append(item)
        return item

    def after(self, sequence: int) -> list[dict[str, Any]]:
        return [item for item in self._events if int(item["sequence"]) > sequence]
