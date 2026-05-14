

"""API Routes for AI Academic Cognitive Assistant."""

import logging
import statistics
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.schemas import (
    Capture,
    CaptureUpdate,
    CognitiveLevel,
    CourseSession,
    CourseSessionCreate,
    Flashcard,
    FlashcardReview,
    Note,
    NoteListItem,
    ProcessingResult,
    Quiz,
    QuizResult,
    QuizSubmission,
    SearchRequest,
    SearchResult,
    SessionStatus,
    SubjectCategory,
    SummaryRequest,
    SummaryResponse,
    User,
    UserCreate,
    UserUpdateSchema,
    PasswordChangeSchema,
)
from app.services.adaptive_learning import adaptive_learning
from app.services.llm_service import llm_service
from app.services.mongodb_service import mongodb_service
from app.services.pipeline import pipeline
from app.services.rag_service import rag_service

logger = logging.getLogger("aaca")
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


# =============================================================================
# Authentication Routes
# =============================================================================

@router.post("/auth/register", response_model=dict, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserCreate) -> dict:
    """Register a new user. Requires explicit privacy consent."""
    if not user_data.privacy_consent:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le consentement à la politique de confidentialité est obligatoire.",
        )

    existing = await mongodb_service.get_user_by_email(user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_dict = user_data.model_dump()
    user_dict["password_hash"] = get_password_hash(user_dict.pop("password"))
    user_dict["privacy_consent_at"] = datetime.now(timezone.utc)

    user_id = await mongodb_service.create_user(user_dict)

    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})

    return {
        "user_id": user_id,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, email: str = Form(...), password: str = Form(...)) -> dict:
    """Login user and return tokens."""
    user = await mongodb_service.get_user_by_email(email)
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user_id = user["id"]
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})

    return {
        "user_id": user_id,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "full_name": user["full_name"],
            "cognitive_level": user.get("cognitive_level", "beginner"),
        },
    }

class RefreshRequest(BaseModel):
    refresh_token: str

class NoteFromTextRequest(BaseModel):
    raw_text: str
    title: str | None = None
    subject_hint: str | None = None

class AskNoteRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)

@router.post("/auth/refresh")
async def refresh_token_endpoint(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid token payload")
    new_access = create_access_token({"sub": user_id})
    return {"access_token": new_access, "token_type": "bearer"}


# =============================================================================
# Processing Routes
# =============================================================================

@router.post("/process/ocr-only")
@limiter.limit("10/minute")
async def ocr_only(
    request: Request,
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),
) -> dict:
    """Run OCR only — no AI generation. Returns raw text for user correction."""
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")
    ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    from app.services.image_processor import image_processor
    from app.services.ocr_service import ocr_service as _ocr

    processed, _ = await image_processor.preprocess(
        contents, perspective_correction=True, enhance_contrast=True, denoise=True,
    )
    result = await _ocr.extract_text(processed, detect_formulas=True)
    return {
        "raw_text": result.get("text", ""),
        "confidence": result.get("average_confidence", 1.0),
    }

