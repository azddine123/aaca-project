# AACA API Reference

## Base URL

```
Development: http://localhost:8000/api/v1
Production:  https://api.aaca.app/api/v1
```

## Authentication

Most endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Refresh

Access tokens expire after 30 minutes. Use the refresh token to get a new access token:

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "<refresh_token>"
}
```

---

## Authentication Endpoints

### Register

Create a new user account.

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe",
  "institution": "Example University"
}
```

**Response (201 Created)**:

```json
{
  "user_id": "user-123",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### Login

Authenticate and receive tokens.

```http
POST /auth/login
Content-Type: multipart/form-data

email=user@example.com&password=securepassword
```

**Response (200 OK)**:

```json
{
  "user_id": "user-123",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "email": "user@example.com",
    "full_name": "John Doe",
    "cognitive_level": "intermediate"
  }
}
```

---

## Processing Endpoints

### Process Image

Process an image through the AI pipeline without saving.

```http
POST /process/image
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image_file>
perspective_correction: true
enhance_image: true
subject_hint: mathematics
```

**Response (200 OK)**:

```json
{
  "success": true,
  "processing_time": 2.5,
  "raw_text": "Extracted text content...",
  "corrected_text": "Corrected content...",
  "latex_formulas": [
    {
      "latex": "\\frac{d}{dx}x^2 = 2x",
      "region": {"x": 100, "y": 200, "width": 150, "height": 50}
    }
  ],
  "detected_subject": "mathematics",
  "confidence_score": 0.92
}
```

### Capture and Process

Capture, process, and save a note in one step.

```http
POST /process/capture
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image_file>
title: "My Calculus Notes"
subject_hint: mathematics
tags: "calculus, derivatives, math"
```

**Response (200 OK)**:

```json
{
  "note_id": "note-456",
  "quiz_id": "quiz-789",
  "flashcards_count": 5,
  "processing_result": {
    "success": true,
    "processing_time": 3.2,
    "detected_subject": "mathematics",
    ...
  }
}
```

---

## Notes Endpoints

### List Notes

Get all notes for the current user.

```http
GET /notes?subject=mathematics&limit=50&offset=0
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
[
  {
    "id": "note-456",
    "title": "Introduction to Calculus",
    "subject": "mathematics",
    "preview": "Summary of the note content...",
    "created_at": "2024-01-15T10:30:00Z",
    "thumbnail_url": "https://storage.example.com/thumb.jpg"
  }
]
```

### Get Note Detail

Get full details of a specific note.

```http
GET /notes/{note_id}
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "id": "note-456",
  "user_id": "user-123",
  "title": "Introduction to Calculus",
  "subject": "mathematics",
  "tags": ["calculus", "derivatives"],
  "original_image_url": "https://storage.example.com/image.jpg",
  "processed_content": {
    "title": "Introduction to Calculus",
    "sections": [
      {
        "heading": "Limits",
        "content": "A limit is the value..."
      }
    ],
    "definitions": [
      {
        "term": "Limit",
        "definition": "The value a function approaches..."
      }
    ],
    "examples": ["lim(x→0) sin(x)/x = 1"],
    "key_concepts": ["Limits", "Derivatives", "Continuity"]
  },
  "raw_text": "Full extracted text...",
  "summary": "AI-generated summary...",
  "latex_formulas": [],
  "quizzes": ["quiz-789"],
  "flashcards": ["card-001", "card-002"],
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Delete Note

Delete a note and all associated data.

```http
DELETE /notes/{note_id}
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "message": "Note deleted successfully"
}
```

### Generate Summary

Generate a new summary for a note.

```http
POST /notes/{note_id}/summary
Authorization: Bearer <token>
Content-Type: application/json

{
  "content_id": "note-456",
  "summary_type": "detailed",
  "target_level": "intermediate",
  "max_length": 500
}
```

**Response (200 OK)**:

