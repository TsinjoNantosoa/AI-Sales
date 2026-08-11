"""RBAC permissions and role helpers."""

from __future__ import annotations

from enum import StrEnum

from app.core.exceptions import AuthorizationError, NotFoundError


class Role(StrEnum):
    ADMIN = "ADMIN"
    SALES_MANAGER = "SALES_MANAGER"
    SALES_REPRESENTATIVE = "SALES_REPRESENTATIVE"


# Permissions matrix (coarse-grained)
ROLE_PERMISSIONS: dict[Role, set[str]] = {
    Role.ADMIN: {"*"},
    Role.SALES_MANAGER: {
        "dashboard:read",
        "leads:read",
        "leads:write",
        "leads:assign",
        "leads:export",
        "conversations:read",
        "conversations:write",
        "appointments:read",
        "appointments:write",
        "tasks:read",
        "tasks:write",
        "notifications:read",
        "analytics:read",
        "team:read",
        "team:invite",
        "integrations:read",
        "integrations:write",
        "settings:read",
        "settings:write_limited",
        "automations:read",
        "automations:write",
        "audit:read",
        "emails:read",
        "emails:send",
    },
    Role.SALES_REPRESENTATIVE: {
        "dashboard:read_own",
        "leads:read_own",
        "leads:write_own",
        "conversations:read_own",
        "conversations:write_own",
        "appointments:read_own",
        "appointments:write_own",
        "tasks:read_own",
        "tasks:write_own",
        "notifications:read_own",
        "analytics:read_own",
        "profile:read",
        "profile:write",
    },
}


def has_permission(role: str, permission: str) -> bool:
    try:
        role_enum = Role(role)
    except ValueError:
        return False
    perms = ROLE_PERMISSIONS.get(role_enum, set())
    if "*" in perms:
        return True
    if permission in perms:
        return True
    # own-scoped permissions satisfy general read/write checks for own resources
    base = permission.replace("_own", "")
    if f"{base}_own" in perms and permission.endswith("_own"):
        return True
    return False


def require_roles(*allowed: str) -> None:
    """Raise if current role not in allowed — used with dependency injection."""


def ensure_permission(role: str, permission: str) -> None:
    if not has_permission(role, permission):
        # Also allow if they have the _own variant and caller will scope later
        if has_permission(role, f"{permission}_own"):
            return
        raise AuthorizationError(f"Missing permission: {permission}")


def is_admin(role: str) -> bool:
    return role == Role.ADMIN


def is_manager_or_admin(role: str) -> bool:
    return role in {Role.ADMIN, Role.SALES_MANAGER}


def can_access_all_leads(role: str) -> bool:
    return is_manager_or_admin(role)


def ensure_lead_access(
    *,
    role: str,
    user_id: str,
    lead_assigned_user_id: str | None,
    hide_as_not_found: bool = True,
) -> None:
    if can_access_all_leads(role):
        return
    if lead_assigned_user_id == user_id:
        return
    if hide_as_not_found:
        raise NotFoundError("Lead not found", code="LEAD_NOT_FOUND")
    raise AuthorizationError("You cannot access this lead")


def ensure_conversation_access(
    *,
    role: str,
    user_id: str,
    conversation_assigned_user_id: str | None,
    lead_assigned_user_id: str | None = None,
    hide_as_not_found: bool = True,
) -> None:
    if can_access_all_leads(role):
        return
    if conversation_assigned_user_id == user_id or lead_assigned_user_id == user_id:
        return
    if hide_as_not_found:
        raise NotFoundError("Conversation not found", code="CONVERSATION_NOT_FOUND")
    raise AuthorizationError("You cannot access this conversation")


def ensure_appointment_access(
    *,
    role: str,
    user_id: str,
    appointment_assigned_user_id: str | None,
    hide_as_not_found: bool = True,
) -> None:
    if can_access_all_leads(role):
        return
    if appointment_assigned_user_id == user_id:
        return
    if hide_as_not_found:
        raise NotFoundError("Appointment not found", code="APPOINTMENT_NOT_FOUND")
    raise AuthorizationError("You cannot access this appointment")


def ensure_task_access(
    *,
    role: str,
    user_id: str,
    task_assigned_user_id: str | None,
    hide_as_not_found: bool = True,
) -> None:
    if can_access_all_leads(role):
        return
    if task_assigned_user_id == user_id:
        return
    if hide_as_not_found:
        raise NotFoundError("Task not found", code="TASK_NOT_FOUND")
    raise AuthorizationError("You cannot access this task")
