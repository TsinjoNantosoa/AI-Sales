"""ARQ worker tasks."""

from __future__ import annotations

from arq import cron
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


async def follow_up_leads(ctx: dict) -> str:
    """Process due follow-ups (24h / 3d / 7d) via FollowUpService.

    When N8N_ENABLED=true, n8n owns follow-up scheduling via its Schedule Trigger
    and this ARQ job is skipped to avoid double-processing.
    When N8N_ENABLED=false, ARQ acts as the fallback scheduler.
    """
    from app.core.database import AsyncSessionLocal
    from app.services.follow_up import FollowUpService

    if _settings.n8n_enabled:
        logger.info("worker_follow_up_skipped_n8n_owns_scheduling")
        return "skipped=n8n_owns_scheduling"

    async with AsyncSessionLocal() as session:
        try:
            processed = await FollowUpService(session).process()
            await session.commit()
        except Exception:
            await session.rollback()
            raise

    logger.info("worker_follow_up_leads", processed=processed)
    return f"processed={processed}"


async def dispatch_automation_events(ctx: dict) -> str:
    """Poll automation outbox and deliver events to n8n."""
    from app.services.automation_dispatcher import dispatch_pending_events

    count = await dispatch_pending_events()
    logger.info("worker_dispatch_automation_events", dispatched=count)
    return f"dispatched={count}"


async def sync_integrations(ctx: dict) -> str:
    """Placeholder for future calendar / CRM sync jobs."""
    logger.info("worker_sync_integrations")
    return "ok"


async def startup(ctx: dict) -> None:
    logger.info("worker_startup")


async def shutdown(ctx: dict) -> None:
    logger.info("worker_shutdown")


_settings = get_settings()


class WorkerSettings:
    functions = [follow_up_leads, dispatch_automation_events, sync_integrations]
    on_startup = startup
    on_shutdown = shutdown
    cron_jobs = [
        cron(follow_up_leads, hour={9, 14}, minute=0),
        cron(dispatch_automation_events, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}),
    ]
    redis_settings = RedisSettings.from_dsn(_settings.redis_url)
