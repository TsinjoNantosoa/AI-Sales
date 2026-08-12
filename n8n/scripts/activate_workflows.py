#!/usr/bin/env python3
"""Activate n8n workflows and configure Global Error Handler (n8n 2.x compatible)."""
import json
import time
import urllib.error
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZDYyZGQ4Ny1lOWU0LTQyM2MtODUyOS0zZGVkZjNkM2E0ZTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjllMjgxODctOWZhMS00MGQ4LThkMzQtYzYwNGRhNGUxNWY4IiwiaWF0IjoxNzg2NTM3NTM5LCJleHAiOjE3OTE2Njk2MDB9.Z4GOqBNbU0QFxHp5dvsXYHchYeuRhww6QJsTsNqZBmY"
N8N_URL = "http://localhost:5678"
HEADERS = {"Content-Type": "application/json", "X-N8N-API-KEY": API_KEY}


def api(method: str, path: str, body: dict | None = None, timeout: int = 30):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{N8N_URL}{path}", data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            content = r.read()
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {err[:300]}") from e


# 1. List all workflows
workflows = api("GET", "/api/v1/workflows?limit=100")["data"]
print(f"Found {len(workflows)} workflows")

# 2. Deduplicate — keep the most recent by id (lexicographic last for same name)
seen: dict[str, dict] = {}
for w in workflows:
    name = w["name"]
    if name not in seen:
        seen[name] = w
    else:
        # delete the older duplicate
        old = seen[name]
        try:
            api("DELETE", f"/api/v1/workflows/{old['id']}")
            print(f"  Deleted duplicate: {old['id']} ({name})")
        except Exception as e:
            print(f"  WARN delete failed: {e}")
        seen[name] = w

workflows = list(seen.values())
wf_map = {w["name"]: w for w in workflows}

# 3. Identify error handler
error_wf = wf_map.get("AI Sales \u2014 Global Error Handler")
if not error_wf:
    print("ERROR: Global Error Handler not found!")
    raise SystemExit(1)
error_wf_id = error_wf["id"]
print(f"Global Error Handler id: {error_wf_id}")

TO_ACTIVATE = [
    "AI Sales \u2014 Lead Capture",
    "AI Sales \u2014 AI Qualification",
    "AI Sales \u2014 Hot Lead Alert",
    "AI Sales \u2014 Follow-up",
    "AI Sales \u2014 Appointment Booking",
    "AI Sales \u2014 Meeting Reminder",
]

for name in TO_ACTIVATE:
    wf = wf_map.get(name)
    if not wf:
        print(f"WARN: {name} not found")
        continue
    wf_id = wf["id"]

    # Fetch full workflow to PUT back with updated settings
    try:
        full = api("GET", f"/api/v1/workflows/{wf_id}")
        settings = full.get("settings", {})
        settings["errorWorkflow"] = error_wf_id
        # PUT requires sending the complete workflow
        payload = {
            "name": full["name"],
            "nodes": full["nodes"],
            "connections": full["connections"],
            "settings": settings,
        }
        api("PUT", f"/api/v1/workflows/{wf_id}", payload)
        print(f"  Error handler configured: {name}")
    except Exception as e:
        print(f"  WARN settings: {e}")

    # Activate with generous timeout
    try:
        api("POST", f"/api/v1/workflows/{wf_id}/activate", timeout=60)
        print(f"  Activated: {name}")
    except Exception as e:
        print(f"  WARN activate: {e}")
    time.sleep(0.5)

print("\nFinal workflow list:")
final = api("GET", "/api/v1/workflows?limit=100")["data"]
for w in sorted(final, key=lambda x: x["name"]):
    print(f"  {'[ON] ' if w.get('active') else '[off]'} {w['id']}  {w['name']}")
print("\nDone.")
