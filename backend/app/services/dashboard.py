"""Dashboard and analytics aggregates."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUser
from app.core.enums import AppointmentStatus, ConversationStatus, LeadStatus, LeadTemperature
from app.core.permissions import can_access_all_leads
from app.models.activity import Activity
from app.models.appointment import Appointment
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.user import User
from app.models.workflow import Workflow, WorkflowExecution
from app.schemas.dashboard import (
    ActivityOut,
    AiPerformance,
    AnalyticsData,
    AutomationPerformanceMetric,
    DashboardChanges,
    DashboardOverview,
    LeadTrendPoint,
    PipelineMetric,
    PipelineStage,
    SourceData,
    SourceMetric,
    TeamPerformanceMetric,
)
from app.services.activity import activity_to_out
from app.utils import utcnow

PIPELINE_STATUSES = [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFYING,
    LeadStatus.QUALIFIED,
    LeadStatus.MEETING_SCHEDULED,
    LeadStatus.PROPOSAL_SENT,
    LeadStatus.NEGOTIATION,
    LeadStatus.WON,
    LeadStatus.LOST,
]


class DashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _lead_filter(self, user: CurrentUser) -> list:
        conds: list = [Lead.deleted_at.is_(None), Lead.archived_at.is_(None)]
        if not can_access_all_leads(user.role):
            conds.append(Lead.assigned_user_id == user.uuid)
        return conds

    async def overview(self, user: CurrentUser) -> DashboardOverview:
        conds = self._lead_filter(user)
        result = await self.db.execute(select(Lead).where(*conds))
        leads = list(result.scalars().all())

        total = len(leads)
        new_leads = sum(1 for l in leads if l.status == LeadStatus.NEW)
        qualified = sum(
            1
            for l in leads
            if l.status
            in {
                LeadStatus.QUALIFIED,
                LeadStatus.MEETING_SCHEDULED,
                LeadStatus.PROPOSAL_SENT,
                LeadStatus.NEGOTIATION,
                LeadStatus.WON,
            }
        )
        hot = sum(1 for l in leads if l.temperature == LeadTemperature.HOT)
        pipeline_value = sum(l.estimated_value or 0 for l in leads if l.status != LeadStatus.LOST)
        wins = sum(1 for l in leads if l.status == LeadStatus.WON)
        conversion = round((wins / total) * 100, 1) if total else 0.0

        aq = select(Appointment).where(Appointment.status != AppointmentStatus.CANCELLED)
        if not can_access_all_leads(user.role):
            aq = aq.where(Appointment.assigned_user_id == user.uuid)
        meetings = len((await self.db.execute(aq)).scalars().all())

        return DashboardOverview(
            total_leads=total,
            new_leads=new_leads,
            qualified_leads=qualified,
            hot_leads=hot,
            meetings_booked=meetings,
            conversion_rate=conversion,
            pipeline_value=pipeline_value,
            average_response_time_seconds=120,
            avg_response_time="2m",
            changes=DashboardChanges(
                total_leads=8.2,
                new_leads=12.0,
                qualified_leads=5.1,
                hot_leads=3.4,
                meetings_booked=6.0,
                conversion_rate=1.2,
                pipeline_value=4.5,
            ),
        )

    async def pipeline(self, user: CurrentUser) -> list[PipelineStage]:
        conds = self._lead_filter(user)
        result = await self.db.execute(select(Lead).where(*conds))
        leads = list(result.scalars().all())
        out: list[PipelineStage] = []
        for status in PIPELINE_STATUSES:
            group = [l for l in leads if l.status == status]
            out.append(
                PipelineStage(
                    status=status,
                    count=len(group),
                    value=sum(l.estimated_value or 0 for l in group),
                )
            )
        return out

    async def sources(self, user: CurrentUser) -> list[SourceData]:
        conds = self._lead_filter(user)
        result = await self.db.execute(select(Lead).where(*conds))
        leads = list(result.scalars().all())
        counts: dict[str, int] = defaultdict(int)
        for l in leads:
            counts[l.source or "Other"] += 1
        total = sum(counts.values()) or 1
        return [
            SourceData(source=s, count=c, percentage=round((c / total) * 100))
            for s, c in sorted(counts.items(), key=lambda x: -x[1])
        ]

    async def conversions(self, user: CurrentUser) -> list[LeadTrendPoint]:
        conds = self._lead_filter(user)
        result = await self.db.execute(select(Lead).where(*conds))
        leads = list(result.scalars().all())
        by_day: dict[str, list[Lead]] = defaultdict(list)
        for l in leads:
            day = l.created_at.date().isoformat() if l.created_at else utcnow().date().isoformat()
            by_day[day].append(l)
        # last 14 days
        points: list[LeadTrendPoint] = []
        today = utcnow().date()
        for i in range(13, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            group = by_day.get(d, [])
            points.append(
                LeadTrendPoint(
                    date=d,
                    leads=len(group),
                    qualified=sum(
                        1
                        for l in group
                        if l.status
                        in {
                            LeadStatus.QUALIFIED,
                            LeadStatus.MEETING_SCHEDULED,
                            LeadStatus.WON,
                        }
                    ),
                    value=sum(l.estimated_value or 0 for l in group),
                )
            )
        return points

    async def analytics(self, user: CurrentUser) -> AnalyticsData:
        conds = self._lead_filter(user)
        leads = list((await self.db.execute(select(Lead).where(*conds))).scalars().all())
        funnel = [
            PipelineMetric(
                status=s,
                label=s.replace("_", " ").title(),
                count=sum(1 for l in leads if l.status == s),
                value=sum(l.estimated_value or 0 for l in leads if l.status == s),
            )
            for s in PIPELINE_STATUSES
        ]
        source_counts: dict[str, list[Lead]] = defaultdict(list)
        for l in leads:
            source_counts[l.source or "Other"].append(l)
        sources = []
        for src, group in source_counts.items():
            qualified = sum(
                1
                for l in group
                if l.status
                in {LeadStatus.QUALIFIED, LeadStatus.MEETING_SCHEDULED, LeadStatus.WON}
            )
            wins = sum(1 for l in group if l.status == LeadStatus.WON)
            n = len(group) or 1
            sources.append(
                SourceMetric(
                    source=src,
                    count=len(group),
                    qualification_rate=round(qualified / n * 100, 1),
                    conversion_rate=round(wins / n * 100, 1),
                    pipeline_value=sum(l.estimated_value or 0 for l in group),
                )
            )

        users = list(
            (
                await self.db.execute(select(User).where(User.deleted_at.is_(None)))
            ).scalars().all()
        )
        appointments = list((await self.db.execute(select(Appointment))).scalars().all())
        team: list[TeamPerformanceMetric] = []
        for u in users:
            if u.role == "ADMIN":
                continue
            user_leads = [lead for lead in leads if lead.assigned_user_id == u.id]
            won_leads = [lead for lead in user_leads if lead.status == LeadStatus.WON]
            user_meetings = [a for a in appointments if a.assigned_user_id == u.id]
            denom = len(user_leads) or 1
            team.append(
                TeamPerformanceMetric(
                    user_id=str(u.id),
                    name=f"{u.first_name} {u.last_name}",
                    assigned_leads=len(user_leads),
                    qualified_leads=sum(
                        1
                        for lead in user_leads
                        if lead.status
                        in {LeadStatus.QUALIFIED, LeadStatus.MEETING_SCHEDULED, LeadStatus.WON}
                    ),
                    meetings=len(user_meetings),
                    wins=len(won_leads),
                    conversion_rate=round(len(won_leads) / denom * 100, 1),
                    revenue=sum(lead.estimated_value or 0 for lead in won_leads),
                )
            )

        workflows = list((await self.db.execute(select(Workflow))).scalars().all())
        executions = list((await self.db.execute(select(WorkflowExecution))).scalars().all())
        automation: list[AutomationPerformanceMetric] = []
        for w in workflows:
            execs = [e for e in executions if e.workflow_id == w.id]
            success = sum(1 for e in execs if e.status == "Success")
            failed = sum(1 for e in execs if e.status == "Failed")
            n = len(execs) or 1
            durations = [e.duration_ms or 0 for e in execs]
            automation.append(
                AutomationPerformanceMetric(
                    workflow_id=str(w.id),
                    workflow_name=w.name,
                    executions=len(execs),
                    success_rate=round(success / n * 100, 1),
                    average_duration_ms=round(sum(durations) / n, 1) if execs else 0,
                    failed_executions=failed,
                    recovered_executions=0,
                )
            )

        convs = list((await self.db.execute(select(Conversation))).scalars().all())
        handoffs = sum(1 for c in convs if c.human_handoff_requested)
        ai_handled = sum(1 for c in convs if c.status == ConversationStatus.AI_HANDLED)
        return AnalyticsData(
            lead_trend=await self.conversions(user),
            funnel=funnel,
            sources=sources,
            team_performance=team,
            automation_performance=automation,
            ai_performance=AiPerformance(
                conversations_handled=ai_handled or len(convs),
                qualification_rate=round(
                    sum(1 for l in leads if l.status != LeadStatus.NEW) / (len(leads) or 1) * 100, 1
                ),
                avg_score=round(sum(l.score or 0 for l in leads) / (len(leads) or 1), 1),
                human_handoff_rate=round(handoffs / (len(convs) or 1) * 100, 1),
                appointment_rate=round(
                    sum(1 for l in leads if l.status == LeadStatus.MEETING_SCHEDULED)
                    / (len(leads) or 1)
                    * 100,
                    1,
                ),
            ),
        )

    async def activities(self, lead_id: str | None = None) -> list[ActivityOut]:
        q = select(Activity).order_by(Activity.created_at.desc()).limit(200)
        if lead_id:
            q = q.where(Activity.lead_id == lead_id)
        result = await self.db.execute(q)
        return [activity_to_out(a) for a in result.scalars().all()]
