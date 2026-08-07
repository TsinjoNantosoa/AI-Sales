# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install .

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_HOME=/app
WORKDIR ${APP_HOME}
RUN useradd --create-home --uid 10001 appuser
COPY --from=builder /install /usr/local
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts
COPY app ./app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
