# Frontend ↔ Backend API contract

Base path: **`/api/v1`** (frontend `VITE_API_URL` default `http://localhost:8000/api/v1`).

All JSON fields are **camelCase** in responses (Pydantic `to_camel` aliases). Requests accept camelCase or snake_case.

## Auth

| Method | Path | Notes |
|--------|------|--------|
| POST | `/auth/login` | Body `{ email, password }` → `{ user, token, refreshToken?, tokenType, expiresIn }` |
| POST | `/auth/forgot-password` | `{ email }` → `{ resetToken?, message }` |
| POST | `/auth/reset-password` | `{ token, password }` |
| POST | `/auth/refresh` | `{ refreshToken }` → same shape as login |
| POST | `/auth/logout` | Bearer + optional `{ refreshToken }` |
| GET | `/auth/me` | Bearer → `AuthUser` |

## Leads

| Method | Path |
|--------|------|
| GET | `/leads?assigned_to_me=&include_archived=` → `Lead[]` |
| POST | `/leads` |
| GET/PATCH/DELETE | `/leads/{id}` |
| POST | `/leads/{id}/archive`, `/assign`, `/score` |
| GET/POST | `/leads/{id}/notes` |
| GET | `/leads/{id}/emails` |
| POST | `/leads/bulk`, `/bulk-archive`, `/bulk-delete`, `/import` |
| POST | `/public/leads` (no auth) |

`LeadSource`: `Website`, `Chatbot`, `Email`, `Referral`, `LinkedIn`, …

## Conversations

| Method | Path |
|--------|------|
| GET/POST | `/conversations` |
| GET | `/conversations/{id}` |
| POST | `/conversations/{id}/messages` |
| POST | `/conversations/{id}/qualify` | `{ leadId, step, answer }` |
| POST | `/conversations/{id}/ai-reply` | `{ message }` → `{ message: Message }` |
| POST | `/conversations/{id}/handoff`, `/close` |

Message `sender`: `user` | `ai` | `agent`.

## Appointments & calendar

| Method | Path |
|--------|------|
| GET/POST | `/appointments` |
| GET/PATCH/DELETE | `/appointments/{id}` |
| GET | `/calendar/slots?date=&userId=` → `string[]` |

Status: `Confirmed`, `Cancelled`, `No Show`, …

## Tasks / notifications / users

- `/tasks`, `/tasks/{id}`, `/tasks/{id}/complete`
- `/notifications`, `/notifications/{id}/read`, `/notifications/read-all`
- `/users`, `/users/invite`, `/users/{id}`, `/users/{id}/stats`

Task status: `To Do`, `In Progress`, `Completed`.  
Notification category: `leads`, `meetings`, `tasks`, `automations`, `system`.  
User status: `active` / `inactive`.

## Dashboard & analytics

- `GET /dashboard/overview`
- `GET /dashboard/conversions` → trend points
- `GET /dashboard/pipeline`
- `GET /dashboard/sources`
- `GET /analytics`
- `GET /activities?leadId=`

## Automations / integrations / settings / audit / emails

- `/automations/workflows`, `/automations/executions`
- `/automations/workflows/{id}/toggle`, `/test`
- `/integrations`, `.../connect|disconnect|test|sync`
- `/settings` GET/PATCH
- `/audit-logs`
- `/emails`, `/emails/send`

## Errors

```json
{
  "message": "…",
  "detail": "…",
  "error": { "code": "NOT_FOUND", "details": {} }
}
```

## Health

- `GET /health`, `/health/live`, `/health/ready`
