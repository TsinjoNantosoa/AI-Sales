#!/usr/bin/env python3
"""Import n8n workflows from Windows PowerShell."""
import json
import pathlib
import sys
import urllib.error
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZDYyZGQ4Ny1lOWU0LTQyM2MtODUyOS0zZGVkZjNkM2E0ZTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjllMjgxODctOWZhMS00MGQ4LThkMzQtYzYwNGRhNGUxNWY4IiwiaWF0IjoxNzg2NTM3NTM5LCJleHAiOjE3OTE2Njk2MDB9.Z4GOqBNbU0QFxHp5dvsXYHchYeuRhww6QJsTsNqZBmY"
N8N_URL = "http://localhost:5678"
WF_DIR = pathlib.Path(__file__).resolve().parents[1] / "workflows"

errors = 0
for f in sorted(WF_DIR.glob("*.json")):
    data = json.loads(f.read_text(encoding="utf-8"))
    # n8n 2.x: these fields are read-only on create
    for ro in ("active", "meta", "id", "versionId", "updatedAt", "createdAt"):
        data.pop(ro, None)
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{N8N_URL}/api/v1/workflows",
        data=body,
        headers={"Content-Type": "application/json", "X-N8N-API-KEY": API_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read())
            print(f"OK  {f.name}  id={resp.get('id')}")
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"ERR {f.name}  status={e.code}  body={err[:400]}")
        errors += 1

if errors:
    print(f"\n{errors} workflow(s) failed to import.")
    sys.exit(1)
else:
    print("\nAll 7 workflows imported successfully.")
