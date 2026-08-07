"""Auth routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.core.rate_limit import check_rate_limit
from app.schemas.auth import (
    AuthUserOut,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    ResetPasswordRequest,
)
from app.schemas.base import APIModel
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


class LogoutRequest(APIModel):
    refresh_token: str | None = None


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    await check_rate_limit(request, key_suffix="auth.login", limit="20/minute")
    return await AuthService(db).login(
        body.email,
        body.password,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ForgotPasswordResponse:
    await check_rate_limit(request, key_suffix="auth.forgot", limit="10/minute")
    return await AuthService(db).forgot_password(body.email)


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    await AuthService(db).reset_password(body.token, body.password)
    return {"message": "Password updated"}


@router.post("/refresh", response_model=LoginResponse)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    return await AuthService(db).refresh(body.refresh_token)


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await AuthService(db).logout(body.refresh_token, user_id=current_user.uuid)
    return {"message": "Logged out"}


@router.get("/me", response_model=AuthUserOut)
async def me(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AuthUserOut:
    return await AuthService(db).get_me(current_user.uuid)
