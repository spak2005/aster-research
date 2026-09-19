"""Append-only event log tests."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from services.research.events import EventLog, EventLogError


class EventLogTests(unittest.TestCase):
    def test_appends_monotonic_sequences(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            log = EventLog(Path(tmp) / "events.jsonl")
            first = log.append(run_id="r1", event_type="run.started", title="start", summary="s")
            second = log.append(run_id="r1", event_type="hypothesis.proposed", title="h", summary="s")
            self.assertEqual(first["sequence"], 0)
            self.assertEqual(second["sequence"], 1)
            self.assertEqual(len(log.after(0)), 1)
            reloaded = EventLog(Path(tmp) / "events.jsonl")
            self.assertEqual(len(reloaded.events), 2)

    def test_rejects_duplicate_ids_on_reload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.jsonl"
            path.write_text(
                '{"schema_version":"1.0","event_id":"a","run_id":"r","sequence":0,'
                '"timestamp":"t","type":"run.started","title":"t","summary":"s",'
                '"evidence_ids":[],"payload":{}}\n'
                '{"schema_version":"1.0","event_id":"a","run_id":"r","sequence":1,'
                '"timestamp":"t","type":"run.completed","title":"t","summary":"s",'
                '"evidence_ids":[],"payload":{}}\n'
            )
            with self.assertRaises(EventLogError):
                EventLog(path)


if __name__ == "__main__":
    unittest.main()
