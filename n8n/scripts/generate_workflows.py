#!/usr/bin/env python3
"""Generate the canonical AI Sales Assistant n8n workflows.

The generated workflows are credential-free and rely on environment variables:
- AI_SALES_BACKEND_URL
- INTERNAL_API_KEY
- N8N_WEBHOOK_SECRET

FastAPI remains the source of truth. n8n only orchestrates backend actions.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS_DIR = ROOT / "workflows"
NAMESPACE = uuid.UUID("6cf04f26-9802-4fd4-beb7-6fd03537dc48")
BACKEND = "={{ $env.AI_SALES_BACKEND_URL || 'http://backend:8000' }}"
INTERNAL_KEY = "={{ $env.INTERNAL_API_KEY }}"
WEBHOOK_SECRET = "={{ $env.N8N_WEBHOOK_SECRET || '' }}"


def sid(scope: str, name: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{scope}:{name}"))


def sticky(scope: str, name: str, content: str, pos: list[int], width: int = 500, height: int = 280) -> dict[str, Any]:
    return {
        "parameters": {"content": content, "height": height, "width": width},
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": pos,
    }


def webhook(scope: str, name: str, path: str, pos: list[int]) -> dict[str, Any]:
    return {
        "parameters": {
            "httpMethod": "POST",
            "path": path,
            "responseMode": "responseNode",
            "options": {},
        },
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": pos,
        "webhookId": sid(scope, f"webhook:{path}"),
    }


def auth_code(scope: str, name: str, pos: list[int]) -> dict[str, Any]:
    js = """const item = $input.first().json;
const headers = item.headers || {};
const expected = $env.N8N_WEBHOOK_SECRET || '';
const provided = headers['x-n8n-webhook-key'] || headers['X-N8N-Webhook-Key'] || '';
return [{ json: { ...item, __authOk: expected.length >= 16 && provided === expected } }];"""
    return code(scope, name, js, pos)


def normalize_event(scope: str, name: str, expected_type: str, required: list[str], pos: list[int]) -> dict[str, Any]:
    required_js = json.dumps(required)
    js = f"""const source = $input.first().json;
