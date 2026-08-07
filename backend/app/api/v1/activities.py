"""Activity feed routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.dashboard import ActivityOut
from app.services.dashboard import DashboardService

router = APIRouter(tags=["activities"])


@router.get("/activities", response_model=list[ActivityOut])
async def activities(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    leadId: str | None = Query(default=None),
) -> list[ActivityOut]:
    return await DashboardService(db).activities(leadId)
