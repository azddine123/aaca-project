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


def test_docs_accessible():
    """Test API documentation is accessible"""
    response = client.get("/docs")
    assert response.status_code == 200


def test_process_without_auth():
    """Test that processing requires authentication"""
    response = client.post("/api/v1/process/image")
    assert response.status_code == 403
