"""Application configuration via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "AI Sales Assistant API"
    app_env: Literal["development", "staging", "production", "test"] = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    docs_enabled: bool = True

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_sales"
    database_url_sync: str = "postgresql+psycopg://postgres:postgres@localhost:5432/ai_sales"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = Field(default="change-me-to-a-long-random-secret-key-at-least-32-chars")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    password_reset_expire_minutes: int = 30

    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    ai_enabled: bool = True
    ai_mock_mode: bool = True
    ai_temperature: float = 0.2
    ai_max_retries: int = 2
    ai_timeout_seconds: int = 30
    ai_max_history_messages: int = 20
    ai_summary_enabled: bool = True
    ai_context_max_chars: int = 4000

    n8n_base_url: str = "http://localhost:5678"
    n8n_api_key: str = ""
    n8n_webhook_secret: str = "dev-n8n-webhook-secret"
    n8n_enabled: bool = False
    n8n_public_url: str = ""
    n8n_dispatch_poll_seconds: int = 30
    backend_internal_url: str = "http://backend:8000"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/integrations/google/callback"
    google_scopes: str = (
        "https://www.googleapis.com/auth/calendar "
        "https://www.googleapis.com/auth/calendar.events"
    )

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@aisales.demo"
    smtp_from_name: str = "AI Sales Assistant"
    smtp_use_tls: bool = True

    email_mock_mode: bool = True
    google_calendar_mock_mode: bool = True

    webhook_signing_secret: str = "dev-webhook-signing-secret"
    encryption_key: str = "dev-encryption-key-32-bytes-long!!"
    internal_api_key: str = "dev-internal-api-key"

    rate_limit_enabled: bool = True
    rate_limit_default: str = "100/minute"

    log_level: str = "INFO"
    sentry_dsn: str = ""
    seed_on_startup: bool = False

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def google_scopes_list(self) -> list[str]:
        return [s.strip() for s in self.google_scopes.replace(",", " ").split() if s.strip()]

    def validate_for_env(self) -> None:
        """Validate required settings for the current environment."""
        if self.is_production:
            insecure_prefixes = ("change-me", "dev-", "test-secret", "default", "insecure")
            checks = {
                "JWT_SECRET_KEY": self.jwt_secret_key,
                "ENCRYPTION_KEY": self.encryption_key,
                "INTERNAL_API_KEY": self.internal_api_key,
                "N8N_WEBHOOK_SECRET": self.n8n_webhook_secret,
                "WEBHOOK_SIGNING_SECRET": self.webhook_signing_secret,
            }
            for name, value in checks.items():
                lower = value.lower()
                if any(lower.startswith(p) for p in insecure_prefixes):
                    raise RuntimeError(f"{name} must be set to a secure value in production")
            if len(self.n8n_webhook_secret) < 16:
                raise RuntimeError("N8N_WEBHOOK_SECRET must be at least 16 characters in production")
            if self.debug:
                raise RuntimeError("DEBUG must be false in production")
            if self.docs_enabled:
                raise RuntimeError("DOCS_ENABLED must be false in production")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.app_env != "test":
        settings.validate_for_env()
    return settings
