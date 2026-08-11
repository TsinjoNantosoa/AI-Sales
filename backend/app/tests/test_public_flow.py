"""Public flow API tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db

PUBLIC_LEAD = {
    "firstName": "Public",
    "lastName": "Visitor",
    "companyName": "VisitorCo",
    "email": "public.visitor@example.com",
    "country": "USA",
    "serviceInterest": "",
    "needDescription": "",
    "consentGiven": True,
    "source": "Chatbot",
}


@requires_db
@pytest.mark.asyncio
async def test_public_lead_creates_token(client: AsyncClient):
    resp = await client.post("/api/v1/public/leads", json=PUBLIC_LEAD)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "publicToken" in data or "public_token" in data
    token = data.get("publicToken") or data.get("public_token")
    assert token
    assert data.get("conversationId") or data.get("conversation_id")
    lead = data["lead"]
    assert lead["email"] == "public.visitor@example.com"
    assert lead.get("consentGiven") is True or lead.get("consent_given") is True


@requires_db
@pytest.mark.asyncio
async def test_public_lead_requires_consent(client: AsyncClient):
    body = {**PUBLIC_LEAD, "email": "noconsent@example.com", "consentGiven": False}
    resp = await client.post("/api/v1/public/leads", json=body)
    assert resp.status_code == 422


@requires_db
@pytest.mark.asyncio
async def test_public_invalid_token(client: AsyncClient):
    created = await client.post(
        "/api/v1/public/leads",
        json={**PUBLIC_LEAD, "email": "tokentest@example.com"},
    )
    assert created.status_code == 200
    conv_id = created.json().get("conversationId") or created.json().get("conversation_id")

    resp = await client.post(
        f"/api/v1/public/conversations/{conv_id}/messages",
        headers={"X-Public-Token": "not-a-valid-token"},
        json={"content": "hello"},
    )
    assert resp.status_code == 401


@requires_db
@pytest.mark.asyncio
async def test_public_qualify(client: AsyncClient):
    created = await client.post(
        "/api/v1/public/leads",
        json={**PUBLIC_LEAD, "email": "qualify@example.com"},
    )
    assert created.status_code == 200
    data = created.json()
    token = data.get("publicToken") or data.get("public_token")
    conv_id = data.get("conversationId") or data.get("conversation_id")

    resp = await client.post(
        f"/api/v1/public/conversations/{conv_id}/qualify",
        headers={"X-Public-Token": token},
        json={"step": 1, "answer": "I need AI lead generation automation"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "qualification" in body
    assert "assistantMessage" in body or "assistant_message" in body
    assert body["qualification"]["score"] >= 0


@requires_db
@pytest.mark.asyncio
async def test_public_booking_idempotency(client: AsyncClient):
    created = await client.post(
        "/api/v1/public/leads",
        json={**PUBLIC_LEAD, "email": "book@example.com"},
    )
    assert created.status_code == 200
    data = created.json()
    token = data.get("publicToken") or data.get("public_token")
    lead = data["lead"]
    assigned = lead.get("assignedUserId") or lead.get("assigned_user_id")
    assert assigned, "lead should be auto-assigned"

    payload = {
        "date": "2030-06-10",
        "time": "10:00",
        "duration": 30,
        "type": "30-minute discovery call",
        "timezone": "UTC",
    }
    headers = {"X-Public-Token": token, "Idempotency-Key": "public-book-key-1"}
    first = await client.post("/api/v1/public/appointments", headers=headers, json=payload)
    assert first.status_code == 200, first.text
    second = await client.post("/api/v1/public/appointments", headers=headers, json=payload)
    assert second.status_code == 200, second.text
    assert first.json()["id"] == second.json()["id"]
