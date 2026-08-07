"""Application settings service."""

from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser
from app.models.setting import AppSetting
from app.schemas.dashboard import AppSettingsOut, AppSettingsPatch

DEFAULT_SETTINGS: dict = {
    "general": {
        "company_name": "AI Sales Assistant",
        "timezone": "America/New_York",
        "default_language": "en",
        "currency": "USD",
        "date_format": "MMM d, yyyy",
    },
    "lead_management": {
        "auto_assign": True,
        "default_assignee_id": "",
        "duplicate_detection": True,
        "archive_after_days": 90,
    },
    "lead_scoring": {
        "hot_threshold": 70,
        "warm_threshold": 40,
        "auto_qualify_at": 70,
    },
    "ai_assistant": {
        "enabled": True,
        "name": "Ava",
        "tone": "professional",
        "handoff_threshold": 3,
    },
    "follow_ups": {
        "enabled": True,
        "first_follow_up_hours": 24,
        "max_attempts": 3,
    },
    "email_templates": {
        "welcome_subject": "Welcome to AI Sales Assistant",
        "meeting_subject": "Your meeting is confirmed",
        "follow_up_subject": "Following up on your inquiry",
    },
    "notifications": {
        "email_enabled": True,
        "in_app_enabled": True,
        "hot_lead_alerts": True,
        "meeting_reminders": True,
    },
    "security": {
        "session_timeout_minutes": 60,
        "require_mfa": False,
        "password_min_length": 8,
    },
    "availability": {
        "timezone": "America/New_York",
        "buffer_minutes": 15,
        "days": [
            {"day": "Monday", "enabled": True, "start": "09:00", "end": "18:00"},
            {"day": "Tuesday", "enabled": True, "start": "09:00", "end": "18:00"},
            {"day": "Wednesday", "enabled": True, "start": "09:00", "end": "18:00"},
            {"day": "Thursday", "enabled": True, "start": "09:00", "end": "18:00"},
            {"day": "Friday", "enabled": True, "start": "09:00", "end": "18:00"},
            {"day": "Saturday", "enabled": False, "start": "09:00", "end": "13:00"},
            {"day": "Sunday", "enabled": False, "start": "09:00", "end": "13:00"},
        ],
    },
}


class SettingsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _load_merged(self) -> dict:
        merged = deepcopy(DEFAULT_SETTINGS)
        result = await self.db.execute(select(AppSetting))
        for row in result.scalars().all():
            if row.category in merged and isinstance(row.value_json, dict):
                merged[row.category] = {**merged[row.category], **row.value_json}
        return merged

    async def get_settings(self, user: CurrentUser | None = None) -> AppSettingsOut:
        from app.core.permissions import ensure_permission

        if user:
            ensure_permission(user.role, "settings:read")
        data = await self._load_merged()
        return AppSettingsOut.model_validate(data)

    async def patch_settings(self, data: AppSettingsPatch, user: CurrentUser) -> AppSettingsOut:
        from app.core.exceptions import AuthorizationError
        from app.core.permissions import has_permission

        if not (
            has_permission(user.role, "settings:write")
            or has_permission(user.role, "settings:write_limited")
        ):
            raise AuthorizationError("Missing permission: settings:write")
        payload = data.model_dump(exclude_unset=True)
        for category, values in payload.items():
            if values is None:
                continue
            result = await self.db.execute(select(AppSetting).where(AppSetting.category == category))
            row = result.scalar_one_or_none()
            if row is None:
                row = AppSetting(
                    category=category,
                    value_json=values,
                    updated_by_user_id=user.uuid,
                )
                self.db.add(row)
            else:
                row.value_json = {**(row.value_json or {}), **values}
                row.updated_by_user_id = user.uuid
        await self.db.flush()
        return await self.get_settings(user)
