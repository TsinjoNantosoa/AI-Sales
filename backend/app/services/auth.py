"""Authentication service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import UserStatus
from app.core.exceptions import AuthenticationError, NotFoundError, ValidationAppError
from app.core.redis import cache_delete, cache_get, incr_with_ttl
from app.core.security import (
    create_access_token,
    create_refresh_token_value,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.user import PasswordResetToken, RefreshToken, User
from app.schemas.auth import AuthUserOut, ForgotPasswordResponse, LoginResponse
from app.services.audit import write_audit
from app.services.mappers import user_to_auth_out
from app.utils import normalize_email, utcnow

LOCKOUT_THRESHOLD = 5
LOCKOUT_TTL = 900  # 15 minutes


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.settings = get_settings()

    async def _fail_count_key(self, email: str) -> str:
        return f"auth:fail:{normalize_email(email)}"

    async def _check_lockout(self, email: str) -> None:
        try:
            raw = await cache_get(await self._fail_count_key(email))
        except Exception:
            return
        if raw and int(raw) >= LOCKOUT_THRESHOLD:
            raise AuthenticationError(
                "Too many failed login attempts. Try again later.",
                code="ACCOUNT_LOCKED",
            )

    async def _record_failure(self, email: str) -> None:
        try:
            await incr_with_ttl(await self._fail_count_key(email), LOCKOUT_TTL)
        except Exception:
            pass

    async def _clear_failures(self, email: str) -> None:
        try:
            await cache_delete(await self._fail_count_key(email))
        except Exception:
            pass

    async def _get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == normalize_email(email), User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def login(
        self,
        email: str,
        password: str,
        *,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> LoginResponse:
        await self._check_lockout(email)
        user = await self._get_user_by_email(email)
        if user is None or not verify_password(password, user.password_hash):
            await self._record_failure(email)
            await write_audit(
                self.db,
                action="auth.login",
                entity_type="user",
                entity_id=str(user.id) if user else normalize_email(email),
                user_name=normalize_email(email),
                result="failure",
                ip_address=ip,
                details="Invalid credentials",
            )
            raise AuthenticationError("Invalid credentials")

        if user.status != UserStatus.ACTIVE:
            raise AuthenticationError("Account is not active")

        await self._clear_failures(email)
        access = create_access_token(
            str(user.id),
            extra={"role": user.role, "email": user.email},
        )
        refresh_raw = create_refresh_token_value()
        expires = utcnow() + timedelta(days=self.settings.refresh_token_expire_days)
        self.db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh_raw),
                device_info=(user_agent or "")[:255] or None,
                ip_address=ip,
                expires_at=expires,
            )
        )
        user.last_login_at = utcnow()
        await self.db.flush()
        await write_audit(
            self.db,
            action="auth.login",
            entity_type="user",
            entity_id=str(user.id),
            user_id=user.id,
            user_name=f"{user.first_name} {user.last_name}",
            ip_address=ip,
            details="Login successful",
        )
        return LoginResponse(
            user=user_to_auth_out(user),
            token=access,
            refresh_token=refresh_raw,
            token_type="bearer",
            expires_in=self.settings.access_token_expire_minutes * 60,
        )

    async def refresh(self, refresh_token: str) -> LoginResponse:
        token_hash = hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise AuthenticationError("Invalid refresh token")
        expires = row.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(UTC):
            raise AuthenticationError("Refresh token expired")

        user_result = await self.db.execute(
            select(User).where(User.id == row.user_id, User.deleted_at.is_(None))
        )
        user = user_result.scalar_one_or_none()
        if user is None or user.status != UserStatus.ACTIVE:
            raise AuthenticationError("User not found or inactive")

        # rotate
        row.revoked_at = utcnow()
        new_refresh = create_refresh_token_value()
        self.db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(new_refresh),
                expires_at=utcnow() + timedelta(days=self.settings.refresh_token_expire_days),
            )
        )
        access = create_access_token(
            str(user.id),
            extra={"role": user.role, "email": user.email},
        )
        await self.db.flush()
        return LoginResponse(
            user=user_to_auth_out(user),
            token=access,
            refresh_token=new_refresh,
            token_type="bearer",
            expires_in=self.settings.access_token_expire_minutes * 60,
        )

    async def logout(self, refresh_token: str | None = None, *, user_id: uuid.UUID | None = None) -> None:
        if refresh_token:
            token_hash = hash_token(refresh_token)
            result = await self.db.execute(
                select(RefreshToken).where(RefreshToken.token_hash == token_hash)
            )
            row = result.scalar_one_or_none()
            if row:
                row.revoked_at = utcnow()
                await self.db.flush()
                return
        if user_id:
            result = await self.db.execute(
                select(RefreshToken).where(
                    RefreshToken.user_id == user_id,
                    RefreshToken.revoked_at.is_(None),
                )
            )
            for row in result.scalars().all():
                row.revoked_at = utcnow()
            await self.db.flush()

    async def forgot_password(self, email: str) -> ForgotPasswordResponse:
        user = await self._get_user_by_email(email)
        # Always return success message to avoid enumeration
        if user is None:
            return ForgotPasswordResponse()
        raw = generate_token(32)
        self.db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(raw),
                expires_at=utcnow()
                + timedelta(minutes=self.settings.password_reset_expire_minutes),
            )
        )
        await self.db.flush()
        # In mock/dev expose token for demo flows
        reset_token = raw if self.settings.app_env in {"development", "test"} else None
        return ForgotPasswordResponse(reset_token=reset_token)

    async def reset_password(self, token: str, password: str) -> None:
        if len(password) < 8:
            raise ValidationAppError("Password must be at least 8 characters")
        token_hash = hash_token(token)
        result = await self.db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise ValidationAppError("Invalid or expired reset token")
        expires = row.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(UTC):
            raise ValidationAppError("Invalid or expired reset token")

        user_result = await self.db.execute(select(User).where(User.id == row.user_id))
        user = user_result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        user.password_hash = hash_password(password)
        row.used_at = utcnow()
        # revoke refresh tokens
        tokens = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        for t in tokens.scalars().all():
            t.revoked_at = utcnow()
        await self.db.flush()

    async def get_me(self, user_id: uuid.UUID) -> AuthUserOut:
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        return user_to_auth_out(user)
