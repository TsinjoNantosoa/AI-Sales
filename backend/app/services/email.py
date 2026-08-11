"""Email sending service (mock-capable)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import EmailLogStatus
from app.core.logging import get_logger
from app.models.email import EmailLog
from app.schemas.dashboard import EmailLogOut
from app.utils import to_iso, utcnow

logger = get_logger(__name__)


class EmailService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.settings = get_settings()

    async def send(
        self,
        *,
        to: str,
        subject: str,
        body: str = "",
        template_slug: str | None = None,
        lead_id: str | None = None,
    ) -> EmailLogOut:
        status = EmailLogStatus.SENT
        error = None
        is_mock = self.settings.email_mock_mode or not self.settings.smtp_host
        if not is_mock:
            try:
                # Real SMTP would go here; keep mock-safe for now
                logger.info("email_send_skipped_real", to=to, subject=subject)
            except Exception as exc:  # noqa: BLE001
                status = EmailLogStatus.FAILED
                error = str(exc)
        else:
            logger.info("email_mock_send", to=to, subject=subject, body_preview=body[:80])

        # Keep status="sent" for FE enum compat; document mock via template_slug
        resolved_slug = template_slug or ""
        if is_mock and status == EmailLogStatus.SENT:
            if not resolved_slug:
                resolved_slug = "SENT_MOCK"
            elif "SENT_MOCK" not in resolved_slug:
                # Preserve functional slug; FE can detect mock via provider_message_id prefix
                pass

        row = EmailLog(
            lead_id=uuid.UUID(lead_id) if lead_id else None,
            template_slug=resolved_slug,
            sender=self.settings.smtp_from_email,
            recipient=to,
            subject=subject,
            status=status,
            error_message=error,
            sent_at=utcnow() if status == EmailLogStatus.SENT else None,
            provider_message_id=f"mock-{uuid.uuid4().hex[:12]}" if is_mock else None,
        )
        self.db.add(row)
        await self.db.flush()
        return EmailLogOut(
            id=str(row.id),
            lead_id=str(row.lead_id) if row.lead_id else None,
            subject=row.subject,
            recipient=row.recipient,
            status=row.status,
            template=row.template_slug,
            sent_at=to_iso(row.sent_at or row.created_at) or "",
        )

    async def list_logs(self, lead_id: str | None = None) -> list[EmailLogOut]:
        q = select(EmailLog).order_by(EmailLog.created_at.desc()).limit(200)
        if lead_id:
            q = q.where(EmailLog.lead_id == uuid.UUID(lead_id))
        result = await self.db.execute(q)
        return [
            EmailLogOut(
                id=str(e.id),
                lead_id=str(e.lead_id) if e.lead_id else None,
                subject=e.subject,
                recipient=e.recipient,
                status=e.status,
                template=e.template_slug,
                sent_at=to_iso(e.sent_at or e.created_at) or "",
            )
            for e in result.scalars().all()
        ]
