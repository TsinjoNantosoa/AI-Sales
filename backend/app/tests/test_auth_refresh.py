"""Auth refresh token rotation tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db


@requires_db
@pytest.mark.asyncio
async def test_refresh_rotation(client: AsyncClient):
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@aisales.demo", "password": "Demo123!"},
    )
    assert login.status_code == 200
    data = login.json()
    refresh = data.get("refreshToken") or data.get("refresh_token")
    assert refresh

    rotated = await client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": refresh},
    )
    assert rotated.status_code == 200, rotated.text
    new_data = rotated.json()
    new_refresh = new_data.get("refreshToken") or new_data.get("refresh_token")
    assert new_refresh
    assert new_refresh != refresh
    assert new_data.get("token")

    # Old refresh token must be revoked
    reuse = await client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": refresh},
    )
    assert reuse.status_code == 401
