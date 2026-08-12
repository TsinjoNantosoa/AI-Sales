"""Shared enums matching frontend TypeScript contracts."""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    SALES_MANAGER = "SALES_MANAGER"
    SALES_REPRESENTATIVE = "SALES_REPRESENTATIVE"


class UserStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    INVITED = "invited"
    DISABLED = "disabled"


class LeadStatus(StrEnum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFYING = "QUALIFYING"
    QUALIFIED = "QUALIFIED"
    MEETING_SCHEDULED = "MEETING_SCHEDULED"
    PROPOSAL_SENT = "PROPOSAL_SENT"
    NEGOTIATION = "NEGOTIATION"
    WON = "WON"
    LOST = "LOST"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class LeadTemperature(StrEnum):
    COLD = "COLD"
    WARM = "WARM"
    HOT = "HOT"


class LeadSource(StrEnum):
    WEBSITE = "Website"
    CHATBOT = "Chatbot"
    EMAIL = "Email"
    REFERRAL = "Referral"
    LINKEDIN = "LinkedIn"
    WHATSAPP = "WhatsApp"
    MANUAL = "Manual"
    IMPORT = "Import"
    OTHER = "Other"


class Priority(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    URGENT = "Urgent"


class ConversationChannel(StrEnum):
    CHATBOT = "chatbot"
    EMAIL = "email"
    PHONE = "phone"
    WHATSAPP = "whatsapp"
    WEB_CHAT = "web_chat"
    SMS = "sms"
    MANUAL = "manual"


class ConversationStatus(StrEnum):
    OPEN = "open"
    WAITING = "waiting"
    ASSIGNED = "assigned"
    AI_HANDLED = "ai_handled"
    HUMAN_HANDOFF = "human_handoff"
    CLOSED = "closed"


class MessageSender(StrEnum):
    USER = "user"
    AI = "ai"
    AGENT = "agent"
    LEAD = "lead"
    SYSTEM = "system"


class AppointmentStatus(StrEnum):
    PROPOSED = "Proposed"
    CONFIRMED = "Confirmed"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    NO_SHOW = "No Show"


class AppointmentType(StrEnum):
    INTRO_15 = "15-minute introduction"
    DISCOVERY_30 = "30-minute discovery call"
    TECHNICAL_60 = "60-minute technical consultation"


class TaskStatus(StrEnum):
    TODO = "To Do"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class NotificationCategory(StrEnum):
    LEADS = "leads"
    MEETINGS = "meetings"
    TASKS = "tasks"
    AUTOMATIONS = "automations"
    SYSTEM = "system"


class WorkflowStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ExecutionStatus(StrEnum):
    SUCCESS = "Success"
    RUNNING = "Running"
    FAILED = "Failed"
    RETRYING = "Retrying"
    WAITING = "Waiting"


class AutomationEventStatus(StrEnum):
    PENDING = "pending"
    DISPATCHING = "dispatching"
    DISPATCHED = "dispatched"
    FAILED = "failed"


class IntegrationStatus(StrEnum):
    CONNECTED = "connected"
    AVAILABLE = "available"
    COMING_SOON = "coming_soon"
    DISCONNECTED = "DISCONNECTED"
    CONNECTING = "CONNECTING"
    ERROR = "ERROR"


class IntegrationProvider(StrEnum):
    N8N = "n8n"
    GOOGLE_CALENDAR = "google-calendar"
    GMAIL = "gmail"
    HUBSPOT = "hubspot"
    ODOO = "odoo"
    AIRTABLE = "airtable"
    SLACK = "slack"
    MICROSOFT_TEAMS = "microsoft-teams"
    WHATSAPP = "whatsapp"
    TWILIO = "twilio"
    OUTLOOK = "outlook"


class ActivityType(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    MESSAGE = "message"
    EMAIL = "email"
    SCORED = "scored"
    ASSIGNED = "assigned"
    TASK = "task"
    APPOINTMENT = "appointment"
    STATUS_CHANGED = "status_changed"
    NOTE = "note"


class EmailLogStatus(StrEnum):
    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    FAILED = "failed"


class AuditResult(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
