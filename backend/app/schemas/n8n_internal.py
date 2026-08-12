"""Pydantic schemas for n8n internal API."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.schemas.base import APIModel


class ExecutionStartRequest(APIModel):
    workflow_slug: str = Field(alias="workflowSlug")
    event_id: str = Field(alias="eventId")
    external_execution_id: str | None = Field(default=None, alias="externalExecutionId")
    lead_id: str | None = Field(default=None, alias="leadId")
    input: dict[str, Any] = Field(default_factory=dict)
    started_at: str | None = Field(default=None, alias="startedAt")
    correlation_id: str | None = Field(default=None, alias="correlationId")


class ExecutionStartResponse(APIModel):
    execution_id: str = Field(alias="executionId")
    duplicate: bool = False
    workflow_enabled: bool = Field(alias="workflowEnabled")


class ExecutionSuccessRequest(APIModel):
    external_execution_id: str | None = Field(default=None, alias="externalExecutionId")
    duration_ms: int | None = Field(default=None, alias="durationMs")
    output: dict[str, Any] = Field(default_factory=dict)
    retry_count: int | None = Field(default=None, alias="retryCount")


class ExecutionFailureRequest(APIModel):
    error_message: str = Field(alias="errorMessage")
    external_execution_id: str | None = Field(default=None, alias="externalExecutionId")
    duration_ms: int | None = Field(default=None, alias="durationMs")
    retry_count: int | None = Field(default=None, alias="retryCount")
    retrying: bool = False


class ExecutionActionResponse(APIModel):
    execution_id: str = Field(alias="executionId")
    status: str


class FollowUpExecuteRequest(APIModel):
    idempotency_key: str | None = Field(default=None, alias="idempotencyKey")


class FailureReportRequest(APIModel):
    workflow: dict[str, Any] = Field(default_factory=dict)
    execution: dict[str, Any] = Field(default_factory=dict)
    error_message: str = Field(alias="errorMessage")
    external_execution_id: str | None = Field(default=None, alias="externalExecutionId")


class IdempotentActionResponse(APIModel):
    sent: bool | None = None
    duplicate: bool = False
    skipped: bool | None = None
    reason: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
