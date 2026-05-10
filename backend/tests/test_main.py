"""
Test suite for AACA Backend API
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test health endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["name"] == "AI Academic Cognitive Assistant"


def test_docs_hidden_when_not_debug():
    """With DEBUG=False (default in CI), /docs must return 404."""
    from app.core.config import settings
    response = client.get("/docs")
    if settings.DEBUG:
        assert response.status_code == 200
    else:
        assert response.status_code == 404


def test_process_without_auth():
    """Test that processing requires authentication (401 = missing credentials)"""
    response = client.post("/api/v1/process/image")
    assert response.status_code == 401
