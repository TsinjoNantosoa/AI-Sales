"""Agent conversation state."""

from __future__ import annotations

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    messages: list[dict[str, str]]
    lead_id: str
    conversation_id: str
    intent: str
    extracted: dict[str, Any]
    reply: str
    handoff: bool
    user_message: str
