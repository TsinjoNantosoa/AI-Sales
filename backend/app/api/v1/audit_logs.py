"""Audit log routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.core.permissions import ensure_permission
from app.models.audit import AuditLog
from app.schemas.dashboard import AuditLogCreate, AuditLogOut
from app.services.audit import audit_to_out, write_audit

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
async def list_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[AuditLogOut]:
    ensure_permission(current_user.role, "audit:read")
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200))
    return [audit_to_out(r) for r in result.scalars().all()]


@router.post("", response_model=AuditLogOut)
async def create_log(
    body: AuditLogCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AuditLogOut:
    row = await write_audit(
        db,
        action=body.action,
        entity_type=body.entity,
        entity_id=body.entity_id,
        user_id=body.user_id or current_user.id,
        user_name=body.user_name or current_user.full_name,
        result=body.result,
        ip_address=body.ip,
        details=body.details,
    )
    return audit_to_out(row)
