"""Automation provider abstraction (local mock vs n8n)."""

from __future__ import annotations

import uuid
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import ExecutionStatus
from app.core.logging import get_logger
from app.integrations.n8n_events import EVENT_WEBHOOK_PATHS, workflow_slug_for_event
from app.models.workflow import Workflow, WorkflowExecution
from app.schemas.automation_events import AutomationEventEnvelope
from app.services.automation_events import AutomationEventService
from app.utils import to_iso, utcnow

logger = get_logger(__name__)


class AutomationProvider(Protocol):
    async def trigger(self, event: str, payload: dict[str, Any]) -> dict[str, Any]: ...


class LocalAutomationProvider:
    """Creates WorkflowExecution rows locally when n8n is disabled."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def trigger(self, event: str, payload: dict[str, Any]) -> dict[str, Any]:
        slug = workflow_slug_for_event(event)
        workflow: Workflow | None = None
        if slug:
            result = await self.db.execute(select(Workflow).where(Workflow.slug == slug))
            workflow = result.scalar_one_or_none()
        if workflow is None:
            raw_id = payload.get("workflow_id")
            if raw_id is not None:
                wid = raw_id if isinstance(raw_id, uuid.UUID) else uuid.UUID(str(raw_id))
                result = await self.db.execute(select(Workflow).where(Workflow.id == wid))
                workflow = result.scalar_one_or_none()
        if workflow is None:
            result = await self.db.execute(select(Workflow).limit(1))
            workflow = result.scalar_one_or_none()
        if workflow is None:
            logger.info("local_automation_no_workflow", event_name=event)
            return {"ok": True, "mocked": True, "provider": "local", "persisted": False}

        event_id = str(payload.get("eventId") or payload.get("event_id") or uuid.uuid4())
        idem = f"{workflow.slug}:{event_id}"
        existing = await self.db.execute(
            select(WorkflowExecution).where(WorkflowExecution.idempotency_key == idem)
        )
        if existing.scalar_one_or_none():
            return {"ok": True, "mocked": True, "duplicate": True, "provider": "local"}

        started = utcnow()
        duration_ms = 250
        raw_lead = payload.get("leadId") or payload.get("lead_id")
        lead_uuid = None
        if raw_lead is not None:
            lead_uuid = raw_lead if isinstance(raw_lead, uuid.UUID) else uuid.UUID(str(raw_lead))
        exec_row = WorkflowExecution(
            workflow_id=workflow.id,
            lead_id=lead_uuid,
            status=ExecutionStatus.SUCCESS,
            started_at=started,
            finished_at=started,
            duration_ms=duration_ms,
            retry_count=0,
            input_json={"event": event, **payload},
            output_json={"ok": True, "provider": "local", "mocked": True},
            idempotency_key=idem,
        )
        self.db.add(exec_row)
        workflow.success_count = (workflow.success_count or 0) + 1
        workflow.total_duration_ms = (workflow.total_duration_ms or 0) + duration_ms
        workflow.last_execution_at = started
        await self.db.flush()
        return {
            "ok": True,
            "mocked": True,
            "provider": "local",
            "execution_id": str(exec_row.id),
        }


class N8nAutomationProvider:
    """Enqueue canonical events to outbox; dispatcher delivers to n8n."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def trigger(self, event: str, payload: dict[str, Any]) -> dict[str, Any]:
        event_id = str(payload.get("eventId") or payload.get("event_id") or uuid.uuid4())
        envelope = AutomationEventEnvelope(
            eventId=event_id,
            eventType=event,
            occurredAt=to_iso(utcnow()) or "",
            correlationId=str(payload.get("correlationId") or event_id),
            leadId=str(payload.get("leadId") or payload.get("lead_id") or "") or None,
            conversationId=str(payload.get("conversationId") or "") or None,
            appointmentId=str(payload.get("appointmentId") or "") or None,
            payload={k: v for k, v in payload.items() if k not in {"eventId", "eventType"}},
        )
        row = await AutomationEventService(self.db).emit(
            event,
            payload=envelope.to_dispatch_dict(),
            lead_id=envelope.lead_id,
            conversation_id=envelope.conversation_id,
            appointment_id=envelope.appointment_id,
            correlation_id=envelope.correlation_id,
            event_id=event_id,
        )
        return {
            "ok": True,
            "provider": "n8n",
            "eventId": event_id,
            "automationEventId": str(row.id),
            "webhook": EVENT_WEBHOOK_PATHS.get(event),
        }


def get_automation_provider(db: AsyncSession) -> AutomationProvider:
    settings = get_settings()
    if settings.n8n_enabled:
        return N8nAutomationProvider(db)
    return LocalAutomationProvider(db)
