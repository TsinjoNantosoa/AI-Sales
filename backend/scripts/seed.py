"""Idempotent demo seed script."""

from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta

from app.core.config import get_settings
from app.core.enums import (
    AppointmentStatus,
    ConversationChannel,
    ConversationStatus,
    IntegrationStatus,
    LeadSource,
    LeadStatus,
    LeadTemperature,
    MessageSender,
    NotificationCategory,
    Priority,
    TaskStatus,
    UserRole,
    UserStatus,
    WorkflowStatus,
)
from app.core.security import hash_password
from app.models import (
    Activity,
    Appointment,
    Conversation,
    IntegrationConnection,
    Lead,
    Message,
    Notification,
    Task,
    User,
    Workflow,
)
from app.models.setting import AppSetting
from app.services.settings import DEFAULT_SETTINGS
from app.utils import utcnow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DEMO_PASSWORD = "Demo123!"
NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def uid(email: str) -> uuid.UUID:
    return uuid.uuid5(NS, email)


USERS = [
    ("admin@aisales.demo", "Alex", "Admin", UserRole.ADMIN, "en"),
    ("manager@aisales.demo", "Morgan", "Manager", UserRole.SALES_MANAGER, "en"),
    ("sales@aisales.demo", "Sam", "Seller", UserRole.SALES_REPRESENTATIVE, "en"),
    ("sales2@aisales.demo", "Jordan", "Lee", UserRole.SALES_REPRESENTATIVE, "fr"),
    ("sales3@aisales.demo", "Casey", "Nguyen", UserRole.SALES_REPRESENTATIVE, "en"),
    ("viewer@aisales.demo", "Riley", "Patel", UserRole.SALES_REPRESENTATIVE, "en"),
]

SOURCES = [
    LeadSource.WEBSITE,
    LeadSource.CHATBOT,
    LeadSource.EMAIL,
    LeadSource.REFERRAL,
    LeadSource.LINKEDIN,
]


async def seed_users(db: AsyncSession) -> dict[str, User]:
    by_email: dict[str, User] = {}
    pwd = hash_password(DEMO_PASSWORD)
    for email, first, last, role, lang in USERS:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                id=uid(email),
                email=email,
                first_name=first,
                last_name=last,
                role=role,
                status=UserStatus.ACTIVE,
                language=lang,
                timezone="America/New_York",
                password_hash=pwd,
            )
            db.add(user)
        else:
            user.password_hash = pwd
            user.status = UserStatus.ACTIVE
            user.deleted_at = None
        by_email[email] = user
    await db.flush()
    return by_email


async def seed_settings(db: AsyncSession, manager_id: str) -> None:
    for category, values in DEFAULT_SETTINGS.items():
        payload = dict(values)
        if category == "lead_management":
            payload["default_assignee_id"] = manager_id
        result = await db.execute(select(AppSetting).where(AppSetting.category == category))
        row = result.scalar_one_or_none()
        if row is None:
            db.add(AppSetting(category=category, value_json=payload))
        else:
            row.value_json = {**(row.value_json or {}), **payload}
    await db.flush()


async def seed_integrations(db: AsyncSession) -> None:
    specs = [
        ("google-calendar", "Google Calendar", "Sync meetings and availability", "calendar", "Calendar", IntegrationStatus.CONNECTED),
        ("gmail", "Gmail", "Send and track emails", "mail", "Email", IntegrationStatus.CONNECTED),
        ("hubspot", "HubSpot", "Two-way CRM sync", "hubspot", "CRM", IntegrationStatus.AVAILABLE),
        ("slack", "Slack", "Team notifications", "slack", "Communication", IntegrationStatus.AVAILABLE),
        ("n8n", "n8n", "Workflow automation bridge", "n8n", "Automation", IntegrationStatus.CONNECTED),
        ("openai", "OpenAI", "AI qualification engine", "openai", "AI", IntegrationStatus.CONNECTED),
    ]
    for provider, name, desc, logo, cat, status in specs:
        result = await db.execute(
            select(IntegrationConnection).where(IntegrationConnection.provider == provider)
        )
        row = result.scalar_one_or_none()
        if row is None:
            db.add(
                IntegrationConnection(
                    provider=provider,
                    name=name,
                    description=desc,
                    logo=logo,
                    category=cat,
                    status=status,
                    last_synced_at=utcnow() if status == IntegrationStatus.CONNECTED else None,
                )
            )
    await db.flush()


async def seed_workflows(db: AsyncSession) -> None:
    specs = [
        ("lead-welcome", "Lead Welcome Sequence", "Send welcome email on new lead"),
        ("hot-lead-alert", "Hot Lead Alert", "Notify assignees when score turns HOT"),
        ("meeting-reminder", "Meeting Reminder", "Remind before appointments"),
        ("follow-up-nudge", "Follow-up Nudge", "Create tasks for stalled leads"),
    ]
    for slug, name, desc in specs:
        result = await db.execute(select(Workflow).where(Workflow.slug == slug))
        if result.scalar_one_or_none() is None:
            db.add(
                Workflow(
                    name=name,
                    slug=slug,
                    description=desc,
                    status=WorkflowStatus.ACTIVE,
                    success_count=5,
                    failure_count=0,
                    total_duration_ms=9000,
                    last_execution_at=utcnow(),
                )
            )
    await db.flush()


