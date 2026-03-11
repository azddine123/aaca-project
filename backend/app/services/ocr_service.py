"""OCR Service supporting multiple engines."""

import logging
import re
from typing import Any

from PIL import Image as _PILImage

# Pillow >= 10.0 removed Image.ANTIALIAS; EasyOCR 1.7.x still references it.
if not hasattr(_PILImage, "ANTIALIAS"):
    _PILImage.ANTIALIAS = _PILImage.LANCZOS  # type: ignore[attr-defined]

from app.core.config import settings

logger = logging.getLogger("aaca")


class OCRService:
    """Multi-engine OCR service with fallback support."""

    def __init__(self) -> None:
        self.engine = settings.OCR_ENGINE
        self._easyocr_reader = None
        self._tesseract_available = False

    def _get_easyocr_reader(self) -> Any:
        """Lazy initialization of EasyOCR."""
        if self._easyocr_reader is None:
            import easyocr

            logger.info("🔄 Initializing EasyOCR (first time)...")
            self._easyocr_reader = easyocr.Reader(
                ["en", "fr", "de", "es", "it"],
                gpu=False,
                verbose=False,
            )
        return self._easyocr_reader

    async def extract_text(
        self,
        image_bytes: bytes,
        detect_formulas: bool = True,
    ) -> dict[str, Any]:
        """Extract text from image.

        Returns structured result with text, bounding boxes, and confidence.
        """
        if self.engine == "easyocr":
            return await self._extract_with_easyocr(image_bytes, detect_formulas)
        elif self.engine == "tesseract":
            return await self._extract_with_tesseract(image_bytes, detect_formulas)
        raise ValueError(f"Unknown OCR engine: {self.engine}")

    async def _extract_with_easyocr(self, image_bytes: bytes, detect_formulas: bool = True) -> dict[str, Any]:
        """Extract text using EasyOCR."""
        import cv2
        import numpy as np

        reader = self._get_easyocr_reader()

        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = reader.readtext(image, paragraph=True)

        extracted_text = []
        bounding_boxes = []
        confidences = []

        for detection in results:
            if len(detection) == 3:
                bbox, text, conf = detection
            else:
                bbox, text = detection
                conf = 0.9

            extracted_text.append(text)
            bounding_boxes.append(bbox)
            confidences.append(conf)

        full_text = "\n".join(extracted_text)
        formulas = self._detect_inline_formulas(full_text) if detect_formulas else []

        return {
            "text": full_text,
            "paragraphs": extracted_text,
            "bounding_boxes": bounding_boxes,
            "confidences": confidences,
            "average_confidence": sum(confidences) / len(confidences) if confidences else 0,
            "detected_formulas": formulas,
            "engine": "easyocr",
        }

    async def _extract_with_tesseract(self, image_bytes: bytes, detect_formulas: bool = True) -> dict[str, Any]:
        """Extract text using Tesseract OCR."""
        try:
            import io

            import cv2
            import numpy as np
            import pytesseract
            from PIL import Image

            image = Image.open(io.BytesIO(image_bytes))

            custom_config = r"--oem 3 --psm 6 -l eng+fra+deu+spa"

            data = pytesseract.image_to_data(
                image,
                config=custom_config,
                output_type=pytesseract.Output.DICT,
            )

            text = pytesseract.image_to_string(image, config=custom_config)

            boxes = []
            confidences = []
            for i, conf in enumerate(data["conf"]):
                if int(conf) > 0:
                    boxes.append({
                        "x": data["left"][i],
                        "y": data["top"][i],
                        "width": data["width"][i],
                        "height": data["height"][i],
                    })
                    confidences.append(int(conf) / 100)

            formulas = self._detect_inline_formulas(text)

            return {
                "text": text,
                "paragraphs": [p.strip() for p in text.split("\n\n") if p.strip()],
                "bounding_boxes": boxes,
                "confidences": confidences,
                "average_confidence": sum(confidences) / len(confidences) if confidences else 0,
                "detected_formulas": formulas,
                "engine": "tesseract",
            }

        except Exception as e:
            logger.error(f"Tesseract error: {e}, falling back to EasyOCR")
            return await self._extract_with_easyocr(image_bytes)

    @staticmethod
    def _detect_inline_formulas(text: str) -> list[dict[str, Any]]:
        """Detect mathematical formulas in text using patterns."""
        formulas = []

        patterns = [
            (r"∫.*?dx", "integral"),
            (r"∑.*?=", "summation"),
            (r"lim_", "limit"),
            (r"\$?\\frac\{[^}]+\}\{[^}]+\}\$?", "fraction"),
            (r"\$?\\sqrt\{[^}]+\}\$?", "sqrt"),
            (r"[α-ωΑ-Ω][\s]*[\+\-\*\/\=][\s]*[α-ωΑ-Ω0-9]", "equation"),
            (r"[a-zA-Z]_[0-9a-zA-Z]+\^\{[^}]+\}", "sub_superscript"),
            (r"\\begin\{matrix\}.*?\\end\{matrix\}", "matrix"),
        ]

        for pattern, formula_type in patterns:
            for match in re.finditer(pattern, text, re.DOTALL):
                formulas.append({
                    "type": formula_type,
                    "text": match.group(),
                    "position": match.span(),
                })

        return formulas

    @staticmethod
    def correct_text(text: str) -> str:
        """Apply basic text corrections."""
        lines = text.split("\n")
        corrected_lines = []

        for line in lines:
            line = re.sub(r"\s+", " ", line)
            line = line.strip()
            corrected_lines.append(line)

        return "\n".join(corrected_lines)


ocr_service = OCRService()
