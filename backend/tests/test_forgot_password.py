"""
Tests for the forgot-password / OTP password-reset flow.

All MongoDB and email calls are mocked — no real DB or SMTP needed.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from fastapi import status

from app.api.routes import _hash_otp, _generate_otp, _verify_otp


# ---------------------------------------------------------------------------
# Helper: build a valid OTP record as mongodb_service would return it
# ---------------------------------------------------------------------------

def _make_otp_record(otp: str, *, used: bool = False, expired: bool = False, attempts: int = 0):
    salt, otp_hash = _hash_otp(otp)
    expires_at = (
        datetime.now(timezone.utc) - timedelta(minutes=1)   # already expired
        if expired
        else datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    return {
        "id": "otp-record-123",
        "email": "user@example.com",
        "otp_hash": otp_hash,
        "otp_salt": salt,
        "expires_at": expires_at,
        "attempts": attempts,
        "used": used,
        "created_at": datetime.now(timezone.utc),
    }


# ---------------------------------------------------------------------------
# Unit tests for OTP helpers (no HTTP)
# ---------------------------------------------------------------------------

class TestOtpHelpers:
    def test_generate_otp_is_6_digits(self):
        for _ in range(20):
            otp = _generate_otp()
            assert len(otp) == 6
            assert otp.isdigit()

    def test_hash_otp_does_not_store_plaintext(self):
        otp = "123456"
        salt, otp_hash = _hash_otp(otp)
        assert otp not in otp_hash
        assert otp not in salt

    def test_verify_otp_correct(self):
        otp = "654321"
        salt, otp_hash = _hash_otp(otp)
        assert _verify_otp(otp, salt, otp_hash) is True

    def test_verify_otp_wrong_code(self):
        salt, otp_hash = _hash_otp("111111")
        assert _verify_otp("999999", salt, otp_hash) is False

    def test_two_otps_produce_different_hashes(self):
        _, h1 = _hash_otp("123456")
        _, h2 = _hash_otp("123456")
        # different salts → different hashes
        assert h1 != h2


# ---------------------------------------------------------------------------
# Integration-style HTTP tests (mocked DB + email)
# ---------------------------------------------------------------------------

NEUTRAL_MSG = "Si un compte existe avec cet email, un code de vérification a été envoyé."
CODE_ERR = "Code invalide ou expiré."


class TestForgotPassword:
    """POST /auth/forgot-password"""

    def test_neutral_response_when_email_exists(self, client):
        fake_user = {"id": "u1", "email": "user@example.com", "password_hash": "hash"}
        with (
            patch("app.api.routes.mongodb_service.get_user_by_email", new=AsyncMock(return_value=fake_user)),
            patch("app.api.routes.mongodb_service.create_password_reset_otp", new=AsyncMock(return_value="otp-id")),
            patch("app.services.email_service.send_password_reset_otp", return_value=True),
        ):
            res = client.post("/api/v1/auth/forgot-password", json={"email": "user@example.com"})
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["message"] == NEUTRAL_MSG

    def test_neutral_response_when_email_does_not_exist(self, client):
        """Must not reveal whether the email is registered."""
        with patch("app.api.routes.mongodb_service.get_user_by_email", new=AsyncMock(return_value=None)):
            res = client.post("/api/v1/auth/forgot-password", json={"email": "ghost@example.com"})
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["message"] == NEUTRAL_MSG

    def test_invalid_email_rejected(self, client):
        res = client.post("/api/v1/auth/forgot-password", json={"email": "not-an-email"})
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_otp_is_stored_hashed_not_plaintext(self, client):
        """Verify create_password_reset_otp is called with a hash, never the raw OTP."""
        fake_user = {"id": "u1", "email": "user@example.com", "password_hash": "hash"}
        captured = {}

        async def fake_create(email, otp_hash, otp_salt, expires_at):
            captured["otp_hash"] = otp_hash
            captured["otp_salt"] = otp_salt
            return "otp-id"

        with (
            patch("app.api.routes.mongodb_service.get_user_by_email", new=AsyncMock(return_value=fake_user)),
            patch("app.api.routes.mongodb_service.create_password_reset_otp", new=fake_create),
            patch("app.services.email_service.send_password_reset_otp", return_value=True) as mock_send,
        ):
            res = client.post("/api/v1/auth/forgot-password", json={"email": "user@example.com"})

        assert res.status_code == status.HTTP_200_OK
        # The raw OTP passed to send_password_reset_otp must NOT appear in the stored hash
        sent_otp = mock_send.call_args[0][1]
        assert sent_otp not in captured["otp_hash"]
        assert len(captured["otp_salt"]) == 32  # 16 bytes → 32 hex chars


class TestVerifyResetCode:
    """POST /auth/verify-reset-code"""

    def test_correct_code_returns_verified_true(self, client):
        otp = "424242"
        record = _make_otp_record(otp)
        with (
            patch("app.api.routes.mongodb_service.get_valid_password_reset_otp", new=AsyncMock(return_value=record)),
            patch("app.api.routes.mongodb_service.increment_password_reset_attempts", new=AsyncMock(return_value=True)),
        ):
            res = client.post("/api/v1/auth/verify-reset-code", json={"email": "user@example.com", "code": otp})
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["verified"] is True

    def test_wrong_code_returns_400(self, client):
        record = _make_otp_record("111111")
        with (
            patch("app.api.routes.mongodb_service.get_valid_password_reset_otp", new=AsyncMock(return_value=record)),
            patch("app.api.routes.mongodb_service.increment_password_reset_attempts", new=AsyncMock(return_value=True)),
        ):
            res = client.post("/api/v1/auth/verify-reset-code", json={"email": "user@example.com", "code": "999999"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.json()["detail"] == CODE_ERR

    def test_no_valid_record_returns_400(self, client):
        with patch("app.api.routes.mongodb_service.get_valid_password_reset_otp", new=AsyncMock(return_value=None)):
            res = client.post("/api/v1/auth/verify-reset-code", json={"email": "user@example.com", "code": "000000"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_code_validation_rejects_non_digits(self, client):
        res = client.post("/api/v1/auth/verify-reset-code", json={"email": "user@example.com", "code": "abcdef"})
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_code_validation_rejects_wrong_length(self, client):
        res = client.post("/api/v1/auth/verify-reset-code", json={"email": "user@example.com", "code": "123"})
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestResetPassword:
    """POST /auth/reset-password"""

    def test_correct_flow_updates_password_hash(self, client):
        otp = "777777"
        record = _make_otp_record(otp)
        fake_user = {"id": "u1", "email": "user@example.com", "password_hash": "old_hash"}

        with (
            patch("app.api.routes.mongodb_service.get_valid_password_reset_otp", new=AsyncMock(return_value=record)),
            patch("app.api.routes.mongodb_service.get_user_by_email", new=AsyncMock(return_value=fake_user)),
            patch("app.api.routes.mongodb_service.update_user", new=AsyncMock(return_value=True)) as mock_update,
            patch("app.api.routes.mongodb_service.mark_password_reset_otp_used", new=AsyncMock(return_value=True)),
            patch("app.api.routes.get_password_hash", return_value="new_hashed_pw"),
        ):
            res = client.post("/api/v1/auth/reset-password", json={
                "email": "user@example.com",
                "code": otp,
                "new_password": "NewPassword123",
            })

        assert res.status_code == status.HTTP_200_OK
        # update_user must be called with the hashed password
        call_args = mock_update.call_args[0]
        assert call_args[1]["password_hash"] == "new_hashed_pw"

    def test_used_otp_cannot_be_reused(self, client):
        """get_valid_password_reset_otp returns None for used OTPs."""
        with patch("app.api.routes.mongodb_service.get_valid_password_reset_otp", new=AsyncMock(return_value=None)):
            res = client.post("/api/v1/auth/reset-password", json={
                "email": "user@example.com",
                "code": "123456",
                "new_password": "NewPassword123",
            })
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_short_password_rejected(self, client):
        res = client.post("/api/v1/auth/reset-password", json={
            "email": "user@example.com",
            "code": "123456",
            "new_password": "short",
        })
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_wrong_code_on_reset_increments_attempts(self, client):
        record = _make_otp_record("111111")
        fake_user = {"id": "u1", "email": "user@example.com", "password_hash": "old_hash"}

        with (
            patch("app.api.routes.mongodb_service.get_valid_password_reset_otp", new=AsyncMock(return_value=record)),
            patch("app.api.routes.mongodb_service.get_user_by_email", new=AsyncMock(return_value=fake_user)),
            patch("app.api.routes.mongodb_service.increment_password_reset_attempts", new=AsyncMock(return_value=True)) as mock_inc,
        ):
            res = client.post("/api/v1/auth/reset-password", json={
                "email": "user@example.com",
                "code": "999999",
                "new_password": "ValidPassword123",
            })

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        mock_inc.assert_awaited_once_with(record["id"])
