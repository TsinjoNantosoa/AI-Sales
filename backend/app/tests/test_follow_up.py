"""Follow-up processing tests."""

from __future__ import annotations

from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db
from app.utils import utcnow


@requires_db
@pytest.mark.asyncio
async def test_internal_follow_up_process(client: AsyncClient, db_engine):
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.core.config import get_settings
    from app.core.enums import LeadSource, LeadStatus, LeadTemperature
    from app.models.lead import Lead

    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        lead = Lead(
            first_name="Follow",
            last_name="Up",
            company_name="FollowCo",
            email="followup@example.com",
            country="USA",
            source=LeadSource.WEBSITE,
            status=LeadStatus.CONTACTED,
            temperature=LeadTemperature.WARM,
            score=45,
            consent_given=True,
            last_interaction_at=utcnow() - timedelta(days=2),
            next_follow_up_at=utcnow() - timedelta(hours=1),
        )
        session.add(lead)
        await session.commit()

    settings = get_settings()
    resp = await client.post(
        "/api/v1/internal/follow-ups/process",
        headers={"X-Internal-Key": settings.internal_api_key},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert (data.get("processed") or 0) >= 1


@requires_db
@pytest.mark.asyncio
async def test_internal_follow_up_requires_key(client: AsyncClient):
    resp = await client.post(
        "/api/v1/internal/follow-ups/process",
        headers={"X-Internal-Key": "wrong-key"},
    )
    assert resp.status_code == 401


@requires_db
@pytest.mark.asyncio
async def test_arq_follow_up_leads_worker(db_engine, monkeypatch):
    """ARQ worker must call FollowUpService.process() and commit."""
    from datetime import timedelta

    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.core.enums import LeadSource, LeadStatus, LeadTemperature
    from app.models.lead import Lead
    from app.utils import utcnow
    from app.workers.tasks import follow_up_leads

    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", Session)

    async with Session() as session:
        session.add(
            Lead(
                first_name="Worker",
                last_name="Follow",
                company_name="WorkerCo",
                email="worker.follow@example.com",
                country="USA",
                source=LeadSource.WEBSITE,
                status=LeadStatus.CONTACTED,
                temperature=LeadTemperature.WARM,
                score=40,
                consent_given=True,
                last_interaction_at=utcnow() - timedelta(days=2),
                next_follow_up_at=utcnow() - timedelta(hours=1),
            )
        )
        await session.commit()

    result = await follow_up_leads({})
    assert result.startswith("processed=")
    assert int(result.split("=", 1)[1]) >= 1
