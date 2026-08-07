"""Deterministic mock agent graph (AI_MOCK_MODE)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.guardrails import PRICING_SAFE_REPLY, sanitize_reply, should_refuse_price_invention
from app.agents.intents import detect_intent, extract_fields
from app.agents.prompts import MOCK_REPLIES
from app.agents.tools import tool_rescore_lead, tool_update_lead_fields
from app.core.config import get_settings
from app.core.enums import ConversationStatus
from app.models.conversation import Conversation
from app.models.lead import Lead


async def run_agent(
    db: AsyncSession,
    *,
    conversation: Conversation,
    lead: Lead,
    user_message: str,
) -> str:
    settings = get_settings()
    intent = detect_intent(user_message)
    extracted = extract_fields(user_message)

    if extracted:
        await tool_update_lead_fields(db, lead, extracted)
        await tool_rescore_lead(db, lead)

    if intent == "handoff" or should_refuse_price_invention(user_message) and "human" in user_message.lower():
        conversation.human_handoff_requested = True
        conversation.status = ConversationStatus.HUMAN_HANDOFF

    reply: str
    if intent == "pricing" or should_refuse_price_invention(user_message):
        reply = PRICING_SAFE_REPLY
    else:
        reply = str(MOCK_REPLIES.get(intent) or MOCK_REPLIES["unknown"])

    if not settings.ai_mock_mode and settings.openai_api_key:
        # Real LLM path reserved; fall back to mock for reliability
        pass

    return sanitize_reply(reply)
