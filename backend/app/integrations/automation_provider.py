"""Automation provider abstraction (local mock vs n8n)."""

from __future__ import annotations

import uuid
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import ExecutionStatus
from app.core.logging import get_logger
from app.models.workflow import Workflow, WorkflowExecution
from app.utils import utcnow

logger = get_logger(__name__)


class AutomationProvider(Protocol):
    async def trigger(self, event: str, payload: dict[str, Any]) -> dict[str, Any]: ...


class LocalAutomationProvider:
    """Creates WorkflowExecution rows locally when n8n is disabled."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def trigger(self, event: str, payload: dict[str, Any]) -> dict[str, Any]:
        workflow: Workflow | None = None
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

        started = utcnow()
        duration_ms = 1800
        raw_lead = payload.get("lead_id")
        lead_uuid = None
        if raw_lead is not None:
            lead_uuid = raw_lead if isinstance(raw_lead, uuid.UUID) else uuid.UUID(str(raw_lead))
        input_payload = {
            "event": event,
            **{k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in payload.items()},
        }
        exec_row = WorkflowExecution(
            workflow_id=workflow.id,
            lead_id=lead_uuid,
            status=ExecutionStatus.SUCCESS,
            started_at=started,
            finished_at=started,
            duration_ms=duration_ms,
            retry_count=0,
            input_json=input_payload,
            output_json={"ok": True, "provider": "local", "mocked": True},
        )
        self.db.add(exec_row)
        workflow.success_count = (workflow.success_count or 0) + 1
        workflow.total_duration_ms = (workflow.total_duration_ms or 0) + duration_ms
        workflow.last_execution_at = started
        await self.db.flush()
        logger.info("local_automation_trigger", event_name=event, execution_id=str(exec_row.id))
        return {
            "ok": True,
            "mocked": True,
            "provider": "local",
            "execution_id": str(exec_row.id),
        }


class N8nAutomationProvider:
    """Thin wrapper around N8nClient when enabled."""

    async def trigger(self, event: str, payload: dict[str, Any]) -> dict[str, Any]:
        from app.services.n8n import N8nClient

        client = N8nClient()
        path = payload.get("webhook_path") or f"/webhook/{event}"
        result = await client.trigger_webhook(path, {"event": event, **payload})
        return result or {"ok": True, "provider": "n8n"}

def get_automation_provider(db: AsyncSession) -> AutomationProvider:
    settings = get_settings()
    if settings.n8n_enabled:
        return N8nAutomationProvider()
    return LocalAutomationProvider(db)