@router.post("/process/image", response_model=ProcessingResult)
@limiter.limit("10/minute")
async def process_image(
    request: Request,
    file: UploadFile = File(...),
    perspective_correction: bool = Form(True),
    enhance_image: bool = Form(True),
    subject_hint: SubjectCategory | None = Form(None),
    generate_summary: bool = Form(True),
    generate_quiz: bool = Form(True),
    current_user: str = Depends(get_current_user),
) -> ProcessingResult:
    """Process an image through the complete AI pipeline."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, f"File too large. Max: {settings.MAX_UPLOAD_SIZE} bytes")

    ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    options = {
        "perspective_correction": perspective_correction,
        "enhance_image": enhance_image,
        "subject_hint": subject_hint.value if subject_hint else None,
        "generate_summary": generate_summary,
        "generate_quiz": generate_quiz,
    }

    result = await pipeline.process_image(contents, options)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Processing failed"),
        )

    return ProcessingResult(
        success=result["success"],
        processing_time=result["processing_time"],
        raw_text=result["raw_text"],
        corrected_text=result["corrected_text"],
        latex_formulas=result.get("latex_formulas", []),
        detected_subject=result["detected_subject"],
        confidence_score=result["subject_confidence"],
    )


@router.post("/process/capture")
@limiter.limit("10/minute")
async def capture_and_process(
    request: Request,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    tags: str | None = Form(None),
    subject_hint: SubjectCategory | None = Form(None),
    current_user: str = Depends(get_current_user),
) -> dict:
    """Capture, process, and save a note in one step."""
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, f"File too large. Max: {settings.MAX_UPLOAD_SIZE} bytes")

    ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    options = {
        "perspective_correction": True,
        "enhance_image": True,
        "subject_hint": subject_hint.value if subject_hint else None,
        "generate_summary": True,
        "generate_quiz": True,
    }

    result = await pipeline.process_image(contents, options)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Processing failed"),
        )

    # Create note first to get a real note_id
    note_data = {
        "user_id": current_user,
        "title": title or result["structured_content"].get("title", "Untitled Note"),
        "subject": result["detected_subject"],
        "tags": tags.split(",") if tags else [],
        "original_image_url": None,   # filled in after image upload
        "processed_content": result["structured_content"],
        "raw_text": result["raw_text"],
        "summary": result.get("summary", {}).get("summary", ""),
        "latex_formulas": result.get("latex_formulas", []),
        "cognitive_level": "intermediate",
        "processing_metadata": {
            "processing_time": result["processing_time"],
            "ocr_confidence": result.get("steps", {}).get("ocr", {}).get("confidence"),
            "subject_confidence": result["subject_confidence"],
        },
    }

    note_id = await mongodb_service.create_note(note_data)

    # Save image with real note_id in GridFS metadata
    image_url = await mongodb_service.upload_image(
        current_user,
        note_id,
        contents,
        file.filename or "capture.png",
    )
    await mongodb_service.update_note(note_id, {"original_image_url": image_url})

    if result.get("corrected_text", "").strip():
        try:
            await rag_service.index_note(
                user_id=current_user,
                note_id=note_id,
                text=result["corrected_text"],
                metadata={
                    "subject": result.get("detected_subject", "other"),
                    "title": result["structured_content"].get("title", "Untitled"),
                },
            )
        except Exception as e:
            logger.warning(f"RAG indexing failed: {e}")

    # Create quiz if generated by pipeline
    quiz_id = None
    if result.get("quiz"):
        quiz_data = result["quiz"]
        quiz_data["note_id"] = note_id
        quiz_data["user_id"] = current_user
        quiz_id = await mongodb_service.create_quiz(quiz_data)
        await mongodb_service.update_note(note_id, {"quizzes": [quiz_id]})

    # Use flashcards already generated by pipeline (avoid double LLM call)
    flashcards = result.get("flashcards") or []
    if flashcards:
        flashcard_ids = await mongodb_service.create_flashcards(note_id, flashcards, current_user)
        await mongodb_service.update_note(note_id, {"flashcards": flashcard_ids})

    # Update user progress
    progress = await mongodb_service.get_or_create_progress(current_user)
    await mongodb_service.update_progress(
        current_user,
        {
            "total_notes": progress.get("total_notes", 0) + 1,
            "last_activity": datetime.now(),
        },
    )

    return {
        "note_id": note_id,
        "quiz_id": quiz_id,
        "flashcards_count": len(flashcards),
        "processing_time": result["processing_time"],
        "detected_subject": result.get("detected_subject"),
        "title": result["structured_content"].get("title", "Untitled Note"),
    }


# =============================================================================
# Note Routes
# =============================================================================

@router.post("/notes/from-text")
async def create_note_from_text(
    data: NoteFromTextRequest,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Create and save a note from user-corrected OCR text (skips image processing)."""
    import time
    if not data.raw_text.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Text cannot be empty")

    start_time = time.time()
    options = {
        "subject_hint": data.subject_hint,
        "generate_summary": True,
        "generate_quiz": True,
        "generate_flashcards": True,
    }
    post_ocr = await pipeline._run_post_ocr_steps(data.raw_text, [], options, start_time)

    note_data: dict[str, Any] = {
        "user_id": current_user,
        "title": data.title or post_ocr["structured_content"].get("title", "Untitled"),
        "subject": post_ocr["detected_subject"],
        "tags": [],
        "processed_content": post_ocr["structured_content"],
        "raw_text": data.raw_text,
        "summary": (post_ocr.get("summary") or {}).get("summary", ""),
        "latex_formulas": [],
        "cognitive_level": "intermediate",
        "processing_metadata": {
            "processing_time": round(time.time() - start_time, 2),
            "subject_confidence": post_ocr["subject_confidence"],
        },
    }
    note_id = await mongodb_service.create_note(note_data)

    try:
        await rag_service.index_note(
            user_id=current_user, note_id=note_id, text=data.raw_text,
            metadata={"subject": post_ocr.get("detected_subject", "other"), "title": note_data["title"]},
        )
    except Exception as e:
        logger.warning(f"RAG indexing failed: {e}")

    quiz_id = None
    if (post_ocr.get("quiz") or {}).get("questions"):
        quiz_data = post_ocr["quiz"]
        quiz_data["note_id"] = note_id
        quiz_data["user_id"] = current_user
        quiz_id = await mongodb_service.create_quiz(quiz_data)
        quiz_data.pop("_id", None)
        await mongodb_service.update_note(note_id, {"quizzes": [quiz_id]})

    flashcards = post_ocr.get("flashcards") or []
    if flashcards:
        fc_ids = await mongodb_service.create_flashcards(note_id, flashcards, current_user)
        await mongodb_service.update_note(note_id, {"flashcards": fc_ids})

    progress = await mongodb_service.get_or_create_progress(current_user)
    await mongodb_service.update_progress(current_user, {
        "total_notes": progress.get("total_notes", 0) + 1,
        "last_activity": datetime.now(),
    })

    return {
        "note_id": note_id,
        "quiz_id": quiz_id,
        "flashcards_count": len(flashcards),
        "detected_subject": post_ocr["detected_subject"],
        "title": note_data["title"],
        "processing_time": round(time.time() - start_time, 2),
    }


