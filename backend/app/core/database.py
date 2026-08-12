"""Database engine and session management."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from app.core.config import get_settings
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug and settings.app_env == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        session.info.setdefault("automation_pending_dispatch", [])
        try:
            yield session
            await session.commit()
            pending = session.info.get("automation_pending_dispatch") or []
            if pending:
                from app.services.automation_dispatcher import dispatch_queued_event_ids

                await dispatch_queued_event_ids(list(pending))
                session.info["automation_pending_dispatch"] = []
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Dispose / reconnect helpers — tables come from Alembic."""
    # Ensure engine is reachable
    async with engine.begin() as conn:
        await conn.run_sync(lambda _: None)


async def close_db() -> None:
    await engine.dispose()
