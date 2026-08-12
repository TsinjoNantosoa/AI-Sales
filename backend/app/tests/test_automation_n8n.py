"""Tests for n8n automation layer (mocked HTTP — no live n8n required)."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.core.enums import AutomationEventStatus, WorkflowStatus
from app.main import app
from app.models.automation_event import AutomationEvent
from app.models.workflow import Workflow
from app.services.automation_dispatcher import dispatch_event_row
from app.services.automation_events import AutomationEventService
from app.services.n8n_execution import N8nExecutionService, build_idempotency_key
from app.tests.conftest import requires_db


@requires_db
@pytest.mark.asyncio
async def test_emit_lead_created_persists_outbox(db_engine):
    from app.core.enums import LeadSource, LeadStatus
    from app.models.lead import Lead

    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        lead = Lead(
            first_name="John",
            last_name="Smith",
            company_name="ABC Consulting",
            email=f"n8n.{uuid.uuid4().hex[:8]}@example.com",
            country="US",
            language="en",
            source=LeadSource.WEBSITE,
            status=LeadStatus.NEW,
            score=0,
            temperature="COLD",
            consent_given=True,
        )
        session.add(lead)
        await session.flush()
        row = await AutomationEventService(session).emit_lead_created(lead.id)
        await session.commit()
        assert row.event_type == "lead.created"
        assert row.status == AutomationEventStatus.PENDING
        assert row.event_id


@requires_db
@pytest.mark.asyncio
async def test_execution_start_idempotency(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        wf = Workflow(
            name="AI Sales — Lead Capture",
            slug="lead-capture",
            description="test",
            status=WorkflowStatus.ACTIVE,
        )
        session.add(wf)
        await session.flush()
        svc = N8nExecutionService(session)
        eid = str(uuid.uuid4())
        first, dup1, enabled1 = await svc.start_execution(
            workflow_slug="lead-capture", event_id=eid, lead_id=None
        )
        second, dup2, enabled2 = await svc.start_execution(
            workflow_slug="lead-capture", event_id=eid, lead_id=None
        )
        await session.commit()
        assert dup1 is False
        assert dup2 is True
        assert first.id == second.id
        assert enabled1 is True
        assert enabled2 is True
        assert first.idempotency_key == build_idempotency_key("lead-capture", eid)


@requires_db
@pytest.mark.asyncio
async def test_workflow_disabled_skips_side_effects(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        wf = Workflow(
            name="AI Sales — Hot Lead Alert",
            slug="hot-lead-alert",
            description="test",
            status=WorkflowStatus.INACTIVE,
        )
        session.add(wf)
        await session.flush()
        row, duplicate, enabled = await N8nExecutionService(session).start_execution(
            workflow_slug="hot-lead-alert",
            event_id=str(uuid.uuid4()),
        )
        await session.commit()
        assert duplicate is False
        assert enabled is False
        assert (row.output_json or {}).get("skipped") is True


@requires_db
@pytest.mark.asyncio
async def test_dispatch_event_marks_dispatched_when_n8n_disabled(db_engine, monkeypatch):
    monkeypatch.setenv("N8N_ENABLED", "false")
    get_settings.cache_clear()
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        row = AutomationEvent(
            event_id=str(uuid.uuid4()),
            event_type="lead.created",
            payload_json={"eventId": "x", "eventType": "lead.created", "payload": {}},
            status=AutomationEventStatus.PENDING,
        )
        session.add(row)
        await session.flush()
        ok = await dispatch_event_row(session, row)
        await session.commit()
        assert ok is True
        assert row.status == AutomationEventStatus.DISPATCHED


@pytest.mark.asyncio
async def test_internal_key_required():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/internal/n8n/follow-ups/due")
        assert resp.status_code == 401


@requires_db
@pytest.mark.asyncio
async def test_internal_welcome_idempotent(db_engine):
    from app.core.database import get_db
    from app.core.enums import LeadSource, LeadStatus
    from app.main import create_app
    from app.models.lead import Lead

    settings = get_settings()
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)

    # Create lead in test DB
    async with Session() as session:
        lead = Lead(
            first_name="Jane",
            last_name="Doe",
            company_name="Co",
            email=f"welcome.{uuid.uuid4().hex[:8]}@example.com",
            country="US",
            language="en",
            source=LeadSource.WEBSITE,
            status=LeadStatus.NEW,
            score=0,
            temperature="COLD",
            consent_given=True,
        )
        session.add(lead)
        await session.commit()
        lead_id = lead.id

    # Override get_db so the API uses the same test DB
    test_app = create_app()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with Session() as db:
            try:
                yield db
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    test_app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=test_app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"X-Internal-Key": settings.internal_api_key}
            first = await client.post(
                f"/api/v1/internal/n8n/leads/{lead_id}/welcome",
                headers=headers,
                params={"event_id": "evt-1"},
            )
            second = await client.post(
                f"/api/v1/internal/n8n/leads/{lead_id}/welcome",
                headers=headers,
                params={"event_id": "evt-1"},
            )
            assert first.status_code == 200
            assert second.status_code == 200
            assert first.json()["duplicate"] is False
            assert second.json()["duplicate"] is True
    finally:
        test_app.dependency_overrides.clear()


def test_workflow_json_files_validate():
    from pathlib import Path

    root = Path(__file__).resolve().parents[3] / "n8n" / "workflows"
    names = {
        "01_lead_capture.json",
        "02_ai_qualification.json",
        "03_hot_lead_alert.json",
        "04_follow_up.json",
        "05_appointment_booking.json",
        "06_meeting_reminder.json",
        "99_global_error_handler.json",
    }
    found = {p.name for p in root.glob("*.json")}
    assert names.issubset(found)
    for name in names:
        data = json.loads((root / name).read_text(encoding="utf-8"))
        assert data.get("name")
        assert data.get("nodes")
        assert data.get("connections")
        blob = json.dumps(data)
        assert "sk-" not in blob
        assert "BEGIN PRIVATE KEY" not in blob
