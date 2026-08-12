"""Conversation memory helpers for the LangGraph agent.

Controlled memory = lead profile + rolling summary + last N messages.
Durable history lives in PostgreSQL; this module only shapes model context.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tools import lead_known_profile
from app.core.config import get_settings
from app.core.enums import MessageSender
from app.models.conversation import Conversation, Message
from app.models.lead import Lead

QUALIFICATION_FIELDS = (
    ("service_interest", "serviceInterest"),
    ("budget_max", "budget"),
    ("timeline", "timeline"),
    ("company_size", "companySize"),
    ("decision_authority", "decisionAuthority"),
)

# Absolute safety ceiling regardless of env misconfiguration
HISTORY_HARD_CAP = 50


def compute_known_and_missing(lead: Lead) -> tuple[list[str], list[str]]:
    known: list[str] = []
    missing: list[str] = []
    for attr, label in QUALIFICATION_FIELDS:
        value = getattr(lead, attr, None)
        if value is None or value == "":
            missing.append(label)
        else:
            known.append(label)
    return known, missing


def message_role(sender_type: str) -> str | None:
    if sender_type in {MessageSender.USER, MessageSender.LEAD, "user", "lead"}:
        return "user"
    if sender_type in {MessageSender.AI, MessageSender.AGENT, "ai", "agent"}:
        return "assistant"
    return None


async def load_conversation_history(
    db: AsyncSession,
    conversation: Conversation,
    *,
    limit: int | None = None,
) -> list[dict[str, str]]:
    """Load at most N recent messages for *this* conversation, chronological order."""
    settings = get_settings()
    configured = settings.ai_max_history_messages
    max_messages = limit if limit is not None else configured
    max_messages = max(0, min(int(max_messages), HISTORY_HARD_CAP))

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(max_messages)
    )
    rows = list(result.scalars().all())
    rows.reverse()

    history: list[dict[str, str]] = []
    for row in rows:
        role = message_role(str(row.sender_type))
        if not role or not (row.content or "").strip():
            continue
        history.append({"role": role, "content": row.content.strip()[:4000]})
    return history


async def count_conversation_messages(
    db: AsyncSession, conversation: Conversation
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == conversation.id)
    )
    return int(result.scalar_one() or 0)


def build_deterministic_summary(
    lead: Lead,
    *,
    missing_fields: list[str] | None = None,
    handoff: bool = False,
    handoff_reason: str | None = None,
) -> str:
    """Compact durable facts for long conversations — no LLM call."""
    parts: list[str] = []
    company = (lead.company_name or "").strip()
    if company:
        parts.append(f"Lead represents {company}.")
    if lead.service_interest:
        parts.append(f"Interested in {lead.service_interest}.")
    if lead.budget_min is not None or lead.budget_max is not None:
        lo = lead.budget_min
        hi = lead.budget_max
        if lo is not None and hi is not None:
            parts.append(f"Budget: ${lo:,.0f}–${hi:,.0f}.")
        elif hi is not None:
            parts.append(f"Budget: around ${hi:,.0f}.")
        elif lo is not None:
            parts.append(f"Budget: from ${lo:,.0f}.")
    if lead.timeline:
        parts.append(f"Timeline: {lead.timeline}.")
    if lead.company_size:
        parts.append(f"Company size: {lead.company_size}.")
    if lead.decision_authority:
        parts.append(f"Decision authority: {lead.decision_authority}.")
    if lead.need_description:
        parts.append(f"Need: {lead.need_description.strip()[:240]}")
    if missing_fields:
        parts.append(f"Still missing: {', '.join(missing_fields)}.")
    if handoff:
        reason = (handoff_reason or "human requested").strip()
        parts.append(f"Handoff context: {reason}.")
    return "\n".join(parts) if parts else ""


def maybe_update_conversation_summary(
    conversation: Conversation,
    lead: Lead,
    *,
    message_count: int,
    missing_fields: list[str] | None = None,
    force: bool = False,
    handoff: bool = False,
    handoff_reason: str | None = None,
) -> str | None:
    """
    Refresh Conversation.summary without an extra LLM call.

    Updates when forced (handoff / new fields), when summary is empty and we have
    facts, or when history exceeds the configured window (rolling summary needed).
    """
    settings = get_settings()
    if not settings.ai_summary_enabled:
        return conversation.summary

    summary = build_deterministic_summary(
        lead,
        missing_fields=missing_fields,
        handoff=handoff,
        handoff_reason=handoff_reason,
    )
    if not summary:
        return conversation.summary

    threshold = max(settings.ai_max_history_messages, 1)
    should_write = (
        force
        or handoff
        or not (conversation.summary or "").strip()
        or message_count > threshold
        or summary != (conversation.summary or "").strip()
    )
    if should_write:
        conversation.summary = summary
    return conversation.summary


def build_model_input(
    *,
    lead: Lead,
    user_message: str,
    history: list[dict[str, str]],
    known_fields: list[str],
    missing_fields: list[str],
    conversation_summary: str | None = None,
) -> list[dict[str, Any]]:
    """Assemble OpenAI input: history turns + one context+current user message."""
    settings = get_settings()
    profile = lead_known_profile(lead)
    summary = (conversation_summary or "").strip() or None
    if summary and settings.ai_context_max_chars > 0:
        summary = summary[: settings.ai_context_max_chars]

    context = {
        "leadProfile": profile,
        "conversationSummary": summary,
        "alreadyKnownFields": known_fields,
        "missingFields": missing_fields,
        "instruction": (
            "Use the conversation history and summary. Do not re-ask known fields. "
            "Ask at most one useful question. Reply in the prospect language."
        ),
    }
    payload: list[dict[str, Any]] = []
    current = user_message.strip()
    for item in history:
        # Avoid duplicating the exact current user turn if already flushed to DB
        if item["role"] == "user" and item["content"] == current:
            continue
        payload.append(item)
    payload.append(
        {
            "role": "user",
            "content": (
                f"Context JSON:\n{context}\n\n"
                f"Current user message:\n{user_message}"
            ),
        }
    )
    return payload
