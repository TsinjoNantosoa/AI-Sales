.PHONY: install run test lint migrate seed docker-up docker-down n8n-up n8n-down n8n-import n8n-validate n8n-health n8n-test

install:
	pip install -e ".[dev]"

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest -q

lint:
	ruff check app scripts
	ruff format --check app scripts

migrate:
	alembic upgrade head

seed:
	python scripts/seed.py

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down -v

n8n-up:
	docker compose up -d n8n-postgres n8n

n8n-down:
	docker compose stop n8n n8n-postgres

n8n-import:
	python ../n8n/scripts/generate_workflows.py
	bash ../n8n/scripts/import_workflows.sh

n8n-validate:
	python ../n8n/scripts/validate_workflows.py

n8n-health:
	curl -fsS http://localhost:5678/healthz && echo " n8n OK"

n8n-test:
	pytest app/tests/test_automation_n8n.py -q
