"""Application configuration using Pydantic Settings."""

from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent.parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        case_sensitive=True,
        extra="ignore",
    )

    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "AI Academic Cognitive Assistant"
    DEBUG: bool = False
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # LLM Providers
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4"
    GOOGLE_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None

    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "aaca_db"

    # File Upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "uploads"

    # Processing
    OCR_ENGINE: str = "paddleocr"
    OCR_CONFIDENCE_THRESHOLD: float = 0.8  # fallback to OpenAI Vision below this score
    LATEX_MODEL: str = "pix2tex"
    ENABLE_LLM_CACHE: bool = True
    LLM_CACHE_TTL: int = 3600  # 1 hour
    MAX_PROCESSING_TIME: int = 30  # seconds
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Embeddings & Vector Store
    EMBEDDING_MODEL: str = "text-embedding-3-small"  # OpenAI embedding model
    VECTOR_STORE_DIR: str = "vector_store"            # ChromaDB persistence directory

    # Email / SMTP (optional — if not set, OTP is only logged in dev mode)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "PicLearn"
    SMTP_USE_TLS: bool = True

    # Password reset OTP
    PASSWORD_RESET_OTP_EXPIRE_MINUTES: int = 10
    PASSWORD_RESET_OTP_MAX_ATTEMPTS: int = 5

    # Rate limiting storage. "memory://" is per-process only — with several
    # uvicorn workers or behind a load balancer, use Redis:
    # RATE_LIMIT_STORAGE_URI=redis://localhost:6379
    # (Behind a reverse proxy, also run uvicorn with --proxy-headers so the
    # limiter keys on the real client IP, not the proxy's.)
    RATE_LIMIT_STORAGE_URI: str = "memory://"

    # RGPD / Privacy
    DATA_RETENTION_DAYS: int = 365
    IMAGE_RETENTION_DAYS: int = 90
    PRIVACY_POLICY_VERSION: str = "2026-05-v1"

    # Payments (RevenueCat)
    REVENUECAT_WEBHOOK_SECRET: str | None = None
    FREE_NOTES_MONTHLY_QUOTA: int = 10

    # Safe default origins for local development only.
    # In production, set CORS_ORIGINS as a comma-separated list of allowed origins.
    _DEFAULT_DEV_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ]

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        """Accept boolean or any string value for DEBUG (e.g. 'release', 'false', '0')."""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("1", "true", "yes", "on")
        return bool(v)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32 or v == "your-secret-key-change-in-production":
            raise ValueError("SECRET_KEY must be at least 32 characters and not the default value")
        return v

    # Raw comma-separated value of the CORS_ORIGINS env var (parsed below)
    CORS_ORIGINS_STR: str = Field(default="", validation_alias="CORS_ORIGINS")

    @property
    def CORS_ORIGINS(self) -> list[str]:
        """Get CORS origins as a list.

        Parses the CORS_ORIGINS environment variable (comma-separated URLs).
        Falls back to localhost dev origins when the variable is absent.
        Never returns ["*"] to prevent inadvertent open CORS in production.
        """
        cors_value = self.CORS_ORIGINS_STR

        if not cors_value or cors_value.strip() == "":
            return self._DEFAULT_DEV_ORIGINS

        origins = [origin.strip() for origin in cors_value.split(",") if origin.strip()]
        if not origins:
            raise ValueError(
                "CORS_ORIGINS env var is set but contains no valid origins. "
                "Provide a comma-separated list, e.g. "
                "'https://app.example.com,https://admin.example.com'."
            )
        return origins

    @property
    def CORS_ORIGIN_REGEX(self) -> str | None:
        """Regex matching any localhost/private-LAN origin, on any port.

        Dev convenience only: lets a phone on the same Wi-Fi (Expo Go, web
        preview) reach the API without editing CORS_ORIGINS every time the
        machine's LAN IP changes. Only active when DEBUG is true — always
        None in production, where CORS_ORIGINS stays the sole allow-list.
        """
        if not self.DEBUG:
            return None
        return (
            r"^https?://(localhost|127\.0\.0\.1"
            r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            r"|192\.168\.\d{1,3}\.\d{1,3}"
            r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})"
            r"(:\d+)?$"
        )


# Global settings instance
settings = Settings()
