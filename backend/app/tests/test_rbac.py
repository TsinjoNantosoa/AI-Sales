"""RBAC scoping tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db


async def _login(client: AsyncClient, email: str) -> str:
    return (
        await client.post("/api/v1/auth/login", json={"email": email, "password": "Demo123!"})
    ).json()["token"]


@requires_db
@pytest.mark.asyncio
async def test_sales_rep_scoped_leads(client: AsyncClient):
    admin = await _login(client, "admin@aisales.demo")
    sales = await _login(client, "sales@aisales.demo")
    sales_headers = {"Authorization": f"Bearer {sales}"}
    admin_headers = {"Authorization": f"Bearer {admin}"}

    # create lead assigned to manager (not sales)
    create = await client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "firstName": "Scoped",
            "lastName": "Lead",
            "companyName": "ScopeCo",
            "email": "scoped@example.com",
            "country": "USA",
            "serviceInterest": "AI",
            "needDescription": "RBAC scope test need description here.",
            "assignedUserId": (
                await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {await _login(client, 'manager@aisales.demo')}"})
            ).json()["id"],
        },
    )
    assert create.status_code == 200
    lead_id = create.json()["id"]

    # sales rep listing with assigned_to_me should not include it
    listed = await client.get("/api/v1/leads?assigned_to_me=true", headers=sales_headers)
    assert listed.status_code == 200
    assert all(l["id"] != lead_id for l in listed.json())

    # direct get should 404 for sales
    got = await client.get(f"/api/v1/leads/{lead_id}", headers=sales_headers)
    assert got.status_code == 404
