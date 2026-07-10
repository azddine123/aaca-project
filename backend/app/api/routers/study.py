"""Study routes: quizzes, flashcards (SM-2), progress, recommendations, stats."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user
from app.models.schemas import (
    CognitiveLevel,
    Flashcard,
    FlashcardReview,
    Quiz,
    QuizResult,
    QuizSubmission,
)
from app.api.routers.common import _get_owned_note, _get_user_content_language
from app.services.adaptive_learning import adaptive_learning
from app.services.llm_service import llm_service
from app.services.mongodb_service import mongodb_service

logger = logging.getLogger("aaca")
router = APIRouter(tags=["study"])


# =============================================================================
# Quiz Routes
# =============================================================================

@router.get("/notes/{note_id}/quizzes", response_model=list[Quiz])
async def get_note_quizzes(
    note_id: str,
    current_user: str = Depends(get_current_user),
) -> list[Quiz]:
    """Get all quizzes for a note."""
    await _get_owned_note(note_id, current_user)

    quizzes = await mongodb_service.get_note_quizzes(note_id)
    return [Quiz(**q) for q in quizzes]


@router.post("/notes/{note_id}/quizzes")
async def generate_quiz(
    note_id: str,
    num_questions: int = Query(5, ge=1, le=20),
    difficulty: CognitiveLevel = Query(CognitiveLevel.INTERMEDIATE),
    current_user: str = Depends(get_current_user),
) -> dict:
    """Generate a new quiz for a note."""
    note = await _get_owned_note(note_id, current_user)
    target_language = note.get("content_language") or await _get_user_content_language(current_user)

    quiz_data = await llm_service.generate_quiz(
        note["raw_text"],
        num_questions=num_questions,
        difficulty=difficulty.value,
        target_language=target_language,
    )

    quiz_data["note_id"] = note_id
    quiz_data["user_id"] = current_user
    quiz_data["content_language"] = target_language

    quiz_id = await mongodb_service.create_quiz(quiz_data)
    quiz_data.pop("_id", None)  # ObjectId ajouté par MongoDB, non sérialisable par Pydantic

    return {**quiz_data, "id": quiz_id}


@router.post("/quizzes/{quiz_id}/submit", response_model=QuizResult)
async def submit_quiz(
    quiz_id: str,
    submission: QuizSubmission,
    current_user: str = Depends(get_current_user),
) -> QuizResult:
    """Submit quiz answers and get results."""
    quiz = await mongodb_service.get_quiz(quiz_id)

    if not quiz or quiz.get("user_id") != current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )

    # Calculate score — every question in the quiz counts; unanswered ones
    # are scored as wrong (otherwise submitting only known answers gives 100%)
    answers_by_qid = {a.question_id: a for a in submission.answers}
    correct = 0
    total_points = 0
    earned_points = 0
    detailed_feedback = []

    for question in quiz["questions"]:
        answer = answers_by_qid.get(question["id"])
        points = question.get("points", 1)
        total_points += points

        is_correct = (
            answer is not None
            and answer.answer.lower().strip() == question["correct_answer"].lower().strip()
        )
        if is_correct:
            correct += 1
            earned_points += points

        detailed_feedback.append({
            "question_id": question["id"],
            "is_correct": is_correct,
            "correct_answer": question["correct_answer"],
            "user_answer": answer.answer if answer else "",
            "explanation": question["explanation"],
            "related_concept": question.get("related_concept", ""),
            "points_earned": points if is_correct else 0,
        })

    score = (earned_points / total_points * 100) if total_points > 0 else 0

    # Analyze errors
    note = await mongodb_service.get_note(quiz["note_id"])
    error_analysis = await llm_service.analyze_errors(
        [{"question_id": f["question_id"], "is_correct": f["is_correct"]} for f in detailed_feedback],
        note["raw_text"] if note else "",
    )

    result = QuizResult(
        quiz_id=quiz_id,
        score=round(score, 2),
        total_points=total_points,
        earned_points=earned_points,
        correct_answers=correct,
        incorrect_answers=len(quiz["questions"]) - correct,
        time_taken=int((submission.completed_at - submission.started_at).total_seconds()),
        detailed_feedback=detailed_feedback,
        weak_areas=error_analysis.get("weak_areas", []),
        recommendations=error_analysis.get("recommendations", []),
    )

    await mongodb_service.save_quiz_result({
        "user_id": current_user,
        "quiz_id": quiz_id,
        **result.model_dump(),
    })

    # Update progress: total quizzes, average score, streak, weak areas
    progress = await mongodb_service.get_or_create_progress(current_user)
    prev_total = progress.get("total_quizzes_taken", 0)
    prev_avg = progress.get("average_score", 0.0)
    new_total = prev_total + 1
    new_avg = round((prev_avg * prev_total + score) / new_total, 2)

    last_activity = progress.get("last_activity")
    today = datetime.now().date()
    if last_activity:
        last_date = last_activity.date() if hasattr(last_activity, "date") else datetime.fromisoformat(str(last_activity)).date()
        delta = (today - last_date).days
        if delta == 1:
            streak = progress.get("study_streak", 0) + 1
        elif delta == 0:
            streak = progress.get("study_streak", 0)
        else:
            streak = 1
    else:
        streak = 1

    await mongodb_service.update_progress(current_user, {
        "total_quizzes_taken": new_total,
        "average_score": new_avg,
        "study_streak": streak,
        "last_activity": datetime.now(),
        "weak_areas": error_analysis.get("weak_areas", []),
    })

    return result


# =============================================================================
# Flashcard Routes
# =============================================================================

@router.get("/notes/{note_id}/flashcards", response_model=list[Flashcard])
async def get_flashcards(
    note_id: str,
    current_user: str = Depends(get_current_user),
) -> list[Flashcard]:
    """Get flashcards for a note."""
    await _get_owned_note(note_id, current_user)

    flashcards = await mongodb_service.get_flashcards(note_id=note_id, user_id=current_user)
    return [Flashcard(**f) for f in flashcards]


@router.post("/flashcards/{card_id}/review")
async def review_flashcard(
    card_id: str,
    review: FlashcardReview,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Review a flashcard using spaced repetition (SM-2)."""
    card = await mongodb_service.get_flashcard(card_id)

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard not found",
        )

    # Verify ownership via parent note
    await _get_owned_note(card["note_id"], current_user)

    sm2 = adaptive_learning.compute_sm2(card, review.difficulty_rating)
    new_review_count = card.get("review_count", 0) + 1
    new_mastery = round(min(1.0, card.get("mastery_level", 0.0) + (review.difficulty_rating / 25)), 4)

    update_data = {
        "last_reviewed": review.reviewed_at,
        "next_review": sm2["next_review"],
        "review_count": new_review_count,
        "mastery_level": new_mastery,
        "easiness_factor": sm2["easiness_factor"],
        "repetitions": sm2["repetitions"],
        "interval": sm2["interval"],
    }
    await mongodb_service.update_flashcard(card_id, update_data)

    # Persist review history for analytics
    await mongodb_service.save_flashcard_review({
        "user_id": current_user,
        "flashcard_id": card_id,
        "note_id": card["note_id"],
        "difficulty_rating": review.difficulty_rating,
        "reviewed_at": review.reviewed_at,
        "next_review": sm2["next_review"],
        "mastery_level_after": new_mastery,
        "interval_days": sm2["interval"],
    })

    days_until = max(0, (sm2["next_review"] - review.reviewed_at).days)
    return {
        "next_review": sm2["next_review"],
        "days_until_review": days_until,
        "mastery_level": new_mastery,
        "review_count": new_review_count,
        "easiness_factor": sm2["easiness_factor"],
        "interval": sm2["interval"],
    }


