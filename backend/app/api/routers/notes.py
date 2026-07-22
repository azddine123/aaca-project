"""Note routes: OCR/AI processing, note CRUD, Q&A (RAG) and search."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.models.schemas import (
    Note,
    NoteListItem,
    NoteSubjectUpdate,
    ProcessingResult,
    SearchRequest,
    SearchResult,
    SubjectCategory,
    SummaryRequest,
    SummaryResponse,
)
from app.api.routers.common import (
    _check_note_quota,
    _get_owned_note,
    _get_user_content_language,
    _owned_image_url_or_none,
    _validate_image_upload,
    limiter,
)
from app.services.llm_service import llm_service
from app.services.mongodb_service import mongodb_service
from app.services.note_creation import persist_note_artifacts, resolve_user_subject
from app.services.pipeline import pipeline
from app.services.rag_service import rag_service

logger = logging.getLogger("aaca")
router = APIRouter(tags=["notes"])


class NoteFromTextRequest(BaseModel):
    raw_text: str
    title: str | None = None
    subject_hint: str | None = None
    selected_subject_id: str | None = None  # explicit user subject choice
    original_image_url: str | None = None
    processed_image_url: str | None = None


class AskNoteRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


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
    _validate_image_upload(contents, file.content_type)

    from app.services.image_processor import image_processor
    from app.services.ocr_service import ocr_service as _ocr

    processed, _ = await image_processor.preprocess(
        contents, perspective_correction=True, enhance_contrast=True, denoise=True,
    )
    result = await _ocr.extract_text(processed, detect_formulas=True)

    original_image_url: str | None = None
    processed_image_url: str | None = None
    try:
        import uuid

        pending_ref = f"pending-{uuid.uuid4().hex}"
        original_image_url = await mongodb_service.upload_image(
            current_user,
            pending_ref,
            contents,
            file.filename or "capture.png",
            image_type="original",
        )
        processed_image_url = await mongodb_service.upload_image(
            current_user,
            pending_ref,
            processed,
            "processed_capture.png",
            image_type="processed",
        )
    except Exception as e:
        logger.warning(f"OCR image persistence failed: {e}")

    return {
        "raw_text": result.get("text", ""),
        "confidence": result.get("average_confidence", 1.0),
        "original_image_url": original_image_url,
        "processed_image_url": processed_image_url,
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
    contents = await file.read()
    _validate_image_upload(contents, file.content_type)

    target_language = await _get_user_content_language(current_user)
    options = {
        "perspective_correction": perspective_correction,
        "enhance_image": enhance_image,
        "subject_hint": subject_hint.value if subject_hint else None,
        "generate_summary": generate_summary,
        "generate_quiz": generate_quiz,
        "target_language": target_language,
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
    await _check_note_quota(current_user)
    contents = await file.read()
    _validate_image_upload(contents, file.content_type)

    target_language = await _get_user_content_language(current_user)
    options = {
        "perspective_correction": True,
        "enhance_image": True,
        "subject_hint": subject_hint.value if subject_hint else None,
        "generate_summary": True,
        "generate_quiz": True,
        "target_language": target_language,
    }

    result = await pipeline.process_image(contents, options)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Processing failed"),
        )

    # Resolve user-owned subject from AI classification
    subj_id, subj_name, subj_src = await resolve_user_subject(
        result["detected_subject"], result["subject_confidence"], current_user
    )
    # If caller provided an explicit subject hint as a user subject_id, honour it
    if subject_hint:
        hint_subj = await mongodb_service.get_user_subject_by_name(current_user, subject_hint.value)
        if hint_subj:
            subj_id, subj_name, subj_src = hint_subj["id"], hint_subj["name"], "user_selected"

    note_data = {
        "user_id": current_user,
        "title": title or result["structured_content"].get("title", "Untitled Note"),
        "subject": result["detected_subject"],
        "subject_id": subj_id,
        "subject_name": subj_name,
        "subject_confidence": result["subject_confidence"],
        "subject_source": subj_src,
        "tags": tags.split(",") if tags else [],
        "original_image_url": None,   # filled in after image upload
        "content_language": target_language,
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

    persisted = await persist_note_artifacts(
        user_id=current_user,
        note_data=note_data,
        quiz_data=result.get("quiz"),
        flashcards=result.get("flashcards") or [],
        index_text=result.get("corrected_text", ""),
        target_language=target_language,
    )
    note_id = persisted["note_id"]

    # Save original image with real note_id in GridFS metadata
    image_url = await mongodb_service.upload_image(
        current_user,
        note_id,
        contents,
        file.filename or "capture.png",
        image_type="original",
    )
    # Save preprocessed (OCR-optimised) image
    processed_bytes = result.get("processed_image_bytes")
    processed_url: str | None = None
    if processed_bytes:
        try:
            processed_url = await mongodb_service.upload_image(
                current_user,
                note_id,
                processed_bytes,
                "processed_capture.png",
                image_type="processed",
            )
        except Exception as _e:
            logger.warning(f"Processed image upload failed: {_e}")
    await mongodb_service.update_note(note_id, {
        "original_image_url": image_url,
        "processed_image_url": processed_url,
    })

    return {
        "note_id": note_id,
        "quiz_id": persisted["quiz_id"],
        "flashcards_count": len(persisted["flashcard_ids"]),
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
    await _check_note_quota(current_user)
    import time
    if not data.raw_text.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Text cannot be empty")

    start_time = time.time()
    target_language = await _get_user_content_language(current_user)
    options = {
        "subject_hint": data.subject_hint,
        "generate_summary": True,
        "generate_quiz": True,
        "generate_flashcards": True,
        "target_language": target_language,
    }
    post_ocr = await pipeline._run_post_ocr_steps(data.raw_text, [], options, start_time)

    # Resolve user-owned subject (or use explicit selection)
    subj_id, subj_name, subj_src = await resolve_user_subject(
        post_ocr["detected_subject"], post_ocr["subject_confidence"], current_user
    )
    if data.selected_subject_id:
        explicit = await mongodb_service.get_subject(data.selected_subject_id)
        if explicit and explicit["user_id"] == current_user:
            subj_id, subj_name, subj_src = explicit["id"], explicit["name"], "user_selected"

    original_image_url = await _owned_image_url_or_none(data.original_image_url, current_user)
    processed_image_url = await _owned_image_url_or_none(data.processed_image_url, current_user)

    note_data: dict[str, Any] = {
        "user_id": current_user,
        "title": data.title or post_ocr["structured_content"].get("title", "Untitled"),
        "subject": post_ocr["detected_subject"],
        "subject_id": subj_id,
        "subject_name": subj_name,
        "subject_confidence": post_ocr["subject_confidence"],
        "subject_source": subj_src,
        "tags": [],
        "original_image_url": original_image_url,
        "processed_image_url": processed_image_url,
        "content_language": target_language,
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

    persisted = await persist_note_artifacts(
        user_id=current_user,
        note_data=note_data,
        quiz_data=post_ocr.get("quiz"),
        flashcards=post_ocr.get("flashcards") or [],
        index_text=data.raw_text,
        target_language=target_language,
    )

    return {
        "note_id": persisted["note_id"],
        "quiz_id": persisted["quiz_id"],
        "flashcards_count": len(persisted["flashcard_ids"]),
        "detected_subject": post_ocr["detected_subject"],
        "title": note_data["title"],
        "processing_time": round(time.time() - start_time, 2),
    }


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
            subject_id=n.get("subject_id"),
            subject_name=n.get("subject_name"),
            subject_source=n.get("subject_source"),
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


@router.get("/notes/{note_id}/images")
async def get_note_images(
    note_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Return all images associated with a note (original + processed).

    For a single-capture note returns type='single'.
    For a session note returns type='session' with one entry per capture per image_type.
    """
    note = await _get_owned_note(note_id, current_user)
    session_id: str | None = note.get("session_id")
    if not session_id:
        produced_by = await mongodb_service.get_session_by_final_note_id(note_id)
        if produced_by and produced_by.get("user_id") == current_user:
            session_id = produced_by.get("id")

    if not session_id:
        images: list[dict] = []
        orig = note.get("original_image_url")
        proc = note.get("processed_image_url")
        if orig:
            images.append({"label": "Image originale", "image_type": "original", "url": orig, "order": 0})
        if proc:
            images.append({"label": "Image traitée", "image_type": "processed", "url": proc, "order": 0})

        # Fallback: note predates URL fields — query GridFS directly by note_id
        if not images:
            gridfs_files = await mongodb_service.get_gridfs_files_for_note(note_id)
            for f in gridfs_files:
                img_type = f["image_type"]
                label = "Image originale" if img_type == "original" else "Image traitée (OCR)"
                images.append({
                    "label": label,
                    "image_type": img_type,
                    "url": f"/images/{f['file_id']}",
                    "order": 0,
                })
            images.sort(key=lambda x: 0 if x["image_type"] == "original" else 1)

        return {"type": "single", "images": images}

    # Session note — verify session ownership before exposing captures
    session = await mongodb_service.get_session(session_id)
    if not session or session["user_id"] != current_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found")

    captures = await mongodb_service.get_session_captures(session_id)
    captures.sort(key=lambda c: c.get("order", 0))

    images = []
    for cap in captures:
        order = cap.get("order", 0)
        cap_id = cap.get("id")
        orig = cap.get("original_image_url") or cap.get("image_url")
        proc = cap.get("processed_image_url")
        if orig:
            images.append({
                "capture_id": cap_id,
                "order": order,
                "label": f"Capture {order + 1} — originale",
                "image_type": "original",
                "url": orig,
            })
        if proc:
            images.append({
                "capture_id": cap_id,
                "order": order,
                "label": f"Capture {order + 1} — traitée",
                "image_type": "processed",
                "url": proc,
            })

    # Fallback for session captures that predate URL fields
    if not images:
        gridfs_files = await mongodb_service.get_gridfs_files_for_note(note_id)
        for f in gridfs_files:
            img_type = f["image_type"]
            label = "Image originale" if img_type == "original" else "Image traitée (OCR)"
            images.append({
                "label": label,
                "image_type": img_type,
                "url": f"/images/{f['file_id']}",
                "order": 0,
            })
        images.sort(key=lambda x: 0 if x["image_type"] == "original" else 1)

    return {"type": "session", "session_id": session_id, "images": images}


