# AACA Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI ACADEMIC COGNITIVE ASSISTANT                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐     ┌──────────────────────────────────────────┐
│   FRONTEND (React Native│     │         BACKEND (FastAPI)                │
│         + Expo)         │     │                                          │
│                         │     │  ┌─────────────────────────────────────┐ │
│  ┌───────────────────┐  │     │  │         AI Pipeline                 │ │
│  │  Capture Screen   │  │     │  │  ┌─────────┐  ┌─────────┐          │ │
│  │  - Camera         │  │     │  │  │ OpenCV  │→ │  OCR    │          │ │
│  │  - Gallery        │  │     │  │  │Preprocess│  │(EasyOCR)│          │ │
│  └───────────────────┘  │     │  │  └─────────┘  └────┬────┘          │ │
│                         │     │  │                   ↓                  │ │
│  ┌───────────────────┐  │     │  │  ┌─────────┐  ┌─────────┐          │ │
│  │  Notes Screen     │  │     │  │  │  LaTeX  │→ │   LLM   │          │ │
│  │  - List/Search    │  │     │  │  │(Pix2Tex)│  │(GPT-4)  │          │ │
│  │  - Detail View    │  │     │  │  └─────────┘  └────┬────┘          │ │
│  └───────────────────┘  │     │  │                   ↓                  │ │
│                         │     │  │  ┌───────────────────────────────┐  │ │
│  ┌───────────────────┐  │     │  │  │  Content Generation           │  │ │
│  │  Study Screen     │  │     │  │  │  - Summaries                  │  │ │
│  │  - Flashcards     │  │     │  │  │  - Quizzes                    │  │ │
│  │  - Quizzes        │  │     │  │  │  - Flashcards                 │  │ │
│  └───────────────────┘  │     │  │  └───────────────────────────────┘  │ │
│                         │     │  └─────────────────────────────────────┘ │
│         ↓ HTTPS/JSON    │     │                   ↓                       │
│    ┌──────────────┐     │     │  ┌─────────────────────────────────────┐ │
│    │  API Client  │←────┼─────┼──┤  REST API (FastAPI)                 │ │
│    │  (Axios)     │     │     │  │  - /auth/*  Authentication          │ │
│    └──────────────┘     │     │  │  - /process/* Image Processing      │ │
│                         │     │  │  - /notes/* CRUD Operations         │ │
│  ┌───────────────────┐  │     │  │  - /quizzes/* Quiz Management       │ │
│  │  Zustand Stores   │  │     │  │  - /flashcards/* Flashcard Review   │ │
│  │  - AuthStore      │  │     │  └─────────────────────────────────────┘ │
│  │  - NotesStore     │  │     │                   ↓                       │
│  │  - QuizStore      │  │     │  ┌─────────────────────────────────────┐ │
│  │  - FlashcardStore │  │     │  │  Firebase                           │ │
│  └───────────────────┘  │     │  │  - Firestore (Database)             │ │
└─────────────────────────┘     │  │  - Storage (Images)                 │ │
                                │  └─────────────────────────────────────┘ │
                                └──────────────────────────────────────────┘
```

## Data Flow

### 1. Image Capture and Processing Flow

```
User captures image
       ↓
[Camera/Gallery] → Expo ImagePicker
       ↓
Frontend: CaptureScreen
       ↓
POST /process/capture (multipart/form-data)
       ↓
Backend Pipeline:
  1. ImagePreprocessor (OpenCV)
     - Perspective correction
     - Contrast enhancement
     - Noise reduction
  2. OCRService (EasyOCR)
     - Text extraction
     - Confidence scoring
  3. LaTeXService (Pix2Tex)
     - Formula detection
     - LaTeX conversion
  4. SubjectClassifier
     - Pattern matching
     - Keyword analysis
  5. LLMService (GPT-4/Gemini)
     - Content structuring
     - Summary generation
     - Quiz generation
     - Flashcard generation
       ↓
Firebase Storage (image)
Firebase Firestore (processed data)
       ↓
Response to Frontend
       ↓
Update NotesStore
```

### 2. Quiz Flow

```
User requests quiz for note
       ↓
Frontend: NoteDetailScreen
       ↓
POST /notes/{id}/quizzes
       ↓
LLMService.generate_quiz()
       ↓
Store in Firestore
       ↓
Frontend: QuizScreen
       ↓
User answers questions
       ↓
POST /quizzes/{id}/submit
       ↓
Calculate score, analyze errors
       ↓
Update UserProgress
       ↓
Response with results
       ↓
Frontend: QuizResultScreen
```

### 3. Flashcard Review Flow

```
User starts flashcard session
       ↓
GET /flashcards/due
       ↓
Filter cards with next_review <= now
       ↓
Frontend: FlashcardStudyScreen
       ↓
User reviews card (flip → rate)
       ↓
POST /flashcards/{id}/review
       ↓
Spaced Repetition Algorithm (SM-2)
  - Update easiness factor
  - Calculate next review date
  - Update mastery level
       ↓
Update Firestore
       ↓
Show next card
```

## Component Architecture

### Frontend State Management

```
┌─────────────────────────────────────────┐
│           Zustand Stores                │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────┐   ┌──────────────┐  │
│  │  AuthStore    │   │  NotesStore  │  │
│  │  ───────────  │   │  ──────────  │  │
│  │  • user       │   │  • notes[]   │  │
│  │  • tokens     │   │  • current   │  │
│  │  • login()    │   │  • fetch()   │  │
│  │  • logout()   │   │  • create()  │  │
│  └───────────────┘   └──────────────┘  │
│                                         │
│  ┌───────────────┐   ┌──────────────┐  │
│  │  QuizStore    │   │ FlashcardStore│  │
│  │  ───────────  │   │  ───────────  │  │
│  │  • currentQuiz│   │  • cards[]   │  │
│  │  • answers    │   │  • dueCards  │  │
│  │  • submit()   │   │  • review()  │  │
│  └───────────────┘   └──────────────┘  │
│                                         │
│  ┌───────────────┐                     │
│  │  StudyStore   │                     │
│  │  ───────────  │                     │
│  │  • progress   │                     │
│  │  • recommendations                  │
│  │  • stats      │                     │
│  └───────────────┘                     │
│                                         │
└─────────────────────────────────────────┘
```

### Backend Service Layer

```
┌─────────────────────────────────────────────┐
│              Service Layer                   │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         ImageProcessor              │    │
│  │  - preprocess()                     │    │
│  │  - detect_formula_regions()         │    │
│  │  - OpenCV operations                │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │          OCRService                 │    │
│  │  - extract_text()                   │    │
│  │  - EasyOCR / Tesseract              │    │
│  │  - Multi-language support           │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         LaTeXService                │    │
│  │  - extract_formulas()               │    │
│  │  - Pix2Tex integration              │    │
│  │  - LaTeX validation                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │     SubjectClassifier               │    │
│  │  - classify()                       │    │
│  │  - Pattern matching                 │    │
│  │  - 12 subject categories            │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         LLMService                  │    │
│  │  - Multi-provider (OpenAI/Google)   │    │
│  │  - structure_content()              │    │
│  │  - generate_summary()               │    │
│  │  - generate_quiz()                  │    │
│  │  - Response caching                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │    AdaptiveLearningService          │    │
│  │  - Spaced repetition (SM-2)         │    │
│  │  - Cognitive level calculation      │    │
│  │  - Recommendation generation        │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         DatabaseService             │    │
│  │  - Firebase Firestore wrapper       │    │
│  │  - CRUD operations                  │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

## Database Schema

### Firestore Collections

```
users/{userId}
├── id: string
├── email: string
├── full_name: string
├── institution: string
├── cognitive_level: string
├── preferred_subjects: string[]
├── created_at: timestamp
└── is_premium: boolean

notes/{noteId}
├── id: string
├── user_id: string (ref)
├── title: string
├── subject: string
├── tags: string[]
├── original_image_url: string
├── processed_content: map
│   ├── title: string
│   ├── sections: array
│   ├── definitions: array
│   ├── examples: array
│   └── key_concepts: array
├── raw_text: string
├── summary: string
├── latex_formulas: array
├── quizzes: string[] (refs)
├── flashcards: string[] (refs)
├── created_at: timestamp
└── cognitive_level: string

quizzes/{quizId}
├── id: string
├── note_id: string (ref)
├── title: string
├── questions: array
│   └── { id, type, question, options, correct_answer, explanation, difficulty, points }
├── total_points: number
├── estimated_time: number
└── created_at: timestamp

flashcards/{cardId}
├── id: string
├── note_id: string (ref)
├── front: string
├── back: string
├── difficulty: string
├── tags: string[]
├── last_reviewed: timestamp
├── next_review: timestamp
├── review_count: number
└── mastery_level: number

quiz_results/{resultId}
├── id: string
├── user_id: string (ref)
├── quiz_id: string (ref)
├── score: number
├── total_points: number
├── earned_points: number
├── correct_answers: number
├── incorrect_answers: number
├── time_taken: number
├── detailed_feedback: array
├── weak_areas: string[]
├── recommendations: string[]
└── created_at: timestamp

user_progress/{userId}
├── user_id: string
├── total_notes: number
├── total_quizzes_taken: number
├── average_score: number
├── study_streak: number
├── last_activity: timestamp
├── subject_distribution: map
├── weak_areas: string[]
└── strengths: string[]
```

## Security Architecture

### Authentication Flow

```
┌─────────┐      ┌─────────────┐      ┌─────────────┐
│  Client │ ───→ │  /auth/     │ ───→ │   Verify    │
│         │      │  login      │      │   Password  │
│         │      │             │      │   (bcrypt)  │
└─────────┘      └─────────────┘      └──────┬──────┘
     ↑                                        │
     │         ┌──────────────────────────────┘
     │         ↓
     │    ┌──────────┐
     └──← │  Return  │
          │  Tokens  │
          │  (JWT)   │
          └──────────┘
```

### JWT Token Structure

```json
{
  "sub": "user-id",
  "exp": 1234567890,
  "type": "access",
  "iat": 1234567800
}
```

### Authorization

- All protected routes use `get_current_user` dependency
- Token validation on every request
- Resource ownership verification
- CORS protection configured

## Performance Considerations

### Caching Strategy

1. **LLM Response Cache**: In-memory cache for identical prompts (TTL: 1 hour)
2. **Image Processing**: Processed images cached in memory during request
3. **Firebase**: Firestore offline persistence enabled on client

### Optimization Techniques

1. **Lazy Loading**: AI models loaded on first use
2. **Pagination**: API responses paginated (default: 50 items)
3. **Image Compression**: Images resized before processing (max: 2000px width)
4. **Debouncing**: Search input debounced (300ms)

## Scalability

### Horizontal Scaling

- Stateless backend design
- Firebase handles database scaling
- Cloud Storage for images
- Load balancer ready

### Future Improvements

1. Redis for distributed caching
2. Message queue for async processing
3. CDN for image delivery
4. Microservices architecture (optional)

## Monitoring & Logging

### Logging Levels

- INFO: General operations
- WARNING: Recoverable errors
- ERROR: Critical failures

### Key Metrics

- Processing time per image
- OCR confidence scores
- API response times
- Quiz completion rates
- Flashcard review accuracy
