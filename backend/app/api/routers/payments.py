"""Payment routes: RevenueCat webhook and premium status."""

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.config import settings
from app.core.security import get_current_user
from app.services.mongodb_service import mongodb_service
from app.services.payments_service import payments_service

router = APIRouter(tags=["payments"])


@router.post("/payments/webhook/revenuecat")
async def revenuecat_webhook(
    payload: dict,
    authorization: str | None = Header(None),
) -> dict:
    """Receive RevenueCat subscription events."""
    if not settings.REVENUECAT_WEBHOOK_SECRET or not secrets.compare_digest(
        authorization or "", settings.REVENUECAT_WEBHOOK_SECRET
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook secret")

    await payments_service.handle_revenuecat_event(payload)
    return {"received": True}


@router.get("/payments/status")
async def payment_status(current_user: str = Depends(get_current_user)) -> dict:
    """Return premium status and monthly note quota usage."""
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    notes_used = await mongodb_service.get_monthly_note_count(current_user)
    return {
        "is_premium": user.get("is_premium", False),
        "notes_used_this_month": notes_used,
        "notes_quota": settings.FREE_NOTES_MONTHLY_QUOTA,
    }
