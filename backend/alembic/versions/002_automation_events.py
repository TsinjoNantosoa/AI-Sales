"""Add automation_events outbox table.

Revision ID: 002
Revises: 001
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
CREATE TABLE automation_events (
    id UUID PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(80) NOT NULL,
    aggregate_type VARCHAR(50),
    aggregate_id VARCHAR(64),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    conversation_id UUID,
    appointment_id UUID,
    correlation_id VARCHAR(64),
    payload_json JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    dispatched_at TIMESTAMP WITH TIME ZONE
)
""")
    op.execute("CREATE INDEX ix_automation_events_event_type ON automation_events (event_type)")
    op.execute("CREATE INDEX ix_automation_events_status ON automation_events (status)")
    op.execute("CREATE INDEX ix_automation_events_lead_id ON automation_events (lead_id)")
    op.execute("CREATE INDEX ix_automation_events_correlation_id ON automation_events (correlation_id)")
    op.execute("CREATE INDEX ix_automation_events_aggregate_id ON automation_events (aggregate_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS automation_events;")
