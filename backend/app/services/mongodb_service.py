"""MongoDB database service.

Replaces Firebase Firestore as the primary database.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from gridfs.errors import NoFile
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pymongo import ASCENDING, DESCENDING

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger("aaca")

# ── User subject defaults created on first use ────────────────────────────────
_DEFAULT_SUBJECTS: list[dict] = [
    {"name": "Maths",        "color": "#1B4FD8", "icon": "function-variant"},
    {"name": "Informatique", "color": "#2563EB", "icon": "code-braces"},
    {"name": "Physique",     "color": "#7C3AED", "icon": "atom"},
    {"name": "Autre",        "color": "#6B7280", "icon": "file-document-outline"},
    {"name": "À classer",   "color": "#F59E0B", "icon": "inbox-outline"},
]

# Map AI classifier output → default user subject name
AI_SUBJECT_MAP: dict[str, str] = {
    "mathematics":     "Maths",
    "physics":         "Physique",
    "chemistry":       "Physique",
    "biology":         "Autre",
    "computer_science":"Informatique",
    "cs":              "Informatique",
    "engineering":     "Informatique",
    "economics":       "Autre",
    "literature":      "Autre",
    "history":         "Autre",
    "philosophy":      "Autre",
    "other":           "Autre",
}

LOW_CONFIDENCE_THRESHOLD = 0.35


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
        self._connected: bool = False
        self._connect()

    def _connect(self) -> None:
        """Initialise Motor client objects (lazy — no network call yet)."""
        try:
            self.client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
            self.db = self.client[settings.DATABASE_NAME]
            self.gridfs = AsyncIOMotorGridFSBucket(self.db)
        except Exception as e:
            logger.error(f"❌ Erreur initialisation MongoDB: {e}")
            self.client = None
            self.db = None

    async def ping(self) -> bool:
        """Test actual MongoDB connectivity using a short-timeout client.

        Sets self._connected and returns True if reachable.
        Called once at startup; safe to call again after a failure.
        Always returns within ~2 s whether MongoDB is up or down.
        """
        import asyncio
        tmp = None
        try:
            tmp = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=1500)
            await asyncio.wait_for(tmp.admin.command("ping"), timeout=2.0)
            self._connected = True
            logger.info("✅ MongoDB ping OK")
            return True
        except Exception as e:
            self._connected = False
            logger.warning(f"⚠️ MongoDB indisponible: {e}")
            return False
        finally:
            if tmp is not None:
                try:
                    tmp.close()
                except Exception:
                    pass

    async def _create_indexes(self) -> None:
        """Create indexes for query optimization."""
        if self.db is None:
            return

        await self.db.users.create_index("email", unique=True)
        await self.db.notes.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        await self.db.notes.create_index("subject")
        await self.db.notes.create_index("subject_id")
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
        await self.db.subjects.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        await self.db.password_reset_otps.create_index(
            [("email", ASCENDING), ("expires_at", ASCENDING)]
        )
        await self.db.password_reset_otps.create_index(
            "expires_at", expireAfterSeconds=0
        )
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
            "created_at": datetime.now(timezone.utc),
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

    async def delete_capture(self, capture_id: str) -> bool:
        """Delete a capture by ID. Returns True if deleted, False otherwise."""
        collection = self._get_collection("captures")
        if collection is None:
            return False

        try:
            oid = ObjectId(capture_id)
        except InvalidId:
            return False

        result = await collection.delete_one({"_id": oid})
        return result.deleted_count > 0

    async def reindex_session_captures(self, session_id: str) -> None:
        """Re-assign sequential order values to remaining captures of a session."""
        collection = self._get_collection("captures")
        if collection is None:
            return

        cursor = collection.find({"session_id": session_id}).sort("order", ASCENDING)
        captures = await cursor.to_list(length=None)
        for idx, cap in enumerate(captures):
            await collection.update_one({"_id": cap["_id"]}, {"$set": {"order": idx}})

    # ============== Image Storage (GridFS) ==============

    async def upload_image(
        self,
        user_id: str,
        note_id: str,
        image_bytes: bytes,
        filename: str = "image.png",
        *,
        session_id: str | None = None,
        capture_id: str | None = None,
        image_type: str = "original",
    ) -> str:
        """Store image in GridFS and return a serving URL.

        Uses GridFS only when actually connected. Falls back to local storage
        on disconnection or if the GridFS upload fails at runtime.
        """
        from app.services.local_storage import local_storage

        if self._connected and self.gridfs is not None:
            try:
                ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
                content_type = f"image/{ext}" if ext in ("jpg", "jpeg", "png", "webp", "gif") else "image/jpeg"
                file_id = await self.gridfs.upload_from_stream(
                    filename,
                    image_bytes,
                    metadata={
                        "user_id": user_id,
                        "note_id": note_id,
                        "session_id": session_id,
                        "capture_id": capture_id,
                        "image_type": image_type,
                        "contentType": content_type,
                    },
                )
                return f"/images/{file_id}"
            except Exception as e:
                logger.error(f"❌ GridFS upload failed, falling back to local storage: {e}")

        return await local_storage.upload_image(user_id, note_id, image_bytes, filename)

    # ============== RGPD Operations ==============

    async def get_user_all_data(self, user_id: str) -> dict[str, Any]:
        """Aggregate all data belonging to user_id for GDPR export.

        Returns a dict with one key per collection. password_hash is stripped.
        """
        result: dict[str, Any] = {}

        user = await self.get_user(user_id)
        if user:
            user.pop("password_hash", None)
        result["user"] = user

        async def _fetch(col: str, query: dict) -> list:
            collection = self._get_collection(col)
            if collection is None:
                return []
            docs = await collection.find(query).to_list(length=None)
            for d in docs:
                d["id"] = str(d.pop("_id"))
            return _sanitize(docs)

        result["notes"]             = await _fetch("notes",            {"user_id": user_id})
        result["subjects"]          = await _fetch("subjects",         {"user_id": user_id})
        result["quizzes"]           = await _fetch("quizzes",          {"user_id": user_id})
        result["quiz_results"]      = await _fetch("quiz_results",     {"user_id": user_id})
        result["flashcards"]        = await _fetch("flashcards",       {"user_id": user_id})
        result["flashcard_reviews"] = await _fetch("flashcard_reviews",{"user_id": user_id})
        result["sessions"]          = await _fetch("sessions",         {"user_id": user_id})
        result["captures"]          = await _fetch("captures",         {"user_id": user_id})

        progress_col = self._get_collection("user_progress")
        if progress_col is not None:
            p = await progress_col.find_one({"user_id": user_id})
            if p:
                p["id"] = str(p.pop("_id"))
                result["user_progress"] = _sanitize(p)
            else:
                result["user_progress"] = None
        else:
            result["user_progress"] = None

        return result

    async def delete_user_all_data(self, user_id: str) -> dict[str, int]:
        """Delete ALL data belonging to user_id. Returns counts per collection.

        Cascades: notes → quizzes/flashcards/quiz_results, then user doc.
        Never touches other users' data.
        """
        counts: dict[str, int] = {}

        async def _del(col: str, query: dict) -> int:
            collection = self._get_collection(col)
            if collection is None:
                return 0
            res = await collection.delete_many(query)
            return res.deleted_count

        # Collect note-level quiz/flashcard IDs for cascade
        notes_col = self._get_collection("notes")
        note_ids: list[str] = []
        if notes_col is not None:
            async for doc in notes_col.find({"user_id": user_id}, {"_id": 1}):
                note_ids.append(str(doc["_id"]))

        # Delete quiz_results for quizzes linked to user notes
        quiz_ids: list[str] = []
        quizzes_col = self._get_collection("quizzes")
        if quizzes_col is not None and note_ids:
            async for doc in quizzes_col.find({"note_id": {"$in": note_ids}}, {"_id": 1}):
                quiz_ids.append(str(doc["_id"]))

        if quiz_ids:
            counts["quiz_results_cascade"] = await _del("quiz_results", {"quiz_id": {"$in": quiz_ids}})

        # Also delete quiz_results linked directly to user_id
        counts["quiz_results"] = await _del("quiz_results", {"user_id": user_id})

        # Delete flashcard reviews for user flashcards
        fc_ids: list[str] = []
        fc_col = self._get_collection("flashcards")
        if fc_col is not None:
            async for doc in fc_col.find({"user_id": user_id}, {"_id": 1}):
                fc_ids.append(str(doc["_id"]))
        if fc_ids:
            counts["flashcard_reviews"] = await _del(
                "flashcard_reviews", {"flashcard_id": {"$in": fc_ids}}
            )
        else:
            counts["flashcard_reviews"] = 0

        counts["flashcards"] = await _del("flashcards", {"user_id": user_id})
        counts["quizzes"]    = await _del("quizzes",    {"user_id": user_id})
        counts["notes"]      = await _del("notes",      {"user_id": user_id})
        counts["subjects"]   = await _del("subjects",   {"user_id": user_id})
        counts["sessions"]   = await _del("sessions",   {"user_id": user_id})
        counts["captures"]   = await _del("captures",   {"user_id": user_id})
        counts["user_progress"] = await _del("user_progress", {"user_id": user_id})

        # Delete GridFS images belonging to user
        gridfs_deleted = 0
        if self.gridfs is not None and self._connected:
            try:
                files_col = self.db["fs.files"]
                async for doc in files_col.find({"metadata.user_id": user_id}, {"_id": 1}):
                    try:
                        await self.gridfs.delete(doc["_id"])
                        gridfs_deleted += 1
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f"GridFS user deletion partial: {e}")
        counts["gridfs_images"] = gridfs_deleted

        # Delete local uploads directory for user
        local_deleted = 0
        try:
            import shutil
            from pathlib import Path
            upload_path = Path(settings.UPLOAD_DIR) / user_id
            if upload_path.exists():
                shutil.rmtree(upload_path)
                local_deleted = 1
        except Exception as e:
            logger.warning(f"Local upload deletion failed for user {user_id}: {e}")
        counts["local_uploads_dir"] = local_deleted

        # Delete RAG index entries
        rag_deleted = 0
        try:
            from app.services.rag_service import rag_service
            await rag_service.delete_user_notes(user_id)
            rag_deleted = 1
        except Exception as e:
            logger.warning(f"RAG index deletion failed for user {user_id}: {e}")
        counts["rag_index"] = rag_deleted

        # Delete user document last
        user_col = self._get_collection("users")
        if user_col is not None:
            try:
                oid = ObjectId(user_id)
                res = await user_col.delete_one({"_id": oid})
                counts["user"] = res.deleted_count
            except Exception:
                counts["user"] = 0
        else:
            counts["user"] = 0

        return counts

    # ============== Subject Operations ==============

    async def create_subject(self, user_id: str, data: dict[str, Any]) -> str:
        """Create a user-owned subject."""
        collection = self._get_collection("subjects")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")
        data = dict(data)
        data["_id"] = ObjectId()
        data["id"] = str(data["_id"])
        data["user_id"] = user_id
        data["created_at"] = datetime.now()
        data["updated_at"] = datetime.now()
        await collection.insert_one(data)
        return data["id"]

    async def get_subject(self, subject_id: str) -> dict[str, Any] | None:
        """Get subject by ID."""
        collection = self._get_collection("subjects")
        if collection is None:
            return None
        try:
            oid = ObjectId(subject_id)
        except InvalidId:
            return None
        doc = await collection.find_one({"_id": oid})
        if doc:
            doc["id"] = str(doc.pop("_id"))
            return _sanitize(doc)
        return None

    async def get_user_subjects(self, user_id: str) -> list[dict[str, Any]]:
        """Get all subjects for a user ordered by creation date."""
        collection = self._get_collection("subjects")
        if collection is None:
            return []
        cursor = collection.find({"user_id": user_id}).sort("created_at", ASCENDING)
        docs = await cursor.to_list(length=None)
        result = []
        for d in docs:
            d["id"] = str(d.pop("_id"))
            result.append(d)
        return _sanitize(result)

    async def get_user_subject_by_name(self, user_id: str, name: str) -> dict[str, Any] | None:
        """Case-insensitive name lookup within a user's subjects."""
        subjects = await self.get_user_subjects(user_id)
        target = name.strip().lower()
        for s in subjects:
            if s["name"].strip().lower() == target:
                return s
        return None

    async def get_or_create_default_subjects(self, user_id: str) -> list[dict[str, Any]]:
        """Return user subjects, creating the 5 defaults if none exist yet."""
        subjects = await self.get_user_subjects(user_id)
        if subjects:
            return subjects
        for sdata in _DEFAULT_SUBJECTS:
            try:
                await self.create_subject(user_id, dict(sdata))
            except Exception:
                pass  # ignore concurrent creation
        return await self.get_user_subjects(user_id)

    async def update_subject(self, subject_id: str, update_data: dict[str, Any]) -> bool:
        """Update a subject's fields."""
        collection = self._get_collection("subjects")
        if collection is None:
            return False
        try:
            oid = ObjectId(subject_id)
        except InvalidId:
            return False
        update_data["updated_at"] = datetime.now()
        result = await collection.update_one({"_id": oid}, {"$set": update_data})
        return result.modified_count > 0

    async def delete_subject(self, subject_id: str) -> bool:
        """Delete a subject document."""
        collection = self._get_collection("subjects")
        if collection is None:
            return False
        try:
            oid = ObjectId(subject_id)
        except InvalidId:
            return False
        result = await collection.delete_one({"_id": oid})
        return result.deleted_count > 0

    async def count_notes_by_subject_id(self, subject_id: str) -> int:
        """Count notes referencing a given subject_id."""
        collection = self._get_collection("notes")
        if collection is None:
            return 0
        return await collection.count_documents({"subject_id": subject_id})

    async def transfer_notes_subject(
        self,
        from_subject_id: str,
        to_subject_id: str,
        to_subject_name: str,
        user_id: str,
    ) -> int:
        """Reassign notes from one subject to another (used before subject delete)."""
        collection = self._get_collection("notes")
        if collection is None:
            return 0
        result = await collection.update_many(
            {"subject_id": from_subject_id, "user_id": user_id},
            {"$set": {
                "subject_id": to_subject_id,
                "subject_name": to_subject_name,
                "subject_source": "manual_changed",
                "updated_at": datetime.now(),
            }},
        )
        return result.modified_count

    async def get_image(self, file_id: str) -> tuple[bytes, str, str] | None:
        """Retrieve image bytes, content_type and owner user_id from GridFS.

        Returns (bytes, content_type, user_id) or None if not found.
        """
        if self.gridfs is None or not self._connected:
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
            owner_id = meta.get("user_id", "")
            return data, content_type, owner_id
        except NoFile:
            return None

    async def get_gridfs_file_owner(self, file_id: str) -> str | None:
        """Return the owner user_id for a GridFS file without downloading it."""
        if self.db is None or not self._connected:
            return None
        try:
            oid = ObjectId(file_id)
        except InvalidId:
            return None
        doc = await self.db["fs.files"].find_one(
            {"_id": oid},
            {"metadata.user_id": 1},
        )
        if not doc:
            return None
        return (doc.get("metadata") or {}).get("user_id")

    async def get_session_by_final_note_id(self, note_id: str) -> dict[str, Any] | None:
        """Find a session that produced the given final note."""
        collection = self._get_collection("sessions")
        if collection is None:
            return None
        session = await collection.find_one({"final_note_id": note_id})
        if session:
            session["id"] = str(session.pop("_id"))
            return _sanitize(session)
        return None

    async def get_gridfs_files_for_note(self, note_id: str) -> list[dict]:
        """Query fs.files for all GridFS entries whose metadata.note_id matches.

        Returns a list of dicts with keys: file_id, image_type, filename.
        Used as fallback when the note document lacks image URL fields.
        """
        if self.db is None or not self._connected:
            return []
        try:
            cursor = self.db["fs.files"].find(
                {"metadata.note_id": note_id},
                {"_id": 1, "filename": 1, "metadata": 1},
            )
            results = []
            async for doc in cursor:
                results.append({
                    "file_id": str(doc["_id"]),
                    "image_type": doc.get("metadata", {}).get("image_type", "original"),
                    "filename": doc.get("filename", "image"),
                })
            return results
        except Exception as e:
            logger.warning(f"GridFS files query failed: {e}")
            return []

    # ============== Password Reset OTP Operations ==============

    async def create_password_reset_otp(
        self,
        email: str,
        otp_hash: str,
        otp_salt: str,
        expires_at: datetime,
    ) -> str:
        """Invalidate any previous OTP for this email, then store the new one."""
        collection = self._get_collection("password_reset_otps")
        if collection is None:
            raise ServiceUnavailableError("MongoDB")

        # Mark all previous OTPs for this email as used
        await collection.update_many(
            {"email": email.lower(), "used": False},
            {"$set": {"used": True}},
        )

        doc = {
            "_id": ObjectId(),
            "email": email.lower(),
            "otp_hash": otp_hash,
            "otp_salt": otp_salt,
            "expires_at": expires_at,
            "attempts": 0,
            "used": False,
            "created_at": datetime.now(timezone.utc),
        }
        doc["id"] = str(doc["_id"])
        await collection.insert_one(doc)
        return doc["id"]

    async def get_valid_password_reset_otp(self, email: str) -> dict[str, Any] | None:
        """Return the latest valid (not used, not expired, attempts < max) OTP for email."""
        from app.core.config import settings as _settings
        collection = self._get_collection("password_reset_otps")
        if collection is None:
            return None

        doc = await collection.find_one(
            {
                "email": email.lower(),
                "used": False,
                "expires_at": {"$gt": datetime.now(timezone.utc)},
                "attempts": {"$lt": _settings.PASSWORD_RESET_OTP_MAX_ATTEMPTS},
            },
            sort=[("created_at", DESCENDING)],
        )
        if doc:
            doc["id"] = str(doc.pop("_id"))
            return _sanitize(doc)
        return None

    async def increment_password_reset_attempts(self, otp_id: str) -> bool:
        """Increment the failed-attempt counter for an OTP record."""
        collection = self._get_collection("password_reset_otps")
        if collection is None:
            return False
        try:
            oid = ObjectId(otp_id)
        except InvalidId:
            return False
        result = await collection.update_one(
            {"_id": oid},
            {"$inc": {"attempts": 1}},
        )
        return result.modified_count > 0

    async def mark_password_reset_otp_used(self, otp_id: str) -> bool:
        """Mark an OTP as used (consumed)."""
        collection = self._get_collection("password_reset_otps")
        if collection is None:
            return False
        try:
            oid = ObjectId(otp_id)
        except InvalidId:
            return False
        result = await collection.update_one(
            {"_id": oid},
            {"$set": {"used": True}},
        )
        return result.modified_count > 0


mongodb_service = MongoDBService()
