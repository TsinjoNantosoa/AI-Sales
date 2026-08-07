"""Auth API tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db


@requires_db
@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@aisales.demo", "password": "Demo123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert "user" in data
    assert data["user"]["email"] == "admin@aisales.demo"
    assert "firstName" in data["user"] or "first_name" in data["user"]


@requires_db
@pytest.mark.asyncio
async def test_login_invalid(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@aisales.demo", "password": "wrong"},
    )
    assert resp.status_code == 401


@requires_db
@pytest.mark.asyncio
async def test_me(client: AsyncClient):
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@aisales.demo", "password": "Demo123!"},
    )
    token = login.json()["token"]
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@aisales.demo"
