"""Task routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.common import TaskCreate, TaskOut, TaskUpdate
from app.services.task import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[TaskOut]:
    return await TaskService(db).list_tasks(current_user)


@router.post("", response_model=TaskOut)
async def create_task(
    body: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> TaskOut:
    return await TaskService(db).create(body, current_user)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> TaskOut:
    return await TaskService(db).get_task(task_id, current_user)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> TaskOut:
    return await TaskService(db).update(task_id, body, current_user)


@router.delete("/{task_id}")
async def delete_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await TaskService(db).delete(task_id, current_user)
    return {"message": "ok"}


@router.post("/{task_id}/complete", response_model=TaskOut)
async def complete_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> TaskOut:
    return await TaskService(db).complete(task_id, current_user)
