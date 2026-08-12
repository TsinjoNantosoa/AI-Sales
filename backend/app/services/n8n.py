"""n8n webhook client with HMAC signing and canonical event envelope."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import create_hmac_signature
from app.integrations.n8n_events import webhook_path_for_event

logger = get_logger(__name__)


class N8nClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _headers(self, body: str, event_id: str, event_type: str) -> dict[str, str]:
        timestamp = str(int(time.time()))
        signature = create_hmac_signature(self.settings.n8n_webhook_secret, body)
        headers = {
            "Content-Type": "application/json",
            "X-Signature": signature,
            "X-Webhook-Timestamp": timestamp,
            "X-Webhook-Signature": signature,
            "X-Event-ID": event_id,
            "X-Event-Type": event_type,
        }
        if self.settings.n8n_api_key:
            headers["X-N8N-API-KEY"] = self.settings.n8n_api_key
        return headers

    async def trigger_webhook(self, path: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        if not self.settings.n8n_enabled:
            logger.info("n8n_disabled_noop", path=path)
            return {"ok": True, "mocked": True}

        event_id = str(payload.get("eventId") or payload.get("event_id") or uuid.uuid4())
        event_type = str(payload.get("eventType") or payload.get("event_type") or "unknown")
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        url = f"{self.settings.n8n_base_url.rstrip('/')}/{path.lstrip('/')}"
        headers = self._headers(body, event_id, event_type)

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(url, content=body, headers=headers)
                    resp.raise_for_status()
                    if resp.content:
                        return resp.json()
                    return {"ok": True}
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
                last_error = exc
                retryable = isinstance(exc, (httpx.TimeoutException, httpx.NetworkError))
                if isinstance(exc, httpx.HTTPStatusError):
                    code = exc.response.status_code
                    retryable = code == 429 or code >= 500
                if not retryable or attempt >= 2:
                    break
                await self._sleep_backoff(attempt)
        raise RuntimeError(f"n8n webhook failed: {last_error}") from last_error

    @staticmethod
    async def _sleep_backoff(attempt: int) -> None:
        import asyncio

        await asyncio.sleep(0.5 * (2**attempt))

    async def send_event(self, event_type: str, envelope: dict[str, Any]) -> dict[str, Any] | None:
        path = webhook_path_for_event(event_type)
        if path is None:
            logger.info("n8n_send_event_no_webhook", event_type=event_type)
            return None
        return await self.trigger_webhook(path, envelope)

    async def health(self) -> dict[str, Any]:
        if not self.settings.n8n_enabled:
            return {"ok": True, "mocked": True}
        url = f"{self.settings.n8n_base_url.rstrip('/')}/healthz"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return {"ok": True, "status_code": resp.status_code}


n8n_client = N8nClient()
