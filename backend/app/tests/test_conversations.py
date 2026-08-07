"""Conversation API tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db


@requires_db
@pytest.mark.asyncio
async def test_conversation_qualify_and_ai_reply(client: AsyncClient):
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@aisales.demo", "password": "Demo123!"},
    )
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    lead = (
        await client.post(
            "/api/v1/leads",
            headers=headers,
            json={
                "firstName": "Chat",
                "lastName": "Bot",
                "companyName": "ChatCo",
                "email": "chat@example.com",
                "country": "USA",
                "serviceInterest": "",
                "needDescription": "Chat qualification flow test description.",
            },
        )
    ).json()

    conv = (
        await client.post(
            "/api/v1/conversations",
            headers=headers,
            json={"leadId": lead["id"]},
        )
    ).json()

    q = await client.post(
        f"/api/v1/conversations/{conv['id']}/qualify",
        headers=headers,
        json={"leadId": lead["id"], "step": 1, "answer": "Lead qualification"},
    )
    assert q.status_code == 200, q.text
    body = q.json()
    assert "score" in body
    assert "temperature" in body

    ai = await client.post(
        f"/api/v1/conversations/{conv['id']}/ai-reply",
        headers=headers,
        json={"message": "What is your pricing?"},
    )
    assert ai.status_code == 200, ai.text
    assert ai.json()["message"]["sender"] == "ai"
