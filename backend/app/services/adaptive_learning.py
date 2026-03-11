"""Adaptive learning service for personalized recommendations."""

import statistics
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any


class AdaptiveLearningService:
    """Service for adaptive learning and personalization."""

    def __init__(self) -> None:
        self.difficulty_levels = ["beginner", "intermediate", "advanced", "expert"]

    def calculate_cognitive_level(
        self,
        quiz_results: list[dict],
        study_time: int,
        content_complexity: float,
    ) -> str:
        """Calculate appropriate cognitive level based on performance."""
        if not quiz_results:
            return "beginner"

        scores = [r.get("score", 0) for r in quiz_results]
        avg_score = statistics.mean(scores)

        if len(scores) > 1:
            consistency = 1 - (statistics.stdev(scores) / 100)
        else:
            consistency = 0.5

        time_factor = min(study_time / 300, 1.0)
        performance_score = (avg_score * 0.5) + (consistency * 30) + (time_factor * 20)

        if performance_score < 40:
            return "beginner"
        elif performance_score < 65:
            return "intermediate"
        elif performance_score < 85:
            return "advanced"
        return "expert"

    def analyze_strengths_weaknesses(
        self,
        quiz_results: list[dict],
        subject_distribution: dict,
    ) -> dict[str, Any]:
        """Analyze user's strengths and weaknesses."""
        topic_scores: defaultdict[str, list[float]] = defaultdict(list)
        error_patterns = []

        for result in quiz_results:
            for feedback in result.get("detailed_feedback", []):
                concept = feedback.get("related_concept", "general")
                is_correct = feedback.get("is_correct", False)

                topic_scores[concept].append(100.0 if is_correct else 0.0)

                if not is_correct:
                    error_patterns.append({
                        "concept": concept,
                        "error_type": feedback.get("error_type", "unknown"),
                    })

        topic_averages = {
            topic: statistics.mean(scores)
            for topic, scores in topic_scores.items()
        }

        strengths = [t for t, s in topic_averages.items() if s >= 75]
        weaknesses = [t for t, s in topic_averages.items() if s < 50]

        all_scores = [s for scores in topic_scores.values() for s in scores]

        return {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "topic_scores": topic_averages,
            "error_patterns": error_patterns,
            "overall_trend": "improving" if self._is_improving(all_scores) else "stable",
        }

    @staticmethod
    def _is_improving(scores: list[float]) -> bool:
        """Check if scores show improving trend."""
        if len(scores) < 3:
            return False

        mid = len(scores) // 2
        first_half = statistics.mean(scores[:mid])
        second_half = statistics.mean(scores[mid:])

        return second_half > first_half + 5

    def generate_learning_path(
        self,
        current_level: str,
        target_subject: str,
        weak_areas: list[str],
        available_notes: list[dict],
    ) -> list[dict[str, Any]]:
        """Generate personalized learning path."""
        path = []

        for area in weak_areas[:3]:
            relevant_notes = [
                n for n in available_notes
                if area.lower() in n.get("title", "").lower()
            ]
            if relevant_notes:
                path.append({
                    "type": "review",
                    "priority": 10,
                    "description": f"Review fundamentals of {area}",
                    "note_ids": [n["id"] for n in relevant_notes[:3]],
                    "estimated_time": 30,
                    "reason": f"Weak performance in {area}",
                })

        path.append({
            "type": "practice",
            "priority": 8,
            "description": f"Practice quiz on {target_subject}",
            "note_ids": [],
            "estimated_time": 20,
            "reason": "Regular practice improves retention",
        })

        if current_level in ["advanced", "expert"]:
            path.append({
                "type": "challenge",
                "priority": 6,
                "description": "Advanced problem set",
                "note_ids": [],
                "estimated_time": 45,
                "reason": "Push your boundaries",
            })

        path.sort(key=lambda x: x["priority"], reverse=True)
        return path

    @staticmethod
    def calculate_next_review(
        flashcard: dict,
        performance_rating: int,
    ) -> datetime:
        """Calculate next review date using spaced repetition algorithm (SM-2).

        Args:
            flashcard: Flashcard data including easiness_factor, repetitions, interval
            performance_rating: 1-5 rating where 5 is "easy"

        Returns:
            Next review datetime
        """
        easiness = flashcard.get("easiness_factor", 2.5)
        repetitions = flashcard.get("repetitions", 0)
        interval = flashcard.get("interval", 1)

        easiness = max(1.3, easiness + (0.1 - (5 - performance_rating) * (0.08 + (5 - performance_rating) * 0.02)))

        if performance_rating < 3:
            repetitions = 0
            interval = 1
        else:
            repetitions += 1
            if repetitions == 1:
                interval = 1
            elif repetitions == 2:
                interval = 6
            else:
                interval = round(interval * easiness)

        return datetime.now() + timedelta(days=interval)

    def get_daily_recommendations(
        self,
        user_progress: dict,
        all_notes: list[dict],
        due_flashcards: list[dict],
    ) -> list[dict[str, Any]]:
        """Get daily learning recommendations."""
        recommendations = []

        if due_flashcards:
            recommendations.append({
                "type": "review",
                "priority": 10,
                "description": f"Review {len(due_flashcards)} flashcards",
                "note_ids": list({f.get("note_id") for f in due_flashcards}),
                "estimated_time": len(due_flashcards) * 2,
                "reason": "Spaced repetition review due",
            })

        recent_notes = sorted(
            all_notes,
            key=lambda x: x.get("updated_at", datetime.min),
            reverse=True,
        )
        if recent_notes:
            recent_subject = recent_notes[0].get("subject")
            related_notes = [
                n for n in all_notes
                if n.get("subject") == recent_subject and n["id"] != recent_notes[0]["id"]
            ]
            if related_notes:
                recommendations.append({
                    "type": "learn",
                    "priority": 8,
                    "description": f"Continue studying {recent_subject}",
                    "note_ids": [related_notes[0]["id"]],
                    "estimated_time": 30,
                    "reason": "Build on recent learning",
                })

        weak_areas = user_progress.get("weak_areas", [])
        if weak_areas:
            recommendations.append({
                "type": "practice",
                "priority": 7,
                "description": f"Practice: {weak_areas[0]}",
                "note_ids": [],
                "estimated_time": 20,
                "reason": "Strengthen weak areas",
            })

        recommendations.append({
            "type": "challenge",
            "priority": 5,
            "description": "Daily challenge quiz",
            "note_ids": [],
            "estimated_time": 15,
            "reason": "Daily brain workout",
        })

        return sorted(recommendations, key=lambda x: x["priority"], reverse=True)

    @staticmethod
    def estimate_reading_time(text: str) -> int:
        """Estimate reading time in minutes.

        Average reading speed: 200 words per minute for academic content.
        """
        words = len(text.split())
        minutes = words // 200
        return max(1, minutes)


adaptive_learning = AdaptiveLearningService()
