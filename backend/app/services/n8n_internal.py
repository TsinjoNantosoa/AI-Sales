"""Internal business actions invoked by n8n workflows."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import (
    ActivityType,
    LeadTemperature,
    NotificationCategory,
    TaskStatus,
)
from app.core.exceptions import NotFoundError, ValidationAppError
from app.core.logging import get_logger
from app.models.appointment import Appointment
from app.models.conversation import Conversation
from app.models.email import EmailLog
from app.models.lead import Lead
from app.models.task import Task
from app.services.activity import create_activity
from app.services.email import EmailService
from app.services.follow_up import FollowUpService
from app.services.notification import create_notification
from app.services.scoring import temperature_from_score
from app.utils import utcnow

logger = get_logger(__name__)

HOT_SCORE_THRESHOLD = 70


class N8nInternalService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_lead(self, lead_id: uuid.UUID) -> Lead:
        result = await self.db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead = result.scalar_one_or_none()
        if lead is None:
            raise NotFoundError("Lead not found")
        return lead

    async def get_lead_context(self, lead_id: uuid.UUID) -> dict[str, Any]:
        lead = await self._get_lead(lead_id)
        return {
            "leadId": str(lead.id),
            "firstName": lead.first_name,
            "lastName": lead.last_name,
            "companyName": lead.company_name,
            "email": lead.email,
            "language": lead.language,
            "serviceInterest": lead.service_interest,
            "budgetMax": lead.budget_max,
            "timeline": lead.timeline,
            "score": lead.score,
            "temperature": lead.temperature,
            "status": lead.status,
            "assignedUserId": str(lead.assigned_user_id) if lead.assigned_user_id else None,
            "isHot": self.is_lead_hot(lead.score, lead.temperature),
            "hotThreshold": HOT_SCORE_THRESHOLD,
        }

    @staticmethod
    def is_lead_hot(score: int | None, temperature: str | None = None) -> bool:
        if temperature == LeadTemperature.HOT:
            return True
        return int(score or 0) >= HOT_SCORE_THRESHOLD

    async def send_welcome_email(
        self, lead_id: uuid.UUID, *, event_id: str | None = None
    ) -> dict[str, Any]:
        lead = await self._get_lead(lead_id)
        idem_slug = f"welcome:{event_id}" if event_id else None
        if idem_slug:
            existing = await self.db.execute(
                select(EmailLog).where(
                    EmailLog.lead_id == lead.id,
                    EmailLog.template_slug == "welcome",
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                return {"sent": False, "duplicate": True, "mocked": True}

        subject = (
            f"Bienvenue {lead.first_name} !"
            if (lead.language or "").startswith("fr")
            else f"Welcome {lead.first_name}!"
        )
        body = (
            f"Bonjour {lead.first_name}, merci pour votre intérêt pour {lead.company_name}. "
            "Notre équipe va vous accompagner pour qualifier votre besoin."
            if (lead.language or "").startswith("fr")
            else (
                f"Hi {lead.first_name}, thanks for your interest from {lead.company_name}. "
                "Our team will help qualify your needs."
            )
        )
        log = await EmailService(self.db).send(
            to=lead.email,
            subject=subject,
            body=body,
            template_slug="welcome",
            lead_id=str(lead.id),
        )
        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.EMAIL,
            description="Welcome email sent (n8n)",
            user_name="system",
            metadata={"eventId": event_id, "template": "welcome"},
        )
        return {"sent": True, "duplicate": False, "emailLogId": log.id, "mocked": True}

    async def hot_lead_actions(
        self, lead_id: uuid.UUID, *, event_id: str | None = None
    ) -> dict[str, Any]:
        lead = await self._get_lead(lead_id)
        if not self.is_lead_hot(lead.score, lead.temperature):
            return {"skipped": True, "reason": "not_hot", "isHot": False}

        idem_key = f"hot-lead:{event_id}" if event_id else None
        if idem_key:
            existing = await self.db.execute(
                select(Task).where(
                    Task.lead_id == lead.id,
                    Task.title == "Priority outreach — HOT lead",
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                return {"duplicate": True, "isHot": True}

        assigned = lead.assigned_user_id
        task = Task(
            title="Priority outreach — HOT lead",
            description=(
                f"HOT lead {lead.first_name} {lead.last_name} "
                f"({lead.company_name}) — score {lead.score}"
            ),
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            assigned_user_id=assigned,
            priority="Urgent",
            status=TaskStatus.TODO,
            due_at=utcnow() + timedelta(hours=4),
        )
        self.db.add(task)

        if assigned:
            from app.models.user import User

            user_row = (
                await self.db.execute(select(User).where(User.id == assigned))
            ).scalar_one_or_none()
            await create_notification(
                self.db,
                user_id=assigned,
                title="HOT lead alert",
                message=f"{lead.first_name} {lead.last_name} is now HOT (score {lead.score})",
                category=NotificationCategory.LEADS,
                related_id=str(lead.id),
                related_type="lead",
            )
            if user_row and user_row.email:
                await EmailService(self.db).send(
                    to=user_row.email,
                    subject=f"HOT lead: {lead.first_name} {lead.last_name}",
                    body=(
                        f"{lead.first_name} at {lead.company_name} reached HOT status "
                        f"with score {lead.score}."
                    ),
                    template_slug="hot_lead_alert",
                    lead_id=str(lead.id),
                )

        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.STATUS_CHANGED,
            description="HOT lead automation executed",
            user_name="system",
            metadata={"eventId": event_id, "score": lead.score},
        )
        await self.db.flush()
        return {
            "duplicate": False,
            "isHot": True,
            "taskId": str(task.id),
            "score": lead.score,
            "temperature": lead.temperature,
        }

    async def list_due_follow_ups(self, limit: int = 50) -> list[dict[str, Any]]:
        service = FollowUpService(self.db)
        # Reuse selection logic without sending
        from app.services.follow_up import DEFAULT_SKIP_STATUSES, FOLLOW_UP_INTERVALS
        from app.services.settings import SettingsService

        settings = await SettingsService(self.db)._load_merged()
        follow_cfg = settings.get("follow_ups") or {}
        if follow_cfg.get("enabled") is False:
            return []
        max_attempts = int(follow_cfg.get("max_attempts") or 3)
        now = utcnow()
        q = (
            select(Lead)
            .where(
                Lead.deleted_at.is_(None),
                Lead.archived_at.is_(None),
                Lead.status.notin_(list(DEFAULT_SKIP_STATUSES)),
            )
            .order_by(Lead.next_follow_up_at.asc().nullsfirst())
            .limit(limit)
        )
        leads = list((await self.db.execute(q)).scalars().all())
        due: list[dict[str, Any]] = []
        for lead in leads:
            count = await service._follow_up_count(lead.id)
            if count >= max_attempts:
                continue
            explicitly_due = bool(lead.next_follow_up_at and lead.next_follow_up_at <= now)
            if not explicitly_due:
                interval = FOLLOW_UP_INTERVALS[min(count, len(FOLLOW_UP_INTERVALS) - 1)]
                reference = lead.last_interaction_at or lead.created_at
                if reference and reference > now - interval:
                    continue
            due.append(
                {
                    "leadId": str(lead.id),
                    "email": lead.email,
                    "firstName": lead.first_name,
                    "companyName": lead.company_name,
                    "followUpAttempt": count + 1,
                    "idempotencyKey": f"follow-up:{lead.id}:{count + 1}",
                }
            )
        return due

    async def execute_follow_up(
        self, lead_id: uuid.UUID, *, idempotency_key: str | None = None
    ) -> dict[str, Any]:
        """Process a follow-up for exactly this lead (not any random due lead)."""
        return await FollowUpService(self.db).process_lead(
            lead_id, idempotency_key=idempotency_key
        )

    async def list_reminder_candidates(self, within_minutes: int = 60) -> list[dict[str, Any]]:
        now = utcnow()
        window_end = now + timedelta(minutes=within_minutes)
        result = await self.db.execute(
            select(Appointment).where(
                Appointment.start_at >= now,
                Appointment.start_at <= window_end,
                Appointment.status.notin_(["cancelled", "completed"]),
            )
        )
        rows = list(result.scalars().all())
        out: list[dict[str, Any]] = []
        for appt in rows:
            out.append(
                {
                    "appointmentId": str(appt.id),
                    "leadId": str(appt.lead_id),
                    "leadEmail": appt.lead_email,
                    "startAt": appt.start_at.isoformat(),
                    "meetingUrl": appt.meeting_url,
                    "idempotencyKey": f"reminder:{appt.id}",
                }
            )
        return out

    async def send_appointment_reminder(
        self, appointment_id: uuid.UUID, *, idempotency_key: str | None = None
    ) -> dict[str, Any]:
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        appt = result.scalar_one_or_none()
        if appt is None:
            raise NotFoundError("Appointment not found")
        expected = f"reminder:{appt.id}"
        if idempotency_key and idempotency_key != expected:
            raise ValidationAppError("Reminder idempotency key mismatch")

        existing = await self.db.execute(
            select(EmailLog).where(
                EmailLog.lead_id == appt.lead_id,
                EmailLog.template_slug == "meeting_reminder",
                EmailLog.subject.contains(appt.title or "Meeting"),
            ).limit(1)
        )
        if existing.scalar_one_or_none():
            return {"sent": False, "duplicate": True}

        email_to = appt.lead_email
        if not email_to:
            lead = await self._get_lead(appt.lead_id)
            email_to = lead.email
        await EmailService(self.db).send(
            to=email_to,
            subject=f"Reminder: {appt.title}",
            body=(
                f"Your meeting starts at {appt.start_at.isoformat()}. "
                f"Join: {appt.meeting_url or 'link pending'}"
            ),
            template_slug="meeting_reminder",
            lead_id=str(appt.lead_id),
        )
        if appt.assigned_user_id:
            await create_notification(
                self.db,
                user_id=appt.assigned_user_id,
                title="Upcoming meeting",
                message=f"Meeting with {appt.lead_name} starts soon",
                category=NotificationCategory.MEETINGS,
                related_id=str(appt.id),
                related_type="appointment",
            )
        return {"sent": True, "duplicate": False, "appointmentId": str(appt.id)}

    async def sync_appointment_calendar(self, appointment_id: uuid.UUID) -> dict[str, Any]:
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        appt = result.scalar_one_or_none()
        if appt is None:
            raise NotFoundError("Appointment not found")
        from app.core.config import get_settings

        settings = get_settings()
        mocked = settings.google_calendar_mock_mode
        external_id = (appt.calendar_provider or "") + f"mock-gcal-{appointment_id.hex[:12]}"
        if not appt.calendar_provider:
            appt.calendar_provider = "google_mock"
            await self.db.flush()
        meeting_url = appt.meeting_url or f"https://meet.google.com/mock-{appointment_id.hex[-10:]}"
        return {
            "status": "synced",
            "provider": "google",
            "mocked": mocked,
            "externalEventId": external_id,
            "meetingUrl": meeting_url,
        }

    async def appointment_booking_actions(
        self, appointment_id: uuid.UUID, *, event_id: str | None = None
    ) -> dict[str, Any]:
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        appt = result.scalar_one_or_none()
        if appt is None:
            raise NotFoundError("Appointment not found")
        lead = await self._get_lead(appt.lead_id)

        calendar = await self.sync_appointment_calendar(appointment_id)

        existing_task = await self.db.execute(
            select(Task).where(
                Task.lead_id == lead.id,
                Task.title == "Prepare meeting",
                Task.due_at.isnot(None),
            ).limit(1)
        )
        task_created = False
        if existing_task.scalar_one_or_none() is None:
            self.db.add(
                Task(
                    title="Prepare meeting",
                    description=f"Prepare for meeting with {appt.lead_name}",
                    lead_id=lead.id,
                    lead_name=appt.lead_name,
                    assigned_user_id=appt.assigned_user_id,
                    priority="High",
                    status=TaskStatus.TODO,
                    due_at=appt.start_at - timedelta(hours=2),
                )
            )
            task_created = True

        await EmailService(self.db).send(
            to=lead.email,
            subject="Your meeting is confirmed",
            body=(
                f"Hi {lead.first_name}, your meeting on {appt.start_at.date()} "
                f"is confirmed. Link: {calendar.get('meetingUrl')}"
            ),
            template_slug="meeting_confirmation",
            lead_id=str(lead.id),
        )

        if appt.assigned_user_id:
            await create_notification(
                self.db,
                user_id=appt.assigned_user_id,
                title="Appointment booked",
                message=f"Meeting scheduled with {appt.lead_name}",
                category=NotificationCategory.MEETINGS,
                related_id=str(appt.id),
                related_type="appointment",
            )

        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=appt.lead_name,
            type=ActivityType.APPOINTMENT,
            description="Appointment booking automation completed",
            user_name="system",
            metadata={"eventId": event_id, "appointmentId": str(appt.id)},
        )
        await self.db.flush()
        return {
            "calendar": calendar,
            "taskCreated": task_created,
            "appointmentId": str(appt.id),
        }

    async def get_qualification_context(
        self, lead_id: uuid.UUID, conversation_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        lead = await self._get_lead(lead_id)
        summary = None
        if conversation_id:
            conv = (
                await self.db.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
            ).scalar_one_or_none()
            if conv:
                summary = conv.summary
        return {
            **await self.get_lead_context(lead_id),
            "conversationId": str(conversation_id) if conversation_id else None,
            "conversationSummary": summary,
            "temperatureFromScore": temperature_from_score(int(lead.score or 0)).value,
        }
