"""MongoDB database service.

Replaces Firebase Firestore as the primary database.
"""

import logging
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from gridfs.errors import NoFile
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pymongo import ASCENDING, DESCENDING

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
        self.client: AsyncIOMotorClient | None = None
        self.db = None
        self.gridfs: AsyncIOMotorGridFSBucket | None = None
        self._connect()

    def _connect(self) -> None:
        """Connect to MongoDB."""
        try:
            self.client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
            self.db = self.client[settings.DATABASE_NAME]
            self.gridfs = AsyncIOMotorGridFSBucket(self.db)
            logger.info("✅ Connexion MongoDB réussie")
        except Exception as e:
            logger.error(f"❌ Erreur connexion MongoDB: {e}")
            logger.warning("⚠️ Utilisation du mode 'mock' - données non persistantes")
            self.client = None
            self.db = None

    async def _create_indexes(self) -> None:
        """Create indexes for query optimization."""
        if self.db is None:
            return

        await self.db.users.create_index("email", unique=True)
        await self.db.notes.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        await self.db.notes.create_index("subject")
        await self.db.notes.create_index(
            [("title", "text"), ("raw_text", "text")],
            default_language="french",
        )
        await self.db.quizzes.create_index("note_id")
        await self.db.quizzes.create_index("user_id")
        await self.db.flashcards.create_index("note_id")
        await self.db.flashcards.create_index([("user_id", ASCENDING), ("next_review", ASCENDING)])
        await self.db.sessions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        await self.db.captures.create_index([("session_id", ASCENDING), ("order", ASCENDING)])
        logger.info("✅ Index MongoDB créés")

    def _get_collection(self, name: str):
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

        await collection.insert_one(user_data)
        return user_data["id"]

    async def get_user(self, user_id: str) -> dict[str, Any] | None:
        """Get user by ID."""
        collection = self._get_collection("users")
        if collection is None:
            return None

        try:
            oid = ObjectId(user_id)
        except InvalidId:
            return None

        user = await collection.find_one({"_id": oid})
        if user:
            user["id"] = str(user.pop("_id"))
            return _sanitize(user)
        return None

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        """Get user by email."""
        collection = self._get_collection("users")
        if collection is None:
            return None

        user = await collection.find_one({"email": email.lower()})
        if user:
            user["id"] = str(user.pop("_id"))
            return _sanitize(user)
        return None

    async def update_user(self, user_id: str, update_data: dict[str, Any]) -> bool:
        """Update user data."""
        collection = self._get_collection("users")
        if collection is None:
            return False

        try:
            oid = ObjectId(user_id)
        except InvalidId:
            return False

        update_data["updated_at"] = datetime.now()
        result = await collection.update_one(
            {"_id": oid},
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

        await collection.insert_one(note_data)
        return note_data["id"]

    async def get_note(self, note_id: str) -> dict[str, Any] | None:
        """Get note by ID."""
        collection = self._get_collection("notes")
        if collection is None:
            return None

        try:
            oid = ObjectId(note_id)
        except InvalidId:
            return None

        note = await collection.find_one({"_id": oid})
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

        cursor = collection.find(query).sort("created_at", DESCENDING).skip(offset).limit(limit)
        notes = await cursor.to_list(length=limit)

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

        try:
            oid = ObjectId(note_id)
        except InvalidId:
            return False

        update_data["updated_at"] = datetime.now()
        result = await collection.update_one(
            {"_id": oid},
            {"$set": update_data},
        )
        return result.modified_count > 0

    async def delete_note(self, note_id: str) -> bool:
        """Delete a note."""
        collection = self._get_collection("notes")
        if collection is None:
            return False

        try:
            oid = ObjectId(note_id)
        except InvalidId:
            return False

        result = await collection.delete_one({"_id": oid})
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
        }

        if query.strip():
            search_query["$text"] = {"$search": query}

        if filters and filters.get("subject"):
            search_query["subject"] = filters["subject"]

        cursor = collection.find(search_query).limit(20)
        notes = await cursor.to_list(length=20)

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

        await collection.insert_one(quiz_data)
        return quiz_data["id"]

    async def get_quiz(self, quiz_id: str) -> dict[str, Any] | None:
        """Get quiz by ID."""
        collection = self._get_collection("quizzes")
        if collection is None:
            return None

        try:
            oid = ObjectId(quiz_id)
        except InvalidId:
            return None

        quiz = await collection.find_one({"_id": oid})
        if quiz:
            quiz["id"] = str(quiz.pop("_id"))
            return _sanitize(quiz)
        return None

    async def get_note_quizzes(self, note_id: str) -> list[dict[str, Any]]:
        """Get all quizzes for a note."""
        collection = self._get_collection("quizzes")
        if collection is None:
            return []

        cursor = collection.find({"note_id": note_id})
        quizzes = await cursor.to_list(length=None)

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

        await collection.insert_one(result_data)
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

        cursor = collection.find({"user_id": user_id}).sort("created_at", DESCENDING).limit(limit)
        results = await cursor.to_list(length=limit)

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
        user_id: str | None = None,
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
            if user_id:
                card["user_id"] = user_id
            card["created_at"] = now
            card["updated_at"] = now
            # SM-2 initialization — cards are due immediately from creation
            card.setdefault("next_review", now)
            card.setdefault("review_count", 0)
            card.setdefault("mastery_level", 0.0)
            card.setdefault("easiness_factor", 2.5)
            card.setdefault("repetitions", 0)
            card.setdefault("interval", 1)
            ids.append(card["id"])

        if flashcards:
            await collection.insert_many(flashcards)

        return ids

    async def get_flashcards(
        self,
        note_id: str | None = None,
        due_only: bool = False,
        user_id: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Get flashcards with optional filtering, sorted by next_review when due."""
        collection = self._get_collection("flashcards")
        if collection is None:
            return []

        query: dict = {}
        if note_id:
            query["note_id"] = note_id
        if user_id:
            query["user_id"] = user_id
        if due_only:
            query["next_review"] = {"$lte": datetime.now()}

        cursor = collection.find(query)
        if due_only:
            cursor = cursor.sort("next_review", ASCENDING)
        if limit is not None:
            cursor = cursor.limit(limit)

        cards = await cursor.to_list(length=limit)

        result = []
        for card in cards:
            card["id"] = str(card.pop("_id"))
            result.append(card)

        return _sanitize(result)

    async def count_flashcards(
        self,
        user_id: str | None = None,
        due_only: bool = False,
    ) -> int:
        """Count flashcards without fetching documents (efficient for stats)."""
        collection = self._get_collection("flashcards")
        if collection is None:
            return 0
        query: dict = {}
        if user_id:
            query["user_id"] = user_id
        if due_only:
            query["next_review"] = {"$lte": datetime.now()}
        return await collection.count_documents(query)

    async def save_flashcard_review(self, review_data: dict[str, Any]) -> str:
        """Persist a flashcard review entry (for SM-2 history)."""
        collection = self._get_collection("flashcard_reviews")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")
        review_data["_id"] = ObjectId()
        review_data["id"] = str(review_data["_id"])
        review_data["created_at"] = datetime.now()
        await collection.insert_one(review_data)
        return review_data["id"]

    async def get_flashcard(self, card_id: str) -> dict[str, Any] | None:
        """Get a single flashcard by ID."""
        collection = self._get_collection("flashcards")
        if collection is None:
            return None

        try:
            oid = ObjectId(card_id)
        except InvalidId:
            return None

        card = await collection.find_one({"_id": oid})
        if card:
            card["id"] = str(card.pop("_id"))
            return _sanitize(card)
        return None

    async def update_flashcard(self, card_id: str, update_data: dict[str, Any]) -> bool:
        """Update flashcard."""
        collection = self._get_collection("flashcards")
        if collection is None:
            return False

        try:
            oid = ObjectId(card_id)
        except InvalidId:
            return False

        update_data["updated_at"] = datetime.now()
        result = await collection.update_one(
            {"_id": oid},
            {"$set": update_data},
        )
        return result.modified_count > 0

    # ============== Progress Operations ==============

    async def get_or_create_progress(self, user_id: str) -> dict[str, Any]:
        """Get or create user progress."""
        collection = self._get_collection("user_progress")
        if collection is None:
            return self._default_progress(user_id)

        progress = await collection.find_one({"user_id": user_id})

        if progress:
            progress["id"] = str(progress.pop("_id"))
            return _sanitize(progress)

        progress = self._default_progress(user_id)
        progress["_id"] = ObjectId()
        progress["id"] = str(progress["_id"])

        await collection.insert_one(progress)
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
        await collection.update_one(
            {"user_id": user_id},
            {"$set": update_data},
            upsert=True,
        )
        return True

    # ============== Cascade Delete Helpers ==============

    async def delete_quizzes_by_note(self, note_id: str) -> int:
        """Delete all quizzes belonging to a note. Returns deleted count."""
        collection = self._get_collection("quizzes")
        if collection is None:
            return 0
        result = await collection.delete_many({"note_id": note_id})
        return result.deleted_count

    async def delete_flashcards_by_note(self, note_id: str) -> int:
        """Delete all flashcards belonging to a note. Returns deleted count."""
        collection = self._get_collection("flashcards")
        if collection is None:
            return 0
        result = await collection.delete_many({"note_id": note_id})
        return result.deleted_count

    async def delete_quiz_results_by_quiz_ids(self, quiz_ids: list[str]) -> int:
        """Delete quiz_results for the given quiz IDs. Returns deleted count."""
        if not quiz_ids:
            return 0
        collection = self._get_collection("quiz_results")
        if collection is None:
            return 0
        result = await collection.delete_many({"quiz_id": {"$in": quiz_ids}})
        return result.deleted_count

    async def delete_image_from_gridfs(self, file_id: str) -> bool:
        """Delete an image from GridFS by its file_id. Returns True if deleted."""
        if self.gridfs is None:
            return False
        try:
            oid = ObjectId(file_id)
        except InvalidId:
            return False
        try:
            await self.gridfs.delete(oid)
            return True
        except Exception:
            return False

    # ============== Course Session Operations ==============

    async def create_session(self, session_data: dict[str, Any]) -> str:
        """Create a new course session."""
        collection = self._get_collection("sessions")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        session_data["_id"] = ObjectId()
        session_data["id"] = str(session_data["_id"])
        session_data["created_at"] = datetime.now()
        session_data["updated_at"] = datetime.now()

        await collection.insert_one(session_data)
        return session_data["id"]

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Get a course session by ID."""
        collection = self._get_collection("sessions")
        if collection is None:
            return None

        try:
            oid = ObjectId(session_id)
        except InvalidId:
            return None

        session = await collection.find_one({"_id": oid})
        if session:
            session["id"] = str(session.pop("_id"))
            return _sanitize(session)
        return None

    async def get_user_sessions(self, user_id: str) -> list[dict[str, Any]]:
        """Get all sessions for a user, newest first."""
        collection = self._get_collection("sessions")
        if collection is None:
            return []

        cursor = collection.find({"user_id": user_id}).sort("created_at", DESCENDING)
        sessions = await cursor.to_list(length=None)

        result = []
        for s in sessions:
            s["id"] = str(s.pop("_id"))
            result.append(s)

        return _sanitize(result)

    async def update_session(self, session_id: str, update_data: dict[str, Any]) -> bool:
        """Update a course session."""
        collection = self._get_collection("sessions")
        if collection is None:
            return False

        try:
            oid = ObjectId(session_id)
        except InvalidId:
            return False

        update_data["updated_at"] = datetime.now()
        result = await collection.update_one(
            {"_id": oid},
            {"$set": update_data},
        )
        return result.modified_count > 0

    # ============== Capture Operations ==============

    async def create_capture(self, capture_data: dict[str, Any]) -> str:
        """Create a new capture within a session."""
        collection = self._get_collection("captures")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        capture_data["_id"] = ObjectId()
        capture_data["id"] = str(capture_data["_id"])
        capture_data["created_at"] = datetime.now()

        await collection.insert_one(capture_data)
        return capture_data["id"]

    async def get_capture(self, capture_id: str) -> dict[str, Any] | None:
        """Get a capture by ID."""
        collection = self._get_collection("captures")
        if collection is None:
            return None

        try:
            oid = ObjectId(capture_id)
        except InvalidId:
            return None

        capture = await collection.find_one({"_id": oid})
        if capture:
            capture["id"] = str(capture.pop("_id"))
            return _sanitize(capture)
        return None

    async def get_session_captures(self, session_id: str) -> list[dict[str, Any]]:
        """Get all captures for a session, ordered by `order` ASC."""
        collection = self._get_collection("captures")
        if collection is None:
            return []

        cursor = collection.find({"session_id": session_id}).sort("order", ASCENDING)
        captures = await cursor.to_list(length=None)

        result = []
        for c in captures:
            c["id"] = str(c.pop("_id"))
            result.append(c)

        return _sanitize(result)

    async def update_capture(self, capture_id: str, update_data: dict[str, Any]) -> bool:
        """Update a capture (e.g. corrected_text)."""
        collection = self._get_collection("captures")
        if collection is None:
            return False

        try:
            oid = ObjectId(capture_id)
        except InvalidId:
            return False

        result = await collection.update_one(
            {"_id": oid},
            {"$set": update_data},
        )
        return result.modified_count > 0

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
            file_id = await self.gridfs.upload_from_stream(
                filename,
                image_bytes,
                metadata={"user_id": user_id, "note_id": note_id, "contentType": content_type},
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
            oid = ObjectId(file_id)
        except InvalidId:
            return None

        try:
            stream = await self.gridfs.open_download_stream(oid)
            data = await stream.read()
            meta = stream.metadata or {}
            content_type = meta.get("contentType", "image/jpeg")
            return data, content_type
        except NoFile:
            return None


mongodb_service = MongoDBService()
