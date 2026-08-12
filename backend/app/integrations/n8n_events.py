"""Central mapping: business events → n8n webhooks and workflow slugs."""

from __future__ import annotations

# Canonical event types
LEAD_CREATED = "lead.created"
LEAD_QUALIFICATION_UPDATED = "lead.qualification.updated"
LEAD_HOT = "lead.hot"
CONVERSATION_HANDOFF_REQUESTED = "conversation.handoff.requested"
APPOINTMENT_CREATED = "appointment.created"
APPOINTMENT_CANCELLED = "appointment.cancelled"
FOLLOW_UP_DUE = "follow_up.due"
WORKFLOW_TEST = "workflow.test"

EVENT_WEBHOOK_PATHS: dict[str, str] = {
    LEAD_CREATED: "webhook/lead-created",
    LEAD_QUALIFICATION_UPDATED: "webhook/qualification-updated",
    LEAD_HOT: "webhook/hot-lead-alert",
    CONVERSATION_HANDOFF_REQUESTED: "webhook/handoff-requested",
    APPOINTMENT_CREATED: "webhook/appointment-created",
    APPOINTMENT_CANCELLED: "webhook/appointment-cancelled",
    FOLLOW_UP_DUE: "webhook/follow-up-due",
    WORKFLOW_TEST: "webhook/workflow-test",
}

EVENT_WORKFLOW_SLUGS: dict[str, str] = {
    LEAD_CREATED: "lead-capture",
    LEAD_QUALIFICATION_UPDATED: "ai-qualification",
    LEAD_HOT: "hot-lead-alert",
    CONVERSATION_HANDOFF_REQUESTED: "ai-qualification",
    APPOINTMENT_CREATED: "appointment-booking",
    APPOINTMENT_CANCELLED: "appointment-booking",
    FOLLOW_UP_DUE: "follow-up",
    WORKFLOW_TEST: "lead-capture",
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


def webhook_path_for_event(event_type: str) -> str:
    return EVENT_WEBHOOK_PATHS.get(event_type, f"webhook/{event_type.replace('.', '-')}")


def workflow_slug_for_event(event_type: str) -> str | None:
    return EVENT_WORKFLOW_SLUGS.get(event_type)
