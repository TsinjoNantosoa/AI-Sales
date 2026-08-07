"""Common helpers."""

from __future__ import annotations

import re
from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)


def to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat().replace("+00:00", "Z")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"[^\d+]", "", phone.strip())
    return digits or None


def company_domain(email: str) -> str | None:
    parts = email.split("@")
    if len(parts) != 2:
        return None
    domain = parts[1].lower()
    free = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "proton.me"}
    if domain in free:
        return None
    return domain
