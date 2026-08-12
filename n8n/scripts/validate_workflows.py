#!/usr/bin/env python3
"""Static validation for the AI Sales n8n workflow pack."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WF_DIR = ROOT / "workflows"
EXPECTED = {
    "01_lead_capture.json": ("AI Sales — Lead Capture", "lead-created"),
    "02_ai_qualification.json": ("AI Sales — AI Qualification", "qualification-updated"),
    "03_hot_lead_alert.json": ("AI Sales — Hot Lead Alert", "hot-lead-alert"),
    "04_follow_up.json": ("AI Sales — Follow-up", None),
    "05_appointment_booking.json": ("AI Sales — Appointment Booking", "appointment-created"),
    "06_meeting_reminder.json": ("AI Sales — Meeting Reminder", None),
    "99_global_error_handler.json": ("AI Sales — Global Error Handler", None),
}
EVENT_FILES = {"01_lead_capture.json", "02_ai_qualification.json", "03_hot_lead_alert.json", "05_appointment_booking.json"}
SCHEDULED = {"04_follow_up.json", "06_meeting_reminder.json"}
FORBIDDEN = [
    re.compile(r"CONFIGURE_AI_SALES_INTERNAL_API"),
    re.compile(r"PLACEHOLDER_"),
    re.compile(r"FAKE_"),
    re.compile(r"https?://[a-z0-9-]+\.ngrok(?:-free)?\.(?:app|dev)", re.I),
    re.compile(r"sk-[A-Za-z0-9_-]{12,}"),
    re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----"),
]
SECRET_ASSIGN = [
    re.compile(r'"(?:OPENAI_API_KEY|GOOGLE_CLIENT_SECRET|SMTP_PASSWORD|INTERNAL_API_KEY|N8N_WEBHOOK_SECRET)"\s*:\s*"(?!\{\{|=\{\{|\$env)[^\"]{8,}"', re.I),
]


def fail(errors: list[str], file: str, msg: str) -> None:
    errors.append(f"{file}: {msg}")


def validate(path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    text = path.read_text(encoding="utf-8")
    try:
        data = json.loads(text)
    except Exception as exc:
        return [f"{path.name}: invalid JSON: {exc}"], []

    exp_name, exp_webhook = EXPECTED[path.name]
    if data.get("name") != exp_name:
        fail(errors, path.name, f"unexpected name {data.get('name')!r}")
    nodes = data.get("nodes") or []
    connections = data.get("connections") or {}
    if not nodes:
        fail(errors, path.name, "no nodes")
    node_names = [n.get("name") for n in nodes]
    if len(node_names) != len(set(node_names)):
        fail(errors, path.name, "duplicate node names")
    node_set = set(node_names)

    for source, mapping in connections.items():
        if source not in node_set:
            fail(errors, path.name, f"connection source missing: {source}")
        for branch in mapping.get("main", []):
            for target in branch:
                if target.get("node") not in node_set:
                    fail(errors, path.name, f"connection target missing: {target.get('node')}")

    for pattern in FORBIDDEN:
        if pattern.search(text):
            fail(errors, path.name, f"forbidden pattern: {pattern.pattern}")
    for pattern in SECRET_ASSIGN:
        if pattern.search(text):
            fail(errors, path.name, "possible committed secret")

    # Never put AI or direct database nodes in the orchestration pack.
    for n in nodes:
        t = str(n.get("type", ""))
        if "langchain" in t.lower() or "openai" in t.lower():
            fail(errors, path.name, f"AI node forbidden: {n.get('name')}")
        if t in {"n8n-nodes-base.postgres", "n8n-nodes-base.mySql", "n8n-nodes-base.microsoftSql"}:
            fail(errors, path.name, f"direct business DB node forbidden: {n.get('name')}")
        if t == "n8n-nodes-base.httpRequest":
            url = str(n.get("parameters", {}).get("url", ""))
            if "$env.AI_SALES_BACKEND_URL" not in url:
                fail(errors, path.name, f"HTTP node does not use backend env URL: {n.get('name')}")
            headers = n.get("parameters", {}).get("headerParameters", {}).get("parameters", [])
            if not any(h.get("name") == "X-Internal-Key" and "$env.INTERNAL_API_KEY" in str(h.get("value", "")) for h in headers):
                fail(errors, path.name, f"HTTP node missing internal auth: {n.get('name')}")
            if n.get("retryOnFail") is not True:
                fail(errors, path.name, f"HTTP node retryOnFail not enabled: {n.get('name')}")
            if not (2 <= int(n.get("maxTries", 0)) <= 5):
                fail(errors, path.name, f"HTTP node maxTries invalid: {n.get('name')}")

    if exp_webhook:
        webhooks = [n for n in nodes if n.get("type") == "n8n-nodes-base.webhook"]
        if len(webhooks) != 1:
            fail(errors, path.name, "must contain exactly one Webhook trigger")
        elif webhooks[0].get("parameters", {}).get("path") != exp_webhook:
            fail(errors, path.name, f"wrong webhook path; expected {exp_webhook}")

    if path.name in EVENT_FILES:
        for required_name in ["02 Verify Webhook Secret", "03 Authorized?", "04 Normalize + Validate Event", "05 Register Execution", "06 Duplicate?", "07 Workflow Enabled?", "100 Respond"]:
            if required_name not in node_set:
                fail(errors, path.name, f"missing required event node: {required_name}")
        if "N8N_WEBHOOK_SECRET" not in text or "x-n8n-webhook-key" not in text.lower():
            fail(errors, path.name, "webhook secret validation missing")
        if "03b Respond Unauthorized" not in node_set:
            fail(errors, path.name, "401 unauthorized branch missing")

    if path.name in SCHEDULED:
        for required_name in ["03 Register Execution", "04 Duplicate Run?", "05 Workflow Enabled?", "06 Fetch Due Items", "08 Has Work?", "09 Execute Item", "99 Mark Success"]:
            if required_name not in node_set:
                fail(errors, path.name, f"missing scheduled node: {required_name}")
        success = next((n for n in nodes if n.get("name") == "99 Mark Success"), None)
        if not success or success.get("executeOnce") is not True:
            fail(errors, path.name, "scheduled success callback must execute once")

    # Specific architecture invariants.
    if path.name == "02_ai_qualification.json" and "hot-lead-actions" in text:
        fail(errors, path.name, "qualification must not duplicate workflow 03 hot-lead actions")
    if path.name == "01_lead_capture.json" and "event_id" not in text:
        fail(errors, path.name, "welcome action must receive event_id")
    if path.name == "03_hot_lead_alert.json" and "event_id" not in text:
        fail(errors, path.name, "hot-lead action must receive event_id")
    if path.name == "05_appointment_booking.json" and "event_id" not in text:
        fail(errors, path.name, "booking action must receive event_id")
    if path.name == "99_global_error_handler.json":
        if not any(n.get("type") == "n8n-nodes-base.errorTrigger" for n in nodes):
            fail(errors, path.name, "Error Trigger missing")
        if "executions/failure-report" not in text:
            fail(errors, path.name, "failure-report callback missing")

    # Warn on raw localhost only if not the documented Docker fallback.
    for m in re.finditer(r"http://localhost:\d+", text):
        warnings.append(f"{path.name}: localhost reference at offset {m.start()}")
    return errors, warnings


def main() -> int:
    found = {p.name for p in WF_DIR.glob("*.json")}
    errors: list[str] = []
    warnings: list[str] = []
    missing = set(EXPECTED) - found
    extra = found - set(EXPECTED)
    if missing:
        errors.append(f"missing workflow files: {sorted(missing)}")
    if extra:
        errors.append(f"unexpected workflow files: {sorted(extra)}")
    for filename in sorted(set(EXPECTED) & found):
        e, w = validate(WF_DIR / filename)
        errors.extend(e); warnings.extend(w)
    if warnings:
        print("WARNINGS")
        for w in warnings: print("  -", w)
    if errors:
        print("VALIDATION FAILED")
        for e in errors: print("  -", e)
        return 1
    print(f"OK — {len(EXPECTED)}/7 AI Sales n8n workflows passed static validation")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
