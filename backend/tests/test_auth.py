"""
Tests for authentication endpoints
"""
import pytest
from datetime import datetime
from fastapi import status
from unittest.mock import MagicMock, patch

from app.core.security import verify_password, create_access_token, decode_token


class TestAuthEndpoints:
    """Test authentication-related endpoints"""

    def test_health_check(self, client):
        """Test health endpoint is accessible without auth"""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "healthy"

    def test_root_endpoint(self, client):
        """Test root endpoint returns app info"""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "AI Academic Cognitive Assistant"

    def test_docs_accessible(self, client):
        """Test API documentation is accessible only in DEBUG mode"""
        from app.core.config import settings
        response = client.get("/docs")
        if settings.DEBUG:
            assert response.status_code == status.HTTP_200_OK
        else:
            assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_access_protected_route_without_token(self, client):
        """Test accessing protected route without token fails"""
        response = client.get("/api/v1/user/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_access_protected_route_with_invalid_token(self, client):
        """Test accessing protected route with invalid token fails"""
        client.headers["Authorization"] = "Bearer invalid_token"
        response = client.get("/api/v1/user/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestTokenOperations:
    """Test JWT token operations"""

    def test_password_hashing(self):
        """Test password hashing and verification"""
        from app.core.security import get_password_hash

        password = "testpassword123"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("wrongpassword", hashed) is False

    def test_token_creation_and_decoding(self, test_user):
        """Test JWT token creation and decoding"""
        token = create_access_token({"sub": test_user["id"]})
        assert token is not None
        assert isinstance(token, str)
        
        decoded = decode_token(token)
        assert decoded is not None
        assert decoded["sub"] == test_user["id"]
        assert decoded["type"] == "access"

    def test_token_expiration(self):
        """Test token expiration"""
        from datetime import timedelta, timezone
        from jose import jwt
        from app.core.config import settings

        # jose truncates "exp" to whole seconds, so a token that merely
        # expires "now" can still pass validation depending on where in the
        # current second the test runs. Back-date it by a full second instead
        # of relying on time.sleep() to cross a second boundary.
        token = jwt.encode(
            {"sub": "test-user", "exp": datetime.now(timezone.utc) - timedelta(seconds=1), "type": "access"},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )

        decoded = decode_token(token)
        assert decoded is None
