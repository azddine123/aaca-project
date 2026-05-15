"""Tests for the user-owned Subject system.

Covers:
  - GET /subjects creates defaults on first call
  - POST /subjects creates a new subject
  - POST /subjects rejects duplicate name
  - DELETE /subjects transfers notes to 'À classer'
  - PATCH /notes/{id}/subject changes subject
  - PATCH /notes/{id}/subject rejects a subject belonging to another user
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

_USER_A = "user-a-000000000001"
_USER_B = "user-b-000000000002"


def _client(user_id: str) -> TestClient:
    token = create_access_token({"sub": user_id})
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {token}"
    return c


# ── Fixtures ──────────────────────────────────────────────────────────────────

FAKE_SUBJECT = {
    "id": "sub-001",
    "user_id": _USER_A,
    "name": "Maths",
    "color": "#1B4FD8",
    "icon": "function-variant",
    "created_at": "2026-05-15T12:00:00",
    "updated_at": "2026-05-15T12:00:00",
}

FAKE_UNCLASS = {
    "id": "sub-unclass",
    "user_id": _USER_A,
    "name": "À classer",
    "color": "#F59E0B",
    "icon": "inbox-outline",
    "created_at": "2026-05-15T12:00:00",
    "updated_at": "2026-05-15T12:00:00",
}

FAKE_NOTE = {
    "id": "note-001",
    "user_id": _USER_A,
    "title": "Test Note",
    "subject": "mathematics",
    "subject_id": "sub-001",
    "subject_name": "Maths",
    "subject_source": "ai_suggested",
    "subject_confidence": 0.8,
    "tags": [],
    "raw_text": "some text",
    "summary": None,
    "processed_content": {
        "title": "Test Note",
        "sections": [],
        "definitions": [],
        "examples": [],
        "formulas": [],
        "key_concepts": [],
    },
    "latex_formulas": [],
    "quizzes": [],
    "flashcards": [],
    "cognitive_level": "intermediate",
    "processing_metadata": {},
    "created_at": "2026-05-15T12:00:00",
    "updated_at": "2026-05-15T12:00:00",
}


# ── Test 1: GET /subjects creates defaults ────────────────────────────────────

class TestGetSubjectsCreatesDefaults:
    def test_returns_default_subjects_on_first_call(self):
        defaults = [
            {**FAKE_SUBJECT, "name": n}
            for n in ["Maths", "Informatique", "Physique", "Autre", "À classer"]
        ]
        with (
            patch("app.api.routes.mongodb_service.get_or_create_default_subjects", new=AsyncMock(return_value=defaults)),
        ):
            resp = _client(_USER_A).get("/api/v1/subjects")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) == 5
        names = [d["name"] for d in data]
        assert "Maths" in names
        assert "À classer" in names


# ── Test 2: POST /subjects creates a subject ──────────────────────────────────

class TestCreateSubject:
    def test_create_new_subject(self):
        new_sub = {**FAKE_SUBJECT, "name": "Droit", "id": "sub-droit"}
        with (
            patch("app.api.routes.mongodb_service.get_user_subject_by_name", new=AsyncMock(return_value=None)),
            patch("app.api.routes.mongodb_service.create_subject", new=AsyncMock(return_value="sub-droit")),
            patch("app.api.routes.mongodb_service.get_subject", new=AsyncMock(return_value=new_sub)),
        ):
            resp = _client(_USER_A).post(
                "/api/v1/subjects",
                json={"name": "Droit", "color": "#10B981", "icon": "scale-balance"},
            )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["name"] == "Droit"


# ── Test 3: POST /subjects rejects duplicate name ─────────────────────────────

class TestCreateSubjectDuplicate:
    def test_duplicate_name_returns_409(self):
        with (
            patch("app.api.routes.mongodb_service.get_user_subject_by_name", new=AsyncMock(return_value=FAKE_SUBJECT)),
        ):
            resp = _client(_USER_A).post(
                "/api/v1/subjects",
                json={"name": "Maths", "color": "#1B4FD8", "icon": "function-variant"},
            )
        assert resp.status_code == status.HTTP_409_CONFLICT
        assert "Maths" in resp.json()["detail"]


# ── Test 4: DELETE /subjects transfers notes to À classer ────────────────────

class TestDeleteSubjectTransfersNotes:
    def test_delete_transfers_notes(self):
        with (
            patch("app.api.routes.mongodb_service.get_subject", new=AsyncMock(return_value=FAKE_SUBJECT)),
            patch("app.api.routes.mongodb_service.get_user_subject_by_name", new=AsyncMock(return_value=FAKE_UNCLASS)),
            patch("app.api.routes.mongodb_service.transfer_notes_subject", new=AsyncMock(return_value=3)),
            patch("app.api.routes.mongodb_service.delete_subject", new=AsyncMock(return_value=True)),
        ):
            resp = _client(_USER_A).delete("/api/v1/subjects/sub-001")
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["deleted"] is True
        assert body["notes_transferred"] == 3

    def test_cannot_delete_a_classer(self):
        with (
            patch("app.api.routes.mongodb_service.get_subject", new=AsyncMock(return_value=FAKE_UNCLASS)),
        ):
            resp = _client(_USER_A).delete("/api/v1/subjects/sub-unclass")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ── Test 5: PATCH /notes/{id}/subject changes subject ────────────────────────

class TestChangeNoteSubject:
    def test_change_subject_ok(self):
        new_sub = {**FAKE_SUBJECT, "id": "sub-info", "name": "Informatique"}
        with (
            patch("app.api.routes.mongodb_service.get_note", new=AsyncMock(return_value=FAKE_NOTE)),
            patch("app.api.routes.mongodb_service.get_subject", new=AsyncMock(return_value=new_sub)),
            patch("app.api.routes.mongodb_service.update_note", new=AsyncMock(return_value=True)),
        ):
            resp = _client(_USER_A).patch(
                f"/api/v1/notes/{FAKE_NOTE['id']}/subject",
                json={"subject_id": "sub-info"},
            )
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["subject_name"] == "Informatique"
        assert body["subject_source"] == "manual_changed"


# ── Test 6: PATCH /notes/{id}/subject rejects another user's subject ─────────

class TestChangeNoteSubjectCrossUser:
    def test_cross_user_subject_rejected(self):
        other_user_subject = {**FAKE_SUBJECT, "user_id": _USER_B}
        with (
            patch("app.api.routes.mongodb_service.get_note", new=AsyncMock(return_value=FAKE_NOTE)),
            patch("app.api.routes.mongodb_service.get_subject", new=AsyncMock(return_value=other_user_subject)),
        ):
            resp = _client(_USER_A).patch(
                f"/api/v1/notes/{FAKE_NOTE['id']}/subject",
                json={"subject_id": "sub-001"},
            )
        assert resp.status_code == status.HTTP_404_NOT_FOUND
