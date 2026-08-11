"""Object-level RBAC denial tests for conversations, appointments, tasks."""

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
async def test_sales_rep_denied_other_conversation(client: AsyncClient):
    admin = await _login(client, "admin@aisales.demo")
    sales = await _login(client, "sales@aisales.demo")
    manager_token = await _login(client, "manager@aisales.demo")
    manager_id = (
        await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {manager_token}"})
    ).json()["id"]

    lead = (
        await client.post(
            "/api/v1/leads",
            headers={"Authorization": f"Bearer {admin}"},
            json={
                "firstName": "Rbac",
                "lastName": "Conv",
                "companyName": "RbacCo",
                "email": "rbac.conv@example.com",
                "country": "USA",
                "serviceInterest": "AI",
                "needDescription": "Need enough characters for validation here.",
                "assignedUserId": manager_id,
            },
        )
    ).json()

    conv = (
        await client.post(
            "/api/v1/conversations",
            headers={"Authorization": f"Bearer {admin}"},
            json={"leadId": lead["id"]},
        )
    ).json()

    denied = await client.get(
        f"/api/v1/conversations/{conv['id']}",
        headers={"Authorization": f"Bearer {sales}"},
    )
    assert denied.status_code == 404


@requires_db
@pytest.mark.asyncio
async def test_sales_rep_denied_other_appointment(client: AsyncClient):
    admin = await _login(client, "admin@aisales.demo")
    sales = await _login(client, "sales@aisales.demo")
    manager_token = await _login(client, "manager@aisales.demo")
    manager_id = (
        await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {manager_token}"})
    ).json()["id"]

    lead = (
        await client.post(
            "/api/v1/leads",
            headers={"Authorization": f"Bearer {admin}"},
            json={
                "firstName": "Rbac",
                "lastName": "Appt",
                "companyName": "RbacApptCo",
                "email": "rbac.appt@example.com",
                "country": "USA",
                "serviceInterest": "Calendar",
                "needDescription": "Schedule a meeting for RBAC denial coverage.",
                "assignedUserId": manager_id,
            },
        )
    ).json()

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
