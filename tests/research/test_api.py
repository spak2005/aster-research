"""Local API contract tests with a fake executor. No extra HTTP client dep."""

from __future__ import annotations

import unittest

from fastapi import HTTPException
from pydantic import ValidationError

from experiments.torax import preset
from services.research import api
from services.research.api import CreateRun
from services.research.models import Decision
from tests.research.test_loop import _executor_factory


class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        api._FACTORY["executor"] = _executor_factory(
            {
                (round(preset.BASELINE_LOCATION, 5), round(preset.BASELINE_WIDTH, 5)): 100.0e6,
            }
        )
        api._FACTORY["proposer"] = lambda ctx: Decision(
            ok=True,
            action="stop",
            hypothesis="stop",
            prediction="stop",
            rationale="api test",
        )
        api._RUNS.clear()
        api._WORKER = None

    def tearDown(self) -> None:
        worker = api._WORKER
        if worker is not None:
            worker.join(timeout=10)
        api._FACTORY.clear()
        api._RUNS.clear()
        api._WORKER = None

    def test_health(self) -> None:
        body = api.health()
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["simulator"], "TORAX")
        self.assertIn("ready", body)

    def test_rejects_bad_preset_and_budget(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            api.create_run(
                CreateRun(question="q", preset="other", max_experiments=4, seed=0)
            )
        self.assertEqual(ctx.exception.status_code, 400)
        with self.assertRaises(ValidationError):
            CreateRun(question="q", preset="fixed-energy", max_experiments=2, seed=0)

    def test_create_and_read_run(self) -> None:
        created = api.create_run(
            CreateRun(
                question=preset.QUESTION,
                preset="fixed-energy",
                max_experiments=3,
                seed=0,
            )
        )
        run_id = created["id"]
        self.assertEqual(created["status"], "running")
        listed = api.list_runs()
        self.assertTrue(any(item["id"] == run_id for item in listed))
        recording = api.get_run(run_id)
        self.assertEqual(recording["id"], run_id)
        events = api.get_events(run_id, after=0)
        self.assertIsInstance(events, list)
        canceled = api.cancel_run(run_id)
        self.assertEqual(canceled["status"], "cancel_requested")


if __name__ == "__main__":
    unittest.main()
