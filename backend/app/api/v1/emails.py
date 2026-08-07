"""Email routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.core.permissions import ensure_permission
from app.schemas.dashboard import EmailLogOut, EmailSendRequest
from app.services.email import EmailService

router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("", response_model=list[EmailLogOut])
async def list_emails(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[EmailLogOut]:
    ensure_permission(current_user.role, "emails:read")
    return await EmailService(db).list_logs()


@router.post("/send", response_model=EmailLogOut)
async def send_email(
    body: EmailSendRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> EmailLogOut:
    ensure_permission(current_user.role, "emails:send")
    return await EmailService(db).send(
        to=body.to,
        subject=body.subject,
        body=body.body,
        template_slug=body.template_slug,
        lead_id=body.lead_id,
    )
