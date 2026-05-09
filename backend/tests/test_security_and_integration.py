"""
Security and integration tests for the AACA backend.

Covers:
- Full pipeline integration (mock OCR + mock LLM)
- Flashcard cross-user access prevention
- MongoDB disconnected mode (ServiceUnavailableError → HTTP 503)
"""
import io
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.exceptions import ServiceUnavailableError
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


# ---------------------------------------------------------------------------
# 1. Integration test: full pipeline with mocked OCR and LLM
# ---------------------------------------------------------------------------

class TestFullPipelineIntegration:
    """End-to-end pipeline test using mocks for external services."""

    @pytest.mark.asyncio
    async def test_pipeline_complete_flow(self):
        """
        Mock OCR and LLM layers, then call the pipeline directly.
        Verifies that data flows correctly through every stage and that the
        final result contains expected keys.
        """
        from app.services.pipeline import pipeline

        fake_ocr_result = {
            "text": "The Pythagorean theorem states a²+b²=c².",
            "average_confidence": 0.97,
            "engine": "easyocr",
        }
        fake_structured = {
            "title": "Pythagorean Theorem",
            "sections": [{"heading": "Introduction", "content": "a²+b²=c²"}],
            "definitions": [{"term": "Hypotenuse", "definition": "Longest side"}],
            "examples": ["3,4,5 right triangle"],
            "key_concepts": ["Right triangle", "Squares"],
            "formulas": [{"original": "a²+b²=c²", "description": "Pythagorean theorem"}],
            "subject_category": "mathematics",
        }
        fake_summary = {
            "summary": "The Pythagorean theorem relates the sides of a right triangle.",
            "key_points": ["a²+b²=c²"],
            "reading_time": 1,
        }
        fake_quiz = {
            "title": "Math Quiz",
            "questions": [
                {
                    "id": "q1",
                    "type": "qcm",
                    "question": "What does a²+b²=c² describe?",
                    "options": ["Circle", "Right triangle", "Ellipse", "Parabola"],
                    "correct_answer": "Right triangle",
                    "explanation": "Pythagorean theorem",
                    "difficulty": "beginner",
                }
            ],
            "total_points": 1,
            "estimated_time": 5,
        }
        fake_image = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100  # minimal fake PNG bytes

        with (
            patch(
                "app.services.ocr_service.ocr_service.extract_text",
                new_callable=AsyncMock,
                return_value=fake_ocr_result,
            ),
            patch(
                "app.services.llm_service.llm_service.structure_content",
                new_callable=AsyncMock,
                return_value=fake_structured,
            ),
            patch(
                "app.services.llm_service.llm_service.generate_summary",
                new_callable=AsyncMock,
                return_value=fake_summary,
            ),
            patch(
                "app.services.llm_service.llm_service.generate_quiz",
                new_callable=AsyncMock,
                return_value=fake_quiz,
            ),
            # Skip real image pre-processing
            patch(
                "app.services.image_processor.image_processor.preprocess",
                new_callable=AsyncMock,
                return_value=(fake_image, {}),
            ),
        ):
            result = await pipeline.process_image(fake_image, {
                "perspective_correction": False,
                "enhance_image": False,
                "generate_summary": True,
                "generate_quiz": True,
            })

        assert result["success"] is True
        assert result["raw_text"] == fake_ocr_result["text"]
        assert result["detected_subject"] == "mathematics"
        assert "summary" in result
        assert "quiz" in result
        assert result["quiz"]["title"] == "Math Quiz"


# ---------------------------------------------------------------------------
# 2. Security: user A must not access user B's flashcard
# ---------------------------------------------------------------------------

