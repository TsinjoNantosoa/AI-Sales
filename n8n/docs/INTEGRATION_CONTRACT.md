# Backend + Frontend Integration Contract

This workflow pack was checked against `AI-Sales-main (4)` and targets its existing internal n8n API.

## Backend endpoints consumed by n8n

| Method | Path | Workflow |
|---|---|---|
| POST | `/api/v1/internal/n8n/executions/start` | 01–06 |
| POST | `/api/v1/internal/n8n/executions/{id}/success` | 01–06 |
| POST | `/api/v1/internal/n8n/executions/failure-report` | 99 |
| POST | `/api/v1/internal/n8n/leads/{lead_id}/welcome?event_id=...` | 01 |
| GET | `/api/v1/internal/n8n/leads/{lead_id}/hot-check` | 03 |
| POST | `/api/v1/internal/n8n/leads/{lead_id}/hot-lead-actions?event_id=...` | 03 |
| GET | `/api/v1/internal/n8n/follow-ups/due` | 04 |
| POST | `/api/v1/internal/n8n/follow-ups/{lead_id}/execute` | 04 |
| POST | `/api/v1/internal/n8n/appointments/{appointment_id}/booking-actions?event_id=...` | 05 |
| GET | `/api/v1/internal/n8n/appointments/reminders/due` | 06 |
| POST | `/api/v1/internal/n8n/appointments/{appointment_id}/send-reminder` | 06 |

## Final backend changes required before activation

1. **Webhook authentication**: `N8nClient` must send `X-N8N-Webhook-Key: N8N_WEBHOOK_SECRET` on event webhooks. Keep TLS/HTTPS for public ngrok/cloud traffic.
2. **n8n Docker version**: update `n8nio/n8n:1.82.1` to the selected stable `n8nio/n8n:2.32.6`, then validate imports.
3. **n8n environment**: pass `N8N_WEBHOOK_SECRET`, `INTERNAL_API_KEY`, and `AI_SALES_BACKEND_URL` into the n8n container.
4. **Failure correlation**: change `/executions/failure-report` to first find the existing `WorkflowExecution` by `external_execution_id` (n8n execution ID) and mark that row failed; do not create a second failure row unless no matching execution can be found.
5. **Appointment action idempotency**: strengthen `appointment_booking_actions()` so calendar sync, confirmation email, notification, activity, and preparation task are individually protected against replay/HTTP retry. Use `event_id` as the operation key.
6. **Seed/workflow status**: ensure the seven canonical workflow slugs are seeded and can be toggled from the frontend.
7. **Error Workflow setting**: after import, associate workflow 99 as the Error Workflow of workflows 01–06. This is an n8n-instance setting tied to imported workflow IDs.

## Event ownership

```text
lead.created                  → workflow 01
lead.qualification.updated    → workflow 02
lead.hot                      → workflow 03
appointment.created           → workflow 05
```

Human handoff stays in LangGraph/FastAPI. Workflow 02 only records the qualification result. It does not run HOT actions and therefore cannot duplicate workflow 03.

Follow-up and meeting reminders are schedule-driven and poll backend endpoints. FastAPI remains authoritative for eligibility and idempotency.

## Frontend responsibility

The React frontend should **never call n8n directly**. It talks only to FastAPI.

Existing/expected UI features:

- workflow list and active/inactive status;
- actual total executions / success / failures / duration;
- execution history;
- lead-specific automation history;
- manual workflow test through FastAPI;
- manual retry of failed `WorkflowExecution` through FastAPI.

The integration phase must make sure real n8n callbacks update the same `WorkflowExecution` rows rendered by the existing Automations page and Lead Detail automation tab.

## Deferred credentials

Not part of this n8n replacement:

- Google Calendar OAuth and refresh token handling;
- real email provider credentials;
- WhatsApp / HubSpot / Salesforce / Odoo / Twilio.

## n8n 2.x environment-expression requirement

The current portable workflow exports reference `AI_SALES_BACKEND_URL`, `INTERNAL_API_KEY`, and `N8N_WEBHOOK_SECRET` through `$env`. Ensure the n8n service receives these variables and explicitly permits env access for the local portfolio stack (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`). For production hardening, prefer migrating the two secrets to n8n Credentials after import, then restore stricter environment access.
