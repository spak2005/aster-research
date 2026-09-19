"""Local API contract tests with a fake executor. No extra HTTP client dep."""

from __future__ import annotations

import unittest
from tests.research.isolation import IsolatedResearchTest

from fastapi import HTTPException
from pydantic import ValidationError

from experiments.torax import preset
from services.research import api
from services.research.api import CreateRun
from services.research.models import Decision
from tests.research.test_loop import _executor_factory


class ApiTests(IsolatedResearchTest):
    def setUp(self) -> None:
        super().setUp()
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
        api._WORKER_RESERVED = False

    def tearDown(self) -> None:
        worker = api._WORKER
        if worker is not None:
            worker.join(timeout=10)
        api._FACTORY.clear()
        api._RUNS.clear()
        api._WORKER = None
        api._WORKER_RESERVED = False

    def test_default_local_flow_reserves_verification(self) -> None:
        budget = api._budget_for(CreateRun(max_experiments=6))
        self.assertEqual(budget.search_slots, 3)
        self.assertEqual(budget.verification_slots, 3)

    def test_minimum_budget_remains_bounded(self) -> None:
        budget = api._budget_for(CreateRun(max_experiments=3))
        self.assertEqual(budget.search_slots, 2)
        self.assertEqual(budget.verification_slots, 1)

    def test_invalid_allocation_is_rejected_before_worker_reservation(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            api.create_run(CreateRun(max_experiments=6, search_slots=5, verification_slots=3))
        self.assertEqual(caught.exception.status_code, 422)
        self.assertFalse(api._WORKER_RESERVED)
        self.assertFalse(api._RUNS)

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

    def test_invalid_run_id_rejected_before_disk(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            api.get_run("../etc/passwd")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_second_create_is_409_without_orphan(self) -> None:
        import threading
        import time

        from services.research.executor import ExecutionBudget, ExecutionResult
        from services.research.validation import HeatingConfig

        release = threading.Event()

        def blocking_executor(
            config: HeatingConfig, budget: ExecutionBudget, experiment_id: str
        ) -> ExecutionResult:
            release.wait(timeout=5)
            return ExecutionResult(
                experiment_id=experiment_id,
                ok=False,
                wall_time_s=0.01,
                output_nc=None,
                error="blocked",
                timed_out=False,
                config=config,
                n_rho=budget.n_rho,
                chi_timestep_prefactor=budget.chi_timestep_prefactor,
            )

        api._FACTORY["executor"] = blocking_executor
        first = api.create_run(
            CreateRun(question=preset.QUESTION, preset="fixed-energy", max_experiments=3, seed=0)
        )
        time.sleep(0.05)
        with self.assertRaises(HTTPException) as ctx:
            api.create_run(
                CreateRun(question=preset.QUESTION, preset="fixed-energy", max_experiments=3, seed=1)
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(len(api._RUNS), 1)
        self.assertIn(first["id"], api._RUNS)
        release.set()
        worker = api._WORKER
        if worker is not None:
            worker.join(timeout=10)


if __name__ == "__main__":
    unittest.main()
