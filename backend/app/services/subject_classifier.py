"""Subject classification service.

Automatically categorizes academic content into subjects.
Supports French and English academic text.
"""

import re
import unicodedata
from collections import Counter


def _normalize(text: str) -> str:
    """Lowercase and strip combining diacritics for accent-insensitive matching."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


class SubjectClassifier:
    """Rule-based subject classifier with bilingual (FR/EN) keyword matching."""

    # Each subject has:
    #   "keywords" : list of French/English words (matched case-insensitively,
    #                accent-insensitively, whole-word). Each match scores +2.
    #   "formulas"  : list of raw regex patterns applied to the ORIGINAL text.
    #                 Each match scores +3.
    SUBJECT_KEYWORDS: dict[str, dict] = {
        "mathematics": {
            "keywords": [
                # English
                "theorem", "proof", "equation", "function", "derivative", "integral",
                "matrix", "vector", "algebra", "calculus", "geometry", "probability",
                "statistics", "logarithm", "exponential", "polynomial", "trigonometry",
                "differential", "convergence", "topology", "number theory",
                "linear algebra", "discrete math", "arithmetic", "combinatorics",
                # French
                "théorème", "theoreme", "démonstration", "demonstration",
                "équation", "equation", "fonction", "derivee", "dérivée",
                "intégrale", "integrale", "matrice", "vecteur", "algèbre", "algebre",
                "géométrie", "geometrie", "probabilité", "probabilite",
                "statistique", "logarithme", "exponentielle", "polynôme", "polynome",
                "trigonométrie", "trigonometrie", "différentielle", "differentielle",
                "convergence", "topologie", "algèbre linéaire", "algebre lineaire",
                "mathématiques", "mathematiques", "racine carrée", "racine carree",
                "suite numérique", "suite numerique", "continuité", "continuite",
                "dérivation", "derivation", "primitives", "arithmétique", "arithmetique",
                "combinatoire", "limite de suite", "série entière", "serie entiere",
            ],
            # Formula patterns applied to original text (case-sensitive):
            # Greek math symbols, LaTeX markers, real arithmetic/superscripts
            "formulas": [
                r"∫", r"∑", r"∂", r"∞", r"∈", r"∀", r"∃", r"√", r"π",
                r"θ", r"α", r"β", r"λ", r"μ", r"σ", r"φ",
                r"\$\$[\s\S]+?\$\$",           # display LaTeX
                r"\$[^$\n]+?\$",               # inline LaTeX
                r"\\\[[\s\S]+?\\\]",           # \[...\]
                r"\\(?:frac|sqrt|sum|int|lim|inf|sup)\b",  # LaTeX commands
                r"[a-zA-Z]\^[\d{(]",           # x^2, e^{-x}  (superscript)
                r"[a-zA-Z]_[\d{(]",            # a_1, x_{n}   (subscript)
                r"\d\s*[+\-*]\s*\d",           # 2+3, 5-1, 3*4
                r"\d\s*/\s*\d",                # 3/4
            ],
        },

        "physics": {
            "keywords": [
                # English
                "force", "energy", "momentum", "velocity", "acceleration", "mass",
                "gravity", "electric", "magnetic", "quantum", "relativity",
                "thermodynamics", "optics", "mechanics", "wave", "particle",
                "field", "potential", "Newton", "Einstein", "Maxwell",
                "Schrödinger", "Heisenberg", "Joule", "Watt", "Pascal", "Hertz", "Ohm",
                # French
                "énergie", "energie", "vitesse", "accélération", "acceleration",
                "gravitation", "électrique", "electrique", "magnétique", "magnetique",
                "quantique", "relativité", "relativite", "thermodynamique",
                "optique", "mécanique", "mecanique", "onde", "particule",
                "champ électrique", "champ magnetique", "champ électromagnétique",
                "potentiel", "chaleur", "pression", "tension électrique",
                "puissance électrique", "résistance électrique", "resistance electrique",
                "physique", "cinématique", "cinematique", "dynamique", "statique",
                "électromagnétisme", "electromagnetisme", "réfraction", "refraction",
                "diffraction", "photon", "électron", "electron", "proton", "neutron",
                "loi de Newton", "énergie cinétique", "energie cinetique",
                "énergie potentielle", "energie potentielle",
                "mécanique quantique", "mecanique quantique",
                "physique nucléaire", "physique nucleaire",
            ],
            "formulas": [
                r"kg\s*/?\s*m", r"m/s", r"m/s²",
                r"[FJNWVA]\s*=\s*[\d\w]",      # unit assignments like F = ma
            ],
        },

        "chemistry": {
            "keywords": [
                # English
                "molecule", "atom", "compound", "reaction", "catalyst", "enzyme",
                "acid", "base", "pH", "oxidation", "reduction", "polymer",
                "organic", "inorganic", "biochemistry", "thermochemistry",
                "periodic table", "isotope", "ion", "bond", "valence",
                "hydrocarbon", "stoichiometry", "equilibrium",
                # French
                "molécule", "molecule", "atome", "réaction chimique", "reaction chimique",
                "catalyseur", "acide", "base", "oxydation", "réduction", "reduction",
                "polymère", "polymere", "organique", "inorganique", "thermochimie",
                "élément chimique", "element chimique",
                "tableau périodique", "tableau periodique",
                "isotope", "liaison chimique", "valence",
                "hydrocarbure", "stœchiométrie", "stoichiometrie",
                "équilibre chimique", "equilibre chimique",
                "chimie", "oxydoréduction", "oxydoreduction",
                "électrolyte", "electrolyte", "électronégativité", "electronegativite",
                "chimie organique", "chimie inorganique",
            ],
            "formulas": [
                r"H₂?O", r"CO₂?", r"NaCl", r"HCl", r"H₂SO₄", r"NaOH",
                r"→", r"⇌", r"°C", r"\bmol\b", r"\bpH\b",
            ],
        },

        "biology": {
            "keywords": [
                # English
                "cell", "organism", "species", "gene", "DNA", "RNA", "protein",
                "enzyme", "metabolism", "photosynthesis", "respiration", "ecosystem",
                "evolution", "natural selection", "taxonomy", "anatomy", "physiology",
                "microorganism", "bacteria", "virus", "fungi", "mitosis", "meiosis",
                "chromosome", "nucleus", "membrane",
                # French
                "cellule", "organisme", "espèce", "espece", "gène", "gene",
                "ADN", "ARN", "protéine", "proteine", "enzyme",
                "métabolisme", "metabolisme",
                "photosynthèse", "photosynthese",
                "respiration cellulaire", "écosystème", "ecosysteme",
                "évolution", "evolution", "sélection naturelle", "selection naturelle",
                "anatomie", "physiologie", "micro-organisme", "micro organisme",
                "bactérie", "bacterie", "virus", "champignon",
                "mitose", "méiose", "meiose", "chromosome",
                "noyau cellulaire", "membrane cellulaire",
                "biologie", "génétique", "genetique", "biodiversité", "biodiversite",
                "organite", "cytoplasme", "chloroplaste", "mitochondrie",
            ],
            "formulas": [],
        },

        "computer_science": {
            "keywords": [
                # English
                "algorithm", "data structure", "complexity", "graph", "tree", "hash",
                "sorting", "searching", "recursion", "iteration", "object-oriented",
                "functional programming", "database", "network", "security",
                "machine learning", "neural network", "compiler", "operating system",
                "binary", "hexadecimal", "Boolean", "logic gate", "CPU", "memory",
                # French
                "algorithme", "structure de données", "structure de donnees",
                "complexité algorithmique", "complexite algorithmique",
                "récursion", "recursion", "récursivité", "recursivite",
                "itération", "iteration",
                "programmation orientée objet", "programmation orientee objet",
                "base de données", "base de donnees",
                "réseau informatique", "reseau informatique",
                "sécurité informatique", "securite informatique",
                "apprentissage automatique", "réseau de neurones", "reseau de neurones",
                "compilateur", "système d'exploitation", "systeme d'exploitation",
                "binaire", "hexadécimal", "hexadecimal",
                "logique booléenne", "logique booleenne",
                "informatique", "logiciel", "programme informatique",
                "intelligence artificielle",
                "paradigme de programmation", "langage de programmation",
            ],
            "formulas": [
                r"O\s*\(", r"Ω\s*\(", r"Θ\s*\(",
                r"log\s*\(", r"2\s*\^\s*n",
            ],
        },

        "engineering": {
            "keywords": [
                # English
                "design", "structure", "stress", "strain", "material", "load",
                "civil", "mechanical", "electrical engineering", "aerospace",
                "circuit", "signal", "control system", "feedback", "robotics",
                "CAD", "simulation", "prototype", "manufacturing", "assembly",
                # French
                "ingénierie", "ingenierie", "génie civil", "genie civil",
                "génie mécanique", "genie mecanique",
                "génie électrique", "genie electrique",
                "conception", "contrainte mécanique", "contrainte mecanique",
                "matériau", "materiau", "charge mécanique", "charge mecanique",
                "circuit imprimé", "circuit imprime",
                "système de contrôle", "systeme de controle",
                "rétroaction", "retroaction", "robotique",
                "simulation numérique", "simulation numerique",
                "prototype", "fabrication", "résistance des matériaux",
                "resistance des materiaux",
            ],
            "formulas": [],
        },

        "economics": {
            "keywords": [
                # English
                "supply", "demand", "market", "price", "cost", "revenue", "profit",
                "elasticity", "GDP", "inflation", "unemployment", "monetary policy",
                "fiscal policy", "microeconomics", "macroeconomics", "trade",
                "investment", "interest rate", "exchange rate", "budget", "tax",
                # French
                "offre et demande", "loi de l'offre", "marché", "marche",
                "microéconomie", "microeconomie", "macroéconomie", "macroeconomie",
                "PIB", "inflation", "chômage", "chomage",
                "politique monétaire", "politique monetaire",
                "politique budgétaire", "politique budgetaire",
                "investissement", "taux d'intérêt", "taux d interet",
                "taux de change", "fiscalité", "fiscalite",
                "économie", "economie", "capitalisme", "mondialisation",
                "concurrence", "monopole", "oligopole",
                "élasticité", "elasticite", "équilibre de marché", "equilibre de marche",
                "courbe de demande", "courbe d'offre",
                "coût marginal", "cout marginal", "recette marginale",
            ],
            "formulas": [r"\$", r"€", r"£"],
        },

        "literature": {
            "keywords": [
                # English
                "novel", "poetry", "drama", "character", "plot", "theme",
                "metaphor", "symbolism", "narrative", "prose", "verse",
                "author", "genre", "literary device", "interpretation",
                "Shakespeare", "romanticism", "modernism", "postcolonial",
                # French
                "roman", "poésie", "poesie", "poème", "poeme",
                "drame", "pièce de théâtre", "piece de theatre",
                "personnage", "intrigue", "thème littéraire", "theme litteraire",
                "métaphore", "metaphore", "symbolisme", "narration",
                "prose", "vers", "auteur", "auteurs",
                "genre littéraire", "genre litteraire",
                "analyse littéraire", "analyse litteraire",
                "romantisme", "classicisme", "réalisme", "realisme",
                "naturalisme", "modernisme", "figure de style",
                "hyperbole", "comparaison littéraire", "comparaison litteraire",
                "allégorie", "allegorie", "littérature", "litterature",
                "texte narratif", "discours", "rhétorique", "rhetorique",
                "oeuvre littéraire", "oeuvre litteraire",
            ],
            "formulas": [],
        },

        "history": {
            "keywords": [
                # English
                "century", "war", "revolution", "empire", "civilization", "dynasty",
                "ancient", "medieval", "renaissance", "enlightenment", "industrial",
                "colonialism", "independence", "treaty", "archaeology",
                "chronology", "historiography", "primary source",
                # French
                "siècle", "siecle", "guerre mondiale", "révolution", "revolution",
                "empire", "civilisation", "dynastie", "dynasties",
                "antiquité", "antiquite", "médiéval", "medieval",
                "renaissance", "lumières", "lumieres", "révolution industrielle",
                "colonialisme", "colonisation", "décolonisation", "decolonisation",
                "indépendance", "independance", "traité de paix", "traite de paix",
                "archéologie", "archeologie", "chronologie", "historiographie",
                "histoire", "monarchie", "aristocratie", "résistance", "resistance",
                "occupation", "régime", "regime", "Moyen Âge", "Moyen Age",
                "guerre de", "bataille de",
            ],
            "formulas": [
                r"\d{1,4}\s*(?:BC|AD|BCE|CE)\b",
                r"\d{1,2}(?:th|st|nd|rd)\s*century",
                r"\d{4}\s*[-–]\s*\d{4}",        # year ranges: 1789–1815
            ],
        },

        "philosophy": {
            "keywords": [
                # English
                "ethics", "metaphysics", "epistemology", "logic", "aesthetics",
                "existentialism", "phenomenology", "empiricism", "rationalism",
                "Plato", "Aristotle", "Kant", "Nietzsche", "Sartre", "Descartes",
                "consciousness", "free will", "determinism", "morality", "truth",
                # French
                "éthique", "ethique", "métaphysique", "metaphysique",
                "épistémologie", "epistemologie", "esthétique", "esthetique",
                "existentialisme", "phénoménologie", "phenomenologie",
                "empirisme", "rationalisme", "conscience", "libre arbitre",
                "déterminisme", "determinisme", "morale", "vérité", "verite",
                "raison", "dialectique", "idéalisme", "idealisme",
                "matérialisme", "materialisme", "philosophie",
                "nature humaine", "ontologie", "pensée", "pensee",
                "concept philosophique", "courant philosophique",
                "problème philosophique", "probleme philosophique",
            ],
            "formulas": [],
        },
    }

    # Pre-normalise keyword patterns once at class level for efficiency
    _KEYWORD_PATTERNS: dict[str, list[re.Pattern]] = {}

    @classmethod
    def _build_patterns(cls) -> None:
        for subject, data in cls.SUBJECT_KEYWORDS.items():
            cls._KEYWORD_PATTERNS[subject] = [
                re.compile(r"\b" + re.escape(_normalize(kw)) + r"\b")
                for kw in data["keywords"]
            ]

    def classify(
        self,
        text: str,
        latex_formulas: list[dict] | None = None,
    ) -> tuple[str, float]:
        """Classify *text* into a subject category.

        Returns: (subject, confidence_score)
        """
        if not text or not text.strip():
            return "other", 0.0

        text_norm = _normalize(text)
        scores: Counter = Counter()

        for subject, data in self.SUBJECT_KEYWORDS.items():
            score = 0

            # Keyword matching on normalised text (accent-insensitive)
            for kw in data["keywords"]:
                pattern = r"\b" + re.escape(_normalize(kw)) + r"\b"
                score += len(re.findall(pattern, text_norm)) * 2

            # Formula / regex matching on original text
            for fp in data["formulas"]:
                score += len(re.findall(fp, text)) * 3

            scores[subject] = score

        # LaTeX formula bonus (from image pipeline's formula extractor)
        if latex_formulas:
            scores["mathematics"] += len(latex_formulas) * 5

        # NOTE: We deliberately do NOT apply a generic punctuation bonus here.
        # Previously `[\+\-\*\/\=\^\(\)\[\]\{\}]` was used, which caused plan
        # outlines like "(1) definition = concept" to be classified as
        # mathematics with 100% confidence.

        if not scores or max(scores.values()) == 0:
            return "other", 0.0

        best_subject = scores.most_common(1)[0][0]
        total_score = sum(scores.values())
        confidence = scores[best_subject] / total_score if total_score > 0 else 0.0

        return best_subject, min(confidence, 1.0)

    def get_all_scores(self, text: str) -> dict[str, float]:
        """Return normalised keyword scores for all subjects."""
        text_norm = _normalize(text)
        scores: Counter = Counter()

        for subject, data in self.SUBJECT_KEYWORDS.items():
            score = 0
            for kw in data["keywords"]:
                pattern = r"\b" + re.escape(_normalize(kw)) + r"\b"
                score += len(re.findall(pattern, text_norm))
            scores[subject] = score

        total = sum(scores.values())
        if total > 0:
            return {k: round(v / total, 3) for k, v in scores.items()}
        return dict(scores)


subject_classifier = SubjectClassifier()
