"""Internal (service-to-service) endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.core.config import get_settings
from app.core.exceptions import AuthenticationError
from app.core.rate_limit import check_rate_limit
from app.schemas.base import APIModel
from app.services.follow_up import FollowUpService

router = APIRouter(prefix="/internal", tags=["internal"])


class FollowUpProcessResponse(APIModel):
    processed: int


def _require_internal_key(x_internal_key: str | None) -> None:
    settings = get_settings()
    if not x_internal_key or x_internal_key != settings.internal_api_key:
        raise AuthenticationError("Invalid internal API key")


@router.post("/follow-ups/process", response_model=FollowUpProcessResponse)
async def process_follow_ups(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_internal_key: Annotated[str | None, Header(alias="X-Internal-Key")] = None,
) -> FollowUpProcessResponse:
    await check_rate_limit(request, key_suffix="internal.follow_ups", limit="10/minute")
    _require_internal_key(x_internal_key)
    count = await FollowUpService(db).process()
    return FollowUpProcessResponse(processed=count)
