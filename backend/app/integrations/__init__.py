"""Google Calendar / Gmail / OpenAI integration stubs (mock mode)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class GoogleCalendarClient:
    async def list_events(self, calendar_id: str = "primary") -> list[dict[str, Any]]:
        settings = get_settings()
        if settings.google_calendar_mock_mode or not settings.google_client_id:
            logger.info("google_calendar_mock_list")
            return []
        return []

    async def create_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        settings = get_settings()
        if settings.google_calendar_mock_mode or not settings.google_client_id:
            return {"id": "mock-event", **payload}
        return {"id": "mock-event", **payload}


class GmailClient:
    async def send(self, to: str, subject: str, body: str) -> dict[str, Any]:
        settings = get_settings()
        if settings.email_mock_mode:
            logger.info("gmail_mock_send", to=to, subject=subject)
            return {"ok": True, "mocked": True}
        return {"ok": True}


class OpenAIClient:
    """Thin wrapper kept for integrations UI; agent path uses agents.openai_provider."""

    async def chat(self, messages: list[dict[str, str]]) -> str:
        settings = get_settings()
        if settings.ai_mock_mode or not settings.openai_api_key:
            return "Thanks for your message. Let me continue your qualification."
        # Prefer the structured agent for real conversations.
        return "Thanks for your message. Please continue in the qualification chat."
