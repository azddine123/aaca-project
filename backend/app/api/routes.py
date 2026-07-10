"""Compatibility aggregator — the API routes now live in app.api.routers.*

Split by domain (2026-07-08):
  - app/api/routers/auth.py      — register/login/refresh, OTP flows, profile
  - app/api/routers/notes.py     — processing, note CRUD, RAG Q&A, search
  - app/api/routers/study.py     — quizzes, flashcards, progress, stats
  - app/api/routers/sessions.py  — multi-capture course sessions
  - app/api/routers/subjects.py  — user-owned subjects
  - app/api/routers/privacy.py   — GDPR export / account deletion

This module keeps the historical import surface (`router`, `limiter`,
`mongodb_service`, OTP helpers) so app.main and existing tests keep working.
"""

from app.api.routers import limiter, router  # noqa: F401
from app.api.routers.auth import (  # noqa: F401
    _generate_otp,
    _hash_otp,
    _issue_verification_otp,
    _verify_otp,
)
from app.services.mongodb_service import mongodb_service  # noqa: F401

__all__ = ["router", "limiter", "mongodb_service"]
