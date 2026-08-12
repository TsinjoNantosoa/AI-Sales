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

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_lead(session, *, email_suffix: str = ""):
    from app.core.enums import LeadSource, LeadStatus
    from app.models.lead import Lead

    return Lead(
        first_name="Test",
        last_name="User",
        company_name="Acme",
        email=f"test.{uuid.uuid4().hex[:8]}{email_suffix}@example.com",
        country="US",
        language="en",
        source=LeadSource.WEBSITE,
        status=LeadStatus.NEW,
        score=0,
        temperature="COLD",
        consent_given=True,
    )


# ---------------------------------------------------------------------------
# Event mapping
# ---------------------------------------------------------------------------


def test_event_mapping_no_dead_routes():
    """Every event in EVENT_WEBHOOK_PATHS must have a corresponding workflow slug."""
    from app.integrations.n8n_events import EVENT_WEBHOOK_PATHS, EVENT_WORKFLOW_SLUGS

    for event_type in EVENT_WEBHOOK_PATHS:
        assert event_type in EVENT_WORKFLOW_SLUGS, (
            f"Event '{event_type}' has a webhook path but no workflow slug"
        )


def test_no_handoff_webhook():
    """handoff.requested must NOT be in webhook paths (no n8n workflow exists)."""
    from app.integrations.n8n_events import EVENT_WEBHOOK_PATHS

    assert "conversation.handoff.requested" not in EVENT_WEBHOOK_PATHS
    assert "appointment.cancelled" not in EVENT_WEBHOOK_PATHS
    assert "follow_up.due" not in EVENT_WEBHOOK_PATHS
    assert "workflow.test" not in EVENT_WEBHOOK_PATHS


def test_webhook_path_returns_none_for_unmapped():
    from app.integrations.n8n_events import webhook_path_for_event

    assert webhook_path_for_event("conversation.handoff.requested") is None
    assert webhook_path_for_event("appointment.cancelled") is None


# ---------------------------------------------------------------------------
# Outbox emit
# ---------------------------------------------------------------------------


