"""Shared internal API key verification."""

from __future__ import annotations

import secrets

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError


def require_internal_api_key(x_internal_key: str | None) -> None:
    settings = get_settings()
    expected = settings.internal_api_key
    if not x_internal_key or not secrets.compare_digest(x_internal_key, expected):
        raise AuthenticationError("Invalid internal API key")
