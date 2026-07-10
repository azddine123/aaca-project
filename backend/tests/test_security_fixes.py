"""
Tests for the critical security fixes (CORRECTIONS.txt priority 1 & 3).

Covers:
- Path traversal on GET /uploads/{user_id}/{note_id}/{filename}
- JWT token revocation via token_version ("tv" claim)
- Refresh endpoint rejects tokens minted before a password change
- Upload magic-byte validation (declared MIME lying about the bytes)
"""
import io
from unittest.mock import AsyncMock, patch

from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image

from app.core.security import create_access_token, create_refresh_token
from app.main import app

_USER = "user-sec-001"


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (120, 60, 200)).save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# 1. Path traversal
# ---------------------------------------------------------------------------

class TestUploadPathTraversal:

    def test_traversal_filename_is_rejected(self):
        """A '..'-laden filename must not escape the user's upload dir."""
        token = create_access_token({"sub": _USER, "tv": 0})
        with patch("app.services.mongodb_service.mongodb_service.get_user",
                   new_callable=AsyncMock, return_value=None):
            client = TestClient(app, raise_server_exceptions=False)
            # %2E%2E%2F decodes to ../ — target backend/.env two levels up
            resp = client.get(
                f"/uploads/{_USER}/note/..%2F..%2F..%2F.env",
                headers={"Authorization": f"Bearer {token}"},
            )
        # Either the router rejects the encoded path (404) or our guard does (403)
        assert resp.status_code in (403, 404)
        assert "SECRET_KEY" not in resp.text

    def test_other_users_dir_is_forbidden(self):
        token = create_access_token({"sub": _USER, "tv": 0})
        with patch("app.services.mongodb_service.mongodb_service.get_user",
                   new_callable=AsyncMock, return_value=None):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(
                "/uploads/another-user/note/file.png",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# 2. Token revocation
# ---------------------------------------------------------------------------

class TestTokenRevocation:

    def test_stale_token_version_is_rejected(self):
        """A token issued at tv=0 is invalid once the user's token_version is 1."""
        token = create_access_token({"sub": _USER, "tv": 0})
        with patch("app.services.mongodb_service.mongodb_service.get_user",
                   new_callable=AsyncMock, return_value={"id": _USER, "token_version": 1}):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/user/progress", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED
        assert "revoked" in resp.json()["detail"].lower()

    def test_matching_token_version_is_accepted(self):
        """A token whose tv matches the user passes the revocation gate."""
        token = create_access_token({"sub": _USER, "tv": 2})
        user = {"id": _USER, "token_version": 2}
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value=user),
            patch("app.services.mongodb_service.mongodb_service.get_or_create_progress",
                  new_callable=AsyncMock, return_value={"subject_distribution": {}}),
            patch("app.services.mongodb_service.mongodb_service.get_user_quiz_results",
                  new_callable=AsyncMock, return_value=[]),
        ):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/user/progress", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# 3. Refresh rejects revoked tokens
# ---------------------------------------------------------------------------

class TestRefreshRevocation:

    def test_refresh_with_stale_version_rejected(self):
        refresh = create_refresh_token({"sub": _USER, "tv": 0})
        with patch("app.services.mongodb_service.mongodb_service.get_user",
                   new_callable=AsyncMock, return_value={"id": _USER, "token_version": 1}):
            with TestClient(app) as c:
                resp = c.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_with_current_version_succeeds(self):
        refresh = create_refresh_token({"sub": _USER, "tv": 3})
        with patch("app.services.mongodb_service.mongodb_service.get_user",
                   new_callable=AsyncMock, return_value={"id": _USER, "token_version": 3}):
            with TestClient(app) as c:
                resp = c.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert resp.status_code == status.HTTP_200_OK
        assert "access_token" in resp.json()


# ---------------------------------------------------------------------------
# 4. Upload magic-byte validation
# ---------------------------------------------------------------------------

class TestUploadMagicBytes:

    def _client(self):
        token = create_access_token({"sub": _USER, "tv": 0})
        c = TestClient(app, raise_server_exceptions=False)
        c.headers["Authorization"] = f"Bearer {token}"
        return c

    def test_fake_image_is_rejected(self):
        """Non-image bytes labeled image/png must be refused."""
        with patch("app.services.mongodb_service.mongodb_service.get_user",
                   new_callable=AsyncMock, return_value=None):
            c = self._client()
            resp = c.post(
                "/api/v1/process/ocr-only",
                files={"file": ("evil.png", b"#!/bin/sh\nrm -rf /", "image/png")},
            )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_real_png_passes_validation(self):
        """A genuine PNG passes the byte check (OCR itself is mocked)."""
        fake_ocr = AsyncMock(return_value={"text": "hi", "average_confidence": 0.9, "engine": "mock"})
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value=None),
            patch("app.services.image_processor.image_processor.preprocess",
                  new_callable=AsyncMock, return_value=(b"x", None)),
            patch("app.services.ocr_service.ocr_service.extract_text", fake_ocr),
            patch("app.services.mongodb_service.mongodb_service.upload_image",
                  new_callable=AsyncMock, return_value="img-url"),
        ):
            c = self._client()
            resp = c.post(
                "/api/v1/process/ocr-only",
                files={"file": ("real.png", _png_bytes(), "image/png")},
            )
        # Passes byte validation → not a 400 for invalid image
        assert resp.status_code != status.HTTP_400_BAD_REQUEST
