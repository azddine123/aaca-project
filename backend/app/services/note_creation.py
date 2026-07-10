"""Shared note-creation flow.

The three entry points that produce a note (/process/capture,
/notes/from-text and /sessions/{id}/finalize) all end with the same steps:
resolve the user-owned subject, persist the note, attach quiz/flashcards,
index the text for RAG and bump the user's progress. This module is that
single implementation.
"""

import logging
from datetime import datetime
from typing import Any

from app.services.mongodb_service import mongodb_service
from app.services.rag_service import rag_service

logger = logging.getLogger("aaca")


async def resolve_user_subject(
    detected_subject: str,
    confidence: float,
    user_id: str,
) -> tuple[str | None, str | None, str]:
    """Map an AI-detected subject to a user-owned Subject document.

    Returns (subject_id, subject_name, subject_source).
    """
    from app.services.mongodb_service import AI_SUBJECT_MAP, LOW_CONFIDENCE_THRESHOLD

    user_subjects = await mongodb_service.get_or_create_default_subjects(user_id)
    by_name: dict[str, dict] = {s["name"].lower(): s for s in user_subjects}

    # Low confidence or unknown → "À classer"
    if confidence < LOW_CONFIDENCE_THRESHOLD or detected_subject == "other":
        unclass = by_name.get("à classer")
        if unclass:
            return unclass["id"], unclass["name"], "unclassified"

    # Map AI category to default user subject name
    target = AI_SUBJECT_MAP.get(detected_subject, "Autre").lower()
    match = by_name.get(target)
    if match:
        return match["id"], match["name"], "ai_suggested"

    # Fallback: "Autre"
    autre = by_name.get("autre")
    if autre:
        return autre["id"], autre["name"], "ai_suggested"

    if user_subjects:
        s = user_subjects[0]
        return s["id"], s["name"], "ai_suggested"

    return None, None, "unclassified"


async def persist_note_artifacts(
    *,
    user_id: str,
    note_data: dict[str, Any],
    quiz_data: dict[str, Any] | None = None,
    flashcards: list[dict[str, Any]] | None = None,
    index_text: str | None = None,
    target_language: str,
) -> dict[str, Any]:
    """Persist a note plus its study artifacts.

    Creates the note, attaches the quiz and flashcards when provided,
    indexes the text for RAG (best effort) and bumps the user's progress.
    Returns {"note_id", "quiz_id", "flashcard_ids"}.
    """
    note_id = await mongodb_service.create_note(note_data)

    quiz_id: str | None = None
    if quiz_data and quiz_data.get("questions"):
        quiz_data["note_id"] = note_id
        quiz_data["user_id"] = user_id
        quiz_data["content_language"] = target_language
        quiz_id = await mongodb_service.create_quiz(quiz_data)
        quiz_data.pop("_id", None)  # ObjectId added by MongoDB, not serialisable
        await mongodb_service.update_note(note_id, {"quizzes": [quiz_id]})

    flashcard_ids: list[str] = []
    if flashcards:
        flashcard_ids = await mongodb_service.create_flashcards(note_id, flashcards, user_id)
        await mongodb_service.update_note(note_id, {"flashcards": flashcard_ids})

    if index_text and index_text.strip():
        try:
            await rag_service.index_note(
                user_id=user_id,
                note_id=note_id,
                text=index_text,
                metadata={
                    "subject": note_data.get("subject", "other"),
                    "title": note_data.get("title", "Untitled"),
                },
            )
        except Exception as e:
            logger.warning(f"RAG indexing failed: {e}")

    progress = await mongodb_service.get_or_create_progress(user_id)
    await mongodb_service.update_progress(user_id, {
        "total_notes": progress.get("total_notes", 0) + 1,
        "last_activity": datetime.now(),
    })

    return {"note_id": note_id, "quiz_id": quiz_id, "flashcard_ids": flashcard_ids}