const body = source.body || source;
const payload = body.payload || {{}};
const out = {{
  eventId: body.eventId || body.event_id,
  eventType: body.eventType || body.event_type,
  correlationId: body.correlationId || body.correlation_id || null,
  leadId: body.leadId || body.lead_id || payload.leadId || payload.lead_id || null,
  conversationId: body.conversationId || body.conversation_id || payload.conversationId || payload.conversation_id || null,
  appointmentId: body.appointmentId || body.appointment_id || payload.appointmentId || payload.appointment_id || null,
  payload,
  requiresHuman: payload.requiresHuman === true || payload.requires_human === true,
  becameHot: payload.becameHot === true || payload.became_hot === true,
  score: payload.score ?? null,
  temperature: payload.temperature ?? null
}};
if (!out.eventId) throw new Error('Missing eventId');
if (out.eventType !== '{expected_type}') throw new Error(`Unexpected eventType: ${{out.eventType}}`);
for (const field of {required_js}) {{ if (!out[field]) throw new Error(`Missing ${{field}}`); }}
return [{{ json: out }}];"""
    return code(scope, name, js, pos)


def code(scope: str, name: str, js: str, pos: list[int], *, execute_once: bool = False) -> dict[str, Any]:
    node: dict[str, Any] = {
        "parameters": {"jsCode": js},
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
    }
    if execute_once:
        node["executeOnce"] = True
    return node


def if_bool(scope: str, name: str, expr: str, pos: list[int]) -> dict[str, Any]:
    return {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
                "conditions": [{
                    "id": sid(scope, f"condition:{name}"),
                    "leftValue": expr,
                    "rightValue": True,
                    "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                }],
                "combinator": "and",
            },
            "options": {},
        },
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": pos,
    }


def http(scope: str, name: str, method: str, url: str, pos: list[int], *, body: str | None = None,
         query: list[tuple[str, str]] | None = None, execute_once: bool = False, retry: bool = True) -> dict[str, Any]:
    params: dict[str, Any] = {
        "method": method,
        "url": url,
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "X-Internal-Key", "value": INTERNAL_KEY},
            {"name": "Content-Type", "value": "application/json"},
        ]},
        "options": {"timeout": 30000},
    }
    if body is not None:
        params.update({"sendBody": True, "specifyBody": "json", "jsonBody": body})
    if query:
        params.update({"sendQuery": True, "queryParameters": {"parameters": [
            {"name": k, "value": v} for k, v in query
        ]}})
    node: dict[str, Any] = {
        "parameters": params,
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": pos,
    }
    if retry:
        node.update({"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 2000})
    if execute_once:
        node["executeOnce"] = True
    return node


def respond(scope: str, name: str, pos: list[int], body: str, code_value: int = 200) -> dict[str, Any]:
    return {
        "parameters": {
            "respondWith": "json",
            "responseBody": body,
            "options": {"responseCode": code_value},
        },
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.4,
        "position": pos,
    }


def schedule(scope: str, name: str, minutes: int, pos: list[int]) -> dict[str, Any]:
    return {
        "parameters": {"rule": {"interval": [{"field": "minutes", "minutesInterval": minutes}]}},
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.2,
        "position": pos,
    }


def error_trigger(scope: str, name: str, pos: list[int]) -> dict[str, Any]:
    return {
        "parameters": {},
        "id": sid(scope, name),
        "name": name,
        "type": "n8n-nodes-base.errorTrigger",
        "typeVersion": 1,
        "position": pos,
    }


def workflow(name: str, nodes: list[dict[str, Any]], connections: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": name,
        "nodes": nodes,
        "connections": connections,
        "pinData": {},
        "active": False,
        "settings": {"executionOrder": "v1"},
        "meta": {"templateCredsSetupCompleted": False},
    }


def con(*targets: str) -> dict[str, Any]:
    return {"main": [[{"node": t, "type": "main", "index": 0} for t in targets]]}


def bif(true_targets: list[str], false_targets: list[str]) -> dict[str, Any]:
    return {"main": [
        [{"node": t, "type": "main", "index": 0} for t in true_targets],
        [{"node": t, "type": "main", "index": 0} for t in false_targets],
    ]}


def common_event_front(scope: str, webhook_name: str, path: str, expected_type: str, required: list[str]):
    wh = webhook(scope, webhook_name, path, [0, 300])
    auth = auth_code(scope, "02 Verify Webhook Secret", [220, 300])
    auth_if = if_bool(scope, "03 Authorized?", "={{ $json.__authOk }}", [440, 300])
    norm = normalize_event(scope, "04 Normalize + Validate Event", expected_type, required, [680, 220])
    unauth = respond(scope, "03b Respond Unauthorized", [680, 430], '={{ { ok: false, error: "unauthorized" } }}', 401)
    return [wh, auth, auth_if, norm, unauth]


def register(scope: str, slug: str, pos: list[int], *, lead_expr: str | None = None, input_expr: str, event_expr: str, corr_expr: str | None = None, node_name: str = "05 Register Execution"):
    parts = [f"workflowSlug: '{slug}'", f"eventId: {event_expr}", "externalExecutionId: $execution.id", f"input: {input_expr}"]
    if lead_expr:
        parts.append(f"leadId: {lead_expr}")
    if corr_expr:
        parts.append(f"correlationId: {corr_expr}")
    body = "={{ JSON.stringify({ " + ", ".join(parts) + " }) }}"
    return http(scope, node_name, "POST", f"{BACKEND}/api/v1/internal/n8n/executions/start", pos, body=body)


def mark_success(scope: str, register_node: str, pos: list[int], output_expr: str, *, execute_once: bool = False):
    body = f"={{ JSON.stringify({{ externalExecutionId: $execution.id, output: {output_expr} }}) }}"
    success_url = BACKEND + "/api/v1/internal/n8n/executions/{{ $('" + register_node + "').item.json.executionId }}/success"
    return http(
        scope,
        "99 Mark Success",
        "POST",
        success_url,
        pos,
        body=body,
        execute_once=execute_once,
    )


def lead_capture() -> dict[str, Any]:
    s = "01-lead-capture"
    front = common_event_front(s, "01 Webhook Lead Created", "lead-created", "lead.created", ["leadId"])
    reg = register(s, "lead-capture", [920, 220], lead_expr="$('04 Normalize + Validate Event').item.json.leadId",
                   event_expr="$('04 Normalize + Validate Event').item.json.eventId",
                   corr_expr="$('04 Normalize + Validate Event').item.json.correlationId",
                   input_expr="$('04 Normalize + Validate Event').item.json")
    dup = if_bool(s, "06 Duplicate?", "={{ $json.duplicate }}", [1160, 220])
    enabled = if_bool(s, "07 Workflow Enabled?", "={{ $json.workflowEnabled }}", [1380, 280])
    welcome = http(s, "08 Send Welcome", "POST",
        f"{BACKEND}/api/v1/internal/n8n/leads/{{{{ $('04 Normalize + Validate Event').item.json.leadId }}}}/welcome",
        [1620, 220], query=[("event_id", "={{ $('04 Normalize + Validate Event').item.json.eventId }}")])
    success = mark_success(s, "05 Register Execution", [1850, 220],
        "{ welcomeSent: $json.sent === true, duplicateAction: $json.duplicate === true }")
    resp = respond(s, "100 Respond", [2080, 300],
        '={{ { ok: true, executionId: $("05 Register Execution").item.json.executionId, duplicate: $("05 Register Execution").item.json.duplicate, workflowEnabled: $("05 Register Execution").item.json.workflowEnabled } }}')
    note = sticky(s, "README — Lead Capture", "# Lead Capture\nAuthenticated `lead.created` event → idempotency → backend welcome action → execution tracking.\n\nFastAPI owns lead creation and qualification logic.", [-10, -80])
    nodes = [note, *front, reg, dup, enabled, welcome, success, resp]
    c = {
        "01 Webhook Lead Created": con("02 Verify Webhook Secret"),
        "02 Verify Webhook Secret": con("03 Authorized?"),
        "03 Authorized?": bif(["04 Normalize + Validate Event"], ["03b Respond Unauthorized"]),
        "04 Normalize + Validate Event": con("05 Register Execution"),
        "05 Register Execution": con("06 Duplicate?"),
        "06 Duplicate?": bif(["100 Respond"], ["07 Workflow Enabled?"]),
        "07 Workflow Enabled?": bif(["08 Send Welcome"], ["100 Respond"]),
        "08 Send Welcome": con("99 Mark Success"),
        "99 Mark Success": con("100 Respond"),
    }
    return workflow("AI Sales — Lead Capture", nodes, c)


def ai_qualification() -> dict[str, Any]:
    s = "02-ai-qualification"
    front = common_event_front(s, "01 Webhook Qualification Updated", "qualification-updated", "lead.qualification.updated", ["leadId"])
    reg = register(s, "ai-qualification", [920, 220], lead_expr="$('04 Normalize + Validate Event').item.json.leadId",
                   event_expr="$('04 Normalize + Validate Event').item.json.eventId",
                   corr_expr="$('04 Normalize + Validate Event').item.json.correlationId",
                   input_expr="$('04 Normalize + Validate Event').item.json")
    dup = if_bool(s, "06 Duplicate?", "={{ $json.duplicate }}", [1160, 220])
    enabled = if_bool(s, "07 Workflow Enabled?", "={{ $json.workflowEnabled }}", [1380, 280])
    success = mark_success(s, "05 Register Execution", [1620, 220],
        "{ requiresHuman: $('04 Normalize + Validate Event').item.json.requiresHuman, becameHot: $('04 Normalize + Validate Event').item.json.becameHot, score: $('04 Normalize + Validate Event').item.json.score, temperature: $('04 Normalize + Validate Event').item.json.temperature, routing: 'backend_authoritative' }")
    resp = respond(s, "100 Respond", [1860, 300],
        '={{ { ok: true, executionId: $("05 Register Execution").item.json.executionId, duplicate: $("05 Register Execution").item.json.duplicate, workflowEnabled: $("05 Register Execution").item.json.workflowEnabled } }}')
    note = sticky(s, "README — Qualification", "# AI Qualification\nRecords and observes the authoritative LangGraph qualification result.\n\n**No OpenAI node here.** LangGraph, scoring, handoff and CRM state remain in FastAPI. `lead.hot` is handled separately by workflow 03.", [-10, -80], 590, 320)
    nodes = [note, *front, reg, dup, enabled, success, resp]
    c = {
        "01 Webhook Qualification Updated": con("02 Verify Webhook Secret"),
        "02 Verify Webhook Secret": con("03 Authorized?"),
        "03 Authorized?": bif(["04 Normalize + Validate Event"], ["03b Respond Unauthorized"]),
        "04 Normalize + Validate Event": con("05 Register Execution"),
        "05 Register Execution": con("06 Duplicate?"),
        "06 Duplicate?": bif(["100 Respond"], ["07 Workflow Enabled?"]),
        "07 Workflow Enabled?": bif(["99 Mark Success"], ["100 Respond"]),
        "99 Mark Success": con("100 Respond"),
    }
    return workflow("AI Sales — AI Qualification", nodes, c)


def hot_lead() -> dict[str, Any]:
    s = "03-hot-lead"
    front = common_event_front(s, "01 Webhook Hot Lead", "hot-lead-alert", "lead.hot", ["leadId"])
    reg = register(s, "hot-lead-alert", [920, 220], lead_expr="$('04 Normalize + Validate Event').item.json.leadId",
                   event_expr="$('04 Normalize + Validate Event').item.json.eventId",
                   corr_expr="$('04 Normalize + Validate Event').item.json.correlationId",
                   input_expr="$('04 Normalize + Validate Event').item.json")
    dup = if_bool(s, "06 Duplicate?", "={{ $json.duplicate }}", [1160, 220])
    enabled = if_bool(s, "07 Workflow Enabled?", "={{ $json.workflowEnabled }}", [1380, 280])
    check = http(s, "08 Confirm HOT in Backend", "GET",
        f"{BACKEND}/api/v1/internal/n8n/leads/{{{{ $('04 Normalize + Validate Event').item.json.leadId }}}}/hot-check", [1600, 220])
    ishot = if_bool(s, "09 Is HOT?", "={{ $json.isHot }}", [1820, 220])
    actions = http(s, "10 Execute HOT Actions", "POST",
        f"{BACKEND}/api/v1/internal/n8n/leads/{{{{ $('04 Normalize + Validate Event').item.json.leadId }}}}/hot-lead-actions", [2040, 160],
        query=[("event_id", "={{ $('04 Normalize + Validate Event').item.json.eventId }}")])
    success = mark_success(s, "05 Register Execution", [2280, 240],
        "{ isHot: $('08 Confirm HOT in Backend').item.json.isHot === true, actionDuplicate: $json.duplicate === true, actionSkipped: $json.skipped === true }")
    resp = respond(s, "100 Respond", [2500, 300],
        '={{ { ok: true, executionId: $("05 Register Execution").item.json.executionId, duplicate: $("05 Register Execution").item.json.duplicate, workflowEnabled: $("05 Register Execution").item.json.workflowEnabled } }}')
    note = sticky(s, "README — Hot Lead", "# HOT Lead\nBackend re-checks the authoritative threshold, then creates the priority task, in-app notification, salesperson email and activity.\n\nThe same event is safe to replay.", [-10, -80], 560, 300)
    nodes = [note, *front, reg, dup, enabled, check, ishot, actions, success, resp]
    c = {
        "01 Webhook Hot Lead": con("02 Verify Webhook Secret"),
        "02 Verify Webhook Secret": con("03 Authorized?"),
        "03 Authorized?": bif(["04 Normalize + Validate Event"], ["03b Respond Unauthorized"]),
        "04 Normalize + Validate Event": con("05 Register Execution"),
        "05 Register Execution": con("06 Duplicate?"),
        "06 Duplicate?": bif(["100 Respond"], ["07 Workflow Enabled?"]),
        "07 Workflow Enabled?": bif(["08 Confirm HOT in Backend"], ["100 Respond"]),
        "08 Confirm HOT in Backend": con("09 Is HOT?"),
        "09 Is HOT?": bif(["10 Execute HOT Actions"], ["99 Mark Success"]),
        "10 Execute HOT Actions": con("99 Mark Success"),
        "99 Mark Success": con("100 Respond"),
    }
    return workflow("AI Sales — Hot Lead Alert", nodes, c)


def run_context(scope: str, prefix: str, pos: list[int]) -> dict[str, Any]:
    js = f"""const now = new Date();
