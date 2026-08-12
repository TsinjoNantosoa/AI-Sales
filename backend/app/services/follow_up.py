"""Follow-up processing for due / stale leads."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ActivityType, LeadStatus
from app.core.exceptions import NotFoundError, ValidationAppError
from app.models.email import EmailLog
from app.models.lead import Lead
from app.services.activity import create_activity
from app.services.email import EmailService
from app.services.settings import SettingsService
from app.utils import utcnow

DEFAULT_SKIP_STATUSES = {
    LeadStatus.WON,
    LeadStatus.LOST,
    LeadStatus.MEETING_SCHEDULED,
    LeadStatus.ARCHIVED,
}

# Attempt index → delay between follow-ups (24h / 3d / 7d)
FOLLOW_UP_INTERVALS = (
    timedelta(hours=24),
    timedelta(days=3),
    timedelta(days=7),
)


class FollowUpService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _follow_up_count(self, lead_id) -> int:
        result = await self.db.execute(
            select(EmailLog).where(
                EmailLog.lead_id == lead_id,
                EmailLog.template_slug == "follow_up",
            )
        )
        return len(list(result.scalars().all()))

    async def process(
        self,
        *,
        skip_statuses: set[str] | None = None,
        limit: int = 100,
    ) -> int:
        settings = await SettingsService(self.db)._load_merged()
        follow_cfg = settings.get("follow_ups") or {}
        if follow_cfg.get("enabled") is False:
            return 0

        max_attempts = int(follow_cfg.get("max_attempts") or 3)
        skip = skip_statuses or DEFAULT_SKIP_STATUSES
        now = utcnow()
        first_delay = FOLLOW_UP_INTERVALS[0]

        q = (
            select(Lead)
            .where(
                Lead.deleted_at.is_(None),
                Lead.archived_at.is_(None),
                Lead.status.notin_(list(skip)),
                or_(
                    Lead.next_follow_up_at <= now,
                    Lead.last_interaction_at.is_(None),
                    Lead.last_interaction_at <= now - first_delay,
                ),
            )
            .order_by(Lead.next_follow_up_at.asc().nullsfirst())
            .limit(limit)
        )
        result = await self.db.execute(q)
        leads = list(result.scalars().all())

        processed = 0
        email = EmailService(self.db)
        subject = (settings.get("email_templates") or {}).get(
            "follow_up_subject", "Following up on your inquiry"
        )

        for lead in leads:
            count = await self._follow_up_count(lead.id)
            if count >= max_attempts:
                continue

            explicitly_due = bool(lead.next_follow_up_at and lead.next_follow_up_at <= now)
            if not explicitly_due:
                interval = FOLLOW_UP_INTERVALS[min(count, len(FOLLOW_UP_INTERVALS) - 1)]
                reference = lead.last_interaction_at or lead.created_at
                if reference and reference > now - interval:
                    continue

            await email.send(
                to=lead.email,
                subject=subject,
                body=(
                    f"Hi {lead.first_name}, just following up on your inquiry "
                    f"with {lead.company_name}. Happy to help whenever you're ready."
                ),
                template_slug="follow_up",
                lead_id=str(lead.id),
            )
            await create_activity(
                self.db,
                lead_id=lead.id,
                lead_name=f"{lead.first_name} {lead.last_name}",
                type=ActivityType.EMAIL,
                description=f"Automated follow-up #{count + 1} sent",
                user_name="system",
                metadata={"follow_up_attempt": count + 1},
            )

            next_idx = min(count + 1, len(FOLLOW_UP_INTERVALS) - 1)
            lead.next_follow_up_at = now + FOLLOW_UP_INTERVALS[next_idx]
            lead.last_interaction_at = now
            processed += 1

        await self.db.flush()
        return processed

    async def process_lead(
        self,
        lead_id: uuid.UUID,
        *,
        idempotency_key: str | None = None,
    ) -> dict:
        """Send a follow-up email to exactly this lead and no other.

        Idempotency key format: ``follow-up:<leadId>:<attemptNumber>``.
        If the key is provided and does not match the expected key for the
        current attempt, a ValidationAppError is raised.
        Returns a dict with ``sent``, ``duplicate``, ``attempt``.
        """
        result = await self.db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead = result.scalar_one_or_none()
        if lead is None:
            raise NotFoundError(f"Lead not found: {lead_id}")
        if lead.status in DEFAULT_SKIP_STATUSES:
            return {"sent": False, "duplicate": False, "skipped": True, "reason": "terminal_status"}

        settings = await SettingsService(self.db)._load_merged()
        follow_cfg = settings.get("follow_ups") or {}
        if follow_cfg.get("enabled") is False:
            return {"sent": False, "skipped": True, "reason": "follow_ups_disabled"}

        max_attempts = int(follow_cfg.get("max_attempts") or 3)
        count = await self._follow_up_count(lead_id)

        if count >= max_attempts:
            return {"sent": False, "skipped": True, "reason": "max_attempts_reached", "attempt": count}

        expected_key = f"follow-up:{lead_id}:{count + 1}"
        if idempotency_key and idempotency_key != expected_key:
            raise ValidationAppError(
                f"Follow-up idempotency key mismatch: got {idempotency_key!r}, expected {expected_key!r}"
            )

        # Duplicate guard — prevent sending twice within 5 min
        existing = await self.db.execute(
            select(EmailLog)
            .where(
                EmailLog.lead_id == lead_id,
                EmailLog.template_slug == "follow_up",
            )
            .order_by(EmailLog.created_at.desc())
            .limit(1)
        )
        last = existing.scalar_one_or_none()
        if last and last.created_at and last.created_at > utcnow() - timedelta(minutes=5):
            return {"sent": False, "duplicate": True, "attempt": count, "idempotencyKey": expected_key}

        now = utcnow()
        subject = (settings.get("email_templates") or {}).get(
            "follow_up_subject", "Following up on your inquiry"
        )
        email = EmailService(self.db)
        await email.send(
            to=lead.email,
            subject=subject,
            body=(
                f"Hi {lead.first_name}, just following up on your inquiry "
                f"with {lead.company_name}. Happy to help whenever you're ready."
            ),
            template_slug="follow_up",
            lead_id=str(lead.id),
        )
        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.EMAIL,
            description=f"Automated follow-up #{count + 1} sent",
            user_name="system",
            metadata={"follow_up_attempt": count + 1},
        )

        next_idx = min(count + 1, len(FOLLOW_UP_INTERVALS) - 1)
        lead.next_follow_up_at = now + FOLLOW_UP_INTERVALS[next_idx]
        lead.last_interaction_at = now
        await self.db.flush()

        return {
            "sent": True,
            "duplicate": False,
            "attempt": count + 1,
            "idempotencyKey": expected_key,
        }
