"""Real Alembic migration cycle against an empty PostgreSQL database."""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[2]

REQUIRED_TABLES = {
    "alembic_version",
    "users",
    "leads",
    "conversations",
    "messages",
    "appointments",
    "tasks",
    "notifications",
    "activities",
    "email_logs",
    "lead_score_history",
    "refresh_tokens",
    "workflows",
    "automation_events",
}


def _base_database_url() -> str:
    return os.environ.get(
        "TEST_DATABASE_URL",
        os.environ.get(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost:5433/ai_sales",
        ),
    )


def _replace_db_name(url: str, db_name: str) -> str:
    parsed = urlparse(url)
    return urlunparse(parsed._replace(path=f"/{db_name}"))


def _asyncpg_dsn(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgresql+psycopg://", "postgresql://"
    )


def _postgres_reachable(admin_url: str) -> bool:
    try:
        import asyncio

        import asyncpg

        async def _ping() -> bool:
            try:
                conn = await asyncpg.connect(_asyncpg_dsn(admin_url), timeout=2)
                await conn.close()
                return True
            except Exception:
                return False

        return asyncio.run(_ping())
    except Exception:
        return False


ADMIN_URL = _replace_db_name(_base_database_url(), "postgres")
MIGRATE_DB = "ai_sales_alembic_test"
MIGRATE_URL = _replace_db_name(_base_database_url(), MIGRATE_DB)

requires_migrate_db = pytest.mark.skipif(
    not _postgres_reachable(ADMIN_URL),
    reason="Postgres not available for Alembic migration test",
)


async def _recreate_empty_database() -> None:
    import asyncpg

    admin = await asyncpg.connect(_asyncpg_dsn(ADMIN_URL))
    try:
        await admin.execute(
            """
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1 AND pid <> pg_backend_pid()
            """,
            MIGRATE_DB,
        )
        await admin.execute(f'DROP DATABASE IF EXISTS "{MIGRATE_DB}"')
        await admin.execute(f'CREATE DATABASE "{MIGRATE_DB}"')
    finally:
        await admin.close()


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = MIGRATE_URL
    # Avoid picking a stale sync URL from developer .env
    env["DATABASE_URL_SYNC"] = MIGRATE_URL.replace("+asyncpg://", "+psycopg://")
    env["APP_ENV"] = "test"
    env["JWT_SECRET_KEY"] = env.get(
        "JWT_SECRET_KEY", "test-secret-key-at-least-32-characters-long"
    )
    env["ENCRYPTION_KEY"] = env.get("ENCRYPTION_KEY", "test-encryption-key-32-bytes-long!")
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


async def _list_tables() -> set[str]:
    import asyncpg

    conn = await asyncpg.connect(_asyncpg_dsn(MIGRATE_URL))
    try:
        rows = await conn.fetch(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            """
        )
        return {r["tablename"] for r in rows}
    finally:
        await conn.close()


@requires_migrate_db
@pytest.mark.asyncio
async def test_alembic_upgrade_downgrade_on_empty_database():
    await _recreate_empty_database()

    upgrade = _run_alembic("upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stdout + "\n" + upgrade.stderr

    tables = await _list_tables()
    missing = REQUIRED_TABLES - tables
    assert not missing, f"Missing tables after upgrade: {sorted(missing)}"

    # downgrade -1 steps back from 002 → 001; core tables remain, outbox is dropped
    downgrade = _run_alembic("downgrade", "-1")
    assert downgrade.returncode == 0, downgrade.stdout + "\n" + downgrade.stderr

    tables_after_down = await _list_tables()
    # Stepped back to revision 001 — business tables still present
    assert "leads" in tables_after_down
    assert "users" in tables_after_down
    # The outbox table added by 002 must be gone
    assert "automation_events" not in tables_after_down

    upgrade_again = _run_alembic("upgrade", "head")
    assert upgrade_again.returncode == 0, upgrade_again.stdout + "\n" + upgrade_again.stderr

    tables_final = await _list_tables()
    missing_final = REQUIRED_TABLES - tables_final
    assert not missing_final, f"Missing tables after second upgrade: {sorted(missing_final)}"

    # Sanity: alembic reports current head (002)
    current = _run_alembic("current")
    assert current.returncode == 0, current.stdout + "\n" + current.stderr
    assert re.search(r"\b002\b", current.stdout + current.stderr)
