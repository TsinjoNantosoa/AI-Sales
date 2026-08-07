"""User / team service."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser
from app.core.enums import LeadStatus, UserRole, UserStatus
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.core.permissions import ensure_permission, is_admin
from app.core.security import hash_password
from app.models.appointment import Appointment, CalendarConnection
from app.models.lead import Lead
from app.models.user import User
from app.schemas.auth import UserInviteRequest, UserOut, UserStatsOut, UserUpdateRequest
from app.services.audit import write_audit
from app.services.mappers import user_to_out
from app.utils import normalize_email, utcnow


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _stats_for(self, user_id: uuid.UUID) -> dict:
        leads = list(
            (
                await self.db.execute(
                    select(Lead).where(
                        Lead.assigned_user_id == user_id,
                        Lead.deleted_at.is_(None),
                    )
                )
            ).scalars().all()
        )
        meetings = (
            await self.db.execute(
                select(func.count()).select_from(Appointment).where(
                    Appointment.assigned_user_id == user_id
                )
            )
        ).scalar() or 0
        wins = [l for l in leads if l.status == LeadStatus.WON]
        active = [
            l
            for l in leads
            if l.status not in {LeadStatus.WON, LeadStatus.LOST, LeadStatus.INACTIVE, LeadStatus.ARCHIVED}
        ]
        return {
            "assigned_leads": len(leads),
            "active_opportunities": len(active),
            "meetings": int(meetings),
            "wins": len(wins),
            "conversion_rate": round(len(wins) / len(leads) * 1000) / 10 if leads else 0.0,
            "revenue": sum(l.estimated_value or 0 for l in wins),
        }

    async def _calendar_connected(self, user_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(CalendarConnection).where(CalendarConnection.user_id == user_id)
        )
        return result.scalar_one_or_none() is not None

    async def list_users(self, current: CurrentUser) -> list[UserOut]:
        ensure_permission(current.role, "team:read")
        result = await self.db.execute(
            select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.asc())
        )
        out: list[UserOut] = []
        for u in result.scalars().all():
            stats = await self._stats_for(u.id)
            out.append(
                user_to_out(
                    u,
                    assigned_leads=stats["assigned_leads"],
                    active_opportunities=stats["active_opportunities"],
                    meetings=stats["meetings"],
                    conversion_rate=stats["conversion_rate"],
                    calendar_connected=await self._calendar_connected(u.id),
                )
            )
        return out

    async def get_user(self, user_id: uuid.UUID, current: CurrentUser) -> UserOut:
        if str(user_id) != current.id:
            ensure_permission(current.role, "team:read")
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        stats = await self._stats_for(user.id)
        return user_to_out(
            user,
            assigned_leads=stats["assigned_leads"],
            active_opportunities=stats["active_opportunities"],
            meetings=stats["meetings"],
            conversion_rate=stats["conversion_rate"],
            calendar_connected=await self._calendar_connected(user.id),
        )

    async def invite(self, data: UserInviteRequest, current: CurrentUser) -> UserOut:
        ensure_permission(current.role, "team:invite")
        email = normalize_email(data.email)
        existing = await self.db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise ConflictError("A user with this email already exists")
        user = User(
            email=email,
            first_name=data.first_name,
            last_name=data.last_name,
            role=data.role,
            status=UserStatus.ACTIVE,
            password_hash=hash_password("ChangeMe123!"),
            language="en",
            timezone="America/New_York",
        )
        self.db.add(user)
        await self.db.flush()
        await write_audit(
            self.db,
            action="user.invite",
            entity_type="user",
            entity_id=str(user.id),
            user_id=current.id,
            user_name=current.full_name,
            details=f"Invited {email} as {data.role}",
        )
        return user_to_out(user)

    async def update(
        self, user_id: uuid.UUID, data: UserUpdateRequest, current: CurrentUser
    ) -> UserOut:
        if str(user_id) != current.id and not is_admin(current.role):
            ensure_permission(current.role, "team:invite")
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        payload = data.model_dump(exclude_unset=True)
        if "role" in payload and not is_admin(current.role):
            payload.pop("role")
        if "avatar" in payload:
            user.avatar_url = payload.pop("avatar")
        for k, v in payload.items():
            setattr(user, k, v)
        await self.db.flush()
        stats = await self._stats_for(user.id)
        return user_to_out(
            user,
            assigned_leads=stats["assigned_leads"],
            active_opportunities=stats["active_opportunities"],
            meetings=stats["meetings"],
            conversion_rate=stats["conversion_rate"],
            calendar_connected=await self._calendar_connected(user.id),
        )

    async def delete(self, user_id: uuid.UUID, current: CurrentUser) -> None:
        if not is_admin(current.role):
            raise ValidationAppError("Only admins can delete users", status_code=403)
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        if user.role == UserRole.ADMIN:
            admin_count = (
                await self.db.execute(
                    select(func.count())
                    .select_from(User)
                    .where(
                        User.role == UserRole.ADMIN,
                        User.deleted_at.is_(None),
                        User.status == UserStatus.ACTIVE,
                    )
                )
            ).scalar() or 0
            if admin_count <= 1:
                raise ValidationAppError("Cannot delete the last admin")
        user.deleted_at = utcnow()
        user.status = UserStatus.DISABLED
        await write_audit(
            self.db,
            action="user.delete",
            entity_type="user",
            entity_id=str(user.id),
            user_id=current.id,
            user_name=current.full_name,
            details=f"Deleted user {user.email}",
        )
        await self.db.flush()

    async def stats(self, user_id: uuid.UUID, current: CurrentUser) -> UserStatsOut:
        if str(user_id) != current.id:
            ensure_permission(current.role, "team:read")
        data = await self._stats_for(user_id)
        return UserStatsOut(**data)
