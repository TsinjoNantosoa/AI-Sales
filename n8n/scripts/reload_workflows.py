#!/usr/bin/env python3
"""Deactivate then reactivate all workflows to force n8n to reload."""
import json
import time
import urllib.error
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZDYyZGQ4Ny1lOWU0LTQyM2MtODUyOS0zZGVkZjNkM2E0ZTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjllMjgxODctOWZhMS00MGQ4LThkMzQtYzYwNGRhNGUxNWY4IiwiaWF0IjoxNzg2NTM3NTM5LCJleHAiOjE3OTE2Njk2MDB9.Z4GOqBNbU0QFxHp5dvsXYHchYeuRhww6QJsTsNqZBmY"
N8N_URL = "http://localhost:5678"
HEADERS = {"Content-Type": "application/json", "X-N8N-API-KEY": API_KEY}


def api(method, path, body=None, timeout=60):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{N8N_URL}{path}", data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:300]}") from e


workflows = api("GET", "/api/v1/workflows?limit=100")["data"]
active_wfs = [w for w in workflows if w.get("active")]

print(f"Reloading {len(active_wfs)} active workflows...")
for w in active_wfs:
    wf_id = w["id"]
    name = w["name"]
    try:
        api("POST", f"/api/v1/workflows/{wf_id}/deactivate")
        print(f"  Deactivated: {name}")
        time.sleep(0.5)
        api("POST", f"/api/v1/workflows/{wf_id}/activate", timeout=60)
        print(f"  Reactivated: {name}")
    except Exception as e:
        print(f"  WARN {name}: {e}")
    time.sleep(0.5)

print("\nFinal status:")
for w in sorted(api("GET", "/api/v1/workflows?limit=100")["data"], key=lambda x: x["name"]):
    print(f"  {'[ON]' if w.get('active') else '[off]'}  {w['name']}")
