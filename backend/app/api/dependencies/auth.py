"""Authentication and RBAC dependencies."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.db import get_db
from app.core.enums import UserStatus
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.security import decode_token
from app.models.user import User


@dataclass
class CurrentUser:
    id: str
    email: str
    role: str
    first_name: str
    last_name: str
    language: str
    timezone: str
    avatar_url: str | None = None

    @property
    def uuid(self) -> uuid.UUID:
        return uuid.UUID(self.id)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


def _user_to_current(user: User) -> CurrentUser:
    return CurrentUser(
        id=str(user.id),
        email=user.email,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        language=user.language or "en",
        timezone=user.timezone or "UTC",
        avatar_url=user.avatar_url,
    )


async def _load_user_from_token(
    authorization: str | None,
    db: AsyncSession,
) -> User | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        payload = decode_token(token)
    except ValueError:
        return None
    if payload.get("type") != "access":
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    try:
        user_id = uuid.UUID(str(sub))
    except ValueError:
        return None
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    user = await _load_user_from_token(authorization, db)
    if user is None:
        raise AuthenticationError("Invalid or missing access token")
    if user.status != UserStatus.ACTIVE:
        raise AuthenticationError("Account is not active")
    return _user_to_current(user)


async def get_optional_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser | None:
    user = await _load_user_from_token(authorization, db)
    if user is None or user.status != UserStatus.ACTIVE:
        return None
    return _user_to_current(user)


def require_roles(*allowed: str) -> Callable:
    async def _dependency(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if current_user.role not in allowed:
            raise AuthorizationError(
                f"Role {current_user.role} is not allowed",
                details={"allowed": list(allowed)},
            )
        return current_user

    return _dependency
