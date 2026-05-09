# AACA Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                   AI ACADEMIC COGNITIVE ASSISTANT                    │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────────────────┐     ┌────────────────────────────────┐
│  FRONTEND                  │     │  BACKEND                       │
│  Expo SDK 54 / RN 0.81     │     │  Python 3.13 / FastAPI         │
│  expo-router 6             │     │                                │
│                            │     │  ┌────────────────────────┐   │
│  Screens                   │     │  │   AI Pipeline           │   │
│  ─────────                 │◄───►│  │  ImageProcessor (OpenCV)│   │
│  (tabs)/home.tsx           │REST │  │  OCR Service (EasyOCR)  │   │
│  (tabs)/notes.tsx          │ JWT │  │  LLM Service            │   │
│  (tabs)/study.tsx          │     │  │  RAG Service            │   │
│  capture.tsx               │     │  └────────────────────────┘   │
│  session-new.tsx           │     │                                │
│  note-detail.tsx           │     │  ┌────────────────────────┐   │
│                            │     │  │   Persistence           │   │
│  State / Context           │     │  │  MongoDB (Motor async)  │   │
│  ─────────────             │     │  │  GridFS (image storage) │   │
│  AuthContext               │     │  │  Local filesystem       │   │
│  NotesContext              │     │  │   (fallback)            │   │
│  StudyContext              │     │  └────────────────────────┘   │
│  AppearanceContext         │     │                                │
└────────────────────────────┘     └────────────────────────────────┘
```

---

## Frontend Stack

| Layer          | Technology                                   |
|----------------|----------------------------------------------|
| Framework      | Expo SDK 54 / React Native 0.81              |
| Navigation     | expo-router 6 (file-based)                   |
| Styling        | React Native StyleSheet + expo-linear-gradient|
| Icons          | @expo/vector-icons (MaterialCommunityIcons)  |
| Dates          | date-fns v4 with `fr` locale                 |
| State          | React Context (Auth, Notes, Study, Appearance)|
| HTTP           | `authFetch` wrapper from AuthContext          |

### Tab Structure
```
(tabs)/
  _layout.tsx   — custom tab bar (5 tabs + FAB centre)
  home.tsx      — dashboard: stats, subject pills, due flashcards
  notes.tsx     — note list + search
  snap.tsx      — FAB placeholder → redirects to /capture
  study.tsx     — flashcard flip (SM-2) + QCM quiz session
  profile.tsx   — user profile & settings
```

### Key Non-Tab Screens
```
capture.tsx       — single-image OCR flow (idle → ocr → review → done)
session-new.tsx   — multi-image course session (idle → capturing → finalizing → done)
note-detail.tsx   — note tabs: Résumé / Contenu / Étudier
```

---

## Backend Stack

| Layer          | Technology                                |
|----------------|-------------------------------------------|
| Framework      | FastAPI (async, Python 3.13)              |
| Database       | MongoDB via Motor (AsyncIOMotorClient)    |
| Image storage  | GridFS (primary) / local filesystem       |
| Auth           | JWT (HS256) via python-jose               |
| Password hash  | passlib/bcrypt                            |
| OCR            | EasyOCR                                   |
| Image proc.    | OpenCV + Pillow                           |
| LLM            | Multi-provider: OpenAI / Google / Anthropic claude-sonnet-4-6 |
| Vector search  | RAG service (ChromaDB or similar)         |
| Rate limiting  | slowapi                                   |

### Key Services

```
app/services/
  pipeline.py           — orchestrates OCR → LLM → note creation
  image_processor.py    — OpenCV pre-processing (perspective, contrast, denoise)
  ocr_service.py        — EasyOCR wrapper
  llm_service.py        — multi-provider LLM calls + cache + retry
  mongodb_service.py    — all MongoDB CRUD + GridFS
  rag_service.py        — vector index (index_note / remove_note / answer_question)
  adaptive_learning.py  — SM-2, strengths/weaknesses, recommendations
  local_storage.py      — fallback image storage
