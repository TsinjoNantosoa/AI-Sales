# n8n Runtime Test Plan

## Preflight

1. `python n8n/scripts/validate_workflows.py`
2. `python -m unittest discover -s n8n/tests -v`
3. Start FastAPI/Postgres/Redis/n8n.
4. Import all seven JSON files.
5. Configure workflow 99 as Error Workflow for 01–06.
6. Activate 01–06 after backend integration is complete.

## Required runtime scenarios

### A. Authentication
- valid `X-N8N-Webhook-Key` → accepted;
- wrong or missing key → 401;
- wrong `X-Internal-Key` from n8n → FastAPI rejects with no side effects.

### B. Lead capture
- create a lead through normal frontend/API flow;
- `lead.created` reaches workflow 01;
- exactly one welcome action;
- same event replay stops as duplicate.

### C. Qualification
- LangGraph updates qualification;
- workflow 02 logs the run;
- no OpenAI call in n8n;
- no HOT action inside workflow 02.

### D. HOT transition
- lead crosses HOT threshold;
- `lead.hot` triggers workflow 03;
- one priority task, notification, salesperson email/activity;
- replay produces no duplicates.

### E. Follow-up
- two due leads A and B;
- backend returns both;
- each targeted lead is processed once;
- immediate rerun skips same attempt;
- n8n is sole scheduler when `N8N_ENABLED=true`.

### F. Appointment
- saved appointment emits event;
- workflow 05 invokes booking action once;
- calendar mock sync + confirmation + task + notification;
- event replay produces no duplicate side effects after backend integration fix.

### G. Reminder
- due appointment appears in polling endpoint;
- reminder sent once;
- immediate rerun skipped.

### H. Failure
- force one backend HTTP action to return 500;
- bounded retries occur;
- workflow fails;
- workflow 99 reports failure;
- existing `WorkflowExecution` becomes FAILED after backend correlation fix.