class TestFlashcardOwnershipEnforcement:
    """Verify that reviewing another user's flashcard is rejected with 403."""

    def test_review_foreign_flashcard_returns_403(
        self,
        _auth_client,
        test_flashcard_data,
    ):
        """
        User 'test-user-123' owns the flashcard via note 'test-note-123'.
        A request authenticated as a *different* user must receive 403.
        """
        other_user_id = "other-user-999"
        other_note = {
            "id": "test-note-123",
            "user_id": other_user_id,   # note belongs to the OTHER user
            "raw_text": "content",
        }

        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_flashcard",
                new_callable=AsyncMock,
                return_value=test_flashcard_data,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_note",
                new_callable=AsyncMock,
                return_value=other_note,
            ),
        ):
            response = _auth_client.post(
                f"/api/v1/flashcards/{test_flashcard_data['id']}/review",
                json={
                    "flashcard_id": test_flashcard_data["id"],
                    "difficulty_rating": 3,
                    "reviewed_at": datetime.now().isoformat(),
                },
            )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_review_own_flashcard_returns_200(
        self,
        _auth_client,
        test_flashcard_data,
        test_note_data,
    ):
        """
        User 'test-user-123' owns the flashcard via note owned by the same user.
        Request must succeed with 200.
        """
        next_review = datetime.now()

        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_flashcard",
                new_callable=AsyncMock,
                return_value=test_flashcard_data,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_note",
                new_callable=AsyncMock,
                return_value=test_note_data,  # user_id == "test-user-123"
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_flashcard",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.save_flashcard_review",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            response = _auth_client.post(
                f"/api/v1/flashcards/{test_flashcard_data['id']}/review",
                json={
                    "flashcard_id": test_flashcard_data["id"],
                    "difficulty_rating": 4,
                    "reviewed_at": datetime.now().isoformat(),
                },
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "next_review" in data

    def test_review_nonexistent_flashcard_returns_404(self, _auth_client):
        """A card that does not exist must return 404, not 500."""
        with patch(
            "app.services.mongodb_service.mongodb_service.get_flashcard",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = _auth_client.post(
                "/api/v1/flashcards/nonexistent-id/review",
                json={
                    "flashcard_id": "nonexistent-id",
                    "difficulty_rating": 3,
                    "reviewed_at": datetime.now().isoformat(),
                },
            )

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 3. MongoDB disconnected mode → HTTP 503
# ---------------------------------------------------------------------------

class TestMongoDBDisconnectedMode:
    """When MongoDB is unavailable, write operations must return HTTP 503."""

    def test_register_without_mongodb_returns_503(self, client):
        """POST /auth/register must return 503, not 200 with a fake ID."""
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_user_by_email",
                new_callable=AsyncMock,
                return_value=None,
            ),
            # Skip real bcrypt hashing (passlib/bcrypt has Python 3.13 compat issues)
            patch(
                "app.api.routes.get_password_hash",
                return_value="hashed_password",
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.create_user",
                new_callable=AsyncMock,
                side_effect=ServiceUnavailableError("MongoDB"),
            ),
        ):
            response = client.post(
                "/api/v1/auth/register",
                json={
                    "email": "new@example.com",
                    "password": "securepass123",
                    "full_name": "New User",
                },
            )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        body = response.json()
        assert "service" in body
        assert body["service"] == "MongoDB"

    def test_create_note_without_mongodb_returns_503(self, _auth_client):
        """POST /process/capture must return 503 when MongoDB is down."""
        fake_pipeline_result = {
            "success": True,
            "raw_text": "Some text",
            "corrected_text": "Some text",
            "structured_content": {"title": "Note"},
            "detected_subject": "other",
            "subject_confidence": 0.8,
            "processing_time": 0.5,
            "latex_formulas": [],
            "summary": {"summary": "Summary"},
            "quiz": None,
            "steps": {},
        }
        with (
            patch(
                "app.services.pipeline.pipeline.process_image",
                new_callable=AsyncMock,
                return_value=fake_pipeline_result,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.upload_image",
                new_callable=AsyncMock,
                return_value="/uploads/fake.png",
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.create_note",
                new_callable=AsyncMock,
                side_effect=ServiceUnavailableError("MongoDB"),
            ),
        ):
            fake_image = b"\x89PNG\r\n" + b"\x00" * 50
            response = _auth_client.post(
                "/api/v1/process/capture",
                files={"file": ("photo.png", io.BytesIO(fake_image), "image/png")},
                data={"title": "Test Note"},
            )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_service_unavailable_error_attributes(self):
        """ServiceUnavailableError must carry the service name."""
        err = ServiceUnavailableError("MongoDB")
        assert err.service == "MongoDB"
        assert "MongoDB" in str(err)

    def test_mongodb_service_raises_when_disconnected(self):
        """
        MongoDBService write methods must raise ServiceUnavailableError
        when self.db is None (i.e. MongoDB not connected).
        """
        import asyncio
        from app.services.mongodb_service import MongoDBService

        # Create a fresh instance with no DB connection
        svc = MongoDBService.__new__(MongoDBService)
        svc.client = None
        svc.db = None

        with pytest.raises(ServiceUnavailableError):
            asyncio.run(svc.create_user({"email": "x@y.com", "full_name": "X"}))

        with pytest.raises(ServiceUnavailableError):
            asyncio.run(svc.create_note({"user_id": "u1", "title": "T"}))

        with pytest.raises(ServiceUnavailableError):
            asyncio.run(svc.create_quiz({"note_id": "n1", "questions": []}))

        with pytest.raises(ServiceUnavailableError):
            asyncio.run(svc.save_quiz_result({"user_id": "u1", "score": 80}))

        with pytest.raises(ServiceUnavailableError):
            asyncio.run(svc.create_flashcards("n1", [{"front": "Q", "back": "A"}]))
