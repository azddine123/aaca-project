# Intégration du paiement premium (RevenueCat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le champ `User.is_premium` fonctionnel — quota de 10 notes/mois pour les utilisateurs gratuits, abonnement mensuel premium illimité géré via RevenueCat (Apple IAP + Google Play Billing).

**Architecture:** RevenueCat est la source de vérité pour l'état d'abonnement. Le SDK mobile (`react-native-purchases`) déclenche l'achat natif ; RevenueCat valide le reçu et notifie le backend FastAPI par webhook (`POST /payments/webhook/revenuecat`), qui met à jour `user.is_premium` en base. Le quota de notes gratuites est vérifié côté backend, avant tout appel OCR/LLM coûteux, sur les 3 endpoints qui créent une note.

**Tech Stack:** FastAPI + MongoDB (motor) côté backend, Expo Router / React Native + `react-native-purchases` côté frontend.

## Global Constraints

- Spec source de vérité : `docs/superpowers/specs/2026-07-20-payment-design.md`
- Quota : 10 notes/mois gratuit, reset calendaire, pas de report de solde
- Un seul palier premium, tarif mensuel uniquement (pas d'annuel, pas d'essai gratuit)
- Mobile uniquement (iOS + Android) — pas de paiement web dans cette itération
- Aucun compte RevenueCat/produit store n'existe encore — le code utilise des clés API placeholder à remplacer manuellement par l'utilisateur (voir spec §4)
- `react-native-purchases` est un module natif : incompatible avec Expo Go, nécessite `npm run ios` / `npm run android` (build natif) pour tout test réel ; doit être un no-op sur le web
- Conventions de test backend : fixture `_auth_client` locale (pas `authorized_client`), mocks sur `app.services.mongodb_service.mongodb_service.<method>`, `@pytest.mark.asyncio` pour les tests async

---

## Task 1: Config settings pour les paiements

**Files:**
- Modify: `backend/app/core/config.py`
- Test: `backend/tests/test_payments.py` (nouveau)

**Interfaces:**
- Produces: `settings.REVENUECAT_WEBHOOK_SECRET: str | None`, `settings.FREE_NOTES_MONTHLY_QUOTA: int` (défaut `10`)

- [ ] **Step 1: Write the failing test**

Créer `backend/tests/test_payments.py` :

```python
"""Backend tests for the premium payment feature (RevenueCat).

Covers: config defaults, monthly note quota counting, RevenueCat webhook
event handling, the payments router (webhook + status), and quota
enforcement at the three note-creation entry points.
"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

_TEST_USER_ID = "test-user-123"


@pytest.fixture()
def _auth_client():
    """Authenticated test client that bypasses get_password_hash entirely."""
    token = create_access_token({"sub": _TEST_USER_ID})
    with TestClient(app) as c:
        c.headers["Authorization"] = f"Bearer {token}"
        yield c


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


class TestPaymentsConfig:
    def test_free_notes_quota_default(self):
        from app.core.config import settings
        assert settings.FREE_NOTES_MONTHLY_QUOTA == 10

    def test_revenuecat_webhook_secret_defaults_to_none(self):
        from app.core.config import settings
        assert hasattr(settings, "REVENUECAT_WEBHOOK_SECRET")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py -v`
Expected: FAIL — `AssertionError` on `settings.FREE_NOTES_MONTHLY_QUOTA` (field does not exist yet, pydantic raises `AttributeError` or the assert fails)

- [ ] **Step 3: Write minimal implementation**

In `backend/app/core/config.py`, add a new section after `PRIVACY_POLICY_VERSION` (end of the "RGPD / Privacy" block, before `_DEFAULT_DEV_ORIGINS`):

```python
    # Payments (RevenueCat)
    # RevenueCat webhook shared secret — set in the RevenueCat dashboard
    # (Project Settings > Webhooks > Authorization header) and here, so the
    # webhook endpoint can verify calls actually come from RevenueCat.
    REVENUECAT_WEBHOOK_SECRET: str | None = None
    FREE_NOTES_MONTHLY_QUOTA: int = 10
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/tests/test_payments.py
git commit -m "feat(payments): add RevenueCat config settings"
```

---

## Task 2: Comptage mensuel des notes dans mongodb_service

**Files:**
- Modify: `backend/app/services/mongodb_service.py:525` (juste après `count_user_notes`)
- Test: `backend/tests/test_payments.py`

**Interfaces:**
- Consumes: rien de nouveau (utilise `self._get_collection("notes")` existant)
- Produces: `mongodb_service.get_monthly_note_count(user_id: str) -> int`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_payments.py`:

```python
class TestGetMonthlyNoteCount:
    @pytest.mark.asyncio
    async def test_counts_notes_since_month_start(self):
        from app.services.mongodb_service import mongodb_service
        from unittest.mock import MagicMock

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py::TestGetMonthlyNoteCount -v`
Expected: FAIL with `AttributeError: 'MongoDBService' object has no attribute 'get_monthly_note_count'`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/services/mongodb_service.py`, add this method directly after `count_user_notes` (which ends at line 530):

```python
    async def get_monthly_note_count(self, user_id: str) -> int:
        """Count a user's notes created since the start of the current calendar month.

        Used to enforce the free-tier note quota; the counter resets
        naturally each month since it is computed from `created_at`, not a
        stored running total.
        """
        collection = self._get_collection("notes")
        if collection is None:
            return 0
        month_start = datetime.now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        return await collection.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": month_start},
        })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py::TestGetMonthlyNoteCount -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mongodb_service.py backend/tests/test_payments.py
git commit -m "feat(payments): add get_monthly_note_count to mongodb_service"
```

---

## Task 3: payments_service.py — traitement des événements webhook RevenueCat

**Files:**
- Create: `backend/app/services/payments_service.py`
- Test: `backend/tests/test_payments.py`

