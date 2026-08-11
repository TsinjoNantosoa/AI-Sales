"""Agent run result + metadata persisted on assistant messages."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class AgentRunResult:
    reply: str
    intent: str | None = None
    language: str | None = None
    confidence: float | None = None
    requires_human: bool = False
    extracted_fields: dict[str, Any] = field(default_factory=dict)
    missing_fields: list[str] = field(default_factory=list)
    recommended_action: str | None = None
    fallback_used: bool = False
    model: str | None = None
    response_id: str | None = None
    latency_ms: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None

    def message_metadata(self) -> dict[str, Any]:
        return {
            "fallbackUsed": self.fallback_used,
            "confidence": self.confidence,
            "language": self.language,
            "missingFields": self.missing_fields,
            "recommendedAction": self.recommended_action,
            "openaiResponseId": self.response_id,
            "latencyMs": self.latency_ms,
            "extractedFields": self.extracted_fields,
        }

    def as_log_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("reply", None)
        return data
