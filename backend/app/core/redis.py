"""Redis client helpers."""

from __future__ import annotations

from typing import Any

import redis.asyncio as redis
from app.core.config import get_settings

_redis: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        close = getattr(_redis, "aclose", None) or _redis.close
        result = close()
        if hasattr(result, "__await__"):
            await result
        _redis = None


async def cache_get(key: str) -> str | None:
    client = await get_redis()
    return await client.get(key)


async def cache_set(key: str, value: str, ttl_seconds: int = 60) -> None:
    client = await get_redis()
    await client.set(key, value, ex=ttl_seconds)


async def cache_delete(key: str) -> None:
    client = await get_redis()
    await client.delete(key)


async def incr_with_ttl(key: str, ttl_seconds: int) -> int:
    client = await get_redis()
    pipe = client.pipeline()
    pipe.incr(key)
    pipe.expire(key, ttl_seconds)
    results: list[Any] = await pipe.execute()
    return int(results[0])
