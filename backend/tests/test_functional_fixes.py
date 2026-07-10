"""
Tests for the functional bug fixes (CORRECTIONS.txt items 2, 3, 18, 19).

Covers:
- submit_quiz: unanswered questions count as wrong (no more 100% by
  submitting only known answers)
- submit_quiz: time_taken uses total_seconds() (quizzes > 1 h)
- /stats: counts come from DB-side aggregations, not a 50-doc fetch
- delete_flashcards_by_note also deletes the flashcard_reviews history
"""
from contextlib import ExitStack
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

_USER = "quiz-user-001"


def _auth_client() -> TestClient:
    token = create_access_token({"sub": _USER, "tv": 0})
    c = TestClient(app, raise_server_exceptions=False)
    c.headers["Authorization"] = f"Bearer {token}"
    return c


def _quiz(num_questions: int = 4) -> dict:
    return {
        "id": "quiz-1",
        "user_id": _USER,
        "note_id": "note-1",
        "questions": [
            {
                "id": f"q{i}",
                "correct_answer": f"answer-{i}",
                "explanation": f"expl-{i}",
                "points": 1,
            }
            for i in range(num_questions)
        ],
    }


def _submit(client: TestClient, answers: list[dict], hours: float = 0.1):
    started = datetime(2026, 7, 8, 10, 0, 0)
    completed = started + timedelta(hours=hours)
    return client.post(
        "/api/v1/quizzes/quiz-1/submit",
        json={
            "quiz_id": "quiz-1",
            "answers": answers,
            "started_at": started.isoformat(),
            "completed_at": completed.isoformat(),
        },
    )


def _quiz_route_mocks(quiz: dict):
    return (
        patch("app.services.mongodb_service.mongodb_service.get_user",
              new_callable=AsyncMock, return_value=None),
        patch("app.services.mongodb_service.mongodb_service.get_quiz",
              new_callable=AsyncMock, return_value=quiz),
        patch("app.services.mongodb_service.mongodb_service.get_note",
              new_callable=AsyncMock, return_value=None),
        patch("app.services.llm_service.llm_service.analyze_errors",
              new_callable=AsyncMock, return_value={}),
        patch("app.services.mongodb_service.mongodb_service.save_quiz_result",
              new_callable=AsyncMock, return_value="res-1"),
        patch("app.services.mongodb_service.mongodb_service.get_or_create_progress",
              new_callable=AsyncMock, return_value={}),
        patch("app.services.mongodb_service.mongodb_service.update_progress",
              new_callable=AsyncMock, return_value=True),
    )


class TestQuizScoring:

    def test_partial_submission_does_not_give_100_percent(self):
        """Answering only 2 of 4 questions correctly must give 50%, not 100%."""
        with ExitStack() as stack:
            for p in _quiz_route_mocks(_quiz(4)):
                stack.enter_context(p)
            c = _auth_client()
            resp = _submit(c, [
                {"question_id": "q0", "answer": "answer-0", "time_spent": 5},
                {"question_id": "q1", "answer": "answer-1", "time_spent": 5},
            ])
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["score"] == 50.0
        assert body["total_points"] == 4
        assert body["earned_points"] == 2
        assert body["correct_answers"] == 2
        assert body["incorrect_answers"] == 2
        # Unanswered questions appear in the feedback as wrong
        feedback = {f["question_id"]: f for f in body["detailed_feedback"]}
        assert len(feedback) == 4
        assert feedback["q2"]["is_correct"] is False
        assert feedback["q2"]["user_answer"] == ""

    def test_full_correct_submission_gives_100_percent(self):
        with ExitStack() as stack:
            for p in _quiz_route_mocks(_quiz(3)):
                stack.enter_context(p)
            c = _auth_client()
            resp = _submit(c, [
                {"question_id": f"q{i}", "answer": f"answer-{i}", "time_spent": 5}
                for i in range(3)
            ])
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["score"] == 100.0

    def test_time_taken_over_one_hour(self):
        """A 2-hour quiz must report 7200s, not 7200 % 3600."""
        with ExitStack() as stack:
            for p in _quiz_route_mocks(_quiz(1)):
                stack.enter_context(p)
            c = _auth_client()
            resp = _submit(
                c,
                [{"question_id": "q0", "answer": "answer-0", "time_spent": 3600}],
                hours=2,
            )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["time_taken"] == 7200


