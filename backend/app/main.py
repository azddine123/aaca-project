"""AACA - AI Academic Cognitive Assistant Backend API.

Main FastAPI application entry point.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError
from app.core.logging import setup_logging

# Setup logging
logger = setup_logging()

# Ensure upload directory exists
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Handle application startup and shutdown events."""
    logger.info("🚀 Starting AI Academic Cognitive Assistant...")
    logger.info("✅ Mode: MongoDB + Local Storage")

    try:
        from app.services.mongodb_service import mongodb_service

        if mongodb_service.db is not None:
            logger.info("✅ MongoDB connected")
        else:
            logger.warning("⚠️ MongoDB not connected - Running in 'mock' mode")
            logger.info("   To start MongoDB: docker run -d -p 27017:27017 mongo:7.0")
    except Exception as e:
        logger.warning(f"⚠️ MongoDB check failed: {e}")

    logger.info(f"📁 Local storage: {UPLOAD_DIR}")

    yield

    logger.info("👋 Shutting down...")


# Create FastAPI application
app = FastAPI(
    title="AI Academic Cognitive Assistant API",
    description="Transform academic captures into intelligent learning resources",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

@app.exception_handler(ServiceUnavailableError)
async def service_unavailable_handler(request: Request, exc: ServiceUnavailableError) -> JSONResponse:
    """Return HTTP 503 when a required service is not available."""
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc), "service": exc.service},
    )


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include API routes
app.include_router(router, prefix=settings.API_V1_STR)


@app.get("/")
async def root() -> dict:
    """Root endpoint - API information."""
    return {
        "name": "AI Academic Cognitive Assistant",
        "version": "1.0.0",
        "status": "operational",
        "database": "MongoDB (or mock mode)",
        "storage": "Local",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    from app.services.mongodb_service import mongodb_service

    db_status = "connected" if mongodb_service.db is not None else "disconnected (mock mode)"

    return {
        "status": "healthy",
        "service": "aaca-api",
        "database": db_status,
        "storage": "local",
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
