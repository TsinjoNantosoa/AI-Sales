"""Appointment and calendar models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.enums import AppointmentStatus


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    assigned_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="Discovery Call")
    description: Mapped[str | None] = mapped_column(Text)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    meeting_type: Mapped[str] = mapped_column(String(100))
    meeting_url: Mapped[str | None] = mapped_column(String(500))
    external_event_id: Mapped[str | None] = mapped_column(String(255), index=True)
    calendar_provider: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(
        String(50), default=AppointmentStatus.PROPOSED, index=True
    )
    location: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    google_meet: Mapped[bool] = mapped_column(Boolean, default=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), unique=True, index=True)
    # Denormalized for frontend contract
    lead_name: Mapped[str] = mapped_column(String(200), default="")
    lead_company: Mapped[str] = mapped_column(String(255), default="")
    lead_email: Mapped[str] = mapped_column(String(255), default="")
    salesperson_name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CalendarConnection(Base):
    __tablename__ = "calendar_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), default="google")
    encrypted_access_token: Mapped[str | None] = mapped_column(Text)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calendar_id: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
