"""RAG Service — Retrieval-Augmented Generation pipeline.

Flow:
  1. Embed the user query with OpenAI
  2. Retrieve the top-k relevant chunks from ChromaDB
  3. Build a context-aware prompt with the retrieved passages
  4. Call the LLM to generate a grounded answer / educational resource

This service is used for:
  - Answering questions about a note ("explain this concept")
  - Generating flashcards / quizzes scoped to relevant sections
  - Semantic search across all notes
"""

import logging
from typing import Any

from app.services.embedding_service import embedding_service
from app.services.llm_service import llm_service
from app.services.vector_store_service import vector_store_service

logger = logging.getLogger("aaca")

# Maximum number of context characters sent to the LLM
_MAX_CONTEXT_CHARS = 6000


class RAGService:
    """Retrieval-Augmented Generation over academic notes."""

    # ------------------------------------------------------------------
    # Core RAG query
    # ------------------------------------------------------------------

    async def answer_question(
        self,
        user_id: str,
        question: str,
        note_id: str | None = None,
        subject: str | None = None,
        top_k: int = 5,
        target_language: str | None = None,
    ) -> dict[str, Any]:
        """Answer a question using relevant passages from the vector store.

        Args:
            user_id:  Owner of the notes to search.
            question: Natural language question.
            note_id:  Restrict retrieval to a specific note (optional).
            subject:  Restrict retrieval to a subject category (optional).
            top_k:    Number of chunks to retrieve.

        Returns:
            {
                "answer":   str,
                "sources":  [{"text": str, "score": float, "metadata": dict}],
                "question": str,
            }
        """
        # 1. Embed the question
        query_embedding = await embedding_service.embed_text(question)

        # 2. Retrieve relevant chunks
        chunks = vector_store_service.query(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=top_k,
            note_id=note_id,
            subject=subject,
        )

        if not chunks:
            return {
                "answer": "Aucun contenu pertinent trouvé dans vos notes pour cette question.",
                "sources": [],
                "question": question,
            }

        # 3. Build context from retrieved chunks
        context = self._build_context(chunks)

        # 4. Generate grounded answer
        language_instruction = llm_service.get_language_instruction(target_language)
        system_prompt = (
            "Tu es un assistant pédagogique expert et rigoureux. "
            "Réponds à la question en te basant uniquement sur le contexte fourni. "
            "Si la réponse n'est pas dans le contexte, dis-le clairement.\n\n"
            f"{language_instruction}\n\n"
            "RÈGLES DE FORMATAGE STRICTES :\n"
            "- Toute expression ou symbole mathématique, même simple (ex: x, α, n²), "
            "doit être écrit en LaTeX inline : \\(expression\\)\n"
            "- Toute formule ou équation importante doit être mise en bloc display : "
            "\\[formule\\]\n"
            "- Utilise **texte** pour les termes importants ou titres de sections.\n"
            "- Ne mélange jamais du texte mathématique brut avec du texte normal : "
            "chaque symbole math doit être dans \\(...\\) ou \\[...\\].\n"
            "- Sois précis, structuré, et pédagogique."
        )
        prompt = f"Contexte :\n{context}\n\nQuestion : {question}"

        response = await llm_service._call_llm(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1000,
        )

        return {
            "answer": response["content"],
            "sources": chunks,
            "question": question,
        }

    # ------------------------------------------------------------------
    # RAG-powered content generation
    # ------------------------------------------------------------------

    async def generate_flashcards_rag(
        self,
        user_id: str,
        note_id: str,
        num_cards: int = 10,
        difficulty: str = "intermediate",
        target_language: str | None = None,
    ) -> list[dict[str, Any]]:
        """Generate flashcards from the most important chunks of a note.

        Uses RAG to focus on the highest-information segments rather than
        sending the full note text to the LLM.
        """
        # Embed a generic "key concepts and definitions" query to
        # pull the most information-dense chunks
        query_embedding = await embedding_service.embed_text(
            "key concepts definitions important terms examples"
        )
        chunks = vector_store_service.query(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=10,
            note_id=note_id,
        )

        if not chunks:
            return []

        context = self._build_context(chunks, max_chars=_MAX_CONTEXT_CHARS)
        return await llm_service.generate_flashcards(
            context,
            num_cards=num_cards,
            target_language=target_language,
        )

    async def generate_quiz_rag(
        self,
        user_id: str,
        note_id: str,
        num_questions: int = 5,
        difficulty: str = "intermediate",
        target_language: str | None = None,
    ) -> dict[str, Any]:
        """Generate a quiz from the most relevant sections of a note."""
        query_embedding = await embedding_service.embed_text(
            "important concepts facts theorems formulas rules"
        )
        chunks = vector_store_service.query(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=8,
            note_id=note_id,
        )

        if not chunks:
            return {"title": "Quiz", "questions": [], "total_points": 0, "estimated_time": 5}

        context = self._build_context(chunks, max_chars=_MAX_CONTEXT_CHARS)
        return await llm_service.generate_quiz(
            context,
            num_questions=num_questions,
            difficulty=difficulty,
            target_language=target_language,
        )

    async def semantic_search(
        self,
        user_id: str,
        query: str,
        top_k: int = 10,
        subject: str | None = None,
    ) -> list[dict[str, Any]]:
        """Semantic search across all notes for a user.

        Returns chunks ranked by semantic similarity to the query, grouped
        by source note.
        """
        query_embedding = await embedding_service.embed_text(query)
        chunks = vector_store_service.query(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=top_k,
            subject=subject,
        )

        # Group by note_id
        grouped: dict[str, list[dict[str, Any]]] = {}
        for chunk in chunks:
            note_id = chunk["metadata"].get("note_id", "unknown")
            grouped.setdefault(note_id, []).append(chunk)

        return [
            {
                "note_id": note_id,
                "best_score": max(c["score"] for c in note_chunks),
                "passages": note_chunks,
            }
            for note_id, note_chunks in sorted(
                grouped.items(),
                key=lambda item: max(c["score"] for c in item[1]),
                reverse=True,
            )
        ]

    # ------------------------------------------------------------------
    # Index management
    # ------------------------------------------------------------------

    async def index_note(
        self,
        user_id: str,
        note_id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        """Chunk, embed, and store a note in the vector index.

        Args:
            user_id:  Note owner.
            note_id:  Unique note identifier.
            text:     Full note text to index.
            metadata: Extra fields stored alongside each chunk
                      (e.g. subject, title, created_at).

        Returns:
            Number of chunks indexed.
        """
        if not text.strip():
            logger.warning(f"Empty text for note {note_id} — skipping indexing")
            return 0

        embedded_chunks = await embedding_service.embed_document(
            text=text,
            metadata={"user_id": user_id, **(metadata or {})},
        )

        return vector_store_service.add_chunks(
            user_id=user_id,
            note_id=note_id,
            chunks=embedded_chunks,
        )

    def remove_note(self, user_id: str, note_id: str) -> None:
        """Remove a note's chunks from the vector index."""
        vector_store_service.delete_note(user_id=user_id, note_id=note_id)
        logger.info(f"Removed note {note_id} from vector index")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_context(
        chunks: list[dict[str, Any]],
        max_chars: int = _MAX_CONTEXT_CHARS,
    ) -> str:
        """Concatenate retrieved chunks into a single context string."""
        parts: list[str] = []
        total = 0
        for i, chunk in enumerate(chunks, 1):
            text = chunk.get("text", "").strip()
            if not text:
                continue
            if total + len(text) > max_chars:
                break
            parts.append(f"[Passage {i} — score {chunk.get('score', 0):.2f}]\n{text}")
            total += len(text)
        return "\n\n".join(parts)


rag_service = RAGService()
