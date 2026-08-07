"""In-app notification helper."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import NotificationCategory
from app.models.notification import Notification
from app.services.mappers import notification_to_out


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | str,
    title: str,
    message: str,
    category: str = NotificationCategory.SYSTEM,
    related_id: str | None = None,
    related_type: str | None = None,
) -> Notification:
    uid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
    row = Notification(
        user_id=uid,
        title=title,
        message=message,
        category=category,
        entity_id=related_id,
        entity_type=related_type,
    )
    db.add(row)
    await db.flush()
    return row


__all__ = ["create_notification", "notification_to_out"]
