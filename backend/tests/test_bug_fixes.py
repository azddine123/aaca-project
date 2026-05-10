"""
Targeted regression tests for bug fixes.

Covers:
  1. DEBUG=release (or any non-bool string) does not crash config
  2. /health returns 'disconnected' when MongoDB is unavailable, without hanging
  3. GET /images/{file_id} enforces ownership (403) and returns 404 when absent
  4. VectorStoreService.query returns [] immediately when collection is empty
"""
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# 1. Config: DEBUG accepts non-boolean strings
# ---------------------------------------------------------------------------

def test_config_debug_release_string():
    """DEBUG='release' must be parsed as False without raising."""
    from app.core.config import Settings
    s = Settings(DEBUG="release", SECRET_KEY="a" * 32)
    assert s.DEBUG is False


def test_config_debug_false_string():
    """DEBUG='false' must be parsed as False."""
    from app.core.config import Settings
    s = Settings(DEBUG="false", SECRET_KEY="a" * 32)
    assert s.DEBUG is False


def test_config_debug_true_string():
    """DEBUG='true' must be parsed as True."""
    from app.core.config import Settings
    s = Settings(DEBUG="true", SECRET_KEY="a" * 32)
    assert s.DEBUG is True


# ---------------------------------------------------------------------------
# 2. Health endpoint: MongoDB unavailable → responds immediately
# ---------------------------------------------------------------------------

def _make_mock_db(connected: bool):
    mock = MagicMock()
    mock._connected = connected
    mock.ping = AsyncMock(return_value=connected)
    mock._create_indexes = AsyncMock()
    return mock


def test_health_when_mongodb_disconnected():
    """/health returns 200 with database='disconnected' when MongoDB is down."""
    from fastapi.testclient import TestClient
    from app.main import app

    mock_db = _make_mock_db(connected=False)
    with patch("app.services.mongodb_service.mongodb_service", mock_db):
        with TestClient(app) as c:
            response = c.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["database"] == "disconnected"


def test_health_when_mongodb_connected():
    """/health returns 200 with database='connected' when MongoDB is up."""
    from fastapi.testclient import TestClient
    from app.main import app

    mock_db = _make_mock_db(connected=True)
    with patch("app.services.mongodb_service.mongodb_service", mock_db):
        with TestClient(app) as c:
            response = c.get("/health")

    assert response.status_code == 200
    assert response.json()["database"] == "connected"


# ---------------------------------------------------------------------------
# 3. GET /images/{file_id} — ownership + content-type
# ---------------------------------------------------------------------------

def test_images_not_found():
    """GET /images/{file_id} returns 404 when the file does not exist in GridFS."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token

    mock_db = _make_mock_db(connected=True)
    mock_db.get_image = AsyncMock(return_value=None)
    token = create_access_token({"sub": "user-abc"})

    with patch("app.services.mongodb_service.mongodb_service", mock_db):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/images/nonexistent", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 404


def test_images_wrong_owner():
    """GET /images/{file_id} returns 403 when the image belongs to another user."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token

    mock_db = _make_mock_db(connected=True)
    mock_db.get_image = AsyncMock(return_value=(b"data", "image/jpeg", "other-user"))
    token = create_access_token({"sub": "user-abc"})

    with patch("app.services.mongodb_service.mongodb_service", mock_db):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/images/abc123", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403


def test_images_correct_owner():
    """GET /images/{file_id} returns 200 with the image bytes for the correct owner."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token

    mock_db = _make_mock_db(connected=True)
    mock_db.get_image = AsyncMock(return_value=(b"\xff\xd8\xff", "image/jpeg", "user-abc"))
    token = create_access_token({"sub": "user-abc"})

    with patch("app.services.mongodb_service.mongodb_service", mock_db):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/images/abc123", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.content == b"\xff\xd8\xff"
    assert "image/jpeg" in response.headers["content-type"]


def test_images_empty_owner():
    """GET /images/{file_id} returns 403 when the stored owner_id is empty."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token

    mock_db = _make_mock_db(connected=True)
    mock_db.get_image = AsyncMock(return_value=(b"data", "image/jpeg", ""))
    token = create_access_token({"sub": "user-abc"})

    with patch("app.services.mongodb_service.mongodb_service", mock_db):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/images/abc123", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403


def test_images_requires_auth():
    """GET /images/{file_id} returns 401 without a valid JWT."""
    from fastapi.testclient import TestClient
    from app.main import app

    mock_db = _make_mock_db(connected=True)

    with patch("app.services.mongodb_service.mongodb_service", mock_db):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/images/abc123")

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 4. VectorStoreService.query returns [] on empty collection
# ---------------------------------------------------------------------------

def test_vector_store_empty_collection_returns_empty():
    """query() returns [] immediately without calling ChromaDB when count == 0."""
    from app.services.vector_store_service import VectorStoreService

    svc = VectorStoreService()
    mock_col = MagicMock()
    mock_col.count.return_value = 0

    with patch.object(svc, "_get_or_create_collection", return_value=mock_col):
        result = svc.query("user1", [0.1] * 10, top_k=5)

    assert result == []
    mock_col.query.assert_not_called()
