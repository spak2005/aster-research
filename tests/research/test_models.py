"""Research proposer parser tests. Does not call the live CLI."""

from __future__ import annotations

import json
import unittest

from services.research.models import parse_agent_stdout


class ParseDecisionTests(unittest.TestCase):
    def test_parses_direct_decision(self) -> None:
        body = {
            "action": "experiment",
            "hypothesis": "off-axis heating lowers fusion",
            "prediction": "E_fusion < baseline",
            "heating_location": 0.4,
            "heating_width": 0.15,
            "rationale": "core was hotter on-axis",
        }
        decision = parse_agent_stdout(json.dumps(body))
        self.assertTrue(decision.ok)
        self.assertEqual(decision.action, "experiment")
        self.assertEqual(decision.heating_location, 0.4)

    def test_parses_cursor_result_envelope(self) -> None:
        inner = {
            "action": "stop",
            "hypothesis": "no gain",
            "prediction": "stop",
            "heating_location": None,
            "heating_width": None,
            "rationale": "budget",
        }
        envelope = json.dumps({"type": "result", "result": json.dumps(inner)})
        decision = parse_agent_stdout(envelope)
        self.assertTrue(decision.ok)
        self.assertEqual(decision.action, "stop")

    def test_parses_fenced_json(self) -> None:
        text = 'Here:\n```json\n{"action":"verify","hypothesis":"h","prediction":"p"}\n```\n'
        decision = parse_agent_stdout(text)
        self.assertTrue(decision.ok)
        self.assertEqual(decision.action, "verify")

    def test_rejects_unknown_action(self) -> None:
        decision = parse_agent_stdout(
            json.dumps({"action": "hack", "hypothesis": "x", "prediction": "y"})
        )
        self.assertFalse(decision.ok)


if __name__ == "__main__":
    unittest.main()
