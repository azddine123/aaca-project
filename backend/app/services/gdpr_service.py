"""GDPR orchestration service.

Coordinates the full account-deletion flow across storage backends
(MongoDB + GridFS, local uploads, RAG vector store) so that the DB layer
stays a pure DB layer and does not import higher-level services.
"""

import logging
import shutil
from pathlib import Path

from app.core.config import settings
from app.services.mongodb_service import mongodb_service

logger = logging.getLogger("aaca")


class GDPRService:

    async def export_user_data(self, user_id: str) -> dict:
        """Collect every document belonging to the user (GDPR Art. 20)."""
        return await mongodb_service.get_user_all_data(user_id)

    async def delete_user_account(self, user_id: str) -> dict[str, int]:
        """Delete the user's data everywhere (GDPR Art. 17).

        Returns the per-collection deletion counts from the DB layer,
        augmented with the local-uploads and RAG cleanup outcomes.
        """
        counts = await mongodb_service.delete_user_all_data(user_id)

        # Local filesystem uploads (uploads/<user_id>/...)
        local_deleted = 0
        try:
            upload_path = Path(settings.UPLOAD_DIR) / user_id
            if upload_path.exists():
                shutil.rmtree(upload_path)
                local_deleted = 1
        except Exception as e:
            logger.warning(f"Local upload deletion failed for user {user_id}: {e}")
        counts["local_uploads_dir"] = local_deleted

        # RAG vector store
        rag_deleted = 0
        try:
            from app.services.rag_service import rag_service
            await rag_service.delete_user_notes(user_id)
            rag_deleted = 1
        except Exception as e:
            logger.warning(f"RAG index deletion failed for user {user_id}: {e}")
        counts["rag_index"] = rag_deleted

        return counts


gdpr_service = GDPRService()
