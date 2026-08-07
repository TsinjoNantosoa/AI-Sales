"""Lead scoring — mirrors frontend lib/score.ts."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import LeadTemperature
from app.models.lead import Lead, LeadScore, LeadScoreHistory
from app.schemas.lead import ScoreBreakdownOut


def temperature_from_score(score: int) -> LeadTemperature:
    if score >= 70:
        return LeadTemperature.HOT
    if score >= 40:
        return LeadTemperature.WARM
    return LeadTemperature.COLD


def compute_lead_score(lead: Lead | dict[str, Any]) -> dict[str, Any]:
    """Compute score breakdown matching frontend computeLeadScore."""

    def g(key: str, default: Any = None) -> Any:
        if isinstance(lead, dict):
            return lead.get(key, default)
        return getattr(lead, key, default)

    budget_fit = 10
    budget_max = g("budget_max")
    budget_min = g("budget_min")
    if budget_max and budget_max >= 10000:
        budget_fit = 25
    elif budget_max and budget_max >= 5000:
        budget_fit = 20
    elif budget_max and budget_max >= 3000:
        budget_fit = 15
    elif budget_min and budget_min >= 1000:
        budget_fit = 12

    urgency = 8
    timeline = (g("timeline") or "").lower()
    if "immediately" in timeline:
        urgency = 20
    elif "30" in timeline:
        urgency = 16
    elif "3 month" in timeline:
        urgency = 10

    service_fit = 10
    interest = (g("service_interest") or "").lower()
    if "ai" in interest or "automation" in interest or "rag" in interest:
        service_fit = 18
    elif interest:
        service_fit = 14

    decision_authority = 8
    auth = (g("decision_authority") or "").lower()
    if "yes" in auth or "decide" in auth:
        decision_authority = 15
    elif "team" in auth:
        decision_authority = 10

    company_size_score = 8
    size = g("company_size") or ""
    if "500" in size or "201" in size:
        company_size_score = 12
    elif "51" in size or "11" in size:
        company_size_score = 10

    profile_completeness = 0
    if g("first_name"):
        profile_completeness += 2
    if g("last_name"):
        profile_completeness += 2
    if g("email"):
        profile_completeness += 2
    if g("company_name"):
        profile_completeness += 2
    if g("phone"):
        profile_completeness += 1
    need = g("need_description") or ""
    if need and len(need) > 20:
        profile_completeness += 3
    if g("country"):
        profile_completeness += 1
    if g("service_interest"):
        profile_completeness += 2
    profile_completeness = min(profile_completeness, 15)

    total = min(
        100,
        budget_fit
        + urgency
        + service_fit
        + decision_authority
        + company_size_score
        + profile_completeness,
    )

    reasoning: list[str] = []
    if budget_fit >= 20:
        reasoning.append("Strong budget fit")
    if urgency >= 16:
        reasoning.append("High urgency timeline")
    if service_fit >= 18:
        reasoning.append("Service interest aligns with AI/automation")
    if decision_authority >= 15:
        reasoning.append("Decision maker identified")

    temperature = temperature_from_score(total)
    recommended = "Prioritize outreach" if temperature == LeadTemperature.HOT else "Nurture"

    return {
        "budget_fit": budget_fit,
        "urgency": urgency,
        "service_fit": service_fit,
        "decision_authority": decision_authority,
        "company_size": company_size_score,
        "profile_completeness": profile_completeness,
        "total": total,
        "temperature": temperature,
        "recommended_action": recommended,
        "reasoning": reasoning,
    }


def parse_budget_range(label: str) -> dict[str, float]:
    if "More than $10,000" in label:
        return {"budget_min": 10000, "budget_max": 25000, "estimated_value": 15000}
    if "Less than" in label:
        return {"budget_min": 0, "budget_max": 1000, "estimated_value": 800}
    if "$5,000" in label:
        return {"budget_min": 5000, "budget_max": 10000, "estimated_value": 7500}
    if "$3,000" in label:
        return {"budget_min": 3000, "budget_max": 5000, "estimated_value": 4000}
    if "$1,000" in label:
        return {"budget_min": 1000, "budget_max": 3000, "estimated_value": 2000}
    return {}


class LeadScoringService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def breakdown(self, lead: Lead) -> ScoreBreakdownOut:
        data = compute_lead_score(lead)
        return ScoreBreakdownOut(**data)

    async def score_and_persist(
        self,
        lead: Lead,
        *,
        user_id: uuid.UUID | None = None,
        reason: str | None = None,
        calculated_by: str = "system",
    ) -> tuple[Lead, dict[str, Any]]:
        data = compute_lead_score(lead)
        previous = lead.score or 0
        new_score = int(data["total"])
        lead.score = new_score
        lead.temperature = data["temperature"]

        score_row = LeadScore(
            lead_id=lead.id,
            total_score=new_score,
            budget_score=data["budget_fit"],
            urgency_score=data["urgency"],
            service_fit_score=data["service_fit"],
            decision_authority_score=data["decision_authority"],
            company_size_score=data["company_size"],
            profile_completeness_score=data["profile_completeness"],
            reasoning_json={"reasoning": data["reasoning"], "recommended_action": data["recommended_action"]},
            calculated_by=calculated_by,
        )
        self.db.add(score_row)
        self.db.add(
            LeadScoreHistory(
                lead_id=lead.id,
                previous_score=previous,
                new_score=new_score,
                reason=reason or "Score recalculated",
                changed_by_user_id=user_id,
                changed_by_system=user_id is None,
            )
        )
        await self.db.flush()
        return lead, data
