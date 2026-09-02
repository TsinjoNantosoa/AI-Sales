"""Webhook endpoints (n8n)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, ValidationAppError
from app.core.internal_auth import require_internal_api_key
from app.core.security import verify_hmac_signature
from app.integrations.n8n_events import EVENT_WEBHOOK_PATHS
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
async def n8n_trigger(
    event: str,
    payload: dict[str, Any],
    x_internal_key: Annotated[str | None, Header(alias="X-Internal-Key")] = None,
) -> dict[str, Any]:
    """Internal-only relay to n8n webhooks (service-to-service)."""
    require_internal_api_key(x_internal_key)
    allowed = {path.removeprefix("webhook/") for path in EVENT_WEBHOOK_PATHS.values()}
    if event not in allowed:
        raise ValidationAppError(f"Unknown n8n trigger event: {event}")
    result = await n8n_client.trigger_webhook(f"webhook/{event}", payload)
    return result or {"ok": True}
