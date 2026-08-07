"""User / team routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.auth import UserInviteRequest, UserOut, UserStatsOut, UserUpdateRequest
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[UserOut]:
    return await UserService(db).list_users(current_user)


@router.post("/invite", response_model=UserOut)
async def invite_user(
    body: UserInviteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> UserOut:
    return await UserService(db).invite(body, current_user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> UserOut:
    return await UserService(db).get_user(user_id, current_user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> UserOut:
    return await UserService(db).update(user_id, body, current_user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await UserService(db).delete(user_id, current_user)
    return {"message": "ok"}


@router.get("/{user_id}/stats", response_model=UserStatsOut)
async def user_stats(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> UserStatsOut:
    return await UserService(db).stats(user_id, current_user)
