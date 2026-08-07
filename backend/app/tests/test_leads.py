"""Lead API tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db


async def _token(client: AsyncClient, email: str = "admin@aisales.demo") -> str:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Demo123!"},
    )
    return resp.json()["token"]


@requires_db
@pytest.mark.asyncio
async def test_create_and_list_leads(client: AsyncClient):
    token = await _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    create = await client.post(
        "/api/v1/leads",
        headers=headers,
        json={
            "firstName": "Jane",
            "lastName": "Doe",
            "companyName": "Acme",
            "email": "jane.doe@example.com",
            "country": "USA",
            "serviceInterest": "AI Automation",
            "needDescription": "Need help qualifying inbound leads automatically.",
            "consentGiven": True,
        },
    )
    assert create.status_code == 200, create.text
    lead = create.json()
    assert lead["email"] == "jane.doe@example.com"
    assert "score" in lead

    listed = await client.get("/api/v1/leads", headers=headers)
    assert listed.status_code == 200
    assert isinstance(listed.json(), list)
    assert any(l["id"] == lead["id"] for l in listed.json())


@requires_db
@pytest.mark.asyncio
async def test_duplicate_lead(client: AsyncClient):
    token = await _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "firstName": "Dup",
        "lastName": "User",
        "companyName": "DupCo",
        "email": "dup@example.com",
        "country": "USA",
        "serviceInterest": "CRM",
        "needDescription": "Duplicate detection test payload here.",
    }
    r1 = await client.post("/api/v1/leads", headers=headers, json=payload)
    assert r1.status_code == 200
    r2 = await client.post("/api/v1/leads", headers=headers, json=payload)
    assert r2.status_code == 409
