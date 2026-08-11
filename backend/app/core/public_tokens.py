"""Signed temporary tokens for the public (unauthenticated) flow."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError
from jose import JWTError, jwt

PUBLIC_CHAT = "PUBLIC_CHAT"
PUBLIC_BOOKING = "PUBLIC_BOOKING"
PUBLIC_TOKEN_TYPE = "public"


def create_public_token(
    lead_id: str,
    conversation_id: str,
    permissions: list[str],
    expires_minutes: int = 60,
) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {
        "type": PUBLIC_TOKEN_TYPE,
        "lead_id": str(lead_id),
        "conversation_id": str(conversation_id),
        "permissions": list(permissions),
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_public_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise AuthenticationError("Invalid or expired public token") from exc

    if payload.get("type") != PUBLIC_TOKEN_TYPE:
        raise AuthenticationError("Invalid or expired public token")
    if not payload.get("lead_id") or not payload.get("conversation_id"):
        raise AuthenticationError("Invalid or expired public token")
    return payload


def require_permission(payload: dict[str, Any], permission: str) -> None:
    perms = payload.get("permissions") or []
    if permission not in perms:
        raise AuthenticationError(f"Public token missing permission: {permission}")
