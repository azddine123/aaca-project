"""Course session routes (multi-image capture flow)."""

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.core.security import get_current_user
from app.models.schemas import (
    Capture,
    CaptureUpdate,
    CourseSession,
    CourseSessionCreate,
    SessionStatus,
)
from app.api.routers.common import (
    _check_note_quota,
    _get_owned_session,
    _get_user_content_language,
    _validate_image_upload,
    limiter,
)
from app.services.llm_service import llm_service
from app.services.mongodb_service import mongodb_service
from app.services.note_creation import persist_note_artifacts, resolve_user_subject

logger = logging.getLogger("aaca")
router = APIRouter(tags=["sessions"])


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
    _validate_image_upload(contents, file.content_type)

    from app.services.image_processor import image_processor
    from app.services.ocr_service import ocr_service as _ocr

    processed, _ = await image_processor.preprocess(
        contents, perspective_correction=True, enhance_contrast=True, denoise=True,
    )
    ocr_result = await _ocr.extract_text(processed, detect_formulas=True)

    original_url = await mongodb_service.upload_image(
        current_user, session_id, contents, file.filename or "capture.png",
        session_id=session_id, image_type="original",
    )
    capture_processed_url: str | None = None
    try:
        capture_processed_url = await mongodb_service.upload_image(
            current_user, session_id, processed, "processed_capture.png",
            session_id=session_id, image_type="processed",
        )
    except Exception as _e:
        logger.warning(f"Processed capture image upload failed: {_e}")

    order = len(session.get("capture_ids", []))
    capture_data = {
        "session_id": session_id,
        "user_id": current_user,
        "order": order,
        "image_url": original_url,            # backward compat
        "original_image_url": original_url,
        "processed_image_url": capture_processed_url,
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

    # Delete capture images from GridFS
    for url_key in ("original_image_url", "image_url"):
        orig_url = capture.get(url_key)
        if orig_url and orig_url.startswith("/images/"):
            try:
                await mongodb_service.delete_image_from_gridfs(orig_url.removeprefix("/images/"))
            except Exception as _e:
                logger.warning(f"GridFS original image delete failed for capture: {_e}")
            break
    proc_url = capture.get("processed_image_url")
    if proc_url and proc_url.startswith("/images/"):
        try:
            await mongodb_service.delete_image_from_gridfs(proc_url.removeprefix("/images/"))
        except Exception as _e:
            logger.warning(f"GridFS processed image delete failed for capture: {_e}")

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

    await _check_note_quota(current_user)

    captures = await mongodb_service.get_session_captures(session_id)
    if not captures:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No captures in session")

    subject = session.get("subject")
    target_language = await _get_user_content_language(current_user)
    structured = await llm_service.merge_captures_to_course(
        captures,
        subject,
        target_language=target_language,
    )

    merged_text = "\n\n".join(
        (c.get("corrected_text") or c.get("raw_text") or "") for c in captures
    ).strip()

    summary_data = await llm_service.generate_summary(
        merged_text,
        summary_type="detailed",
        target_language=target_language,
    )

    detected_subject = structured.get("subject_category") or subject or "other"
    # Session notes get a user-owned subject too (was missing before —
    # they ended up without subject_id and never appeared in subject filters)
    subj_id, subj_name, subj_src = await resolve_user_subject(
        detected_subject, 1.0 if subject else 0.6, current_user
    )

    note_data: dict[str, Any] = {
        "user_id": current_user,
        "session_id": session_id,
        "title": session["title"] or structured.get("title", "Untitled"),
        "subject": detected_subject,
        "subject_id": subj_id,
        "subject_name": subj_name,
        "subject_source": subj_src,
        "tags": [],
        "content_language": target_language,
        "processed_content": structured,
        "raw_text": merged_text,
        "summary": (summary_data or {}).get("summary", ""),
        "latex_formulas": structured.get("formulas", []),
        "cognitive_level": "intermediate",
        "processing_metadata": {"source": "course_session", "capture_count": len(captures)},
    }

    # Generate quiz (QCM only) — best effort
    quiz_data: dict[str, Any] | None = None
    try:
        quiz_data = await llm_service.generate_quiz(
            merged_text,
            quiz_types=["qcm"],
            target_language=target_language,
        )
    except Exception as e:
        logger.warning(f"Quiz generation failed during finalize: {e}")

    # Generate flashcards — best effort
    flashcards: list[dict[str, Any]] = []
    try:
        flashcards = await llm_service.generate_flashcards(
            merged_text,
            target_language=target_language,
        ) or []
    except Exception as e:
        logger.warning(f"Flashcard generation failed during finalize: {e}")

    persisted = await persist_note_artifacts(
        user_id=current_user,
        note_data=note_data,
        quiz_data=quiz_data,
        flashcards=flashcards,
        index_text=merged_text,
        target_language=target_language,
    )
    note_id = persisted["note_id"]

    await mongodb_service.update_session(session_id, {
        "status": SessionStatus.COMPLETED.value,
        "final_note_id": note_id,
    })

    return {
        "note_id": note_id,
        "quiz_id": persisted["quiz_id"],
        "flashcards_count": len(persisted["flashcard_ids"]),
        "capture_count": len(captures),
        "title": note_data["title"],
    }
