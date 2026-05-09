"""Pydantic models for API request/response validation."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, EmailStr


# =============================================================================
# Enums
# =============================================================================

class SubjectCategory(str, Enum):
    """Academic subject categories."""
    MATHEMATICS = "mathematics"
    PHYSICS = "physics"
    CHEMISTRY = "chemistry"
    BIOLOGY = "biology"
    COMPUTER_SCIENCE = "computer_science"
    ENGINEERING = "engineering"
    ECONOMICS = "economics"
    LITERATURE = "literature"
    HISTORY = "history"
    PHILOSOPHY = "philosophy"
    OTHER = "other"


class CognitiveLevel(str, Enum):
    """User cognitive/learning levels."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class QuizType(str, Enum):
    """Quiz question types."""
    QCM = "qcm"
    OPEN_ENDED = "open_ended"
    FILL_IN_BLANK = "fill_in_blank"
    MATCHING = "matching"


# =============================================================================
# User Models
# =============================================================================

class UserBase(BaseModel):
    """Base user model."""
    email: EmailStr
    full_name: str
    institution: str | None = None


class UserCreate(UserBase):
    """User registration model."""
    password: str = Field(..., min_length=8, max_length=128)


class User(UserBase):
    """Complete user model."""
    id: str
    cognitive_level: CognitiveLevel = CognitiveLevel.INTERMEDIATE
    preferred_subjects: list[SubjectCategory] = []
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    is_premium: bool = False


class UserUpdateSchema(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=100)
    institution: str | None = Field(None, max_length=200)

class PasswordChangeSchema(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class UserProgress(BaseModel):
    """User progress statistics."""
    user_id: str
    total_notes: int = 0
    total_quizzes_taken: int = 0
    average_score: float = 0.0
    study_streak: int = 0
    last_activity: datetime | None = None
    subject_distribution: dict[str, int] = {}


# =============================================================================
# Processing Models
# =============================================================================

class ImageUploadRequest(BaseModel):
    """Image upload request options."""
    enhance_image: bool = True
    perspective_correction: bool = True
    subject_hint: SubjectCategory | None = None


class ProcessingResult(BaseModel):
    """Image processing result."""
    success: bool
    processing_time: float
    raw_text: str
    corrected_text: str
    latex_formulas: list[dict[str, Any]] = []
    detected_subject: SubjectCategory
    confidence_score: float
    extracted_images: list[str] = []


# =============================================================================
# Content Models
# =============================================================================

class StructuredContent(BaseModel):
    """Structured academic content."""
    title: str
    sections: list[dict[str, Any]]
    definitions: list[dict[str, str]] = []
    examples: list[str] = []
    formulas: list[dict[str, str]] = []
    key_concepts: list[str] = []


class SummaryRequest(BaseModel):
    """Summary generation request."""
    content_id: str
    summary_type: Literal["brief", "detailed", "bullet_points", "simplified"] = "detailed"
    target_level: CognitiveLevel | None = None
    max_length: int = Field(500, ge=50, le=5000)


class SummaryResponse(BaseModel):
    """Summary generation response."""
    content_id: str
    summary: str
    key_points: list[str]
    reading_time: int


# =============================================================================
# Quiz Models
# =============================================================================

class QuizQuestion(BaseModel):
    """Individual quiz question."""
    id: str
    type: QuizType
    question: str
    options: list[str] | None = None
    correct_answer: str
    explanation: str
    difficulty: CognitiveLevel
    related_concept: str | None = None
    points: int = 1


class Quiz(BaseModel):
    """Complete quiz model."""
    id: str
    note_id: str
    title: str
    questions: list[QuizQuestion]
    total_points: int
    estimated_time: int
    difficulty_distribution: dict[str, int]
    created_at: datetime


class QuizAnswer(BaseModel):
    """Single quiz answer submission."""
    question_id: str
    answer: str
    time_spent: int = Field(..., ge=0, le=3600)


class QuizSubmission(BaseModel):
    """Quiz submission data."""
    quiz_id: str
    answers: list[QuizAnswer]
    started_at: datetime
    completed_at: datetime


class QuizResult(BaseModel):
    """Quiz result data."""
    quiz_id: str
    score: float
    total_points: int
    earned_points: int
    correct_answers: int
    incorrect_answers: int
    time_taken: int
    detailed_feedback: list[dict[str, Any]]
    weak_areas: list[str]
    recommendations: list[str]


# =============================================================================
# Flashcard Models
# =============================================================================

class Flashcard(BaseModel):
    """Flashcard model for spaced repetition."""
    id: str
    note_id: str
    front: str
    back: str
    difficulty: CognitiveLevel
    tags: list[str] = []
    last_reviewed: datetime | None = None
    next_review: datetime | None = None
    review_count: int = 0
    mastery_level: float = 0.0
    # SM-2 algorithm fields
    easiness_factor: float = 2.5
    repetitions: int = 0
    interval: int = 1


class FlashcardReview(BaseModel):
    """Flashcard review data."""
    flashcard_id: str
    difficulty_rating: int = Field(..., ge=1, le=5)
    reviewed_at: datetime


# =============================================================================
# Note Models
# =============================================================================

class NoteBase(BaseModel):
    """Base note model."""
    title: str
    subject: SubjectCategory
    tags: list[str] = []


class NoteCreate(BaseModel):
    """Note creation model."""
    title: str | None = None
    subject_hint: SubjectCategory | None = None
    tags: list[str] = []


class Note(NoteBase):
    """Complete note model."""
    id: str
    user_id: str
    original_image_url: str | None = None  # None for notes created from text (no image)
    processed_content: StructuredContent
    raw_text: str
    summary: str | None = None
    latex_formulas: list[dict[str, Any]] = []
    quizzes: list[str] = []
    flashcards: list[str] = []
    created_at: datetime
    updated_at: datetime
    cognitive_level: CognitiveLevel
    processing_metadata: dict[str, Any] = {}


class NoteListItem(BaseModel):
    """Simplified note item for list views."""
    id: str
    title: str
    subject: SubjectCategory
    preview: str
    created_at: datetime
    thumbnail_url: str | None = None


# =============================================================================
# Search Models
# =============================================================================

class SearchRequest(BaseModel):
    """Note search request."""
    query: str
    filters: dict[str, Any] | None = None
    subject: SubjectCategory | None = None
    limit: int = 20
    offset: int = 0


class SearchResult(BaseModel):
    """Note search result."""
    notes: list[NoteListItem]
    total: int
    query: str


# =============================================================================
# Adaptive Learning Models
# =============================================================================

class LearningRecommendation(BaseModel):
    """Personalized learning recommendation."""
    type: Literal["review", "practice", "learn", "challenge"]
    priority: int
    description: str
    related_note_ids: list[str]
    estimated_time: int
    reason: str


class AdaptiveLearningPlan(BaseModel):
    """Adaptive learning plan for user."""
    user_id: str
    daily_recommendations: list[LearningRecommendation]
    focus_areas: list[str]
    suggested_difficulty: CognitiveLevel
    weekly_goal: dict[str, Any]
