"""
Tests for image processing pipeline
"""
import pytest
from fastapi import status
from unittest.mock import MagicMock, patch
import io


class TestProcessingEndpoints:
    """Test image processing endpoints"""

    def test_process_image_without_auth(self, client):
        """Test processing without authentication fails"""
        response = client.post("/api/v1/process/image")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_process_image_with_invalid_file_type(self, authorized_client):
        """Test processing with invalid file type fails"""
        file_content = b"This is not an image"
        
        response = authorized_client.post(
            "/api/v1/process/image",
            files={"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        )
        
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY]


class TestImageProcessor:
    """Test image processing service"""

    def test_preprocess_image(self, mock_image_processor):
        """Test image preprocessing"""
        import asyncio
        from app.services.image_processor import image_processor
        
        test_image = b"test_image_bytes"
        
        result = asyncio.run(
            image_processor.preprocess(test_image, perspective_correction=True)
        )
        
        assert result is not None
        assert len(result) == 2


class TestOCRService:
    """Test OCR service"""

    @pytest.mark.asyncio
    async def test_extract_text(self, mock_ocr_service):
        """Test text extraction from image"""
        from app.services.ocr_service import ocr_service
        
        result = await ocr_service.extract_text(b"test_image")
        
        assert result is not None
        assert "text" in result
        assert "average_confidence" in result


class TestLLMService:
    """Test LLM service"""

    @pytest.mark.asyncio
    async def test_structure_content(self, mock_llm_service):
        """Test content structuring"""
        from app.services.llm_service import llm_service
        
        result = await llm_service.structure_content("Test content")
        
        assert result is not None
        assert "title" in result

    @pytest.mark.asyncio
    async def test_generate_summary(self, mock_llm_service):
        """Test summary generation"""
        from app.services.llm_service import llm_service
        
        result = await llm_service.generate_summary("Long content...", summary_type="brief")
        
        assert result is not None
        assert "summary" in result
