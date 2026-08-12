#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
N8N_URL="${N8N_BASE_URL:-http://localhost:5678}"
for f in "$ROOT"/workflows/*.json; do
  echo "Importing $(basename "$f") ..."
  curl -fsS -X POST "$N8N_URL/api/v1/workflows" \
    -H "Content-Type: application/json" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY:-}" \
    --data-binary @"$f" || {
      echo "Import failed for $f — configure N8N_API_KEY or import manually in the editor"
      exit 1
    }
done
echo "Done."
