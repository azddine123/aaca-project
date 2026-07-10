"""
Tests for the CourseSession multi-image capture flow.

Covers:
- POST /sessions (create)
- GET /sessions (list)
- GET /sessions/{id} (get)
- POST /sessions/{id}/captures/ocr (add capture)
- PATCH /sessions/{id}/captures/{cid} (update text)
- POST /sessions/{id}/finalize (finalize → creates note)
"""
import io
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

_USER_ID = "session-test-user"
_SESSION_ID = "sess-001"
_CAPTURE_ID = "cap-001"
_NOTE_ID = "note-from-session-001"


@pytest.fixture()
def _auth_client():
    token = create_access_token({"sub": _USER_ID})
    with TestClient(app) as c:
        c.headers["Authorization"] = f"Bearer {token}"
        yield c


def _session(**overrides):
    base = {
        "id": _SESSION_ID,
        "user_id": _USER_ID,
        "title": "Thermodynamique S3",
        "subject": "physics",
        "date": datetime.now(),
        "status": "draft",
        "capture_ids": [],
        "final_note_id": None,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    base.update(overrides)
    return base


def _capture(**overrides):
    base = {
        "id": _CAPTURE_ID,
        "session_id": _SESSION_ID,
        "user_id": _USER_ID,
        "order": 0,
        "image_url": "/images/fake.png",
        "raw_text": "Les gaz parfaits suivent PV=nRT.",
        "corrected_text": "Les gaz parfaits suivent PV=nRT.",
        "confidence": 0.93,
        "formulas": [],
        "created_at": datetime.now(),
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# 1. POST /sessions
# ---------------------------------------------------------------------------

class TestCreateSession:
    def test_create_returns_201_with_id(self, _auth_client):
        """POST /sessions must return 201 and the session object."""
        sess = _session()
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.create_session",
                new_callable=AsyncMock,
                return_value=_SESSION_ID,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_session",
                new_callable=AsyncMock,
                return_value=sess,
            ),
        ):
            resp = _auth_client.post(
                "/api/v1/sessions",
                json={"title": "Thermodynamique S3"},
            )

        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["id"] == _SESSION_ID
        assert data["user_id"] == _USER_ID
        assert data["status"] == "draft"

    def test_create_without_title_returns_422(self, _auth_client):
        """Missing title must return 422 (validation error)."""
        resp = _auth_client.post("/api/v1/sessions", json={})
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_with_subject(self, _auth_client):
        """POST /sessions with a valid subject must succeed."""
        sess = _session(subject="physics")
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.create_session",
                new_callable=AsyncMock,
                return_value=_SESSION_ID,
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_session",
                new_callable=AsyncMock,
                return_value=sess,
            ),
        ):
            resp = _auth_client.post(
                "/api/v1/sessions",
                json={"title": "Mécanique Q", "subject": "physics"},
            )

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["subject"] == "physics"


# ---------------------------------------------------------------------------
# 2. GET /sessions
# ---------------------------------------------------------------------------

class TestListSessions:
    def test_list_returns_sessions(self, _auth_client):
        """GET /sessions must return all sessions for the authenticated user."""
        sessions = [_session(), _session(id="sess-002", title="Algo")]
        with patch(
            "app.services.mongodb_service.mongodb_service.get_user_sessions",
            new_callable=AsyncMock,
            return_value=sessions,
        ):
            resp = _auth_client.get("/api/v1/sessions")

        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.json()) == 2

    def test_list_returns_empty_when_no_sessions(self, _auth_client):
        """GET /sessions must return [] when user has no sessions."""
        with patch(
            "app.services.mongodb_service.mongodb_service.get_user_sessions",
            new_callable=AsyncMock,
            return_value=[],
        ):
            resp = _auth_client.get("/api/v1/sessions")

        assert resp.status_code == status.HTTP_200_OK
        assert resp.json() == []


# ---------------------------------------------------------------------------
# 3. GET /sessions/{id}
# ---------------------------------------------------------------------------

