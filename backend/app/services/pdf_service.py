"""PDF Service — extract text and images from PDF documents.

Supports two extraction modes:
  - Text-based PDF (pdfplumber): fast, preserves layout.
  - Scanned PDF (image conversion): each page is rendered as an image
    and fed to the OCR pipeline.
"""

import io
import logging
from typing import Any

logger = logging.getLogger("aaca")


class PDFService:
    """Extract content from PDF files."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def extract(self, pdf_bytes: bytes) -> dict[str, Any]:
        """Extract text and metadata from a PDF.

        Tries text-based extraction first (pdfplumber). If the extracted
        text is too sparse (< 50 chars per page on average), falls back to
        rendering each page as an image and running OCR on it.

        Args:
            pdf_bytes: Raw PDF file content.

        Returns:
            {
                "text":       str,        # full concatenated text
                "pages":      list[dict], # per-page detail
                "page_count": int,
                "method":     "text" | "ocr",
                "metadata":   dict,       # PDF metadata (author, title…)
            }
        """
        text_result = self._extract_text(pdf_bytes)

        avg_chars = (
            len(text_result["text"]) / max(text_result["page_count"], 1)
        )

        if avg_chars >= 50:
            logger.info(
                f"PDF text extraction OK ({text_result['page_count']} pages, "
                f"avg {avg_chars:.0f} chars/page)"
            )
            return text_result

        # Sparse text → scanned PDF, fall back to OCR
        logger.warning(
            f"PDF text sparse ({avg_chars:.0f} chars/page) — switching to OCR mode"
        )
        return await self._extract_via_ocr(pdf_bytes, text_result["page_count"])

    # ------------------------------------------------------------------
    # Text extraction (pdfplumber)
    # ------------------------------------------------------------------

    def _extract_text(self, pdf_bytes: bytes) -> dict[str, Any]:
        """Extract text from a native (non-scanned) PDF."""
        try:
            import pdfplumber

            pages_data: list[dict[str, Any]] = []
            full_text_parts: list[str] = []

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                metadata = pdf.metadata or {}
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    tables = page.extract_tables() or []

                    # Convert tables to a simple text representation
                    table_texts: list[str] = []
                    for table in tables:
                        rows = [" | ".join(str(cell or "") for cell in row) for row in table]
                        table_texts.append("\n".join(rows))

                    page_content = text
                    if table_texts:
                        page_content += "\n\n" + "\n\n".join(table_texts)

                    pages_data.append({
                        "page": i + 1,
                        "text": page_content,
                        "char_count": len(page_content),
                    })
                    full_text_parts.append(page_content)

            return {
                "text": "\n\n".join(full_text_parts),
                "pages": pages_data,
                "page_count": len(pages_data),
                "method": "text",
                "metadata": {
                    "title": metadata.get("Title", ""),
                    "author": metadata.get("Author", ""),
                    "subject": metadata.get("Subject", ""),
                    "creator": metadata.get("Creator", ""),
                },
            }

        except Exception as e:
            logger.error(f"pdfplumber extraction failed: {e}")
            return {
                "text": "",
                "pages": [],
                "page_count": 0,
                "method": "text",
                "metadata": {},
            }

    # ------------------------------------------------------------------
    # OCR fallback (render pages as images → OCR pipeline)
    # ------------------------------------------------------------------

    async def _extract_via_ocr(
        self, pdf_bytes: bytes, page_count: int
    ) -> dict[str, Any]:
        """Render each PDF page as PNG and run the OCR pipeline on it."""
        from app.services.image_processor import image_processor
        from app.services.ocr_service import ocr_service

        pages_data: list[dict[str, Any]] = []
        full_text_parts: list[str] = []

        page_images = self._render_pages(pdf_bytes)

        for i, img_bytes in enumerate(page_images):
            try:
                processed, _ = await image_processor.preprocess(
                    img_bytes,
                    perspective_correction=False,
                    enhance_contrast=True,
                    denoise=True,
                )
                ocr_result = await ocr_service.extract_text(processed)
                text = ocr_result.get("text", "")
            except Exception as e:
                logger.warning(f"OCR failed on page {i + 1}: {e}")
                text = ""

            pages_data.append({
                "page": i + 1,
                "text": text,
                "char_count": len(text),
            })
            full_text_parts.append(text)

        return {
            "text": "\n\n".join(full_text_parts),
            "pages": pages_data,
            "page_count": len(pages_data),
            "method": "ocr",
            "metadata": {},
        }

    @staticmethod
    def _render_pages(pdf_bytes: bytes, dpi: int = 200) -> list[bytes]:
        """Render each PDF page to a PNG image at the given DPI.

        Requires pdf2image + poppler.
        """
        try:
            import io as _io

            from pdf2image import convert_from_bytes

            images = convert_from_bytes(pdf_bytes, dpi=dpi, fmt="png")
            result: list[bytes] = []
            for img in images:
                buf = _io.BytesIO()
                img.save(buf, format="PNG")
                result.append(buf.getvalue())
            return result

        except Exception as e:
            logger.error(f"PDF page rendering failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def is_pdf(data: bytes) -> bool:
        """Check magic bytes for PDF signature."""
        return data[:4] == b"%PDF"

    def page_count(self, pdf_bytes: bytes) -> int:
        """Return the number of pages without extracting text."""
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                return len(pdf.pages)
        except Exception:
            return 0


pdf_service = PDFService()
