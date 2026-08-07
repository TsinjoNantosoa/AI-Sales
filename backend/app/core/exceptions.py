"""Domain exceptions and HTTP error helpers."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    code: str = "APP_ERROR"
    status_code: int = 400
    message: str = "An error occurred"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: dict[str, Any] | None = None,
        status_code: int | None = None,
    ) -> None:
        self.message = message or self.message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(AppError):
    code = "AUTHENTICATION_ERROR"
    status_code = 401
    message = "Authentication required"


class AuthorizationError(AppError):
    code = "AUTHORIZATION_ERROR"
    status_code = 403
    message = "You do not have permission to perform this action"


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404
    message = "Resource not found"


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = 409
    message = "Conflict"


class ValidationAppError(AppError):
    code = "VALIDATION_ERROR"
    status_code = 422
    message = "Validation error"


class IntegrationError(AppError):
    code = "INTEGRATION_ERROR"
    status_code = 502
    message = "Integration error"


class ExternalServiceError(AppError):
    code = "EXTERNAL_SERVICE_ERROR"
    status_code = 502
    message = "External service error"


class RateLimitError(AppError):
    code = "RATE_LIMIT_EXCEEDED"
    status_code = 429
    message = "Rate limit exceeded"


class DuplicateLeadError(ConflictError):
    code = "DUPLICATE_LEAD"
    message = "A lead with this email or phone already exists"


class AppointmentConflictError(ConflictError):
    code = "APPOINTMENT_CONFLICT"
    message = "Appointment slot is no longer available"
