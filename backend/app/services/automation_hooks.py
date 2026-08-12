"""Emit automation events after LangGraph qualification runs."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.result import AgentRunResult
from app.core.enums import LeadTemperature
from app.models.lead import Lead
from app.services.automation_events import AutomationEventService
from app.services.n8n_internal import N8nInternalService


async def emit_post_qualification_events(
    db: AsyncSession,
    *,
    lead: Lead,
    conversation_id: uuid.UUID | None,
    result: AgentRunResult,
    previous_score: int,
    previous_temperature: str,
    trace_id: str | None = None,
) -> None:
    became_hot = (
        previous_temperature != LeadTemperature.HOT
        and N8nInternalService.is_lead_hot(lead.score, lead.temperature)
    )
    payload: dict[str, Any] = {
        "leadId": str(lead.id),
        "conversationId": str(conversation_id) if conversation_id else None,
        "score": lead.score,
        "temperature": lead.temperature,
        "status": lead.status,
        "previousScore": previous_score,
        "previousTemperature": previous_temperature,
        "becameHot": became_hot,
        "requiresHuman": result.requires_human,
        "missingFields": result.missing_fields,
        "recommendedAction": result.recommended_action,
        "intent": result.intent,
        "traceId": trace_id or result.trace_id,
    }
    if not result.extracted_fields and not became_hot and not result.requires_human:
        return

    events = AutomationEventService(db)
    await events.emit_qualification_updated(
        lead_id=lead.id,
        conversation_id=conversation_id,
        payload=payload,
        correlation_id=trace_id or result.trace_id,
    )
    if became_hot:
        await events.emit(
            "lead.hot",
            lead_id=lead.id,
            conversation_id=conversation_id,
            correlation_id=trace_id or result.trace_id,
            payload={
                "leadId": str(lead.id),
                "score": lead.score,
                "assignedUserId": str(lead.assigned_user_id)
                if lead.assigned_user_id
                else None,
                "becameHot": True,
            },
        )
    if result.requires_human and conversation_id:
        await events.emit_handoff_requested(
            lead_id=lead.id,
            conversation_id=conversation_id,
            reason=result.recommended_action,
            correlation_id=trace_id or result.trace_id,
        )
