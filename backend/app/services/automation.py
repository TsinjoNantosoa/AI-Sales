"""Workflow / automation service."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser
from app.core.config import get_settings
from app.core.enums import WorkflowStatus
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.core.permissions import ensure_permission
from app.integrations.automation_provider import get_automation_provider
from app.integrations.n8n_events import (
    EVENT_WEBHOOK_PATHS,
    test_payload_for_workflow,
    webhook_path_for_event,
)
from app.models.workflow import Workflow, WorkflowExecution
from app.schemas.dashboard import WorkflowExecutionOut, WorkflowOut
from app.services.n8n_execution import N8nExecutionService
from app.utils import to_iso

logger = get_logger(__name__)


def _fmt_duration(ms: int | None) -> str:
    if not ms:
        return "—"
    if ms < 1000:
        return f"{ms}ms"
    return f"{round(ms / 1000, 1)}s"


def workflow_to_out(w: Workflow) -> WorkflowOut:
    total = (w.success_count or 0) + (w.failure_count or 0)
    rate = round((w.success_count / total) * 100, 1) if total else 100.0
    avg = int(w.total_duration_ms / total) if total else 0
    return WorkflowOut(
        id=str(w.id),
        name=w.name,
        description=w.description or "",
        status=w.status,
        last_execution=to_iso(w.last_execution_at),
        success_rate=rate,
        total_executions=total,
        avg_duration=_fmt_duration(avg),
        errors=w.failure_count or 0,
    )


def execution_to_out(e: WorkflowExecution, workflow_name: str = "") -> WorkflowExecutionOut:
    return WorkflowExecutionOut(
        id=str(e.id),
        workflow_id=str(e.workflow_id),
        workflow_name=workflow_name,
        status=e.status,
        started_at=to_iso(e.started_at) or "",
        duration=_fmt_duration(e.duration_ms),
        retry_count=e.retry_count or 0,
        related_lead_id=str(e.lead_id) if e.lead_id else None,
        error_message=e.error_message,
    )


class AutomationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_workflows(self, user: CurrentUser) -> list[WorkflowOut]:
        ensure_permission(user.role, "automations:read")
        result = await self.db.execute(select(Workflow).order_by(Workflow.name))
        return [workflow_to_out(w) for w in result.scalars().all()]

    async def list_executions(
        self, user: CurrentUser, lead_id: str | None = None
    ) -> list[WorkflowExecutionOut]:
        ensure_permission(user.role, "automations:read")
        q = select(WorkflowExecution).order_by(WorkflowExecution.started_at.desc()).limit(100)
        if lead_id:
            q = q.where(WorkflowExecution.lead_id == uuid.UUID(lead_id))
        result = await self.db.execute(q)
        execs = result.scalars().all()
        workflows = {
            w.id: w.name
            for w in (await self.db.execute(select(Workflow))).scalars().all()
        }
        return [execution_to_out(e, workflows.get(e.workflow_id, "")) for e in execs]

    async def toggle(self, workflow_id: uuid.UUID, user: CurrentUser) -> WorkflowOut:
        ensure_permission(user.role, "automations:write")
        result = await self.db.execute(select(Workflow).where(Workflow.id == workflow_id))
        w = result.scalar_one_or_none()
        if w is None:
            raise NotFoundError("Workflow not found")
        w.status = (
            WorkflowStatus.INACTIVE
            if w.status == WorkflowStatus.ACTIVE
            else WorkflowStatus.ACTIVE
        )
        await self.db.flush()
        return workflow_to_out(w)

    async def test(self, workflow_id: uuid.UUID, user: CurrentUser) -> WorkflowExecutionOut:
        ensure_permission(user.role, "automations:write")
        result = await self.db.execute(select(Workflow).where(Workflow.id == workflow_id))
        w = result.scalar_one_or_none()
        if w is None:
            raise NotFoundError("Workflow not found")

        settings = get_settings()
        test_event_id = str(uuid.uuid4())

        if settings.n8n_enabled:
            # Build test payload for this workflow's real webhook
            test_payload = test_payload_for_workflow(w.slug, test_event_id)
            if test_payload is None:
                # Scheduled workflows (follow-up, meeting-reminder, global-error-handler)
                # have no event-based webhook — record a local mock execution
                row, _, _ = await N8nExecutionService(self.db).start_execution(
                    workflow_slug=w.slug,
                    event_id=test_event_id,
                    input_data={"trigger": "manual_test", "mock": True},
                )
                return execution_to_out(row, w.name)

            from app.services.n8n import N8nClient

            event_type = test_payload.get("eventType", "")
            path = webhook_path_for_event(event_type) or f"webhook/{w.slug}"
            row, duplicate, enabled = await N8nExecutionService(self.db).start_execution(
                workflow_slug=w.slug,
                event_id=test_event_id,
                input_data={**test_payload, "trigger": "manual_test"},
            )
            if enabled and not duplicate:
                try:
                    await N8nClient().trigger_webhook(path, test_payload)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("automation_test_n8n_webhook_error", error=str(exc), slug=w.slug)
            logger.info(
                "automation_test_n8n",
                workflow_id=str(w.id),
                slug=w.slug,
                execution_id=str(row.id),
                duplicate=duplicate,
                enabled=enabled,
            )
            return execution_to_out(row, w.name)

        # N8N disabled — use local provider for mock
        provider = get_automation_provider(self.db)
        event_type = next(
            (et for et, slug in EVENT_WEBHOOK_PATHS.items() if slug == w.slug), "workflow.test"
        )
        await provider.trigger(
            event_type,
            {"workflowId": str(w.id), "workflowSlug": w.slug, "eventId": test_event_id},
        )
        exec_result = await self.db.execute(
            select(WorkflowExecution)
            .where(WorkflowExecution.workflow_id == w.id)
            .order_by(WorkflowExecution.started_at.desc())
            .limit(1)
        )
        exec_row = exec_result.scalar_one_or_none()
        if exec_row is not None:
            return execution_to_out(exec_row, w.name)
        raise NotFoundError("Test execution was not created")

    async def retry_execution(
        self, execution_id: uuid.UUID, user: CurrentUser
    ) -> WorkflowExecutionOut:
        ensure_permission(user.role, "automations:write")
        row = await N8nExecutionService(self.db).retry_execution(execution_id)
        workflow = (
            await self.db.execute(select(Workflow).where(Workflow.id == row.workflow_id))
        ).scalar_one()
        return execution_to_out(row, workflow.name)
