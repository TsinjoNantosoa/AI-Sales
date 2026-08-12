"""Workflow execution lifecycle for n8n callbacks."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ExecutionStatus, WorkflowStatus
from app.core.exceptions import NotFoundError, ValidationAppError
from app.core.logging import get_logger
from app.integrations.n8n_events import workflow_slug_for_event
from app.models.workflow import Workflow, WorkflowExecution
from app.utils import utcnow

logger = get_logger(__name__)


def build_idempotency_key(workflow_slug: str, event_id: str) -> str:
    return f"{workflow_slug}:{event_id}"


class N8nExecutionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_workflow_by_slug(self, slug: str) -> Workflow:
        result = await self.db.execute(select(Workflow).where(Workflow.slug == slug))
        workflow = result.scalar_one_or_none()
        if workflow is None:
            raise NotFoundError(f"Workflow not found: {slug}")
        return workflow

    async def start_execution(
        self,
        *,
        workflow_slug: str,
        event_id: str,
        external_execution_id: str | None = None,
        lead_id: uuid.UUID | None = None,
        input_data: dict[str, Any] | None = None,
        correlation_id: str | None = None,
        started_at: str | None = None,
    ) -> tuple[WorkflowExecution, bool, bool]:
        workflow = await self._get_workflow_by_slug(workflow_slug)
        workflow_enabled = workflow.status == WorkflowStatus.ACTIVE
        idem_key = build_idempotency_key(workflow_slug, event_id)

        existing = await self.db.execute(
            select(WorkflowExecution).where(WorkflowExecution.idempotency_key == idem_key)
        )
        row = existing.scalar_one_or_none()
        if row is not None:
            return row, True, workflow_enabled

        if not workflow_enabled:
            # Record skipped execution without side effects
            row = WorkflowExecution(
                workflow_id=workflow.id,
                lead_id=lead_id,
                external_execution_id=external_execution_id,
                status=ExecutionStatus.WAITING,
                started_at=utcnow(),
                finished_at=utcnow(),
                duration_ms=0,
                retry_count=0,
                input_json=input_data or {},
                output_json={"skipped": True, "reason": "workflow_inactive"},
                idempotency_key=idem_key,
            )
            self.db.add(row)
            await self.db.flush()
            return row, False, False

        row = WorkflowExecution(
            workflow_id=workflow.id,
            lead_id=lead_id,
            external_execution_id=external_execution_id,
            status=ExecutionStatus.RUNNING,
            started_at=utcnow(),
            retry_count=0,
            input_json={
                **(input_data or {}),
                "eventId": event_id,
                "correlationId": correlation_id,
                "startedAt": started_at,
            },
            idempotency_key=idem_key,
        )
        self.db.add(row)
        await self.db.flush()
        logger.info(
            "n8n_execution_started",
            execution_id=str(row.id),
            workflow_slug=workflow_slug,
            event_id=event_id,
        )
        return row, False, True

    async def mark_success(
        self,
        execution_id: uuid.UUID,
        *,
        external_execution_id: str | None = None,
        duration_ms: int | None = None,
        output: dict[str, Any] | None = None,
        retry_count: int | None = None,
    ) -> WorkflowExecution:
        row = await self._get_execution(execution_id)
        if row.status == ExecutionStatus.SUCCESS:
            return row
        finished = utcnow()
        row.status = ExecutionStatus.SUCCESS
        row.finished_at = finished
        if external_execution_id:
            row.external_execution_id = external_execution_id
        if duration_ms is not None:
            row.duration_ms = duration_ms
        elif row.started_at:
            row.duration_ms = max(0, int((finished - row.started_at).total_seconds() * 1000))
        row.output_json = output or {"ok": True}
        if retry_count is not None:
            row.retry_count = retry_count
        row.error_message = None

        workflow = await self._get_workflow(row.workflow_id)
        workflow.success_count = (workflow.success_count or 0) + 1
        if row.duration_ms:
            workflow.total_duration_ms = (workflow.total_duration_ms or 0) + row.duration_ms
        workflow.last_execution_at = finished
        if external_execution_id and not workflow.external_workflow_id:
            workflow.external_workflow_id = external_execution_id.split(":")[0][:100]
        await self.db.flush()
        return row

    async def mark_failure(
        self,
        execution_id: uuid.UUID,
        *,
        error_message: str,
        external_execution_id: str | None = None,
        duration_ms: int | None = None,
        retry_count: int | None = None,
        retrying: bool = False,
    ) -> WorkflowExecution:
        row = await self._get_execution(execution_id)
        if row.status == ExecutionStatus.FAILED and not retrying:
            return row
        finished = utcnow()
        row.status = ExecutionStatus.RETRYING if retrying else ExecutionStatus.FAILED
        row.finished_at = finished if not retrying else None
        row.error_message = error_message[:2000]
        if external_execution_id:
            row.external_execution_id = external_execution_id
        if duration_ms is not None:
            row.duration_ms = duration_ms
        if retry_count is not None:
            row.retry_count = retry_count

        workflow = await self._get_workflow(row.workflow_id)
        workflow.last_execution_at = finished
        if not retrying:
            workflow.failure_count = (workflow.failure_count or 0) + 1
        await self.db.flush()
        return row

    async def retry_execution(self, execution_id: uuid.UUID) -> WorkflowExecution:
        row = await self._get_execution(execution_id)
        if row.status not in (ExecutionStatus.FAILED, ExecutionStatus.RETRYING):
            raise ValidationAppError("Only failed executions can be retried")
        input_data = dict(row.input_json or {})
        event_id = input_data.get("eventId")
        workflow = await self._get_workflow(row.workflow_id)
        if not event_id:
            raise ValidationAppError("Missing eventId on execution input")
        # New idempotency key suffix for manual retry
        retry_event_id = f"{event_id}:retry:{row.retry_count + 1}"
        new_row, duplicate, _enabled = await self.start_execution(
            workflow_slug=workflow.slug,
            event_id=retry_event_id,
            lead_id=row.lead_id,
            input_data={**input_data, "retryOf": str(row.id)},
            correlation_id=input_data.get("correlationId"),
        )
        if duplicate:
            return new_row
        row.retry_count = (row.retry_count or 0) + 1
        await self.db.flush()
        return new_row

    async def _get_execution(self, execution_id: uuid.UUID) -> WorkflowExecution:
        result = await self.db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise NotFoundError("Workflow execution not found")
        return row

    async def _get_workflow(self, workflow_id: uuid.UUID) -> Workflow:
        result = await self.db.execute(select(Workflow).where(Workflow.id == workflow_id))
        workflow = result.scalar_one_or_none()
        if workflow is None:
            raise NotFoundError("Workflow not found")
        return workflow

    @staticmethod
    def workflow_slug_for_event_type(event_type: str) -> str | None:
        return workflow_slug_for_event(event_type)
