"""Dashboard routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.dashboard import DashboardOverview, LeadTrendPoint, PipelineStage, SourceData
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
async def overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> DashboardOverview:
    return await DashboardService(db).overview(current_user)


@router.get("/conversions", response_model=list[LeadTrendPoint])
async def conversions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[LeadTrendPoint]:
    return await DashboardService(db).conversions(current_user)


@router.get("/pipeline", response_model=list[PipelineStage])
async def pipeline(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[PipelineStage]:
    return await DashboardService(db).pipeline(current_user)


@router.get("/sources", response_model=list[SourceData])
async def sources(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[SourceData]:
    return await DashboardService(db).sources(current_user)
