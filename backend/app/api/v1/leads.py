"""Lead routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.api.dependencies.db import get_db
from app.schemas.dashboard import EmailLogOut
from app.schemas.lead import (
    AssignLeadRequest,
    BulkIdsRequest,
    BulkLeadRequest,
    LeadCreate,
    LeadImportRequest,
    LeadImportResponse,
    LeadOut,
    LeadUpdate,
    NoteCreate,
    NoteOut,
)
from app.services.lead import LeadService

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=list[LeadOut])
async def list_leads(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    assigned_to_me: bool | None = Query(default=None),
    include_archived: bool = Query(default=False),
    status: str | None = None,
    search: str | None = None,
) -> list[LeadOut]:
    return await LeadService(db).list_leads(
        current_user,
        assigned_to_me=assigned_to_me,
        include_archived=include_archived,
        status=status,
        search=search,
    )


@router.post("", response_model=LeadOut)
async def create_lead(
    body: LeadCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> LeadOut:
    return await LeadService(db).create_lead(body, current_user)


@router.post("/import", response_model=LeadImportResponse)
async def import_leads(
    body: LeadImportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> LeadImportResponse:
    return await LeadService(db).import_leads(body.rows, current_user)


@router.post("/bulk")
async def bulk_update(
    body: BulkLeadRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await LeadService(db).bulk_update(body.ids, body.data or LeadUpdate(), current_user)
    return {"message": "ok"}


@router.post("/bulk-archive")
async def bulk_archive(
    body: BulkIdsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await LeadService(db).bulk_archive(body.ids, current_user)
    return {"message": "ok"}


@router.post("/bulk-delete")
async def bulk_delete(
    body: BulkIdsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await LeadService(db).bulk_delete(body.ids, current_user)
    return {"message": "ok"}


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> LeadOut:
    return await LeadService(db).get_lead(lead_id, current_user)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: uuid.UUID,
    body: LeadUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> LeadOut:
    return await LeadService(db).update_lead(lead_id, body, current_user)


@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    await LeadService(db).delete_lead(lead_id, current_user)
    return {"message": "ok"}


@router.post("/{lead_id}/archive", response_model=LeadOut)
async def archive_lead(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> LeadOut:
    return await LeadService(db).archive_lead(lead_id, current_user)


@router.post("/{lead_id}/assign", response_model=LeadOut)
async def assign_lead(
    lead_id: uuid.UUID,
    body: AssignLeadRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> LeadOut:
    return await LeadService(db).assign_lead(lead_id, body.user_id, current_user)


@router.post("/{lead_id}/score", response_model=LeadOut)
async def score_lead(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> LeadOut:
    return await LeadService(db).score_lead(lead_id, current_user)


@router.get("/{lead_id}/notes", response_model=list[NoteOut])
async def list_notes(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[NoteOut]:
    return await LeadService(db).list_notes(lead_id, current_user)


@router.post("/{lead_id}/notes", response_model=NoteOut)
async def add_note(
    lead_id: uuid.UUID,
    body: NoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> NoteOut:
    return await LeadService(db).add_note(lead_id, body.content, current_user)


@router.get("/{lead_id}/emails", response_model=list[EmailLogOut])
async def list_emails(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[EmailLogOut]:
    return await LeadService(db).list_emails(lead_id, current_user)
