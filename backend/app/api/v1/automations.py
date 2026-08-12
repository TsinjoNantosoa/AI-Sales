"""Automation / workflow routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.dashboard import WorkflowExecutionOut, WorkflowOut
from app.services.automation import AutomationService

router = APIRouter(prefix="/automations", tags=["automations"])


@router.get("/workflows", response_model=list[WorkflowOut])
async def list_workflows(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[WorkflowOut]:
    return await AutomationService(db).list_workflows(current_user)


@router.get("/executions", response_model=list[WorkflowExecutionOut])
async def list_executions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    leadId: str | None = Query(default=None),
) -> list[WorkflowExecutionOut]:
    return await AutomationService(db).list_executions(current_user, leadId)


@router.post("/workflows/{workflow_id}/toggle", response_model=WorkflowOut)
async def toggle_workflow(
    workflow_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> WorkflowOut:
    return await AutomationService(db).toggle(workflow_id, current_user)


@router.post("/workflows/{workflow_id}/test", response_model=WorkflowExecutionOut)
async def test_workflow(
    workflow_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> WorkflowExecutionOut:
    return await AutomationService(db).test(workflow_id, current_user)


@router.post("/executions/{execution_id}/retry", response_model=WorkflowExecutionOut)
async def retry_execution(
    execution_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> WorkflowExecutionOut:
    return await AutomationService(db).retry_execution(execution_id, current_user)
