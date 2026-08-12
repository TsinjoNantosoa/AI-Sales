#!/usr/bin/env python3
"""Update imported workflows with fixed expressions and activate Error Handler."""
import json
import pathlib
import time
import urllib.error
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZDYyZGQ4Ny1lOWU0LTQyM2MtODUyOS0zZGVkZjNkM2E0ZTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjllMjgxODctOWZhMS00MGQ4LThkMzQtYzYwNGRhNGUxNWY4IiwiaWF0IjoxNzg2NTM3NTM5LCJleHAiOjE3OTE2Njk2MDB9.Z4GOqBNbU0QFxHp5dvsXYHchYeuRhww6QJsTsNqZBmY"
N8N_URL = "http://localhost:5678"
HEADERS = {"Content-Type": "application/json", "X-N8N-API-KEY": API_KEY}
WF_DIR = pathlib.Path(__file__).resolve().parents[1] / "workflows"

FILE_TO_SLUG = {
    "01_lead_capture.json": "AI Sales \u2014 Lead Capture",
    "02_ai_qualification.json": "AI Sales \u2014 AI Qualification",
    "03_hot_lead_alert.json": "AI Sales \u2014 Hot Lead Alert",
    "04_follow_up.json": "AI Sales \u2014 Follow-up",
    "05_appointment_booking.json": "AI Sales \u2014 Appointment Booking",
    "06_meeting_reminder.json": "AI Sales \u2014 Meeting Reminder",
    "99_global_error_handler.json": "AI Sales \u2014 Global Error Handler",
}


def api(method, path, body=None, timeout=60):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{N8N_URL}{path}", data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:300]}") from e


# List existing workflows
existing = api("GET", "/api/v1/workflows?limit=100")["data"]
name_to_id = {w["name"]: w["id"] for w in existing}
print("Existing workflows:", list(name_to_id.keys()))

error_handler_id = name_to_id.get("AI Sales \u2014 Global Error Handler")
print(f"Error Handler id: {error_handler_id}")

# Update each workflow with fixed nodes
for fname, wf_name in FILE_TO_SLUG.items():
    wf_id = name_to_id.get(wf_name)
    if not wf_id:
        print(f"NOT FOUND in n8n: {wf_name}")
        continue

    data = json.loads((WF_DIR / fname).read_text(encoding="utf-8"))
    for ro in ("active", "meta", "id", "versionId", "updatedAt", "createdAt"):
        data.pop(ro, None)

    # Inject error workflow into settings (except the error handler itself)
    if error_handler_id and wf_name != "AI Sales \u2014 Global Error Handler":
        data.setdefault("settings", {})
        data["settings"]["errorWorkflow"] = error_handler_id

    try:
        api("PUT", f"/api/v1/workflows/{wf_id}", data)
        print(f"  Updated: {wf_name}")
    except Exception as e:
        print(f"  WARN update {wf_name}: {e}")
    time.sleep(0.3)

# Activate the Global Error Handler
if error_handler_id:
    try:
        api("POST", f"/api/v1/workflows/{error_handler_id}/activate")
        print("  Activated: Global Error Handler")
    except Exception as e:
        print(f"  WARN activate error handler: {e}")

# Final status
print("\nFinal status:")
final = api("GET", "/api/v1/workflows?limit=100")["data"]
for w in sorted(final, key=lambda x: x["name"]):
    st = "[ON] " if w.get("active") else "[off]"
    print(f"  {st} {w['id']}  {w['name']}")
