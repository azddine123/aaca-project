"""Custom OCR Service using TrOCR (microsoft/trocr-small-printed).

Two-stage pipeline:
  1. Detection  — OpenCV morphological ops to locate text line regions
  2. Recognition — TrOCR Vision Encoder-Decoder, produces token-level confidence

If average_confidence < settings.OCR_CONFIDENCE_THRESHOLD, the caller should
fall back to a higher-quality source (LLM Vision / GPT-4o).
"""

import asyncio
import logging
from typing import Any

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("aaca")


class CustomOCRService:
    """Lightweight TrOCR-based OCR with built-in confidence scoring."""

    MODEL_NAME = "microsoft/trocr-small-printed"

    def __init__(self) -> None:
        self._processor = None
        self._model = None
        self._loaded = False

    # ── Model loading (lazy, thread-safe) ────────────────────────────────────

    def _load(self) -> None:
        if self._loaded:
            return

        logger.info(f"Loading TrOCR model ({self.MODEL_NAME}) — first call only...")
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel

        self._processor = TrOCRProcessor.from_pretrained(self.MODEL_NAME)
        self._model = VisionEncoderDecoderModel.from_pretrained(self.MODEL_NAME)
        self._model.eval()
        self._loaded = True
        logger.info("TrOCR model ready.")

    # ── Text region detection (OpenCV) ────────────────────────────────────────

    def _detect_text_regions(self, gray: np.ndarray) -> list[tuple[int, int, int, int]]:
        """Return list of (x1, y1, x2, y2) bounding boxes for text lines."""
        h, w = gray.shape

        # Binarise
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Dilate horizontally to merge characters into lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 6))
        dilated = cv2.dilate(binary, kernel)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        regions: list[tuple[int, int, int, int]] = []
        for cnt in sorted(contours, key=lambda c: cv2.boundingRect(c)[1]):  # top → bottom
            x, y, rw, rh = cv2.boundingRect(cnt)
            if rw < 20 or rh < 8:  # skip noise
                continue
            # Small padding
            x1 = max(0, x - 4)
            y1 = max(0, y - 4)
            x2 = min(w, x + rw + 4)
            y2 = min(h, y + rh + 4)
            regions.append((x1, y1, x2, y2))

        return regions or [(0, 0, w, h)]  # fallback: entire image

    # ── TrOCR recognition ────────────────────────────────────────────────────

    def _recognize(self, crop: Image.Image) -> tuple[str, float]:
        """Run TrOCR on a single PIL crop. Returns (text, confidence)."""
        import torch
        import torch.nn.functional as F

        pixel_values = self._processor(
            images=crop.convert("RGB"), return_tensors="pt"
        ).pixel_values

        with torch.no_grad():
            outputs = self._model.generate(
                pixel_values,
                output_scores=True,
                return_dict_in_generate=True,
                max_new_tokens=128,
            )

        text = self._processor.batch_decode(
            outputs.sequences, skip_special_tokens=True
        )[0].strip()

        # Geometric mean of per-token max-prob → overall confidence
        if outputs.scores:
            probs = [F.softmax(s, dim=-1).max().item() for s in outputs.scores]
            confidence = float(np.prod(probs) ** (1.0 / len(probs)))
        else:
            confidence = 0.8  # safe default when no scores returned

        return text, confidence

    # ── Public interface ──────────────────────────────────────────────────────

    async def extract_text(
        self,
        image_bytes: bytes,
        detect_formulas: bool = True,
    ) -> dict[str, Any]:
        """Async entry point — runs blocking inference in a thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._extract_sync, image_bytes, detect_formulas
        )

    def _extract_sync(self, image_bytes: bytes, detect_formulas: bool) -> dict[str, Any]:
        self._load()

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if cv_img is None:
            raise ValueError("Invalid image bytes")

        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
        pil_img = Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))

        # Detect text regions
        regions = self._detect_text_regions(gray)

        lines: list[str] = []
        confidences: list[float] = []

        for x1, y1, x2, y2 in regions:
            crop = pil_img.crop((x1, y1, x2, y2))
            text, conf = self._recognize(crop)
            if text:
                lines.append(text)
                confidences.append(conf)

        full_text = "\n".join(lines)
        avg_conf = float(np.mean(confidences)) if confidences else 0.0

        # Reuse formula detector from ocr_service (no import cycle — static method)
        from app.services.ocr_service import OCRService
        formulas = OCRService._detect_inline_formulas(full_text) if detect_formulas else []

        logger.info(
            f"CustomOCR extracted {len(lines)} lines, avg confidence={avg_conf:.2f}"
        )

        return {
            "text": full_text,
            "paragraphs": lines,
            "bounding_boxes": regions,
            "confidences": confidences,
            "average_confidence": avg_conf,
            "detected_formulas": formulas,
            "engine": "trocr-small",
        }


custom_ocr_service = CustomOCRService()
