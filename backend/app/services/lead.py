"""Lead service — CRUD, scoring, notes, bulk, import, RBAC."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies.auth import CurrentUser
from app.core.enums import ActivityType, LeadStatus, NotificationCategory
from app.core.exceptions import DuplicateLeadError, NotFoundError
from app.core.permissions import (
    can_access_all_leads,
    ensure_lead_access,
    ensure_permission,
    is_manager_or_admin,
)
from app.models.email import EmailLog
from app.models.lead import Lead, LeadNote, Tag
from app.models.user import User
from app.schemas.dashboard import EmailLogOut
from app.schemas.lead import (
    LeadCreate,
    LeadImportResponse,
    LeadOut,
    LeadUpdate,
    NoteOut,
)
from app.services.activity import create_activity
from app.services.assignment import LeadAssignmentService
from app.services.audit import write_audit
from app.services.mappers import lead_to_out, note_to_out
from app.services.notification import create_notification
from app.services.scoring import LeadScoringService
from app.utils import normalize_email, normalize_phone, to_iso, utcnow


class LeadService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.scoring = LeadScoringService(db)
        self.assignment = LeadAssignmentService(db)

    async def _get_lead(self, lead_id: uuid.UUID, *, with_tags: bool = True) -> Lead:
        q = select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        if with_tags:
            q = q.options(selectinload(Lead.tag_entities))
        result = await self.db.execute(q)
        lead = result.scalar_one_or_none()
        if lead is None:
            raise NotFoundError("Lead not found", code="LEAD_NOT_FOUND")
        return lead

    def _scope_query(self, q, user: CurrentUser, *, assigned_to_me: bool | None = None):
        if assigned_to_me or not can_access_all_leads(user.role):
            return q.where(Lead.assigned_user_id == user.uuid)
        return q

    async def list_leads(
        self,
        user: CurrentUser,
        *,
        assigned_to_me: bool | None = None,
        include_archived: bool = False,
        status: str | None = None,
        search: str | None = None,
    ) -> list[LeadOut]:
        ensure_permission(user.role, "leads:read")
        q = select(Lead).options(selectinload(Lead.tag_entities)).where(Lead.deleted_at.is_(None))
        if not include_archived:
            q = q.where(Lead.archived_at.is_(None), Lead.status != LeadStatus.ARCHIVED)
        q = self._scope_query(q, user, assigned_to_me=assigned_to_me)
        if status:
            q = q.where(Lead.status == status)
        if search:
            like = f"%{search}%"
            q = q.where(
                or_(
                    Lead.first_name.ilike(like),
                    Lead.last_name.ilike(like),
                    Lead.email.ilike(like),
                    Lead.company_name.ilike(like),
                )
            )
        q = q.order_by(Lead.created_at.desc())
        result = await self.db.execute(q)
        return [lead_to_out(l) for l in result.scalars().all()]

    async def get_lead(self, lead_id: uuid.UUID, user: CurrentUser) -> LeadOut:
        ensure_permission(user.role, "leads:read")
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        return lead_to_out(lead)

    async def _ensure_tags(self, names: list[str]) -> list[Tag]:
        tags: list[Tag] = []
        for name in names:
            name = name.strip()
            if not name:
                continue
            result = await self.db.execute(select(Tag).where(Tag.name == name))
            tag = result.scalar_one_or_none()
            if tag is None:
                tag = Tag(name=name)
                self.db.add(tag)
                await self.db.flush()
            tags.append(tag)
        return tags

    async def _check_duplicate(self, email: str, phone: str | None, *, exclude_id: uuid.UUID | None = None) -> None:
        email_n = normalize_email(email)
        q = select(Lead).where(Lead.email == email_n, Lead.deleted_at.is_(None))
        if exclude_id:
            q = q.where(Lead.id != exclude_id)
        result = await self.db.execute(q)
        if result.scalar_one_or_none():
            raise DuplicateLeadError()
        phone_n = normalize_phone(phone)
        if phone_n:
            q2 = select(Lead).where(Lead.phone == phone_n, Lead.deleted_at.is_(None))
            if exclude_id:
                q2 = q2.where(Lead.id != exclude_id)
            result2 = await self.db.execute(q2)
            if result2.scalar_one_or_none():
                raise DuplicateLeadError(message="A lead with this phone already exists")

    async def create_lead(
        self,
        data: LeadCreate,
        user: CurrentUser | None = None,
        *,
        public: bool = False,
    ) -> LeadOut:
        if user and not public:
            ensure_permission(user.role, "leads:write")
        await self._check_duplicate(data.email, data.phone)

        assigned_id = None
        if data.assigned_user_id:
            assigned_id = uuid.UUID(data.assigned_user_id)
        elif user and not is_manager_or_admin(user.role):
            assigned_id = user.uuid

        lead = Lead(
            first_name=data.first_name,
            last_name=data.last_name,
            company_name=data.company_name,
            email=normalize_email(data.email),
            phone=normalize_phone(data.phone),
            country=data.country or "",
            language=data.language or "en",
            source=data.source,
            service_interest=data.service_interest or "",
            budget_min=data.budget_min,
            budget_max=data.budget_max,
            timeline=data.timeline,
            need_description=data.need_description or "",
            estimated_value=data.estimated_value,
            consent_given=data.consent_given,
            consent_at=utcnow() if data.consent_given else None,
            priority=data.priority,
            status=data.status or LeadStatus.NEW,
            company_size=data.company_size,
            assigned_user_id=assigned_id,
            score=data.score or 0,
            temperature=data.temperature or "COLD",
        )
        self.db.add(lead)
        await self.db.flush()

        if data.tags:
            lead.tag_entities = await self._ensure_tags(data.tags)

        if assigned_id is None:
            await self.assignment.auto_assign(
                lead,
                assigned_by=user.uuid if user else None,
            )

        lead, score_data = await self.scoring.score_and_persist(
            lead,
            user_id=user.uuid if user else None,
            reason="Initial score on create",
        )
        if data.score is not None:
            lead.score = data.score
        if data.temperature is not None:
            lead.temperature = data.temperature

        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.CREATED,
            description=f"Lead created from {lead.source}",
            user_id=user.id if user else None,
            user_name=user.full_name if user else "system",
        )
        if user:
            await write_audit(
                self.db,
                action="lead.create",
                entity_type="lead",
                entity_id=str(lead.id),
                user_id=user.id,
                user_name=user.full_name,
                details=f"Created lead {lead.email}",
            )
        await self.db.flush()
        # reload tags
        lead = await self._get_lead(lead.id)
        return lead_to_out(lead)

    async def update_lead(self, lead_id: uuid.UUID, data: LeadUpdate, user: CurrentUser) -> LeadOut:
        ensure_permission(user.role, "leads:write")
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        payload = data.model_dump(exclude_unset=True)
        if "email" in payload and payload["email"]:
            await self._check_duplicate(payload["email"], payload.get("phone", lead.phone), exclude_id=lead.id)
            payload["email"] = normalize_email(payload["email"])
        if "phone" in payload:
            payload["phone"] = normalize_phone(payload["phone"])
        if "assigned_user_id" in payload:
            if not is_manager_or_admin(user.role):
                payload.pop("assigned_user_id")
            elif payload["assigned_user_id"]:
                await self.assignment.assign(
                    lead,
                    uuid.UUID(payload.pop("assigned_user_id")),
                    assigned_by=user.uuid,
                )
            else:
                lead.assigned_user_id = None
                payload.pop("assigned_user_id")
        if "tags" in payload:
            tags = payload.pop("tags") or []
            lead.tag_entities = await self._ensure_tags(tags)
        if "next_follow_up_at" in payload and payload["next_follow_up_at"]:
            payload["next_follow_up_at"] = datetime.fromisoformat(
                payload["next_follow_up_at"].replace("Z", "+00:00")
            )
        old_status = lead.status
        for k, v in payload.items():
            setattr(lead, k, v)
        if "status" in payload and payload["status"] != old_status:
            await create_activity(
                self.db,
                lead_id=lead.id,
                lead_name=f"{lead.first_name} {lead.last_name}",
                type=ActivityType.STATUS_CHANGED,
                description=f"Status changed from {old_status} to {lead.status}",
                user_id=user.id,
                user_name=user.full_name,
            )
        await self.db.flush()
        lead = await self._get_lead(lead.id)
        return lead_to_out(lead)

    async def delete_lead(self, lead_id: uuid.UUID, user: CurrentUser) -> None:
        ensure_permission(user.role, "leads:write")
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        lead.deleted_at = utcnow()
        await write_audit(
            self.db,
            action="lead.delete",
            entity_type="lead",
            entity_id=str(lead.id),
            user_id=user.id,
            user_name=user.full_name,
            details="Soft-deleted lead",
        )
        await self.db.flush()

    async def archive_lead(self, lead_id: uuid.UUID, user: CurrentUser) -> LeadOut:
        ensure_permission(user.role, "leads:write")
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        lead.archived_at = utcnow()
        lead.status = LeadStatus.ARCHIVED
        await self.db.flush()
        return lead_to_out(lead)

    async def assign_lead(self, lead_id: uuid.UUID, user_id: str, user: CurrentUser) -> LeadOut:
        ensure_permission(user.role, "leads:assign")
        lead = await self._get_lead(lead_id)
        await self.assignment.assign(
            lead,
            uuid.UUID(user_id),
            assigned_by=user.uuid,
            reason="Manual assign",
        )
        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.ASSIGNED,
            description=f"Assigned to user {user_id}",
            user_id=user.id,
            user_name=user.full_name,
        )
        await self.db.flush()
        return lead_to_out(lead)

    async def score_lead(self, lead_id: uuid.UUID, user: CurrentUser) -> LeadOut:
        ensure_permission(user.role, "leads:write")
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        was_hot = lead.temperature == "HOT"
        lead, data = await self.scoring.score_and_persist(
            lead,
            user_id=user.uuid,
            reason="Manual rescore",
            calculated_by="user",
        )
        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.SCORED,
            description=f"Score updated to {data['total']} ({data['temperature']})",
            user_id=user.id,
            user_name=user.full_name,
        )
        if not was_hot and data["temperature"] == "HOT" and lead.assigned_user_id:
            await create_notification(
                self.db,
                user_id=lead.assigned_user_id,
                title="Hot lead detected",
                message=f"{lead.first_name} {lead.last_name} reached score {data['total']}",
                category=NotificationCategory.LEADS,
                related_id=str(lead.id),
                related_type="lead",
            )
        await self.db.flush()
        return lead_to_out(lead)

    async def list_notes(self, lead_id: uuid.UUID, user: CurrentUser) -> list[NoteOut]:
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        result = await self.db.execute(
            select(LeadNote)
            .where(LeadNote.lead_id == lead_id, LeadNote.deleted_at.is_(None))
            .order_by(LeadNote.created_at.desc())
        )
        notes = result.scalars().all()
        out: list[NoteOut] = []
        for n in notes:
            name = ""
            if n.author_id:
                ures = await self.db.execute(select(User).where(User.id == n.author_id))
                u = ures.scalar_one_or_none()
                if u:
                    name = f"{u.first_name} {u.last_name}"
            out.append(note_to_out(n, user_name=name))
        return out

    async def add_note(self, lead_id: uuid.UUID, content: str, user: CurrentUser) -> NoteOut:
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        note = LeadNote(lead_id=lead.id, author_id=user.uuid, content=content)
        self.db.add(note)
        await create_activity(
            self.db,
            lead_id=lead.id,
            lead_name=f"{lead.first_name} {lead.last_name}",
            type=ActivityType.NOTE,
            description="Note added",
            user_id=user.id,
            user_name=user.full_name,
        )
        await self.db.flush()
        return note_to_out(note, user_name=user.full_name)

    async def list_emails(self, lead_id: uuid.UUID, user: CurrentUser) -> list[EmailLogOut]:
        lead = await self._get_lead(lead_id)
        ensure_lead_access(
            role=user.role,
            user_id=user.id,
            lead_assigned_user_id=str(lead.assigned_user_id) if lead.assigned_user_id else None,
        )
        result = await self.db.execute(
            select(EmailLog).where(EmailLog.lead_id == lead_id).order_by(EmailLog.created_at.desc())
        )
        return [
            EmailLogOut(
                id=str(e.id),
                lead_id=str(e.lead_id) if e.lead_id else None,
                subject=e.subject,
                recipient=e.recipient,
                status=e.status,
                template=e.template_slug or "",
                sent_at=to_iso(e.sent_at or e.created_at) or "",
            )
            for e in result.scalars().all()
        ]

    async def bulk_update(self, ids: list[str], data: LeadUpdate, user: CurrentUser) -> None:
        for lid in ids:
            await self.update_lead(uuid.UUID(lid), data, user)

    async def bulk_archive(self, ids: list[str], user: CurrentUser) -> None:
        for lid in ids:
            await self.archive_lead(uuid.UUID(lid), user)

    async def bulk_delete(self, ids: list[str], user: CurrentUser) -> None:
        for lid in ids:
            await self.delete_lead(uuid.UUID(lid), user)

    async def import_leads(self, rows: list[LeadCreate], user: CurrentUser) -> LeadImportResponse:
        ensure_permission(user.role, "leads:write")
        imported: list[LeadOut] = []
        rejected: list[dict] = []
        for i, row in enumerate(rows):
            try:
                if not row.email or not row.first_name or not row.last_name:
                    rejected.append({"row": i + 1, "reason": "Missing required fields"})
                    continue
                out = await self.create_lead(row, user)
                imported.append(out)
            except Exception as exc:  # noqa: BLE001
                rejected.append({"row": i + 1, "reason": str(exc)})
        return LeadImportResponse(imported=imported, rejected=rejected)
