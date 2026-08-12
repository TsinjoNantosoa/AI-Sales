"""Real LangGraph StateGraph orchestration for the sales qualification agent."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from langgraph.graph import END, START, StateGraph
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
from app.agents.handoff import request_human_handoff
from app.agents.memory import (
    build_model_input,
    compute_known_and_missing,
    count_conversation_messages,
    load_conversation_history,
    maybe_update_conversation_summary,
)
from app.agents.openai_provider import OpenAIProviderError, call_openai_structured
from app.agents.result import AgentRunResult
from app.agents.state import AgentGraphState
from app.agents.tools import lead_known_profile, tool_rescore_lead, tool_update_lead_fields
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.utils import utcnow

logger = get_logger(__name__)

MAX_USER_MESSAGE_CHARS = 8000


def _wants_handoff(state: AgentGraphState) -> bool:
    action = (state.get("recommended_action") or "").upper()
    return bool(
        state.get("requires_human")
        or state.get("intent") == "handoff"
        or action in {"HUMAN_HANDOFF", "HANDOFF"}
    )


async def validate_input(state: AgentGraphState) -> dict[str, Any]:
    raw = state.get("user_message") or ""
    message = raw.strip()
    language = detect_language(message) if message else "en"
    trace_id = state.get("trace_id") or str(uuid.uuid4())

    if not message:
        return {
            "trace_id": trace_id,
            "blocked": True,
            "block_reason": "empty_message",
            "language": language,
            "reply": "Please send a message so I can help."
            if language != "fr"
            else "Envoyez un message pour que je puisse vous aider.",
            "intent": "unknown",
            "confidence": 1.0,
            "requires_human": False,
            "extracted_fields": {},
            "missing_fields": [],
            "recommended_action": "CONTINUE_QUALIFICATION",
            "fallback_used": False,
            "model": "guardrail",
            "phase": "validate",
        }

    if len(message) > MAX_USER_MESSAGE_CHARS:
        message = message[:MAX_USER_MESSAGE_CHARS]

    return {
        "trace_id": trace_id,
        "blocked": False,
        "block_reason": None,
        "language": language,
        "user_message": message,
        "extracted_fields": {},
        "fallback_used": False,
        "retry_count": 0,
        "fields_applied": False,
        "phase": "validate",
    }


async def safety_check(state: AgentGraphState) -> dict[str, Any]:
    if state.get("blocked"):
        return {"phase": "safety"}
    message = state["user_message"]
    language = state.get("language") or detect_language(message)
    injection = is_prompt_injection(message)
    exfil = is_sql_or_data_exfil_attempt(message)
    if injection or exfil:
        reply = INJECTION_SAFE_REPLY_FR if language == "fr" else INJECTION_SAFE_REPLY_EN
        # Data-exfil attempts escalate to human; pure injection stays blocked safely.
        requires_human = bool(exfil)
        return {
            "blocked": True,
            "block_reason": "safety_exfil" if exfil else "safety",
            "language": language,
            "reply": reply,
            "intent": "handoff" if requires_human else "unknown",
            "confidence": 1.0,
            "requires_human": requires_human,
            "handoff_reason": "Suspicious data-access request" if requires_human else None,
            "extracted_fields": {},
            "missing_fields": [],
            "recommended_action": "HUMAN_HANDOFF" if requires_human else "CONTINUE_QUALIFICATION",
            "fallback_used": False,
            "model": "guardrail",
            "phase": "safety",
        }
    settings = get_settings()
    use_openai = (
        (not settings.ai_mock_mode)
        and bool(settings.openai_api_key)
        and settings.ai_enabled
    )
    return {"blocked": False, "use_openai": use_openai, "language": language, "phase": "safety"}


async def load_context(state: AgentGraphState) -> dict[str, Any]:
    if state.get("blocked"):
        return {"phase": "context"}
    db: AsyncSession = state["db"]
    conversation: Conversation = state["conversation"]
    lead: Lead = state["lead"]
    history = await load_conversation_history(db, conversation)
    message_count = await count_conversation_messages(db, conversation)
    known, missing = compute_known_and_missing(lead)
    return {
        "history_messages": history,
        "message_count": message_count,
        "lead_profile": lead_known_profile(lead),
        "known_fields": known,
        "missing_fields": missing,
        "conversation_summary": conversation.summary,
        "phase": "context",
    }


async def call_openai(state: AgentGraphState) -> dict[str, Any]:
    if state.get("blocked"):
        return {"phase": "model"}

    lead: Lead = state["lead"]
    user_message = state["user_message"]
    trace_id = state.get("trace_id")

    if not state.get("use_openai"):
        result = run_deterministic_agent(lead=lead, user_message=user_message, fallback=False)
        return {
            "reply": result.reply,
            "intent": result.intent,
            "language": result.language or state.get("language"),
            "confidence": result.confidence,
            "requires_human": result.requires_human,
            "extracted_fields": result.extracted_fields,
            "missing_fields": result.missing_fields or state.get("missing_fields") or [],
            "recommended_action": result.recommended_action,
            "fallback_used": False,
            "model": result.model,
            "response_id": None,
            "latency_ms": None,
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "retry_count": 0,
            "phase": "model",
        }

    model_input = build_model_input(
        lead=lead,
        user_message=user_message,
        history=state.get("history_messages") or [],
        known_fields=state.get("known_fields") or [],
        missing_fields=state.get("missing_fields") or [],
        conversation_summary=state.get("conversation_summary"),
    )
    try:
        result = await call_openai_structured(model_input=model_input)
        logger.info(
            "agent_openai_ok",
            trace_id=trace_id,
            model=result.model,
            response_id=result.response_id,
            tokens=result.total_tokens,
            confidence=result.confidence,
            latency_ms=result.latency_ms,
            history=len(state.get("history_messages") or []),
        )
        return {
            "reply": result.reply,
            "intent": result.intent,
            "language": result.language or state.get("language"),
            "confidence": result.confidence,
            "requires_human": result.requires_human,
            "handoff_reason": "Model recommended human handoff"
            if result.requires_human
            else None,
            "extracted_fields": result.extracted_fields,
            "missing_fields": result.missing_fields or state.get("missing_fields") or [],
            "recommended_action": result.recommended_action,
            "fallback_used": False,
            "model": result.model,
            "response_id": result.response_id,
            "latency_ms": result.latency_ms,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
            "total_tokens": result.total_tokens,
            "phase": "model",
        }
    except OpenAIProviderError as exc:
        logger.warning(
            "agent_openai_fallback",
            trace_id=trace_id,
            reason=str(exc)[:300],
        )
        result = run_deterministic_agent(lead=lead, user_message=user_message, fallback=True)
        return {
            "reply": result.reply,
            "intent": result.intent,
            "language": result.language or state.get("language"),
            "confidence": result.confidence,
            "requires_human": result.requires_human,
            "extracted_fields": result.extracted_fields,
            "missing_fields": result.missing_fields or state.get("missing_fields") or [],
            "recommended_action": result.recommended_action,
            "fallback_used": True,
            "model": result.model,
            "response_id": None,
            "latency_ms": None,
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "error": str(exc)[:300],
            "phase": "model",
        }


async def apply_extracted_fields(state: AgentGraphState) -> dict[str, Any]:
    if state.get("blocked"):
        return {"fields_applied": False, "phase": "apply"}
    extracted = state.get("extracted_fields") or {}
    if not extracted:
        return {"fields_applied": False, "phase": "apply"}
    db: AsyncSession = state["db"]
    lead: Lead = state["lead"]
    # Never allow score/temperature/status through tools (already filtered)
    await tool_update_lead_fields(db, lead, extracted)
    known, missing = compute_known_and_missing(lead)
    return {
        "known_fields": known,
        "missing_fields": missing,
        "lead_profile": lead_known_profile(lead),
        "fields_applied": True,
        "phase": "apply",
    }


async def calculate_score(state: AgentGraphState) -> dict[str, Any]:
    """LeadScoringService is the only source of truth for score/temperature."""
    if state.get("blocked"):
        return {"phase": "score"}
    if not state.get("fields_applied"):
        return {"phase": "score"}
    db: AsyncSession = state["db"]
    lead: Lead = state["lead"]
    await tool_rescore_lead(db, lead)
    return {"phase": "score"}


async def handoff_or_continue(state: AgentGraphState) -> dict[str, Any]:
    if not _wants_handoff(state):
        return {"handoff_created": False, "phase": "handoff"}
    db: AsyncSession = state["db"]
    conversation: Conversation = state["conversation"]
    lead: Lead = state["lead"]
    created = await request_human_handoff(
        db, conversation=conversation, lead=lead, source="ai"
    )
    return {
        "requires_human": True,
        "handoff_created": created,
        "recommended_action": "HUMAN_HANDOFF",
        "phase": "handoff",
    }


async def persist(state: AgentGraphState) -> dict[str, Any]:
    conversation: Conversation = state["conversation"]
    lead: Lead = state["lead"]
    lead.last_interaction_at = utcnow()
    conversation.updated_at = utcnow()
    reply = sanitize_reply(state.get("reply") or "")

    summary = maybe_update_conversation_summary(
        conversation,
        lead,
        message_count=int(state.get("message_count") or 0),
        missing_fields=list(state.get("missing_fields") or []),
        force=bool(state.get("fields_applied") or state.get("handoff_created")),
        handoff=bool(state.get("requires_human") or state.get("handoff_created")),
        handoff_reason=state.get("handoff_reason"),
    )

    logger.info(
        "agent_run_done",
        trace_id=state.get("trace_id"),
        model=state.get("model"),
        fallback_used=bool(state.get("fallback_used")),
        requires_human=bool(state.get("requires_human")),
        intent=state.get("intent"),
        tokens=state.get("total_tokens"),
    )
    return {
        "reply": reply,
        "conversation_summary": summary,
        "phase": "done",
    }


def _route_after_safety(
    state: AgentGraphState,
) -> Literal["load_context", "handoff_or_continue", "persist"]:
    if state.get("blocked") and _wants_handoff(state):
        return "handoff_or_continue"
    if state.get("blocked"):
        return "persist"
    return "load_context"


def build_agent_graph():
    graph = StateGraph(AgentGraphState)
    graph.add_node("validate_input", validate_input)
    graph.add_node("safety_check", safety_check)
    graph.add_node("load_context", load_context)
    graph.add_node("call_openai", call_openai)
    graph.add_node("apply_extracted_fields", apply_extracted_fields)
    graph.add_node("calculate_score", calculate_score)
    graph.add_node("handoff_or_continue", handoff_or_continue)
    graph.add_node("persist", persist)

    graph.add_edge(START, "validate_input")
    graph.add_edge("validate_input", "safety_check")
    graph.add_conditional_edges(
        "safety_check",
        _route_after_safety,
        {
            "load_context": "load_context",
            "handoff_or_continue": "handoff_or_continue",
            "persist": "persist",
        },
    )
    graph.add_edge("load_context", "call_openai")
    graph.add_edge("call_openai", "apply_extracted_fields")
    graph.add_edge("apply_extracted_fields", "calculate_score")
    graph.add_edge("calculate_score", "handoff_or_continue")
    graph.add_edge("handoff_or_continue", "persist")
    graph.add_edge("persist", END)
    return graph.compile()


_AGENT_GRAPH = None


def get_agent_graph():
    global _AGENT_GRAPH
    if _AGENT_GRAPH is None:
        _AGENT_GRAPH = build_agent_graph()
    return _AGENT_GRAPH


def reset_agent_graph() -> None:
    """Test helper — force recompile after settings changes if needed."""
    global _AGENT_GRAPH
    _AGENT_GRAPH = None


def _state_to_result(state: AgentGraphState) -> AgentRunResult:
    return AgentRunResult(
        reply=state.get("reply") or "",
        intent=state.get("intent"),
        language=state.get("language"),
        confidence=state.get("confidence"),
        requires_human=bool(state.get("requires_human")),
        extracted_fields=dict(state.get("extracted_fields") or {}),
        missing_fields=list(state.get("missing_fields") or []),
        recommended_action=state.get("recommended_action"),
        fallback_used=bool(state.get("fallback_used")),
        model=state.get("model"),
        response_id=state.get("response_id"),
        latency_ms=state.get("latency_ms"),
        input_tokens=state.get("input_tokens"),
        output_tokens=state.get("output_tokens"),
        total_tokens=state.get("total_tokens"),
        trace_id=state.get("trace_id"),
    )


async def run_agent(
    db: AsyncSession,
    *,
    conversation: Conversation,
    lead: Lead,
    user_message: str,
) -> AgentRunResult:
    """
    Entry point used by ConversationService / PublicFlowService.

    Executes the compiled LangGraph StateGraph:
    validate_input → safety_check → load_context → call_openai →
    apply_extracted_fields → calculate_score → handoff_or_continue → persist → END
    """
    graph = get_agent_graph()
    final_state: AgentGraphState = await graph.ainvoke(
        {
            "db": db,
            "conversation": conversation,
            "lead": lead,
            "user_message": user_message,
            "trace_id": str(uuid.uuid4()),
        }
    )
    return _state_to_result(final_state)
