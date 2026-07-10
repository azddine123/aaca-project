"""
Email verification (signup OTP) tests.

Covers:
- verify-email with a valid code returns tokens and marks the user verified
- verify-email with a wrong code returns 400 and increments attempts
- login is blocked (403) while the email is not verified
- login still works for legacy accounts without the email_verified flag
- resend-verification only sends for unverified accounts
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from fastapi import status
from fastapi.testclient import TestClient

from app.api.routes import _hash_otp
from app.main import app

_CODE = "123456"
_EMAIL = "otp-user@example.com"
_USER = {
    "id": "otp-user-001",
    "email": _EMAIL,
    "full_name": "OTP User",
    "password_hash": "hashed_pw",
    "email_verified": False,
}


def _otp_record() -> dict:
    salt, otp_hash = _hash_otp(_CODE)
    return {
        "id": "otp-rec-001",
        "email": _EMAIL,
        "otp_salt": salt,
        "otp_hash": otp_hash,
        "purpose": "email_verification",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0,
        "used": False,
    }


class TestVerifyEmail:

    def test_valid_code_returns_tokens_and_marks_verified(self):
        update_user = AsyncMock(return_value=True)
        with (
            patch("app.services.mongodb_service.mongodb_service.get_valid_password_reset_otp",
                  new_callable=AsyncMock, return_value=_otp_record()),
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=dict(_USER)),
            patch("app.services.mongodb_service.mongodb_service.update_user", update_user),
            patch("app.services.mongodb_service.mongodb_service.mark_password_reset_otp_used",
                  new_callable=AsyncMock, return_value=True),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/verify-email",
                             json={"email": _EMAIL, "code": _CODE})

        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "access_token" in body
        assert "refresh_token" in body
        update_user.assert_awaited_once_with(_USER["id"], {"email_verified": True})

    def test_wrong_code_returns_400_and_increments_attempts(self):
        increment = AsyncMock(return_value=True)
        with (
            patch("app.services.mongodb_service.mongodb_service.get_valid_password_reset_otp",
                  new_callable=AsyncMock, return_value=_otp_record()),
            patch("app.services.mongodb_service.mongodb_service.increment_password_reset_attempts",
                  increment),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/verify-email",
                             json={"email": _EMAIL, "code": "999999"})

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        increment.assert_awaited_once()


class TestLoginVerificationGate:

    def test_login_blocked_when_email_not_verified(self):
        issue_otp = AsyncMock()
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=dict(_USER)),
            patch("app.api.routers.auth.verify_password", return_value=True),
            patch("app.api.routers.auth._issue_verification_otp", issue_otp),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/login",
                             data={"email": _EMAIL, "password": "whatever123"})

        assert res.status_code == status.HTTP_403_FORBIDDEN
        issue_otp.assert_awaited_once()

    def test_login_allowed_for_legacy_account_without_flag(self):
        legacy_user = {k: v for k, v in _USER.items() if k != "email_verified"}
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=legacy_user),
            patch("app.api.routers.auth.verify_password", return_value=True),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/login",
                             data={"email": _EMAIL, "password": "whatever123"})

        assert res.status_code == status.HTTP_200_OK
        assert "access_token" in res.json()


class TestResendVerification:

    def test_resend_sends_for_unverified_user(self):
        issue_otp = AsyncMock()
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=dict(_USER)),
            patch("app.api.routers.auth._issue_verification_otp", issue_otp),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/resend-verification", json={"email": _EMAIL})

        assert res.status_code == status.HTTP_200_OK
        issue_otp.assert_awaited_once()

    def test_resend_skips_verified_user(self):
        verified_user = dict(_USER, email_verified=True)
        issue_otp = AsyncMock()
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user_by_email",
                  new_callable=AsyncMock, return_value=verified_user),
            patch("app.api.routers.auth._issue_verification_otp", issue_otp),
        ):
            with TestClient(app) as c:
                res = c.post("/api/v1/auth/resend-verification", json={"email": _EMAIL})

        assert res.status_code == status.HTTP_200_OK
        issue_otp.assert_not_awaited()
