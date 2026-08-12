#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
N8N_URL="${N8N_BASE_URL:-http://localhost:5678}"
N8N_API_KEY="${N8N_API_KEY:-}"

if [[ -z "$N8N_API_KEY" ]]; then
  echo "ERROR: N8N_API_KEY is required for API import."
  echo "Create a local n8n API key, then: export N8N_API_KEY='...'"
  echo "Alternatively import JSON files manually in the n8n editor."
  exit 2
fi

python "$ROOT/scripts/validate_workflows.py"

echo "Import target: $N8N_URL"
for f in "$ROOT"/workflows/*.json; do
  echo "Importing $(basename "$f")"
  curl -fsS -X POST "$N8N_URL/api/v1/workflows" \
    -H "Content-Type: application/json" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    --data-binary @"$f" >/dev/null
  echo "  OK"
done

echo "Imported 7 workflows. Next: configure workflow 99 as Error Workflow for 01–06, then activate after backend integration."
