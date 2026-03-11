"""Main AI Pipeline Orchestrator.

Coordinates all processing steps from image capture to educational content generation.
Pipeline: Image → Preprocessing → OCR → LaTeX Extraction → Subject Classification → Content Structuring → Summary/Quiz Generation
"""

import asyncio
import logging
import time
from typing import Any

from app.services.image_processor import image_processor
from app.services.latex_service import latex_service
from app.services.llm_service import llm_service
from app.services.ocr_service import ocr_service
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
            image_bytes: Raw image data
            options: Processing options including:
                - perspective_correction: bool - Apply perspective correction
                - enhance_image: bool - Enhance image contrast
                - subject_hint: str - Hint for subject classification
                - generate_summary: bool - Generate content summary
                - generate_quiz: bool - Generate quiz questions

        Returns:
            Dictionary containing processing results and metadata
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
            # Step 1: Image Preprocessing
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

            # Step 2: OCR Text Extraction
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

            # Step 3: LaTeX Formula Extraction
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

            # Step 4: Subject Classification
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

            # Step 5: Text Correction and Structuring
            logger.info("📝 Step 5: Content structuring...")
            corrected_text = ocr_service.correct_text(raw_text)

            structured_content = {
                "title": "Untitled",
                "sections": [{"heading": "Content", "content": corrected_text}],
                "definitions": [], "examples": [], "key_concepts": [], "formulas": [],
                "subject_category": subject or "other",
            }
            try:
                structured_content = await llm_service.structure_content(
                    corrected_text, subject_hint=subject,
                )
                result["steps"]["structuring"] = {"status": "success", "title": structured_content.get("title", "Untitled")}
            except Exception as e:
                logger.warning(f"⚠️ Step 5 skipped (LLM unavailable): {e}")
                result["steps"]["structuring"] = {"status": "skipped", "reason": str(e)}

            # Step 6: Generate Summary (if requested)
            summary_data = None
            if options.get("generate_summary", True):
                logger.info("📋 Step 6: Generating summary...")
                try:
                    summary_data = await llm_service.generate_summary(
                        corrected_text,
                        summary_type=options.get("summary_type", "detailed"),
                        target_level=options.get("target_level"),
                    )
                    result["steps"]["summary"] = {"status": "success"}
                except Exception as e:
                    logger.warning(f"⚠️ Step 6 skipped (LLM unavailable): {e}")
                    result["steps"]["summary"] = {"status": "skipped"}

            # Step 7: Generate Quiz (if requested)
            quiz_data = None
            if options.get("generate_quiz", True):
                logger.info("❓ Step 7: Generating quiz...")
                try:
                    quiz_data = await llm_service.generate_quiz(
                        corrected_text,
                        num_questions=options.get("num_quiz_questions", 5),
                        difficulty=options.get("difficulty", "intermediate"),
                    )
                    result["steps"]["quiz"] = {"status": "success", "questions_count": len(quiz_data.get("questions", []))}
                except Exception as e:
                    logger.warning(f"⚠️ Step 7 skipped (LLM unavailable): {e}")
                    result["steps"]["quiz"] = {"status": "skipped"}

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
            })

            logger.info(f"✅ Pipeline completed in {processing_time:.2f}s")

        except Exception as e:
            logger.error(f"❌ Pipeline error: {e!s}")
            result["error"] = str(e)
            result["processing_time"] = time.time() - start_time

        return result

    async def batch_process(
        self,
        images: list[bytes],
        options: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Process multiple images in parallel.

        Args:
            images: List of raw image data
            options: Processing options (same as process_image)

        Returns:
            List of processing results
        """
        tasks = [self.process_image(img, options) for img in images]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "success": False,
                    "error": str(result),
                    "index": i,
                })
            else:
                result["index"] = i
                processed_results.append(result)

        return processed_results


# Global pipeline instance
pipeline = ProcessingPipeline()
