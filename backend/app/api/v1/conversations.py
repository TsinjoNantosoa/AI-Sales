"""Conversation routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.common import (
    AiReplyRequest,
    AiReplyResponse,
    ConversationCreate,
    ConversationOut,
    MessageCreate,
    MessageOut,
    QualifyRequest,
    QualifyResponse,
)
from app.services.conversation import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[ConversationOut]:
    return await ConversationService(db).list_conversations(current_user)


@router.post("", response_model=ConversationOut)
async def create_conversation(
    body: ConversationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ConversationOut:
    return await ConversationService(db).get_or_create_for_lead(uuid.UUID(body.lead_id), current_user)


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ConversationOut:
    return await ConversationService(db).get_conversation(conversation_id, current_user)


@router.post("/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    conversation_id: uuid.UUID,
    body: MessageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> MessageOut:
    return await ConversationService(db).send_message(
        conversation_id, body.content, body.sender, current_user
    )


@router.post("/{conversation_id}/qualify", response_model=QualifyResponse)
async def qualify(
    conversation_id: uuid.UUID,
    body: QualifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> QualifyResponse:
    return await ConversationService(db).qualify(
        conversation_id, uuid.UUID(body.lead_id), body.step, body.answer, current_user
    )


@router.post("/{conversation_id}/ai-reply", response_model=AiReplyResponse)
async def ai_reply(
    conversation_id: uuid.UUID,
    body: AiReplyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AiReplyResponse:
    return await ConversationService(db).ai_reply(
        conversation_id, body.message, current_user
    )


@router.post("/{conversation_id}/handoff", response_model=ConversationOut)
async def handoff(
    conversation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ConversationOut:
    return await ConversationService(db).handoff(conversation_id, current_user)


@router.post("/{conversation_id}/close", response_model=ConversationOut)
async def close(
    conversation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ConversationOut:
    return await ConversationService(db).close(conversation_id, current_user)