```json
{
  "content_id": "note-456",
  "summary": "Generated summary text...",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "reading_time": 3
}
```

### Search Notes

Search notes by content.

```http
POST /search
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "derivative rules",
  "filters": {
    "subject": "mathematics",
    "date_from": "2024-01-01"
  },
  "limit": 20,
  "offset": 0
}
```

**Response (200 OK)**:

```json
{
  "notes": [...],
  "total": 15,
  "query": "derivative rules"
}
```

---

## Quiz Endpoints

### Get Note Quizzes

Get all quizzes for a note.

```http
GET /notes/{note_id}/quizzes
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
[
  {
    "id": "quiz-789",
    "note_id": "note-456",
    "title": "Calculus Basics Quiz",
    "questions": [...],
    "total_points": 10,
    "estimated_time": 5
  }
]
```

### Generate Quiz

Generate a new quiz for a note.

```http
POST /notes/{note_id}/quizzes?num_questions=5&difficulty=intermediate
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "id": "quiz-new",
  "note_id": "note-456",
  "title": "Generated Quiz",
  "questions": [
    {
      "id": "q1",
      "type": "qcm",
      "question": "What is the derivative of x²?",
      "options": ["x", "2x", "x²", "2"],
      "correct_answer": "2x",
      "explanation": "Using the power rule...",
      "difficulty": "beginner",
      "related_concept": "Power Rule",
      "points": 1
    }
  ],
  "total_points": 5,
  "estimated_time": 5
}
```

### Submit Quiz

Submit answers and get results.

```http
POST /quizzes/{quiz_id}/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "quiz_id": "quiz-789",
  "answers": [
    {
      "question_id": "q1",
      "answer": "2x",
      "time_spent": 30
    }
  ],
  "started_at": "2024-01-15T10:00:00Z",
  "completed_at": "2024-01-15T10:05:00Z"
}
```

**Response (200 OK)**:

```json
{
  "quiz_id": "quiz-789",
  "score": 85.5,
  "total_points": 10,
  "earned_points": 8.5,
  "correct_answers": 8,
  "incorrect_answers": 2,
  "time_taken": 300,
  "detailed_feedback": [
    {
      "question_id": "q1",
      "is_correct": true,
      "correct_answer": "2x",
      "user_answer": "2x",
      "explanation": "...",
      "points_earned": 1
    }
  ],
  "weak_areas": ["Integration", "Chain Rule"],
  "recommendations": ["Review integration by parts", "Practice chain rule problems"]
}
```

---

## Flashcard Endpoints

### Get Due Flashcards

Get flashcards due for review.

```http
GET /flashcards/due
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
[
  {
    "id": "card-001",
    "note_id": "note-456",
    "front": "What is the derivative of x²?",
    "back": "2x",
    "difficulty": "beginner",
    "tags": ["calculus", "derivatives"],
    "next_review": "2024-01-15T10:00:00Z",
    "review_count": 5,
    "mastery_level": 0.7
  }
]
```

### Review Flashcard

Submit a review for a flashcard.

```http
POST /flashcards/{card_id}/review
Authorization: Bearer <token>
Content-Type: application/json

{
  "flashcard_id": "card-001",
  "difficulty_rating": 4,
  "reviewed_at": "2024-01-15T10:30:00Z"
}
```

**Response (200 OK)**:

```json
{
  "next_review": "2024-01-18T10:30:00Z",
  "days_until_review": 3
}
```

---

## User Endpoints

### Get Current User

Get current user profile.

```http
GET /user/me
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "id": "user-123",
  "email": "user@example.com",
  "full_name": "John Doe",
  "institution": "Example University",
  "cognitive_level": "intermediate",
  "preferred_subjects": ["mathematics", "physics"],
  "is_premium": false
}
```

### Get Progress

Get user learning progress.

