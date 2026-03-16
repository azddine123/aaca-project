"""Main AI Pipeline Orchestrator.

Coordinates all processing steps from image capture to educational content generation.

Pipeline:
  Image/PDF → Preprocessing → OCR (+ OpenAI Vision fallback if conf < threshold)
  → LaTeX Extraction → Subject Classification → Content Structuring
  → Embedding & Indexing (RAG) → Summary / Quiz / Flashcard Generation
"""

import asyncio
import logging
import time
from typing import Any

from app.services.image_processor import image_processor
from app.services.latex_service import latex_service
from app.services.llm_service import llm_service
from app.services.ocr_service import ocr_service
from app.services.rag_service import rag_service
from app.services.subject_classifier import subject_classifier

logger = logging.getLogger("aaca")


class ProcessingPipeline:
    """Main processing pipeline for academic content extraction."""

    async def process_image(
        self,
        image_bytes: bytes,
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute the complete processing pipeline on an image.

        Args:
            image_bytes: Raw image data.
            options: Processing options:
                - perspective_correction: bool
                - enhance_image: bool
                - subject_hint: str
                - generate_summary: bool
                - generate_quiz: bool
                - generate_flashcards: bool
                - summary_type: "brief" | "detailed" | "bullet_points" | "simplified"
                - num_quiz_questions: int
                - difficulty: str
                - target_level: str
                - user_id: str   — required to enable RAG indexing
                - note_id: str   — required to enable RAG indexing

        Returns:
            Dictionary containing processing results and metadata.
        """
        options = options or {}
        start_time = time.time()

        logger.info("🚀 Starting processing pipeline...")

        result: dict[str, Any] = {
            "success": False,
            "processing_time": 0,
            "steps": {},
            "error": None,
        }

        try:
            # ── Step 1: Image Preprocessing ──────────────────────────────────
            logger.info("📷 Step 1: Image preprocessing...")
            processed_image, preprocessing_meta = await image_processor.preprocess(
                image_bytes,
                perspective_correction=options.get("perspective_correction", True),
                enhance_contrast=options.get("enhance_image", True),
                denoise=True,
            )
            result["steps"]["preprocessing"] = {
                "status": "success",
                "metadata": preprocessing_meta,
            }

            # ── Step 2: OCR Text Extraction ───────────────────────────────────
            logger.info("🔤 Step 2: OCR extraction...")
            ocr_result = await ocr_service.extract_text(
                processed_image,
                detect_formulas=True,
            )
            result["steps"]["ocr"] = {
                "status": "success",
                "engine": ocr_result["engine"],
                "confidence": ocr_result["average_confidence"],
            }

            raw_text = ocr_result["text"]

            # ── Step 3: LaTeX Formula Extraction ─────────────────────────────
            # Skipped when using paddleocr — PPStructureV3 already handles
            # document structure and formula regions.
            from app.core.config import settings

            if settings.OCR_ENGINE == "paddleocr":
                latex_formulas: list = []
                result["steps"]["latex"] = {
                    "status": "skipped",
                    "reason": "PPStructureV3 handles structure",
                }
            else:
                logger.info("📐 Step 3: Formula extraction...")
                formula_regions = image_processor.detect_formula_regions(processed_image)
                latex_formulas = await latex_service.extract_formulas(
                    processed_image,
                    detected_regions=formula_regions,
                )
                result["steps"]["latex"] = {
                    "status": "success",
                    "formulas_found": len(latex_formulas),
                }

            # ── Step 4: Subject Classification ───────────────────────────────
            logger.info("📚 Step 4: Subject classification...")
            subject, confidence = subject_classifier.classify(raw_text, latex_formulas)

            if options.get("subject_hint"):
                subject = options["subject_hint"]
                confidence = 1.0

            result["steps"]["classification"] = {
                "status": "success",
                "subject": subject,
                "confidence": confidence,
            }

            # ── Step 5: Text Correction and Structuring ───────────────────────
            logger.info("📝 Step 5: Content structuring...")
            corrected_text = ocr_service.correct_text(raw_text)

            structured_content: dict[str, Any] = {
                "title": "Untitled",
                "sections": [{"heading": "Content", "content": corrected_text}],
                "definitions": [],
                "examples": [],
                "key_concepts": [],
                "formulas": [],
                "subject_category": subject or "other",
            }
            try:
                structured_content = await llm_service.structure_content(
                    corrected_text, subject_hint=subject,
                )
                result["steps"]["structuring"] = {
                    "status": "success",
                    "title": structured_content.get("title", "Untitled"),
                }
            except Exception as e:
                logger.warning(f"⚠️ Step 5 skipped (LLM unavailable): {e}")
                result["steps"]["structuring"] = {"status": "skipped", "reason": str(e)}

            # ── Step 6: Embedding & RAG Indexing ─────────────────────────────
            user_id = options.get("user_id")
            note_id = options.get("note_id")

            if user_id and note_id and corrected_text.strip():
                logger.info("🧬 Step 6: Embedding & RAG indexing...")
                try:
                    chunks_indexed = await rag_service.index_note(
                        user_id=user_id,
                        note_id=note_id,
                        text=corrected_text,
                        metadata={
                            "subject": subject or "other",
                            "title": structured_content.get("title", "Untitled"),
                        },
                    )
                    result["steps"]["embedding"] = {
                        "status": "success",
                        "chunks_indexed": chunks_indexed,
                    }
                except Exception as e:
                    logger.warning(f"⚠️ Step 6 skipped (embedding unavailable): {e}")
                    result["steps"]["embedding"] = {"status": "skipped", "reason": str(e)}
            else:
                result["steps"]["embedding"] = {
                    "status": "skipped",
                    "reason": "user_id or note_id not provided",
                }

            # ── Step 7: Generate Summary ──────────────────────────────────────
            summary_data = None
            if options.get("generate_summary", True):
                logger.info("📋 Step 7: Generating summary...")
                try:
                    summary_data = await llm_service.generate_summary(
                        corrected_text,
                        summary_type=options.get("summary_type", "detailed"),
                        target_level=options.get("target_level"),
                    )
                    result["steps"]["summary"] = {"status": "success"}
                except Exception as e:
                    logger.warning(f"⚠️ Step 7 skipped (LLM unavailable): {e}")
                    result["steps"]["summary"] = {"status": "skipped"}

            # ── Step 8: Generate Quiz ─────────────────────────────────────────
            quiz_data = None
            if options.get("generate_quiz", True):
                logger.info("❓ Step 8: Generating quiz...")
                try:
                    # Use RAG-powered quiz if the note is indexed, otherwise plain LLM
                    if user_id and note_id and result["steps"].get("embedding", {}).get("status") == "success":
                        quiz_data = await rag_service.generate_quiz_rag(
                            user_id=user_id,
                            note_id=note_id,
                            num_questions=options.get("num_quiz_questions", 5),
                            difficulty=options.get("difficulty", "intermediate"),
                        )
                    else:
                        quiz_data = await llm_service.generate_quiz(
                            corrected_text,
                            num_questions=options.get("num_quiz_questions", 5),
                            difficulty=options.get("difficulty", "intermediate"),
                        )
                    result["steps"]["quiz"] = {
                        "status": "success",
                        "questions_count": len(quiz_data.get("questions", [])),
                    }
                except Exception as e:
                    logger.warning(f"⚠️ Step 8 skipped (LLM unavailable): {e}")
                    result["steps"]["quiz"] = {"status": "skipped"}

            # ── Step 9: Generate Flashcards ───────────────────────────────────
            flashcards_data = None
            if options.get("generate_flashcards", True):
                logger.info("🃏 Step 9: Generating flashcards...")
                try:
                    if user_id and note_id and result["steps"].get("embedding", {}).get("status") == "success":
                        flashcards_data = await rag_service.generate_flashcards_rag(
                            user_id=user_id,
                            note_id=note_id,
                            num_cards=options.get("num_flashcards", 10),
                        )
                    else:
                        flashcards_data = await llm_service.generate_flashcards(
                            corrected_text,
                            num_cards=options.get("num_flashcards", 10),
                        )
                    result["steps"]["flashcards"] = {
                        "status": "success",
                        "cards_count": len(flashcards_data or []),
                    }
                except Exception as e:
                    logger.warning(f"⚠️ Step 9 skipped (LLM unavailable): {e}")
                    result["steps"]["flashcards"] = {"status": "skipped"}

            # ── Finalise ──────────────────────────────────────────────────────
            processing_time = time.time() - start_time

            result.update({
                "success": True,
                "processing_time": round(processing_time, 2),
                "raw_text": raw_text,
                "corrected_text": corrected_text,
                "latex_formulas": latex_formulas,
                "detected_subject": subject,
                "subject_confidence": confidence,
                "structured_content": structured_content,
                "summary": summary_data,
                "quiz": quiz_data,
                "flashcards": flashcards_data,
            })

            logger.info(f"✅ Pipeline completed in {processing_time:.2f}s")

        except Exception as e:
            logger.error(f"❌ Pipeline error: {e!s}")
            result["error"] = str(e)
            result["processing_time"] = time.time() - start_time

        return result

    async def process_pdf(
        self,
        pdf_bytes: bytes,
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Process a PDF document through the full pipeline.

        Extracts text (or runs OCR on scanned pages), then runs the same
        enrichment steps as process_image.

        Args:
            pdf_bytes: Raw PDF file bytes.
            options:   Same options as process_image.

        Returns:
            Same structure as process_image, with an extra "pdf" key
            containing per-page detail.
        """
        from app.services.pdf_service import pdf_service

        options = options or {}
        start_time = time.time()

        logger.info("📄 Starting PDF processing pipeline...")

        result: dict[str, Any] = {
            "success": False,
            "processing_time": 0,
            "steps": {},
            "error": None,
        }

        try:
            # Step 1: PDF text / OCR extraction
            logger.info("📄 Step 1: PDF extraction...")
            pdf_result = await pdf_service.extract(pdf_bytes)
            result["steps"]["pdf_extraction"] = {
                "status": "success",
                "method": pdf_result["method"],
                "page_count": pdf_result["page_count"],
            }
            result["pdf"] = {
                "pages": pdf_result["pages"],
                "metadata": pdf_result["metadata"],
            }

            raw_text = pdf_result["text"]

            # Steps 2-9 reuse the same logic — delegate to a shared helper
            # by simulating the post-OCR part of process_image
            enriched = await self._enrich_text(raw_text, options, start_time)
            result.update(enriched)

        except Exception as e:
            logger.error(f"❌ PDF pipeline error: {e!s}")
            result["error"] = str(e)
            result["processing_time"] = time.time() - start_time

        return result

    async def _enrich_text(
        self,
        raw_text: str,
        options: dict[str, Any],
        start_time: float,
    ) -> dict[str, Any]:
        """Run classification → structuring → embedding → generation on raw text."""
        from app.core.config import settings

        result: dict[str, Any] = {"steps": {}}

        # Classification
        subject, confidence = subject_classifier.classify(raw_text, [])
        if options.get("subject_hint"):
            subject = options["subject_hint"]
            confidence = 1.0
        result["steps"]["classification"] = {"status": "success", "subject": subject, "confidence": confidence}

        # Structuring
        corrected_text = ocr_service.correct_text(raw_text)
        structured_content: dict[str, Any] = {
            "title": "Untitled",
            "sections": [{"heading": "Content", "content": corrected_text}],
            "definitions": [], "examples": [], "key_concepts": [], "formulas": [],
            "subject_category": subject or "other",
        }
        try:
            structured_content = await llm_service.structure_content(corrected_text, subject_hint=subject)
            result["steps"]["structuring"] = {"status": "success", "title": structured_content.get("title", "Untitled")}
        except Exception as e:
            result["steps"]["structuring"] = {"status": "skipped", "reason": str(e)}

        # Embedding
        user_id = options.get("user_id")
        note_id = options.get("note_id")
        if user_id and note_id and corrected_text.strip():
            try:
                chunks_indexed = await rag_service.index_note(
                    user_id=user_id, note_id=note_id, text=corrected_text,
                    metadata={"subject": subject or "other", "title": structured_content.get("title", "Untitled")},
                )
                result["steps"]["embedding"] = {"status": "success", "chunks_indexed": chunks_indexed}
            except Exception as e:
                result["steps"]["embedding"] = {"status": "skipped", "reason": str(e)}

        # Summary
        summary_data = None
        if options.get("generate_summary", True):
            try:
                summary_data = await llm_service.generate_summary(
                    corrected_text,
                    summary_type=options.get("summary_type", "detailed"),
                    target_level=options.get("target_level"),
                )
                result["steps"]["summary"] = {"status": "success"}
            except Exception as e:
                result["steps"]["summary"] = {"status": "skipped"}

        # Quiz
        quiz_data = None
        if options.get("generate_quiz", True):
            try:
                quiz_data = await llm_service.generate_quiz(
                    corrected_text,
                    num_questions=options.get("num_quiz_questions", 5),
                    difficulty=options.get("difficulty", "intermediate"),
                )
                result["steps"]["quiz"] = {"status": "success", "questions_count": len(quiz_data.get("questions", []))}
            except Exception as e:
                result["steps"]["quiz"] = {"status": "skipped"}

        # Flashcards
        flashcards_data = None
        if options.get("generate_flashcards", True):
            try:
                flashcards_data = await llm_service.generate_flashcards(
                    corrected_text, num_cards=options.get("num_flashcards", 10)
                )
                result["steps"]["flashcards"] = {"status": "success", "cards_count": len(flashcards_data or [])}
            except Exception as e:
                result["steps"]["flashcards"] = {"status": "skipped"}

        processing_time = time.time() - start_time
        result.update({
            "success": True,
            "processing_time": round(processing_time, 2),
            "raw_text": raw_text,
            "corrected_text": corrected_text,
            "latex_formulas": [],
            "detected_subject": subject,
            "subject_confidence": confidence,
            "structured_content": structured_content,
            "summary": summary_data,
            "quiz": quiz_data,
            "flashcards": flashcards_data,
            "error": None,
        })
        return result

    async def batch_process(
        self,
        images: list[bytes],
        options: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Process multiple images in parallel."""
        tasks = [self.process_image(img, options) for img in images]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({"success": False, "error": str(result), "index": i})
            else:
                result["index"] = i
                processed_results.append(result)

        return processed_results


# Global pipeline instance
pipeline = ProcessingPipeline()
