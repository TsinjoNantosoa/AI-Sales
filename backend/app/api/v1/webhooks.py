"""Webhook endpoints (n8n)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.core.config import get_settings
from app.core.exceptions import AuthenticationError
from app.core.security import verify_hmac_signature
from app.services.n8n import n8n_client

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/n8n")
async def n8n_inbound(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_signature: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    settings = get_settings()
    body = await request.body()
    if settings.n8n_enabled:
        if not x_signature or not verify_hmac_signature(
            settings.n8n_webhook_secret, body.decode("utf-8"), x_signature
        ):
            raise AuthenticationError("Invalid webhook signature")
    payload = await request.json()
    return {"ok": True, "received": payload.get("event") or "unknown"}


@router.post("/n8n/trigger/{event}")
async def n8n_trigger(event: str, payload: dict[str, Any]) -> dict[str, Any]:
    result = await n8n_client.trigger_webhook(f"webhook/{event}", payload)
    return result or {"ok": True}