```http
GET /user/progress
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "user_id": "user-123",
  "total_notes": 10,
  "total_quizzes_taken": 5,
  "average_score": 78.5,
  "study_streak": 3,
  "last_activity": "2024-01-15T10:30:00Z",
  "subject_distribution": {
    "mathematics": 5,
    "physics": 3
  },
  "analysis": {
    "strengths": ["Derivatives", "Limits"],
    "weaknesses": ["Integration"],
    "topic_scores": {...}
  }
}
```

### Get Recommendations

Get personalized study recommendations.

```http
GET /user/recommendations
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "recommendations": [
    {
      "type": "review",
      "priority": 10,
      "description": "Review 5 flashcards due today",
      "note_ids": ["note-456"],
      "estimated_time": 10,
      "reason": "Spaced repetition review due"
    }
  ],
  "focus_areas": ["Integration", "Chain Rule"],
  "suggested_difficulty": "intermediate"
}
```

---

## Course Session Endpoints

Multi-image capture sessions that merge multiple photos into a single consolidated note.

### Create Session

```http
POST /sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Cours d'Algèbre — Chapitre 3",
  "subject": "mathematics"
}
```

**Response (201 Created)**:

```json
{
  "id": "sess_abc123",
  "title": "Cours d'Algèbre — Chapitre 3",
  "subject": "mathematics",
  "status": "active",
  "captures": [],
  "final_note_id": null,
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

### List Sessions

```http
GET /sessions
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
[
  {
    "id": "sess_abc123",
    "title": "Cours d'Algèbre",
    "status": "active",
    "captures": [...],
    "final_note_id": null
  }
]
```

---

### Get Session

```http
GET /sessions/{session_id}
Authorization: Bearer <token>
```

---

### OCR a Capture (add photo to session)

Upload an image to a session. Returns extracted text immediately; the image is stored and queued for merge on finalization.

```http
POST /sessions/{session_id}/captures/ocr
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image binary>
```

**Response (200 OK)**:

```json
{
  "capture_id": "cap_xyz789",
  "session_id": "sess_abc123",
  "raw_text": "Le théorème de Pythagore stipule...",
  "image_url": "/images/cap_xyz789",
  "order": 1
}
```

---

### Update Capture Order / Metadata

```http
PATCH /sessions/{session_id}/captures/{capture_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "order": 2
}
```

---

### Finalize Session → Note

Merge all captures into a single note, run the full AI pipeline (structure, summary, quiz, flashcards), and mark the session as `completed`.

```http
POST /sessions/{session_id}/finalize
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "note_id": "note_def456",
  "session_id": "sess_abc123",
  "title": "Cours d'Algèbre — Chapitre 3",
  "summary": "...",
  "quizzes": ["quiz_001"],
  "flashcards": ["card_001", "card_002"]
}
```

---

## Utility Endpoints

### Get Subjects

Get list of available subject categories.

```http
GET /subjects
```

**Response (200 OK)**:

```json
{
  "subjects": [
    {"id": "mathematics", "name": "Mathematics"},
    {"id": "physics", "name": "Physics"},
    {"id": "chemistry", "name": "Chemistry"}
  ]
}
```

### Get Stats

Get user statistics.

```http
GET /stats
Authorization: Bearer <token>
```

**Response (200 OK)**:

```json
{
  "total_notes": 10,
  "total_quizzes": 5,
  "average_score": 78.5,
  "study_streak": 3,
  "subject_distribution": {...},
  "recent_activity": "2024-01-15T10:30:00Z"
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "detail": "Invalid request parameters"
}
```

### 401 Unauthorized

```json
{
  "detail": "Invalid or expired token"
}
```

### 403 Forbidden

```json
{
  "detail": "Authentication required"
}
```

### 404 Not Found

```json
{
  "detail": "Resource not found"
}
```

### 422 Validation Error

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error

```json
{
  "detail": "Internal server error"
}
```

---

## Rate Limiting

API endpoints are rate-limited:

- Authentication: 10 requests per minute
- Processing: 5 requests per minute
- All other endpoints: 100 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```