@router.get("/flashcards/due")
async def get_due_flashcards(
    limit: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
) -> list[Flashcard]:
    """Get flashcards due for review, sorted by next_review ascending."""
    due_cards = await mongodb_service.get_flashcards(
        due_only=True,
        user_id=current_user,
        limit=limit,
    )

    return [Flashcard(**f) for f in due_cards]


# =============================================================================
# Progress / Recommendations / Stats
# =============================================================================

@router.get("/user/progress")
async def get_progress(current_user: str = Depends(get_current_user)) -> dict:
    """Get user learning progress."""
    progress = await mongodb_service.get_or_create_progress(current_user)
    recent_results = await mongodb_service.get_user_quiz_results(current_user, limit=10)

    analysis = adaptive_learning.analyze_strengths_weaknesses(
        recent_results,
        progress.get("subject_distribution", {}),
    )

    return {
        **progress,
        "analysis": analysis,
    }


@router.get("/user/recommendations")
async def get_recommendations(current_user: str = Depends(get_current_user)) -> dict:
    """Get personalized learning recommendations."""
    progress = await mongodb_service.get_or_create_progress(current_user)
    # Only the fields the recommendation engine reads — not the full documents
    all_notes = await mongodb_service.get_user_notes(
        current_user, limit=100,
        projection={"subject": 1, "updated_at": 1, "created_at": 1},
    )
    due_flashcards = await mongodb_service.get_flashcards(
        due_only=True, user_id=current_user,
        projection={"note_id": 1, "next_review": 1},
    )

    recommendations = adaptive_learning.get_daily_recommendations(
        progress,
        all_notes,
        due_flashcards,
    )

    return {
        "recommendations": recommendations,
        "focus_areas": progress.get("weak_areas", []),
        "suggested_difficulty": progress.get("cognitive_level", "beginner"),
    }


@router.get("/stats")
async def get_stats(current_user: str = Depends(get_current_user)) -> dict:
    """Get user statistics — counts and averages computed DB-side over ALL
    documents (no fetch limit)."""
    import asyncio as _aio
    progress, total_notes, quiz_stats, notes_subject_dist, total_fc, due_fc = await _aio.gather(
        mongodb_service.get_or_create_progress(current_user),
        mongodb_service.count_user_notes(current_user),
        mongodb_service.get_user_quiz_stats(current_user),
        mongodb_service.get_user_subject_distribution(current_user),
        mongodb_service.count_flashcards(user_id=current_user),
        mongodb_service.count_flashcards(user_id=current_user, due_only=True),
    )
    subject_dist = progress.get("subject_distribution") or notes_subject_dist

    return {
        "total_notes": total_notes,
        "total_quizzes": quiz_stats["count"],
        "total_flashcards": total_fc,
        "flashcards_due_count": due_fc,
        "average_score": quiz_stats["average_score"],
        "study_streak": progress.get("study_streak", 0),
        "subject_distribution": subject_dist,
        "recent_activity": progress.get("last_activity"),
    }
