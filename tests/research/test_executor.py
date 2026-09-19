"""Sequential executor and timeout tests. No TORAX import required."""

from __future__ import annotations

import time
import unittest
from tests.research.isolation import IsolatedResearchTest
from pathlib import Path

from services.research.executor import ExecutionBudget, execute
from services.research.validation import HeatingConfig


def _ok_runner(config: HeatingConfig, budget: ExecutionBudget, dest: Path) -> dict:
    dest.mkdir(parents=True, exist_ok=True)
    nc = dest / "output.nc"
    nc.write_bytes(b"fake")
    return {
        "ok": True,
        "output_nc": str(nc),
        "error": None,
        "timed_out": False,
        "sim_error": 0,
        "sim_status": "completed",
    }


def _slow_runner(config: HeatingConfig, budget: ExecutionBudget, dest: Path) -> dict:
    time.sleep(0.4)
    return _ok_runner(config, budget, dest)


class ExecutorTests(IsolatedResearchTest):
    def test_injected_runner_saves_meta(self) -> None:
        cfg = HeatingConfig(heating_location=0.2, heating_width=0.1)
        result = execute(
            cfg,
            ExecutionBudget(timeout_s=5),
            experiment_id="test-ok",
            runner=_ok_runner,
        )
        self.assertTrue(result.ok)
        self.assertFalse(result.timed_out)
        self.assertTrue(Path(result.output_nc).exists())
        self.assertEqual(len(result.config_hash or ""), 64)

    def test_timeout_marks_failure(self) -> None:
        cfg = HeatingConfig(heating_location=0.2, heating_width=0.1)
        result = execute(
            cfg,
            ExecutionBudget(timeout_s=0.05),
            experiment_id="test-timeout",
            runner=_slow_runner,
        )
        self.assertFalse(result.ok)
        self.assertTrue(result.timed_out)
        self.assertIn("timeout", result.error or "")


if __name__ == "__main__":
    unittest.main()
