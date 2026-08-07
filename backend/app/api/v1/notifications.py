"""Notification routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.core.exceptions import NotFoundError
from app.models.notification import Notification
from app.schemas.common import NotificationCreate, NotificationOut
from app.services.mappers import notification_to_out
from app.services.notification import create_notification
from app.utils import utcnow

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[NotificationOut]:
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == current_user.uuid,
            Notification.deleted_at.is_(None),
        )
        .order_by(Notification.created_at.desc())
    )
    return [notification_to_out(n) for n in result.scalars().all()]


@router.post("", response_model=NotificationOut)
async def create_notif(
    body: NotificationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> NotificationOut:
    uid = body.user_id or current_user.id
    n = await create_notification(
        db,
        user_id=uid,
        title=body.title,
        message=body.message,
        category=body.category,
        related_id=body.related_id,
        related_type=body.related_type,
    )
    return notification_to_out(n)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> NotificationOut:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.uuid,
        )
    )
    n = result.scalar_one_or_none()
    if n is None:
        raise NotFoundError("Notification not found")
    n.read_at = utcnow()
    await db.flush()
    return notification_to_out(n)


@router.post("/read-all")
async def mark_all_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.uuid,
            Notification.read_at.is_(None),
            Notification.deleted_at.is_(None),
        )
    )
    now = utcnow()
    for n in result.scalars().all():
        n.read_at = now
    await db.flush()
    return {"message": "ok"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.uuid,
        )
    )
    n = result.scalar_one_or_none()
    if n is None:
        raise NotFoundError("Notification not found")
    n.deleted_at = utcnow()
    await db.flush()
    return {"message": "ok"}