async def seed_leads_and_related(db: AsyncSession, users: dict[str, User]) -> None:
    manager = users["manager@aisales.demo"]
    sales = users["sales@aisales.demo"]
    sales2 = users["sales2@aisales.demo"]
    assignees = [manager, sales, sales2]

    existing = (
        await db.execute(select(Lead).where(Lead.email.like("%@demo.lead")))
    ).scalars().all()
    if len(existing) >= 25:
        return

    now = utcnow()
    for i in range(25):
        email = f"lead{i+1:02d}@demo.lead"
        found = await db.execute(select(Lead).where(Lead.email == email))
        if found.scalar_one_or_none():
            continue
        assignee = assignees[i % len(assignees)]
        score = 25 + (i * 3) % 70
        temp = (
            LeadTemperature.HOT
            if score >= 70
            else LeadTemperature.WARM
            if score >= 40
            else LeadTemperature.COLD
        )
        status = [
            LeadStatus.NEW,
            LeadStatus.CONTACTED,
            LeadStatus.QUALIFYING,
            LeadStatus.QUALIFIED,
            LeadStatus.MEETING_SCHEDULED,
            LeadStatus.WON,
            LeadStatus.LOST,
        ][i % 7]
        lead = Lead(
            first_name=f"Lead{i+1}",
            last_name="Demo",
            company_name=f"Company {i+1}",
            email=email,
            phone=f"+1555000{i+1:04d}",
            country="USA",
            language="en" if i % 2 == 0 else "fr",
            source=SOURCES[i % len(SOURCES)],
            service_interest="AI Automation" if i % 2 == 0 else "CRM Integration",
            budget_min=1000 * ((i % 5) + 1),
            budget_max=3000 * ((i % 5) + 1),
            timeline="Within 30 days" if i % 3 else "Immediately",
            need_description="Looking for automation to qualify inbound leads faster.",
            estimated_value=5000 + i * 500,
            score=score,
            temperature=temp,
            status=status,
            priority=Priority.HIGH if temp == LeadTemperature.HOT else Priority.MEDIUM,
            assigned_user_id=assignee.id,
            consent_given=True,
            company_size="11-50" if i % 2 else "51-200",
            decision_authority="Yes, I decide" if i % 3 == 0 else "Team decision",
            last_interaction_at=now - timedelta(hours=i),
        )
        db.add(lead)
        await db.flush()

        conv = Conversation(
            lead_id=lead.id,
            channel=ConversationChannel.CHATBOT,
            status=ConversationStatus.AI_HANDLED,
            assigned_user_id=assignee.id,
        )
        db.add(conv)
        await db.flush()
        db.add(
            Message(
                conversation_id=conv.id,
                content="Hello, I need help with automation.",
                sender_type=MessageSender.USER,
                read=True,
            )
        )
        db.add(
            Message(
                conversation_id=conv.id,
                content="Happy to help! What process would you like to improve?",
                sender_type=MessageSender.AI,
                sender_name="Ava",
                read=False,
            )
        )

        if i % 3 == 0:
            start = now + timedelta(days=(i % 7) + 1)
            start = start.replace(hour=10, minute=0, second=0, microsecond=0)
            db.add(
                Appointment(
                    lead_id=lead.id,
                    assigned_user_id=assignee.id,
                    start_at=start,
                    end_at=start + timedelta(minutes=30),
                    duration_minutes=30,
                    meeting_type="30-minute discovery call",
                    status=AppointmentStatus.CONFIRMED,
                    meeting_url=f"https://meet.google.com/demo-{i}",
                    lead_name=f"{lead.first_name} {lead.last_name}",
                    lead_company=lead.company_name,
                    lead_email=lead.email,
                    salesperson_name=f"{assignee.first_name} {assignee.last_name}",
                    google_meet=True,
                )
            )

        db.add(
            Task(
                title=f"Follow up with {lead.first_name}",
                description="Call or email the lead",
                lead_id=lead.id,
                lead_name=f"{lead.first_name} {lead.last_name}",
                assigned_user_id=assignee.id,
                assigned_user_name=f"{assignee.first_name} {assignee.last_name}",
                priority=Priority.MEDIUM,
                status=TaskStatus.TODO,
                due_at=now + timedelta(days=2),
            )
        )
        db.add(
            Notification(
                user_id=assignee.id,
                title="New lead assigned",
                message=f"{lead.first_name} {lead.last_name} was assigned to you",
                category=NotificationCategory.LEADS,
                entity_type="lead",
                entity_id=str(lead.id),
            )
        )
        db.add(
            Activity(
                lead_id=lead.id,
                lead_name=f"{lead.first_name} {lead.last_name}",
                type="created",
                description="Lead seeded for demo",
                user_name="system",
            )
        )
    await db.flush()


async def main() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as db:
        users = await seed_users(db)
        await seed_settings(db, str(users["manager@aisales.demo"].id))
        await seed_integrations(db)
        await seed_workflows(db)
        await seed_leads_and_related(db, users)
        await db.commit()
        print("Seed completed.")
        print("Demo accounts (password Demo123!):")
        for email, *_ in USERS:
            print(f"  - {email}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
