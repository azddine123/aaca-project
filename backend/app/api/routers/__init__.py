"""Domain routers assembled into the single API router.

Each module owns one domain; paths keep their full historical prefixes so
the public API is byte-for-byte identical to the pre-split monolith.
"""

from fastapi import APIRouter

from app.api.routers import auth, notes, privacy, sessions, study, subjects
from app.api.routers.common import limiter

router = APIRouter()
for _module in (auth, notes, study, sessions, subjects, privacy):
    router.include_router(_module.router)

__all__ = ["router", "limiter"]
