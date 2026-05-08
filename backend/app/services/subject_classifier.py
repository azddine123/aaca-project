"""Subject classification service.

Automatically categorizes academic content into subjects.
"""

import re
from collections import Counter


class SubjectClassifier:
    """Rule-based subject classifier with keyword matching."""

    SUBJECT_KEYWORDS = {
        "mathematics": {
            "keywords": [
                "theorem", "proof", "equation", "function", "derivative", "integral",
                "matrix", "vector", "algebra", "calculus", "geometry", "probability",
                "statistics", "logarithm", "exponential", "polynomial", "trigonometry",
                "differential", "limit", "convergence", "topology", "number theory",
                "graph theory", "linear algebra", "discrete math",
            ],
            "formulas": [r"∫", r"∑", r"∂", r"∞", r"∈", r"∀", r"∃", r"√", r"π", r"θ", r"α", r"β"],
        },
        "physics": {
            "keywords": [
                "force", "energy", "momentum", "velocity", "acceleration", "mass",
                "gravity", "electric", "magnetic", "quantum", "relativity", "thermodynamics",
                "optics", "mechanics", "wave", "particle", "field", "potential",
                "Newton", "Einstein", "Maxwell", "Schrödinger", "Heisenberg",
                "Joule", "Watt", "Pascal", "Hertz", "Ohm",
            ],
            "formulas": [r"kg\s*/?\s*m", r"J\s*=", r"N\s*=", r"W\s*=", r"V\s*=", r"A\s*="],
        },
        "chemistry": {
            "keywords": [
                "molecule", "atom", "compound", "reaction", "catalyst", "enzyme",
                "acid", "base", "pH", "oxidation", "reduction", "polymer",
                "organic", "inorganic", "analytical", "biochemistry", "thermochemistry",
                "element", "periodic table", "isotope", "ion", "bond", "valence",
                "hydrocarbon", "functional group", "stoichiometry", "equilibrium",
            ],
            "formulas": [r"H₂?O", r"CO₂?", r"NaCl", r"HCl", r"→", r"⇌", r"°C", r"mol"],
        },
        "biology": {
            "keywords": [
                "cell", "organism", "species", "gene", "DNA", "RNA", "protein",
                "enzyme", "metabolism", "photosynthesis", "respiration", "ecosystem",
                "evolution", "natural selection", "taxonomy", "anatomy", "physiology",
                "microorganism", "bacteria", "virus", "fungi", "plant", "animal",
                "mitosis", "meiosis", "chromosome", "nucleus", "membrane",
            ],
            "formulas": [],
        },
        "computer_science": {
            "keywords": [
                "algorithm", "data structure", "complexity", "graph", "tree", "hash",
                "sorting", "searching", "recursion", "iteration", "object-oriented",
                "functional programming", "database", "network", "security",
                "machine learning", "AI", "neural network", "compiler", "operating system",
                "binary", "hexadecimal", "Boolean", "logic gate", "CPU", "memory",
            ],
            "formulas": [r"O\s*\(", r"Ω\s*\(", r"Θ\s*\(", r"log\s*\(", r"2\^", r"code\s*:"],
        },
        "engineering": {
            "keywords": [
                "design", "structure", "stress", "strain", "material", "load",
                "civil", "mechanical", "electrical", "software", "aerospace",
                "circuit", "signal", "control system", "feedback", "robotics",
                "CAD", "simulation", "prototype", "manufacturing", "assembly",
            ],
            "formulas": [],
        },
        "economics": {
            "keywords": [
                "supply", "demand", "market", "price", "cost", "revenue", "profit",
                "elasticity", "GDP", "inflation", "unemployment", "monetary policy",
                "fiscal policy", "microeconomics", "macroeconomics", "trade",
                "investment", "interest rate", "exchange rate", "budget", "tax",
            ],
            "formulas": [r"\$", r"€", r"£", r"%", r"MC\s*=", r"MR\s*=", r"P\s*="],
        },
        "literature": {
            "keywords": [
                "novel", "poetry", "drama", "character", "plot", "theme",
                "metaphor", "symbolism", "narrative", "prose", "verse",
                "author", "genre", "literary device", "analysis", "interpretation",
                "Shakespeare", "romanticism", "modernism", "postcolonial",
            ],
            "formulas": [],
        },
        "history": {
            "keywords": [
                "century", "war", "revolution", "empire", "civilization", "dynasty",
                "ancient", "medieval", "renaissance", "enlightenment", "industrial",
                "colonialism", "independence", "treaty", "document", "primary source",
                "archaeology", "chronology", "historiography",
            ],
            "formulas": [r"\d{1,4}\s*(BC|AD|BCE|CE)", r"\d{1,2}(th|st|nd|rd)\s*century"],
        },
        "philosophy": {
            "keywords": [
                "ethics", "metaphysics", "epistemology", "logic", "aesthetics",
                "existentialism", "phenomenology", "empiricism", "rationalism",
                "Plato", "Aristotle", "Kant", "Nietzsche", "Sartre", "Descartes",
                "consciousness", "free will", "determinism", "morality", "truth",
            ],
            "formulas": [],
        },
    }

    def classify(
        self,
        text: str,
        latex_formulas: list[dict] | None = None,
    ) -> tuple[str, float]:
        """Classify text into subject category.

        Returns: (subject, confidence_score)
        """
        text_lower = text.lower()
        scores: Counter = Counter()

        for subject, data in self.SUBJECT_KEYWORDS.items():
            score = 0

            for keyword in data["keywords"]:
                pattern = r"\b" + re.escape(keyword.lower()) + r"\b"
                count = len(re.findall(pattern, text_lower))
                score += count * 2

            for pattern in data["formulas"]:
                count = len(re.findall(pattern, text))
                score += count * 3

            scores[subject] = score

        if latex_formulas:
            scores["mathematics"] += len(latex_formulas) * 5

        math_symbols = len(re.findall(r"[\+\-\*\/\=\^\(\)\[\]\{\}]", text))
        if math_symbols > 10:
            scores["mathematics"] += math_symbols // 5

        if not scores or max(scores.values()) == 0:
            return "other", 0.0

        best_subject = scores.most_common(1)[0][0]
        total_score = sum(scores.values())
        confidence = scores[best_subject] / total_score if total_score > 0 else 0
        confidence = min(confidence, 1.0)

        return best_subject, confidence

    def get_all_scores(self, text: str) -> dict[str, float]:
        """Get scores for all subjects."""
        text_lower = text.lower()
        scores: Counter = Counter()

        for subject, data in self.SUBJECT_KEYWORDS.items():
            score = 0
            for keyword in data["keywords"]:
                pattern = r"\b" + re.escape(keyword.lower()) + r"\b"
                score += len(re.findall(pattern, text_lower))
            scores[subject] = score

        total = sum(scores.values())
        if total > 0:
            return {k: round(v / total, 3) for k, v in scores.items()}

        return dict(scores)


subject_classifier = SubjectClassifier()
