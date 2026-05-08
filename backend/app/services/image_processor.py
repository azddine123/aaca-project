"""Image preprocessing service using OpenCV.

Includes perspective correction, contrast enhancement, noise reduction.
"""

import logging

import cv2
import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger("aaca")


class ImageProcessor:
    """Advanced image preprocessing for OCR optimization."""

    def __init__(self) -> None:
        self.target_width = 2000

    async def preprocess(
        self,
        image_bytes: bytes,
        perspective_correction: bool = True,
        enhance_contrast: bool = True,
        denoise: bool = True,
    ) -> tuple[bytes, dict]:
        """Full preprocessing pipeline.

        Returns processed image and metadata.
        """
        import asyncio
        return await asyncio.to_thread(
            self._preprocess_sync,
            image_bytes,
            perspective_correction,
            enhance_contrast,
            denoise,
        )

    def _preprocess_sync(
        self,
        image_bytes: bytes,
        perspective_correction: bool = True,
        enhance_contrast: bool = True,
        denoise: bool = True,
    ) -> tuple[bytes, dict]:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Invalid image data")

        metadata = {
            "original_shape": image.shape,
            "preprocessing_steps": [],
        }

        image = self._resize_if_needed(image)
        metadata["preprocessing_steps"].append("resize")

        if perspective_correction:
            image = self._correct_perspective(image)
            metadata["preprocessing_steps"].append("perspective_correction")

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        if denoise:
            gray = self._denoise(gray)
            metadata["preprocessing_steps"].append("denoise")

        if enhance_contrast:
            gray = self._enhance_contrast(gray)
            metadata["preprocessing_steps"].append("contrast_enhancement")

        processed = self._adaptive_threshold(gray)
        metadata["preprocessing_steps"].append("adaptive_threshold")
        metadata["final_shape"] = processed.shape

        success, encoded = cv2.imencode(".png", processed)
        if not success:
            raise ValueError("Failed to encode processed image")

        return encoded.tobytes(), metadata

    def _resize_if_needed(self, image: NDArray) -> NDArray:
        """Resize image maintaining aspect ratio."""
        height, width = image.shape[:2]

        if width > self.target_width:
            ratio = self.target_width / width
            new_size = (self.target_width, int(height * ratio))
            return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)

        return image

    def _correct_perspective(self, image: NDArray) -> NDArray:
        """Auto-detect and correct document perspective."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return image

        largest_contour = max(contours, key=cv2.contourArea)

        if cv2.contourArea(largest_contour) < (image.shape[0] * image.shape[1] * 0.3):
            return image

        epsilon = 0.02 * cv2.arcLength(largest_contour, True)
        approx = cv2.approxPolyDP(largest_contour, epsilon, True)

        if len(approx) == 4:
            pts = approx.reshape(4, 2)
            rect = np.zeros((4, 2), dtype="float32")

            s = pts.sum(axis=1)
            rect[0] = pts[np.argmin(s)]
            rect[2] = pts[np.argmax(s)]

            diff = np.diff(pts, axis=1)
            rect[1] = pts[np.argmin(diff)]
            rect[3] = pts[np.argmax(diff)]

            (tl, tr, br, bl) = rect
            width_a = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
            width_b = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
            max_width = max(int(width_a), int(width_b))

            height_a = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
            height_b = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
            max_height = max(int(height_a), int(height_b))

            dst = np.array([
                [0, 0],
                [max_width - 1, 0],
                [max_width - 1, max_height - 1],
                [0, max_height - 1],
            ], dtype="float32")

            m = cv2.getPerspectiveTransform(rect, dst)
            warped = cv2.warpPerspective(image, m, (max_width, max_height))

            return warped

        return image

    @staticmethod
    def _denoise(gray: NDArray) -> NDArray:
        """Apply non-local means denoising."""
        return cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)

    @staticmethod
    def _enhance_contrast(gray: NDArray) -> NDArray:
        """CLAHE (Contrast Limited Adaptive Histogram Equalization)."""
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(gray)

    @staticmethod
    def _adaptive_threshold(gray: NDArray) -> NDArray:
        """Apply adaptive thresholding for better text extraction."""
        return cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2,
        )

    @staticmethod
    async def detect_formula_regions(image_bytes: bytes) -> list[dict]:
        import asyncio
        return await asyncio.to_thread(ImageProcessor._detect_formula_regions_sync, image_bytes)

    @staticmethod
    def _detect_formula_regions_sync(image_bytes: bytes) -> list[dict]:
        """Detect potential mathematical formula regions."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

        _, thresh = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        formula_regions = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = w / float(h)
            area = w * h

            if 0.5 < aspect_ratio < 15 and area > 500:
                formula_regions.append({
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h,
                    "aspect_ratio": aspect_ratio,
                })

        return formula_regions


image_processor = ImageProcessor()
