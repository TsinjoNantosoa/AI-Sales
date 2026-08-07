"""Settings routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.dashboard import AppSettingsOut, AppSettingsPatch
from app.services.settings import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=AppSettingsOut)
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AppSettingsOut:
    return await SettingsService(db).get_settings(current_user)


@router.patch("", response_model=AppSettingsOut)
async def patch_settings(
    body: AppSettingsPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AppSettingsOut:
    return await SettingsService(db).patch_settings(body, current_user)
