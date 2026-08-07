"""Appointment API tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import requires_db


@requires_db
@pytest.mark.asyncio
async def test_create_appointment_and_slots(client: AsyncClient):
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@aisales.demo", "password": "Demo123!"},
    )
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = (await client.get("/api/v1/auth/me", headers=headers)).json()

    lead = (
        await client.post(
            "/api/v1/leads",
            headers=headers,
            json={
                "firstName": "Meet",
                "lastName": "Me",
                "companyName": "MeetCo",
                "email": "meet@example.com",
                "country": "USA",
                "serviceInterest": "Calendar",
                "needDescription": "Want to schedule a discovery call soon please.",
            },
        )
    ).json()

    date = "2030-01-15"
    slots = await client.get(
        "/api/v1/calendar/slots",
        headers=headers,
        params={"date": date, "userId": me["id"]},
    )
    assert slots.status_code == 200
    assert "10:00" in slots.json()

    created = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "leadId": lead["id"],
            "assignedUserId": me["id"],
            "date": date,
            "time": "10:00",
            "duration": 30,
            "type": "30-minute discovery call",
            "status": "Confirmed",
        },
    )
    assert created.status_code == 200, created.text
    assert created.json()["status"] == "Confirmed"

    slots2 = await client.get(
        "/api/v1/calendar/slots",
        headers=headers,
        params={"date": date, "userId": me["id"]},
    )
    assert "10:00" not in slots2.json()
