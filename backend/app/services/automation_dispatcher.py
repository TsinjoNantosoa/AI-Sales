"""Dispatch automation outbox events to n8n with bounded retries."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.enums import AutomationEventStatus
from app.core.logging import get_logger
from app.integrations.n8n_events import webhook_path_for_event
from app.models.automation_event import AutomationEvent
from app.services.n8n import N8nClient
from app.utils import utcnow

logger = get_logger(__name__)

MAX_DISPATCH_ATTEMPTS = 4
BACKOFF_SECONDS = (5, 30, 120, 600)


async def dispatch_event_row(db: AsyncSession, row: AutomationEvent) -> bool:
    """Send one outbox row to n8n. Returns True on success."""
    settings = get_settings()
    if not settings.n8n_enabled:
        row.status = AutomationEventStatus.DISPATCHED
        row.dispatched_at = utcnow()
        row.last_error = None
        await db.flush()
        logger.info("automation_dispatch_skipped_n8n_disabled", event_id=row.event_id)
        return True

    row.status = AutomationEventStatus.DISPATCHING
    row.attempt_count = (row.attempt_count or 0) + 1
    await db.flush()

    path = webhook_path_for_event(row.event_type)
    if path is None:
        # No n8n webhook registered for this event type — skip silently
        row.status = AutomationEventStatus.DISPATCHED
        row.dispatched_at = utcnow()
        row.last_error = f"no_webhook_mapped:{row.event_type}"
        await db.flush()
        logger.info(
            "automation_dispatch_no_webhook",
            event_id=row.event_id,
            event_type=row.event_type,
        )
        return True

    client = N8nClient()
    try:
        await client.trigger_webhook(path, row.payload_json)
        row.status = AutomationEventStatus.DISPATCHED
        row.dispatched_at = utcnow()
        row.last_error = None
        row.next_attempt_at = None
        await db.flush()
        logger.info("automation_dispatch_ok", event_id=row.event_id, event_type=row.event_type)
        return True
    except Exception as exc:  # noqa: BLE001
        err = str(exc)[:500]
        row.last_error = err
        if row.attempt_count >= MAX_DISPATCH_ATTEMPTS:
            row.status = AutomationEventStatus.FAILED
            row.next_attempt_at = None
        else:
            row.status = AutomationEventStatus.PENDING
            delay = BACKOFF_SECONDS[min(row.attempt_count - 1, len(BACKOFF_SECONDS) - 1)]
            row.next_attempt_at = utcnow() + timedelta(seconds=delay)
        await db.flush()
        logger.warning(
            "automation_dispatch_failed",
            event_id=row.event_id,
            attempt=row.attempt_count,
            error=err,
        )
        return False


async def dispatch_pending_events(limit: int = 50) -> int:
    """Poll outbox for pending/retryable events."""
    now = utcnow()
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AutomationEvent)
            .where(
                AutomationEvent.status.in_(
                    [AutomationEventStatus.PENDING, AutomationEventStatus.DISPATCHING]
                ),
                (AutomationEvent.next_attempt_at.is_(None))
                | (AutomationEvent.next_attempt_at <= now),
            )
            .order_by(AutomationEvent.created_at.asc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        ok = 0
        for row in rows:
            if await dispatch_event_row(db, row):
                ok += 1
        await db.commit()
        return ok


async def dispatch_queued_event_ids(event_ids: list[uuid.UUID]) -> int:
    """Dispatch specific rows immediately after request commit."""
    if not event_ids:
        return 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AutomationEvent).where(AutomationEvent.id.in_(event_ids))
        )
        rows = list(result.scalars().all())
        ok = 0
        for row in rows:
            if row.status in (
                AutomationEventStatus.PENDING,
                AutomationEventStatus.DISPATCHING,
            ) and await dispatch_event_row(db, row):
                ok += 1
        await db.commit()
        return ok
