#!/usr/bin/env python3
"""Generate importable n8n workflow JSON files (no credentials)."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS_DIR = ROOT / "workflows"

BACKEND_URL = "={{ $env.AI_SALES_BACKEND_URL || 'http://backend:8000' }}"
INTERNAL_HEADER = "={{ $env.INTERNAL_API_KEY }}"


def _id() -> str:
    return str(uuid.uuid4())


def http_node(
    name: str,
    method: str,
    url: str,
    position: list[int],
    *,
    json_body: str | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "method": method,
        "url": url,
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "X-Internal-Key", "value": INTERNAL_HEADER},
                {"name": "Content-Type", "value": "application/json"},
            ]
        },
        "options": {"timeout": 30000},
    }
    if json_body is not None:
        params["sendBody"] = True
        params["specifyBody"] = "json"
        params["jsonBody"] = json_body
    return {
        "parameters": params,
        "id": _id(),
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": position,
        "credentials": {
            "httpHeaderAuth": {
                "id": "CONFIGURE_AI_SALES_INTERNAL_API",
                "name": "AI Sales Backend Internal API",
            }
        },
    }


def webhook_node(name: str, path: str, position: list[int]) -> dict[str, Any]:
    return {
        "parameters": {
            "httpMethod": "POST",
            "path": path,
            "responseMode": "responseNode",
            "options": {},
        },
        "id": _id(),
        "name": name,
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": position,
        "webhookId": _id(),
    }


def respond_node(name: str, position: list[int]) -> dict[str, Any]:
    return {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ { ok: true, executionId: $json.executionId, duplicate: $json.duplicate } }}",
        },
        "id": _id(),
        "name": name,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.1,
        "position": position,
    }


def if_node(name: str, condition: str, position: list[int]) -> dict[str, Any]:
    return {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "typeValidation": "strict"},
                "combinator": "and",
                "conditions": [
                    {
                        "id": _id(),
                        "leftValue": f"={{{{ {condition} }}}}",
                        "rightValue": True,
                        "operator": {"type": "boolean", "operation": "true"},
                    }
                ],
            }
        },
        "id": _id(),
        "name": name,
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": position,
    }


def schedule_node(name: str, minutes: str, position: list[int]) -> dict[str, Any]:
    return {
        "parameters": {
            "rule": {
                "interval": [{"field": "minutes", "minutesInterval": int(minutes)}],
            }
        },
        "id": _id(),
        "name": name,
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.2,
        "position": position,
    }


def build_workflow(name: str, nodes: list[dict], connections: dict) -> dict[str, Any]:
    return {
        "name": name,
        "nodes": nodes,
        "connections": connections,
        "active": False,
        "settings": {"executionOrder": "v1"},
        "meta": {"templateCredsSetupCompleted": False},
        "tags": [{"name": "ai-sales"}],
    }


def lead_capture() -> dict[str, Any]:
    wh = webhook_node("01 Webhook Lead Created", "lead-created", [200, 300])
    start = http_node(
        "03 Register Execution",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/start",
        [500, 300],
        json_body=(
            "={{ JSON.stringify({ workflowSlug: 'lead-capture', eventId: $json.body.eventId, "
            "leadId: $json.body.leadId, correlationId: $json.body.correlationId, "
            "externalExecutionId: $execution.id, input: $json.body }) }}"
        ),
    )
    enabled = if_node("04 Workflow Enabled?", "$json.workflowEnabled", [740, 300])
    welcome = http_node(
        "06 Send Welcome",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/leads/{{{{ $json.body.leadId }}}}/welcome?event_id={{{{ $json.body.eventId }}}}",
        [980, 220],
    )
    success = http_node(
        "09 Mark Success",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/{{{{ $('03 Register Execution').item.json.executionId }}}}/success",
        [1220, 300],
        json_body='={{ JSON.stringify({ output: { welcome: $json } }) }}',
    )
    respond = respond_node("10 Respond", [1460, 300])
    return build_workflow(
        "AI Sales — Lead Capture",
        [wh, start, enabled, welcome, success, respond],
        {
            "01 Webhook Lead Created": {"main": [[{"node": "03 Register Execution", "type": "main", "index": 0}]]},
            "03 Register Execution": {"main": [[{"node": "04 Workflow Enabled?", "type": "main", "index": 0}]]},
            "04 Workflow Enabled?": {
                "main": [
                    [{"node": "06 Send Welcome", "type": "main", "index": 0}],
                    [{"node": "10 Respond", "type": "main", "index": 0}],
                ]
            },
            "06 Send Welcome": {"main": [[{"node": "09 Mark Success", "type": "main", "index": 0}]]},
            "09 Mark Success": {"main": [[{"node": "10 Respond", "type": "main", "index": 0}]]},
        },
    )


def ai_qualification() -> dict[str, Any]:
    wh = webhook_node("01 Webhook Qualification Updated", "qualification-updated", [200, 300])
    start = http_node(
        "03 Register Execution",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/start",
        [500, 300],
        json_body=(
            "={{ JSON.stringify({ workflowSlug: 'ai-qualification', eventId: $json.body.eventId, "
            "leadId: $json.body.leadId, correlationId: $json.body.correlationId, input: $json.body }) }}"
        ),
    )
    handoff = if_node("05 Requires Human?", "$json.body.payload.requiresHuman", [740, 300])
    hot = if_node("07 Became Hot?", "$json.body.payload.becameHot", [980, 400])
    hot_actions = http_node(
        "08 Hot Lead Actions",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/leads/{{{{ $json.body.leadId }}}}/hot-lead-actions",
        [1220, 400],
        json_body="={{ JSON.stringify({ eventId: $json.body.eventId }) }}",
    )
    success = http_node(
        "10 Mark Success",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/{{{{ $('03 Register Execution').item.json.executionId }}}}/success",
        [1460, 300],
        json_body='={{ JSON.stringify({ output: { ok: true } }) }}',
    )
    respond = respond_node("11 Respond", [1700, 300])
    return build_workflow(
        "AI Sales — AI Qualification",
        [wh, start, handoff, hot, hot_actions, success, respond],
        {
            "01 Webhook Qualification Updated": {"main": [[{"node": "03 Register Execution", "type": "main", "index": 0}]]},
            "03 Register Execution": {"main": [[{"node": "05 Requires Human?", "type": "main", "index": 0}]]},
            "05 Requires Human?": {
                "main": [
                    [{"node": "10 Mark Success", "type": "main", "index": 0}],
                    [{"node": "07 Became Hot?", "type": "main", "index": 0}],
                ]
            },
            "07 Became Hot?": {
                "main": [
                    [{"node": "08 Hot Lead Actions", "type": "main", "index": 0}],
                    [{"node": "10 Mark Success", "type": "main", "index": 0}],
                ]
            },
            "08 Hot Lead Actions": {"main": [[{"node": "10 Mark Success", "type": "main", "index": 0}]]},
            "10 Mark Success": {"main": [[{"node": "11 Respond", "type": "main", "index": 0}]]},
        },
    )


def hot_lead_alert() -> dict[str, Any]:
    wh = webhook_node("01 Webhook Hot Lead", "hot-lead-alert", [200, 300])
    start = http_node(
        "03 Register Execution",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/start",
        [500, 300],
        json_body=(
            "={{ JSON.stringify({ workflowSlug: 'hot-lead-alert', eventId: $json.body.eventId, "
            "leadId: $json.body.leadId, input: $json.body }) }}"
        ),
    )
    check = http_node(
        "05 Hot Check",
        "GET",
        f"{BACKEND_URL}/api/v1/internal/n8n/leads/{{{{ $json.body.leadId }}}}/hot-check",
        [740, 300],
    )
    is_hot = if_node("06 Is Hot?", "$json.isHot", [980, 300])
    actions = http_node(
        "07 Hot Lead Actions",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/leads/{{{{ $('01 Webhook Hot Lead').item.json.body.leadId }}}}/hot-lead-actions",
        [1220, 300],
        json_body="={{ JSON.stringify({ eventId: $('01 Webhook Hot Lead').item.json.body.eventId }) }}",
    )
    success = http_node(
        "09 Mark Success",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/{{{{ $('03 Register Execution').item.json.executionId }}}}/success",
        [1460, 300],
        json_body='={{ JSON.stringify({ output: $json }) }}',
    )
    respond = respond_node("10 Respond", [1700, 300])
    return build_workflow(
        "AI Sales — Hot Lead Alert",
        [wh, start, check, is_hot, actions, success, respond],
        {
            "01 Webhook Hot Lead": {"main": [[{"node": "03 Register Execution", "type": "main", "index": 0}]]},
            "03 Register Execution": {"main": [[{"node": "05 Hot Check", "type": "main", "index": 0}]]},
            "05 Hot Check": {"main": [[{"node": "06 Is Hot?", "type": "main", "index": 0}]]},
            "06 Is Hot?": {
                "main": [
                    [{"node": "07 Hot Lead Actions", "type": "main", "index": 0}],
                    [{"node": "10 Respond", "type": "main", "index": 0}],
                ]
            },
            "07 Hot Lead Actions": {"main": [[{"node": "09 Mark Success", "type": "main", "index": 0}]]},
            "09 Mark Success": {"main": [[{"node": "10 Respond", "type": "main", "index": 0}]]},
        },
    )


def follow_up() -> dict[str, Any]:
    sched = schedule_node("01 Schedule", "30", [200, 300])
    due = http_node(
        "03 Get Due Follow-ups",
        "GET",
        f"{BACKEND_URL}/api/v1/internal/n8n/follow-ups/due",
        [440, 300],
    )
    execute = http_node(
        "05 Execute Follow-up",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/follow-ups/{{{{ $json.leadId }}}}/execute",
        [680, 300],
        json_body="={{ JSON.stringify({ idempotencyKey: $json.idempotencyKey }) }}",
    )
    return build_workflow(
        "AI Sales — Follow-up",
        [sched, due, execute],
        {
            "01 Schedule": {"main": [[{"node": "03 Get Due Follow-ups", "type": "main", "index": 0}]]},
            "03 Get Due Follow-ups": {"main": [[{"node": "05 Execute Follow-up", "type": "main", "index": 0}]]},
        },
    )


def appointment_booking() -> dict[str, Any]:
    wh = webhook_node("01 Webhook Appointment Created", "appointment-created", [200, 300])
    start = http_node(
        "03 Register Execution",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/start",
        [500, 300],
        json_body=(
            "={{ JSON.stringify({ workflowSlug: 'appointment-booking', eventId: $json.body.eventId, "
            "leadId: $json.body.leadId, input: $json.body }) }}"
        ),
    )
    actions = http_node(
        "06 Booking Actions",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/appointments/{{{{ $json.body.appointmentId }}}}/booking-actions",
        [740, 300],
        json_body="={{ JSON.stringify({ eventId: $json.body.eventId }) }}",
    )
    success = http_node(
        "09 Mark Success",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/{{{{ $('03 Register Execution').item.json.executionId }}}}/success",
        [980, 300],
        json_body='={{ JSON.stringify({ output: $json }) }}',
    )
    respond = respond_node("10 Respond", [1220, 300])
    return build_workflow(
        "AI Sales — Appointment Booking",
        [wh, start, actions, success, respond],
        {
            "01 Webhook Appointment Created": {"main": [[{"node": "03 Register Execution", "type": "main", "index": 0}]]},
            "03 Register Execution": {"main": [[{"node": "06 Booking Actions", "type": "main", "index": 0}]]},
            "06 Booking Actions": {"main": [[{"node": "09 Mark Success", "type": "main", "index": 0}]]},
            "09 Mark Success": {"main": [[{"node": "10 Respond", "type": "main", "index": 0}]]},
        },
    )


def meeting_reminder() -> dict[str, Any]:
    sched = schedule_node("01 Schedule", "30", [200, 300])
    due = http_node(
        "03 Get Due Reminders",
        "GET",
        f"{BACKEND_URL}/api/v1/internal/n8n/appointments/reminders/due",
        [440, 300],
    )
    send = http_node(
        "05 Send Reminder",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/appointments/{{{{ $json.appointmentId }}}}/send-reminder",
        [680, 300],
        json_body="={{ JSON.stringify({ idempotencyKey: $json.idempotencyKey }) }}",
    )
    return build_workflow(
        "AI Sales — Meeting Reminder",
        [sched, due, send],
        {
            "01 Schedule": {"main": [[{"node": "03 Get Due Reminders", "type": "main", "index": 0}]]},
            "03 Get Due Reminders": {"main": [[{"node": "05 Send Reminder", "type": "main", "index": 0}]]},
        },
    )


def global_error_handler() -> dict[str, Any]:
    err = {
        "parameters": {},
        "id": _id(),
        "name": "01 Error Trigger",
        "type": "n8n-nodes-base.errorTrigger",
        "typeVersion": 1,
        "position": [200, 300],
    }
    report = http_node(
        "03 Report Failure",
        "POST",
        f"{BACKEND_URL}/api/v1/internal/n8n/executions/failure-report",
        [500, 300],
        json_body=(
            "={{ JSON.stringify({ workflow: $json.workflow, execution: $json.execution, "
            "errorMessage: $json.execution.error.message }) }}"
        ),
    )
    return build_workflow("AI Sales — Global Error Handler", [err, report], {
        "01 Error Trigger": {"main": [[{"node": "03 Report Failure", "type": "main", "index": 0}]]}
    })


WORKFLOW_BUILDERS = {
    "01_lead_capture.json": lead_capture,
    "02_ai_qualification.json": ai_qualification,
    "03_hot_lead_alert.json": hot_lead_alert,
    "04_follow_up.json": follow_up,
    "05_appointment_booking.json": appointment_booking,
    "06_meeting_reminder.json": meeting_reminder,
    "99_global_error_handler.json": global_error_handler,
}


def main() -> None:
    WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    for filename, builder in WORKFLOW_BUILDERS.items():
        path = WORKFLOWS_DIR / filename
        path.write_text(json.dumps(builder(), indent=2), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
