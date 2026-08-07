"""Audit log helper."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AuditResult
from app.models.audit import AuditLog
from app.schemas.dashboard import AuditLogOut
from app.utils import to_iso


async def write_audit(
    db: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: str | uuid.UUID | None = None,
    user_name: str = "system",
    result: str = AuditResult.SUCCESS,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
    details: str = "",
    details_json: dict | None = None,
) -> AuditLog:
    uid = None
    if user_id is not None:
        uid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
    row = AuditLog(
        user_id=uid,
        user_name=user_name,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        result=result,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        details=details,
        details_json=details_json,
    )
    db.add(row)
    await db.flush()
    return row


def audit_to_out(row: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=str(row.id),
        timestamp=to_iso(row.created_at) or "",
        user_id=str(row.user_id) if row.user_id else "system",
        user_name=row.user_name or "system",
        action=row.action,
        entity=row.entity_type,
        entity_id=row.entity_id,
        ip=row.ip_address or "",
        result=row.result,
        details=row.details or "",
    )
