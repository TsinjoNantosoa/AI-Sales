#!/usr/bin/env bash
# Export all AI Sales workflows from local n8n via REST API.
# Requires N8N_API_KEY or basic auth to be configured.
#
# Usage (WSL/Linux):
#   N8N_API_KEY=your-key bash n8n/scripts/export_workflows.sh
#
# Prerequisites: jq, curl

set -euo pipefail

N8N_URL="${N8N_URL:-http://localhost:5678}"
N8N_API_KEY="${N8N_API_KEY:-}"
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/workflows"

if [[ -z "$N8N_API_KEY" ]]; then
  echo "ERROR: N8N_API_KEY is not set. Set it in your environment:"
  echo "  export N8N_API_KEY=your-n8n-api-key"
  echo "  bash n8n/scripts/export_workflows.sh"
  exit 1
fi

echo "Exporting workflows from $N8N_URL → $OUTPUT_DIR"

# Fetch workflow list
WORKFLOWS=$(curl -sf -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/workflows?limit=100" | jq -r '.data[] | @base64')

EXPORTED=0
for ROW in $WORKFLOWS; do
  WF=$(echo "$ROW" | base64 --decode)
  WF_ID=$(echo "$WF" | jq -r '.id')
  WF_NAME=$(echo "$WF" | jq -r '.name')

  if [[ "$WF_NAME" != AI\ Sales* ]]; then
    continue
  fi

  # Map name to filename
  SLUG=$(echo "$WF_NAME" | sed 's/AI Sales — //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  case "$SLUG" in
    lead-capture)           FILE="01_lead_capture.json" ;;
    ai-qualification)       FILE="02_ai_qualification.json" ;;
    hot-lead-alert)         FILE="03_hot_lead_alert.json" ;;
    follow-up)              FILE="04_follow_up.json" ;;
    appointment-booking)    FILE="05_appointment_booking.json" ;;
    meeting-reminder)       FILE="06_meeting_reminder.json" ;;
    global-error-handler)   FILE="99_global_error_handler.json" ;;
    *)
      echo "  SKIP: unknown workflow '$WF_NAME'"
      continue
      ;;
  esac

  curl -sf -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$WF_ID" \
    | jq 'del(.id, .createdAt, .updatedAt, .versionId)' \
    > "$OUTPUT_DIR/$FILE"

  echo "  ✓ Exported: $WF_NAME → $FILE"
  EXPORTED=$((EXPORTED + 1))
done

echo "Done — $EXPORTED workflow(s) exported to $OUTPUT_DIR"
