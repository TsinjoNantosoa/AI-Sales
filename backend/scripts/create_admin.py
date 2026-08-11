"""Create or reset an admin user.

Usage:
  python -m scripts.create_admin --email admin@example.com --password 'SecurePass1!'
"""

from __future__ import annotations

import argparse
import asyncio
import uuid

from app.core.config import get_settings
from app.core.enums import UserRole, UserStatus
from app.core.security import hash_password
from app.models.user import User
from app.utils import normalize_email
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


async def main() -> None:
    parser = argparse.ArgumentParser(description="Create or reset an admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--first-name", default="Admin")
    parser.add_argument("--last-name", default="User")
    args = parser.parse_args()

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    email = normalize_email(args.email)
    async with session_factory() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                id=uuid.uuid4(),
                email=email,
                first_name=args.first_name,
                last_name=args.last_name,
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
                password_hash=hash_password(args.password),
            )
            db.add(user)
            print(f"Created admin {email}")
        else:
            user.password_hash = hash_password(args.password)
            user.role = UserRole.ADMIN
            user.status = UserStatus.ACTIVE
            user.deleted_at = None
            print(f"Updated admin {email}")
        await db.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
