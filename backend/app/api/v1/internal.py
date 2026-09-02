"""Internal (service-to-service) endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.core.internal_auth import require_internal_api_key
from app.core.rate_limit import check_rate_limit
from app.schemas.base import APIModel
from app.services.follow_up import FollowUpService

router = APIRouter(prefix="/internal", tags=["internal"])


class FollowUpProcessResponse(APIModel):
    processed: int


@router.post("/follow-ups/process", response_model=FollowUpProcessResponse)
async def process_follow_ups(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_internal_key: Annotated[str | None, Header(alias="X-Internal-Key")] = None,
) -> FollowUpProcessResponse:
    await check_rate_limit(request, key_suffix="internal.follow_ups", limit="10/minute")
    require_internal_api_key(x_internal_key)
    count = await FollowUpService(db).process()
    return FollowUpProcessResponse(processed=count)
