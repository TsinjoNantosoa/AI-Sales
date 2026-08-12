#!/usr/bin/env python3
"""Validate exported n8n workflow JSON files."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / "workflows"
SECRET_PATTERNS = (
    re.compile(r"sk-[a-zA-Z0-9]{10,}"),
    re.compile(r"BEGIN PRIVATE KEY"),
    re.compile(r"password\s*[:=]\s*['\"][^'\"]+['\"]", re.I),
)

EXPECTED = {
    "01_lead_capture.json": "lead-created",
    "02_ai_qualification.json": "qualification-updated",
    "03_hot_lead_alert.json": "hot-lead-alert",
    "05_appointment_booking.json": "appointment-created",
}


def main() -> int:
    errors: list[str] = []
    if not WORKFLOWS.exists():
        errors.append(f"missing directory: {WORKFLOWS}")
    else:
        files = sorted(WORKFLOWS.glob("*.json"))
        if len(files) < 7:
            errors.append(f"expected 7 workflows, found {len(files)}")
        for path in files:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not data.get("name"):
                errors.append(f"{path.name}: missing name")
            if not data.get("nodes"):
                errors.append(f"{path.name}: missing nodes")
            if not data.get("connections"):
                errors.append(f"{path.name}: missing connections")
            blob = path.read_text(encoding="utf-8")
            for pat in SECRET_PATTERNS:
                if pat.search(blob):
                    errors.append(f"{path.name}: possible secret detected")
            if path.name in EXPECTED:
                if EXPECTED[path.name] not in blob:
                    errors.append(f"{path.name}: missing webhook path {EXPECTED[path.name]}")
    if errors:
        print("VALIDATION FAILED")
        for e in errors:
            print("-", e)
        return 1
    print("OK — all workflow JSON files validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
