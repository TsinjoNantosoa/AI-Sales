"""Agent tools — call backend services only, never raw SQL."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead
from app.services.assignment import LeadAssignmentService
from app.services.scoring import LeadScoringService


async def tool_update_lead_fields(
    db: AsyncSession,
    lead: Lead,
    fields: dict[str, Any],
) -> Lead:
    allowed = {
        "service_interest",
        "budget_min",
        "budget_max",
        "timeline",
        "need_description",
        "decision_authority",
        "company_size",
        "phone",
        "preferred_contact_channel",
    }
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(lead, k, v)
    await db.flush()
    return lead


async def tool_rescore_lead(db: AsyncSession, lead: Lead) -> Lead:
    scoring = LeadScoringService(db)
    lead, _ = await scoring.score_and_persist(lead, reason="AI agent update", calculated_by="ai")
    return lead


async def tool_auto_assign(db: AsyncSession, lead: Lead) -> Lead:
    if lead.assigned_user_id:
        return lead
    return await LeadAssignmentService(db).auto_assign(lead)


async def tool_get_slots(db: AsyncSession, user_id: str, date: str) -> list[str]:
    from app.services.appointment import AppointmentService

    return await AppointmentService(db).available_slots(date, user_id)
