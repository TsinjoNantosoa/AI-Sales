from __future__ import annotations
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WF = ROOT / "workflows"

class WorkflowPackTests(unittest.TestCase):
    def load(self, name: str):
        return json.loads((WF / name).read_text(encoding="utf-8"))

    def test_exact_seven_workflows(self):
        self.assertEqual(len(list(WF.glob("*.json"))), 7)

    def test_no_openai_or_database_nodes(self):
        for p in WF.glob("*.json"):
            data=self.load(p.name)
            types=[str(n.get("type","")).lower() for n in data["nodes"]]
            self.assertFalse(any("openai" in t or "langchain" in t for t in types), p.name)
            self.assertFalse(any(t.endswith(".postgres") or t.endswith(".mysql") for t in types), p.name)

    def test_qualification_does_not_duplicate_hot_actions(self):
        text=(WF/"02_ai_qualification.json").read_text()
        self.assertNotIn("hot-lead-actions", text)

    def test_event_actions_pass_event_id(self):
        for name in ["01_lead_capture.json","03_hot_lead_alert.json","05_appointment_booking.json"]:
            self.assertIn("event_id", (WF/name).read_text(), name)

    def test_webhook_workflows_have_auth_gate(self):
        for name in ["01_lead_capture.json","02_ai_qualification.json","03_hot_lead_alert.json","05_appointment_booking.json"]:
            text=(WF/name).read_text()
            self.assertIn("X-N8N-Webhook-Key".lower(), text.lower())
            self.assertIn("N8N_WEBHOOK_SECRET", text)
            self.assertIn("responseCode\": 401", text)

if __name__ == "__main__": unittest.main()
