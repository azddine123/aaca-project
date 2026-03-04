"""
Tests for flashcard operations
"""
import pytest
from datetime import datetime, timedelta
from fastapi import status
from unittest.mock import MagicMock, patch


class TestSpacedRepetition:
    """Test spaced repetition algorithm"""

    def test_next_review_calculation_first_time(self):
        """Test calculating next review for new card"""
        from app.services.adaptive_learning import adaptive_learning
        
        card = {"easiness_factor": 2.5, "repetitions": 0, "interval": 0}
        next_review = adaptive_learning.calculate_next_review(card, 3)
        
        # Should be 1 day from now
        expected_date = datetime.now() + timedelta(days=1)
        assert (next_review - expected_date).days < 1

    def test_next_review_calculation_successive(self):
        """Test calculating next review after successful reviews"""
        from app.services.adaptive_learning import adaptive_learning
        
        card = {"easiness_factor": 2.5, "repetitions": 2, "interval": 6}
        next_review = adaptive_learning.calculate_next_review(card, 5)
        
        # Interval should increase
        expected_interval = round(6 * 2.5)
        expected_date = datetime.now() + timedelta(days=expected_interval)
        assert (next_review - expected_date).days < 1

    def test_next_review_failed_response(self):
        """Test next review after failed response"""
        from app.services.adaptive_learning import adaptive_learning
        
        card = {"easiness_factor": 2.5, "repetitions": 5, "interval": 30}
        next_review = adaptive_learning.calculate_next_review(card, 1)
        
        # Should reset to 1 day
        expected_date = datetime.now() + timedelta(days=1)
        assert (next_review - expected_date).days < 1


class TestFlashcardModel:
    """Test flashcard data model"""

    def test_flashcard_creation(self):
        """Test flashcard model validation"""
        from app.models.schemas import Flashcard
        
        flashcard = Flashcard(
            id="card-123",
            note_id="note-123",
            front="What is the derivative of x^2?",
            back="2x",
            difficulty="beginner",
            tags=["calculus"],
            review_count=0,
            mastery_level=0.0
        )
        
        assert flashcard.id == "card-123"
        assert flashcard.front == "What is the derivative of x^2?"

    def test_flashcard_mastery_progression(self):
        """Test mastery level constraints"""
        from app.models.schemas import Flashcard
        
        card = Flashcard(
            id="card-123",
            note_id="note-123",
            front="Question",
            back="Answer",
            difficulty="beginner",
            review_count=5,
            mastery_level=0.5
        )
        
        assert 0.0 <= card.mastery_level <= 1.0
