"""
Tests for notes CRUD operations
"""
import pytest
from fastapi import status
from unittest.mock import MagicMock, patch, AsyncMock


class TestNotesValidation:
    """Test note data validation"""

    def test_note_subject_validation(self):
        """Test subject category validation"""
        from app.models.schemas import SubjectCategory
        
        assert SubjectCategory.MATHEMATICS.value == "mathematics"
        assert SubjectCategory.PHYSICS.value == "physics"
        
        with pytest.raises(ValueError):
            SubjectCategory("invalid_subject")

    def test_note_cognitive_level_validation(self):
        """Test cognitive level validation"""
        from app.models.schemas import CognitiveLevel
        
        assert CognitiveLevel.BEGINNER.value == "beginner"
        assert CognitiveLevel.EXPERT.value == "expert"
        
        with pytest.raises(ValueError):
            CognitiveLevel("invalid_level")
