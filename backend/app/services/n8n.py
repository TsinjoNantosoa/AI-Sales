"""n8n webhook client with HMAC signing."""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import create_hmac_signature

logger = get_logger(__name__)


class N8nClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def trigger_webhook(self, path: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        if not self.settings.n8n_enabled:
            logger.info("n8n_disabled_noop", path=path)
            return {"ok": True, "mocked": True}

        body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        signature = create_hmac_signature(self.settings.n8n_webhook_secret, body)
        url = f"{self.settings.n8n_base_url.rstrip('/')}/{path.lstrip('/')}"
        headers = {
            "Content-Type": "application/json",
            "X-Signature": signature,
        }
        if self.settings.n8n_api_key:
            headers["X-N8N-API-KEY"] = self.settings.n8n_api_key

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, content=body, headers=headers)
            resp.raise_for_status()
            if resp.content:
                return resp.json()
            return {"ok": True}

    async def notify_lead_created(self, lead: dict[str, Any]) -> None:
        await self.trigger_webhook("webhook/lead-created", {"event": "lead.created", "lead": lead})

    async def notify_meeting_booked(self, appointment: dict[str, Any]) -> None:
        await self.trigger_webhook(
            "webhook/meeting-booked",
            {"event": "appointment.created", "appointment": appointment},
        )


n8n_client = N8nClient()
