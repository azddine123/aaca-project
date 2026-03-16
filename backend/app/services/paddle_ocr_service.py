"""PaddleOCR service using PP-OCRv5_server_rec + PPStructureV3.

Provides structured text extraction (text, tables, layout) from document images,
outputting Markdown-formatted content without requiring a GPU.
"""

import logging
import os
import tempfile
from typing import Any

logger = logging.getLogger("aaca")


class PaddleOCRService:
    """OCR service backed by PaddleOCR PP-OCRv5 + PPStructureV3."""

    def __init__(self) -> None:
        self._pipeline = None

    def _get_pipeline(self) -> Any:
        """Lazy initialization of PPStructureV3 pipeline."""
        if self._pipeline is None:
            from paddleocr import PPStructureV3

            logger.info("🔄 Initializing PPStructureV3 with PP-OCRv5_server_rec (first time)...")
            self._pipeline = PPStructureV3(
                text_recognition_model_name="PP-OCRv5_server_rec",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                device="cpu",
            )
            logger.info("✅ PPStructureV3 initialized.")
        return self._pipeline

    async def extract_text(
        self,
        image_bytes: bytes,
        detect_formulas: bool = True,
    ) -> dict[str, Any]:
        """Extract structured text from image (async wrapper)."""
        import asyncio

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._extract_sync, image_bytes)

    def _extract_sync(self, image_bytes: bytes) -> dict[str, Any]:
        """Synchronous extraction using PPStructureV3."""
        pipeline = self._get_pipeline()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Write image bytes to a temp file
            img_path = os.path.join(tmpdir, "input.png")
            with open(img_path, "wb") as f:
                f.write(image_bytes)

            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(output_dir, exist_ok=True)

            # Run the pipeline
            results = pipeline.predict(img_path)

            # Save results as Markdown
            markdown_parts: list[str] = []
            for res in results:
                if hasattr(res, "save_to_markdown"):
                    res.save_to_markdown(save_path=output_dir)

            # Read generated Markdown files
            for fname in sorted(os.listdir(output_dir)):
                if fname.endswith(".md"):
                    with open(os.path.join(output_dir, fname), encoding="utf-8") as f:
                        markdown_parts.append(f.read())

            markdown_text = "\n\n".join(markdown_parts)

            # Fallback: extract raw text from result objects if no Markdown was written
            if not markdown_text.strip():
                logger.warning("No Markdown output from PPStructureV3, falling back to raw text extraction.")
                raw_lines: list[str] = []
                for res in results:
                    if hasattr(res, "res") and res.res:
                        for item in res.res:
                            if isinstance(item, dict):
                                text = item.get("text") or item.get("rec_text", "")
                                if text:
                                    raw_lines.append(text)
                markdown_text = "\n".join(raw_lines)

        paragraphs = [p.strip() for p in markdown_text.split("\n\n") if p.strip()]

        return {
            "text": markdown_text,
            "paragraphs": paragraphs,
            "bounding_boxes": [],
            "confidences": [],
            # PP-OCRv5 average benchmark accuracy
            "average_confidence": 0.84,
            "detected_formulas": [],
            "engine": "paddleocr",
            "markdown": markdown_text,
        }


paddle_ocr_service = PaddleOCRService()
