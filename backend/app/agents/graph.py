"""LangGraph-style agent orchestration: OpenAI real path + deterministic fallback."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.deterministic import run_deterministic_agent
from app.agents.guardrails import (
    INJECTION_SAFE_REPLY_EN,
    INJECTION_SAFE_REPLY_FR,
    detect_language,
    is_prompt_injection,
    is_sql_or_data_exfil_attempt,
    sanitize_reply,
)
from app.agents.openai_provider import OpenAIProviderError, call_openai_structured
from app.agents.result import AgentRunResult
from app.agents.tools import tool_rescore_lead, tool_update_lead_fields
from app.core.config import get_settings
from app.core.enums import ConversationStatus
from app.core.logging import get_logger
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.utils import utcnow

logger = get_logger(__name__)


async def _apply_side_effects(
    db: AsyncSession,
    *,
    conversation: Conversation,
    lead: Lead,
    result: AgentRunResult,
) -> AgentRunResult:
    if result.extracted_fields:
        await tool_update_lead_fields(db, lead, result.extracted_fields)
        await tool_rescore_lead(db, lead)

    if result.requires_human or result.intent == "handoff":
        conversation.human_handoff_requested = True
        conversation.human_handoff_at = utcnow()
        conversation.status = ConversationStatus.HUMAN_HANDOFF

    lead.last_interaction_at = utcnow()
    conversation.updated_at = utcnow()
    result.reply = sanitize_reply(result.reply)
    return result


async def run_agent(
    db: AsyncSession,
    *,
    conversation: Conversation,
    lead: Lead,
    user_message: str,
) -> AgentRunResult:
    """
    Entry point used by ConversationService / PublicFlowService.

    - AI_MOCK_MODE=true  → deterministic engine
    - AI_MOCK_MODE=false → OpenAI Responses API (structured), fallback on failure
    """
    settings = get_settings()
    language = detect_language(user_message)

    # Hard guard before any model call
    if is_prompt_injection(user_message) or is_sql_or_data_exfil_attempt(user_message):
        reply = INJECTION_SAFE_REPLY_FR if language == "fr" else INJECTION_SAFE_REPLY_EN
        result = AgentRunResult(
            reply=reply,
            intent="unknown",
            language=language,
            confidence=1.0,
            requires_human=False,
            extracted_fields={},
            missing_fields=[],
            recommended_action="CONTINUE_QUALIFICATION",
            fallback_used=False,
            model="guardrail",
        )
        return await _apply_side_effects(db, conversation=conversation, lead=lead, result=result)

    use_openai = (not settings.ai_mock_mode) and bool(settings.openai_api_key) and settings.ai_enabled

    if not use_openai:
        result = run_deterministic_agent(lead=lead, user_message=user_message, fallback=False)
        logger.info("agent_deterministic", intent=result.intent, language=result.language)
        return await _apply_side_effects(db, conversation=conversation, lead=lead, result=result)

    try:
        result = await call_openai_structured(lead=lead, user_message=user_message)
        logger.info(
            "agent_openai_ok",
            model=result.model,
            response_id=result.response_id,
            tokens=result.total_tokens,
            confidence=result.confidence,
            latency_ms=result.latency_ms,
        )
        return await _apply_side_effects(db, conversation=conversation, lead=lead, result=result)
    except OpenAIProviderError as exc:
        logger.warning("agent_openai_fallback", reason=str(exc)[:300])
        result = run_deterministic_agent(lead=lead, user_message=user_message, fallback=True)
        return await _apply_side_effects(db, conversation=conversation, lead=lead, result=result)
