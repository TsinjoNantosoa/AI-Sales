"""ARQ worker tasks stub."""

from __future__ import annotations

from arq import cron
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


async def follow_up_leads(ctx: dict) -> str:
    logger.info("worker_follow_up_leads")
    return "ok"


async def sync_integrations(ctx: dict) -> str:
    logger.info("worker_sync_integrations")
    return "ok"


async def startup(ctx: dict) -> None:
    logger.info("worker_startup")


async def shutdown(ctx: dict) -> None:
    logger.info("worker_shutdown")


_settings = get_settings()


class WorkerSettings:
    functions = [follow_up_leads, sync_integrations]
    on_startup = startup
    on_shutdown = shutdown
    cron_jobs = [
        cron(follow_up_leads, hour={9, 14}, minute=0),
    ]
    redis_settings = RedisSettings.from_dsn(_settings.redis_url)
