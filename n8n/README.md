# AI Sales Assistant — n8n Automation Layer

## Architecture

```
FastAPI (authoritative business logic)
   │
   ├─ transaction commits
   │      │
   │      └─► automation_events (outbox table)
   │                 │
   │         ARQ dispatcher (every 15 min)
   │                 │
   └─────────────────▼
                  n8n Webhook
                     │
              ┌──────▼──────┐
              │  Workflow    │
              │  execution   │
              └──────┬───────┘
                     │ HTTP Request
                     ▼
             FastAPI /internal/n8n/*
                     │
              domain services
              (email, scoring, tasks…)
```

FastAPI is always the source of truth. n8n **orchestrates** — it never writes
directly to the database or duplicates business rules.

---

## n8n Version

Pinned: **1.82.1** (`n8nio/n8n:1.82.1` in `docker-compose.yml`).

To upgrade: check [n8n releases](https://github.com/n8n-io/n8n/releases), review
breaking changes in `CHANGELOG.md`, update the image tag, re-import and verify
all workflows.

---

## Workflows

| File | Name | Trigger | Purpose |
|------|------|---------|---------|
| `01_lead_capture.json` | AI Sales — Lead Capture | Webhook `POST /webhook/lead-created` | Send welcome email after lead creation |
| `02_ai_qualification.json` | AI Sales — AI Qualification | Webhook `POST /webhook/qualification-updated` | Route post-qualification: hot lead, human handoff |
| `03_hot_lead_alert.json` | AI Sales — Hot Lead Alert | Webhook `POST /webhook/hot-lead-alert` | Priority task + notification when lead goes HOT |
| `04_follow_up.json` | AI Sales — Follow-up | Schedule (every 30 min) | Poll due follow-ups and send via backend |
| `05_appointment_booking.json` | AI Sales — Appointment Booking | Webhook `POST /webhook/appointment-created` | Calendar sync, confirmation email, prep task |
| `06_meeting_reminder.json` | AI Sales — Meeting Reminder | Schedule (every 30 min) | Send reminders for upcoming appointments |
| `99_global_error_handler.json` | AI Sales — Global Error Handler | Error Trigger | Report failures to FastAPI |

---

## Event Types → Webhooks

| Event | n8n Webhook Path | Workflow |
|-------|-----------------|----------|
| `lead.created` | `/webhook/lead-created` | 01 Lead Capture |
| `lead.qualification.updated` | `/webhook/qualification-updated` | 02 AI Qualification |
| `lead.hot` | `/webhook/hot-lead-alert` | 03 Hot Lead Alert |
| `appointment.created` | `/webhook/appointment-created` | 05 Appointment Booking |

> Events **not** dispatched to n8n:
> - `conversation.handoff.requested` — handled inside workflow 02 via `requiresHuman` flag
> - `appointment.cancelled` — no workflow yet
> - Scheduled workflows use polling, not events

---

## Idempotency

Every event-driven workflow:
1. Registers a `WorkflowExecution` via `POST /internal/n8n/executions/start`
2. Receives `{executionId, duplicate, workflowEnabled}`
3. If `duplicate = true` → stops immediately (no side effects)
4. If `workflowEnabled = false` → stops immediately
5. Otherwise → proceeds with business actions

Follow-up idempotency key: `follow-up:{leadId}:{attemptNumber}`  
Appointment idempotency: `appointment-booking:{eventId}` via `WorkflowExecution`

---

## Authentication

### FastAPI → n8n (outbound)

All webhook calls include:
- `X-Signature`: HMAC-SHA256 of body using `N8N_WEBHOOK_SECRET`
- `X-Webhook-Timestamp`: Unix timestamp
- `X-Event-ID`: unique event ID

### n8n → FastAPI (inbound)

All HTTP Request nodes use:
- Header: `X-Internal-Key: <value of $env.INTERNAL_API_KEY>`

The secret is injected via `INTERNAL_API_KEY` environment variable in `docker-compose.yml`.

**After importing workflows**, create one credential:
- **Name**: `AI Sales Backend Internal API`
- **Type**: HTTP Header Auth
- **Header Name**: `X-Internal-Key`
- **Header Value**: value of `INTERNAL_API_KEY` from your `.env`

Then connect that credential to every HTTP Request node and re-export.

---

## Retry Strategy

### FastAPI → n8n (dispatcher)

- 4 attempts max, exponential backoff: 5s → 30s → 120s → 600s
- Retries: timeout, network error, 429, 5xx
- No retry: disabled workflow, duplicate event, business validation error

### n8n → FastAPI (HTTP Request nodes)

- Configured via n8n native "Retry On Fail" option
- Policy: retry on timeout / 5xx only
- No retry on 400, 401, 403, 404, 422

---

## Follow-up Scheduler Ownership

```
N8N_ENABLED=true  → n8n Schedule Trigger (every 30 min) owns follow-ups
                    ARQ follow_up_leads cron is disabled automatically

N8N_ENABLED=false → ARQ cron (09:00 + 14:00) owns follow-ups as fallback
```

Business logic stays in `FollowUpService.process_lead()` in both cases.

---

## Error Workflow

After importing all 7 workflows, configure the **Error Workflow** for workflows
01–06:

1. Open each workflow in n8n editor
2. **Settings** → **Error Workflow** → select `AI Sales — Global Error Handler`
3. Save

The global error handler normalizes the n8n error context and calls
`POST /internal/n8n/executions/failure-report` to update `WorkflowExecution`
status to `FAILED` and increment `failure_count`.

---

## Local Setup

### Prerequisites

- Docker + Docker Compose
- Copy `.env.example` → `.env` and fill in secrets

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set INTERNAL_API_KEY, N8N_ENCRYPTION_KEY, JWT_SECRET_KEY
```

### Start services

```bash
cd backend
docker compose up -d
docker compose ps
```

n8n UI: http://localhost:5678

---

## ngrok Setup (development)

When you need webhooks from the internet (e.g. testing external triggers):

```bash
ngrok http 5678
```

Update `N8N_WEBHOOK_URL` in `backend/.env` with the ngrok URL, then restart n8n:

```bash
docker compose restart n8n
```

> ⚠ The ngrok URL is **temporary** — never hardcode it in workflow JSON or Python.
> Use `$env.AI_SALES_BACKEND_URL` in workflow expressions.

---

## Credential Configuration

After n8n is running and workflows are imported:

1. Go to http://localhost:5678 → Credentials → New
2. Select **Header Auth**
3. Name: `AI Sales Backend Internal API`
4. Header Name: `X-Internal-Key`
5. Header Value: your `INTERNAL_API_KEY` from `.env`
6. Save

Then open each workflow and update every HTTP Request node to use this credential.

---

## Import Workflows

### Linux / macOS / WSL

```bash
cd n8n
bash scripts/import_workflows.sh
```

### Windows PowerShell (manual)

Open http://localhost:5678 → **Workflows** → **Import from file** for each JSON.

---

## Export Workflows

After local testing:

```bash
bash n8n/scripts/export_workflows.sh
```

Or manually via n8n UI → **⋮** → **Download** for each workflow.

---

## Validation

```bash
python n8n/scripts/validate_workflows.py
```

Checks: all 7 files present, no secrets, no bogus credential IDs, webhook paths.

---

## Testing

### Automated backend tests (no live n8n needed)

```bash
cd backend
pytest app/tests/test_automation_n8n.py -v
```

### Manual integration test

1. Start all services: `docker compose up -d`
2. Import workflows into n8n
3. Create a test lead via the frontend
4. Verify in n8n: workflow execution appears
5. Verify in DB: `AutomationEvent.status = DISPATCHED`, `WorkflowExecution` created

---

## Production Considerations

- Use strong random values for `INTERNAL_API_KEY`, `N8N_ENCRYPTION_KEY`, `JWT_SECRET_KEY`
- Set `WEBHOOK_URL` to your production domain (not ngrok)
- Enable n8n authentication in production
- Consider IP allowlisting for `/internal/n8n/*` endpoints
- Set `EXECUTIONS_DATA_MAX_AGE` appropriately for your retention policy

---

## Pending integrations

- **Google Calendar**: mock mode active (`GOOGLE_CALENDAR_MOCK_MODE=true`). Real credentials not required yet.
- **Email provider**: mock mode active (`EMAIL_MOCK_MODE=true`). No SMTP/Resend/SendGrid yet.
- **Production deployment**: not addressed in this phase.