@requires_db
@pytest.mark.asyncio
async def test_emit_lead_created_persists_outbox(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        lead = _make_lead(session)
        session.add(lead)
        await session.flush()
        row = await AutomationEventService(session).emit_lead_created(lead.id)
        await session.commit()
        assert row.event_type == "lead.created"
        assert row.status == AutomationEventStatus.PENDING
        assert row.event_id


@requires_db
@pytest.mark.asyncio
async def test_dispatch_no_webhook_mapped_marks_dispatched(db_engine, monkeypatch):
    """Events with no webhook mapping must be skipped (DISPATCHED) not left PENDING."""
    get_settings.cache_clear()
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        row = AutomationEvent(
            event_id=str(uuid.uuid4()),
            event_type="conversation.handoff.requested",
            payload_json={"eventId": "x", "eventType": "conversation.handoff.requested", "payload": {}},
            status=AutomationEventStatus.PENDING,
        )
        session.add(row)
        await session.flush()
        ok = await dispatch_event_row(session, row)
        await session.commit()
        assert ok is True
        assert row.status == AutomationEventStatus.DISPATCHED


# ---------------------------------------------------------------------------
# Execution idempotency
# ---------------------------------------------------------------------------


@requires_db
@pytest.mark.asyncio
async def test_execution_start_idempotency(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        wf = Workflow(
            name="AI Sales — Lead Capture",
            slug="lead-capture-idem",
            description="test",
            status=WorkflowStatus.ACTIVE,
        )
        session.add(wf)
        await session.flush()
        svc = N8nExecutionService(session)
        eid = str(uuid.uuid4())
        first, dup1, enabled1 = await svc.start_execution(
            workflow_slug="lead-capture-idem", event_id=eid, lead_id=None
        )
        second, dup2, enabled2 = await svc.start_execution(
            workflow_slug="lead-capture-idem", event_id=eid, lead_id=None
        )
        await session.commit()
        assert dup1 is False
        assert dup2 is True
        assert first.id == second.id
        assert first.idempotency_key == build_idempotency_key("lead-capture-idem", eid)


@requires_db
@pytest.mark.asyncio
async def test_workflow_disabled_skips_side_effects(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        wf = Workflow(
            name="AI Sales — Hot Lead Alert Disabled",
            slug="hot-lead-alert-disabled",
            description="test",
            status=WorkflowStatus.INACTIVE,
        )
        session.add(wf)
        await session.flush()
        row, duplicate, enabled = await N8nExecutionService(session).start_execution(
            workflow_slug="hot-lead-alert-disabled",
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


# ---------------------------------------------------------------------------
# Internal API — auth guard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_internal_key_required():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/internal/n8n/follow-ups/due")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Internal API — welcome idempotency
# ---------------------------------------------------------------------------


@requires_db
@pytest.mark.asyncio
async def test_internal_welcome_idempotent(db_engine):
    from app.core.database import get_db
    from app.main import create_app

    settings = get_settings()
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)

    async with Session() as session:
        lead = _make_lead(session)
        session.add(lead)
        await session.commit()
        lead_id = lead.id

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
                params={"event_id": "evt-welcome-1"},
            )
            second = await client.post(
                f"/api/v1/internal/n8n/leads/{lead_id}/welcome",
                headers=headers,
                params={"event_id": "evt-welcome-1"},
            )
            assert first.status_code == 200, first.text
            assert second.status_code == 200, second.text
            assert first.json()["duplicate"] is False
            assert second.json()["duplicate"] is True
    finally:
        test_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Follow-up targeting — process_lead must target exact lead
# ---------------------------------------------------------------------------


@requires_db
@pytest.mark.asyncio
async def test_follow_up_targets_specific_lead(db_engine):
    """Lead B should be processed; Lead A must remain untouched."""
    from datetime import timedelta

    from app.services.follow_up import FollowUpService
    from app.utils import utcnow

    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        now = utcnow()
        lead_a = _make_lead(session)
        lead_a.next_follow_up_at = now - timedelta(hours=1)  # due
        lead_b = _make_lead(session)
        lead_b.next_follow_up_at = now - timedelta(hours=2)  # also due
        session.add(lead_a)
        session.add(lead_b)
        await session.commit()
        lead_a_id = lead_a.id
        lead_b_id = lead_b.id

    async with Session() as session:
        result = await FollowUpService(session).process_lead(lead_b_id)
        await session.commit()

    async with Session() as session:
        from sqlalchemy import select

        from app.models.email import EmailLog

        logs_a = (
            await session.execute(
                select(EmailLog).where(
                    EmailLog.lead_id == lead_a_id, EmailLog.template_slug == "follow_up"
                )
            )
        ).scalars().all()
        logs_b = (
            await session.execute(
                select(EmailLog).where(
                    EmailLog.lead_id == lead_b_id, EmailLog.template_slug == "follow_up"
                )
            )
        ).scalars().all()

    assert result["sent"] is True
    assert len(logs_a) == 0, "Lead A must NOT receive a follow-up"
    assert len(logs_b) == 1, "Lead B must receive exactly one follow-up"


@requires_db
@pytest.mark.asyncio
async def test_follow_up_idempotency(db_engine):
    """Running process_lead twice quickly must send only once."""
    from datetime import timedelta

    from app.services.follow_up import FollowUpService
    from app.utils import utcnow

    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        lead = _make_lead(session)
        lead.next_follow_up_at = utcnow() - timedelta(hours=1)
        session.add(lead)
        await session.commit()
        lead_id = lead.id

    async with Session() as session:
        first = await FollowUpService(session).process_lead(lead_id)
        await session.commit()

    async with Session() as session:
        second = await FollowUpService(session).process_lead(lead_id)
        await session.commit()

    assert first["sent"] is True
    assert second["duplicate"] is True


# ---------------------------------------------------------------------------
# Workflow JSON files
# ---------------------------------------------------------------------------


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
        assert data.get("name"), f"{name}: missing name"
        assert data.get("nodes"), f"{name}: missing nodes"
        assert data.get("connections"), f"{name}: missing connections"
        blob = json.dumps(data)
        assert "sk-" not in blob, f"{name}: possible OpenAI key"
        assert "BEGIN PRIVATE KEY" not in blob, f"{name}: possible private key"
        assert "CONFIGURE_AI_SALES_INTERNAL_API" not in blob, (
            f"{name}: bogus placeholder credential ID still present"
        )


def test_no_stale_handoff_webhook_in_workflows():
    """No workflow must register a webhook for handoff-requested."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[3] / "n8n" / "workflows"
    for p in root.glob("*.json"):
        blob = p.read_text(encoding="utf-8")
        assert "handoff-requested" not in blob, (
            f"{p.name}: still references dead webhook 'handoff-requested'"
        )
        assert "workflow-test" not in blob, (
            f"{p.name}: still references dead webhook 'workflow-test'"
        )
