"""Public (unauthenticated) endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.core.rate_limit import check_rate_limit
from app.schemas.lead import LeadCreate, LeadOut
from app.services.lead import LeadService

router = APIRouter(prefix="/public", tags=["public"])


@router.post("/leads", response_model=LeadOut)
async def public_create_lead(
    body: LeadCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LeadOut:
    await check_rate_limit(request, key_suffix="public.leads", limit="30/minute")
    return await LeadService(db).create_lead(body, user=None, public=True)
