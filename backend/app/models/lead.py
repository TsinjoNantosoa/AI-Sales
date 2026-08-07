"""Lead-related models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import LeadSource, LeadStatus, LeadTemperature, Priority

lead_tags = Table(
    "lead_tags",
    Base.metadata,
    Column("lead_id", UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    leads: Mapped[list[Lead]] = relationship(secondary=lead_tags, back_populates="tag_entities")


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), index=True)
    country: Mapped[str] = mapped_column(String(100), default="")
    language: Mapped[str] = mapped_column(String(10), default="en")
    source: Mapped[str] = mapped_column(String(50), default=LeadSource.WEBSITE, index=True)
    service_interest: Mapped[str] = mapped_column(String(255), default="")
    company_size: Mapped[str | None] = mapped_column(String(50))
    budget_min: Mapped[float | None] = mapped_column(Float)
    budget_max: Mapped[float | None] = mapped_column(Float)
    budget_range: Mapped[str | None] = mapped_column(String(100))
    timeline: Mapped[str | None] = mapped_column(String(100))
    need_description: Mapped[str] = mapped_column(Text, default="")
    preferred_contact_channel: Mapped[str | None] = mapped_column(String(50))
    decision_authority: Mapped[str | None] = mapped_column(String(100))
    estimated_value: Mapped[float | None] = mapped_column(Float)
    score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    temperature: Mapped[str] = mapped_column(
        String(10), default=LeadTemperature.COLD, index=True
    )
    status: Mapped[str] = mapped_column(String(50), default=LeadStatus.NEW, index=True)
    priority: Mapped[str] = mapped_column(String(20), default=Priority.MEDIUM)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    last_interaction_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tag_entities: Mapped[list[Tag]] = relationship(secondary=lead_tags, back_populates="leads")
    notes: Mapped[list[LeadNote]] = relationship(back_populates="lead")
    scores: Mapped[list[LeadScore]] = relationship(back_populates="lead")

    @property
    def tags(self) -> list[str]:
        return [t.name for t in self.tag_entities]


class LeadScore(Base):
    __tablename__ = "lead_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    budget_score: Mapped[int] = mapped_column(Integer, default=0)
    urgency_score: Mapped[int] = mapped_column(Integer, default=0)
    service_fit_score: Mapped[int] = mapped_column(Integer, default=0)
    decision_authority_score: Mapped[int] = mapped_column(Integer, default=0)
    company_size_score: Mapped[int] = mapped_column(Integer, default=0)
    profile_completeness_score: Mapped[int] = mapped_column(Integer, default=0)
    reasoning_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    calculated_by: Mapped[str] = mapped_column(String(50), default="system")

    lead: Mapped[Lead] = relationship(back_populates="scores")


class LeadScoreHistory(Base):
    __tablename__ = "lead_score_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    previous_score: Mapped[int] = mapped_column(Integer)
    new_score: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(Text)
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    changed_by_system: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LeadAssignmentHistory(Base):
    __tablename__ = "lead_assignment_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    previous_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    new_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    assigned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lead: Mapped[Lead] = relationship(back_populates="notes")
