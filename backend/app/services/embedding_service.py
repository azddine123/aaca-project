"""Embedding Service — converts text segments into semantic vectors via OpenAI.

Used by the RAG pipeline to index academic content and retrieve relevant
passages at query time.
"""

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger("aaca")

# Dimensions for each supported model
_MODEL_DIMS: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}


class EmbeddingService:
    """Generate and manage text embeddings using OpenAI Embeddings API."""

    def __init__(self) -> None:
        self._client = None
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = _MODEL_DIMS.get(self.model, 1536)

    def _get_client(self) -> Any:
        """Lazy initialisation of the AsyncOpenAI client."""
        if self._client is None:
            if not settings.OPENAI_API_KEY:
                raise RuntimeError(
                    "OPENAI_API_KEY is required for embeddings. "
                    "Set it in your .env file."
                )
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def embed_text(self, text: str) -> list[float]:
        """Return the embedding vector for a single text string.

        Args:
            text: The text to embed (truncated to 8192 tokens internally).

        Returns:
            List of floats representing the semantic vector.
        """
        client = self._get_client()
        text = text.replace("\n", " ").strip()

        response = await client.embeddings.create(
            input=[text],
            model=self.model,
        )
        return response.data[0].embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Return embeddings for a batch of texts (single API call).

        Args:
            texts: List of strings to embed.

        Returns:
            List of embedding vectors in the same order as the input.
        """
        if not texts:
            return []

        client = self._get_client()
        cleaned = [t.replace("\n", " ").strip() for t in texts]

        response = await client.embeddings.create(
            input=cleaned,
            model=self.model,
        )
        # OpenAI returns embeddings sorted by index
        return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]

    def chunk_text(
        self,
        text: str,
        chunk_size: int = 500,
        overlap: int = 50,
    ) -> list[dict[str, Any]]:
        """Split text into overlapping chunks suitable for embedding.

        Args:
            text:       Full document text.
            chunk_size: Target number of words per chunk.
            overlap:    Number of words shared between consecutive chunks
                        to preserve context across boundaries.

        Returns:
            List of dicts: {"text": str, "start": int, "end": int, "index": int}
        """
        words = text.split()
        chunks: list[dict[str, Any]] = []
        step = max(1, chunk_size - overlap)

        for i in range(0, len(words), step):
            chunk_words = words[i : i + chunk_size]
            chunks.append({
                "text": " ".join(chunk_words),
                "start": i,
                "end": i + len(chunk_words),
                "index": len(chunks),
            })
            if i + chunk_size >= len(words):
                break

        logger.debug(f"Chunked text into {len(chunks)} segments (size={chunk_size}, overlap={overlap})")
        return chunks

    async def embed_document(
        self,
        text: str,
        metadata: dict[str, Any] | None = None,
        chunk_size: int = 500,
        overlap: int = 50,
    ) -> list[dict[str, Any]]:
        """Chunk a full document and embed each chunk.

        Args:
            text:       Full document text.
            metadata:   Arbitrary metadata attached to every chunk (e.g. note_id, subject).
            chunk_size: Words per chunk.
            overlap:    Word overlap between chunks.

        Returns:
            List of dicts, one per chunk:
            {
                "text":      str,
                "embedding": list[float],
                "index":     int,
                "start":     int,
                "end":       int,
                "metadata":  dict,
            }
        """
        chunks = self.chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        if not chunks:
            return []

        texts = [c["text"] for c in chunks]
        embeddings = await self.embed_batch(texts)

        result = []
        for chunk, embedding in zip(chunks, embeddings):
            result.append({
                **chunk,
                "embedding": embedding,
                "metadata": metadata or {},
            })

        logger.info(f"Embedded {len(result)} chunks for document")
        return result


embedding_service = EmbeddingService()
