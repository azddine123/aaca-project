"""AACA - AI Academic Cognitive Assistant Backend API.

Main FastAPI application entry point.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response, StreamingResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes import router, limiter
from app.core.config import settings
from app.core.security import get_current_user
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

        if await mongodb_service.ping():
            logger.info("✅ MongoDB connected")
            await mongodb_service._create_indexes()
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
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

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

@app.get("/images/{file_id}")
async def serve_gridfs_image(
    file_id: str,
    request: Request,
    current_user: str = Depends(get_current_user),
):
    """Serve an image stored in GridFS, enforcing ownership.

    GridFS files are immutable, so the file_id is a stable ETag; the body is
    streamed chunk by chunk instead of being loaded entirely in RAM.
    """
    from app.services.mongodb_service import mongodb_service as _db

    result = await _db.get_image_stream(file_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Image not found")
    stream, content_type, owner_id, length = result
    if not owner_id or owner_id != current_user:
        raise HTTPException(status_code=403, detail="Access denied")

    etag = f'"{file_id}"'
    cache_headers = {"ETag": etag, "Cache-Control": "private, max-age=86400, immutable"}

    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=cache_headers)

    async def _chunks():
        while True:
            chunk = await stream.readchunk()
            if not chunk:
                break
            yield chunk

    return StreamingResponse(
        _chunks(),
        media_type=content_type,
        headers={**cache_headers, "Content-Length": str(length)},
    )


@app.get("/uploads/{user_id}/{note_id}/{filename}")
async def serve_upload(
    user_id: str,
    note_id: str,
    filename: str,
    current_user: str = Depends(get_current_user),
):
    if current_user != user_id:
        raise HTTPException(403, "Access denied")
    # Resolve symlinks/".." — decoded path params (e.g. %2E%2E%2F) must not
    # escape the user's own upload directory
    user_dir = (UPLOAD_DIR / user_id).resolve()
    file_path = (UPLOAD_DIR / user_id / note_id / filename).resolve()
    if not file_path.is_relative_to(user_dir):
        raise HTTPException(403, "Access denied")
    if not file_path.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(file_path)

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

    db_status = "connected" if mongodb_service._connected else "disconnected"

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
