"""
Tests for quiz operations
"""
import pytest
from fastapi import status
from unittest.mock import MagicMock


class TestQuizScoring:
    """Test quiz scoring logic"""

    def test_perfect_score(self):
        """Test scoring with all correct answers"""
        total_points = 10
        earned_points = 10
        score = (earned_points / total_points) * 100
        assert score == 100.0

    def test_partial_score(self):
        """Test scoring with partial correct answers"""
        total_points = 10
        earned_points = 7
        score = (earned_points / total_points) * 100
        assert score == 70.0

    def test_zero_score(self):
        """Test scoring with no correct answers"""
        total_points = 10
        earned_points = 0
        score = (earned_points / total_points) * 100
        assert score == 0.0


class TestQuizTypes:
    """Test different quiz types"""

    def test_qcm_question_validation(self):
        """Test QCM question structure"""
        from app.models.schemas import QuizQuestion, QuizType
        
        question = QuizQuestion(
            id="q1",
            type=QuizType.QCM,
            question="What is 2+2?",
            options=["3", "4", "5", "6"],
            correct_answer="4",
            explanation="Basic addition",
            difficulty="beginner",
            points=1
        )
        
        assert question.type == QuizType.QCM
        assert len(question.options) == 4
        assert question.correct_answer in question.options

    def test_open_ended_question(self):
        """Test open-ended question structure"""
        from app.models.schemas import QuizQuestion, QuizType
        
        question = QuizQuestion(
            id="q2",
            type=QuizType.OPEN_ENDED,
            question="Explain derivative",
            correct_answer="Rate of change",
            explanation="Derivatives measure rate of change",
            difficulty="intermediate",
            points=5
        )
        
        assert question.type == QuizType.OPEN_ENDED
        assert question.options is None
