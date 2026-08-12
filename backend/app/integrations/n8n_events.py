"""Central mapping: business events → n8n webhooks and workflow slugs.

Only events that have a REAL n8n webhook registered appear here.
- conversation.handoff.requested: handled inside 02_ai_qualification via requiresHuman flag.
- appointment.cancelled: no workflow exists yet (future).
- follow_up.due: scheduled (n8n polls /follow-ups/due), NOT webhook-based.
- workflow.test: replaced by real-webhook test mechanism in AutomationService.
"""

from __future__ import annotations

# Canonical event types
LEAD_CREATED = "lead.created"
LEAD_QUALIFICATION_UPDATED = "lead.qualification.updated"
LEAD_HOT = "lead.hot"
APPOINTMENT_CREATED = "appointment.created"

# ---------------------------------------------------------------------------
# Webhook path mapping — only events that have a matching n8n Webhook trigger
# ---------------------------------------------------------------------------
EVENT_WEBHOOK_PATHS: dict[str, str] = {
    LEAD_CREATED: "webhook/lead-created",
    LEAD_QUALIFICATION_UPDATED: "webhook/qualification-updated",
    LEAD_HOT: "webhook/hot-lead-alert",
    APPOINTMENT_CREATED: "webhook/appointment-created",
}

# Workflow slug is used for WorkflowExecution.idempotency_key
EVENT_WORKFLOW_SLUGS: dict[str, str] = {
    LEAD_CREATED: "lead-capture",
    LEAD_QUALIFICATION_UPDATED: "ai-qualification",
    LEAD_HOT: "hot-lead-alert",
    APPOINTMENT_CREATED: "appointment-booking",
}

# Safe test payload factory keyed by workflow slug
WORKFLOW_TEST_PAYLOADS: dict[str, dict] = {
    "lead-capture": {
        "eventType": LEAD_CREATED,
        "leadId": "00000000-0000-0000-0000-000000000001",
        "payload": {"leadId": "00000000-0000-0000-0000-000000000001"},
        "trigger": "manual_test",
    },
    "ai-qualification": {
        "eventType": LEAD_QUALIFICATION_UPDATED,
        "leadId": "00000000-0000-0000-0000-000000000001",
        "payload": {
            "leadId": "00000000-0000-0000-0000-000000000001",
            "score": 55,
            "temperature": "WARM",
            "becameHot": False,
            "requiresHuman": False,
        },
        "trigger": "manual_test",
    },
    "hot-lead-alert": {
        "eventType": LEAD_HOT,
        "leadId": "00000000-0000-0000-0000-000000000001",
        "payload": {
            "leadId": "00000000-0000-0000-0000-000000000001",
            "score": 85,
            "becameHot": True,
        },
        "trigger": "manual_test",
    },
    "appointment-booking": {
        "eventType": APPOINTMENT_CREATED,
        "appointmentId": "00000000-0000-0000-0000-000000000002",
        "leadId": "00000000-0000-0000-0000-000000000001",
        "payload": {
            "appointmentId": "00000000-0000-0000-0000-000000000002",
            "leadId": "00000000-0000-0000-0000-000000000001",
        },
        "trigger": "manual_test",
    },
}

CANONICAL_WORKFLOWS: list[tuple[str, str, str]] = [
    ("lead-capture", "AI Sales — Lead Capture", "Welcome + start qualification after lead creation"),
    (
        "ai-qualification",
        "AI Sales — AI Qualification",
        "Orchestrate post-qualification actions from LangGraph results",
    ),
    ("hot-lead-alert", "AI Sales — Hot Lead Alert", "Priority task + notification when lead becomes HOT"),
    ("follow-up", "AI Sales — Follow-up", "Scheduled follow-up orchestration via backend rules"),
    (
        "appointment-booking",
        "AI Sales — Appointment Booking",
        "Post-booking calendar sync, confirmation, and prep task",
    ),
    ("meeting-reminder", "AI Sales — Meeting Reminder", "Send upcoming meeting reminders"),
    (
        "global-error-handler",
        "AI Sales — Global Error Handler",
        "Normalize n8n failures and report to FastAPI",
    ),
]


def webhook_path_for_event(event_type: str) -> str | None:
    """Return the n8n webhook path for a dispatched event, or None if not mapped."""
    return EVENT_WEBHOOK_PATHS.get(event_type)


def workflow_slug_for_event(event_type: str) -> str | None:
    return EVENT_WORKFLOW_SLUGS.get(event_type)


def test_payload_for_workflow(slug: str, event_id: str) -> dict | None:
    """Return a safe test payload for a workflow slug, or None if not mapped."""
    base = WORKFLOW_TEST_PAYLOADS.get(slug)
    if base is None:
        return None
    return {**base, "eventId": event_id, "correlationId": event_id}
