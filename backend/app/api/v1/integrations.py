"""Integration routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.dashboard import IntegrationConfigure, IntegrationOut, TestConnectionResponse
from app.services.integration import IntegrationService

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationOut])
async def list_integrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[IntegrationOut]:
    return await IntegrationService(db).list_integrations(current_user)


@router.post("/{integration_id}/connect", response_model=IntegrationOut)
async def connect(
    integration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> IntegrationOut:
    return await IntegrationService(db).connect(integration_id, current_user)


@router.post("/{integration_id}/disconnect", response_model=IntegrationOut)
async def disconnect(
    integration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> IntegrationOut:
    return await IntegrationService(db).disconnect(integration_id, current_user)


@router.post("/{integration_id}/test", response_model=TestConnectionResponse)
async def test(
    integration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> TestConnectionResponse:
    return await IntegrationService(db).test(integration_id, current_user)


@router.post("/{integration_id}/sync", response_model=IntegrationOut)
async def sync(
    integration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> IntegrationOut:
    return await IntegrationService(db).sync(integration_id, current_user)


@router.patch("/{integration_id}", response_model=IntegrationOut)
async def configure(
    integration_id: uuid.UUID,
    body: IntegrationConfigure,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> IntegrationOut:
    return await IntegrationService(db).configure(integration_id, current_user, body.config)
