"""Canonical automation event envelope."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.schemas.base import APIModel

EVENT_VERSION = "1.0"


class AutomationEventEnvelope(APIModel):
    version: str = EVENT_VERSION
    event_id: str = Field(alias="eventId")
    event_type: str = Field(alias="eventType")
    occurred_at: str = Field(alias="occurredAt")
    correlation_id: str | None = Field(default=None, alias="correlationId")
    source: str = "ai-sales-api"
    lead_id: str | None = Field(default=None, alias="leadId")
    conversation_id: str | None = Field(default=None, alias="conversationId")
    appointment_id: str | None = Field(default=None, alias="appointmentId")
    payload: dict[str, Any] = Field(default_factory=dict)

    def to_dispatch_dict(self) -> dict[str, Any]:
        return self.model_dump(by_alias=True)
