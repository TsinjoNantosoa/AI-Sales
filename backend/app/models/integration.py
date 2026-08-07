"""Integration connection model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.enums import IntegrationStatus


class IntegrationConnection(Base):
    __tablename__ = "integration_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    logo: Mapped[str] = mapped_column(String(50), default="")
    category: Mapped[str] = mapped_column(String(50), default="Other")
    status: Mapped[str] = mapped_column(String(30), default=IntegrationStatus.AVAILABLE)
    configuration_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    encrypted_credentials: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
