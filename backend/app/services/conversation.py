"""Conversation service — messages, qualify, AI reply, handoff."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies.auth import CurrentUser
from app.core.enums import (
    ActivityType,
    ConversationChannel,
    ConversationStatus,
    LeadStatus,
    MessageSender,
    NotificationCategory,
)
from app.core.exceptions import NotFoundError
from app.core.permissions import (
    can_access_all_leads,
    ensure_conversation_access,
    ensure_lead_access,
    ensure_permission,
)
from app.models.conversation import Conversation, Message
from app.models.lead import Lead
from app.schemas.common import AiReplyResponse, ConversationOut, MessageOut, QualifyResponse
from app.services.activity import create_activity
from app.services.mappers import conversation_to_out, lead_to_out, message_to_out
from app.services.notification import create_notification
from app.services.scoring import LeadScoringService, parse_budget_range, temperature_from_score
from app.utils import utcnow


class ConversationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.scoring = LeadScoringService(db)

    async def _get_lead(self, lead_id: uuid.UUID) -> Lead:
        result = await self.db.execute(
            select(Lead)
            .options(selectinload(Lead.tag_entities))
            .where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead = result.scalar_one_or_none()
        if lead is None:
            raise NotFoundError("Lead not found")
        return lead

    async def _get_conversation(self, conv_id: uuid.UUID) -> Conversation:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv_id)
        )
        conv = result.scalar_one_or_none()
        if conv is None:
            raise NotFoundError("Conversation not found")
        return conv

    async def _assert_access(self, conv: Conversation, user: CurrentUser) -> None:
        lead = await self._get_lead(conv.lead_id)
        ensure_conversation_access(
            role=user.role,
            user_id=user.id,
            conversation_assigned_user_id=str(conv.assigned_user_id)
            if conv.assigned_user_id
            else None,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )

    async def list_conversations(self, user: CurrentUser) -> list[ConversationOut]:
        ensure_permission(user.role, "conversations:read")
        q = select(Conversation).options(selectinload(Conversation.messages)).order_by(
            Conversation.updated_at.desc()
        )
        result = await self.db.execute(q)
        convs = result.scalars().all()
        out: list[ConversationOut] = []
        for c in convs:
            lead = await self._get_lead(c.lead_id)
            if not can_access_all_leads(user.role):
                if str(c.assigned_user_id) != user.id and str(lead.assigned_user_id) != user.id:
                    continue
            out.append(conversation_to_out(c, lead=lead))
        return out

    async def get_conversation(self, conv_id: uuid.UUID, user: CurrentUser) -> ConversationOut:
        ensure_permission(user.role, "conversations:read")
        conv = await self._get_conversation(conv_id)
        await self._assert_access(conv, user)
        lead = await self._get_lead(conv.lead_id)
        return conversation_to_out(conv, lead=lead)

    async def get_or_create_for_lead(
        self, lead_id: uuid.UUID, user: CurrentUser | None = None
    ) -> ConversationOut:
        lead = await self._get_lead(lead_id)
        if user is not None:
            ensure_permission(user.role, "conversations:write")
            ensure_lead_access(
                role=user.role,
                user_id=user.id,
                lead_assigned_user_id=str(lead.assigned_user_id)
                if lead.assigned_user_id
                else None,
            )
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(
                Conversation.lead_id == lead_id,
                Conversation.channel == ConversationChannel.CHATBOT,
                Conversation.status != ConversationStatus.CLOSED,
            )
            .order_by(Conversation.created_at.desc())
            .limit(1)
        )
        conv = result.scalar_one_or_none()
        if conv is None:
            conv = Conversation(
                lead_id=lead.id,
                channel=ConversationChannel.CHATBOT,
                status=ConversationStatus.AI_HANDLED,
                assigned_user_id=lead.assigned_user_id,
            )
            self.db.add(conv)
            await self.db.flush()
            await self.db.refresh(conv, attribute_names=["messages"])
        return conversation_to_out(conv, lead=lead)

    async def send_message(
        self,
        conv_id: uuid.UUID,
        content: str,
        sender: str = "user",
        user: CurrentUser | None = None,
    ) -> MessageOut:
        conv = await self._get_conversation(conv_id)
        if user:
            await self._assert_access(conv, user)
        mapped = {
            "user": MessageSender.USER,
            "ai": MessageSender.AI,
            "agent": MessageSender.AGENT,
            "lead": MessageSender.USER,
            "system": MessageSender.SYSTEM,
        }.get(sender, MessageSender.USER)

        msg = Message(
            conversation_id=conv.id,
            content=content,
            sender_type=mapped,
            sender_user_id=user.uuid if user and mapped == MessageSender.AGENT else None,
            sender_name=user.full_name if user and mapped == MessageSender.AGENT else None,
            read=mapped != MessageSender.USER,
        )
        self.db.add(msg)
        conv.updated_at = utcnow()
        lead = await self._get_lead(conv.lead_id)
        lead.last_interaction_at = utcnow()
        await self.db.flush()
        return message_to_out(msg)

    async def qualify(
        self,
        conv_id: uuid.UUID,
        lead_id: uuid.UUID,
        step: int,
        answer: str,
        user: CurrentUser | None = None,
    ) -> QualifyResponse:
        conv = await self._get_conversation(conv_id)
        lead = await self._get_lead(lead_id)
        if conv.lead_id != lead.id:
            raise NotFoundError("Conversation/lead mismatch")
        if user is not None:
            ensure_permission(user.role, "conversations:write")
            await self._assert_access(conv, user)

        self.db.add(
            Message(
                conversation_id=conv.id,
                content=answer,
                sender_type=MessageSender.USER,
                read=True,
            )
        )

        lower = answer.lower()
        was_hot = lead.temperature == "HOT"

        if step == 1:
            if "lead" in lower:
                lead.service_interest = "AI Automation"
            elif "follow" in lower:
                lead.service_interest = "CRM Automation"
            elif "calendar" in lower:
                lead.service_interest = "n8n Workflow Development"
            elif "data" in lower:
                lead.service_interest = "Custom Software Development"
        if step == 3:
            parsed = parse_budget_range(answer)
            if parsed:
                lead.budget_min = parsed.get("budget_min")
                lead.budget_max = parsed.get("budget_max")
                lead.estimated_value = parsed.get("estimated_value")
            else:
                lead.budget_max = 1000
                lead.estimated_value = 800
        if step == 4:
            if "immediately" in lower:
                lead.timeline = "Immediately"
            elif "30" in lower:
                lead.timeline = "Within 30 days"
            else:
                lead.timeline = "Within 3 months"
        if step == 5:
            lead.decision_authority = answer

        base = 25 + step * 12
        bonus = 0
        if lead.budget_max and lead.budget_max >= 5000:
            bonus += 15
        if lead.timeline == "Immediately":
            bonus += 12
        elif lead.timeline == "Within 30 days":
            bonus += 8
        if "yes" in lower or "decide" in lower:
            bonus += 10
        if lead.service_interest:
            bonus += 8

        score = min(100, base + bonus)
        temperature = temperature_from_score(score)
        lead.score = score
        lead.temperature = temperature
        if score >= 70:
            lead.status = LeadStatus.QUALIFIED
        elif score >= 40:
            lead.status = LeadStatus.QUALIFYING
        elif lead.status == LeadStatus.NEW:
            lead.status = LeadStatus.CONTACTED
        lead.last_interaction_at = utcnow()

        await self.scoring.score_and_persist(
            lead, reason=f"Qualification step {step}", calculated_by="ai"
        )
        lead.score = score
        lead.temperature = temperature

        became_hot = not was_hot and temperature == "HOT"
        if became_hot and lead.assigned_user_id:
            await create_notification(
                self.db,
                user_id=lead.assigned_user_id,
                title="Hot lead detected",
                message=f"{lead.first_name} {lead.last_name} reached score {score}",
                category=NotificationCategory.LEADS,
                related_id=str(lead.id),
                related_type="lead",
            )

        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.SCORED,
            description=f"AI qualification update (step {step}): score {score}, {temperature}",
        )
        conv.updated_at = utcnow()
        lead.updated_at = utcnow()
        await self.db.flush()
        await self.db.refresh(lead)

        return QualifyResponse(
            lead=lead_to_out(lead).model_dump(by_alias=True),
            score=score,
            temperature=str(temperature),
            became_hot=became_hot,
        )

    async def ai_reply(
        self, conv_id: uuid.UUID, user_message: str, user: CurrentUser
    ) -> AiReplyResponse:
        from app.agents.graph import run_agent

        ensure_permission(user.role, "conversations:write")
        conv = await self._get_conversation(conv_id)
        await self._assert_access(conv, user)
        lead = await self._get_lead(conv.lead_id)
        prev_score = int(lead.score or 0)
        prev_temp = str(lead.temperature or "COLD")

        # Persist user turn
        self.db.add(
            Message(
                conversation_id=conv.id,
                content=user_message,
                sender_type=MessageSender.USER,
                read=True,
            )
        )

        result = await run_agent(
            self.db, conversation=conv, lead=lead, user_message=user_message
        )
        msg = Message(
            conversation_id=conv.id,
            content=result.reply,
            sender_type=MessageSender.AI,
            sender_name="Ava",
            intent=result.intent,
            read=False,
            llm_model=result.model,
            prompt_tokens=result.input_tokens,
            completion_tokens=result.output_tokens,
            total_tokens=result.total_tokens,
            metadata_json=result.message_metadata(),
        )
        self.db.add(msg)
        conv.updated_at = utcnow()
        await self.db.flush()

        from app.services.automation_hooks import emit_post_qualification_events

        lead = await self._get_lead(conv.lead_id)
        await emit_post_qualification_events(
            self.db,
            lead=lead,
            conversation_id=conv.id,
            result=result,
            previous_score=prev_score,
            previous_temperature=prev_temp,
            trace_id=result.trace_id,
        )
        return AiReplyResponse(message=message_to_out(msg))

    async def handoff(self, conv_id: uuid.UUID, user: CurrentUser | None = None) -> ConversationOut:
        from app.agents.handoff import request_human_handoff

        conv = await self._get_conversation(conv_id)
        if user is not None:
            ensure_permission(user.role, "conversations:write")
            await self._assert_access(conv, user)
        lead = await self._get_lead(conv.lead_id)
        await request_human_handoff(
            self.db,
            conversation=conv,
            lead=lead,
            source="crm" if user is not None else "system",
        )
        return conversation_to_out(conv, lead=lead)

    async def close(self, conv_id: uuid.UUID, user: CurrentUser) -> ConversationOut:
        conv = await self._get_conversation(conv_id)
        await self._assert_access(conv, user)
        conv.status = ConversationStatus.CLOSED
        conv.closed_at = utcnow()
        lead = await self._get_lead(conv.lead_id)
        await self.db.flush()
        return conversation_to_out(conv, lead=lead)
