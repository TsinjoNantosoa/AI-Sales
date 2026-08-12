# AI Sales Assistant — n8n Automation Layer

This folder is the **replaceable n8n layer** for the AI Sales Assistant MVP. It is designed for n8n **2.32.6** (stable release verified on 2026-07-29) and keeps FastAPI as the authoritative business layer.

## What this pack covers

1. **Lead Capture** — authenticated `lead.created` webhook, execution registration, duplicate/enable checks, welcome action.
2. **AI Qualification** — observes the authoritative LangGraph result without duplicating AI/scoring logic.
3. **HOT Lead Alert** — backend HOT verification, priority task, notification, salesperson email and activity.
4. **Follow-up** — 30-minute schedule; FastAPI decides which leads are due and owns 24h/3d/7d rules.
5. **Appointment Booking** — post-booking orchestration through the backend calendar/email abstractions.
6. **Meeting Reminder** — scheduled, idempotent reminder orchestration.
7. **Global Error Handler** — sanitizes n8n errors and reports them back to FastAPI.

## Architecture

```text
React frontend
      │
      ▼
FastAPI (source of truth)
      │
      ├─ LangGraph / OpenAI / scoring / RBAC / CRM
      ├─ PostgreSQL
      └─ transactional automation events
                   │
                   ▼
                  n8n
          ┌────────┼──────────┐
          ▼        ▼          ▼
      follow-up  booking   notifications
          │        │          │
          └────────┴──────────┘
                   │
                   ▼
       FastAPI internal actions
```

**No OpenAI node and no direct business-database node is used in n8n.**

## Security model

### FastAPI → n8n

Each event webhook must include:

```text
X-N8N-Webhook-Key: <N8N_WEBHOOK_SECRET>
```

The four public webhook workflows reject requests unless the header matches the secret configured in the n8n container. The existing HMAC headers may remain for tracing/upgrade, but the integration prompt must add this explicit webhook key to the FastAPI `N8nClient`.

### n8n → FastAPI

Every HTTP Request node sends:

```text
X-Internal-Key: {{$env.INTERNAL_API_KEY}}
```

FastAPI validates this before executing internal actions.

## Required n8n runtime environment

The workflow pack currently uses `$env` for three project-scoped values. Configure env access explicitly in the self-hosted n8n container; if you later move these values into n8n Credentials, you can re-enable stricter env blocking.

```env
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
AI_SALES_BACKEND_URL=http://backend:8000
INTERNAL_API_KEY=<same internal key as FastAPI>
N8N_WEBHOOK_SECRET=<long random secret, 16+ chars>
```

No Google or email credentials are required yet. The workflows call backend abstractions, so real providers can replace mock providers later without redesigning n8n.

> Production hardening note: using n8n Credentials for `X-Internal-Key` / inbound Webhook Header Auth is stricter than broad `$env` access. This pack uses environment configuration so the folder is portable before instance-specific credentials exist. The final integration pass may migrate the two shared secrets into n8n Credentials after local import.

## Workflow files

```text
workflows/
├── 01_lead_capture.json
├── 02_ai_qualification.json
├── 03_hot_lead_alert.json
├── 04_follow_up.json
├── 05_appointment_booking.json
├── 06_meeting_reminder.json
└── 99_global_error_handler.json
```

## Reliability guarantees in the workflow layer

- event-level execution registration before side effects;
- duplicate event stop before side effects;
- workflow active/inactive check;
- explicit node references instead of fragile post-request `$json.body...` references;
- backend action idempotency keys passed where supported;
- 3 bounded attempts on FastAPI HTTP nodes;
- scheduled runs use a deterministic 30-minute bucket run ID;
- scheduled workflows mark success once after all item calls finish;
- no HOT-lead side effects in workflow 02 (workflow 03 owns them);
- sanitized global failure reporting.

## Important integration items

Read [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) before running against the current backend. The pack intentionally expects a few final backend integration changes, especially the inbound webhook secret header and failure correlation.

## Generate and validate

```bash
python n8n/scripts/generate_workflows.py
python n8n/scripts/validate_workflows.py
python -m unittest discover -s n8n/tests -v
```

The generator is deterministic and is the source for the checked-in JSON. Do not maintain a stale second generator.

## Import to local n8n

Create an n8n API key in the local instance, then from WSL:

```bash
export N8N_BASE_URL=http://localhost:5678
export N8N_API_KEY='...'
bash n8n/scripts/import_workflows.sh
```

Manual import also works: **Workflows → Import from File**.

After import, set `AI Sales — Global Error Handler` as the Error Workflow for workflows 01–06 in workflow settings.

## ngrok

Your ngrok URL is temporary. Never place it in workflow JSON. Configure n8n's public webhook URL in Docker/runtime configuration and keep internal n8n → FastAPI traffic on the Docker network.

## Smoke test

Once backend + n8n are integrated and running:

```bash
export N8N_WEBHOOK_SECRET='...'
python n8n/scripts/smoke_test.py --base-url http://localhost:5678
```

The test submits safe sample payloads to the four webhook workflows. It does **not** test scheduled workflows; trigger those manually in n8n or wait for the schedule.

## Status boundary

This folder is complete on the **n8n side**, but runtime correctness still depends on the backend integration contract and the actual local import. Google Calendar and real email provider credentials remain separate later phases.
