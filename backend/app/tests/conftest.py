"""Pytest fixtures."""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Must set before importing app settings
os.environ["APP_ENV"] = "test"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-at-least-32-characters-long"
os.environ["ENCRYPTION_KEY"] = "test-encryption-key-32-bytes-long!"
os.environ["AI_MOCK_MODE"] = "true"
os.environ["EMAIL_MOCK_MODE"] = "true"

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/ai_sales_test",
)


def _postgres_available() -> bool:
    try:
        import asyncio

        import asyncpg

        dsn = TEST_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

        async def _ping() -> bool:
            try:
                conn = await asyncpg.connect(dsn=dsn, timeout=2)
                await conn.close()
                return True
            except Exception:
                return False

        return asyncio.get_event_loop().run_until_complete(_ping())
    except Exception:
        return False


POSTGRES_OK = False
try:
    import asyncio

    loop = asyncio.new_event_loop()
    try:

        async def _check() -> bool:
            try:
                import asyncpg

                dsn = TEST_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
                # create db if missing is out of scope; just try connect
                conn = await asyncpg.connect(dsn=dsn, timeout=2)
                await conn.close()
                return True
            except Exception:
                return False

        POSTGRES_OK = loop.run_until_complete(_check())
    finally:
        loop.close()
except Exception:
    POSTGRES_OK = False

requires_db = pytest.mark.skipif(not POSTGRES_OK, reason="Postgres test DB not available")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def db_engine():
    if not POSTGRES_OK:
        pytest.skip("Postgres test DB not available")
    import app.models  # noqa: F401
    from app.core.database import Base

    engine = create_async_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_engine) -> AsyncGenerator[AsyncClient, None]:
    from app.core.database import get_db
    from app.core.enums import UserRole, UserStatus
    from app.core.security import hash_password
    from app.main import create_app
    from app.models.user import User

    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)

    async with Session() as session:
        for email, first, last, role in [
            ("admin@aisales.demo", "Alex", "Admin", UserRole.ADMIN),
            ("manager@aisales.demo", "Morgan", "Manager", UserRole.SALES_MANAGER),
            ("sales@aisales.demo", "Sam", "Seller", UserRole.SALES_REPRESENTATIVE),
        ]:
            session.add(
                User(
                    id=uuid.uuid5(uuid.NAMESPACE_DNS, email),
                    email=email,
                    first_name=first,
                    last_name=last,
                    role=role,
                    status=UserStatus.ACTIVE,
                    password_hash=hash_password("Demo123!"),
                    language="en",
                    timezone="UTC",
                )
            )
        await session.commit()

    app = create_app()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