class TestGetSession:
    def test_get_own_session_returns_200(self, _auth_client):
        """GET /sessions/{id} owned by the user must return 200."""
        with patch(
            "app.services.mongodb_service.mongodb_service.get_session",
            new_callable=AsyncMock,
            return_value=_session(),
        ):
            resp = _auth_client.get(f"/api/v1/sessions/{_SESSION_ID}")

        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["id"] == _SESSION_ID

    def test_get_foreign_session_returns_404(self, _auth_client):
        """GET /sessions/{id} belonging to another user must return 404."""
        foreign = _session(user_id="other-user-999")
        with patch(
            "app.services.mongodb_service.mongodb_service.get_session",
            new_callable=AsyncMock,
            return_value=foreign,
        ):
            resp = _auth_client.get(f"/api/v1/sessions/{_SESSION_ID}")

        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_nonexistent_session_returns_404(self, _auth_client):
        with patch(
            "app.services.mongodb_service.mongodb_service.get_session",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = _auth_client.get("/api/v1/sessions/doesnotexist")

        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 4. PATCH /sessions/{id}/captures/{cid}
# ---------------------------------------------------------------------------

class TestUpdateCapture:
    def test_update_corrected_text_returns_200(self, _auth_client):
        """PATCH must update corrected_text and return the updated capture."""
        updated_cap = _capture(corrected_text="PV = nRT (corrigé)")
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_session",
                new_callable=AsyncMock,
                return_value=_session(),
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_capture",
                new_callable=AsyncMock,
                side_effect=[_capture(), updated_cap],
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.update_capture",
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            resp = _auth_client.patch(
                f"/api/v1/sessions/{_SESSION_ID}/captures/{_CAPTURE_ID}",
                json={"corrected_text": "PV = nRT (corrigé)"},
            )

        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["corrected_text"] == "PV = nRT (corrigé)"

    def test_update_capture_belonging_to_other_session_returns_404(self, _auth_client):
        """PATCH a capture whose session_id doesn't match the URL must return 404."""
        wrong_cap = _capture(session_id="other-session-999")
        with (
            patch(
                "app.services.mongodb_service.mongodb_service.get_session",
                new_callable=AsyncMock,
                return_value=_session(),
            ),
            patch(
                "app.services.mongodb_service.mongodb_service.get_capture",
                new_callable=AsyncMock,
                return_value=wrong_cap,
            ),
        ):
            resp = _auth_client.patch(
                f"/api/v1/sessions/{_SESSION_ID}/captures/{_CAPTURE_ID}",
                json={"corrected_text": "text"},
            )

        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 5. POST /sessions/{id}/finalize
# ---------------------------------------------------------------------------

class TestFinalizeSession:
    def _mock_finalize(self):
        return {
            "session": _session(status="processing", capture_ids=[_CAPTURE_ID]),
            "captures": [_capture()],
        }

    def test_finalize_creates_note_and_returns_note_id(self, _auth_client):
        """POST /finalize must return note_id after merging captures."""
        fake_structured = {
            "title": "Thermodynamique",
            "sections": [{"title": "Intro", "content": "PV=nRT"}],
            "definitions": [], "examples": [], "key_concepts": [], "formulas": [],
            "subject_category": "physics",
        }
        fake_summary = {"summary": "Cours de thermo.", "key_points": [], "reading_time": 1}
        fake_quiz = {"title": "Quiz Thermo", "questions": [
            {"id": "q1", "type": "qcm", "question": "Q?", "options": ["A", "B"],
             "correct_answer": "A", "explanation": "E", "difficulty": "beginner"},
        ], "total_points": 1, "estimated_time": 5}

        mocks = self._mock_finalize()
        with (
            patch("app.services.mongodb_service.mongodb_service.get_session",
                  new_callable=AsyncMock, return_value=mocks["session"]),
            patch("app.services.mongodb_service.mongodb_service.get_session_captures",
                  new_callable=AsyncMock, return_value=mocks["captures"]),
            patch("app.services.llm_service.llm_service.merge_captures_to_course",
                  new_callable=AsyncMock, return_value=fake_structured),
            patch("app.services.llm_service.llm_service.generate_summary",
                  new_callable=AsyncMock, return_value=fake_summary),
            patch("app.services.llm_service.llm_service.generate_quiz",
                  new_callable=AsyncMock, return_value=fake_quiz),
            patch("app.services.llm_service.llm_service.generate_flashcards",
                  new_callable=AsyncMock, return_value=[]),
            patch("app.services.mongodb_service.mongodb_service.create_note",
                  new_callable=AsyncMock, return_value=_NOTE_ID),
            patch("app.services.mongodb_service.mongodb_service.create_quiz",
                  new_callable=AsyncMock, return_value="quiz-001"),
            patch("app.services.mongodb_service.mongodb_service.update_note",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.update_session",
                  new_callable=AsyncMock, return_value=True),
            patch("app.services.mongodb_service.mongodb_service.get_or_create_progress",
                  new_callable=AsyncMock, return_value={"total_notes": 0}),
            patch("app.services.mongodb_service.mongodb_service.update_progress",
                  new_callable=AsyncMock, return_value=None),
            patch("app.services.rag_service.rag_service.index_note",
                  new_callable=AsyncMock, return_value=None),
            # Session notes now get a user-owned subject (bug fix 2026-07-08)
            patch("app.api.routers.sessions.resolve_user_subject",
                  new_callable=AsyncMock,
                  return_value=("subj-phys", "Physique", "ai_suggested")),
        ):
            resp = _auth_client.post(f"/api/v1/sessions/{_SESSION_ID}/finalize")

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["note_id"] == _NOTE_ID
        assert data["capture_count"] == 1

    def test_finalize_empty_session_returns_400(self, _auth_client):
        """Finalizing a session with no captures must return 400."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_session",
                  new_callable=AsyncMock, return_value=_session()),
            patch("app.services.mongodb_service.mongodb_service.get_session_captures",
                  new_callable=AsyncMock, return_value=[]),
        ):
            resp = _auth_client.post(f"/api/v1/sessions/{_SESSION_ID}/finalize")

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_finalize_already_completed_returns_400(self, _auth_client):
        """Finalizing an already-completed session must return 400."""
        completed = _session(status="completed", final_note_id=_NOTE_ID)
        with patch(
            "app.services.mongodb_service.mongodb_service.get_session",
            new_callable=AsyncMock,
            return_value=completed,
        ):
            resp = _auth_client.post(f"/api/v1/sessions/{_SESSION_ID}/finalize")

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
