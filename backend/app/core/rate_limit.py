"""Simple Redis-backed rate limiting."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.exceptions import RateLimitError
from app.core.redis import incr_with_ttl
from fastapi import Request


def _parse_limit(limit: str) -> tuple[int, int]:
    """Parse '100/minute' → (100, 60)."""
    count_str, period = limit.lower().split("/")
    count = int(count_str)
    period_map = {
        "second": 1,
        "minute": 60,
        "hour": 3600,
        "day": 86400,
    }
    seconds = period_map.get(period.strip(), 60)
    return count, seconds


async def check_rate_limit(
    request: Request,
    *,
    key_suffix: str,
    limit: str | None = None,
) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled or settings.app_env == "test":
        return

    max_count, window = _parse_limit(limit or settings.rate_limit_default)
    client_ip = request.client.host if request.client else "unknown"
    key = f"rl:{key_suffix}:{client_ip}"

    try:
        current = await incr_with_ttl(key, window)
    except Exception:
        # Fail open if Redis is down
        return

    if current > max_count:
        raise RateLimitError(details={"limit": limit or settings.rate_limit_default})
