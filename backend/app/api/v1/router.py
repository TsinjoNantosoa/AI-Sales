"""API v1 router aggregation."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    activities,
    analytics,
    appointments,
    audit_logs,
    auth,
    automations,
    conversations,
    dashboard,
    emails,
    integrations,
    internal,
    internal_n8n,
    leads,
    notifications,
    public,
    settings,
    tasks,
    users,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(leads.router)
api_router.include_router(conversations.router)
api_router.include_router(appointments.router)
api_router.include_router(tasks.router)
api_router.include_router(notifications.router)
api_router.include_router(users.router)
api_router.include_router(dashboard.router)
api_router.include_router(analytics.router)
api_router.include_router(activities.router)
api_router.include_router(automations.router)
api_router.include_router(integrations.router)
api_router.include_router(settings.router)
api_router.include_router(audit_logs.router)
api_router.include_router(emails.router)
api_router.include_router(webhooks.router)
api_router.include_router(internal.router)
api_router.include_router(internal_n8n.router)
api_router.include_router(public.router)