@router.post("/notes/{note_id}/ask")
async def ask_note(
    note_id: str,
    body: AskNoteRequest,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Answer a question about a note using RAG (falls back to direct LLM)."""
    note = await _get_owned_note(note_id, current_user)
    target_language = note.get("content_language") or await _get_user_content_language(current_user)
    try:
        return await rag_service.answer_question(
            user_id=current_user,
            question=body.question,
            note_id=note_id,
            target_language=target_language,
        )
    except Exception:
        language_instruction = llm_service.get_language_instruction(target_language)
        response = await llm_service._call_llm(
            prompt=f"Question: {body.question}\n\nContenu du cours:\n{note['raw_text'][:4000]}",
            system_prompt=(
                "Tu es un assistant pédagogique expert et rigoureux. "
                "Réponds à la question en te basant uniquement sur le contenu fourni. "
                "Si la réponse n'est pas dans le contenu, dis-le clairement.\n\n"
                f"{language_instruction}\n\n"
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

    # 5. Delete original image from GridFS if applicable
    image_url: str | None = note.get("original_image_url")
    if image_url and image_url.startswith("/images/"):
        file_id = image_url.removeprefix("/images/")
        try:
            await mongodb_service.delete_image_from_gridfs(file_id)
        except Exception as e:
            logger.warning(f"GridFS image delete failed: {e}")

    # 5b. Delete processed image from GridFS
    proc_image_url: str | None = note.get("processed_image_url")
    if proc_image_url and proc_image_url.startswith("/images/"):
        try:
            await mongodb_service.delete_image_from_gridfs(proc_image_url.removeprefix("/images/"))
        except Exception as e:
            logger.warning(f"GridFS processed image delete failed: {e}")

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
    target_language = note.get("content_language") or await _get_user_content_language(current_user)

    summary_data = await llm_service.generate_summary(
        note["raw_text"],
        summary_type=request.summary_type,
        target_level=request.target_level or note.get("cognitive_level"),
        max_length=request.max_length,
        target_language=target_language,
    )

    await mongodb_service.update_note(note_id, {
        "summary": summary_data["summary"],
        "content_language": target_language,
    })

    return SummaryResponse(
        content_id=note_id,
        summary=summary_data["summary"],
        key_points=summary_data.get("key_points", []),
        reading_time=summary_data.get("reading_time", 5),
    )


@router.patch("/notes/{note_id}/subject")
async def change_note_subject(
    note_id: str,
    data: NoteSubjectUpdate,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Change the subject of a note (manual re-classification)."""
    await _get_owned_note(note_id, current_user)

    subject = await mongodb_service.get_subject(data.subject_id)
    if not subject or subject["user_id"] != current_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Matière non trouvée.")

    await mongodb_service.update_note(note_id, {
        "subject_id": subject["id"],
        "subject_name": subject["name"],
        "subject_source": "manual_changed",
        "subject_confidence": 1.0,
    })

    return {
        "note_id": note_id,
        "subject_id": subject["id"],
        "subject_name": subject["name"],
        "subject_source": "manual_changed",
    }


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
                subject_id=r.get("subject_id"),
                subject_name=r.get("subject_name"),
                subject_source=r.get("subject_source"),
            )
            for r in results
        ],
        total=len(results),
        query=request.query,
    )
