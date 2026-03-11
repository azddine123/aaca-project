"""MongoDB database service.

Replaces Firebase Firestore as the primary database.
"""

import logging
from datetime import datetime
from typing import Any

from bson import ObjectId
from gridfs import GridFS, NoFile
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger("aaca")


def _sanitize(doc: Any) -> Any:
    """Recursively convert ObjectId → str so FastAPI/Pydantic can serialize."""
    if isinstance(doc, dict):
        return {k: _sanitize(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_sanitize(i) for i in doc]
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc


class MongoDBService:
    """MongoDB service for data persistence."""

    def __init__(self) -> None:
        self.client: MongoClient | None = None
        self.db: Database | None = None
        self.gridfs: GridFS | None = None
        self._connect()

    def _connect(self) -> None:
        """Connect to MongoDB."""
        try:
            self.client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
            self.db = self.client[settings.DATABASE_NAME]
            self.client.admin.command("ping")
            self.gridfs = GridFS(self.db)
            logger.info("✅ Connexion MongoDB réussie")
            self._create_indexes()
        except Exception as e:
            logger.error(f"❌ Erreur connexion MongoDB: {e}")
            logger.warning("⚠️ Utilisation du mode 'mock' - données non persistantes")
            self.client = None
            self.db = None

    def _create_indexes(self) -> None:
        """Create indexes for query optimization."""
        if self.db is None:
            return

        self.db.users.create_index("email", unique=True)
        self.db.notes.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        self.db.notes.create_index("subject")
        self.db.quizzes.create_index("note_id")
        self.db.quizzes.create_index("user_id")
        self.db.flashcards.create_index("note_id")
        self.db.flashcards.create_index([("user_id", ASCENDING), ("next_review", ASCENDING)])
        logger.info("✅ Index MongoDB créés")

    def _get_collection(self, name: str) -> Collection | None:
        """Get a collection by name."""
        if self.db is None:
            return None
        return self.db[name]

    @staticmethod
    def _generate_id() -> str:
        """Generate a unique ID."""
        return str(ObjectId())

    # ============== User Operations ==============

    async def create_user(self, user_data: dict[str, Any]) -> str:
        """Create a new user."""
        collection = self._get_collection("users")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        user_data["_id"] = ObjectId()
        user_data["id"] = str(user_data["_id"])
        user_data["created_at"] = datetime.now()
        user_data["updated_at"] = datetime.now()

        collection.insert_one(user_data)
        return user_data["id"]

    async def get_user(self, user_id: str) -> dict[str, Any] | None:
        """Get user by ID."""
        collection = self._get_collection("users")

        if collection is None:
            return None

        user = collection.find_one({"_id": ObjectId(user_id)})
        if user:
            user["id"] = str(user.pop("_id"))
            return _sanitize(user)
        return None

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        """Get user by email."""
        collection = self._get_collection("users")

        if collection is None:
            return None

        user = collection.find_one({"email": email.lower()})
        if user:
            user["id"] = str(user.pop("_id"))
            return _sanitize(user)
        return None

    async def update_user(self, user_id: str, update_data: dict[str, Any]) -> bool:
        """Update user data."""
        collection = self._get_collection("users")

        if collection is None:
            return False

        update_data["updated_at"] = datetime.now()
        result = collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
        )
        return result.modified_count > 0

    # ============== Note Operations ==============

    async def create_note(self, note_data: dict[str, Any]) -> str:
        """Create a new note."""
        collection = self._get_collection("notes")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        note_data["_id"] = ObjectId()
        note_data["id"] = str(note_data["_id"])
        note_data["created_at"] = datetime.now()
        note_data["updated_at"] = datetime.now()

        collection.insert_one(note_data)
        return note_data["id"]

    async def get_note(self, note_id: str) -> dict[str, Any] | None:
        """Get note by ID."""
        collection = self._get_collection("notes")

        if collection is None:
            return None

        note = collection.find_one({"_id": ObjectId(note_id)})
        if note:
            note["id"] = str(note.pop("_id"))
            return _sanitize(note)
        return None

    async def get_user_notes(
        self,
        user_id: str,
        subject: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Get all notes for a user."""
        collection = self._get_collection("notes")

        if collection is None:
            return []

        query = {"user_id": user_id}
        if subject:
            query["subject"] = subject

        notes = (
            collection.find(query)
            .sort("created_at", DESCENDING)
            .skip(offset)
            .limit(limit)
        )

        result = []
        for note in notes:
            note["id"] = str(note.pop("_id"))
            result.append(note)

        return _sanitize(result)

    async def update_note(self, note_id: str, update_data: dict[str, Any]) -> bool:
        """Update note data."""
        collection = self._get_collection("notes")

        if collection is None:
            return False

        update_data["updated_at"] = datetime.now()
        result = collection.update_one(
            {"_id": ObjectId(note_id)},
            {"$set": update_data},
        )
        return result.modified_count > 0

    async def delete_note(self, note_id: str) -> bool:
        """Delete a note."""
        collection = self._get_collection("notes")

        if collection is None:
            return False

        result = collection.delete_one({"_id": ObjectId(note_id)})
        return result.deleted_count > 0

    async def search_notes(
        self,
        user_id: str,
        query: str,
        filters: dict | None = None,
    ) -> list[dict[str, Any]]:
        """Search notes by content."""
        collection = self._get_collection("notes")

        if collection is None:
            return []

        search_query = {
            "user_id": user_id,
            "$or": [
                {"title": {"$regex": query, "$options": "i"}},
                {"raw_text": {"$regex": query, "$options": "i"}},
            ],
        }

        if filters and filters.get("subject"):
            search_query["subject"] = filters["subject"]

        notes = collection.find(search_query).limit(20)

        result = []
        for note in notes:
            note["id"] = str(note.pop("_id"))
            result.append(note)

        return _sanitize(result)

    # ============== Quiz Operations ==============

    async def create_quiz(self, quiz_data: dict[str, Any]) -> str:
        """Create a new quiz."""
        collection = self._get_collection("quizzes")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        quiz_data["_id"] = ObjectId()
        quiz_data["id"] = str(quiz_data["_id"])
        quiz_data["created_at"] = datetime.now()

        collection.insert_one(quiz_data)
        return quiz_data["id"]

    async def get_quiz(self, quiz_id: str) -> dict[str, Any] | None:
        """Get quiz by ID."""
        collection = self._get_collection("quizzes")

        if collection is None:
            return None

        quiz = collection.find_one({"_id": ObjectId(quiz_id)})
        if quiz:
            quiz["id"] = str(quiz.pop("_id"))
            return _sanitize(quiz)
        return None

    async def get_note_quizzes(self, note_id: str) -> list[dict[str, Any]]:
        """Get all quizzes for a note."""
        collection = self._get_collection("quizzes")

        if collection is None:
            return []

        quizzes = collection.find({"note_id": note_id})

        result = []
        for quiz in quizzes:
            quiz["id"] = str(quiz.pop("_id"))
            result.append(quiz)

        return _sanitize(result)

    async def save_quiz_result(self, result_data: dict[str, Any]) -> str:
        """Save quiz result."""
        collection = self._get_collection("quiz_results")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        result_data["_id"] = ObjectId()
        result_data["id"] = str(result_data["_id"])
        result_data["created_at"] = datetime.now()

        collection.insert_one(result_data)
        return result_data["id"]

    async def get_user_quiz_results(
        self,
        user_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Get quiz results for user."""
        collection = self._get_collection("quiz_results")

        if collection is None:
            return []

        results = (
            collection.find({"user_id": user_id})
            .sort("created_at", DESCENDING)
            .limit(limit)
        )

        result_list = []
        for result in results:
            result["id"] = str(result.pop("_id"))
            result_list.append(result)

        return _sanitize(result_list)

    # ============== Flashcard Operations ==============

    async def create_flashcards(
        self,
        note_id: str,
        flashcards: list[dict[str, Any]],
    ) -> list[str]:
        """Create flashcards for a note."""
        collection = self._get_collection("flashcards")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        ids = []
        now = datetime.now()

        for card in flashcards:
            card["_id"] = ObjectId()
            card["id"] = str(card["_id"])
            card["note_id"] = note_id
            card["created_at"] = now
            card["updated_at"] = now
            ids.append(card["id"])

        if flashcards:
            collection.insert_many(flashcards)

        return ids

    async def get_flashcards(
        self,
        note_id: str | None = None,
        due_only: bool = False,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get flashcards with optional filtering."""
        collection = self._get_collection("flashcards")

        if collection is None:
            return []

        query = {}
        if note_id:
            query["note_id"] = note_id

        if due_only:
            query["next_review"] = {"$lte": datetime.now()}

        cards = collection.find(query)

        result = []
        for card in cards:
            card["id"] = str(card.pop("_id"))
            result.append(card)

        if user_id:
            notes_collection = self._get_collection("notes")
            user_notes = list(notes_collection.find({"user_id": user_id}, {"_id": 1}))
            user_note_ids = {str(n["_id"]) for n in user_notes}
            result = [c for c in result if c.get("note_id") in user_note_ids]

        return _sanitize(result)

    async def get_flashcard(self, card_id: str) -> dict[str, Any] | None:
        """Get a single flashcard by ID."""
        collection = self._get_collection("flashcards")

        if collection is None:
            return None

        card = collection.find_one({"_id": ObjectId(card_id)})
        if card:
            card["id"] = str(card.pop("_id"))
            return _sanitize(card)
        return None

    async def update_flashcard(self, card_id: str, update_data: dict[str, Any]) -> bool:
        """Update flashcard."""
        collection = self._get_collection("flashcards")

        if collection is None:
            return False

        update_data["updated_at"] = datetime.now()
        result = collection.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": update_data},
        )
        return result.modified_count > 0

    # ============== Progress Operations ==============

    async def get_or_create_progress(self, user_id: str) -> dict[str, Any]:
        """Get or create user progress."""
        collection = self._get_collection("user_progress")

        if collection is None:
            return self._default_progress(user_id)

        progress = collection.find_one({"user_id": user_id})

        if progress:
            progress["id"] = str(progress.pop("_id"))
            return _sanitize(progress)

        progress = self._default_progress(user_id)
        progress["_id"] = ObjectId()
        progress["id"] = str(progress["_id"])

        collection.insert_one(progress)
        return _sanitize(progress)

    @staticmethod
    def _default_progress(user_id: str) -> dict[str, Any]:
        """Default progress template."""
        return {
            "user_id": user_id,
            "total_notes": 0,
            "total_quizzes_taken": 0,
            "average_score": 0.0,
            "study_streak": 0,
            "last_activity": None,
            "subject_distribution": {},
            "weak_areas": [],
            "strengths": [],
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

    async def update_progress(self, user_id: str, update_data: dict[str, Any]) -> bool:
        """Update user progress."""
        collection = self._get_collection("user_progress")

        if collection is None:
            return False

        update_data["updated_at"] = datetime.now()
        collection.update_one(
            {"user_id": user_id},
            {"$set": update_data},
            upsert=True,
        )
        return True

    # ============== Image Storage (GridFS) ==============

    async def upload_image(
        self,
        user_id: str,
        note_id: str,
        image_bytes: bytes,
        filename: str = "image.png",
    ) -> str:
        """Store image in GridFS and return a serving URL.

        Falls back to local storage if MongoDB is not connected.
        """
        if self.gridfs is not None:
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
            content_type = f"image/{ext}" if ext in ("jpg", "jpeg", "png", "webp", "gif") else "image/jpeg"
            file_id = self.gridfs.put(
                image_bytes,
                filename=filename,
                content_type=content_type,
                metadata={"user_id": user_id, "note_id": note_id},
            )
            return f"/images/{file_id}"

        # Fallback: local filesystem
        from app.services.local_storage import local_storage
        return await local_storage.upload_image(user_id, note_id, image_bytes, filename)

    async def get_image(self, file_id: str) -> tuple[bytes, str] | None:
        """Retrieve image bytes and content_type from GridFS.

        Returns (bytes, content_type) or None if not found.
        """
        if self.gridfs is None:
            return None
        try:
            grid_out = self.gridfs.get(ObjectId(file_id))
            return grid_out.read(), grid_out.content_type or "image/jpeg"
        except NoFile:
            return None


mongodb_service = MongoDBService()
