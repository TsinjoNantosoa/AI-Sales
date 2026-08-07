"""FastAPI dependencies."""

from app.api.dependencies.auth import (
    CurrentUser,
    get_current_user,
    get_optional_user,
    require_roles,
)
from app.api.dependencies.db import get_db

__all__ = [
    "CurrentUser",
    "get_current_user",
    "get_optional_user",
    "require_roles",
    "get_db",
]
