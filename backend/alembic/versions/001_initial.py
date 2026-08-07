"""Initial schema — all tables from SQLAlchemy models.

Revision ID: 001
Revises:
Create Date: 2026-08-07
"""

from __future__ import annotations

from typing import Sequence, Union

import app.models  # noqa: F401
from alembic import op
from app.core.database import Base

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
