#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/workflows"
N8N_URL="${N8N_BASE_URL:-http://localhost:5678}"
N8N_API_KEY="${N8N_API_KEY:-}"

if [[ -z "$N8N_API_KEY" ]]; then
  echo "ERROR: N8N_API_KEY is required."
  exit 2
fi
command -v jq >/dev/null || { echo "ERROR: jq is required"; exit 2; }

LIST=$(curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows?limit=100")
map_name() {
  case "$1" in
    "AI Sales — Lead Capture") echo 01_lead_capture.json ;;
    "AI Sales — AI Qualification") echo 02_ai_qualification.json ;;
    "AI Sales — Hot Lead Alert") echo 03_hot_lead_alert.json ;;
    "AI Sales — Follow-up") echo 04_follow_up.json ;;
    "AI Sales — Appointment Booking") echo 05_appointment_booking.json ;;
    "AI Sales — Meeting Reminder") echo 06_meeting_reminder.json ;;
    "AI Sales — Global Error Handler") echo 99_global_error_handler.json ;;
    *) return 1 ;;
  esac
}

COUNT=0
while IFS=$'\t' read -r ID NAME; do
  FILE=$(map_name "$NAME") || continue
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows/$ID" \
    | jq 'del(.id,.createdAt,.updatedAt,.versionId,.shared,.homeProject)' > "$OUT/$FILE"
  echo "Exported $NAME -> $FILE"
  COUNT=$((COUNT+1))
done < <(echo "$LIST" | jq -r '.data[] | [.id,.name] | @tsv')

echo "Exported $COUNT workflow(s)."
python "$ROOT/scripts/validate_workflows.py"
