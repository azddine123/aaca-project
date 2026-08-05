# PicLearn — Backend API

FastAPI service that powers PicLearn's AI pipeline: OCR, LaTeX extraction, subject classification, LLM content generation (summaries/quizzes/flashcards) and RAG-based Q&A over user notes.

See the [root README](../README.md) for the full project overview, screenshots and architecture diagram.

## Stack

| | |
|---|---|
| Framework | FastAPI + Uvicorn (async) |
| Language | Python 3.13 |
| Database | MongoDB (Motor / `AsyncIOMotorClient`) |
| Auth | JWT (`python-jose`) + `bcrypt` |
| OCR | PaddleOCR, EasyOCR, Tesseract (fallback), OpenAI Vision (low-confidence fallback) |
| LLM | OpenAI, Google Gemini, Anthropic Claude |
| RAG | ChromaDB + OpenAI embeddings |
| Rate limiting | SlowAPI |
| Tests | pytest / pytest-asyncio |

## Project structure

```
app/
├── api/
│   ├── routers/        # Routes by domain
│   │   ├── auth.py         # register/login/refresh, OTP flows, profile
│   │   ├── notes.py         # processing, note CRUD, RAG Q&A, search
│   │   ├── study.py         # quizzes, flashcards, progress, stats
│   │   ├── sessions.py      # multi-capture course sessions
│   │   ├── subjects.py      # user-owned subjects
│   │   ├── privacy.py       # GDPR export / account deletion
│   │   └── payments.py      # RevenueCat webhook + premium status
│   └── routes.py        # compatibility aggregator (historical import surface)
├── core/
│   ├── config.py         # Settings (pydantic-settings, reads .env)
│   ├── security.py       # JWT, password hashing
│   ├── exceptions.py      # ServiceUnavailableError -> HTTP 503
│   └── logging.py
├── models/
│   └── schemas.py        # Pydantic request/response models
├── services/
│   ├── pipeline.py         # orchestrates image -> OCR -> LaTeX -> classification -> content
│   ├── ocr_service.py       # dispatches to PaddleOCR / EasyOCR / custom OCR
│   ├── llm_service.py       # multi-provider generation (summary/quiz/flashcards)
│   ├── rag_service.py       # RAG Q&A, embeds + retrieves via ChromaDB
│   ├── embedding_service.py, vector_store_service.py
│   ├── subject_classifier.py, latex_service.py, image_processor.py, pdf_service.py
│   ├── mongodb_service.py   # DB layer (raises ServiceUnavailableError when disconnected)
│   ├── local_storage.py     # uploaded image storage
│   ├── adaptive_learning.py # SM-2 spaced repetition, recommendations
│   ├── gdpr_service.py      # account export/deletion orchestration
│   ├── payments_service.py  # RevenueCat webhook handling
│   └── note_creation.py     # shared capture/finalize note-creation flow
└── main.py               # FastAPI app, middleware, lifespan, image-serving routes
```

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in SECRET_KEY + at least one LLM API key
```

Requires MongoDB 7 running locally (or via `docker compose up -d` from the repo root).

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- Interactive docs (only when `DEBUG=true`): http://localhost:8000/docs
- Health check: `GET /health`

## Environment variables

Full reference in [.env.example](.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Required, ≥ 32 characters |
| `MONGODB_URL`, `DATABASE_NAME` | MongoDB connection |
| `OPENAI_API_KEY` / `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY` | At least one required for generation |
| `OCR_ENGINE`, `OCR_CONFIDENCE_THRESHOLD` | OCR engine and Vision-fallback threshold |
| `EMBEDDING_MODEL`, `VECTOR_STORE_DIR` | RAG embeddings + ChromaDB persistence path |
| `CORS_ORIGINS` | Strict allow-list — never `*` in production |
| `RATE_LIMIT_STORAGE_URI` | `memory://` by default; use Redis with multiple workers |
| `SMTP_*` | Email delivery for OTP codes (optional in dev — OTP is logged instead) |
| `REVENUECAT_WEBHOOK_SECRET`, `FREE_NOTES_MONTHLY_QUOTA` | Premium payments |

## Tests

```bash
source venv/bin/activate
python -m pytest -q
```

Runs against a mocked/disconnected DB by default; CI additionally spins up a real MongoDB 7 service container (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## Notes on local data

- `uploads/` — user-uploaded images, gitignored
- `vector_store/` — ChromaDB RAG index (real user note content), gitignored
