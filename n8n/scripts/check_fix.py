#!/usr/bin/env python3
import json, pathlib

WF_DIR = pathlib.Path(__file__).resolve().parents[1] / "workflows"
for f in sorted(WF_DIR.glob("*.json")):
    data = json.loads(f.read_text(encoding="utf-8"))
    for node in data["nodes"]:
        jb = node.get("parameters", {}).get("jsonBody", "")
        if jb.startswith("={{"):
            status = "OK" if jb.endswith("}}") else "BROKEN"
            print(status, f.name, node["name"], "...", repr(jb[-20:]))
