"""Privacy / GDPR routes: data export (Art. 20) and account deletion (Art. 17)."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status

from app.core.security import get_current_user
from app.services.gdpr_service import gdpr_service

logger = logging.getLogger("aaca")
router = APIRouter(tags=["privacy"])


@router.get("/privacy/export")
async def export_user_data(current_user: str = Depends(get_current_user)) -> dict:
    """Export all personal data for the authenticated user (GDPR Art. 20)."""
    data = await gdpr_service.export_user_data(current_user)
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user,
        "data": data,
    }


@router.delete("/privacy/account", status_code=status.HTTP_200_OK)
async def delete_account(current_user: str = Depends(get_current_user)) -> dict:
    """Permanently delete the authenticated user's account and all associated data (GDPR Art. 17)."""
    summary = await gdpr_service.delete_user_account(current_user)
    return {
        "deleted": True,
        "user_id": current_user,
        "summary": summary,
    }
