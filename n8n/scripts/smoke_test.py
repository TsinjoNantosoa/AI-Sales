#!/usr/bin/env python3
"""Send safe sample events to the four webhook workflows."""
from __future__ import annotations
import argparse, json, os, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ("lead-created", "lead_created.json"),
    ("qualification-updated", "qualification_updated.json"),
    ("hot-lead-alert", "hot_lead.json"),
    ("appointment-created", "appointment_created.json"),
]

def post(url: str, payload: dict, secret: str) -> tuple[int, str]:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "X-N8N-Webhook-Key": secret,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default=os.getenv("N8N_BASE_URL", "http://localhost:5678"))
    ap.add_argument("--secret", default=os.getenv("N8N_WEBHOOK_SECRET", ""))
    ap.add_argument("--test-webhook", action="store_true", help="Use /webhook-test instead of active /webhook")
    args = ap.parse_args()
    if len(args.secret) < 16:
        print("ERROR: set N8N_WEBHOOK_SECRET (16+ chars)", file=sys.stderr); return 2
    prefix = "webhook-test" if args.test_webhook else "webhook"
    failures = 0
    for path, filename in CASES:
        payload = json.loads((ROOT / "examples" / filename).read_text())
        url = f"{args.base_url.rstrip('/')}/{prefix}/{path}"
        status, text = post(url, payload, args.secret)
        ok = 200 <= status < 300
        failures += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'} {path}: HTTP {status} {text[:240]}")
    return 1 if failures else 0

if __name__ == "__main__":
    raise SystemExit(main())