```

### MongoDB Collections

| Collection       | Purpose                                          |
|------------------|--------------------------------------------------|
| users            | User accounts (email unique index)               |
| notes            | Processed academic notes                         |
| quizzes          | Generated QCM quizzes (linked to notes)          |
| quiz_results     | Quiz submission history                          |
| flashcards       | SM-2 flashcards (next_review index)              |
| flashcard_reviews| Review history per card                          |
| user_progress    | Study streak, avg score, subject distribution    |
| sessions         | CourseSession metadata (multi-image flow)        |
| captures         | Individual image captures within a session       |

---

## Multi-Image Course Session Flow

The session flow allows a student to photograph multiple pages/boards of a lecture and merge them into one structured note.

```
Student                 Frontend              Backend              MongoDB
  │                        │                     │                    │
  │── Start session ───────►│                     │                    │
  │                        │── POST /sessions ───►│── create_session ──►│
  │                        │◄── { id, status:draft}│                   │
  │                        │                     │                    │
  │── Take photo 1 ────────►│                     │                    │
  │                        │── POST /sessions/{id}/captures/ocr ──────►│
  │                        │      (multipart image)                    │
  │                        │◄── Capture { id, raw_text, confidence }   │
  │── Edit OCR text ───────►│                     │                    │
  │                        │── PATCH /sessions/{id}/captures/{cid} ───►│
  │                        │                     │                    │
  │── Take photo 2 ─── (repeat) ────────────────────────────────────── │
  │                        │                     │                    │
  │── Finalize ─────────────►│                    │                    │
  │                        │── POST /sessions/{id}/finalize ──────────►│
  │                        │      LLM: merge_captures_to_course        │
  │                        │      LLM: generate_summary                │
  │                        │      LLM: generate_quiz (QCM only)        │
  │                        │      LLM: generate_flashcards             │
  │                        │◄── { note_id, quiz_id, flashcards_count } │
  │◄── Navigate to note ───│                     │                    │
```

---

## Single-Image Capture Flow

```
Photo → ImageProcessor → OCR → (user corrects text) → POST /notes/from-text
                                                              │
                                            LLM: structure_content
                                            LLM: generate_summary
                                            LLM: generate_quiz (QCM)
                                            LLM: generate_flashcards
                                            RAG: index_note
                                                              │
                                                        MongoDB: create_note
```

---

## SM-2 Spaced Repetition

Flashcard reviews use the SuperMemo 2 algorithm implemented in `adaptive_learning.py`:

```python
compute_sm2(card, rating 1-5) → {
    next_review: datetime,
    easiness_factor: float,   # starts at 2.5
    repetitions: int,
    interval: int,            # days
}
```

The `GET /flashcards/due` endpoint returns cards where `next_review ≤ now`, sorted by urgency, with a configurable `limit` (default 20, max 100).

---

## Authentication

- Registration: `POST /auth/register` → `{ access_token, refresh_token }`
- Login: `POST /auth/login` (form data) → `{ access_token, refresh_token }`
- Refresh: `POST /auth/refresh` (body: `{ refresh_token }`) → `{ access_token }`
- All protected routes require `Authorization: Bearer <access_token>`
- Access token TTL: 30 minutes; refresh token TTL: 30 days

---

## Error Handling

| Scenario                        | HTTP Status |
|---------------------------------|-------------|
| Resource not found / not owned  | 404         |
| Invalid credentials             | 401         |
| MongoDB not connected           | 503         |
| Rate limit exceeded             | 429         |
| File too large (>MAX_UPLOAD)    | 413         |
| Validation error                | 422         |

`ServiceUnavailableError` is raised by MongoDB write methods when `self.db is None` and mapped to 503 by the exception handler in `main.py`.

---

## Security

- CORS: strict allowlist (`_DEFAULT_DEV_ORIGINS`); `ValueError` in prod if `ALLOWED_ORIGINS` is not set
- Flashcard ownership: verified through parent note (`get_flashcard → get_note → check user_id`)
- Note delete: cascades to quizzes, flashcards, and RAG index
- Password hashing: bcrypt via passlib
- SQL/NoSQL injection: parameterized queries only (MongoDB driver handles escaping)
