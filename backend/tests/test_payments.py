"""Backend tests for the premium payment feature (RevenueCat)."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException

from app.core.security import create_access_token
from app.main import app

_TEST_USER_ID = "test-user-123"


def _asgi_client(headers: dict | None = None) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers=headers,
    )


def _auth_headers() -> dict:
    token = create_access_token({"sub": _TEST_USER_ID})
    return {"Authorization": f"Bearer {token}"}


class TestPaymentsConfig:
    def test_free_notes_quota_default(self):
        from app.core.config import settings

        assert settings.FREE_NOTES_MONTHLY_QUOTA == 10

    def test_revenuecat_webhook_secret_defaults_to_none(self):
        from app.core.config import settings

        assert hasattr(settings, "REVENUECAT_WEBHOOK_SECRET")


class TestGetMonthlyNoteCount:
    @pytest.mark.asyncio
    async def test_counts_notes_since_month_start(self):
        from app.services.mongodb_service import mongodb_service

        fake_collection = MagicMock()
        fake_collection.count_documents = AsyncMock(return_value=3)
        with patch.object(mongodb_service, "_get_collection", return_value=fake_collection):
            count = await mongodb_service.get_monthly_note_count("user-1")

        assert count == 3
        fake_collection.count_documents.assert_awaited_once()
        query = fake_collection.count_documents.call_args[0][0]
        assert query["user_id"] == "user-1"
        assert "created_at" in query
        assert "$gte" in query["created_at"]

    @pytest.mark.asyncio
    async def test_returns_zero_when_db_disconnected(self):
        from app.services.mongodb_service import mongodb_service

        with patch.object(mongodb_service, "_get_collection", return_value=None):
            count = await mongodb_service.get_monthly_note_count("user-1")

        assert count == 0


class TestHandleRevenueCatEvent:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("event_type", ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"])
    async def test_activates_premium(self, event_type):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": event_type, "app_user_id": "user-1"}}
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": "user-1"},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_user",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_awaited_once_with("user-1", {"is_premium": True})

    @pytest.mark.asyncio
    @pytest.mark.parametrize("event_type", ["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"])
    async def test_deactivates_premium(self, event_type):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": event_type, "app_user_id": "user-1"}}
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": "user-1"},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_user",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_awaited_once_with("user-1", {"is_premium": False})

    @pytest.mark.asyncio
    async def test_idempotent_replay(self):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": "RENEWAL", "app_user_id": "user-1"}}
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": "user-1"},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_user",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            await payments_service.handle_revenuecat_event(payload)
            await payments_service.handle_revenuecat_event(payload)

        assert mock_update.await_count == 2
        assert mock_update.await_args_list[0] == mock_update.await_args_list[1]

    @pytest.mark.asyncio
    async def test_unknown_user_does_not_raise(self):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": "RENEWAL", "app_user_id": "ghost-user"}}
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_user",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_missing_app_user_id_does_not_raise(self):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": "RENEWAL"}}
        with patch(
            "app.services.mongodb_service.mongodb_service.update_user",
            new_callable=AsyncMock,
        ) as mock_update:
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unhandled_event_type_ignored(self):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": "TRANSFER", "app_user_id": "user-1"}}
        with patch(
            "app.services.mongodb_service.mongodb_service.update_user",
            new_callable=AsyncMock,
        ) as mock_update:
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_not_awaited()


class TestRevenueCatWebhookEndpoint:
    @pytest.mark.asyncio
    async def test_invalid_secret_returns_401(self):
        with patch("app.core.config.settings.REVENUECAT_WEBHOOK_SECRET", "shh"):
            async with _asgi_client() as client:
                res = await client.post(
                    "/api/v1/payments/webhook/revenuecat",
                    json={"event": {"type": "RENEWAL", "app_user_id": "user-1"}},
                    headers={"Authorization": "wrong-secret"},
                )
        assert res.status_code == 401

    @pytest.mark.asyncio
    async def test_unconfigured_secret_rejects_everything(self):
        with patch("app.core.config.settings.REVENUECAT_WEBHOOK_SECRET", None):
            async with _asgi_client() as client:
                res = await client.post(
                    "/api/v1/payments/webhook/revenuecat",
                    json={"event": {"type": "RENEWAL", "app_user_id": "user-1"}},
                    headers={"Authorization": "anything"},
                )
        assert res.status_code == 401

    @pytest.mark.asyncio
    async def test_valid_secret_dispatches_event(self):
        with (
            patch("app.core.config.settings.REVENUECAT_WEBHOOK_SECRET", "shh"),
            patch(
                "app.services.payments_service.payments_service.handle_revenuecat_event",
                new_callable=AsyncMock,
            ) as mock_handle,
        ):
            async with _asgi_client() as client:
                res = await client.post(
                    "/api/v1/payments/webhook/revenuecat",
                    json={"event": {"type": "RENEWAL", "app_user_id": "user-1"}},
                    headers={"Authorization": "shh"},
                )
        assert res.status_code == 200
        mock_handle.assert_awaited_once()


class TestPaymentStatusEndpoint:
    @pytest.mark.asyncio
    async def test_status_reflects_free_user(self):
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": False},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=4,
            ),
        ):
            async with _asgi_client(_auth_headers()) as client:
                res = await client.get("/api/v1/payments/status")
        assert res.status_code == 200
        assert res.json() == {
            "is_premium": False,
            "notes_used_this_month": 4,
            "notes_quota": 10,
        }

    @pytest.mark.asyncio
    async def test_status_reflects_premium_user(self):
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": True},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=57,
            ),
        ):
            async with _asgi_client(_auth_headers()) as client:
                res = await client.get("/api/v1/payments/status")
        assert res.status_code == 200
        assert res.json()["is_premium"] is True

    @pytest.mark.asyncio
    async def test_status_requires_auth(self):
        async with _asgi_client() as client:
            res = await client.get("/api/v1/payments/status")
        assert res.status_code == 401


class TestCheckNoteQuota:
    @pytest.mark.asyncio
    async def test_raises_402_when_free_quota_reached(self):
        from app.api.routers.common import _check_note_quota

        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": False},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=10,
            ),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await _check_note_quota(_TEST_USER_ID)

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["code"] == "quota_exceeded"

    @pytest.mark.asyncio
    async def test_allows_free_user_under_quota(self):
        from app.api.routers.common import _check_note_quota

        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": False},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=9,
            ),
        ):
            await _check_note_quota(_TEST_USER_ID)

    @pytest.mark.asyncio
    async def test_never_blocks_premium_user(self):
        from app.api.routers.common import _check_note_quota

        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": True},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=999,
            ),
        ):
            await _check_note_quota(_TEST_USER_ID)


class TestQuotaEnforcementAtEndpoints:
    @pytest.mark.asyncio
    async def test_capture_endpoint_blocked(self):
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": False},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=10,
            ),
        ):
            async with _asgi_client(_auth_headers()) as client:
                res = await client.post(
                    "/api/v1/process/capture",
                    files={"file": ("note.png", b"not-a-real-image", "image/png")},
                )
        assert res.status_code == 402
        assert res.json()["detail"]["code"] == "quota_exceeded"

    @pytest.mark.asyncio
    async def test_from_text_endpoint_blocked(self):
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": False},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=10,
            ),
        ):
            async with _asgi_client(_auth_headers()) as client:
                res = await client.post(
                    "/api/v1/notes/from-text",
                    json={"raw_text": "some text"},
                )
        assert res.status_code == 402
        assert res.json()["detail"]["code"] == "quota_exceeded"

    @pytest.mark.asyncio
    async def test_finalize_session_endpoint_blocked(self):
        fake_session = {
            "id": "sess-1",
            "user_id": _TEST_USER_ID,
            "status": "draft",
            "title": "t",
        }
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_session",
                new_callable=AsyncMock,
                return_value=fake_session,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": False},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=10,
            ),
        ):
            async with _asgi_client(_auth_headers()) as client:
                res = await client.post("/api/v1/sessions/sess-1/finalize")
        assert res.status_code == 402
        assert res.json()["detail"]["code"] == "quota_exceeded"

    @pytest.mark.asyncio
    async def test_finalize_session_quota_checked_after_ownership(self):
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_session",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_user",
                new_callable=AsyncMock,
                return_value={"id": _TEST_USER_ID, "is_premium": False},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                new_callable=AsyncMock,
                return_value=10,
            ),
        ):
            async with _asgi_client(_auth_headers()) as client:
                res = await client.post("/api/v1/sessions/does-not-exist/finalize")
        assert res.status_code == 404
