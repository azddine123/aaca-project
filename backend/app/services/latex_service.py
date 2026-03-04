"""LaTeX formula extraction and conversion service."""

import io
import logging
import re
from typing import Any

import numpy as np
from PIL import Image

logger = logging.getLogger("aaca")


class LaTeXService:
    """Service for extracting and converting mathematical formulas to LaTeX."""

    def __init__(self) -> None:
        self._pix2tex_model = None
        self._initialized = False

    def _load_model(self) -> None:
        """Lazy load the Pix2Tex model."""
        if not self._initialized:
            try:
                from pix2tex.cli import LatexOCR

                logger.info("🔄 Loading Pix2Tex model...")
                self._pix2tex_model = LatexOCR()
                self._initialized = True
                logger.info("✅ Pix2Tex model loaded")
            except ImportError:
                logger.warning("⚠️ Pix2Tex not installed. Using fallback formula detection.")
                self._initialized = True

    async def extract_formulas(
        self,
        image_bytes: bytes,
        detected_regions: list[dict] | None = None,
    ) -> list[dict[str, Any]]:
        """Extract all formulas from image and convert to LaTeX."""
        self._load_model()

        formulas = []

        if detected_regions is None:
            detected_regions = self._detect_formula_regions(image_bytes)

        for region in detected_regions:
            try:
                region_image = self._extract_region(image_bytes, region)
                latex = await self._image_to_latex(region_image)

                if latex:
                    formulas.append({
                        "latex": latex,
                        "region": region,
                        "rendered": self._render_latex_preview(latex),
                    })
            except Exception as e:
                logger.error(f"Formula extraction error: {e}")

        return formulas

    async def _image_to_latex(self, image_bytes: bytes) -> str | None:
        """Convert formula image to LaTeX using Pix2Tex."""
        if self._pix2tex_model:
            try:
                image = Image.open(io.BytesIO(image_bytes))
                latex = self._pix2tex_model(image)
                return self._clean_latex(latex)
            except Exception as e:
                logger.error(f"Pix2Tex error: {e}")

        return None

    @staticmethod
    def _detect_formula_regions(image_bytes: bytes) -> list[dict]:
        """Detect potential formula regions using CV."""
        import cv2

        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

        _, binary = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)

        regions = []
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]
            aspect_ratio = w / h if h > 0 else 0

            if 500 < area < 50000 and 0.3 < aspect_ratio < 15:
                regions.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    "area": int(area),
                })

        return regions

    @staticmethod
    def _extract_region(image_bytes: bytes, region: dict) -> bytes:
        """Extract a specific region from image."""
        import cv2

        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        x, y = region["x"], region["y"]
        w, h = region["width"], region["height"]

        padding = 10
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = w + 2 * padding
        h = h + 2 * padding

        region_img = image[y:y+h, x:x+w]

        success, encoded = cv2.imencode(".png", region_img)
        if success:
            return encoded.tobytes()
        return image_bytes

    @staticmethod
    def _clean_latex(latex: str) -> str:
        """Clean and normalize LaTeX output."""
        latex = re.sub(r"\s+", " ", latex).strip()
        latex = latex.replace("\\text ", "\\text{")
        latex = latex.replace("\\mathrm ", "\\mathrm{")

        if latex.count("{") != latex.count("}"):
            latex = LaTeXService._balance_braces(latex)

        return latex

    @staticmethod
    def _balance_braces(latex: str) -> str:
        """Fix unbalanced braces in LaTeX."""
        open_count = latex.count("{")
        close_count = latex.count("}")

        if open_count > close_count:
            latex += "}" * (open_count - close_count)
        elif close_count > open_count:
            latex = "{" * (close_count - open_count) + latex

        return latex

    @staticmethod
    def _render_latex_preview(latex: str) -> str:
        """Generate a preview URL for the LaTeX formula."""
        return f"https://latex.codecogs.com/png.latex?{latex.replace(' ', '%20')}"

    @staticmethod
    def convert_text_to_latex(text: str) -> tuple[str, list[dict]]:
        """Convert plain text with formulas to LaTeX.

        Returns: (text_with_latex, formula_list)
        """
        formulas = []
        result_text = text

        replacements = [
            (r"(\d+|\w+)\s*\/\s*(\d+|\w+)", r"\\frac{\1}{\2}"),
            (r"(\w+)\^(\d+)", r"\1^{\2}"),
            (r"sqrt\s*\(\s*([^)]+)\s*\)", r"\\sqrt{\1}"),
            (r"int\s+(.+?)\s*dx", r"\\int \1 \\, dx"),
            (r"sum\s+(.+?)\s*", r"\\sum \1"),
            (r"\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega)\b",
             lambda m: f"\\{m.group(1)}"),
        ]

        for pattern, replacement in replacements:
            def replace_and_track(match: re.Match) -> str:
                original = match.group(0)
                result = re.sub(pattern, replacement, original)
                if result != original:
                    formulas.append({
                        "original": original,
                        "latex": result,
                        "type": "converted",
                    })
                return result

            result_text = re.sub(pattern, replace_and_track, result_text)

        return result_text, formulas

    @staticmethod
    def validate_latex(latex: str) -> dict[str, Any]:
        """Validate LaTeX syntax."""
        errors = []

        if latex.count("{") != latex.count("}"):
            errors.append("Unbalanced braces")

        if "\\begin" in latex and "\\end" not in latex:
            errors.append("Missing \\end for environment")

        undefined = re.findall(r"\\[a-zA-Z]+", latex)
        common_commands = {"frac", "sqrt", "sum", "int", "alpha", "beta", "gamma",
                          "cdot", "times", "div", "pm", "infty", "pi", "theta"}

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": [],
            "suggestions": list(set(undefined) - common_commands) if undefined else [],
        }


latex_service = LaTeXService()
