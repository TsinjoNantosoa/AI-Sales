"""Object-level RBAC denial tests for conversations, appointments, tasks."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db


async def _login(client: AsyncClient, email: str) -> str:
    return (
        await client.post("/api/v1/auth/login", json={"email": email, "password": "Demo123!"})
    ).json()["token"]


async def _me(client: AsyncClient, token: str) -> dict:
    return (await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})).json()


async def _create_lead_with_assignee(
    client: AsyncClient,
    *,
    admin_token: str,
    assignee_id: str,
    email: str,
) -> dict:
    resp = await client.post(
        "/api/v1/leads",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "firstName": "Rbac",
            "lastName": "Conv",
            "companyName": "RbacCo",
            "email": email,
            "country": "USA",
            "serviceInterest": "AI",
            "needDescription": "Need enough characters for validation here.",
            "assignedUserId": assignee_id,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _create_conversation(client: AsyncClient, token: str, lead_id: str) -> dict:
    resp = await client.post(
        "/api/v1/conversations",
        headers={"Authorization": f"Bearer {token}"},
        json={"leadId": lead_id},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@requires_db
@pytest.mark.asyncio
async def test_sales_rep_denied_other_conversation(client: AsyncClient):
    admin = await _login(client, "admin@aisales.demo")
    sales = await _login(client, "sales@aisales.demo")
    manager_token = await _login(client, "manager@aisales.demo")
    manager_id = (await _me(client, manager_token))["id"]

    lead = await _create_lead_with_assignee(
        client,
        admin_token=admin,
        assignee_id=manager_id,
        email=f"rbac.conv.{uuid.uuid4().hex[:8]}@example.com",
    )
    conv = await _create_conversation(client, admin, lead["id"])

    denied = await client.get(
        f"/api/v1/conversations/{conv['id']}",
        headers={"Authorization": f"Bearer {sales}"},
    )
    assert denied.status_code == 404


@requires_db
@pytest.mark.asyncio
async def test_sales_rep_can_act_on_own_conversation(client: AsyncClient):
    admin = await _login(client, "admin@aisales.demo")
    sales = await _login(client, "sales@aisales.demo")
    sales_id = (await _me(client, sales))["id"]

    lead = await _create_lead_with_assignee(
        client,
        admin_token=admin,
        assignee_id=sales_id,
        email=f"rbac.own.conv.{uuid.uuid4().hex[:8]}@example.com",
    )
    conv = await _create_conversation(client, sales, lead["id"])
    headers = {"Authorization": f"Bearer {sales}"}

    got = await client.get(f"/api/v1/conversations/{conv['id']}", headers=headers)
    assert got.status_code == 200, got.text

    qualify = await client.post(
        f"/api/v1/conversations/{conv['id']}/qualify",
        headers=headers,
        json={"leadId": lead["id"], "step": 1, "answer": "Lead qualification"},
    )
    assert qualify.status_code == 200, qualify.text

    ai = await client.post(
        f"/api/v1/conversations/{conv['id']}/ai-reply",
        headers=headers,
        json={"message": "What is your pricing?"},
    )
    assert ai.status_code == 200, ai.text

    handoff = await client.post(
        f"/api/v1/conversations/{conv['id']}/handoff",
        headers=headers,
    )
    assert handoff.status_code == 200, handoff.text
    body = handoff.json()
    assert body.get("humanHandoffRequested") is True or body.get("human_handoff_requested") is True


@requires_db
@pytest.mark.asyncio
async def test_sales_rep_denied_other_conversation_mutations(client: AsyncClient):
    admin = await _login(client, "admin@aisales.demo")
    sales = await _login(client, "sales@aisales.demo")
    manager_token = await _login(client, "manager@aisales.demo")
    manager_id = (await _me(client, manager_token))["id"]

    lead = await _create_lead_with_assignee(
        client,
        admin_token=admin,
        assignee_id=manager_id,
        email=f"rbac.deny.mut.{uuid.uuid4().hex[:8]}@example.com",
    )
    conv = await _create_conversation(client, admin, lead["id"])
    headers = {"Authorization": f"Bearer {sales}"}

    create_denied = await client.post(
        "/api/v1/conversations",
        headers=headers,
        json={"leadId": lead["id"]},
    )
    assert create_denied.status_code == 404

    qualify_denied = await client.post(
        f"/api/v1/conversations/{conv['id']}/qualify",
        headers=headers,
        json={"leadId": lead["id"], "step": 1, "answer": "Lead qualification"},
    )
    assert qualify_denied.status_code == 404

    ai_denied = await client.post(
        f"/api/v1/conversations/{conv['id']}/ai-reply",
        headers=headers,
        json={"message": "Hello"},
    )
    assert ai_denied.status_code == 404

    handoff_denied = await client.post(
        f"/api/v1/conversations/{conv['id']}/handoff",
        headers=headers,
    )
    assert handoff_denied.status_code == 404


@requires_db
@pytest.mark.asyncio
async def test_sales_rep_denied_other_appointment(client: AsyncClient):
    admin = await _login(client, "admin@aisales.demo")
    sales = await _login(client, "sales@aisales.demo")
    manager_token = await _login(client, "manager@aisales.demo")
    manager_id = (await _me(client, manager_token))["id"]

    lead = await _create_lead_with_assignee(
        client,
        admin_token=admin,
        assignee_id=manager_id,
        email=f"rbac.appt.{uuid.uuid4().hex[:8]}@example.com",
    )

    appt = await client.post(
        "/api/v1/appointments",
        headers={"Authorization": f"Bearer {admin}"},
        json={
            "leadId": lead["id"],
            "assignedUserId": manager_id,
            "date": "2030-02-20",
            "time": "11:00",
            "duration": 30,
            "type": "30-minute discovery call",
            "status": "Confirmed",
        },
    )
    assert appt.status_code == 200, appt.text
    appt_id = appt.json()["id"]

    denied = await client.get(
        f"/api/v1/appointments/{appt_id}",
        headers={"Authorization": f"Bearer {sales}"},
    )
    assert denied.status_code == 404
