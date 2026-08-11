"""Deterministic qualification agent (AI_MOCK_MODE / fallback)."""

from __future__ import annotations

from app.agents.guardrails import (
    INJECTION_SAFE_REPLY_EN,
    INJECTION_SAFE_REPLY_FR,
    PRICING_SAFE_REPLY_EN,
    PRICING_SAFE_REPLY_FR,
    detect_language,
    is_prompt_injection,
    is_sql_or_data_exfil_attempt,
    sanitize_reply,
    should_refuse_price_invention,
)
from app.agents.intents import detect_intent, extract_fields
from app.agents.prompts import MOCK_REPLIES, MOCK_REPLIES_FR
from app.agents.result import AgentRunResult
from app.models.lead import Lead


def run_deterministic_agent(*, lead: Lead, user_message: str, fallback: bool = False) -> AgentRunResult:
    language = detect_language(user_message) or (lead.language or "en")
    if language not in {"en", "fr"}:
        language = "en"

    if is_prompt_injection(user_message) or is_sql_or_data_exfil_attempt(user_message):
        reply = INJECTION_SAFE_REPLY_FR if language == "fr" else INJECTION_SAFE_REPLY_EN
        return AgentRunResult(
            reply=sanitize_reply(reply),
            intent="unknown",
            language=language,
            confidence=1.0,
            requires_human=False,
            extracted_fields={},
            missing_fields=[],
            recommended_action="CONTINUE_QUALIFICATION",
            fallback_used=fallback,
            model="deterministic",
        )

    intent = detect_intent(user_message)
    extracted = extract_fields(user_message)

    requires_human = intent == "handoff"
    replies = MOCK_REPLIES_FR if language == "fr" else MOCK_REPLIES

    if intent == "pricing" or should_refuse_price_invention(user_message):
        reply = PRICING_SAFE_REPLY_FR if language == "fr" else PRICING_SAFE_REPLY_EN
    else:
        reply = str(replies.get(intent) or replies["unknown"])

    missing: list[str] = []
    if not (lead.service_interest or extracted.get("service_interest")):
        missing.append("serviceInterest")
    if lead.budget_max is None and extracted.get("budget_max") is None:
        missing.append("budget")
    if not (lead.timeline or extracted.get("timeline")):
        missing.append("timeline")
    if not (lead.company_size or extracted.get("company_size")):
        missing.append("companySize")
    if not (lead.decision_authority or extracted.get("decision_authority")):
        missing.append("decisionAuthority")

    recommended = "CONTINUE_QUALIFICATION"
    if requires_human:
        recommended = "HANDOFF"
    elif intent == "book_meeting":
        recommended = "BOOK_MEETING"
    elif not missing:
        recommended = "BOOK_MEETING"

    return AgentRunResult(
        reply=sanitize_reply(reply),
        intent=intent,
        language=language,
        confidence=0.55,
        requires_human=requires_human,
        extracted_fields=extracted,
        missing_fields=missing,
        recommended_action=recommended,
        fallback_used=fallback,
        model="deterministic",
    )
