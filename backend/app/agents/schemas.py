"""Structured output schema for the sales qualification agent."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ExtractedLeadFields(BaseModel):
    """Fields the LLM may propose; never includes score/temperature/status."""

    model_config = ConfigDict(extra="forbid")

    service_interest: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    timeline: str | None = None
    company_size: str | None = None
    decision_authority: str | None = None
    need_description: str | None = None
    phone: str | None = None
    preferred_contact_channel: str | None = None


class AgentStructuredOutput(BaseModel):
    """Validated OpenAI structured output (Responses API)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    intent: Literal[
        "greeting",
        "pricing",
        "book_meeting",
        "qualification",
        "handoff",
        "faq",
        "goodbye",
        "unknown",
    ]
    language: Literal["en", "fr"]
    extracted_fields: ExtractedLeadFields = Field(alias="extractedFields")
    missing_fields: list[str] = Field(default_factory=list, alias="missingFields")
    recommended_action: str = Field(alias="recommendedAction")
    requires_human: bool = Field(alias="requiresHuman")
    confidence: float = Field(ge=0.0, le=1.0)
    response: str
