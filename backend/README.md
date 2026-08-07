# AI Sales Assistant — Backend

FastAPI API for the AI Sales Assistant frontend (`/api/v1`).

## Stack

- FastAPI + SQLAlchemy 2 (async) + PostgreSQL
- Redis (rate limit / lockout)
- Argon2 passwords + JWT access / hashed refresh tokens
- Alembic migrations, ARQ worker, optional n8n

## Quick start

```bash
cp .env.example .env
pip install -e ".[dev]"
# Postgres is exposed on host port 5433 (avoids clash with a local Postgres on 5432)
docker compose up -d postgres redis
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

Docker (full stack):

```bash
docker compose up --build
```

Set `SEED_ON_STARTUP=false` in production so the seed does not run automatically.

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| admin@aisales.demo | Demo123! | ADMIN |
| manager@aisales.demo | Demo123! | SALES_MANAGER |
| sales@aisales.demo | Demo123! | SALES_REPRESENTATIVE |

## Frontend connection

Keep mocks for demos without backend:

```env
VITE_USE_MOCKS=true
```

Live API:

```env
VITE_USE_MOCKS=false
VITE_API_URL=http://localhost:8000/api/v1
```

## Frontend contract

See [docs/frontend-api-contract.md](docs/frontend-api-contract.md).

Key points:

- Base URL: `http://localhost:8000/api/v1`
- Login returns `{ user, token, refreshToken, tokenType, expiresIn }` (camelCase)
- List endpoints return **arrays** (not paginated envelopes)
- Errors: `{ message, detail, error: { code, details } }`

## Mock / simulated integrations

| Integration | Default | Notes |
|-------------|---------|-------|
| OpenAI / LangGraph | `AI_MOCK_MODE=true` | Deterministic qualification agent |
| Email (SMTP) | `EMAIL_MOCK_MODE=true` | Logged in `email_logs` only |
| Google Calendar | `GOOGLE_CALENDAR_MOCK_MODE=true` | Local slots + events |
| n8n | `N8N_ENABLED=false` | HMAC client no-ops when disabled |

## Background jobs

Short work uses FastAPI `BackgroundTasks`. Longer jobs use **ARQ** (`app/workers/tasks.py`) with Redis.

## Tests

```bash
# Unit tests (scoring) always run
pytest app/tests/test_scoring.py -q

# Full suite (needs Docker Postgres on 5433)
docker compose up -d postgres redis
createdb -h localhost -p 5433 -U postgres ai_sales_test
set TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/ai_sales_test
pytest -q
ruff check app scripts
mypy app
bandit -r app -ll
```

## Useful make targets

- `make install` / `make run` / `make test` / `make migrate` / `make seed`
- `make docker-up` / `make docker-down`

## API docs

- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/health/ready
