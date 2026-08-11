"""Orchestration for the public (unauthenticated) lead / chat / booking flow."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import (
    ActivityType,
    AppointmentStatus,
    ConversationChannel,
    ConversationStatus,
    LeadStatus,
    MessageSender,
    NotificationCategory,
    TaskStatus,
)
from app.core.exceptions import (
    AuthenticationError,
    NotFoundError,
    ValidationAppError,
)
from app.core.public_tokens import (
    PUBLIC_BOOKING,
    PUBLIC_CHAT,
    create_public_token,
    decode_public_token,
    require_permission,
)
from app.models.appointment import Appointment
from app.models.conversation import Conversation, Message
from app.models.lead import Lead
from app.models.task import Task
from app.models.user import User
from app.schemas.common import AppointmentOut
from app.schemas.lead import LeadCreate, LeadOut
from app.schemas.public import (
    PublicAppointmentCreate,
    PublicLeadCreateResponse,
    PublicMessageResponse,
    QualificationInfo,
)
from app.services.activity import create_activity
from app.services.appointment import BUSINESS_SLOTS, AppointmentService
from app.services.conversation import ConversationService
from app.services.email import EmailService
from app.services.lead import LeadService
from app.services.mappers import (
    appointment_to_out,
    conversation_to_out,
    lead_to_out,
    message_to_out,
)
from app.services.notification import create_notification
from app.services.scoring import compute_lead_score
from app.services.settings import SettingsService
from app.utils import utcnow

DEFAULT_TOKEN_MINUTES = 60

QUALIFICATION_FIELDS = (
    "service_interest",
    "need_description",
    "budget_max",
    "timeline",
    "decision_authority",
)

ASSISTANT_PROMPTS = {
    0: "Hi! Thanks for reaching out. What service are you most interested in?",
    1: "Great. Could you briefly describe what you need help with?",
    2: "Got it. What's your approximate budget range?",
    3: "Thanks. What's your ideal timeline to get started?",
    4: "Almost done — are you the decision maker for this project?",
    5: "Perfect, you're well qualified. Would you like to book a meeting with our team?",
}


def _zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _qualification_info(lead: Lead) -> QualificationInfo:
    missing: list[str] = []
    if not (lead.service_interest or "").strip():
        missing.append("service_interest")
    need = lead.need_description or ""
    if not need.strip() or len(need.strip()) < 10:
        missing.append("need_description")
    if lead.budget_max is None and lead.budget_min is None:
        missing.append("budget_max")
    if not (lead.timeline or "").strip():
        missing.append("timeline")
    if not (lead.decision_authority or "").strip():
        missing.append("decision_authority")

    filled = len(QUALIFICATION_FIELDS) - len(missing)
    progress = round(filled / len(QUALIFICATION_FIELDS), 2)
    score_data = compute_lead_score(lead)
    recommended = score_data.get("recommended_action") or "Nurture"
    if progress >= 1.0 and lead.score >= 70:
        recommended = "Book meeting"
    elif progress >= 0.6:
        recommended = "Continue qualification"
    return QualificationInfo(
        score=int(lead.score or score_data["total"]),
        temperature=str(lead.temperature or score_data["temperature"]),
        progress=progress,
        missing_fields=missing,
        recommended_action=recommended,
    )


def _infer_step(lead: Lead) -> int:
    info = _qualification_info(lead)
    return min(len(QUALIFICATION_FIELDS), len(QUALIFICATION_FIELDS) - len(info.missing_fields))


def _assistant_reply_for_step(step: int) -> str:
    return ASSISTANT_PROMPTS.get(step, ASSISTANT_PROMPTS[5])


class PublicFlowService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.leads = LeadService(db)
        self.conversations = ConversationService(db)
        self.appointments = AppointmentService(db)

    def decode_token(self, token: str) -> dict:
        return decode_public_token(token)

    def validate_token(
        self,
        token: str,
        *,
        conversation_id: str | uuid.UUID | None = None,
        lead_id: str | uuid.UUID | None = None,
        permission: str | None = None,
    ) -> dict:
        payload = decode_public_token(token)
        if conversation_id is not None and str(payload["conversation_id"]) != str(conversation_id):
            raise AuthenticationError("Public token does not match conversation")
        if lead_id is not None and str(payload["lead_id"]) != str(lead_id):
            raise AuthenticationError("Public token does not match lead")
        if permission:
            require_permission(payload, permission)
        return payload

    async def _get_lead(self, lead_id: uuid.UUID) -> Lead:
        result = await self.db.execute(
            select(Lead)
            .options(selectinload(Lead.tag_entities))
            .where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead = result.scalar_one_or_none()
        if lead is None:
            raise NotFoundError("Lead not found", code="LEAD_NOT_FOUND")
        return lead

    async def _get_conversation(self, conv_id: uuid.UUID) -> Conversation:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv_id)
        )
        conv = result.scalar_one_or_none()
        if conv is None:
            raise NotFoundError("Conversation not found")
        return conv

    async def create_public_lead(self, data: LeadCreate) -> PublicLeadCreateResponse:
        if not data.consent_given:
            raise ValidationAppError(
                "Consent is required to submit a public lead",
                details={"field": "consent_given"},
            )

        lead_out = await self.leads.create_lead(data, user=None, public=True)
        lead = await self._get_lead(uuid.UUID(lead_out.id))

        if lead.assigned_user_id is None:
            await self.leads.assignment.auto_assign(lead)
            await self.db.flush()

        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(
                Conversation.lead_id == lead.id,
                Conversation.channel == ConversationChannel.CHATBOT,
                Conversation.status != ConversationStatus.CLOSED,
            )
            .order_by(Conversation.created_at.desc())
            .limit(1)
        )
        conv = result.scalar_one_or_none()
        if conv is None:
            conv = Conversation(
                lead_id=lead.id,
                channel=ConversationChannel.CHATBOT,
                status=ConversationStatus.OPEN,
                assigned_user_id=lead.assigned_user_id,
            )
            self.db.add(conv)
            await self.db.flush()
            await self.db.refresh(conv, attribute_names=["messages"])

        # Welcome assistant message
        welcome = Message(
            conversation_id=conv.id,
            content=_assistant_reply_for_step(0),
            sender_type=MessageSender.AI,
            sender_name="Ava",
            read=False,
        )
        self.db.add(welcome)

        token = create_public_token(
            str(lead.id),
            str(conv.id),
            permissions=[PUBLIC_CHAT, PUBLIC_BOOKING],
            expires_minutes=DEFAULT_TOKEN_MINUTES,
        )
        await self.db.flush()
        lead = await self._get_lead(lead.id)
        return PublicLeadCreateResponse(
            lead=lead_to_out(lead),
            conversation_id=str(conv.id),
            public_token=token,
            expires_in=DEFAULT_TOKEN_MINUTES * 60,
        )

    async def get_public_lead(self, token: str, lead_id: str | None = None) -> LeadOut:
        payload = self.validate_token(token, lead_id=lead_id, permission=PUBLIC_CHAT)
        lead = await self._get_lead(uuid.UUID(str(payload["lead_id"])))
        return lead_to_out(lead)

    async def get_or_create_conversation(self, token: str, lead_id: str) -> dict:
        payload = self.validate_token(token, lead_id=lead_id, permission=PUBLIC_CHAT)
        conv = await self._get_conversation(uuid.UUID(str(payload["conversation_id"])))
        lead = await self._get_lead(uuid.UUID(str(payload["lead_id"])))
        if str(conv.lead_id) != str(lead.id):
            raise AuthenticationError("Public token conversation/lead mismatch")
        return {
            "conversation": conversation_to_out(conv, lead=lead),
            "conversation_id": str(conv.id),
        }

    async def send_public_message(
        self,
        token: str,
        conversation_id: uuid.UUID,
        content: str,
    ) -> PublicMessageResponse:
        payload = self.validate_token(
            token, conversation_id=conversation_id, permission=PUBLIC_CHAT
        )
        conv = await self._get_conversation(conversation_id)
        lead = await self._get_lead(uuid.UUID(str(payload["lead_id"])))
        if conv.lead_id != lead.id:
            raise AuthenticationError("Public token does not match conversation")

        step = _infer_step(lead) + 1
        step = min(step, 5)

        # qualify persists the user answer as a message
        await self.conversations.qualify(
            conversation_id, lead.id, step=step, answer=content
        )
        lead = await self._get_lead(lead.id)

        reply_text = _assistant_reply_for_step(min(step, 5))
        assistant = Message(
            conversation_id=conv.id,
            content=reply_text,
            sender_type=MessageSender.AI,
            sender_name="Ava",
            read=False,
        )
        self.db.add(assistant)
        conv.updated_at = utcnow()
        lead.last_interaction_at = utcnow()
        await self.db.flush()

        conv = await self._get_conversation(conversation_id)
        lead = await self._get_lead(lead.id)
        return PublicMessageResponse(
            conversation=conversation_to_out(conv, lead=lead),
            assistant_message=message_to_out(assistant),
            lead=lead_to_out(lead),
            qualification=_qualification_info(lead),
        )

    async def qualify_public(
        self,
        token: str,
        conversation_id: uuid.UUID,
        step: int,
        answer: str,
        lead_id: str | None = None,
    ) -> PublicMessageResponse:
        payload = self.validate_token(
            token, conversation_id=conversation_id, permission=PUBLIC_CHAT
        )
        resolved_lead_id = uuid.UUID(lead_id) if lead_id else uuid.UUID(str(payload["lead_id"]))
        self.validate_token(token, lead_id=resolved_lead_id)

        await self.conversations.qualify(
            conversation_id, resolved_lead_id, step=step, answer=answer
        )
        lead = await self._get_lead(resolved_lead_id)

        reply_text = _assistant_reply_for_step(min(step, 5))
        assistant = Message(
            conversation_id=conversation_id,
            content=reply_text,
            sender_type=MessageSender.AI,
            sender_name="Ava",
            read=False,
        )
        self.db.add(assistant)
        await self.db.flush()

        conv = await self._get_conversation(conversation_id)
        lead = await self._get_lead(resolved_lead_id)
        return PublicMessageResponse(
            conversation=conversation_to_out(conv, lead=lead),
            assistant_message=message_to_out(assistant),
            lead=lead_to_out(lead),
            qualification=_qualification_info(lead),
        )

    async def get_public_slots(
        self,
        token: str,
        date: str,
        user_id: str | None = None,
    ) -> list[str]:
        payload = self.validate_token(token, permission=PUBLIC_BOOKING)
        lead = await self._get_lead(uuid.UUID(str(payload["lead_id"])))

        assignee = user_id or (str(lead.assigned_user_id) if lead.assigned_user_id else None)
        if not assignee:
            raise ValidationAppError("No salesperson available for slots")

        settings_data = await SettingsService(self.db)._load_merged()
        availability = settings_data.get("availability") or {}
        tz_name = availability.get("timezone") or "UTC"
        zone = _zone(tz_name)

        # Day-of-week filter from AppSetting
        try:
            day_dt = datetime.fromisoformat(f"{date}T12:00:00").replace(tzinfo=zone)
        except ValueError as exc:
            raise ValidationAppError("Invalid date format, expected YYYY-MM-DD") from exc
        weekday_name = day_dt.strftime("%A")
        days = availability.get("days") or []
        day_cfg = next((d for d in days if d.get("day") == weekday_name), None)
        if day_cfg is not None and not day_cfg.get("enabled", True):
            return []

        start_hhmm = (day_cfg or {}).get("start", "09:00")
        end_hhmm = (day_cfg or {}).get("end", "18:00")

        candidate_slots = [
            s for s in BUSINESS_SLOTS if start_hhmm <= s < end_hhmm
        ]

        uid = uuid.UUID(assignee)
        result = await self.db.execute(
            select(Appointment).where(
                Appointment.assigned_user_id == uid,
                Appointment.status != AppointmentStatus.CANCELLED,
            )
        )
        taken: set[str] = set()
        for appt in result.scalars().all():
            local_start = appt.start_at.astimezone(zone)
            if local_start.date().isoformat() == date:
                taken.add(local_start.strftime("%H:%M"))

        return [s for s in candidate_slots if s not in taken]

    async def create_public_appointment(
        self,
        token: str,
        data: PublicAppointmentCreate,
        *,
        idempotency_key: str | None = None,
    ) -> AppointmentOut:
        payload = self.validate_token(token, permission=PUBLIC_BOOKING)
        token_lead_id = uuid.UUID(str(payload["lead_id"]))
        if data.lead_id and str(data.lead_id) != str(token_lead_id):
            raise AuthenticationError("Public token does not match lead")

        if idempotency_key:
            existing = await self.db.execute(
                select(Appointment).where(Appointment.idempotency_key == idempotency_key)
            )
            row = existing.scalar_one_or_none()
            if row is not None:
                return appointment_to_out(row)

        lead = await self._get_lead(token_lead_id)
        assigned = (data.assigned_user_id or "").strip() or None
        if not assigned and lead.assigned_user_id:
            assigned = str(lead.assigned_user_id)
        if not assigned:
            from app.services.assignment import LeadAssignmentService

            await LeadAssignmentService(self.db).auto_assign(lead)
            assigned = str(lead.assigned_user_id) if lead.assigned_user_id else None
        if not assigned:
            raise ValidationAppError("No salesperson assigned for booking")

        start = self.appointments._parse_start(data.date, data.time, data.timezone)
        end = start + timedelta(minutes=data.duration)
        assigned_uuid = uuid.UUID(assigned)
        await self.appointments._check_conflict(assigned_uuid, start, end)

        salesperson = data.salesperson_name
        if not salesperson:
            ures = await self.db.execute(select(User).where(User.id == assigned_uuid))
            u = ures.scalar_one_or_none()
            if u:
                salesperson = f"{u.first_name} {u.last_name}"

        meeting_url = data.meeting_link
        if data.google_meet and not meeting_url:
            meeting_url = f"https://meet.google.com/mock-{uuid.uuid4().hex[:10]}"

        appt = Appointment(
            lead_id=lead.id,
            assigned_user_id=assigned_uuid,
            title=data.type or "Discovery Call",
            start_at=start,
            end_at=end,
            timezone=data.timezone or "UTC",
            duration_minutes=data.duration,
            meeting_type=data.type,
            meeting_url=meeting_url,
            status=data.status or AppointmentStatus.CONFIRMED,
            notes=data.notes,
            google_meet=data.google_meet,
            idempotency_key=idempotency_key,
            lead_name=data.lead_name or f"{lead.first_name} {lead.last_name}",
            lead_company=data.lead_company or lead.company_name,
            lead_email=data.lead_email or lead.email,
            salesperson_name=salesperson,
        )
        self.db.add(appt)
        lead.status = LeadStatus.MEETING_SCHEDULED
        lead.last_interaction_at = utcnow()

        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=appt.lead_name,
            type=ActivityType.APPOINTMENT,
            description=f"Meeting scheduled on {data.date} at {data.time}",
            user_name="public",
        )
        await create_notification(
            self.db,
            user_id=assigned_uuid,
            title="Meeting booked",
            message=f"Meeting with {appt.lead_name} on {data.date} at {data.time}",
            category=NotificationCategory.MEETINGS,
            related_id=str(lead.id),
            related_type="appointment",
        )

        due = utcnow() + timedelta(hours=2)
        self.db.add(
            Task(
                title="Prepare meeting",
                description=f"Prepare for meeting with {appt.lead_name} on {data.date} at {data.time}",
                lead_id=lead.id,
                lead_name=appt.lead_name,
                assigned_user_id=assigned_uuid,
                assigned_user_name=salesperson or "",
                priority="High",
                status=TaskStatus.TODO,
                due_at=due,
            )
        )

        await EmailService(self.db).send(
            to=lead.email,
            subject="Your meeting is confirmed",
            body=(
                f"Hi {lead.first_name}, your meeting on {data.date} at {data.time} "
                f"({data.timezone}) is confirmed. Link: {meeting_url or 'TBD'}"
            ),
            template_slug="meeting_confirmation",
            lead_id=str(lead.id),
        )

        await self.db.flush()
        return appointment_to_out(appt)
