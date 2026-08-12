"""Centralized human-handoff business logic (AI + CRM)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ActivityType, ConversationStatus, NotificationCategory
from app.core.logging import get_logger
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.notification import Notification
from app.services.activity import create_activity
from app.services.notification import create_notification
from app.utils import utcnow

logger = get_logger(__name__)


async def request_human_handoff(
    db: AsyncSession,
    *,
    conversation: Conversation,
    lead: Lead,
    source: str = "ai",
) -> bool:
    """
    Put conversation in HUMAN_HANDOFF, create activity + sales notification.

    Returns True when a *new* handoff was recorded (avoids duplicate notifications).
    """
    already = bool(
        conversation.human_handoff_requested
        and conversation.status == ConversationStatus.HUMAN_HANDOFF
    )
    if already:
        # Still ensure timestamps/status consistency without duplicating side-effects
        logger.info(
            "handoff_already_active",
            conversation_id=str(conversation.id),
            source=source,
        )
        return False

    conversation.human_handoff_requested = True
    conversation.human_handoff_at = conversation.human_handoff_at or utcnow()
    conversation.status = ConversationStatus.HUMAN_HANDOFF
    conversation.updated_at = utcnow()

    await create_activity(
        db,
        lead_id=lead.id,
        lead_name=f"{lead.first_name} {lead.last_name}",
        type=ActivityType.STATUS_CHANGED,
        description=f"Human handoff requested ({source})",
        title="Human handoff",
        user_name="system" if source == "ai" else None,
        metadata={"source": source, "conversation_id": str(conversation.id)},
    )

    if lead.assigned_user_id:
        # Deduplicate notification for same conversation
        existing = await db.execute(
            select(Notification.id).where(
                Notification.user_id == lead.assigned_user_id,
                Notification.entity_type == "conversation",
                Notification.entity_id == str(conversation.id),
                Notification.title == "Human handoff requested",
            ).limit(1)
        )
        if existing.scalar_one_or_none() is None:
            await create_notification(
                db,
                user_id=lead.assigned_user_id,
                title="Human handoff requested",
                message=f"{lead.first_name} {lead.last_name} needs a human agent",
                category=NotificationCategory.LEADS,
                related_id=str(conversation.id),
                related_type="conversation",
            )

    await db.flush()
    logger.info(
        "handoff_requested",
        conversation_id=str(conversation.id),
        lead_id=str(lead.id),
        source=source,
    )
    return True