const bucket = new Date(now);
bucket.setSeconds(0, 0);
bucket.setMinutes(Math.floor(bucket.getMinutes() / 30) * 30);
return [{{ json: {{ runId: '{prefix}-' + bucket.toISOString(), startedAt: now.toISOString() }} }}];"""
    return code(scope, "02 Create Run Context", js, pos)


def normalize_collection(scope: str, name: str, id_field: str, pos: list[int]) -> dict[str, Any]:
    js = f"""const inputs = $input.all();
const rows = [];
for (const item of inputs) {{
  const j = item.json;
  if (Array.isArray(j)) rows.push(...j);
  else if (Array.isArray(j.data)) rows.push(...j.data);
  else if (Array.isArray(j.body)) rows.push(...j.body);
  else if (j && j.{id_field}) rows.push(j);
}}
if (rows.length === 0) return [{{ json: {{ hasWork: false }} }}];
return rows.map((row, index) => ({{ json: {{ ...row, hasWork: true }}, pairedItem: {{ item: Math.min(index, Math.max(inputs.length - 1, 0)) }} }}));"""
    return code(scope, name, js, pos)


def scheduled_workflow(*, scope: str, title: str, slug: str, prefix: str, get_path: str, normalize_name: str,
                       id_field: str, execute_path_expr: str, execute_body: str, note_text: str) -> dict[str, Any]:
    sch = schedule(scope, "01 Schedule Every 30 Minutes", 30, [0, 300])
    ctx = run_context(scope, prefix, [220, 300])
    reg = register(scope, slug, [460, 300], event_expr="$json.runId", input_expr="{ runId: $json.runId, startedAt: $json.startedAt }", node_name="03 Register Execution")
    dup = if_bool(scope, "04 Duplicate Run?", "={{ $json.duplicate }}", [700, 300])
    enabled = if_bool(scope, "05 Workflow Enabled?", "={{ $json.workflowEnabled }}", [920, 360])
    get_due = http(scope, "06 Fetch Due Items", "GET", f"{BACKEND}{get_path}", [1160, 300])
    norm = normalize_collection(scope, normalize_name, id_field, [1390, 300])
    has = if_bool(scope, "08 Has Work?", "={{ $json.hasWork }}", [1620, 300])
    execute = http(scope, "09 Execute Item", "POST", execute_path_expr, [1850, 220], body=execute_body)
    success = mark_success(scope, "03 Register Execution", [2100, 340], "{ ok: true }", execute_once=True)
    note = sticky(scope, f"README — {title}", note_text, [-10, -80], 580, 300)
    nodes = [note, sch, ctx, reg, dup, enabled, get_due, norm, has, execute, success]
    c = {
        "01 Schedule Every 30 Minutes": con("02 Create Run Context"),
        "02 Create Run Context": con("03 Register Execution"),
        "03 Register Execution": con("04 Duplicate Run?"),
        "04 Duplicate Run?": bif([], ["05 Workflow Enabled?"]),
        "05 Workflow Enabled?": bif(["06 Fetch Due Items"], []),
        "06 Fetch Due Items": con(normalize_name),
        normalize_name: con("08 Has Work?"),
        "08 Has Work?": bif(["09 Execute Item"], ["99 Mark Success"]),
        "09 Execute Item": con("99 Mark Success"),
    }
    return workflow(title, nodes, c)


def follow_up() -> dict[str, Any]:
    return scheduled_workflow(
        scope="04-follow-up",
        title="AI Sales — Follow-up",
        slug="follow-up",
        prefix="follow-up-schedule",
        get_path="/api/v1/internal/n8n/follow-ups/due",
        normalize_name="07 Normalize Due Leads",
        id_field="leadId",
        execute_path_expr=f"{BACKEND}/api/v1/internal/n8n/follow-ups/{{{{ $json.leadId }}}}/execute",
        execute_body="={{ JSON.stringify({ idempotencyKey: $json.idempotencyKey }) }}",
        note_text="# Follow-up\nEvery 30 minutes, n8n asks FastAPI which leads are due. FastAPI owns the 24h / 3d / 7d rules and idempotency.\n\nWith `N8N_ENABLED=true`, this schedule replaces the ARQ follow-up cron.",
    )


def appointment_booking() -> dict[str, Any]:
    s = "05-appointment"
    front = common_event_front(s, "01 Webhook Appointment Created", "appointment-created", "appointment.created", ["leadId", "appointmentId"])
    reg = register(s, "appointment-booking", [920, 220], lead_expr="$('04 Normalize + Validate Event').item.json.leadId",
                   event_expr="$('04 Normalize + Validate Event').item.json.eventId",
                   corr_expr="$('04 Normalize + Validate Event').item.json.correlationId",
                   input_expr="$('04 Normalize + Validate Event').item.json")
    dup = if_bool(s, "06 Duplicate?", "={{ $json.duplicate }}", [1160, 220])
    enabled = if_bool(s, "07 Workflow Enabled?", "={{ $json.workflowEnabled }}", [1380, 280])
    actions = http(s, "08 Execute Booking Actions", "POST",
        f"{BACKEND}/api/v1/internal/n8n/appointments/{{{{ $('04 Normalize + Validate Event').item.json.appointmentId }}}}/booking-actions", [1620, 220],
        query=[("event_id", "={{ $('04 Normalize + Validate Event').item.json.eventId }}")])
    success = mark_success(s, "05 Register Execution", [1860, 220],
        "{ appointmentId: $('04 Normalize + Validate Event').item.json.appointmentId, actionDuplicate: $json.duplicate === true }")
    resp = respond(s, "100 Respond", [2090, 300],
        '={{ { ok: true, executionId: $("05 Register Execution").item.json.executionId, duplicate: $("05 Register Execution").item.json.duplicate, workflowEnabled: $("05 Register Execution").item.json.workflowEnabled } }}')
    note = sticky(s, "README — Appointment", "# Appointment Booking\nAfter FastAPI persists the appointment, n8n orchestrates calendar sync, confirmation, preparation task, notification and activity through the backend abstraction.\n\nGoogle can remain in mock mode until credentials are added.", [-10, -80], 600, 320)
    nodes = [note, *front, reg, dup, enabled, actions, success, resp]
    c = {
        "01 Webhook Appointment Created": con("02 Verify Webhook Secret"),
        "02 Verify Webhook Secret": con("03 Authorized?"),
        "03 Authorized?": bif(["04 Normalize + Validate Event"], ["03b Respond Unauthorized"]),
        "04 Normalize + Validate Event": con("05 Register Execution"),
        "05 Register Execution": con("06 Duplicate?"),
        "06 Duplicate?": bif(["100 Respond"], ["07 Workflow Enabled?"]),
        "07 Workflow Enabled?": bif(["08 Execute Booking Actions"], ["100 Respond"]),
        "08 Execute Booking Actions": con("99 Mark Success"),
        "99 Mark Success": con("100 Respond"),
    }
    return workflow("AI Sales — Appointment Booking", nodes, c)


def meeting_reminder() -> dict[str, Any]:
    return scheduled_workflow(
        scope="06-reminder",
        title="AI Sales — Meeting Reminder",
        slug="meeting-reminder",
        prefix="meeting-reminder",
        get_path="/api/v1/internal/n8n/appointments/reminders/due",
        normalize_name="07 Normalize Due Appointments",
        id_field="appointmentId",
        execute_path_expr=f"{BACKEND}/api/v1/internal/n8n/appointments/{{{{ $json.appointmentId }}}}/send-reminder",
        execute_body="={{ JSON.stringify({ idempotencyKey: $json.idempotencyKey }) }}",
        note_text="# Meeting Reminder\nPolls upcoming appointments and asks FastAPI to send each reminder exactly once.\n\nTimezone and appointment truth remain in the backend.",
    )


def error_handler() -> dict[str, Any]:
    s = "99-error"
    trig = error_trigger(s, "01 Error Trigger", [0, 300])
    js = """const d = $input.first().json;
