"""Entity → API schema mappers."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import inspect as sa_inspect

from app.models.appointment import Appointment
from app.models.conversation import Conversation, Message
from app.models.lead import Lead, LeadNote
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import User
from app.schemas.auth import AuthUserOut, UserOut
from app.schemas.common import (
    AppointmentOut,
    ConversationOut,
    MessageOut,
    NotificationOut,
    TaskOut,
)
from app.schemas.lead import LeadOut, NoteOut, ScoreBreakdownOut
from app.utils import to_iso


def _sid(value) -> str | None:
    if value is None:
        return None
    return str(value)


def _lead_tags(lead: Lead) -> list[str]:
    """Avoid async lazy-load of tags outside a greenlet context."""
    insp = sa_inspect(lead)
    if "tag_entities" in insp.unloaded:
        return []
    return [t.name for t in lead.tag_entities]


def lead_to_out(lead: Lead) -> LeadOut:
    return LeadOut(
        id=str(lead.id),
        first_name=lead.first_name,
        last_name=lead.last_name,
        company_name=lead.company_name,
        email=lead.email,
        phone=lead.phone,
        country=lead.country or "",
        language=lead.language or "en",
        source=lead.source,
        service_interest=lead.service_interest or "",
        budget_min=lead.budget_min,
        budget_max=lead.budget_max,
        timeline=lead.timeline,
        need_description=lead.need_description or "",
        estimated_value=lead.estimated_value,
        score=lead.score or 0,
        temperature=lead.temperature,
        status=lead.status,
        assigned_user_id=_sid(lead.assigned_user_id),
        last_interaction_at=to_iso(lead.last_interaction_at),
        next_follow_up_at=to_iso(lead.next_follow_up_at),
        consent_given=bool(lead.consent_given),
        tags=_lead_tags(lead),
        priority=lead.priority,
        created_at=to_iso(lead.created_at) or "",
        updated_at=to_iso(lead.updated_at) or "",
        company_size=lead.company_size,
    )


def user_to_auth_out(user: User) -> AuthUserOut:
    return AuthUserOut(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        avatar=user.avatar_url,
        timezone=user.timezone or "UTC",
        language=user.language or "en",
    )


def user_to_out(
    user: User,
    *,
    assigned_leads: int = 0,
    active_opportunities: int = 0,
    meetings: int = 0,
    conversion_rate: float = 0.0,
    calendar_connected: bool = False,
) -> UserOut:
    last_active = to_iso(user.last_login_at) or to_iso(user.updated_at) or to_iso(user.created_at) or ""
    return UserOut(
        id=str(user.id),
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        status=user.status,
        avatar=user.avatar_url,
        language=user.language or "en",
        timezone=user.timezone or "UTC",
        assigned_leads=assigned_leads,
        active_opportunities=active_opportunities,
        meetings=meetings,
        conversion_rate=conversion_rate,
        last_active=last_active,
        calendar_connected=calendar_connected,
        created_at=to_iso(user.created_at) or "",
    )


def message_to_out(msg: Message) -> MessageOut:
    sender = msg.sender_type
    if sender == "lead":
        sender = "user"
    return MessageOut(
        id=str(msg.id),
        conversation_id=str(msg.conversation_id),
        content=msg.content,
        sender=sender,
        sender_name=msg.sender_name,
        timestamp=to_iso(msg.created_at) or "",
        read=bool(msg.read),
        attachments=(msg.metadata_json or {}).get("attachments", []) if msg.metadata_json else [],
    )


def conversation_to_out(
    conv: Conversation,
    *,
    lead: Lead | None = None,
    messages: list[Message] | None = None,
) -> ConversationOut:
    msgs = messages if messages is not None else list(conv.messages or [])
    last = msgs[-1] if msgs else None
    unread = sum(1 for m in msgs if not m.read and m.sender_type in {"user", "lead", "ai"})
    lead_name = ""
    lead_company = ""
    lead_email = ""
    if lead is not None:
        lead_name = f"{lead.first_name} {lead.last_name}".strip()
        lead_company = lead.company_name
        lead_email = lead.email
    return ConversationOut(
        id=str(conv.id),
        lead_id=str(conv.lead_id),
        lead_name=lead_name,
        lead_company=lead_company,
        lead_email=lead_email,
        channel=conv.channel,
        status=conv.status,
        assigned_user_id=_sid(conv.assigned_user_id),
        messages=[message_to_out(m) for m in msgs],
        unread_count=unread,
        last_message=last.content if last else "",
        last_message_at=to_iso(last.created_at if last else conv.updated_at) or "",
        human_handoff_requested=bool(conv.human_handoff_requested),
        summary=conv.summary,
        created_at=to_iso(conv.created_at) or "",
    )


def appointment_to_out(appt: Appointment) -> AppointmentOut:
    start = appt.start_at
    if isinstance(start, datetime):
        tz_name = appt.timezone or "UTC"
        try:
            zone = ZoneInfo(tz_name)
        except ZoneInfoNotFoundError:
            zone = ZoneInfo("UTC")
        if start.tzinfo is None:
            start = start.replace(tzinfo=UTC)
        local = start.astimezone(zone)
        date_str = local.date().isoformat()
        time_str = local.strftime("%H:%M")
    else:
        date_str = ""
        time_str = ""
    return AppointmentOut(
        id=str(appt.id),
        lead_id=str(appt.lead_id),
        lead_name=appt.lead_name or "",
        lead_company=appt.lead_company or "",
        lead_email=appt.lead_email or "",
        assigned_user_id=str(appt.assigned_user_id),
        salesperson_name=appt.salesperson_name or "",
        date=date_str,
        time=time_str,
        duration=appt.duration_minutes,
        timezone=appt.timezone or "UTC",
        type=appt.meeting_type,
        status=appt.status,
        meeting_link=appt.meeting_url,
        notes=appt.notes,
        google_meet=bool(appt.google_meet),
        created_at=to_iso(appt.created_at) or "",
    )


def task_to_out(task: Task) -> TaskOut:
    return TaskOut(
        id=str(task.id),
        title=task.title,
        description=task.description,
        lead_id=_sid(task.lead_id),
        lead_name=task.lead_name,
        assigned_user_id=str(task.assigned_user_id),
        assigned_user_name=task.assigned_user_name or "",
        priority=task.priority,
        status=task.status,
        due_date=to_iso(task.due_at) or "",
        completed_at=to_iso(task.completed_at),
        created_at=to_iso(task.created_at) or "",
    )


def notification_to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(n.id),
        title=n.title,
        message=n.message,
        category=n.category,
        read=n.read_at is not None,
        related_id=n.entity_id,
        related_type=n.entity_type,
        created_at=to_iso(n.created_at) or "",
    )


def note_to_out(note: LeadNote, *, user_name: str = "") -> NoteOut:
    return NoteOut(
        id=str(note.id),
        lead_id=str(note.lead_id),
        content=note.content,
        user_id=str(note.author_id) if note.author_id else "",
        user_name=user_name,
        created_at=to_iso(note.created_at) or "",
        updated_at=to_iso(note.updated_at) or "",
    )


def score_breakdown_to_out(data: dict) -> ScoreBreakdownOut:
    return ScoreBreakdownOut(
        budget_fit=data.get("budget_fit", 0),
        urgency=data.get("urgency", 0),
        service_fit=data.get("service_fit", 0),
        decision_authority=data.get("decision_authority", 0),
        company_size=data.get("company_size", 0),
        profile_completeness=data.get("profile_completeness", 0),
        total=data.get("total", 0),
        temperature=data.get("temperature"),
        recommended_action=data.get("recommended_action"),
        reasoning=data.get("reasoning") or [],
    )
