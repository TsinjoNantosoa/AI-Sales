"""Wait until Postgres accepts connections."""

from __future__ import annotations

import asyncio
import os
import sys

import asyncpg


async def wait(url: str, timeout: int = 60) -> None:
    # Convert SQLAlchemy URL to asyncpg DSN
    dsn = url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgresql+psycopg://", "postgresql://"
    )
    deadline = asyncio.get_event_loop().time() + timeout
    last_err: Exception | None = None
    while asyncio.get_event_loop().time() < deadline:
        try:
            conn = await asyncpg.connect(dsn)
            await conn.close()
            print("database ready")
            return
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            await asyncio.sleep(1)
    print(f"database not ready: {last_err}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    database_url = os.environ.get(
        "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_sales"
    )
    asyncio.run(wait(database_url))
