"""Analytics route."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.dashboard import AnalyticsData
from app.services.dashboard import DashboardService

router = APIRouter(tags=["analytics"])


@router.get("/analytics", response_model=AnalyticsData)
async def analytics(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AnalyticsData:
    return await DashboardService(db).analytics(current_user)