const workflow = d.workflow || {};
const execution = d.execution || {};
const error = execution.error || d.error || {};
return [{ json: {
  workflowId: workflow.id || null,
  workflowName: workflow.name || null,
  executionId: execution.id || null,
  failedNode: error.node?.name || error.node || null,
  errorType: error.name || 'WorkflowError',
  errorMessage: String(error.message || d.message || 'Unknown workflow error').slice(0, 1000),
  timestamp: new Date().toISOString()
} }];"""
    norm = code(s, "02 Normalize Error", js, [240, 300])
    report = http(s, "03 Report Failure", "POST", f"{BACKEND}/api/v1/internal/n8n/executions/failure-report", [500, 300],
        body="={{ JSON.stringify({ workflow: { id: $json.workflowId, name: $json.workflowName }, execution: { id: $json.executionId }, errorMessage: $json.errorMessage, externalExecutionId: $json.executionId }) }}")
    note = sticky(s, "README — Error Handler", "# Global Error Handler\nAttach this workflow as the Error Workflow for workflows 01–06 after import. It reports a sanitized failure to FastAPI.\n\nThe integration phase must correlate `externalExecutionId` back to the existing `WorkflowExecution` rather than creating a second row.", [-10, -80], 640, 320)
    return workflow("AI Sales — Global Error Handler", [note, trig, norm, report], {
        "01 Error Trigger": con("02 Normalize Error"),
        "02 Normalize Error": con("03 Report Failure"),
    })


BUILDERS = {
    "01_lead_capture.json": lead_capture,
    "02_ai_qualification.json": ai_qualification,
    "03_hot_lead_alert.json": hot_lead,
    "04_follow_up.json": follow_up,
    "05_appointment_booking.json": appointment_booking,
    "06_meeting_reminder.json": meeting_reminder,
    "99_global_error_handler.json": error_handler,
}


def main() -> None:
    WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    for filename, builder in BUILDERS.items():
        path = WORKFLOWS_DIR / filename
        path.write_text(json.dumps(builder(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"generated {path}")


if __name__ == "__main__":
    main()
