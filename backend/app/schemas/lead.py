"""Lead schemas matching frontend Lead / CreateLeadInput."""

from __future__ import annotations

from pydantic import EmailStr, Field

from app.core.enums import LeadSource, LeadStatus, LeadTemperature, Priority
from app.schemas.base import APIModel


class LeadOut(APIModel):
    id: str
    first_name: str
    last_name: str
    company_name: str
    email: EmailStr
    phone: str | None = None
    country: str
    language: str
    source: str
    service_interest: str
    budget_min: float | None = None
    budget_max: float | None = None
    timeline: str | None = None
    need_description: str
    estimated_value: float | None = None
    score: int
    temperature: str
    status: str
    assigned_user_id: str | None = None
    last_interaction_at: str | None = None
    next_follow_up_at: str | None = None
    consent_given: bool
    tags: list[str] = []
    priority: str
    created_at: str
    updated_at: str
    company_size: str | None = None


class LeadCreate(APIModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    company_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = None
    country: str = ""
    language: str = "en"
    source: str = LeadSource.WEBSITE
    service_interest: str = ""
    budget_min: float | None = None
    budget_max: float | None = None
    timeline: str | None = None
    need_description: str = ""
    estimated_value: float | None = None
    consent_given: bool = False
    tags: list[str] = []
    priority: Priority = Priority.MEDIUM
    assigned_user_id: str | None = None
    status: LeadStatus = LeadStatus.NEW
    score: int | None = None
    temperature: LeadTemperature | None = None
    company_size: str | None = None


class LeadUpdate(APIModel):
    first_name: str | None = None
    last_name: str | None = None
    company_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    country: str | None = None
    language: str | None = None
    source: str | None = None
    service_interest: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    timeline: str | None = None
    need_description: str | None = None
    estimated_value: float | None = None
    consent_given: bool | None = None
    tags: list[str] | None = None
    priority: Priority | None = None
    assigned_user_id: str | None = None
    status: LeadStatus | None = None
    score: int | None = None
    temperature: LeadTemperature | None = None
    company_size: str | None = None
    decision_authority: str | None = None
    next_follow_up_at: str | None = None


class AssignLeadRequest(APIModel):
    user_id: str


class BulkLeadRequest(APIModel):
    ids: list[str]
    data: LeadUpdate | None = None


class BulkIdsRequest(APIModel):
    ids: list[str]


class LeadImportRequest(APIModel):
    rows: list[LeadCreate]


class LeadImportResponse(APIModel):
    imported: list[LeadOut]
    rejected: list[dict]


class NoteOut(APIModel):
    id: str
    lead_id: str
    content: str
    user_id: str
    user_name: str
    created_at: str
    updated_at: str


class NoteCreate(APIModel):
    content: str = Field(min_length=1, max_length=5000)


class ScoreBreakdownOut(APIModel):
    budget_fit: int
    urgency: int
    service_fit: int
    decision_authority: int
    company_size: int
    profile_completeness: int
    total: int
    temperature: LeadTemperature | None = None
    recommended_action: str | None = None
    reasoning: list[str] = []
