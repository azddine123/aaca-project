"""Application configuration using Pydantic Settings."""

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "AI Academic Cognitive Assistant"

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
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
    OCR_ENGINE: str = "easyocr"
    LATEX_MODEL: str = "pix2tex"
    ENABLE_LLM_CACHE: bool = True
    LLM_CACHE_TTL: int = 3600  # 1 hour
    MAX_PROCESSING_TIME: int = 30  # seconds

    @property
    def CORS_ORIGINS(self) -> list[str]:
        """Get CORS origins as a list."""
        cors_value = os.getenv("CORS_ORIGINS", "")
        
        if not cors_value or cors_value.strip() == "":
            return ["*"]
        
        origins = [origin.strip() for origin in cors_value.split(",") if origin.strip()]
        return origins if origins else ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Global settings instance
settings = Settings()
