"""FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import close_db
from app.core.exceptions import AppError
from app.core.logging import get_logger, setup_logging
from app.core.middleware import RequestIdMiddleware, SecurityHeadersMiddleware
from app.core.redis import close_redis, get_redis

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    settings = get_settings()
    logger.info("app_starting", env=settings.app_env)
    try:
        client = await get_redis()
        await client.ping()
        logger.info("redis_connected")
    except Exception as exc:  # noqa: BLE001
        logger.warning("redis_unavailable", error=str(exc))
    yield
    await close_redis()
    await close_db()
    logger.info("app_stopped")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIdMiddleware)

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        body: dict[str, Any] = {
            "message": exc.message,
            "detail": exc.message,
            "error": {"code": exc.code, "details": exc.details},
        }
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "message": "Validation error",
                "detail": exc.errors(),
                "error": {"code": "VALIDATION_ERROR", "details": {"errors": exc.errors()}},
            },
        )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "alive"}

    @app.get("/health/ready")
    async def ready() -> dict[str, Any]:
        from sqlalchemy import text

        from app.core.database import engine

        redis_ok = False
        db_ok = False
        try:
            client = await get_redis()
            await client.ping()
            redis_ok = True
        except Exception:  # noqa: BLE001
            redis_ok = False
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_ok = True
        except Exception:  # noqa: BLE001
            db_ok = False
        status = "ready" if db_ok else "degraded"
        return {"status": status, "postgres": db_ok, "redis": redis_ok}

    return app


app = create_app()