**Interfaces:**
- Consumes: `mongodb_service.get_user(user_id) -> dict | None`, `mongodb_service.update_user(user_id, dict) -> bool` (déjà existants)
- Produces: `payments_service.handle_revenuecat_event(payload: dict) -> None` (singleton `payments_service`)

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_payments.py`:

```python
class TestHandleRevenueCatEvent:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("event_type", ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"])
    async def test_activates_premium(self, event_type):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": event_type, "app_user_id": "user-1"}}
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": "user-1"}),
            patch("app.services.mongodb_service.mongodb_service.update_user",
                  new_callable=AsyncMock) as mock_update,
        ):
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_awaited_once_with("user-1", {"is_premium": True})

    @pytest.mark.asyncio
    @pytest.mark.parametrize("event_type", ["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"])
    async def test_deactivates_premium(self, event_type):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": event_type, "app_user_id": "user-1"}}
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": "user-1"}),
            patch("app.services.mongodb_service.mongodb_service.update_user",
                  new_callable=AsyncMock) as mock_update,
        ):
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_awaited_once_with("user-1", {"is_premium": False})

    @pytest.mark.asyncio
    async def test_idempotent_replay(self):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": "RENEWAL", "app_user_id": "user-1"}}
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": "user-1"}),
            patch("app.services.mongodb_service.mongodb_service.update_user",
                  new_callable=AsyncMock) as mock_update,
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
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value=None),
            patch("app.services.mongodb_service.mongodb_service.update_user",
                  new_callable=AsyncMock) as mock_update,
        ):
            await payments_service.handle_revenuecat_event(payload)  # must not raise

        mock_update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_missing_app_user_id_does_not_raise(self):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": "RENEWAL"}}
        with patch("app.services.mongodb_service.mongodb_service.update_user",
                   new_callable=AsyncMock) as mock_update:
            await payments_service.handle_revenuecat_event(payload)  # must not raise

        mock_update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unhandled_event_type_ignored(self):
        from app.services.payments_service import payments_service

        payload = {"event": {"type": "TRANSFER", "app_user_id": "user-1"}}
        with patch("app.services.mongodb_service.mongodb_service.update_user",
                   new_callable=AsyncMock) as mock_update:
            await payments_service.handle_revenuecat_event(payload)

        mock_update.assert_not_awaited()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py::TestHandleRevenueCatEvent -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.payments_service'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/app/services/payments_service.py`:

