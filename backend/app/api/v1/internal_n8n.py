"""n8n → FastAPI internal endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.api.v1.internal import _require_internal_key
from app.core.rate_limit import check_rate_limit
from app.schemas.n8n_internal import (
    ExecutionActionResponse,
    ExecutionFailureRequest,
    ExecutionStartRequest,
    ExecutionStartResponse,
    ExecutionSuccessRequest,
    FailureReportRequest,
    FollowUpExecuteRequest,
    IdempotentActionResponse,
)
from app.services.n8n_execution import N8nExecutionService
from app.services.n8n_internal import N8nInternalService
from app.utils import utcnow

router = APIRouter(prefix="/internal/n8n", tags=["internal-n8n"])


def _internal_dep(
    x_internal_key: Annotated[str | None, Header(alias="X-Internal-Key")] = None,
) -> None:
    _require_internal_key(x_internal_key)


@router.post("/executions/start", response_model=ExecutionStartResponse)
async def start_execution(
    body: ExecutionStartRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> ExecutionStartResponse:
    lead_uuid = uuid.UUID(body.lead_id) if body.lead_id else None
    row, duplicate, enabled = await N8nExecutionService(db).start_execution(
        workflow_slug=body.workflow_slug,
        event_id=body.event_id,
        external_execution_id=body.external_execution_id,
        lead_id=lead_uuid,
        input_data=body.input,
        correlation_id=body.correlation_id,
        started_at=body.started_at,
    )
    return ExecutionStartResponse(
        executionId=str(row.id),
        duplicate=duplicate,
        workflowEnabled=enabled,
    )


@router.post("/executions/{execution_id}/success", response_model=ExecutionActionResponse)
async def execution_success(
    execution_id: uuid.UUID,
    body: ExecutionSuccessRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> ExecutionActionResponse:
    row = await N8nExecutionService(db).mark_success(
        execution_id,
        external_execution_id=body.external_execution_id,
        duration_ms=body.duration_ms,
        output=body.output,
        retry_count=body.retry_count,
    )
    return ExecutionActionResponse(executionId=str(row.id), status=row.status)


@router.post("/executions/{execution_id}/failure", response_model=ExecutionActionResponse)
async def execution_failure(
    execution_id: uuid.UUID,
    body: ExecutionFailureRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> ExecutionActionResponse:
    row = await N8nExecutionService(db).mark_failure(
        execution_id,
        error_message=body.error_message,
        external_execution_id=body.external_execution_id,
        duration_ms=body.duration_ms,
        retry_count=body.retry_count,
        retrying=body.retrying,
    )
    return ExecutionActionResponse(executionId=str(row.id), status=row.status)


@router.get("/leads/{lead_id}/context")
async def lead_context(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> dict[str, Any]:
    return await N8nInternalService(db).get_lead_context(lead_id)


@router.get("/leads/{lead_id}/hot-check")
async def lead_hot_check(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> dict[str, Any]:
    svc = N8nInternalService(db)
    ctx = await svc.get_lead_context(lead_id)
    return {"isHot": ctx["isHot"], "score": ctx["score"], "hotThreshold": ctx["hotThreshold"]}


@router.post("/leads/{lead_id}/welcome", response_model=IdempotentActionResponse)
async def lead_welcome(
    lead_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
    event_id: str | None = None,
) -> IdempotentActionResponse:
    await check_rate_limit(request, key_suffix="n8n.welcome", limit="60/minute")
    result = await N8nInternalService(db).send_welcome_email(lead_id, event_id=event_id)
    return IdempotentActionResponse(
        sent=result.get("sent"),
        duplicate=bool(result.get("duplicate")),
        details=result,
    )


@router.post("/leads/{lead_id}/hot-lead-actions", response_model=IdempotentActionResponse)
async def hot_lead_actions(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
    event_id: str | None = None,
) -> IdempotentActionResponse:
    result = await N8nInternalService(db).hot_lead_actions(lead_id, event_id=event_id)
    return IdempotentActionResponse(
        duplicate=bool(result.get("duplicate")),
        skipped=bool(result.get("skipped")),
        reason=result.get("reason"),
        details=result,
    )


@router.get("/follow-ups/due")
async def follow_ups_due(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
    limit: int = 50,
) -> list[dict[str, Any]]:
    return await N8nInternalService(db).list_due_follow_ups(limit=limit)


@router.post("/follow-ups/{lead_id}/execute", response_model=IdempotentActionResponse)
async def follow_up_execute(
    lead_id: uuid.UUID,
    body: FollowUpExecuteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> IdempotentActionResponse:
    result = await N8nInternalService(db).execute_follow_up(
        lead_id, idempotency_key=body.idempotency_key
    )
    return IdempotentActionResponse(
        sent=result.get("sent"),
        duplicate=bool(result.get("duplicate")),
        details=result,
    )


@router.get("/appointments/reminders/due")
async def reminders_due(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
    within_minutes: int = 60,
) -> list[dict[str, Any]]:
    return await N8nInternalService(db).list_reminder_candidates(within_minutes=within_minutes)


@router.post("/appointments/{appointment_id}/send-reminder", response_model=IdempotentActionResponse)
async def send_reminder(
    appointment_id: uuid.UUID,
    body: FollowUpExecuteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> IdempotentActionResponse:
    result = await N8nInternalService(db).send_appointment_reminder(
        appointment_id, idempotency_key=body.idempotency_key
    )
    return IdempotentActionResponse(
        sent=result.get("sent"),
        duplicate=bool(result.get("duplicate")),
        details=result,
    )


@router.post("/appointments/{appointment_id}/sync-calendar")
async def sync_calendar(
    appointment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> dict[str, Any]:
    return await N8nInternalService(db).sync_appointment_calendar(appointment_id)


@router.post("/appointments/{appointment_id}/booking-actions", response_model=IdempotentActionResponse)
async def appointment_booking_actions(
    appointment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
    event_id: str | None = None,
) -> IdempotentActionResponse:
    result = await N8nInternalService(db).appointment_booking_actions(
        appointment_id, event_id=event_id
    )
    return IdempotentActionResponse(details=result)


@router.post("/executions/failure-report", response_model=ExecutionActionResponse)
async def failure_report(
    body: FailureReportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(_internal_dep)],
) -> ExecutionActionResponse:
    from sqlalchemy import select

    from app.core.enums import ExecutionStatus
    from app.models.workflow import Workflow, WorkflowExecution

    workflow_name = str(body.workflow.get("name") or "")
    slug = workflow_name.replace("AI Sales — ", "").lower().replace(" ", "-")
    wf = (
        await db.execute(select(Workflow).where(Workflow.slug.contains(slug.split("-")[0])))
    ).scalar_one_or_none()
    if wf is None:
        wf = (await db.execute(select(Workflow).limit(1))).scalar_one_or_none()
    if wf is None:
        return ExecutionActionResponse(executionId="none", status=ExecutionStatus.FAILED)
    row = WorkflowExecution(
        workflow_id=wf.id,
        status=ExecutionStatus.FAILED,
        error_message=body.error_message[:2000],
        external_execution_id=body.external_execution_id,
        input_json={"workflow": body.workflow, "execution": body.execution},
    )
    db.add(row)
    wf.failure_count = (wf.failure_count or 0) + 1
    wf.last_execution_at = utcnow()
    await db.flush()
    return ExecutionActionResponse(executionId=str(row.id), status=row.status)
