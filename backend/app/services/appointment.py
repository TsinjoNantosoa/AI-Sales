"""Appointment and calendar slots service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser
from app.core.enums import ActivityType, AppointmentStatus, LeadStatus, NotificationCategory
from app.core.exceptions import AppointmentConflictError, NotFoundError
from app.core.permissions import can_access_all_leads, ensure_appointment_access, ensure_permission
from app.models.appointment import Appointment
from app.models.lead import Lead
from app.models.user import User
from app.schemas.common import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services.activity import create_activity
from app.services.mappers import appointment_to_out
from app.services.notification import create_notification
from app.utils import utcnow

BUSINESS_SLOTS = [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
]


class AppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get(self, appt_id: uuid.UUID) -> Appointment:
        result = await self.db.execute(select(Appointment).where(Appointment.id == appt_id))
        appt = result.scalar_one_or_none()
        if appt is None:
            raise NotFoundError("Appointment not found")
        return appt

    def _assert_access(self, appt: Appointment, user: CurrentUser) -> None:
        ensure_appointment_access(
            role=user.role,
            user_id=user.id,
            appointment_assigned_user_id=str(appt.assigned_user_id)
            if appt.assigned_user_id
            else None,
        )

    async def list_appointments(self, user: CurrentUser) -> list[AppointmentOut]:
        ensure_permission(user.role, "appointments:read")
        q = select(Appointment).order_by(Appointment.start_at.desc())
        if not can_access_all_leads(user.role):
            q = q.where(Appointment.assigned_user_id == user.uuid)
        result = await self.db.execute(q)
        return [appointment_to_out(a) for a in result.scalars().all()]

    async def get_appointment(self, appt_id: uuid.UUID, user: CurrentUser) -> AppointmentOut:
        ensure_permission(user.role, "appointments:read")
        appt = await self._get(appt_id)
        self._assert_access(appt, user)
        return appointment_to_out(appt)

    def _parse_start(self, date: str, time: str, tz: str = "UTC") -> datetime:
        try:
            zone = ZoneInfo(tz or "UTC")
        except ZoneInfoNotFoundError:
            zone = ZoneInfo("UTC")
        local = datetime.fromisoformat(f"{date}T{time}:00").replace(tzinfo=zone)
        return local.astimezone(UTC)

    async def _check_conflict(
        self,
        user_id: uuid.UUID,
        start: datetime,
        end: datetime,
        *,
        exclude_id: uuid.UUID | None = None,
    ) -> None:
        q = select(Appointment).where(
            Appointment.assigned_user_id == user_id,
            Appointment.status != AppointmentStatus.CANCELLED,
            Appointment.start_at < end,
            Appointment.end_at > start,
        )
        if exclude_id:
            q = q.where(Appointment.id != exclude_id)
        result = await self.db.execute(q)
        if result.scalar_one_or_none():
            raise AppointmentConflictError()

    async def create(self, data: AppointmentCreate, user: CurrentUser) -> AppointmentOut:
        ensure_permission(user.role, "appointments:write")
        start = self._parse_start(data.date, data.time, data.timezone)
        end = start + timedelta(minutes=data.duration)
        assigned = uuid.UUID(data.assigned_user_id)
        await self._check_conflict(assigned, start, end)

        lead_result = await self.db.execute(
            select(Lead).where(Lead.id == uuid.UUID(data.lead_id), Lead.deleted_at.is_(None))
        )
        lead = lead_result.scalar_one_or_none()
        if lead is None:
            raise NotFoundError("Lead not found")

        salesperson = data.salesperson_name
        if not salesperson:
            ures = await self.db.execute(select(User).where(User.id == assigned))
            u = ures.scalar_one_or_none()
            if u:
                salesperson = f"{u.first_name} {u.last_name}"

        meeting_url = data.meeting_link
        if data.google_meet and not meeting_url:
            meeting_url = f"https://meet.google.com/mock-{uuid.uuid4().hex[:10]}"

        appt = Appointment(
            lead_id=lead.id,
            assigned_user_id=assigned,
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
            user_id=user.id,
            user_name=user.full_name,
        )
        await create_notification(
            self.db,
            user_id=assigned,
            title="Meeting booked",
            message=f"Meeting with {appt.lead_name} on {data.date} at {data.time}",
            category=NotificationCategory.MEETINGS,
            related_id=str(lead.id),
            related_type="appointment",
        )
        await self.db.flush()
        return appointment_to_out(appt)

    async def update(
        self, appt_id: uuid.UUID, data: AppointmentUpdate, user: CurrentUser
    ) -> AppointmentOut:
        ensure_permission(user.role, "appointments:write")
        appt = await self._get(appt_id)
        self._assert_access(appt, user)
        payload = data.model_dump(exclude_unset=True)

        date = payload.get("date") or appt.start_at.date().isoformat()
        time = payload.get("time") or appt.start_at.strftime("%H:%M")
        duration = payload.get("duration") or appt.duration_minutes
        if any(k in payload for k in ("date", "time", "duration", "assigned_user_id")):
            start = self._parse_start(date, time, payload.get("timezone") or appt.timezone)
            end = start + timedelta(minutes=duration)
            assigned = (
                uuid.UUID(payload["assigned_user_id"])
                if payload.get("assigned_user_id")
                else appt.assigned_user_id
            )
            await self._check_conflict(assigned, start, end, exclude_id=appt.id)
            appt.start_at = start
            appt.end_at = end
            appt.duration_minutes = duration
            appt.assigned_user_id = assigned

        for field in ("timezone", "notes", "google_meet", "salesperson_name"):
            if field in payload:
                setattr(appt, field, payload[field])
        if "type" in payload:
            appt.meeting_type = payload["type"]
        if "meeting_link" in payload:
            appt.meeting_url = payload["meeting_link"]
        if "status" in payload:
            appt.status = payload["status"]
            if payload["status"] == AppointmentStatus.CANCELLED:
                appt.cancelled_at = utcnow()
        await self.db.flush()
        return appointment_to_out(appt)

    async def delete(self, appt_id: uuid.UUID, user: CurrentUser) -> None:
        ensure_permission(user.role, "appointments:write")
        appt = await self._get(appt_id)
        self._assert_access(appt, user)
        appt.status = AppointmentStatus.CANCELLED
        appt.cancelled_at = utcnow()
        await self.db.flush()

    async def available_slots(
        self, date: str, user_id: str, *, timezone: str = "UTC"
    ) -> list[str]:
        uid = uuid.UUID(user_id)
        try:
            zone = ZoneInfo(timezone or "UTC")
        except ZoneInfoNotFoundError:
            zone = ZoneInfo("UTC")
        result = await self.db.execute(
            select(Appointment).where(
                Appointment.assigned_user_id == uid,
                Appointment.status != AppointmentStatus.CANCELLED,
            )
        )
        taken: set[str] = set()
        for a in result.scalars().all():
            local_start = a.start_at.astimezone(zone) if a.start_at.tzinfo else a.start_at.replace(
                tzinfo=UTC
            ).astimezone(zone)
            if local_start.date().isoformat() == date:
                taken.add(local_start.strftime("%H:%M"))
        return [s for s in BUSINESS_SLOTS if s not in taken]
