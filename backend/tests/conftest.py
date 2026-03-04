"""
Pytest fixtures for AACA backend tests (MongoDB)
"""
import pytest
import asyncio
from datetime import datetime
from typing import AsyncGenerator, Generator
from unittest.mock import MagicMock, patch, AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI app."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_mongodb():
    """Mock MongoDB service"""
    with patch('app.services.mongodb_service.mongodb_service') as mock:
        mock.db = MagicMock()
        mock.client = MagicMock()
        yield mock


@pytest.fixture
def test_user_data():
    """Sample test user data"""
    return {
        "id": "test-user-123",
        "email": "test@example.com",
        "full_name": "Test User",
        "password": "testpassword123",
        "institution": "Test University",
        "cognitive_level": "intermediate",
        "preferred_subjects": ["mathematics", "physics"],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "is_active": True,
        "is_premium": False,
    }


@pytest.fixture
def test_user(test_user_data):
    """Test user with hashed password"""
    user = test_user_data.copy()
    user["password_hash"] = get_password_hash(test_user_data["password"])
    return user


@pytest.fixture
def test_user_token(test_user):
    """Create access token for test user"""
    return create_access_token({"sub": test_user["id"]})


@pytest.fixture
def authorized_client(client, test_user_token):
    """Client with authorization header"""
    client.headers["Authorization"] = f"Bearer {test_user_token}"
    return client


@pytest.fixture
def test_note_data():
    """Sample test note data"""
    return {
        "id": "test-note-123",
        "user_id": "test-user-123",
        "title": "Calculus Fundamentals",
        "subject": "mathematics",
        "tags": ["calculus", "derivatives", "math"],
        "original_image_url": "/uploads/test/image.jpg",
        "processed_content": {
            "title": "Calculus Fundamentals",
            "sections": [
                {"heading": "Introduction", "content": "Calculus is about change..."}
            ],
            "definitions": [{"term": "Derivative", "definition": "Rate of change"}],
            "examples": ["f(x) = x^2, f'(x) = 2x"],
            "key_concepts": ["Limits", "Derivatives", "Integrals"],
            "formulas": [],
        },
        "raw_text": "Calculus Fundamentals. Introduction: Calculus is about change...",
        "summary": "Introduction to calculus.",
        "latex_formulas": [],
        "quizzes": [],
        "flashcards": [],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "cognitive_level": "intermediate",
    }


@pytest.fixture
def test_quiz_data():
    """Sample test quiz data"""
    return {
        "id": "test-quiz-123",
        "note_id": "test-note-123",
        "title": "Calculus Quiz",
        "questions": [
            {
                "id": "q1",
                "type": "qcm",
                "question": "What is the derivative of x^2?",
                "options": ["x", "2x", "x^2", "2"],
                "correct_answer": "2x",
                "explanation": "Using the power rule",
                "difficulty": "beginner",
                "points": 1,
            }
        ],
        "total_points": 1,
        "estimated_time": 5,
        "created_at": datetime.now(),
    }


@pytest.fixture
def test_quiz_submission():
    """Sample quiz submission"""
    return {
        "quiz_id": "test-quiz-123",
        "answers": [{"question_id": "q1", "answer": "2x", "time_spent": 30}],
        "started_at": datetime.now().isoformat(),
        "completed_at": datetime.now().isoformat(),
    }


@pytest.fixture
def test_flashcard_data():
    """Sample test flashcard data"""
    return {
        "id": "test-card-123",
        "note_id": "test-note-123",
        "front": "What is the derivative of x^2?",
        "back": "2x",
        "difficulty": "beginner",
        "tags": ["calculus", "derivatives"],
        "next_review": datetime.now(),
        "review_count": 0,
        "mastery_level": 0.0,
    }


@pytest.fixture
def mock_ocr_service():
    """Mock OCR service"""
    with patch('app.services.ocr_service.ocr_service') as mock:
        mock.extract_text.return_value = {
            "text": "Test extracted text",
            "average_confidence": 0.95,
            "engine": "easyocr"
        }
        yield mock


@pytest.fixture
def mock_llm_service():
    """Mock LLM service"""
    with patch('app.services.llm_service.llm_service') as mock:
        mock.structure_content.return_value = {
            "title": "Test Title",
            "sections": [{"heading": "Section 1", "content": "Content"}],
            "key_concepts": ["Concept 1"],
        }
        mock.generate_summary.return_value = {
            "summary": "Test summary",
            "key_points": ["Point 1"],
        }
        yield mock
