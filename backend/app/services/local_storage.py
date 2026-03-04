"""Local file storage service.

Replaces Firebase Storage for local image/file storage.
"""

import uuid
from pathlib import Path
from typing import Any

import aiofiles
from fastapi import UploadFile

STORAGE_DIR = Path(__file__).parent.parent.parent / "uploads"
STORAGE_DIR.mkdir(exist_ok=True)

BASE_URL = "http://localhost:8000/uploads"


class LocalStorageService:
    """Local file storage service."""

    def __init__(self) -> None:
        self.storage_dir = STORAGE_DIR
        self.storage_dir.mkdir(exist_ok=True)

    def _get_user_dir(self, user_id: str) -> Path:
        """Get or create user directory."""
        user_dir = self.storage_dir / user_id
        user_dir.mkdir(exist_ok=True)
        return user_dir

    async def upload_image(
        self,
        user_id: str,
        note_id: str,
        image_bytes: bytes,
        filename: str | None = None,
    ) -> str:
        """Save image locally.

        Returns:
            URL to access the image
        """
        if filename is None:
            filename = f"{uuid.uuid4()}.png"

        user_dir = self._get_user_dir(user_id)
        note_dir = user_dir / note_id
        note_dir.mkdir(exist_ok=True)

        file_path = note_dir / filename

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(image_bytes)

        return f"{BASE_URL}/{user_id}/{note_id}/{filename}"

    async def upload_file(
        self,
        user_id: str,
        file: UploadFile,
        folder: str = "general",
    ) -> str:
        """Upload file via UploadFile."""
        user_dir = self._get_user_dir(user_id)
        folder_dir = user_dir / folder
        folder_dir.mkdir(exist_ok=True)

        ext = Path(file.filename).suffix if file.filename else ".bin"
        filename = f"{uuid.uuid4()}{ext}"
        file_path = folder_dir / filename

        content = await file.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        return f"{BASE_URL}/{user_id}/{folder}/{filename}"

    def delete_file(self, file_path: str) -> bool:
        """Delete a file."""
        try:
            relative_path = file_path.replace(BASE_URL + "/", "")
            full_path = self.storage_dir / relative_path

            if full_path.exists():
                full_path.unlink()
                return True
            return False
        except Exception:
            return False

    def get_file_path(self, url: str) -> Path | None:
        """Convert URL to local path."""
        try:
            relative_path = url.replace(BASE_URL + "/", "")
            full_path = self.storage_dir / relative_path
            if full_path.exists():
                return full_path
            return None
        except Exception:
            return None


local_storage = LocalStorageService()
