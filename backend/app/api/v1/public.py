"""Public (unauthenticated) endpoints with signed temporary tokens."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.core.exceptions import AuthenticationError
from app.core.public_tokens import PUBLIC_TOKEN_TYPE, decode_public_token
from app.core.rate_limit import check_rate_limit
from app.core.security import decode_token
from app.schemas.common import AppointmentOut, ConversationOut
from app.schemas.lead import LeadCreate, LeadOut
from app.schemas.public import (
    PublicAppointmentCreate,
    PublicConversationCreate,
    PublicLeadCreateResponse,
    PublicMessageCreate,
    PublicMessageResponse,
    PublicQualifyRequest,
)
from app.services.public_flow import PublicFlowService

router = APIRouter(prefix="/public", tags=["public"])


def _extract_public_token(
    request: Request,
    *,
    header_token: str | None = None,
    body_token: str | None = None,
    query_token: str | None = None,
) -> str:
    token = header_token or request.headers.get("X-Public-Token")
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            candidate = auth[7:].strip()
            if candidate:
                try:
                    payload = decode_public_token(candidate)
                    if payload.get("type") == PUBLIC_TOKEN_TYPE:
                        token = candidate
                except AuthenticationError:
                    try:
                        payload = decode_token(candidate)
                        if payload.get("type") == PUBLIC_TOKEN_TYPE:
                            token = candidate
                    except ValueError:
                        pass
    if not token:
        token = body_token or query_token
    if not token:
        raise AuthenticationError("Public token required")
    return token


@router.post("/leads", response_model=PublicLeadCreateResponse)
async def public_create_lead(
    body: LeadCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PublicLeadCreateResponse:
    await check_rate_limit(request, key_suffix="public.leads", limit="30/minute")
    return await PublicFlowService(db).create_public_lead(body)


@router.get("/leads/{lead_id}", response_model=LeadOut)
async def public_get_lead(
    lead_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_public_token: Annotated[str | None, Header(alias="X-Public-Token")] = None,
    publicToken: str | None = Query(default=None),
) -> LeadOut:
    await check_rate_limit(request, key_suffix="public.leads.get", limit="60/minute")
    token = _extract_public_token(request, header_token=x_public_token, query_token=publicToken)
    return await PublicFlowService(db).get_public_lead(token, lead_id=str(lead_id))


@router.post("/conversations", response_model=ConversationOut)
async def public_get_or_create_conversation(
    body: PublicConversationCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_public_token: Annotated[str | None, Header(alias="X-Public-Token")] = None,
) -> ConversationOut:
    await check_rate_limit(request, key_suffix="public.conversations", limit="60/minute")
    token = _extract_public_token(
        request, header_token=x_public_token, body_token=body.public_token
    )
    result = await PublicFlowService(db).get_or_create_conversation(token, body.lead_id)
    return result["conversation"]


@router.post("/conversations/{conversation_id}/messages", response_model=PublicMessageResponse)
async def public_send_message(
    conversation_id: uuid.UUID,
    body: PublicMessageCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_public_token: Annotated[str | None, Header(alias="X-Public-Token")] = None,
) -> PublicMessageResponse:
    await check_rate_limit(request, key_suffix="public.messages", limit="60/minute")
    token = _extract_public_token(request, header_token=x_public_token)
    return await PublicFlowService(db).send_public_message(
        token, conversation_id, body.content
    )


@router.post("/conversations/{conversation_id}/qualify", response_model=PublicMessageResponse)
async def public_qualify(
    conversation_id: uuid.UUID,
    body: PublicQualifyRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_public_token: Annotated[str | None, Header(alias="X-Public-Token")] = None,
) -> PublicMessageResponse:
    await check_rate_limit(request, key_suffix="public.qualify", limit="60/minute")
    token = _extract_public_token(request, header_token=x_public_token)
    return await PublicFlowService(db).qualify_public(
        token,
        conversation_id,
        step=body.step,
        answer=body.answer,
        lead_id=body.lead_id,
    )


@router.get("/calendar/slots", response_model=list[str])
async def public_calendar_slots(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    date: str = Query(...),
    userId: str | None = Query(default=None),
    x_public_token: Annotated[str | None, Header(alias="X-Public-Token")] = None,
    publicToken: str | None = Query(default=None),
) -> list[str]:
    await check_rate_limit(request, key_suffix="public.slots", limit="60/minute")
    token = _extract_public_token(request, header_token=x_public_token, query_token=publicToken)
    return await PublicFlowService(db).get_public_slots(token, date=date, user_id=userId)


@router.post("/appointments", response_model=AppointmentOut)
async def public_create_appointment(
    body: PublicAppointmentCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_public_token: Annotated[str | None, Header(alias="X-Public-Token")] = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> AppointmentOut:
    await check_rate_limit(request, key_suffix="public.appointments", limit="30/minute")
    token = _extract_public_token(
        request, header_token=x_public_token, body_token=body.public_token
    )
    return await PublicFlowService(db).create_public_appointment(
        token, body, idempotency_key=idempotency_key
    )
