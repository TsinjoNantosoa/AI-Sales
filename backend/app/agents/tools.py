"""Agent tools — call backend services only, never raw SQL / never set score directly."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead
from app.services.assignment import LeadAssignmentService
from app.services.scoring import LeadScoringService

ALLOWED_LEAD_FIELDS = frozenset(
    {
        "service_interest",
        "budget_min",
        "budget_max",
        "estimated_value",
        "timeline",
        "need_description",
        "decision_authority",
        "company_size",
        "phone",
        "preferred_contact_channel",
    }
)

# Map structured-output / camelCase keys → Lead columns
FIELD_ALIASES = {
    "serviceInterest": "service_interest",
    "budgetMin": "budget_min",
    "budgetMax": "budget_max",
    "estimatedValue": "estimated_value",
    "companySize": "company_size",
    "decisionAuthority": "decision_authority",
    "needDescription": "need_description",
    "preferredContactChannel": "preferred_contact_channel",
}


def _normalize_timeline(value: str) -> str:
    text = value.lower()
    if any(x in text for x in ("immediate", "asap", "immédiat", "tout de suite")):
        return "Immediately"
    if any(
        x in text
        for x in ("next month", "sous un mois", "within 30", "30 day", "dans un mois", "1 month")
    ):
        return "Within 30 days"
    if any(x in text for x in ("3 month", "trois mois", "within 3")):
        return "Within 3 months"
    return value


def _normalize_company_size(value: str) -> str:
    import re

    m = re.search(r"(\d{1,4})", value)
    if not m:
        return value
    n = int(m.group(1))
    if n <= 10:
        return "1–10"
    if n <= 50:
        return "11–50"
    if n <= 200:
        return "51–200"
    if n <= 500:
        return "201–500"
    return "500+"


def _normalize_service_interest(value: str) -> str:
    text = value.lower()
    if "crm" in text:
        return "CRM Automation"
    if "n8n" in text or "workflow" in text:
        return "n8n Workflow Development"
    if "rag" in text:
        return "RAG / Knowledge Base"
    if any(x in text for x in ("ai", "automat", "lead", "prospect")):
        return "AI Automation"
    return value


def normalize_extracted_fields(fields: dict[str, Any] | None) -> dict[str, Any]:
    if not fields:
        return {}
    out: dict[str, Any] = {}
    for key, value in fields.items():
        if value is None or value == "":
            continue
        mapped = FIELD_ALIASES.get(key, key)
        if mapped in ALLOWED_LEAD_FIELDS:
            out[mapped] = value
    if "timeline" in out and isinstance(out["timeline"], str):
        out["timeline"] = _normalize_timeline(out["timeline"])
    if "company_size" in out and isinstance(out["company_size"], str):
        out["company_size"] = _normalize_company_size(out["company_size"])
    if "service_interest" in out and isinstance(out["service_interest"], str):
        out["service_interest"] = _normalize_service_interest(out["service_interest"])
    if "budget_max" in out and "estimated_value" not in out:
        try:
            out["estimated_value"] = float(out["budget_max"])
        except (TypeError, ValueError):
            pass
    return out


async def tool_update_lead_fields(
    db: AsyncSession,
    lead: Lead,
    fields: dict[str, Any],
) -> Lead:
    normalized = normalize_extracted_fields(fields)
    for k, v in normalized.items():
        setattr(lead, k, v)
    await db.flush()
    return lead


async def tool_rescore_lead(db: AsyncSession, lead: Lead) -> Lead:
    """LeadScoringService is the only source of truth for score/temperature."""
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


def lead_known_profile(lead: Lead) -> dict[str, Any]:
    """Safe summary for the LLM — no secrets, no other leads."""
    return {
        "firstName": lead.first_name,
        "lastName": lead.last_name,
        "companyName": lead.company_name,
        "email": lead.email,
        "country": lead.country,
        "language": lead.language,
        "serviceInterest": lead.service_interest,
        "companySize": lead.company_size,
        "budgetMin": lead.budget_min,
        "budgetMax": lead.budget_max,
        "timeline": lead.timeline,
        "decisionAuthority": lead.decision_authority,
        "needDescription": (lead.need_description or "")[:500] or None,
        "phone": lead.phone,
        # Informational only — model must not modify these
        "currentScore": lead.score,
        "currentTemperature": lead.temperature,
        "currentStatus": lead.status,
    }
