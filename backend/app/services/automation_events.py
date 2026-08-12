"""Automation event outbox — persist during transaction, dispatch after commit."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.automation_event import AutomationEvent
from app.schemas.automation_events import AutomationEventEnvelope
from app.utils import to_iso, utcnow

logger = get_logger(__name__)

PENDING_KEY = "automation_pending_dispatch"


class AutomationEventService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _queue_for_dispatch(self, event_row_id: uuid.UUID) -> None:
        pending: list[uuid.UUID] = self.db.info.setdefault(PENDING_KEY, [])
        pending.append(event_row_id)

    async def emit(
        self,
        event_type: str,
        *,
        payload: dict[str, Any] | None = None,
        lead_id: uuid.UUID | str | None = None,
        conversation_id: uuid.UUID | str | None = None,
        appointment_id: uuid.UUID | str | None = None,
        correlation_id: str | None = None,
        aggregate_type: str | None = None,
        aggregate_id: str | None = None,
        event_id: str | None = None,
    ) -> AutomationEvent:
        eid = event_id or str(uuid.uuid4())
        lid = uuid.UUID(str(lead_id)) if lead_id else None
        cid = uuid.UUID(str(conversation_id)) if conversation_id else None
        aid = uuid.UUID(str(appointment_id)) if appointment_id else None
        envelope = AutomationEventEnvelope(
            eventId=eid,
            eventType=event_type,
            occurredAt=to_iso(utcnow()) or "",
            correlationId=correlation_id or eid,
            leadId=str(lid) if lid else None,
            conversationId=str(cid) if cid else None,
            appointmentId=str(aid) if aid else None,
            payload=payload or {},
        )
        row = AutomationEvent(
            event_id=eid,
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id or (str(lid) if lid else None),
            lead_id=lid,
            conversation_id=cid,
            appointment_id=aid,
            correlation_id=envelope.correlation_id,
            payload_json=envelope.to_dispatch_dict(),
        )
        self.db.add(row)
        await self.db.flush()
        self._queue_for_dispatch(row.id)
        logger.info(
            "automation_event_enqueued",
            event_id=eid,
            event_type=event_type,
            lead_id=str(lid) if lid else None,
        )
        return row

    async def emit_lead_created(self, lead_id: uuid.UUID, *, correlation_id: str | None = None) -> AutomationEvent:
        return await self.emit(
            "lead.created",
            lead_id=lead_id,
            aggregate_type="lead",
            aggregate_id=str(lead_id),
            correlation_id=correlation_id,
            payload={"leadId": str(lead_id)},
        )

    async def emit_qualification_updated(
        self,
        *,
        lead_id: uuid.UUID,
        conversation_id: uuid.UUID | None,
        payload: dict[str, Any],
        correlation_id: str | None = None,
    ) -> AutomationEvent | None:
        # Skip empty/no-op payloads
        if not payload:
            return None
        return await self.emit(
            "lead.qualification.updated",
            lead_id=lead_id,
            conversation_id=conversation_id,
            aggregate_type="lead",
            aggregate_id=str(lead_id),
            correlation_id=correlation_id,
            payload=payload,
        )

    async def emit_appointment_created(
        self,
        *,
        appointment_id: uuid.UUID,
        lead_id: uuid.UUID,
        assigned_user_id: uuid.UUID | None = None,
    ) -> AutomationEvent:
        return await self.emit(
            "appointment.created",
            lead_id=lead_id,
            appointment_id=appointment_id,
            aggregate_type="appointment",
            aggregate_id=str(appointment_id),
            payload={
                "appointmentId": str(appointment_id),
                "leadId": str(lead_id),
                "assignedUserId": str(assigned_user_id) if assigned_user_id else None,
            },
        )

    async def emit_handoff_requested(
        self,
        *,
        lead_id: uuid.UUID,
        conversation_id: uuid.UUID,
        reason: str | None = None,
        correlation_id: str | None = None,
    ) -> AutomationEvent:
        return await self.emit(
            "conversation.handoff.requested",
            lead_id=lead_id,
            conversation_id=conversation_id,
            aggregate_type="conversation",
            aggregate_id=str(conversation_id),
            correlation_id=correlation_id,
            payload={
                "leadId": str(lead_id),
                "conversationId": str(conversation_id),
                "handoffReason": reason,
            },
        )
