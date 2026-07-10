"""
GDPR / RGPD backend tests.

Covers:
- Registration refused without privacy consent
- Registration accepted with privacy consent + consent stored in DB
- GDPR export does not contain password_hash
- Account deletion removes only the current user's data
- Privacy endpoints require a valid JWT
"""
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

_USER_ID = "gdpr-user-456"
_OTHER_USER_ID = "other-user-789"


@pytest.fixture()
def _auth_client():
    token = create_access_token({"sub": _USER_ID})
    with TestClient(app) as c:
        c.headers["Authorization"] = f"Bearer {token}"
        yield c


@pytest.fixture()
def _unauth_client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# 1. Registration: consent required
# ---------------------------------------------------------------------------

class TestRegistrationConsent:

    def test_register_without_consent_rejected(self):
        """POST /auth/register must return 422 when privacy_consent is False."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=None),
            patch("app.api.routers.auth.get_password_hash", return_value="hashed"),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/register", json={
                    "email": "nonconsent@example.com",
                    "password": "securepass123",
                    "full_name": "No Consent",
                    "privacy_consent": False,
                    "privacy_policy_version": "2026-05-v1",
                })
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_missing_consent_field_rejected(self):
        """POST /auth/register must return 422 when privacy_consent is absent."""
        with TestClient(app) as c:
            res = c.post("/api/v1/auth/register", json={
                "email": "nofield@example.com",
                "password": "securepass123",
                "full_name": "No Field",
            })
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_with_consent_accepted(self):
        """POST /auth/register succeeds when privacy_consent is True."""
        fake_user_id = "new-user-001"
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=None),
            patch("app.api.routers.auth.get_password_hash", return_value="hashed_pw"),
            patch("app.services.mongodb_service.mongodb_service.create_user",
                  new_callable=AsyncMock, return_value=fake_user_id),
            patch("app.api.routers.auth._issue_verification_otp", new_callable=AsyncMock),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/register", json={
                    "email": "consent@example.com",
                    "password": "securepass123",
                    "full_name": "Consent User",
                    "privacy_consent": True,
                    "privacy_policy_version": "2026-05-v1",
                })
        assert res.status_code == status.HTTP_201_CREATED
        body = res.json()
        # Email must be confirmed via OTP before tokens are issued
        assert body["verification_required"] is True
        assert "access_token" not in body

    def test_register_stores_consent_fields(self):
        """Registration must pass privacy_consent_at and privacy_policy_version to create_user."""
        fake_user_id = "new-user-002"
        captured: dict = {}

        async def fake_create_user(data: dict) -> str:
            captured.update(data)
            return fake_user_id

        with (
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=None),
            patch("app.api.routers.auth.get_password_hash", return_value="hashed_pw"),
            patch("app.services.mongodb_service.mongodb_service.create_user",
                  side_effect=fake_create_user),
            patch("app.api.routers.auth._issue_verification_otp", new_callable=AsyncMock),
        ):
            with TestClient(app) as c:
                c.post("/api/v1/auth/register", json={
                    "email": "stored@example.com",
                    "password": "securepass123",
                    "full_name": "Stored Consent",
                    "privacy_consent": True,
                    "privacy_policy_version": "2026-05-v1",
                })

        assert captured.get("privacy_consent") is True
        assert captured.get("privacy_policy_version") == "2026-05-v1"
        assert "privacy_consent_at" in captured
        assert "password_hash" in captured
        assert "password" not in captured


# ---------------------------------------------------------------------------
# 2. GDPR export
# ---------------------------------------------------------------------------

class TestGDPRExport:

    def test_export_requires_jwt(self, _unauth_client):
        """GET /privacy/export without token must return 401 or 403."""
        res = _unauth_client.get("/api/v1/privacy/export")
        assert res.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_export_does_not_contain_password_hash(self, _auth_client):
        """Export response must never expose password_hash."""
        fake_data = {
            "user": {
                "id": _USER_ID,
                "email": "gdpr@example.com",
                "full_name": "GDPR User",
            },
            "notes": [],
            "quizzes": [],
            "quiz_results": [],
            "flashcards": [],
            "flashcard_reviews": [],
            "sessions": [],
            "captures": [],
            "user_progress": None,
        }

        with patch("app.services.mongodb_service.mongodb_service.get_user_all_data",
                   new_callable=AsyncMock, return_value=fake_data):
            res = _auth_client.get("/api/v1/privacy/export")

        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "data" in body
        assert "password_hash" not in str(body)

    def test_export_structure_has_expected_keys(self, _auth_client):
        """Export response data must include all expected collection keys."""
        fake_data = {
            "user": {"id": _USER_ID, "email": "gdpr@example.com"},
            "notes": [{"id": "n1", "title": "Note 1"}],
            "quizzes": [],
            "quiz_results": [],
            "flashcards": [],
            "flashcard_reviews": [],
            "sessions": [],
            "captures": [],
            "user_progress": {"total_notes": 1},
        }

        with patch("app.services.mongodb_service.mongodb_service.get_user_all_data",
                   new_callable=AsyncMock, return_value=fake_data):
            res = _auth_client.get("/api/v1/privacy/export")

        assert res.status_code == status.HTTP_200_OK
        data = res.json()["data"]
        for key in ("user", "notes", "quizzes", "flashcards", "sessions"):
            assert key in data, f"Missing key in export: {key}"


# ---------------------------------------------------------------------------
# 3. Account deletion
# ---------------------------------------------------------------------------

class TestAccountDeletion:

    def test_delete_account_requires_jwt(self, _unauth_client):
        """DELETE /privacy/account without token must return 401 or 403."""
        res = _unauth_client.delete("/api/v1/privacy/account")
        assert res.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_delete_account_calls_delete_with_current_user_only(self, _auth_client):
        """DELETE /privacy/account must pass the authenticated user ID to delete_user_all_data."""
        deletion_summary = {
            "user": 1,
            "notes": 5,
            "quizzes": 3,
            "flashcards": 12,
            "quiz_results": 4,
            "flashcard_reviews": 8,
            "sessions": 2,
            "captures": 6,
            "user_progress": 1,
            "gridfs_images": 3,
            "local_uploads_dir": 1,
            "rag_index": 1,
        }
        called_with: list = []

        async def fake_delete(user_id: str) -> dict:
            called_with.append(user_id)
            return deletion_summary

        with patch("app.services.mongodb_service.mongodb_service.delete_user_all_data",
                   side_effect=fake_delete):
            res = _auth_client.delete("/api/v1/privacy/account")

        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert body["deleted"] is True
        assert body["user_id"] == _USER_ID
        assert "summary" in body
        assert called_with == [_USER_ID], "Must only delete the authenticated user's data"

    def test_delete_account_does_not_touch_other_user(self):
        """Two different tokens must call delete with their respective IDs — never the other's."""
        calls: list = []

        async def fake_delete(user_id: str) -> dict:
            calls.append(user_id)
            return {"user": 1}

        with patch("app.services.mongodb_service.mongodb_service.delete_user_all_data",
                   side_effect=fake_delete):
            token_a = create_access_token({"sub": _USER_ID})
            token_b = create_access_token({"sub": _OTHER_USER_ID})

            with TestClient(app) as c:
                c.headers["Authorization"] = f"Bearer {token_a}"
                c.delete("/api/v1/privacy/account")

            with TestClient(app) as c:
                c.headers["Authorization"] = f"Bearer {token_b}"
                c.delete("/api/v1/privacy/account")

        assert _USER_ID in calls
        assert _OTHER_USER_ID in calls
        assert calls[0] != calls[1], "Each user must delete their own data only"
