"""Dashboard, analytics, settings, automation, integration schemas."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.schemas.base import APIModel


class DashboardChanges(APIModel):
    total_leads: float = 0
    new_leads: float = 0
    qualified_leads: float = 0
    hot_leads: float = 0
    meetings_booked: float = 0
    conversion_rate: float = 0
    pipeline_value: float = 0


class DashboardOverview(APIModel):
    total_leads: int
    new_leads: int
    qualified_leads: int
    hot_leads: int
    meetings_booked: int
    conversion_rate: float
    pipeline_value: float
    average_response_time_seconds: float = 0
    avg_response_time: str = "—"
    changes: DashboardChanges = Field(default_factory=DashboardChanges)


class LeadTrendPoint(APIModel):
    date: str
    leads: int
    qualified: int
    value: float | None = None


class PipelineMetric(APIModel):
    status: str
    label: str | None = None
    count: int
    value: float = 0


class PipelineStage(APIModel):
    status: str
    count: int
    value: float = 0


class SourceMetric(APIModel):
    source: str
    count: int
    qualification_rate: float = 0
    conversion_rate: float = 0
    pipeline_value: float = 0


class SourceData(APIModel):
    source: str
    count: int
    percentage: float = 0


class TeamPerformanceMetric(APIModel):
    user_id: str
    name: str
    assigned_leads: int
    qualified_leads: int
    meetings: int
    wins: int
    conversion_rate: float
    revenue: float


class AutomationPerformanceMetric(APIModel):
    workflow_id: str
    workflow_name: str
    executions: int
    success_rate: float
    average_duration_ms: float
    failed_executions: int
    recovered_executions: int = 0


class AiPerformance(APIModel):
    conversations_handled: int = 0
    qualification_rate: float = 0
    avg_score: float = 0
    human_handoff_rate: float = 0
    appointment_rate: float = 0


class AnalyticsData(APIModel):
    lead_trend: list[LeadTrendPoint] = []
    funnel: list[PipelineMetric] = []
    sources: list[SourceMetric] = []
    team_performance: list[TeamPerformanceMetric] = []
    automation_performance: list[AutomationPerformanceMetric] = []
    avg_time_by_stage: list[dict[str, Any]] | None = None
    ai_performance: AiPerformance | None = None


class ActivityOut(APIModel):
    id: str
    lead_id: str
    lead_name: str
    type: str
    description: str
    user_id: str | None = None
    user_name: str | None = None
    created_at: str


class AuditLogOut(APIModel):
    id: str
    timestamp: str
    user_id: str
    user_name: str
    action: str
    entity: str
    entity_id: str
    ip: str
    result: str
    details: str


class AuditLogCreate(APIModel):
    user_id: str = "system"
    user_name: str = "System"
    action: str
    entity: str
    entity_id: str
    ip: str = "127.0.0.1"
    result: str = "success"
    details: str = ""


class WorkflowOut(APIModel):
    id: str
    name: str
    description: str
    status: str
    last_execution: str | None = None
    success_rate: float
    total_executions: int
    avg_duration: str
    errors: int


class WorkflowExecutionOut(APIModel):
    id: str
    workflow_id: str
    workflow_name: str
    status: str
    started_at: str
    duration: str
    retry_count: int = 0
    related_lead_id: str | None = None
    related_lead_name: str | None = None
    error_message: str | None = None


class IntegrationOut(APIModel):
    id: str
    name: str
    description: str
    logo: str
    status: str
    last_sync: str | None = None
    category: str


class IntegrationConfigure(APIModel):
    configured: bool = True
    config: dict[str, str] | None = None


class AvailabilityDay(APIModel):
    day: str
    enabled: bool
    start: str
    end: str


class GeneralSettings(APIModel):
    company_name: str = "AI Sales Assistant"
    timezone: str = "America/New_York"
    default_language: str = "en"
    currency: str = "USD"
    date_format: str = "MMM d, yyyy"


class LeadManagementSettings(APIModel):
    auto_assign: bool = True
    default_assignee_id: str = ""
    duplicate_detection: bool = True
    archive_after_days: int = 90


class LeadScoringSettings(APIModel):
    hot_threshold: int = 70
    warm_threshold: int = 40
    auto_qualify_at: int = 70


class AiAssistantSettings(APIModel):
    enabled: bool = True
    name: str = "Ava"
    tone: str = "professional"
    handoff_threshold: int = 3


class FollowUpsSettings(APIModel):
    enabled: bool = True
    first_follow_up_hours: int = 24
    max_attempts: int = 3


class EmailTemplatesSettings(APIModel):
    welcome_subject: str = "Welcome to AI Sales Assistant"
    meeting_subject: str = "Your meeting is confirmed"
    follow_up_subject: str = "Following up on your inquiry"


class NotificationsSettings(APIModel):
    email_enabled: bool = True
    in_app_enabled: bool = True
    hot_lead_alerts: bool = True
    meeting_reminders: bool = True


class SecuritySettings(APIModel):
    session_timeout_minutes: int = 60
    require_mfa: bool = False
    password_min_length: int = 8


class AvailabilitySettings(APIModel):
    timezone: str = "America/New_York"
    buffer_minutes: int = 15
    days: list[AvailabilityDay] = Field(default_factory=list)


class AppSettingsOut(APIModel):
    general: GeneralSettings = Field(default_factory=GeneralSettings)
    lead_management: LeadManagementSettings = Field(default_factory=LeadManagementSettings)
    lead_scoring: LeadScoringSettings = Field(default_factory=LeadScoringSettings)
    ai_assistant: AiAssistantSettings = Field(default_factory=AiAssistantSettings)
    follow_ups: FollowUpsSettings = Field(default_factory=FollowUpsSettings)
    email_templates: EmailTemplatesSettings = Field(default_factory=EmailTemplatesSettings)
    notifications: NotificationsSettings = Field(default_factory=NotificationsSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    availability: AvailabilitySettings = Field(default_factory=AvailabilitySettings)


class AppSettingsPatch(APIModel):
    general: GeneralSettings | None = None
    lead_management: LeadManagementSettings | None = None
    lead_scoring: LeadScoringSettings | None = None
    ai_assistant: AiAssistantSettings | None = None
    follow_ups: FollowUpsSettings | None = None
    email_templates: EmailTemplatesSettings | None = None
    notifications: NotificationsSettings | None = None
    security: SecuritySettings | None = None
    availability: AvailabilitySettings | None = None


class EmailLogOut(APIModel):
    id: str
    lead_id: str | None = None
    subject: str
    recipient: str
    status: str
    template: str
    sent_at: str


class EmailSendRequest(APIModel):
    to: str
    subject: str
    body: str = ""
    template_slug: str | None = None
    lead_id: str | None = None


class ErrorResponse(APIModel):
    message: str
    detail: str | None = None
    error: dict[str, Any] | None = None


class TestConnectionResponse(APIModel):
    ok: bool
    message: str


class MessageResponse(APIModel):
    message: str
