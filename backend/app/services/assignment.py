"""Lead assignment — round-robin by language and load."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole, UserStatus
from app.models.lead import Lead, LeadAssignmentHistory
from app.models.user import User


class LeadAssignmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def pick_assignee(
        self,
        *,
        language: str | None = None,
        preferred_user_id: uuid.UUID | None = None,
    ) -> User | None:
        if preferred_user_id:
            result = await self.db.execute(
                select(User).where(
                    User.id == preferred_user_id,
                    User.deleted_at.is_(None),
                    User.status == UserStatus.ACTIVE,
                )
            )
            user = result.scalar_one_or_none()
            if user:
                return user

        # Prefer sales reps, then managers
        q = (
            select(User, func.count(Lead.id).label("load"))
            .outerjoin(
                Lead,
                (Lead.assigned_user_id == User.id)
                & Lead.deleted_at.is_(None)
                & Lead.archived_at.is_(None),
            )
            .where(
                User.deleted_at.is_(None),
                User.status == UserStatus.ACTIVE,
                User.role.in_([UserRole.SALES_REPRESENTATIVE, UserRole.SALES_MANAGER]),
            )
            .group_by(User.id)
            .order_by(func.count(Lead.id).asc(), User.created_at.asc())
        )
        result = await self.db.execute(q)
        rows = result.all()
        if not rows:
            return None

        if language:
            lang_matches = [r for r in rows if (r[0].language or "en") == language]
            if lang_matches:
                return lang_matches[0][0]
        return rows[0][0]

    async def assign(
        self,
        lead: Lead,
        new_user_id: uuid.UUID | None,
        *,
        assigned_by: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> Lead:
        previous = lead.assigned_user_id
        lead.assigned_user_id = new_user_id
        self.db.add(
            LeadAssignmentHistory(
                lead_id=lead.id,
                previous_user_id=previous,
                new_user_id=new_user_id,
                assigned_by_user_id=assigned_by,
                reason=reason or "Manual assignment",
            )
        )
        await self.db.flush()
        return lead

    async def auto_assign(self, lead: Lead, *, assigned_by: uuid.UUID | None = None) -> Lead:
        user = await self.pick_assignee(language=lead.language)
        if user:
            return await self.assign(
                lead,
                user.id,
                assigned_by=assigned_by,
                reason="Auto round-robin assignment",
            )
        return lead
