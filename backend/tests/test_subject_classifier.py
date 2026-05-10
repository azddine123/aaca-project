"""Unit tests for the subject classifier.

Verifies that the bilingual keyword-based classifier correctly identifies
subjects from French academic text and does NOT produce false positives
for mathematics when plain OCR punctuation is present.
"""

from app.services.subject_classifier import subject_classifier


class TestNoPseudoMathFalsePositives:
    """Punctuation and OCR plan structure must NOT trigger mathematics."""

    def test_plan_structure_not_math(self):
        """A simple plan outline with parentheses, dashes, equals signs is not math."""
        text = "Plan: (1) introduction - definition = concept; (2) auteurs - courant = theorie;"
        subject, confidence = subject_classifier.classify(text, [])
        assert subject != "mathematics", (
            f"Got mathematics with confidence {confidence:.2f} — punctuation heuristic is still active"
        )

    def test_dash_equals_in_french_not_math(self):
        text = "I. Définition - origines = contexte; II. Développement - analyse = résultat"
        subject, confidence = subject_classifier.classify(text, [])
        assert subject != "mathematics"

    def test_empty_text_returns_other(self):
        subject, confidence = subject_classifier.classify("", [])
        assert subject == "other"
        assert confidence == 0.0

    def test_empty_text_no_crash(self):
        subject, confidence = subject_classifier.classify("   ", [])
        assert subject == "other"


class TestFrenchSubjectKeywords:
    """French academic texts should map to their correct subject."""

    def test_biology_french(self):
        text = (
            "La mitose est un processus de division cellulaire. "
            "Les chromosomes se séparent dans les cellules eucaryotes. "
            "La membrane plasmique régule les échanges avec l'organisme."
        )
        subject, confidence = subject_classifier.classify(text, [])
        assert subject == "biology", f"Expected biology, got {subject} ({confidence:.2f})"
        assert confidence > 0.2

    def test_history_french(self):
        text = (
            "La Révolution française de 1789 marque la fin de l'Ancien Régime. "
            "La monarchie absolue est renversée par le peuple. "
            "Napoléon Bonaparte devient empereur en 1804."
        )
        subject, confidence = subject_classifier.classify(text, [])
        assert subject == "history", f"Expected history, got {subject} ({confidence:.2f})"
        assert confidence > 0.2

    def test_economics_french(self):
        text = (
            "Le PIB mesure la production nationale. "
            "L'inflation et le chômage sont des indicateurs macroéconomiques. "
            "La politique monétaire est gérée par la banque centrale."
        )
        subject, confidence = subject_classifier.classify(text, [])
        assert subject == "economics", f"Expected economics, got {subject} ({confidence:.2f})"
        assert confidence > 0.2

    def test_philosophy_french(self):
        text = (
            "L'épistémologie est la théorie de la connaissance. "
            "Descartes distingue le sujet pensant de l'objet étendu. "
            "La métaphysique s'interroge sur l'être et l'existence."
        )
        subject, confidence = subject_classifier.classify(text, [])
        assert subject == "philosophy", f"Expected philosophy, got {subject} ({confidence:.2f})"
        assert confidence > 0.2

    def test_physics_french_with_formula(self):
        text = (
            "La mécanique quantique décrit le comportement des particules subatomiques. "
            "L'énergie cinétique est Ec = 1/2 mv^2. "
            "La force gravitationnelle suit la loi de Newton."
        )
        subject, confidence = subject_classifier.classify(text, [])
        assert subject == "physics", f"Expected physics, got {subject} ({confidence:.2f})"
        assert confidence > 0.2


class TestMathematicsRealFormulas:
    """Actual mathematical content must still be detected as mathematics."""

    def test_math_equations(self):
        text = (
            "Soit f(x) = x^2 + 3x - 5. "
            "La dérivée de f est f'(x) = 2x + 3. "
            "On cherche les racines du polynôme par le discriminant."
        )
        subject, confidence = subject_classifier.classify(text, [])
        assert subject == "mathematics", f"Expected mathematics, got {subject} ({confidence:.2f})"

    def test_math_latex(self):
        text = r"Calculer $\int_0^1 x^2 \, dx$ et montrer que $\lim_{n \to \infty} \frac{1}{n} = 0$."
        subject, confidence = subject_classifier.classify(text, [])
        assert subject == "mathematics"


class TestSubjectHint:
    """subject_hint override is applied in the pipeline, not in the classifier itself."""

    def test_get_all_scores_math_wins_on_real_math(self):
        text = "La dérivée d'une fonction polynôme est calculée par la règle de puissance."
        scores = subject_classifier.get_all_scores(text)
        assert scores["mathematics"] > 0

    def test_get_all_scores_history_wins_on_histoire(self):
        text = "La Révolution française et ses causes politiques, la monarchie absolue."
        scores = subject_classifier.get_all_scores(text)
        assert scores.get("history", 0) > scores.get("mathematics", 0)
