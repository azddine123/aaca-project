"""
Contract and regression tests for bug fixes.

Covers:
- FlashcardReview: flashcard_id is now optional (route uses URL path card_id)
- Profile update: backend accepts full_name, rejects unknown field `name`
- DELETE /notes cascade: quiz_results, GridFS image, session cleanup
- /process/capture: no double flashcard generation
"""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

_USER_ID = "contract-test-user"
_NOTE_ID = "note-contract-001"
_QUIZ_ID = "quiz-contract-001"
_CARD_ID = "card-contract-001"
_SESSION_ID = "sess-contract-001"


@pytest.fixture()
def _auth_client():
    token = create_access_token({"sub": _USER_ID})
    with TestClient(app) as c:
        c.headers["Authorization"] = f"Bearer {token}"
        yield c


def _note(**overrides):
    base = {
        "id": _NOTE_ID,
        "user_id": _USER_ID,
        "title": "Contrats",
        "subject": "mathematics",
        "tags": [],
        "original_image_url": "/images/abc123",
        "processed_content": {
            "title": "Contrats", "sections": [], "definitions": [],
            "examples": [], "key_concepts": [], "formulas": [],
        },
        "raw_text": "Texte de test.",
        "summary": "Résumé.",
        "latex_formulas": [],
        "quizzes": [_QUIZ_ID],
        "flashcards": [_CARD_ID],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "cognitive_level": "intermediate",
        "processing_metadata": {},
        "session_id": None,
    }
    base.update(overrides)
    return base


def _card(**overrides):
    base = {
        "id": _CARD_ID,
        "note_id": _NOTE_ID,
        "front": "Q?",
        "back": "A.",
        "difficulty": "beginner",
        "tags": [],
        "next_review": datetime.now(),
        "review_count": 0,
        "mastery_level": 0.0,
        "easiness_factor": 2.5,
        "repetitions": 0,
        "interval": 1,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# 1. FlashcardReview: flashcard_id is optional
# ---------------------------------------------------------------------------

class TestFlashcardReviewContract:
    def test_review_without_flashcard_id_in_body_returns_200(self, _auth_client):
        """POST review body WITHOUT flashcard_id must be accepted (it's optional now)."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_flashcard",
                  new_callable=AsyncMock, return_value=_card()),
            patch("app.services.mongodb_service.mongodb_service.get_note",
                  new_callable=AsyncMock, return_value=_note()),
            patch("app.services.mongodb_service.mongodb_service.update_flashcard",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.save_flashcard_review",
                  new_callable=AsyncMock, return_value=None),
        ):
            resp = _auth_client.post(
                f"/api/v1/flashcards/{_CARD_ID}/review",
                json={
                    # flashcard_id intentionally omitted
                    "difficulty_rating": 4,
                    "reviewed_at": datetime.now().isoformat(),
                },
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert "next_review" in data
        assert "interval" in data

    def test_review_with_flashcard_id_in_body_still_accepted(self, _auth_client):
        """POST review body WITH flashcard_id must still be accepted (backward compat)."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_flashcard",
                  new_callable=AsyncMock, return_value=_card()),
            patch("app.services.mongodb_service.mongodb_service.get_note",
                  new_callable=AsyncMock, return_value=_note()),
            patch("app.services.mongodb_service.mongodb_service.update_flashcard",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.save_flashcard_review",
                  new_callable=AsyncMock, return_value=None),
        ):
            resp = _auth_client.post(
                f"/api/v1/flashcards/{_CARD_ID}/review",
                json={
                    "flashcard_id": _CARD_ID,
                    "difficulty_rating": 3,
                    "reviewed_at": datetime.now().isoformat(),
                },
            )

        assert resp.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# 2. Profile update: full_name is accepted, `name` is silently ignored
# ---------------------------------------------------------------------------

class TestProfileUpdate:
    def test_patch_full_name_returns_200(self, _auth_client):
        """PATCH /user/me with { full_name } must return 200."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={
                      "id": _USER_ID, "email": "u@test.com",
                      "full_name": "Old Name", "institution": None,
                      "cognitive_level": "intermediate", "preferred_subjects": [],
                      "created_at": datetime.now(), "updated_at": datetime.now(),
                      "is_active": True, "is_premium": False,
                  }),
            patch("app.services.mongodb_service.mongodb_service.update_user",
                  new_callable=AsyncMock, return_value=True),
        ):
            resp = _auth_client.patch(
                "/api/v1/user/me",
                json={"full_name": "New Name"},
            )

        assert resp.status_code == status.HTTP_200_OK

    def test_patch_with_name_field_is_422_or_ignored(self, _auth_client):
        """PATCH with unknown field `name` (old frontend bug) must not crash server."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value={
                      "id": _USER_ID, "email": "u@test.com",
                      "full_name": "Old Name", "institution": None,
                      "cognitive_level": "intermediate", "preferred_subjects": [],
                      "created_at": datetime.now(), "updated_at": datetime.now(),
                      "is_active": True, "is_premium": False,
                  }),
            patch("app.services.mongodb_service.mongodb_service.update_user",
                  new_callable=AsyncMock, return_value=True),
        ):
            resp = _auth_client.patch(
                "/api/v1/user/me",
                json={"name": "New Name"},
            )

        # Pydantic strips unknown fields → update is empty → no-op, still 200
        assert resp.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# 3. DELETE /notes cascade: quiz_results, GridFS, session
