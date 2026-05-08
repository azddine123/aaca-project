"""LLM Service for content generation, summarization, and quiz creation.

Supports multiple providers: OpenAI, Google, Anthropic.
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Literal

from app.core.config import settings

logger = logging.getLogger("aaca")


class LLMCache:
    """Simple in-memory cache for LLM responses."""

    def __init__(self, ttl: int = 3600) -> None:
        self.cache: dict[str, dict[str, Any]] = {}
        self.ttl = ttl

    @staticmethod
    def _generate_key(key_data: str) -> str:
        """Generate cache key from prompt."""
        return hashlib.sha256(key_data.encode()).hexdigest()

    def get(self, cache_key: str) -> dict | None:
        """Get cached response if not expired."""
        if not settings.ENABLE_LLM_CACHE:
            return None

        key = self._generate_key(cache_key)
        if key in self.cache:
            entry = self.cache[key]
            if (datetime.now() - entry["timestamp"]).seconds < self.ttl:
                logger.info("🎯 Cache hit for prompt")
                return entry["response"]
            del self.cache[key]
        return None

    def set(self, cache_key: str, response: dict) -> None:
        """Cache a response."""
        if not settings.ENABLE_LLM_CACHE:
            return

        key = self._generate_key(cache_key)
        self.cache[key] = {
            "response": response,
            "timestamp": datetime.now(),
        }


class LLMService:
    """Multi-provider LLM service."""

    def __init__(self) -> None:
        self.cache = LLMCache(settings.LLM_CACHE_TTL)
        self._openai_client = None
        self._google_client = None
        self._anthropic_client = None
        self.provider = self._determine_provider()

    def _determine_provider(self) -> str:
        """Determine which provider to use based on available keys."""
        if settings.OPENAI_API_KEY:
            return "openai"
        elif settings.GOOGLE_API_KEY:
            return "google"
        elif settings.ANTHROPIC_API_KEY:
            return "anthropic"
        return "none"

    def _get_openai_client(self) -> Any:
        """Lazy load OpenAI client."""
        if self._openai_client is None and settings.OPENAI_API_KEY:
            from openai import AsyncOpenAI

            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client

    def _get_google_client(self) -> Any:
        """Lazy load Google client."""
        if self._google_client is None and settings.GOOGLE_API_KEY:
            import google.generativeai as genai

            genai.configure(api_key=settings.GOOGLE_API_KEY)
            self._google_client = genai
        return self._google_client

    def _get_anthropic_client(self) -> Any:
        """Lazy load Anthropic client."""
        if self._anthropic_client is None and settings.ANTHROPIC_API_KEY:
            import anthropic

            self._anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._anthropic_client

    async def _call_llm(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: str | None = None,
    ) -> dict[str, Any]:
        """Call LLM with appropriate provider."""
        cache_key = f"{self.provider}:{prompt}:{system_prompt}:{temperature}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        max_retries = 3
        base_delay = 1.0

        for attempt in range(max_retries):
            try:
                response = None

                if self.provider == "openai":
                    response = await self._call_openai(
                        prompt, system_prompt, temperature, max_tokens, response_format
                    )
                elif self.provider == "google":
                    response = await self._call_google(prompt, system_prompt, temperature, max_tokens)
                elif self.provider == "anthropic":
                    response = await self._call_anthropic(prompt, system_prompt, temperature, max_tokens)
                else:
                    logger.warning("⚠️ No LLM provider configured — returning stub response")
                    return {"content": "", "model": "none", "usage": {"prompt_tokens": 0, "completion_tokens": 0}}

                self.cache.set(cache_key, response)
                return response
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"LLM call failed after {max_retries} attempts: {e}")
                    raise
                import asyncio
                delay = base_delay * (2 ** attempt)
                logger.warning(f"LLM call failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay}s...")
                await asyncio.sleep(delay)

    async def _call_openai(
        self,
        prompt: str,
        system_prompt: str | None,
        temperature: float,
        max_tokens: int,
        response_format: str | None,
    ) -> dict[str, Any]:
        """Call OpenAI API."""
        client = self._get_openai_client()

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        kwargs: dict[str, Any] = {
            "model": settings.OPENAI_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}

        completion = await client.chat.completions.create(**kwargs)

        return {
            "content": completion.choices[0].message.content,
            "model": completion.model,
            "usage": {
                "prompt_tokens": completion.usage.prompt_tokens,
                "completion_tokens": completion.usage.completion_tokens,
            },
        }

    async def _call_google(
        self,
        prompt: str,
        system_prompt: str | None,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Call Google Generative AI API."""
        import asyncio

        genai = self._get_google_client()

        model = genai.GenerativeModel("gemini-1.5-flash")
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        response = await asyncio.to_thread(
            model.generate_content,
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )

        return {
            "content": response.text,
            "model": "gemini-1.5-flash",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0},
        }

    async def _call_anthropic(
        self,
        prompt: str,
        system_prompt: str | None,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Call Anthropic Claude API."""
        client = self._get_anthropic_client()

        messages = [{"role": "user", "content": prompt}]

        kwargs: dict[str, Any] = {
            "model": "claude-sonnet-4-6",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        response = await client.messages.create(**kwargs)

        return {
            "content": response.content[0].text if response.content else "",
            "model": response.model,
            "usage": {
                "prompt_tokens": response.usage.input_tokens if response.usage else 0,
                "completion_tokens": response.usage.output_tokens if response.usage else 0,
            },
        }

    # ============== Content Generation Methods ==============

    async def structure_content(
        self,
        raw_text: str,
        subject_hint: str | None = None,
    ) -> dict[str, Any]:
        """Structure raw text into academic format."""
        system_prompt = """You are an expert academic content analyzer. Your task is to:
1. Identify the main title of the content
2. Extract sections with clear headings
3. Identify definitions (term: definition format)
4. Extract examples mentioned
5. List key concepts
6. Identify any mathematical formulas

Return the result as a valid JSON object with this exact structure:
{
    "title": "string",
    "sections": [{"title": "string", "content": "string"}],
    "definitions": [{"term": "string", "definition": "string"}],
    "examples": ["string"],
    "key_concepts": ["string"],
    "formulas": [{"latex": "string", "description": "string"}],
    "subject_category": "mathematics|physics|chemistry|biology|cs|engineering|economics|literature|history|philosophy|other"
}"""

        prompt = f"Analyze and structure this academic content:\n\n{raw_text[:4000]}"
        if subject_hint:
            prompt += f"\n\nSubject hint: {subject_hint}"

        response = await self._call_llm(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            response_format="json",
        )

        try:
            return json.loads(response["content"])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON response: {response['content'][:200]}")
            return {
                "title": "Untitled",
                "sections": [{"title": "Content", "content": raw_text}],
                "definitions": [],
                "examples": [],
                "key_concepts": [],
                "formulas": [],
                "subject_category": "other",
            }

    async def generate_summary(
        self,
        content: str,
        summary_type: Literal["brief", "detailed", "bullet_points", "simplified"] = "detailed",
        target_level: str | None = None,
        max_length: int = 500,
    ) -> dict[str, Any]:
        """Generate intelligent summary."""
        type_instructions = {
            "brief": "Create a very concise summary in 2-3 sentences capturing the essence.",
            "detailed": "Create a comprehensive summary covering all key points.",
            "bullet_points": "Summarize using bullet points for easy scanning.",
            "simplified": "Explain as if teaching a beginner, use simple language.",
        }

        system_prompt = f"""You are an expert summarizer. {type_instructions.get(summary_type, type_instructions["detailed"])}
Target audience level: {target_level or "general"}
Maximum length: {max_length} words.

Return JSON format:
{{
    "summary": "string",
    "key_points": ["string"],
    "reading_time": number
}}"""

        response = await self._call_llm(
            prompt=f"Summarize this content:\n\n{content[:4000]}",
            system_prompt=system_prompt,
            temperature=0.5,
            response_format="json",
        )

        try:
            return json.loads(response["content"])
        except json.JSONDecodeError:
            return {
                "summary": response["content"][:max_length],
                "key_points": [],
                "reading_time": len(response["content"].split()) // 200,
            }

    async def generate_quiz(
        self,
        content: str,
        num_questions: int = 5,
        difficulty: str = "intermediate",
        quiz_types: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate adaptive quiz from content."""
        quiz_types = quiz_types or ["qcm", "open_ended"]

        system_prompt = f"""You are an expert quiz creator. Generate {num_questions} questions based on the provided content.
Difficulty level: {difficulty}
Question types to include: {', '.join(quiz_types)}

For each question:
- QCM: provide 4 options with one correct answer
- Open-ended: provide expected key points in answer
- Include brief explanation for each answer

Return valid JSON:
{{
    "title": "string",
    "questions": [
        {{
            "id": "q1",
            "type": "qcm|open_ended|fill_in_blank",
            "question": "string",
            "options": ["string"] (for QCM),
            "correct_answer": "string",
            "explanation": "string",
            "difficulty": "beginner|intermediate|advanced",
            "related_concept": "string"
        }}
    ],
    "total_points": number,
    "estimated_time": number (minutes)
}}"""

        response = await self._call_llm(
            prompt=f"Create a quiz from this content:\n\n{content[:4000]}",
            system_prompt=system_prompt,
            temperature=0.7,
            response_format="json",
        )

        try:
            quiz = json.loads(response["content"])
            for i, q in enumerate(quiz.get("questions", [])):
                q["id"] = f"q{i+1}"
            return quiz
        except json.JSONDecodeError:
            logger.error("Failed to parse quiz JSON")
            return {
                "title": "Quiz",
                "questions": [],
                "total_points": 0,
                "estimated_time": 5,
            }

    async def generate_flashcards(
        self,
        content: str,
        num_cards: int = 10,
    ) -> list[dict[str, Any]]:
        """Generate flashcards from content."""
        system_prompt = f"""Create {num_cards} flashcards from the provided content.
Each flashcard should have:
- Front: A question, concept, or term
- Back: The answer, explanation, or definition
- Difficulty level based on complexity

Return valid JSON:
{{
    "flashcards": [
        {{
            "front": "string",
            "back": "string",
            "difficulty": "beginner|intermediate|advanced",
            "tags": ["string"]
        }}
    ]
}}"""

        response = await self._call_llm(
            prompt=f"Create flashcards from:\n\n{content[:4000]}",
            system_prompt=system_prompt,
            temperature=0.6,
            response_format="json",
        )

        try:
            result = json.loads(response["content"])
            return result.get("flashcards", [])
        except json.JSONDecodeError:
            return []

    async def adapt_content_level(
        self,
        content: str,
        target_level: str,
        current_level: str | None = None,
    ) -> str:
        """Adapt content to target cognitive level."""
        system_prompt = f"""Adapt the given academic content to a {target_level} level audience.
Current level: {current_level or "unknown"}

Guidelines:
- Beginner: Use simple language, explain all terminology, provide context
- Intermediate: Standard academic language, assume basic knowledge
- Advanced: Technical precision, assume strong background, focus on nuances
- Expert: Cutting-edge perspective, minimal explanation of basics

Return only the adapted content without explanations."""

        response = await self._call_llm(
            prompt=f"Adapt this content:\n\n{content[:3000]}",
            system_prompt=system_prompt,
            temperature=0.4,
        )

        return response["content"]

    async def analyze_errors(
        self,
        quiz_answers: list[dict],
        content: str,
    ) -> dict[str, Any]:
        """Analyze quiz errors and provide recommendations."""
        system_prompt = """Analyze the quiz answers and identify:
1. Weak areas (topics the user struggled with)
2. Patterns in errors
3. Specific recommendations for improvement

Return JSON:
{
    "weak_areas": ["string"],
    "error_patterns": ["string"],
    "recommendations": ["string"],
    "suggested_difficulty": "beginner|intermediate|advanced"
}"""

        answers_text = json.dumps(quiz_answers, indent=2)
        response = await self._call_llm(
            prompt=f"Quiz answers:\n{answers_text}\n\nOriginal content:\n{content[:2000]}",
            system_prompt=system_prompt,
            temperature=0.5,
            response_format="json",
        )

        try:
            return json.loads(response["content"])
        except json.JSONDecodeError:
            return {
                "weak_areas": [],
                "error_patterns": [],
                "recommendations": ["Review the content again"],
                "suggested_difficulty": "beginner",
            }


llm_service = LLMService()