class TestStatsAggregation:

    def test_stats_use_db_side_aggregations(self):
        """Counts must come from the aggregation methods (no 50-doc cap)."""
        with (
            patch("app.services.mongodb_service.mongodb_service.get_user",
                  new_callable=AsyncMock, return_value=None),
            patch("app.services.mongodb_service.mongodb_service.get_or_create_progress",
                  new_callable=AsyncMock, return_value={"study_streak": 3}),
            patch("app.services.mongodb_service.mongodb_service.count_user_notes",
                  new_callable=AsyncMock, return_value=120),
            patch("app.services.mongodb_service.mongodb_service.get_user_quiz_stats",
                  new_callable=AsyncMock,
                  return_value={"count": 250, "average_score": 71.4}),
            patch("app.services.mongodb_service.mongodb_service.get_user_subject_distribution",
                  new_callable=AsyncMock,
                  return_value={"math": 80, "physics": 40}),
            patch("app.services.mongodb_service.mongodb_service.count_flashcards",
                  new_callable=AsyncMock, side_effect=[300, 12]),
        ):
            c = _auth_client()
            resp = c.get("/api/v1/stats")
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["total_notes"] == 120       # > 50 : plus de plafond
        assert body["total_quizzes"] == 250     # > 100 : plus de plafond
        assert body["average_score"] == 71.4
        assert body["subject_distribution"] == {"math": 80, "physics": 40}


class TestLLMCacheBounded:

    def test_lru_eviction_past_max_entries(self):
        """The cache must evict its oldest entry once max_entries is reached."""
        from app.services.llm_service import LLMCache

        cache = LLMCache(ttl=3600, max_entries=3)
        for i in range(3):
            cache.set(f"prompt-{i}", {"v": i})
        # Touch prompt-0 so prompt-1 becomes the least recently used
        assert cache.get("prompt-0") == {"v": 0}

        cache.set("prompt-3", {"v": 3})

        assert len(cache.cache) == 3
        assert cache.get("prompt-1") is None      # evicted (LRU)
        assert cache.get("prompt-0") == {"v": 0}  # kept (recently used)
        assert cache.get("prompt-3") == {"v": 3}


class TestFlashcardReviewCascade:

    @pytest.mark.asyncio
    async def test_delete_flashcards_by_note_deletes_reviews(self):
        """Deleting a note's flashcards must purge their review history."""
        from app.services.mongodb_service import mongodb_service

        fc_ids = [ObjectId(), ObjectId()]

        class _FakeCursor:
            def __aiter__(self):
                async def gen():
                    for oid in fc_ids:
                        yield {"_id": oid}
                return gen()

        flashcards = MagicMock()
        flashcards.find = MagicMock(return_value=_FakeCursor())
        flashcards.delete_many = AsyncMock(return_value=MagicMock(deleted_count=2))

        reviews = MagicMock()
        reviews.delete_many = AsyncMock(return_value=MagicMock(deleted_count=5))

        def fake_get_collection(name: str):
            return {"flashcards": flashcards, "flashcard_reviews": reviews}[name]

        with patch.object(mongodb_service, "_get_collection", side_effect=fake_get_collection):
            deleted = await mongodb_service.delete_flashcards_by_note("note-1")

        assert deleted == 2
        reviews.delete_many.assert_awaited_once_with(
            {"flashcard_id": {"$in": [str(o) for o in fc_ids]}}
        )
        flashcards.delete_many.assert_awaited_once_with({"note_id": "note-1"})