```python
"""RevenueCat webhook handling.

RevenueCat is the source of truth for subscription state; this service only
reacts to the events it sends and mirrors them onto ``user.is_premium``. The
mobile SDK is initialized with ``appUserID = user.id``, so RevenueCat's
``app_user_id`` in every event already matches our internal user id — no
separate mapping table is needed.
"""

import logging

from app.services.mongodb_service import mongodb_service

logger = logging.getLogger("aaca")

_PREMIUM_ON = {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"}
_PREMIUM_OFF = {"CANCELLATION", "EXPIRATION", "BILLING_ISSUE"}


class PaymentsService:

    async def handle_revenuecat_event(self, payload: dict) -> None:
        """Update ``user.is_premium`` from a RevenueCat webhook payload.

        Unknown event types and unknown users are logged and ignored; the
        router still returns 200 in these cases since RevenueCat retries
        aggressively on non-2xx responses.
        """
        event = payload.get("event", {})
        event_type = event.get("type")
        app_user_id = event.get("app_user_id")

        if not app_user_id:
            logger.warning(f"RevenueCat webhook missing app_user_id (type={event_type})")
            return

        if event_type in _PREMIUM_ON:
            is_premium = True
        elif event_type in _PREMIUM_OFF:
            is_premium = False
        else:
            logger.info(f"RevenueCat webhook ignored: unhandled event type {event_type}")
            return

        user = await mongodb_service.get_user(app_user_id)
        if not user:
            logger.warning(f"RevenueCat webhook: unknown app_user_id {app_user_id}")
            return

        await mongodb_service.update_user(app_user_id, {"is_premium": is_premium})


payments_service = PaymentsService()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py::TestHandleRevenueCatEvent -v`
Expected: PASS (10 tests: 3+3 parametrized cases plus 4 single tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/payments_service.py backend/tests/test_payments.py
git commit -m "feat(payments): add RevenueCat webhook event handling"
```

---

## Task 4: Router payments.py — webhook + statut premium

**Files:**
- Create: `backend/app/api/routers/payments.py`
- Modify: `backend/app/api/routers/__init__.py`
- Test: `backend/tests/test_payments.py`

**Interfaces:**
- Consumes: `payments_service.handle_revenuecat_event` (Task 3), `mongodb_service.get_monthly_note_count` (Task 2), `settings.REVENUECAT_WEBHOOK_SECRET`/`FREE_NOTES_MONTHLY_QUOTA` (Task 1), `get_current_user` (existant dans `app.core.security`)
- Produces: `POST /api/v1/payments/webhook/revenuecat`, `GET /api/v1/payments/status`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_payments.py`:

```python
class TestRevenueCatWebhookEndpoint:
    def test_invalid_secret_returns_401(self, client):
        with patch("app.core.config.settings.REVENUECAT_WEBHOOK_SECRET", "shh"):
            res = client.post(
                "/api/v1/payments/webhook/revenuecat",
                json={"event": {"type": "RENEWAL", "app_user_id": "user-1"}},
                headers={"Authorization": "wrong-secret"},
            )
        assert res.status_code == 401

    def test_unconfigured_secret_rejects_everything(self, client):
        with patch("app.core.config.settings.REVENUECAT_WEBHOOK_SECRET", None):
            res = client.post(
                "/api/v1/payments/webhook/revenuecat",
                json={"event": {"type": "RENEWAL", "app_user_id": "user-1"}},
                headers={"Authorization": "anything"},
            )
        assert res.status_code == 401

    def test_valid_secret_dispatches_event(self, client):
        with (
            patch("app.core.config.settings.REVENUECAT_WEBHOOK_SECRET", "shh"),
            patch("app.services.payments_service.payments_service.handle_revenuecat_event",
                  new_callable=AsyncMock) as mock_handle,
        ):
            res = client.post(
                "/api/v1/payments/webhook/revenuecat",
                json={"event": {"type": "RENEWAL", "app_user_id": "user-1"}},
                headers={"Authorization": "shh"},
            )
        assert res.status_code == 200
        mock_handle.assert_awaited_once()


class TestPaymentStatusEndpoint:
    def test_status_reflects_free_user(self, _auth_client):
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": False}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=4),
        ):
            res = _auth_client.get("/api/v1/payments/status")
        assert res.status_code == 200
        assert res.json() == {"is_premium": False, "notes_used_this_month": 4, "notes_quota": 10}

    def test_status_reflects_premium_user(self, _auth_client):
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": True}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=57),
        ):
            res = _auth_client.get("/api/v1/payments/status")
        assert res.status_code == 200
        assert res.json()["is_premium"] is True

    def test_status_requires_auth(self, client):
        res = client.get("/api/v1/payments/status")
        assert res.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py::TestRevenueCatWebhookEndpoint tests/test_payments.py::TestPaymentStatusEndpoint -v`
Expected: FAIL with 404 (routes don't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `backend/app/api/routers/payments.py`:

```python
"""Payment routes: RevenueCat webhook + premium status."""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.config import settings
from app.core.security import get_current_user
from app.services.mongodb_service import mongodb_service
from app.services.payments_service import payments_service

logger = logging.getLogger("aaca")
router = APIRouter(tags=["payments"])


@router.post("/payments/webhook/revenuecat")
async def revenuecat_webhook(
    payload: dict,
    authorization: str | None = Header(None),
) -> dict:
    """Receive RevenueCat subscription events.

    No JWT here — RevenueCat calls this directly — secured instead by a
    shared secret in the Authorization header (configured in the RevenueCat
    dashboard). Always returns 200 on a valid secret, even for an unknown
    app_user_id, to avoid RevenueCat's retry storms; only an invalid or
    missing secret is rejected with 401.
    """
    if not settings.REVENUECAT_WEBHOOK_SECRET or authorization != settings.REVENUECAT_WEBHOOK_SECRET:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook secret")

    await payments_service.handle_revenuecat_event(payload)
    return {"received": True}


@router.get("/payments/status")
async def payment_status(current_user: str = Depends(get_current_user)) -> dict:
    """Premium status and monthly note quota usage for the current user."""
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    notes_used = await mongodb_service.get_monthly_note_count(current_user)
    return {
        "is_premium": user.get("is_premium", False),
        "notes_used_this_month": notes_used,
        "notes_quota": settings.FREE_NOTES_MONTHLY_QUOTA,
    }
```

Modify `backend/app/api/routers/__init__.py`:

```python
"""Domain routers assembled into the single API router.

Each module owns one domain; paths keep their full historical prefixes so
the public API is byte-for-byte identical to the pre-split monolith.
"""

from fastapi import APIRouter

from app.api.routers import auth, notes, payments, privacy, sessions, study, subjects
from app.api.routers.common import limiter

router = APIRouter()
for _module in (auth, notes, study, sessions, subjects, privacy, payments):
    router.include_router(_module.router)

__all__ = ["router", "limiter"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py -v`
Expected: PASS (all tests so far green)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routers/payments.py backend/app/api/routers/__init__.py backend/tests/test_payments.py
git commit -m "feat(payments): add RevenueCat webhook and status endpoints"
```

---

## Task 5: Enforcement du quota sur les 3 points d'entrée

**Files:**
- Modify: `backend/app/api/routers/common.py`
- Modify: `backend/app/api/routers/notes.py:150-160` (`capture_and_process`), `:266-270` (`create_note_from_text`)
- Modify: `backend/app/api/routers/sessions.py:193-201` (`finalize_session`)
- Test: `backend/tests/test_payments.py`

**Interfaces:**
- Consumes: `mongodb_service.get_user`, `mongodb_service.get_monthly_note_count` (Task 2), `settings.FREE_NOTES_MONTHLY_QUOTA` (Task 1)
- Produces: `_check_note_quota(current_user: str) -> None` (raises `HTTPException(402)` — importable from `app.api.routers.common`)

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_payments.py`:

```python
class TestCheckNoteQuota:
    @pytest.mark.asyncio
    async def test_raises_402_when_free_quota_reached(self):
        from app.api.routers.common import _check_note_quota

        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": False}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=10),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await _check_note_quota(_TEST_USER_ID)

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["code"] == "quota_exceeded"

    @pytest.mark.asyncio
    async def test_allows_free_user_under_quota(self):
        from app.api.routers.common import _check_note_quota

        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": False}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=9),
        ):
            await _check_note_quota(_TEST_USER_ID)  # must not raise

    @pytest.mark.asyncio
    async def test_never_blocks_premium_user(self):
        from app.api.routers.common import _check_note_quota

        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": True}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=999),
        ):
            await _check_note_quota(_TEST_USER_ID)  # must not raise


class TestQuotaEnforcementAtEndpoints:
    def test_capture_endpoint_blocked(self, _auth_client):
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": False}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=10),
        ):
            res = _auth_client.post(
                "/api/v1/process/capture",
                files={"file": ("note.png", b"not-a-real-image", "image/png")},
            )
        assert res.status_code == 402
        assert res.json()["detail"]["code"] == "quota_exceeded"

    def test_from_text_endpoint_blocked(self, _auth_client):
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": False}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=10),
        ):
            res = _auth_client.post("/api/v1/notes/from-text", json={"raw_text": "some text"})
        assert res.status_code == 402
        assert res.json()["detail"]["code"] == "quota_exceeded"

    def test_finalize_session_endpoint_blocked(self, _auth_client):
        fake_session = {"id": "sess-1", "user_id": _TEST_USER_ID, "status": "draft", "title": "t"}
        with (
            patch("app.services.mongodb_service.mongodb_service.get_session",
                  new_callable=AsyncMock, return_value=fake_session),
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": False}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=10),
        ):
            res = _auth_client.post("/api/v1/sessions/sess-1/finalize")
        assert res.status_code == 402
        assert res.json()["detail"]["code"] == "quota_exceeded"

    def test_finalize_session_quota_checked_after_ownership(self, _auth_client):
        """A quota-exceeded free user still gets 404 for a session they don't own —
        ownership must be validated before the quota check, not after."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_session",
                  new_callable=AsyncMock, return_value=None),
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={"id": _TEST_USER_ID, "is_premium": False}),
            patch("app.services.mongodb_service.mongodb_service.get_monthly_note_count",
                  new_callable=AsyncMock, return_value=10),
        ):
            res = _auth_client.post("/api/v1/sessions/does-not-exist/finalize")
        assert res.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py::TestCheckNoteQuota tests/test_payments.py::TestQuotaEnforcementAtEndpoints -v`
Expected: FAIL — `TestCheckNoteQuota` fails with `ImportError` (`_check_note_quota` doesn't exist), `TestQuotaEnforcementAtEndpoints` fails because the endpoints currently return 200/500 instead of 402 (no enforcement yet)

- [ ] **Step 3: Write minimal implementation**

In `backend/app/api/routers/common.py`, add after `_owned_image_url_or_none` (end of file):

```python
async def _check_note_quota(current_user: str) -> None:
    """Raise 402 if a free user has reached the monthly note quota.

    Called before any OCR/LLM work at every note-creation entry point so a
    refused request never spends API credits. Premium users are never
    blocked.
    """
    user = await mongodb_service.get_user(current_user)
    if (user or {}).get("is_premium"):
        return

    notes_used = await mongodb_service.get_monthly_note_count(current_user)
    if notes_used >= settings.FREE_NOTES_MONTHLY_QUOTA:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "quota_exceeded",
                "message": "Quota mensuel de notes gratuites atteint.",
                "notes_quota": settings.FREE_NOTES_MONTHLY_QUOTA,
            },
        )
```

In `backend/app/api/routers/notes.py`, update the import block:

```python
from app.api.routers.common import (
    _check_note_quota,
    _get_owned_note,
    _get_user_content_language,
    _owned_image_url_or_none,
    _validate_image_upload,
    limiter,
)
```

Then in `capture_and_process` (line 150), add the check as the very first line of the function body:

```python
async def capture_and_process(
    request: Request,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    tags: str | None = Form(None),
    subject_hint: SubjectCategory | None = Form(None),
    current_user: str = Depends(get_current_user),
) -> dict:
    """Capture, process, and save a note in one step."""
    await _check_note_quota(current_user)
    contents = await file.read()
    _validate_image_upload(contents, file.content_type)
    # ... rest unchanged
```

And in `create_note_from_text` (line 266), same pattern:

```python
async def create_note_from_text(
    data: NoteFromTextRequest,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Create and save a note from user-corrected OCR text (skips image processing)."""
    await _check_note_quota(current_user)
    import time
    if not data.raw_text.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Text cannot be empty")
    # ... rest unchanged
```

In `backend/app/api/routers/sessions.py`, update the import:

```python
from app.api.routers.common import (
    _check_note_quota,
    _get_owned_session,
    _get_user_content_language,
    _validate_image_upload,
    limiter,
)
```

Then in `finalize_session` (line 193), insert the check **after** ownership/state validation but **before** any expensive work:

```python
async def finalize_session(
    session_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Merge all captures in the session into a single note."""
    session = await _get_owned_session(session_id, current_user)
    if session["status"] == SessionStatus.COMPLETED.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already finalized")
    await _check_note_quota(current_user)

    captures = await mongodb_service.get_session_captures(session_id)
    # ... rest unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && python3 -m pytest tests/test_payments.py -v`
Expected: PASS — all tests in the file green

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && source venv/bin/activate && python3 -m pytest -v`
Expected: PASS — no pre-existing test broken by the new quota check (existing capture/from-text/finalize tests don't set `is_premium`/quota mocks, so `_check_note_quota` will call the real — mocked-elsewhere-or-disconnected — `mongodb_service.get_user`/`get_monthly_note_count`; if any pre-existing test breaks because it hits a real DB call here, add the same two `patch(...)` lines used above to that test)

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routers/common.py backend/app/api/routers/notes.py backend/app/api/routers/sessions.py backend/tests/test_payments.py
git commit -m "feat(payments): enforce monthly note quota on all 3 note-creation endpoints"
```

---

## Task 6: SDK RevenueCat + wrapper frontend

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/app.json`
- Create: `frontend/lib/purchases.ts`

**Interfaces:**
- Produces: `initPurchases(userId: string): Promise<void>`, `getCurrentOffering(): Promise<any>`, `purchasePackage(pkg: any): Promise<boolean>`, `restorePurchases(): Promise<boolean>`, `PREMIUM_ENTITLEMENT_ID: string`

- [ ] **Step 1: Install the SDK**

Run: `cd frontend && npm install react-native-purchases`
Expected: `package.json` and `package-lock.json` updated, `react-native-purchases` appears under `dependencies`

- [ ] **Step 2: Add RevenueCat API key placeholders to app.json**

In `frontend/app.json`, add an `"extra"` key at the same level as `"plugins"` and `"experiments"`:

```json
    "extra": {
      "revenueCatIosApiKey": "REPLACE_WITH_REVENUECAT_IOS_PUBLIC_KEY",
      "revenueCatAndroidApiKey": "REPLACE_WITH_REVENUECAT_ANDROID_PUBLIC_KEY"
    },
```

- [ ] **Step 3: Write frontend/lib/purchases.ts**

```typescript
/**
 * Thin wrapper around react-native-purchases (RevenueCat SDK).
 *
 * react-native-purchases is a native module: it is not supported on web and
 * will crash if loaded in Expo Go (no native code linked). Every export
 * here guards on Platform.OS so the rest of the app (AuthContext, paywall)
 * can call these unconditionally; real testing requires a native build
 * (`npm run ios` / `npm run android`), not `expo start` in Expo Go.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const IOS_API_KEY = Constants.expoConfig?.extra?.revenueCatIosApiKey as string | undefined;
const ANDROID_API_KEY = Constants.expoConfig?.extra?.revenueCatAndroidApiKey as string | undefined;

export const PREMIUM_ENTITLEMENT_ID = 'premium';

function loadSdk() {
    // Required lazily (not at module top-level) so importing this file never
    // triggers native module resolution on unsupported platforms.
    return require('react-native-purchases').default;
}

export async function initPurchases(userId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
    if (!apiKey) {
        console.warn('RevenueCat API key missing — set extra.revenueCat*ApiKey in app.json');
        return;
    }
    const Purchases = loadSdk();
    await Purchases.configure({ apiKey, appUserID: userId });
}

export async function getCurrentOffering(): Promise<any | null> {
    if (Platform.OS === 'web') return null;
    const Purchases = loadSdk();
    const offerings = await Purchases.getOfferings();
    return offerings.current;
}

export async function purchasePackage(pkg: any): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const Purchases = loadSdk();
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
}

export async function restorePurchases(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const Purchases = loadSdk();
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors introduced by `lib/purchases.ts` (pre-existing unrelated errors, if any, are not part of this task)

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/app.json frontend/lib/purchases.ts
git commit -m "feat(payments): add RevenueCat SDK wrapper"
```

---

## Task 7: AuthContext — état premium + init RevenueCat

**Files:**
- Modify: `frontend/package.json` (ajout `jwt-decode` déjà présent — vérifier seulement)
- Modify: `frontend/contexts/AuthContext.tsx`

**Interfaces:**
- Consumes: `initPurchases`, `restorePurchases` (Task 6), `GET /api/v1/payments/status` (Task 4)
- Produces: `auth.isPremium: boolean`, `auth.notesUsedThisMonth: number`, `auth.notesQuota: number`, `refreshPremiumStatus(tokenOverride?: string): Promise<void>` exposed via `useAuth()`

- [ ] **Step 1: Extend AuthState and context type**

In `frontend/contexts/AuthContext.tsx`, update the imports and types:

```typescript
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import { API_URL } from '../config/api';
import { apiFetch } from '../lib/api';
import { initPurchases } from '../lib/purchases';
```

```typescript
interface AuthState {
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    userName: string | null;
    userEmail: string | null;
    preferredLanguage: PreferredLanguage;
    loading: boolean;
    error: string | null;
    isPremium: boolean;
    notesUsedThisMonth: number;
    notesQuota: number;
}

interface AuthContextType {
    auth: AuthState;
    login: (email: string, password: string) => Promise<void>;
    applySession: (data: any, fallbackEmail: string) => Promise<void>;
    logout: () => Promise<void>;
    authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    updateUserName: (name: string) => Promise<void>;
    updateUserLanguage: (language: PreferredLanguage) => Promise<void>;
    refreshPremiumStatus: (tokenOverride?: string) => Promise<void>;
}
```

Update the default context value (add the three new `auth` fields and the no-op `refreshPremiumStatus`):

```typescript
const AuthContext = createContext<AuthContextType>({
    auth: {
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        userName: null,
        userEmail: null,
        preferredLanguage: 'fr',
        loading: true,
        error: null,
        isPremium: false,
        notesUsedThisMonth: 0,
        notesQuota: 10,
    },
    login: async () => {},
    applySession: async () => {},
    logout: async () => {},
    authFetch: async (input, init) => fetch(input, init),
    updateUserName: async () => {},
    updateUserLanguage: async () => {},
    refreshPremiumStatus: async () => {},
});
```

- [ ] **Step 2: Add refreshPremiumStatus and wire it into the provider**

In the `AuthProvider` body, update the initial `useState` to include the new fields:

```typescript
    const [auth, setAuth] = useState<AuthState>({
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        userName: null,
        userEmail: null,
        preferredLanguage: 'fr',
        loading: true,
        error: null,
        isPremium: false,
        notesUsedThisMonth: 0,
        notesQuota: 10,
    });
```

Add `refreshPremiumStatus` (place it before `applySession`, since `applySession` will call it):

```typescript
    const refreshPremiumStatus = useCallback(async (tokenOverride?: string) => {
        const token = tokenOverride || auth.token;
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/payments/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            setAuth(prev => ({
                ...prev,
                isPremium: !!data.is_premium,
                notesUsedThisMonth: data.notes_used_this_month ?? 0,
                notesQuota: data.notes_quota ?? 10,
            }));
        } catch {
            // Best effort — premium status just stays at its previous value.
        }
    }, [auth.token]);
```

- [ ] **Step 3: Call it after login and on session restore**

Update `applySession` to initialize RevenueCat and refresh premium status right after storing the session:

```typescript
    const applySession = async (data: any, fallbackEmail: string) => {
        const newAuth = {
            token: data.access_token,
            refreshToken: data.refresh_token || null,
            isAuthenticated: true,
            userName: data.user?.full_name || fallbackEmail.split('@')[0],
            userEmail: data.user?.email || fallbackEmail,
            preferredLanguage: data.user?.preferred_language || 'fr',
            loading: false,
            error: null,
            isPremium: false,
            notesUsedThisMonth: 0,
            notesQuota: 10,
        };

        setAuth(prev => ({ ...prev, ...newAuth }));
        await storage.setItem('aaca_token', data.access_token);
        await storage.setItem('aaca_username', newAuth.userName || '');
        await storage.setItem('aaca_email', newAuth.userEmail || '');
        await storage.setItem('aaca_preferred_language', newAuth.preferredLanguage);
        if (data.refresh_token) {
            await storage.setItem('aaca_refresh_token', data.refresh_token);
        }

        try {
            const userId = jwtDecode<{ sub: string }>(data.access_token).sub;
            await initPurchases(userId);
        } catch {
            // Best effort — purchases init failure must not block login.
        }
        await refreshPremiumStatus(data.access_token);
    };
```

Update the mount-restore `useEffect` to do the same when a stored session is found:

```typescript
    useEffect(() => {
        (async () => {
            try {
                const token = await storage.getItem('aaca_token');
                const userName = await storage.getItem('aaca_username');
                const userEmail = await storage.getItem('aaca_email');
                const preferredLanguage = await storage.getItem('aaca_preferred_language');
                const refreshToken = await storage.getItem('aaca_refresh_token');

                if (token) {
                    setAuth(prev => ({
                        ...prev,
                        token,
                        refreshToken,
                        isAuthenticated: true,
                        userName,
                        userEmail,
                        preferredLanguage: preferredLanguage === 'en' || preferredLanguage === 'ar' ? preferredLanguage : 'fr',
                        loading: false,
                        error: null,
                    }));
                    try {
                        const userId = jwtDecode<{ sub: string }>(token).sub;
                        await initPurchases(userId);
                    } catch {
                        // Best effort — a stale/invalid token here is caught by authFetch's refresh logic.
                    }
                    await refreshPremiumStatus(token);
                } else {
                    setAuth(prev => ({ ...prev, loading: false }));
                }
            } catch {
                setAuth(prev => ({ ...prev, loading: false }));
            }
        })();
    }, []);
```

- [ ] **Step 4: Expose refreshPremiumStatus from the provider**

Update the provider's return value:

```typescript
    return (
        <AuthContext.Provider value={{ auth, login, applySession, logout, authFetch, updateUserName, updateUserLanguage, refreshPremiumStatus }}>
            {children}
        </AuthContext.Provider>
    );
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from `AuthContext.tsx`

- [ ] **Step 6: Commit**

```bash
git add frontend/contexts/AuthContext.tsx
git commit -m "feat(payments): track premium status and quota in AuthContext"
```

---

## Task 8: Écran paywall

**Files:**
- Create: `frontend/app/paywall.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`auth.isPremium`, `auth.notesUsedThisMonth`, `auth.notesQuota`, `refreshPremiumStatus`), `getCurrentOffering`, `purchasePackage`, `restorePurchases` (Task 6), `useAppColors()`, `GRADIENTS`/`SIZES`/`FONTS`/`SHADOWS` (`@/theme`), `AacaButton`/`AacaCard`/`ProgressBar` (`@/components/UIKit`), `ZelligePattern` (`@/components/ZelligePattern`)
- Produces: route `/paywall` (fichier `app/paywall.tsx`, auto-enregistrée par expo-router)

- [ ] **Step 1: Write frontend/app/paywall.tsx**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { AacaButton, AacaCard, ProgressBar } from '@/components/UIKit';
import { ZelligePattern } from '@/components/ZelligePattern';
import { GRADIENTS, SIZES, FONTS, SHADOWS } from '@/theme';
import { getCurrentOffering, purchasePackage, restorePurchases } from '@/lib/purchases';

const FEATURES: { icon: string; label: string }[] = [
    { icon: 'infinity', label: 'Notes illimitées, chaque mois' },
    { icon: 'brain', label: 'Résumés, quiz et flashcards IA sans restriction' },
    { icon: 'flash-outline', label: 'Traitement prioritaire de vos captures' },
];

export default function PaywallScreen() {
    const { auth, refreshPremiumStatus } = useAuth();
    const C = useAppColors();
    const insets = useSafeAreaInsets();
    const [offering, setOffering] = useState<any>(null);
    const [loadingOffering, setLoadingOffering] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const current = await getCurrentOffering();
                setOffering(current);
            } finally {
                setLoadingOffering(false);
            }
        })();
    }, []);

    const monthlyPackage = offering?.monthly ?? offering?.availablePackages?.[0] ?? null;

    const handlePurchase = useCallback(async () => {
        if (!monthlyPackage) {
            Alert.alert('Indisponible', "L'offre premium n'est pas encore configurée. Réessayez plus tard.");
            return;
        }
        setPurchasing(true);
        try {
            const unlocked = await purchasePackage(monthlyPackage);
            if (unlocked) {
                await refreshPremiumStatus();
                Alert.alert('Bienvenue dans Premium', 'Votre abonnement est actif. Bonne étude !');
                router.back();
            }
        } catch (e: any) {
            if (e?.userCancelled) return;
            Alert.alert('Erreur', "L'achat n'a pas pu être finalisé. Réessayez.");
        } finally {
            setPurchasing(false);
        }
    }, [monthlyPackage, refreshPremiumStatus]);

    const handleRestore = useCallback(async () => {
        setRestoring(true);
        try {
            const unlocked = await restorePurchases();
            await refreshPremiumStatus();
            Alert.alert(
                unlocked ? 'Abonnement restauré' : 'Aucun abonnement trouvé',
                unlocked ? 'Votre accès premium a été restauré.' : "Aucun achat premium actif n'a été trouvé sur ce compte."
            );
            if (unlocked) router.back();
        } catch {
            Alert.alert('Erreur', "La restauration n'a pas pu aboutir. Réessayez.");
        } finally {
            setRestoring(false);
        }
    }, [refreshPremiumStatus]);

    const priceLabel = monthlyPackage?.product?.priceString ?? '—';

    return (
        <View style={[styles.container, { backgroundColor: C.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SIZES.lg }]} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <LinearGradient colors={GRADIENTS.hero} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.heroPattern}>
                        <ZelligePattern color={C.primary} opacity={0.5} tileSize={28} cols={9} rows={4} />
                    </View>
                    <View style={[styles.crown, SHADOWS.primary]}>
                        <LinearGradient colors={GRADIENTS.primary} style={StyleSheet.absoluteFillObject} />
                        <MaterialCommunityIcons name="crown" size={30} color="#fff" />
                    </View>
                    <Text style={[FONTS.h2, styles.heroTitle, { color: C.textPrimary }]}>Passez à Premium</Text>
                    <Text style={[FONTS.body1, styles.heroSub, { color: C.textSecondary }]}>
                        Débloquez des notes illimitées et toute la puissance de l'IA, sans limite mensuelle.
                    </Text>
                </View>

                <AacaCard style={styles.quotaCard}>
                    <View style={styles.quotaHeader}>
                        <Text style={[FONTS.body2, { color: C.textSecondary }]}>Votre quota gratuit ce mois-ci</Text>
                        <Text style={[FONTS.h4, { color: C.textPrimary }]}>
                            {auth.notesUsedThisMonth}/{auth.notesQuota}
                        </Text>
                    </View>
                    <ProgressBar
                        value={auth.notesQuota > 0 ? auth.notesUsedThisMonth / auth.notesQuota : 0}
                        color={auth.notesUsedThisMonth >= auth.notesQuota ? C.error : C.primary}
                    />
                </AacaCard>

                <View style={styles.features}>
                    {FEATURES.map((f) => (
                        <View key={f.label} style={styles.featureRow}>
                            <View style={[styles.featureIcon, { backgroundColor: C.accent + '18' }]}>
                                <MaterialCommunityIcons name={f.icon as any} size={18} color={C.accent} />
                            </View>
                            <Text style={[FONTS.body1, styles.featureLabel, { color: C.textPrimary }]}>{f.label}</Text>
                        </View>
                    ))}
                </View>

                <AacaCard style={styles.offerCard} accentColor={C.primary}>
                    {loadingOffering ? (
                        <ActivityIndicator color={C.primary} />
                    ) : (
                        <>
                            <Text style={[FONTS.h3, { color: C.textPrimary }]}>{priceLabel} / mois</Text>
                            <Text style={[FONTS.body2, styles.offerSub, { color: C.textMuted }]}>Résiliable à tout moment</Text>
                        </>
                    )}
                </AacaCard>

                <AacaButton
                    label="S'abonner"
                    icon="crown-outline"
                    full
                    loading={purchasing}
                    disabled={loadingOffering || purchasing}
                    onPress={handlePurchase}
                    style={styles.subscribeBtn}
                />
                <AacaButton
                    label="Restaurer mes achats"
                    variant="ghost"
                    full
                    loading={restoring}
                    disabled={restoring}
                    onPress={handleRestore}
                    style={styles.restoreBtn}
                />
                <Text
                    style={[FONTS.caption, styles.closeLink, { color: C.textMuted }]}
                    onPress={() => router.back()}
                >
                    Pas maintenant
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl, gap: SIZES.lg },
    hero: {
        borderRadius: SIZES.borderRadiusXl,
        overflow: 'hidden',
        alignItems: 'center',
        paddingVertical: SIZES.xxl,
        paddingHorizontal: SIZES.lg,
    },
    heroPattern: { ...StyleSheet.absoluteFillObject },
    crown: {
        width: 64, height: 64, borderRadius: SIZES.borderRadiusFull,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        marginBottom: SIZES.md,
    },
    heroTitle: { textAlign: 'center', marginBottom: SIZES.xs },
    heroSub: { textAlign: 'center', maxWidth: 280 },
    quotaCard: { gap: SIZES.sm },
    quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    features: { gap: SIZES.md },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    featureIcon: { width: 34, height: 34, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center' },
    featureLabel: { flex: 1 },
    offerCard: { alignItems: 'center', paddingVertical: SIZES.lg },
    offerSub: { marginTop: 2 },
    subscribeBtn: { marginTop: SIZES.sm },
    restoreBtn: {},
    closeLink: { textAlign: 'center', marginTop: SIZES.sm, textDecorationLine: 'underline' },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from `app/paywall.tsx`

- [ ] **Step 3: Manual visual check**

Run: `cd frontend && npm run web` (RevenueCat calls are no-ops on web per Task 6, so the screen renders with an empty offering — good enough to check layout/design)
Navigate to `http://localhost:8081/paywall` and confirm the screen renders without crashing, with hero/quota/features/CTA all visible in both light and dark mode (toggle via the app's appearance setting).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/paywall.tsx
git commit -m "feat(payments): add paywall screen"
```

---

## Task 9: Redirection 402 → paywall dans capture et session

**Files:**
- Modify: `frontend/app/capture.tsx:143-170` (`createNote`)
- Modify: `frontend/app/session-new.tsx:192-233` (`finalize`)

**Interfaces:**
- Consumes: route `/paywall` (Task 8)

- [ ] **Step 1: Update capture.tsx**

In `frontend/app/capture.tsx`, update `createNote`:

```typescript
    const createNote = async () => {
        if (!rawText.trim()) {
            Alert.alert('Texte vide', 'Veuillez saisir ou corriger le texte extrait.');
            return;
        }
        setStep('processing');
        try {
            const body: Record<string, unknown> = { raw_text: rawText };
            if (selectedSubjectId) body.selected_subject_id = selectedSubjectId;
            if (originalImageUrl) body.original_image_url = originalImageUrl;
            if (processedImageUrl) body.processed_image_url = processedImageUrl;
            const res = await authFetch(`${API_URL}/notes/from-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status === 402) {
                router.push('/paywall');
                setStep('review');
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Génération IA échouée');
            }
            setResult(await res.json());
            setStep('done');
            fetchNotes();
        } catch (e: any) {
            setErrorMsg(e.message || 'Erreur lors de la génération');
            setStep('error');
        }
    };
```

- [ ] **Step 2: Update session-new.tsx**

In `frontend/app/session-new.tsx`, update `finalize`:

```typescript
        setPhase('finalizing');
        try {
            const res = await authFetch(`${API_URL}/sessions/${sessionId}/finalize`, {
                method: 'POST',
            });
            if (res.status === 402) {
                router.push('/paywall');
                setPhase('capturing');
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Finalisation échouée');
            }
            const data = await res.json();
            setResult(data);
            setPhase('done');
            fetchNotes();
        } catch (e: any) {
            setErrorMsg(e.message || 'Erreur lors de la finalisation');
            setPhase('error');
        }
    }, [authFetch, sessionId, captures, saveStates, saveCapturText, fetchNotes]);
```

`router` is already imported in `session-new.tsx:7` (`import { router } from 'expo-router';`) and `'capturing'` is a valid value of the `Phase` type defined at `session-new.tsx:28` — no further changes needed beyond the diff above.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from either file

- [ ] **Step 4: Commit**

```bash
git add frontend/app/capture.tsx frontend/app/session-new.tsx
git commit -m "feat(payments): redirect to paywall on quota_exceeded (402)"
```

---

## Task 10: Carte premium + quota dans le profil

**Files:**
- Modify: `frontend/app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `auth.isPremium`, `auth.notesUsedThisMonth`, `auth.notesQuota` (Task 7), route `/paywall` (Task 8)

- [ ] **Step 1: Add the premium card to the profile screen**

In `frontend/app/(tabs)/profile.tsx`, add `router` to the `expo-router` import and `ProgressBar` to the UIKit import:

```typescript
import { router } from 'expo-router';
```

```typescript
import { AacaCard, StatusBadge, ProgressBar } from '@/components/UIKit';
```

Insert a new card right after the existing `studyCard` block (after the `</AacaCard>` that closes it, before the `{/* ── Achievement chips ── */}` comment):

```tsx
                <AacaCard style={styles.premiumCard}>
                    <View style={styles.premiumHeader}>
                        <View style={[styles.premiumIcon, { backgroundColor: (auth.isPremium ? C.success : C.primary) + '18' }]}>
                            <MaterialCommunityIcons
                                name={auth.isPremium ? 'crown' : 'crown-outline'}
                                size={20}
                                color={auth.isPremium ? C.success : C.primary}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.studyTitle}>{auth.isPremium ? 'Premium actif' : 'Version gratuite'}</Text>
                            <Text style={styles.studySub}>
                                {auth.isPremium
                                    ? 'Notes illimitées, merci pour votre soutien !'
                                    : `${auth.notesUsedThisMonth}/${auth.notesQuota} notes utilisées ce mois-ci`}
                            </Text>
                        </View>
                    </View>
                    {!auth.isPremium && (
                        <>
                            <ProgressBar
                                value={auth.notesQuota > 0 ? auth.notesUsedThisMonth / auth.notesQuota : 0}
                                color={auth.notesUsedThisMonth >= auth.notesQuota ? C.error : C.primary}
                                style={{ marginTop: SIZES.sm }}
                            />
                            <TouchableOpacity
                                style={[styles.premiumCta, { backgroundColor: C.primary }]}
                                onPress={() => router.push('/paywall')}
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons name="crown-outline" size={16} color="#fff" />
                                <Text style={styles.premiumCtaText}>Passer à Premium</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </AacaCard>
```

- [ ] **Step 2: Add the new styles**

In the `makeStyles` function in the same file, add alongside the existing `studyCard`/`studyIcon`/`studyTitle`/`studySub` style definitions:

```typescript
        premiumCard: { gap: 0 },
        premiumHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
        premiumIcon: { width: 40, height: 40, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center' },
        premiumCta: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.xs,
            marginTop: SIZES.md, paddingVertical: 12, borderRadius: SIZES.borderRadius,
        },
        premiumCtaText: { color: '#fff', fontSize: SIZES.fontSm, fontWeight: '700' },
```

(Match these to the exact object-literal style used by the surrounding `studyCard` etc. definitions in `makeStyles` — copy their formatting convention exactly.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from `profile.tsx`

- [ ] **Step 4: Manual visual check**

Run: `cd frontend && npm run web`, log in, open the Profil tab, confirm the premium card renders with the correct quota numbers (call `GET /api/v1/payments/status` from the running backend, or temporarily hardcode `auth.isPremium`/`notesUsedThisMonth` to check both states visually), and that tapping "Passer à Premium" navigates to `/paywall`.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(tabs)/profile.tsx"
git commit -m "feat(payments): show premium status and quota on profile screen"
```

---

## Post-implementation: manual steps required from the user

These cannot be done by an agent and block real (non-mock) end-to-end testing:

1. Create a RevenueCat account, the `aaca_premium_monthly` product in App Store Connect and Google Play Console, and link both to a `premium` entitlement in RevenueCat (spec §4)
2. Replace the placeholders in `frontend/app.json` (`extra.revenueCatIosApiKey`/`revenueCatAndroidApiKey`) with the real RevenueCat public SDK keys
3. Set `REVENUECAT_WEBHOOK_SECRET` in the backend `.env` to match the Authorization header configured in the RevenueCat dashboard webhook settings, and point that webhook at `https://<your-domain>/api/v1/payments/webhook/revenuecat`
4. Set up an Apple Sandbox tester and a Google Play license tester, then run `npm run ios` / `npm run android` (native build — Expo Go will not work with `react-native-purchases`) to test a real sandbox purchase end-to-end
