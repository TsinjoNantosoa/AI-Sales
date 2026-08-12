#!/usr/bin/env python3
"""Verify that a running FastAPI OpenAPI schema contains endpoints required by n8n."""
from __future__ import annotations
import argparse, json, urllib.request

REQUIRED = {
    ("post", "/api/v1/internal/n8n/executions/start"),
    ("post", "/api/v1/internal/n8n/executions/{execution_id}/success"),
    ("post", "/api/v1/internal/n8n/executions/failure-report"),
    ("post", "/api/v1/internal/n8n/leads/{lead_id}/welcome"),
    ("get", "/api/v1/internal/n8n/leads/{lead_id}/hot-check"),
    ("post", "/api/v1/internal/n8n/leads/{lead_id}/hot-lead-actions"),
    ("get", "/api/v1/internal/n8n/follow-ups/due"),
    ("post", "/api/v1/internal/n8n/follow-ups/{lead_id}/execute"),
    ("post", "/api/v1/internal/n8n/appointments/{appointment_id}/booking-actions"),
    ("get", "/api/v1/internal/n8n/appointments/reminders/due"),
    ("post", "/api/v1/internal/n8n/appointments/{appointment_id}/send-reminder"),
}

def main() -> int:
    ap=argparse.ArgumentParser(); ap.add_argument("--backend", default="http://localhost:8000"); args=ap.parse_args()
    with urllib.request.urlopen(args.backend.rstrip('/')+"/openapi.json", timeout=15) as r:
        spec=json.load(r)
    paths=spec.get("paths",{})
    missing=[]
    for method,path in sorted(REQUIRED):
        if path not in paths or method not in paths[path]: missing.append(f"{method.upper()} {path}")
    if missing:
        print("MISSING BACKEND CONTRACT:")
        for x in missing: print(" -",x)
        return 1
    print(f"OK — {len(REQUIRED)} required backend operations found")
    return 0
if __name__ == '__main__': raise SystemExit(main())
