"""Integration connection service."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser
from app.core.enums import IntegrationStatus
from app.core.exceptions import NotFoundError
from app.core.permissions import ensure_permission
from app.models.integration import IntegrationConnection
from app.schemas.dashboard import IntegrationOut, TestConnectionResponse
from app.services.audit import write_audit
from app.utils import to_iso, utcnow


def _to_out(row: IntegrationConnection) -> IntegrationOut:
    status = row.status
    # Normalize uppercase statuses to frontend lowercase where needed
    mapping = {
        "CONNECTED": "connected",
        "DISCONNECTED": "available",
        "AVAILABLE": "available",
        "COMING_SOON": "coming_soon",
        "ERROR": "available",
        "CONNECTING": "available",
    }
    status = mapping.get(status, status)
    return IntegrationOut(
        id=str(row.id),
        name=row.name,
        description=row.description or "",
        logo=row.logo or "",
        status=status,
        last_sync=to_iso(row.last_synced_at),
        category=row.category or "Other",
    )


class IntegrationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get(self, integration_id: uuid.UUID) -> IntegrationConnection:
        result = await self.db.execute(
            select(IntegrationConnection).where(IntegrationConnection.id == integration_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise NotFoundError("Integration not found")
        return row

    async def list_integrations(self, user: CurrentUser) -> list[IntegrationOut]:
        ensure_permission(user.role, "integrations:read")
        result = await self.db.execute(select(IntegrationConnection).order_by(IntegrationConnection.name))
        return [_to_out(r) for r in result.scalars().all()]

    async def connect(self, integration_id: uuid.UUID, user: CurrentUser) -> IntegrationOut:
        ensure_permission(user.role, "integrations:write")
        row = await self._get(integration_id)
        row.status = IntegrationStatus.CONNECTED
        row.last_synced_at = utcnow()
        row.error_message = None
        await write_audit(
            self.db,
            action="integration.connect",
            entity_type="integration",
            entity_id=str(row.id),
            user_id=user.id,
            user_name=user.full_name,
            details=f"Connected {row.name}",
        )
        await self.db.flush()
        return _to_out(row)

    async def disconnect(self, integration_id: uuid.UUID, user: CurrentUser) -> IntegrationOut:
        ensure_permission(user.role, "integrations:write")
        row = await self._get(integration_id)
        row.status = IntegrationStatus.AVAILABLE
        row.last_synced_at = None
        await self.db.flush()
        return _to_out(row)

    async def test(self, integration_id: uuid.UUID, user: CurrentUser) -> TestConnectionResponse:
        ensure_permission(user.role, "integrations:read")
        row = await self._get(integration_id)
        row.last_tested_at = utcnow()
        await self.db.flush()
        if row.status not in {IntegrationStatus.CONNECTED, "connected"}:
            return TestConnectionResponse(ok=False, message="Integration is not connected")
        return TestConnectionResponse(ok=True, message="Connection successful (mock)")

    async def sync(self, integration_id: uuid.UUID, user: CurrentUser) -> IntegrationOut:
        ensure_permission(user.role, "integrations:write")
        row = await self._get(integration_id)
        row.last_synced_at = utcnow()
        await self.db.flush()
        return _to_out(row)

    async def configure(
        self, integration_id: uuid.UUID, user: CurrentUser, config: dict | None = None
    ) -> IntegrationOut:
        ensure_permission(user.role, "integrations:write")
        row = await self._get(integration_id)
        if config:
            row.configuration_json = {**(row.configuration_json or {}), **{k: "***" for k in config}}
        row.last_synced_at = utcnow()
        await self.db.flush()
        return _to_out(row)
