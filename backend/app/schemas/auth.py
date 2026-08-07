"""Auth and user schemas — aligned with frontend AuthUser / User."""

from __future__ import annotations

from pydantic import EmailStr, Field

from app.core.enums import UserRole
from app.schemas.base import APIModel


class AuthUserOut(APIModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    role: str
    avatar: str | None = None
    timezone: str
    language: str


class LoginRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(APIModel):
    """Frontend expects { user, token }. Extra fields are optional."""

    user: AuthUserOut
    token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int = 900


class ForgotPasswordRequest(APIModel):
    email: EmailStr


class ForgotPasswordResponse(APIModel):
    reset_token: str | None = None
    message: str = "If the email exists, a reset link has been sent."


class ResetPasswordRequest(APIModel):
    token: str
    password: str = Field(min_length=8)


class RefreshRequest(APIModel):
    refresh_token: str


class UserOut(APIModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    role: str
    status: str
    avatar: str | None = None
    language: str
    timezone: str
    assigned_leads: int = 0
    active_opportunities: int = 0
    meetings: int = 0
    conversion_rate: float = 0.0
    last_active: str
    calendar_connected: bool = False
    created_at: str


class UserInviteRequest(APIModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole


class UserUpdateRequest(APIModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    language: str | None = None
    timezone: str | None = None
    status: str | None = None
    avatar: str | None = None
    role: UserRole | None = None


class UserStatsOut(APIModel):
    assigned_leads: int
    active_opportunities: int
    meetings: int
    wins: int
    conversion_rate: float
    revenue: float
