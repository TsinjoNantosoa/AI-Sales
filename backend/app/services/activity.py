"""Activity feed helper."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ActivityType
from app.models.activity import Activity
from app.schemas.dashboard import ActivityOut
from app.utils import to_iso


async def create_activity(
    db: AsyncSession,
    *,
    lead_id: uuid.UUID | str,
    lead_name: str = "",
    type: str = ActivityType.CREATED,
    description: str = "",
    title: str = "",
    user_id: uuid.UUID | str | None = None,
    user_name: str | None = None,
    metadata: dict | None = None,
) -> Activity:
    lid = uuid.UUID(str(lead_id)) if not isinstance(lead_id, uuid.UUID) else lead_id
    uid = None
    if user_id is not None:
        uid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
    row = Activity(
        lead_id=lid,
        lead_name=lead_name,
        user_id=uid,
        user_name=user_name,
        type=type,
        title=title or description[:255],
        description=description,
        metadata_json=metadata,
    )
    db.add(row)
    await db.flush()
    return row


def activity_to_out(row: Activity) -> ActivityOut:
    return ActivityOut(
        id=str(row.id),
        lead_id=str(row.lead_id),
        lead_name=row.lead_name or "",
        type=row.type,
        description=row.description or "",
        user_id=str(row.user_id) if row.user_id else None,
        user_name=row.user_name,
        created_at=to_iso(row.created_at) or "",
    )
