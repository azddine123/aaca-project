"""
Tests for SM-2 spaced repetition, notes/from-text endpoint, and stats endpoint.
"""
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

_USER_ID = "test-user-sm2"
_NOTE_ID = "note-sm2-001"
_CARD_ID = "card-sm2-001"


@pytest.fixture()
def _auth_client():
    token = create_access_token({"sub": _USER_ID})
    with TestClient(app) as c:
        c.headers["Authorization"] = f"Bearer {token}"
        yield c


def _card(**overrides):
    base = {
        "id": _CARD_ID,
        "note_id": _NOTE_ID,
        "front": "What is a derivative?",
        "back": "Rate of change",
        "difficulty": "beginner",
        "tags": ["calculus"],
        "next_review": datetime.now(),
        "review_count": 0,
        "mastery_level": 0.0,
        "easiness_factor": 2.5,
        "repetitions": 0,
        "interval": 1,
    }
    base.update(overrides)
    return base


def _note(**overrides):
    base = {
        "id": _NOTE_ID,
        "user_id": _USER_ID,
        "title": "Calculus",
        "subject": "mathematics",
        "tags": [],
        "original_image_url": None,
        "processed_image_url": None,
        "processed_content": {
            "title": "Calculus",
            "sections": [],
            "definitions": [],
            "examples": [],
            "key_concepts": [],
            "formulas": [],
        },
        "raw_text": "Calculus is the study of change.",
        "summary": "Intro to calculus.",
        "latex_formulas": [],
        "quizzes": [],
        "flashcards": [],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "cognitive_level": "intermediate",
        "processing_metadata": {},
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# 1. notes/from-text + GET /notes/{id}
# ---------------------------------------------------------------------------

class TestNoteFromText:
    def test_get_note_without_image_url_returns_200(self, _auth_client):
        """GET /notes/{id} must succeed when original_image_url is None."""
        with patch(
            "app.services.mongodb_service.mongodb_service.get_note",
            new_callable=AsyncMock,
            return_value=_note(),
        ):
            resp = _auth_client.get(f"/api/v1/notes/{_NOTE_ID}")

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["id"] == _NOTE_ID
        assert data["original_image_url"] is None

    def test_from_text_returns_note_id(self, _auth_client):
        """POST /notes/from-text must create a note and return note_id."""
        fake_post_ocr = {
            "structured_content": {
                "title": "Calculus", "sections": [], "definitions": [],
                "examples": [], "key_concepts": [], "formulas": [],
            },
            "detected_subject": "mathematics",
            "subject_confidence": 0.9,
            "summary": {"summary": "Intro to calculus."},
            "quiz": None,
            "flashcards": [],
        }

        with (
            patch(
                "app.services.pipeline.pipeline._run_post_ocr_steps",
                new_callable=AsyncMock,
                return_value=fake_post_ocr,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.create_note",
                new_callable=AsyncMock,
                return_value=_NOTE_ID,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_or_create_default_subjects",
                new_callable=AsyncMock,
                return_value=[{"id": "subj-math", "name": "Maths"}],
            ),
            patch(
                "app.services.rag_service.rag_service.index_note",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_or_create_progress",
                new_callable=AsyncMock,
                return_value={"total_notes": 0},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_progress",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            resp = _auth_client.post(
                "/api/v1/notes/from-text",
                json={"raw_text": "Calculus is the study of change."},
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["note_id"] == _NOTE_ID
        assert data["detected_subject"] == "mathematics"

    def test_from_text_persists_ocr_image_urls(self, _auth_client):
        """POST /notes/from-text must attach OCR-stored image URLs to the new note."""
        fake_post_ocr = {
            "structured_content": {
                "title": "Calculus", "sections": [], "definitions": [],
                "examples": [], "key_concepts": [], "formulas": [],
            },
            "detected_subject": "mathematics",
            "subject_confidence": 0.9,
            "summary": {"summary": "Intro to calculus."},
            "quiz": None,
            "flashcards": [],
        }
        created_note: dict = {}

        async def fake_create_note(note_data):
            created_note.update(note_data)
            return _NOTE_ID

        with (
            patch(
                "app.services.pipeline.pipeline._run_post_ocr_steps",
                new_callable=AsyncMock,
                return_value=fake_post_ocr,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.create_note",
                new=fake_create_note,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_or_create_default_subjects",
                new_callable=AsyncMock,
                return_value=[{"id": "subj-math", "name": "Maths"}],
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_gridfs_file_owner",
                new_callable=AsyncMock,
                return_value=_USER_ID,
            ),
            patch(
                "app.services.rag_service.rag_service.index_note",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_or_create_progress",
                new_callable=AsyncMock,
                return_value={"total_notes": 0},
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_progress",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            resp = _auth_client.post(
                "/api/v1/notes/from-text",
                json={
                    "raw_text": "Calculus is the study of change.",
                    "original_image_url": "/images/original-id",
                    "processed_image_url": "/images/processed-id",
                },
            )

        assert resp.status_code == status.HTTP_200_OK
        assert created_note["original_image_url"] == "/images/original-id"
        assert created_note["processed_image_url"] == "/images/processed-id"


# ---------------------------------------------------------------------------
# 2. Flashcard review: SM-2 response fields + save_flashcard_review called
# ---------------------------------------------------------------------------

def _review_payload(rating: int = 4) -> dict:
    return {"flashcard_id": _CARD_ID, "difficulty_rating": rating, "reviewed_at": datetime.now().isoformat()}


class TestFlashcardReviewSM2:
    def test_review_response_includes_all_sm2_fields(self, _auth_client):
        """POST review must return next_review, easiness_factor, interval, etc."""
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_flashcard",
                new_callable=AsyncMock,
                return_value=_card(),
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_note",
                new_callable=AsyncMock,
                return_value=_note(),
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
            resp = _auth_client.post(
                f"/api/v1/flashcards/{_CARD_ID}/review",
                json=_review_payload(4),
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        for field in ("next_review", "days_until_review", "mastery_level",
                      "review_count", "easiness_factor", "interval"):
            assert field in data, f"Missing SM-2 field: {field}"
        assert data["review_count"] == 1

    def test_review_calls_save_flashcard_review_once(self, _auth_client):
        """save_flashcard_review must be awaited exactly once per review."""
        save_mock = AsyncMock(return_value=None)

        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_flashcard",
                new_callable=AsyncMock,
                return_value=_card(),
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_note",
                new_callable=AsyncMock,
                return_value=_note(),
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_flashcard",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.save_flashcard_review",
                save_mock,
            ),
        ):
            _auth_client.post(
                f"/api/v1/flashcards/{_CARD_ID}/review",
                json=_review_payload(3),
            )

        save_mock.assert_awaited_once()


# ---------------------------------------------------------------------------
# 3. GET /flashcards/due with limit query param
# ---------------------------------------------------------------------------

class TestDueFlashcardsLimit:
    def test_limit_param_forwarded_to_service(self, _auth_client):
        """limit=3 must be passed to mongodb_service.get_flashcards."""
        cards = [_card(id=f"card-{i}") for i in range(3)]

        with patch(
            "app.services.mongodb_service.mongodb_service.get_flashcards",
            new_callable=AsyncMock,
            return_value=cards,
        ) as mock_get:
            resp = _auth_client.get("/api/v1/flashcards/due?limit=3")

        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.json()) == 3
        _, kwargs = mock_get.call_args
        assert kwargs.get("limit") == 3

    def test_default_limit_is_20(self, _auth_client):
        """Omitting limit must default to 20."""
        with patch(
            "app.services.mongodb_service.mongodb_service.get_flashcards",
            new_callable=AsyncMock,
            return_value=[],
        ) as mock_get:
            _auth_client.get("/api/v1/flashcards/due")

        _, kwargs = mock_get.call_args
        assert kwargs.get("limit") == 20


# ---------------------------------------------------------------------------
# 4. GET /stats: subject_distribution derived from notes when progress is empty
# ---------------------------------------------------------------------------

class TestStatsSubjectDistribution:
    def test_computes_distribution_from_notes_when_progress_empty(self, _auth_client):
        """When progress.subject_distribution is {}, use the notes aggregation."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_or_create_progress", new_callable=AsyncMock, return_value={"subject_distribution": {}, "study_streak": 0}),
            patch("app.services.mongodb_service.mongodb_service.count_user_notes", new_callable=AsyncMock, return_value=3),
            patch("app.services.mongodb_service.mongodb_service.get_user_quiz_stats", new_callable=AsyncMock, return_value={"count": 0, "average_score": 0.0}),
            patch("app.services.mongodb_service.mongodb_service.get_user_subject_distribution", new_callable=AsyncMock, return_value={"mathematics": 2, "physics": 1}),
            patch("app.services.mongodb_service.mongodb_service.count_flashcards", new_callable=AsyncMock, return_value=0),
        ):
            resp = _auth_client.get("/api/v1/stats")

        assert resp.status_code == status.HTTP_200_OK
        dist = resp.json()["subject_distribution"]
        assert dist.get("mathematics") == 2
        assert dist.get("physics") == 1

    def test_uses_existing_distribution_from_progress(self, _auth_client):
        """When progress already has subject_distribution, keep it unchanged."""
        progress = {"subject_distribution": {"chemistry": 5, "biology": 3}, "study_streak": 1}
        with (
            patch("app.services.mongodb_service.mongodb_service.get_or_create_progress", new_callable=AsyncMock, return_value=progress),
            patch("app.services.mongodb_service.mongodb_service.count_user_notes", new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.get_user_quiz_stats", new_callable=AsyncMock, return_value={"count": 0, "average_score": 0.0}),
            patch("app.services.mongodb_service.mongodb_service.get_user_subject_distribution", new_callable=AsyncMock, return_value={"should-not": 99}),
            patch("app.services.mongodb_service.mongodb_service.count_flashcards", new_callable=AsyncMock, return_value=0),
        ):
            resp = _auth_client.get("/api/v1/stats")

        assert resp.status_code == status.HTTP_200_OK
        dist = resp.json()["subject_distribution"]
        assert dist.get("chemistry") == 5
        assert dist.get("biology") == 3

    def test_stats_response_contains_expected_keys(self, _auth_client):
        """Response must include all expected stat keys."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_or_create_progress", new_callable=AsyncMock, return_value={"subject_distribution": {}, "study_streak": 3}),
            patch("app.services.mongodb_service.mongodb_service.count_user_notes", new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.get_user_quiz_stats", new_callable=AsyncMock, return_value={"count": 0, "average_score": 0.0}),
            patch("app.services.mongodb_service.mongodb_service.get_user_subject_distribution", new_callable=AsyncMock, return_value={}),
            patch("app.services.mongodb_service.mongodb_service.count_flashcards", new_callable=AsyncMock, return_value=0),
        ):
            resp = _auth_client.get("/api/v1/stats")

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        for key in ("total_notes", "total_quizzes", "total_flashcards",
                    "flashcards_due_count", "average_score", "study_streak",
                    "subject_distribution"):
            assert key in data, f"Missing key: {key}"
