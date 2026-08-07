.PHONY: install run test lint migrate seed docker-up docker-down

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
