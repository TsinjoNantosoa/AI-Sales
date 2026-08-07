"""Appointment routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.common import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services.appointment import AppointmentService

router = APIRouter(tags=["appointments"])


@router.get("/appointments", response_model=list[AppointmentOut])
async def list_appointments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[AppointmentOut]:
    return await AppointmentService(db).list_appointments(current_user)


@router.post("/appointments", response_model=AppointmentOut)
async def create_appointment(
    body: AppointmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AppointmentOut:
    return await AppointmentService(db).create(body, current_user)


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
async def get_appointment(
    appointment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AppointmentOut:
    return await AppointmentService(db).get_appointment(appointment_id, current_user)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AppointmentOut:
    return await AppointmentService(db).update(appointment_id, body, current_user)


@router.delete("/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await AppointmentService(db).delete(appointment_id, current_user)
    return {"message": "ok"}


@router.get("/calendar/slots", response_model=list[str])
async def calendar_slots(
    date: str,
    userId: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[str]:
    return await AppointmentService(db).available_slots(date, userId)
