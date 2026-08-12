"""LangGraph agent state for the qualification pipeline."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


class AgentGraphState(TypedDict, total=False):
    # Inputs (runtime objects kept in-process — not cross-process serialized)
    db: Any
    conversation: Any
    lead: Any
    user_message: str
    trace_id: str

    # Validation / safety
    language: str
    blocked: bool
    block_reason: str | None
    use_openai: bool

    # Context / memory
    history_messages: list[dict[str, str]]
    lead_profile: dict[str, Any]
    known_fields: list[str]
    missing_fields: list[str]
    conversation_summary: str | None
    message_count: int

    # Model output
    intent: str | None
    confidence: float | None
    requires_human: bool
    handoff_reason: str | None
    recommended_action: str | None
    extracted_fields: dict[str, Any]
    reply: str

    # Telemetry
    fallback_used: bool
    model: str | None
    response_id: str | None
    latency_ms: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    retry_count: int

    # Routing helpers
    handoff_created: bool
    fields_applied: bool
    error: str | None
    phase: Literal[
        "validate",
        "safety",
        "context",
        "model",
        "apply",
        "score",
        "handoff",
        "persist",
        "done",
    ]
