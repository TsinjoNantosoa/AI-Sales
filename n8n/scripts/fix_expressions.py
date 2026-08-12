#!/usr/bin/env python3
"""Fix n8n 2.x expression syntax: add missing closing }} to jsonBody expressions.

Broken pattern: "={{ expr }"  (single closing })
Correct format: "={{ expr }}" (double closing }})
"""
import json
import pathlib

WF_DIR = pathlib.Path(__file__).resolve().parents[1] / "workflows"


def fix_node(params: dict) -> bool:
    changed = False
    for key, val in list(params.items()):
        if key == "jsonBody" and isinstance(val, str):
            # Starts with ={{ but ends with single } (not }})
            if val.startswith("={{") and not val.endswith("}}"):
                params[key] = val + "}"
                print(f"  Fixed: ...{val[-30:]!r}  ->  +}}")
                changed = True
        elif isinstance(val, dict):
            if fix_node(val):
                changed = True
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict) and fix_node(item):
                    changed = True
    return changed


total = 0
for f in sorted(WF_DIR.glob("*.json")):
    data = json.loads(f.read_text(encoding="utf-8"))
    file_changed = False
    for node in data.get("nodes", []):
        if fix_node(node.get("parameters", {})):
            file_changed = True
    if file_changed:
        f.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        total += 1
        print(f"Saved: {f.name}")
    else:
        print(f"No change: {f.name}")

print(f"\nFixed {total} file(s).")
