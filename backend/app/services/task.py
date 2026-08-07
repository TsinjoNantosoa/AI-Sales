"""Task service."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser
from app.core.enums import ActivityType, TaskStatus
from app.core.exceptions import NotFoundError
from app.core.permissions import can_access_all_leads, ensure_permission
from app.models.task import Task
from app.models.user import User
from app.schemas.common import TaskCreate, TaskOut, TaskUpdate
from app.services.activity import create_activity
from app.services.mappers import task_to_out
from app.utils import utcnow


class TaskService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get(self, task_id: uuid.UUID) -> Task:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise NotFoundError("Task not found")
        return task

    def _assert_access(self, task: Task, user: CurrentUser) -> None:
        if can_access_all_leads(user.role):
            return
        if str(task.assigned_user_id) != user.id:
            raise NotFoundError("Task not found")

    async def list_tasks(self, user: CurrentUser) -> list[TaskOut]:
        ensure_permission(user.role, "tasks:read")
        q = select(Task).where(Task.deleted_at.is_(None)).order_by(Task.due_at.asc())
        if not can_access_all_leads(user.role):
            q = q.where(Task.assigned_user_id == user.uuid)
        result = await self.db.execute(q)
        return [task_to_out(t) for t in result.scalars().all()]

    async def get_task(self, task_id: uuid.UUID, user: CurrentUser) -> TaskOut:
        ensure_permission(user.role, "tasks:read")
        task = await self._get(task_id)
        self._assert_access(task, user)
        return task_to_out(task)

    async def create(self, data: TaskCreate, user: CurrentUser) -> TaskOut:
        ensure_permission(user.role, "tasks:write")
        due = datetime.fromisoformat(data.due_date.replace("Z", "+00:00"))
        name = data.assigned_user_name
        if not name:
            ures = await self.db.execute(select(User).where(User.id == uuid.UUID(data.assigned_user_id)))
            u = ures.scalar_one_or_none()
            if u:
                name = f"{u.first_name} {u.last_name}"
        task = Task(
            title=data.title,
            description=data.description,
            lead_id=uuid.UUID(data.lead_id) if data.lead_id else None,
            lead_name=data.lead_name,
            assigned_user_id=uuid.UUID(data.assigned_user_id),
            assigned_user_name=name or "",
            created_by_user_id=user.uuid,
            priority=data.priority,
            status=data.status or TaskStatus.TODO,
            due_at=due,
        )
        self.db.add(task)
        if data.lead_id:
            await create_activity(
                self.db,
                lead_id=data.lead_id,
                lead_name=data.lead_name or "",
                type=ActivityType.TASK,
                description=f"Task created: {data.title}",
                user_id=user.id,
                user_name=user.full_name,
            )
        await self.db.flush()
        return task_to_out(task)

    async def update(self, task_id: uuid.UUID, data: TaskUpdate, user: CurrentUser) -> TaskOut:
        ensure_permission(user.role, "tasks:write")
        task = await self._get(task_id)
        self._assert_access(task, user)
        payload = data.model_dump(exclude_unset=True)
        if "due_date" in payload and payload["due_date"]:
            task.due_at = datetime.fromisoformat(payload.pop("due_date").replace("Z", "+00:00"))
        if "lead_id" in payload:
            lid = payload.pop("lead_id")
            task.lead_id = uuid.UUID(lid) if lid else None
        if "assigned_user_id" in payload and payload["assigned_user_id"]:
            task.assigned_user_id = uuid.UUID(payload.pop("assigned_user_id"))
        for k, v in payload.items():
            setattr(task, k, v)
        await self.db.flush()
        return task_to_out(task)

    async def delete(self, task_id: uuid.UUID, user: CurrentUser) -> None:
        ensure_permission(user.role, "tasks:write")
        task = await self._get(task_id)
        self._assert_access(task, user)
        task.deleted_at = utcnow()
        await self.db.flush()

    async def complete(self, task_id: uuid.UUID, user: CurrentUser) -> TaskOut:
        ensure_permission(user.role, "tasks:write")
        task = await self._get(task_id)
        self._assert_access(task, user)
        task.status = TaskStatus.COMPLETED
        task.completed_at = utcnow()
        await self.db.flush()
        return task_to_out(task)
