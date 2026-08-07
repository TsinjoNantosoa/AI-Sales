"""Conversation, appointment, task, notification schemas."""

from __future__ import annotations

from pydantic import Field

from app.schemas.base import APIModel


class MessageOut(APIModel):
    id: str
    conversation_id: str
    content: str
    sender: str
    sender_name: str | None = None
    timestamp: str
    read: bool = False
    attachments: list[str] = []


class ConversationOut(APIModel):
    id: str
    lead_id: str
    lead_name: str
    lead_company: str
    lead_email: str
    channel: str
    status: str
    assigned_user_id: str | None = None
    messages: list[MessageOut] = []
    unread_count: int = 0
    last_message: str = ""
    last_message_at: str
    human_handoff_requested: bool = False
    summary: str | None = None
    created_at: str


class ConversationCreate(APIModel):
    lead_id: str


class MessageCreate(APIModel):
    content: str = Field(min_length=1, max_length=8000)
    sender: str = "user"


class QualifyRequest(APIModel):
    lead_id: str
    step: int
    answer: str


class QualifyResponse(APIModel):
    lead: dict
    score: int
    temperature: str
    became_hot: bool


class AiReplyRequest(APIModel):
    message: str


class AiReplyResponse(APIModel):
    message: MessageOut


class AppointmentOut(APIModel):
    id: str
    lead_id: str
    lead_name: str
    lead_company: str
    lead_email: str
    assigned_user_id: str
    salesperson_name: str
    date: str
    time: str
    duration: int
    timezone: str
    type: str
    status: str
    meeting_link: str | None = None
    notes: str | None = None
    google_meet: bool = True
    created_at: str


class AppointmentCreate(APIModel):
    lead_id: str
    lead_name: str = ""
    lead_company: str = ""
    lead_email: str = ""
    assigned_user_id: str
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


class AppointmentUpdate(APIModel):
    date: str | None = None
    time: str | None = None
    duration: int | None = None
    timezone: str | None = None
    type: str | None = None
    status: str | None = None
    meeting_link: str | None = None
    notes: str | None = None
    assigned_user_id: str | None = None
    salesperson_name: str | None = None


class TaskOut(APIModel):
    id: str
    title: str
    description: str | None = None
    lead_id: str | None = None
    lead_name: str | None = None
    assigned_user_id: str
    assigned_user_name: str
    priority: str
    status: str
    due_date: str
    completed_at: str | None = None
    created_at: str


class TaskCreate(APIModel):
    title: str
    description: str | None = None
    lead_id: str | None = None
    lead_name: str | None = None
    assigned_user_id: str
    assigned_user_name: str = ""
    priority: str = "Medium"
    status: str = "To Do"
    due_date: str


class TaskUpdate(APIModel):
    title: str | None = None
    description: str | None = None
    lead_id: str | None = None
    lead_name: str | None = None
    assigned_user_id: str | None = None
    assigned_user_name: str | None = None
    priority: str | None = None
    status: str | None = None
    due_date: str | None = None


class NotificationOut(APIModel):
    id: str
    title: str
    message: str
    category: str
    read: bool
    related_id: str | None = None
    related_type: str | None = None
    created_at: str


class NotificationCreate(APIModel):
    title: str
    message: str
    category: str = "system"
    related_id: str | None = None
    related_type: str | None = None
    user_id: str | None = None
