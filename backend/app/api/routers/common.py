"""Shared helpers for the API routers (auth-agnostic, domain-agnostic)."""

import logging

from fastapi import HTTPException, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.services.llm_service import llm_service
from app.services.mongodb_service import mongodb_service

logger = logging.getLogger("aaca")

limiter = Limiter(key_func=get_remote_address, storage_uri=settings.RATE_LIMIT_STORAGE_URI)

_ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}


def _validate_image_upload(contents: bytes, content_type: str | None) -> None:
    """Reject uploads that are too large, mislabeled, or not real images.

    The declared Content-Type is client-controlled, so the actual bytes are
    verified with Pillow (magic bytes + structural integrity).
    """
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, f"File too large. Max: {settings.MAX_UPLOAD_SIZE} bytes")
    if content_type not in _ALLOWED_IMAGE_MIME:
        raise HTTPException(400, f"Unsupported file type: {content_type}")

    from io import BytesIO
    from PIL import Image

    try:
        with Image.open(BytesIO(contents)) as img:
            if img.format not in _ALLOWED_IMAGE_FORMATS:
                raise ValueError(f"format {img.format}")
            img.verify()
    except Exception:
        raise HTTPException(400, "Le fichier n'est pas une image valide.")


async def _get_owned_note(note_id: str, current_user: str) -> dict:
    note = await mongodb_service.get_note(note_id)
    if not note or note["user_id"] != current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
    return note


async def _get_owned_session(session_id: str, current_user: str) -> dict:
    session = await mongodb_service.get_session(session_id)
    if not session or session["user_id"] != current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


async def _get_user_content_language(current_user: str) -> str:
    """Return the user's preferred generation language, defaulting to French."""
    user = await mongodb_service.get_user(current_user)
    return llm_service.normalize_language((user or {}).get("preferred_language"))


async def _owned_image_url_or_none(url: str | None, current_user: str) -> str | None:
    """Accept only image URLs that belong to the current user.

    The capture flow sends image URLs returned by /process/ocr-only. This guard
    prevents a crafted request from attaching another user's GridFS image.
    """
    if not url:
        return None

    if url.startswith("/images/"):
        file_id = url.removeprefix("/images/")
        owner_id = await mongodb_service.get_gridfs_file_owner(file_id)
        return url if owner_id == current_user else None

    upload_prefix = f"/uploads/{current_user}/"
    if url.startswith(upload_prefix):
        return url

    public_upload_prefix = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/uploads/{current_user}/"
    if url.startswith(public_upload_prefix):
        return url

    return None