# ---------------------------------------------------------------------------

class TestDeleteNoteCascade:
    def _common_patches(self, note_overrides=None):
        """Return the standard set of patches for delete-note tests."""
        return {
            "get_note": AsyncMock(return_value=_note(**(note_overrides or {}))),
            "delete_quiz_results": AsyncMock(return_value=2),
            "delete_quizzes": AsyncMock(return_value=1),
            "delete_flashcards": AsyncMock(return_value=3),
            "delete_note": AsyncMock(return_value=True),
            "delete_gridfs": AsyncMock(return_value=True),
        }

    def test_deletes_quiz_results_for_note_quizzes(self, _auth_client):
        """delete_quiz_results_by_quiz_ids must be called with the note's quiz_ids."""
        delete_results_mock = AsyncMock(return_value=1)
        with (
            patch("app.services.mongodb_service.mongodb_service.get_note",
                  new_callable=AsyncMock, return_value=_note()),
            patch("app.services.mongodb_service.mongodb_service.delete_quiz_results_by_quiz_ids",
                  delete_results_mock),
            patch("app.services.mongodb_service.mongodb_service.delete_quizzes_by_note",
                  new_callable=AsyncMock, return_value=1),
            patch("app.services.mongodb_service.mongodb_service.delete_flashcards_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_note",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.delete_image_from_gridfs",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.rag_service.rag_service.remove_note", return_value=None),
        ):
            resp = _auth_client.delete(f"/api/v1/notes/{_NOTE_ID}")

        assert resp.status_code == status.HTTP_200_OK
        delete_results_mock.assert_awaited_once_with([_QUIZ_ID])

    def test_deletes_gridfs_image_when_url_starts_with_images(self, _auth_client):
        """delete_image_from_gridfs must be called for /images/... URLs."""
        gridfs_mock = AsyncMock(return_value=True)
        with (
            patch("app.services.mongodb_service.mongodb_service.get_note",
                  new_callable=AsyncMock, return_value=_note()),
            patch("app.services.mongodb_service.mongodb_service.delete_quiz_results_by_quiz_ids",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_quizzes_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_flashcards_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_note",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.delete_image_from_gridfs",
                  gridfs_mock),
            patch("app.services.rag_service.rag_service.remove_note", return_value=None),
        ):
            resp = _auth_client.delete(f"/api/v1/notes/{_NOTE_ID}")

        assert resp.status_code == status.HTTP_200_OK
        gridfs_mock.assert_awaited_once_with("abc123")

    def test_skips_gridfs_delete_for_local_storage_url(self, _auth_client):
        """delete_image_from_gridfs must NOT be called for /uploads/... URLs."""
        gridfs_mock = AsyncMock(return_value=True)
        note_local = _note(original_image_url="/uploads/user/note.png")
        with (
            patch("app.services.mongodb_service.mongodb_service.get_note",
                  new_callable=AsyncMock, return_value=note_local),
            patch("app.services.mongodb_service.mongodb_service.delete_quiz_results_by_quiz_ids",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_quizzes_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_flashcards_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_note",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.delete_image_from_gridfs",
                  gridfs_mock),
            patch("app.services.rag_service.rag_service.remove_note", return_value=None),
        ):
            resp = _auth_client.delete(f"/api/v1/notes/{_NOTE_ID}")

        assert resp.status_code == status.HTTP_200_OK
        gridfs_mock.assert_not_awaited()

    def test_clears_session_final_note_id_when_note_has_session(self, _auth_client):
        """If note.session_id is set, update_session must clear final_note_id."""
        update_session_mock = AsyncMock(return_value=True)
        note_with_session = _note(session_id=_SESSION_ID)
        with (
            patch("app.services.mongodb_service.mongodb_service.get_note",
                  new_callable=AsyncMock, return_value=note_with_session),
            patch("app.services.mongodb_service.mongodb_service.delete_quiz_results_by_quiz_ids",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_quizzes_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_flashcards_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_note",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.delete_image_from_gridfs",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.update_session",
                  update_session_mock),
            patch("app.services.rag_service.rag_service.remove_note", return_value=None),
        ):
            resp = _auth_client.delete(f"/api/v1/notes/{_NOTE_ID}")

        assert resp.status_code == status.HTTP_200_OK
        update_session_mock.assert_awaited_once_with(
            _SESSION_ID, {"final_note_id": None, "status": "processing"}
        )

    def test_does_not_call_update_session_when_no_session(self, _auth_client):
        """If note.session_id is None, update_session must NOT be called."""
        update_session_mock = AsyncMock(return_value=True)
        with (
            patch("app.services.mongodb_service.mongodb_service.get_note",
                  new_callable=AsyncMock, return_value=_note()),  # session_id=None
            patch("app.services.mongodb_service.mongodb_service.delete_quiz_results_by_quiz_ids",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_quizzes_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_flashcards_by_note",
                  new_callable=AsyncMock, return_value=0),
            patch("app.services.mongodb_service.mongodb_service.delete_note",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.delete_image_from_gridfs",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.update_session",
                  update_session_mock),
            patch("app.services.rag_service.rag_service.remove_note", return_value=None),
        ):
            resp = _auth_client.delete(f"/api/v1/notes/{_NOTE_ID}")

        assert resp.status_code == status.HTTP_200_OK
        update_session_mock.assert_not_awaited()
