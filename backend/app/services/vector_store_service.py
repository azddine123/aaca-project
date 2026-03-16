"""Vector Store Service — persistent semantic index backed by ChromaDB.

Each academic note is chunked, embedded, and stored as a ChromaDB collection.
At query time, the top-k most similar chunks are retrieved for the RAG pipeline.

Collections are namespaced per user:  aaca_{user_id}
"""

import logging
import os
from typing import Any

from app.core.config import settings

logger = logging.getLogger("aaca")


class VectorStoreService:
    """ChromaDB-backed vector store for academic content retrieval."""

    def __init__(self) -> None:
        self._client = None
        self.persist_dir = settings.VECTOR_STORE_DIR

    def _get_client(self) -> Any:
        """Lazy initialisation of the ChromaDB persistent client."""
        if self._client is None:
            import chromadb

            os.makedirs(self.persist_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(path=self.persist_dir)
            logger.info(f"✅ ChromaDB initialised at {self.persist_dir}")
        return self._client

    def _collection_name(self, user_id: str) -> str:
        """Sanitise user_id into a valid ChromaDB collection name."""
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in user_id)
        return f"aaca_{safe}"

    def _get_or_create_collection(self, user_id: str) -> Any:
        client = self._get_client()
        name = self._collection_name(user_id)
        return client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def add_chunks(
        self,
        user_id: str,
        note_id: str,
        chunks: list[dict[str, Any]],
    ) -> int:
        """Index a list of embedded chunks for a given note.

        Args:
            user_id: Owner of the note (used to scope the collection).
            note_id: Unique note identifier (stored in metadata).
            chunks:  Output of EmbeddingService.embed_document():
                     [{text, embedding, index, metadata}, ...]

        Returns:
            Number of chunks added.
        """
        if not chunks:
            return 0

        collection = self._get_or_create_collection(user_id)

        ids = [f"{note_id}_chunk_{c['index']}" for c in chunks]
        embeddings = [c["embedding"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [
            {
                **c.get("metadata", {}),
                "note_id": note_id,
                "chunk_index": c["index"],
            }
            for c in chunks
        ]

        # Upsert: safe to call multiple times for the same note
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info(f"Indexed {len(chunks)} chunks for note {note_id} (user {user_id})")
        return len(chunks)

    def delete_note(self, user_id: str, note_id: str) -> None:
        """Remove all chunks belonging to a note from the index."""
        collection = self._get_or_create_collection(user_id)
        results = collection.get(where={"note_id": note_id})
        if results["ids"]:
            collection.delete(ids=results["ids"])
            logger.info(f"Deleted {len(results['ids'])} chunks for note {note_id}")

    # ------------------------------------------------------------------
    # Query operations
    # ------------------------------------------------------------------

    def query(
        self,
        user_id: str,
        query_embedding: list[float],
        top_k: int = 5,
        note_id: str | None = None,
        subject: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve the top-k most semantically similar chunks.

        Args:
            user_id:         Scopes the search to this user's collection.
            query_embedding: Embedding vector of the query text.
            top_k:           Number of results to return.
            note_id:         Optional — restrict results to a single note.
            subject:         Optional — restrict results to a subject category.

        Returns:
            List of dicts ordered by relevance (highest first):
            [{"text": str, "score": float, "metadata": dict}, ...]
        """
        collection = self._get_or_create_collection(user_id)

        where: dict[str, Any] | None = None
        if note_id and subject:
            where = {"$and": [{"note_id": note_id}, {"subject": subject}]}
        elif note_id:
            where = {"note_id": note_id}
        elif subject:
            where = {"subject": subject}

        query_kwargs: dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": min(top_k, self._collection_count(collection)),
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            query_kwargs["where"] = where

        results = collection.query(**query_kwargs)

        formatted: list[dict[str, Any]] = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            # ChromaDB cosine distance: 0 = identical, 2 = opposite
            score = 1 - (dist / 2)
            formatted.append({
                "text": doc,
                "score": round(score, 4),
                "metadata": meta,
            })

        return formatted

    def _collection_count(self, collection: Any) -> int:
        try:
            return collection.count()
        except Exception:
            return 0

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def collection_stats(self, user_id: str) -> dict[str, Any]:
        """Return basic stats for a user's collection."""
        collection = self._get_or_create_collection(user_id)
        count = self._collection_count(collection)
        return {
            "collection": self._collection_name(user_id),
            "total_chunks": count,
            "persist_dir": self.persist_dir,
        }


vector_store_service = VectorStoreService()
