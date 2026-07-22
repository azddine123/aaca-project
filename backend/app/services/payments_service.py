"""RevenueCat webhook handling."""

import logging

from app.services.mongodb_service import mongodb_service

logger = logging.getLogger("aaca")

_PREMIUM_ON = {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"}
_PREMIUM_OFF = {"CANCELLATION", "EXPIRATION", "BILLING_ISSUE"}


class PaymentsService:
    """Mirror RevenueCat subscription events onto user premium status."""

    async def handle_revenuecat_event(self, payload: dict) -> None:
        """Update ``user.is_premium`` from a RevenueCat webhook payload."""
        event = payload.get("event", {})
        event_type = event.get("type")
        app_user_id = event.get("app_user_id")

        if not app_user_id:
            logger.warning("RevenueCat webhook missing app_user_id (type=%s)", event_type)
            return

        if event_type in _PREMIUM_ON:
            is_premium = True
        elif event_type in _PREMIUM_OFF:
            is_premium = False
        else:
            logger.info("RevenueCat webhook ignored: unhandled event type %s", event_type)
            return

        user = await mongodb_service.get_user(app_user_id)
        if not user:
            logger.warning("RevenueCat webhook: unknown app_user_id %s", app_user_id)
            return

        await mongodb_service.update_user(app_user_id, {"is_premium": is_premium})


payments_service = PaymentsService()
