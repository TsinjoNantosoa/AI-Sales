"""Schemas for the public (unauthenticated) chatbot / booking flow."""

from __future__ import annotations

from pydantic import Field

from app.schemas.base import APIModel
from app.schemas.common import ConversationOut, MessageOut
from app.schemas.lead import LeadOut


class PublicLeadCreateResponse(APIModel):
    lead: LeadOut
    conversation_id: str
    public_token: str
    expires_in: int = 3600


class PublicMessageCreate(APIModel):
    content: str = Field(min_length=1, max_length=8000)
    sender: str | None = None  # FE compat; ignored for public user messages


class PublicQualifyRequest(APIModel):
    step: int
    answer: str
    lead_id: str | None = None


class QualificationInfo(APIModel):
    score: int
    temperature: str
    progress: float
    missing_fields: list[str] = []
    recommended_action: str = ""


class PublicMessageResponse(APIModel):
    conversation: ConversationOut
    assistant_message: MessageOut
    lead: LeadOut
    qualification: QualificationInfo


class PublicConversationCreate(APIModel):
    lead_id: str
    public_token: str | None = None


class PublicAppointmentCreate(APIModel):
    """Same fields as AppointmentCreate; lead/salesperson filled from token when omitted."""

    lead_id: str | None = None
    lead_name: str = ""
    lead_company: str = ""
    lead_email: str = ""
    assigned_user_id: str | None = None
    salesperson_name: str = ""
    date: str
    time: str
    duration: int = 30
    timezone: str = "UTC"
    type: str
    status: str = "Confirmed"
    meeting_link: str | None = None
    notes: str | None = None
    google_meet: bool = True
    public_token: str | None = None