async def _get_owned_note(note_id: str, current_user: str) -> dict:
    note = await mongodb_service.get_note(note_id)
    if not note or note["user_id"] != current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
    return note

@router.get("/notes", response_model=list[NoteListItem])
async def list_notes(
    subject: SubjectCategory | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user),
) -> list[NoteListItem]:
    """List user's notes with optional filtering."""
    notes = await mongodb_service.get_user_notes(
        current_user,
        subject=subject.value if subject else None,
        limit=limit,
        offset=offset,
    )

    return [
        NoteListItem(
            id=n["id"],
            title=n["title"],
            subject=n["subject"],
            preview=n["raw_text"][:200] + "..." if len(n["raw_text"]) > 200 else n["raw_text"],
            created_at=n["created_at"],
            thumbnail_url=n.get("original_image_url"),
        )
        for n in notes
    ]


@router.get("/notes/{note_id}", response_model=Note)
async def get_note(
    note_id: str,
    current_user: str = Depends(get_current_user),
) -> Note:
    """Get a specific note by ID."""
    note = await _get_owned_note(note_id, current_user)
    return Note(**note)


@router.post("/notes/{note_id}/ask")
async def ask_note(
    note_id: str,
    body: AskNoteRequest,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Answer a question about a note using RAG (falls back to direct LLM)."""
    note = await _get_owned_note(note_id, current_user)
    try:
        return await rag_service.answer_question(
            user_id=current_user,
            question=body.question,
            note_id=note_id,
        )
    except Exception:
        response = await llm_service._call_llm(
            prompt=f"Question: {body.question}\n\nContenu du cours:\n{note['raw_text'][:4000]}",
            system_prompt=(
                "Tu es un assistant pédagogique expert et rigoureux. "
                "Réponds à la question en te basant uniquement sur le contenu fourni. "
                "Si la réponse n'est pas dans le contenu, dis-le clairement.\n\n"
                "RÈGLES DE FORMATAGE STRICTES :\n"
                "- Toute expression ou symbole mathématique, même simple (ex: x, α, n²), "
                "doit être écrit en LaTeX inline : \\(expression\\)\n"
                "- Toute formule ou équation importante doit être mise en bloc display : "
                "\\[formule\\]\n"
                "- Utilise **texte** pour les termes importants ou titres de sections.\n"
                "- Ne mélange jamais du texte mathématique brut avec du texte normal : "
                "chaque symbole math doit être dans \\(...\\) ou \\[...\\].\n"
                "- Sois précis, structuré, et pédagogique."
            ),
            temperature=0.3,
        )
        return {"answer": response["content"], "sources": [], "question": body.question}


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Delete a note and cascade-delete all related data."""
    note = await _get_owned_note(note_id, current_user)

    # 1. Delete quiz results for all quizzes attached to this note
    quiz_ids: list[str] = note.get("quizzes") or []
    if quiz_ids:
        await mongodb_service.delete_quiz_results_by_quiz_ids(quiz_ids)

    # 2. Delete quizzes and flashcards
    await mongodb_service.delete_quizzes_by_note(note_id)
    await mongodb_service.delete_flashcards_by_note(note_id)

    # 3. Delete main note document
    await mongodb_service.delete_note(note_id)

    # 4. Remove from RAG index
    try:
        rag_service.remove_note(current_user, note_id)
    except Exception as e:
        logger.warning(f"RAG remove_note failed: {e}")

    # 5. Delete image from GridFS if applicable
    image_url: str | None = note.get("original_image_url")
    if image_url and image_url.startswith("/images/"):
        file_id = image_url.removeprefix("/images/")
        try:
            await mongodb_service.delete_image_from_gridfs(file_id)
        except Exception as e:
            logger.warning(f"GridFS image delete failed: {e}")

    # 6. If note belongs to a session, clear the session's final_note_id
    session_id: str | None = note.get("session_id")
    if session_id:
        try:
            await mongodb_service.update_session(session_id, {"final_note_id": None, "status": "processing"})
        except Exception as e:
            logger.warning(f"Session cleanup after note delete failed: {e}")

    return {"message": "Note deleted successfully"}


@router.patch("/notes/{note_id}")
async def update_note(
    note_id: str,
    update_data: dict,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Update a note's metadata."""
    await _get_owned_note(note_id, current_user)

    allowed_fields = ["title", "subject", "tags", "cognitive_level"]
    filtered_data = {k: v for k, v in update_data.items() if k in allowed_fields}

    await mongodb_service.update_note(note_id, filtered_data)

    updated_note = await mongodb_service.get_note(note_id)
    return updated_note


@router.post("/notes/{note_id}/summary", response_model=SummaryResponse)
async def generate_note_summary(
    note_id: str,
    request: SummaryRequest,
    current_user: str = Depends(get_current_user),
) -> SummaryResponse:
    """Generate a new summary for a note."""
    note = await _get_owned_note(note_id, current_user)

    summary_data = await llm_service.generate_summary(
        note["raw_text"],
        summary_type=request.summary_type,
        target_level=request.target_level or note.get("cognitive_level"),
        max_length=request.max_length,
    )

    await mongodb_service.update_note(note_id, {"summary": summary_data["summary"]})

    return SummaryResponse(
        content_id=note_id,
        summary=summary_data["summary"],
        key_points=summary_data.get("key_points", []),
        reading_time=summary_data.get("reading_time", 5),
    )


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

    quiz_data = await llm_service.generate_quiz(
        note["raw_text"],
        num_questions=num_questions,
        difficulty=difficulty.value,
    )

    quiz_data["note_id"] = note_id
    quiz_data["user_id"] = current_user

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

    # Calculate score
    questions = {q["id"]: q for q in quiz["questions"]}
    correct = 0
    total_points = 0
    earned_points = 0
    detailed_feedback = []

    for answer in submission.answers:
        question = questions.get(answer.question_id)
        if question:
            is_correct = answer.answer.lower().strip() == question["correct_answer"].lower().strip()
            points = question.get("points", 1)
            total_points += points

            if is_correct:
                correct += 1
                earned_points += points

            detailed_feedback.append({
                "question_id": answer.question_id,
                "is_correct": is_correct,
                "correct_answer": question["correct_answer"],
                "user_answer": answer.answer,
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
        incorrect_answers=len(submission.answers) - correct,
        time_taken=(submission.completed_at - submission.started_at).seconds,
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
# Search Routes
# =============================================================================

@router.post("/search", response_model=SearchResult)
async def search_notes(
    request: SearchRequest,
    current_user: str = Depends(get_current_user),
) -> SearchResult:
    """Search notes by content."""
    results = await mongodb_service.search_notes(
        current_user,
        request.query,
        filters=request.filters,
    )

    return SearchResult(
        notes=[
            NoteListItem(
                id=r["id"],
                title=r["title"],
                subject=r["subject"],
                preview=r["raw_text"][:200] + "..." if len(r["raw_text"]) > 200 else r["raw_text"],
                created_at=r["created_at"],
                thumbnail_url=r.get("original_image_url"),
            )
            for r in results
        ],
        total=len(results),
        query=request.query,
    )


# =============================================================================
# User & Progress Routes
# =============================================================================

@router.get("/user/me", response_model=User)
async def get_me(current_user: str = Depends(get_current_user)) -> User:
    """Get current user profile."""
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return User(**user)




@router.patch("/user/me")
async def update_profile(data: UserUpdateSchema,
                         current_user: str = Depends(get_current_user)):
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(404, "User not found")
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if update:
        await mongodb_service.update_user(current_user, update)
    return {"message": "Profile updated"}

@router.patch("/user/password")
async def change_password(data: PasswordChangeSchema,
                          current_user: str = Depends(get_current_user)):
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(404, "User not found")
    if not verify_password(data.current_password, user.get("password_hash", "")):
        raise HTTPException(400, "Current password is incorrect")
    await mongodb_service.update_user(current_user,
        {"password_hash": get_password_hash(data.new_password)})
    return {"message": "Password updated"}


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
    all_notes = await mongodb_service.get_user_notes(current_user, limit=100)
    due_flashcards = await mongodb_service.get_flashcards(due_only=True, user_id=current_user)

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


# =============================================================================
# Utility Routes
# =============================================================================

@router.get("/subjects")
async def get_subjects() -> dict:
    """Get available subject categories."""
    return {
        "subjects": [
            {"id": s.value, "name": s.value.replace("_", " ").title()}
            for s in SubjectCategory
        ]
    }


# =============================================================================
# Course Session Routes  (multi-image capture flow)
# =============================================================================

async def _get_owned_session(session_id: str, current_user: str) -> dict:
    session = await mongodb_service.get_session(session_id)
    if not session or session["user_id"] != current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.post("/sessions", response_model=CourseSession, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CourseSessionCreate,
    current_user: str = Depends(get_current_user),
) -> CourseSession:
    """Create a new course session."""
    session_data = {
        "user_id": current_user,
        "title": body.title,
        "subject": body.subject.value if body.subject else None,
        "date": body.date or datetime.now(),
        "status": SessionStatus.DRAFT.value,
        "capture_ids": [],
        "final_note_id": None,
    }
    session_id = await mongodb_service.create_session(session_data)
    session = await mongodb_service.get_session(session_id)
    return CourseSession(**session)


@router.get("/sessions", response_model=list[CourseSession])
async def list_sessions(
    current_user: str = Depends(get_current_user),
) -> list[CourseSession]:
    """List all sessions for the current user."""
    sessions = await mongodb_service.get_user_sessions(current_user)
    return [CourseSession(**s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=CourseSession)
async def get_session(
    session_id: str,
    current_user: str = Depends(get_current_user),
) -> CourseSession:
    """Get a session by ID."""
    session = await _get_owned_session(session_id, current_user)
    return CourseSession(**session)


@router.post("/sessions/{session_id}/captures/ocr", response_model=Capture)
@limiter.limit("20/minute")
async def add_capture(
    request: Request,
    session_id: str,
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),
) -> Capture:
    """Upload a photo to an open session: run OCR and store the capture."""
    session = await _get_owned_session(session_id, current_user)
    if session["status"] == SessionStatus.COMPLETED.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already finalized")

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")
    ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    from app.services.image_processor import image_processor
    from app.services.ocr_service import ocr_service as _ocr

    processed, _ = await image_processor.preprocess(
        contents, perspective_correction=True, enhance_contrast=True, denoise=True,
    )
    ocr_result = await _ocr.extract_text(processed, detect_formulas=True)

    image_url = await mongodb_service.upload_image(
        current_user, session_id, contents, file.filename or "capture.png"
    )

    order = len(session.get("capture_ids", []))
    capture_data = {
        "session_id": session_id,
        "user_id": current_user,
        "order": order,
        "image_url": image_url,
        "raw_text": ocr_result.get("text", ""),
        "corrected_text": ocr_result.get("text", ""),
        "confidence": ocr_result.get("average_confidence", 0.0),
        "formulas": ocr_result.get("formulas", []),
    }
    capture_id = await mongodb_service.create_capture(capture_data)

    # Append capture_id to session
    new_ids = session.get("capture_ids", []) + [capture_id]
    await mongodb_service.update_session(session_id, {
        "capture_ids": new_ids,
        "status": SessionStatus.PROCESSING.value,
    })

    capture = await mongodb_service.get_capture(capture_id)
    return Capture(**capture)


@router.patch("/sessions/{session_id}/captures/{capture_id}", response_model=Capture)
async def update_capture_text(
    session_id: str,
    capture_id: str,
    body: CaptureUpdate,
    current_user: str = Depends(get_current_user),
) -> Capture:
    """Update the corrected text of a capture (user manual correction)."""
    await _get_owned_session(session_id, current_user)
    capture = await mongodb_service.get_capture(capture_id)
    if not capture or capture["session_id"] != session_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capture not found")

    await mongodb_service.update_capture(capture_id, {"corrected_text": body.corrected_text})
    updated = await mongodb_service.get_capture(capture_id)
    return Capture(**updated)


@router.delete("/sessions/{session_id}/captures/{capture_id}", response_model=dict)
async def delete_capture(
    session_id: str,
    capture_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Delete a capture from a session and re-index remaining captures."""
    session = await _get_owned_session(session_id, current_user)
    if session["status"] == SessionStatus.COMPLETED.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot modify a completed session")

    capture = await mongodb_service.get_capture(capture_id)
    if not capture:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capture not found")
    if capture["session_id"] != session_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capture does not belong to this session")

    deleted = await mongodb_service.delete_capture(capture_id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capture not found")

    # Remove capture_id from session.capture_ids
    new_ids = [cid for cid in session.get("capture_ids", []) if cid != capture_id]
    await mongodb_service.update_session(session_id, {"capture_ids": new_ids})

    # Re-index remaining captures so order stays contiguous
    await mongodb_service.reindex_session_captures(session_id)

    return {"deleted": True}


@router.post("/sessions/{session_id}/finalize")
async def finalize_session(
    session_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Merge all captures in the session into a single note."""
    session = await _get_owned_session(session_id, current_user)
    if session["status"] == SessionStatus.COMPLETED.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already finalized")

    captures = await mongodb_service.get_session_captures(session_id)
    if not captures:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No captures in session")

    subject = session.get("subject")
    structured = await llm_service.merge_captures_to_course(captures, subject)

    merged_text = "\n\n".join(
        (c.get("corrected_text") or c.get("raw_text") or "") for c in captures
    ).strip()

    summary_data = await llm_service.generate_summary(merged_text, summary_type="detailed")

    note_data: dict[str, Any] = {
        "user_id": current_user,
        "session_id": session_id,
        "title": session["title"] or structured.get("title", "Untitled"),
        "subject": structured.get("subject_category") or subject or "other",
        "tags": [],
        "processed_content": structured,
        "raw_text": merged_text,
        "summary": (summary_data or {}).get("summary", ""),
        "latex_formulas": structured.get("formulas", []),
        "cognitive_level": "intermediate",
        "processing_metadata": {"source": "course_session", "capture_count": len(captures)},
    }
    note_id = await mongodb_service.create_note(note_data)

    # Generate quiz (QCM only)
    quiz_id = None
    try:
        quiz_data = await llm_service.generate_quiz(merged_text, quiz_types=["qcm"])
        if quiz_data.get("questions"):
            quiz_data["note_id"] = note_id
            quiz_data["user_id"] = current_user
            quiz_id = await mongodb_service.create_quiz(quiz_data)
            await mongodb_service.update_note(note_id, {"quizzes": [quiz_id]})
    except Exception as e:
        logger.warning(f"Quiz generation failed during finalize: {e}")

    # Generate flashcards
    flashcard_ids: list[str] = []
    try:
        flashcards = await llm_service.generate_flashcards(merged_text)
        if flashcards:
            flashcard_ids = await mongodb_service.create_flashcards(note_id, flashcards, current_user)
            await mongodb_service.update_note(note_id, {"flashcards": flashcard_ids})
    except Exception as e:
        logger.warning(f"Flashcard generation failed during finalize: {e}")

    try:
        await rag_service.index_note(
            user_id=current_user, note_id=note_id, text=merged_text,
            metadata={"subject": note_data["subject"], "title": note_data["title"]},
        )
    except Exception as e:
        logger.warning(f"RAG indexing failed during finalize: {e}")

    await mongodb_service.update_session(session_id, {
        "status": SessionStatus.COMPLETED.value,
        "final_note_id": note_id,
    })

    progress = await mongodb_service.get_or_create_progress(current_user)
    await mongodb_service.update_progress(current_user, {
        "total_notes": progress.get("total_notes", 0) + 1,
        "last_activity": datetime.now(),
    })

    return {
        "note_id": note_id,
        "quiz_id": quiz_id,
        "flashcards_count": len(flashcard_ids),
        "capture_count": len(captures),
        "title": note_data["title"],
    }


# =============================================================================
# Privacy / RGPD Routes
# =============================================================================

@router.get("/privacy/export")
async def export_user_data(current_user: str = Depends(get_current_user)) -> dict:
    """Export all personal data for the authenticated user (GDPR Art. 20)."""
    data = await mongodb_service.get_user_all_data(current_user)
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user,
        "data": data,
    }


@router.delete("/privacy/account", status_code=status.HTTP_200_OK)
async def delete_account(current_user: str = Depends(get_current_user)) -> dict:
    """Permanently delete the authenticated user's account and all associated data (GDPR Art. 17)."""
    summary = await mongodb_service.delete_user_all_data(current_user)
    return {
        "deleted": True,
        "user_id": current_user,
        "summary": summary,
    }


@router.get("/stats")
async def get_stats(current_user: str = Depends(get_current_user)) -> dict:
    """Get user statistics."""
    import asyncio as _aio
    progress, notes, quiz_results, total_fc, due_fc = await _aio.gather(
        mongodb_service.get_or_create_progress(current_user),
        mongodb_service.get_user_notes(current_user),
        mongodb_service.get_user_quiz_results(current_user),
        mongodb_service.count_flashcards(user_id=current_user),
        mongodb_service.count_flashcards(user_id=current_user, due_only=True),
    )
    subject_dist = progress.get("subject_distribution") or {}
    if not subject_dist and notes:
        for note in notes:
            subj = note.get("subject") or "other"
            subject_dist[subj] = subject_dist.get(subj, 0) + 1

    return {
        "total_notes": len(notes),
        "total_quizzes": len(quiz_results),
        "total_flashcards": total_fc,
        "flashcards_due_count": due_fc,
        "average_score": round(statistics.mean([r["score"] for r in quiz_results]), 1) if quiz_results else 0,
        "study_streak": progress.get("study_streak", 0),
        "subject_distribution": subject_dist,
        "recent_activity": progress.get("last_activity"),
    }
