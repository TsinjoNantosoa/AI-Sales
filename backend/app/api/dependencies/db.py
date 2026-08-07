"""Database session dependency re-export."""

from app.core.database import get_db

__all__ = ["get_db"]
