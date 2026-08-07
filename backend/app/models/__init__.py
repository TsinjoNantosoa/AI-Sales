"""SQLAlchemy models package."""

from app.models.activity import Activity
from app.models.appointment import Appointment, CalendarConnection
from app.models.audit import AuditLog
from app.models.conversation import Conversation, Message
from app.models.email import EmailLog, EmailTemplate
from app.models.integration import IntegrationConnection
from app.models.knowledge import FAQEntry, KnowledgeChunk, KnowledgeDocument
from app.models.lead import (
    Lead,
    LeadAssignmentHistory,
    LeadNote,
    LeadScore,
    LeadScoreHistory,
    Tag,
    lead_tags,
)
from app.models.notification import Notification
from app.models.setting import AppSetting
from app.models.task import Task
from app.models.user import PasswordResetToken, RefreshToken, User
from app.models.workflow import Workflow, WorkflowExecution

__all__ = [
    "User",
    "RefreshToken",
    "PasswordResetToken",
    "Lead",
    "LeadScore",
    "LeadScoreHistory",
    "LeadAssignmentHistory",
    "Tag",
    "lead_tags",
    "LeadNote",
    "Conversation",
    "Message",
    "Appointment",
    "CalendarConnection",
    "Task",
    "Notification",
    "Workflow",
    "WorkflowExecution",
    "EmailTemplate",
    "EmailLog",
    "IntegrationConnection",
    "AppSetting",
    "AuditLog",
    "Activity",
    "KnowledgeDocument",
    "KnowledgeChunk",
    "FAQEntry",
]
