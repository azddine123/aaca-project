# AACA — AI Academic Cognitive Assistant

> Transformez vos photos de cours en ressources d'apprentissage interactives grâce à l'IA

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Lancer le projet](#lancer-le-projet)
- [API Reference](#api-reference)
- [Modèles de données](#modèles-de-données)
- [Pipeline de traitement](#pipeline-de-traitement)
- [Tests](#tests)
- [Docker](#docker)

---

## Vue d'ensemble

**AACA** (AI Academic Cognitive Assistant) est une application mobile intelligente qui utilise la **vision par ordinateur** et l'**IA générative** pour transformer des photos de cours (tableaux, notes manuscrites) en matériaux pédagogiques interactifs : résumés, quiz, flashcards et plans d'apprentissage adaptatifs.

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. CAPTURE     │────▶│  2. TRAITEMENT   │────▶│  3. APPRENTISSAGE│
│                 │     │                  │     │                  │
│  Prendre une   │     │  OCR multi-moteur│     │  Résumés         │
│  photo         │     │  Formules LaTeX  │     │  Quiz QCM        │
│  Importer PDF  │     │  Classification  │     │  Flashcards      │
│                 │     │  Embeddings RAG  │     │  Progression     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## Fonctionnalités

| Fonctionnalité | Description | Technologie |
|:--------------|:------------|:-----------|
| **Capture intelligente** | Correction de perspective, amélioration du contraste | OpenCV |
| **OCR multi-moteur** | Extraction de texte avec fallback automatique | PaddleOCR / EasyOCR / Tesseract |
| **Formules LaTeX** | Reconnaissance d'équations mathématiques | pix2tex / Transformers |
| **Classification automatique** | Détection de la matière (Maths, Physique, Info…) | LLM |
| **Résumés adaptatifs** | Résumés calibrés selon le niveau cognitif | GPT-4 / Gemini / Claude |
| **Quiz interactifs** | Questions QCM générées automatiquement | LLM |
| **Flashcards** | Répétition espacée via algorithme SM-2 | Spaced Repetition |
| **RAG** | Recherche sémantique dans vos notes | ChromaDB + Embeddings |
| **Apprentissage adaptatif** | Ajustement de la difficulté selon les performances | Adaptive Learning |
| **Recherche plein texte** | Recherche dans toutes vos notes | MongoDB |
| **Import PDF** | Traitement de documents PDF multi-pages | pdfplumber + pdf2image |
| **Thème clair/sombre** | Interface adaptable | React Native |

---

## Architecture

```
aaca-project/
├── backend/                   # API FastAPI (Python 3.13)
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py      # Toutes les routes REST
│   │   ├── core/
│   │   │   ├── config.py      # Settings (Pydantic Settings)
│   │   │   ├── security.py    # JWT, hachage mots de passe
│   │   │   ├── exceptions.py  # ServiceUnavailableError (→ HTTP 503)
│   │   │   └── logging.py     # Configuration des logs
│   │   ├── models/
│   │   │   └── schemas.py     # Modèles Pydantic
│   │   ├── services/          # Logique métier (voir tableau)
│   │   └── main.py            # Application FastAPI
│   ├── tests/                 # Tests pytest
│   ├── uploads/               # Stockage local des images
│   ├── vector_store/          # Persistance ChromaDB
│   ├── scripts/               # Scripts utilitaires (MongoDB Docker)
│   ├── Dockerfile
│   └── requirements.txt
│
└── frontend/                  # Application mobile Expo (React Native)
    ├── app/
    │   ├── (auth)/
    │   │   ├── login.tsx
    │   │   └── register.tsx
    │   ├── (tabs)/
    │   │   ├── home.tsx        # Tableau de bord
    │   │   ├── notes.tsx       # Liste des notes
    │   │   ├── snap.tsx        # FAB capture central
    │   │   ├── study.tsx       # Flashcards + Quiz interactifs
    │   │   └── profile.tsx     # Profil utilisateur
    │   ├── capture.tsx         # Écran capture photo / PDF
    │   └── note-detail.tsx     # Détail d'une note (Résumé / Contenu / Étudier)
    ├── contexts/
    │   ├── AuthContext.tsx
    │   ├── NotesContext.tsx    # fetchNotes, fetchNote, searchNotes
    │   ├── StudyContext.tsx    # currentQuiz, currentFlashcards
    │   └── AppearanceContext.tsx
    ├── theme.ts                # Design tokens (couleurs, typographie)
    └── package.json
```

---

## Stack technique

### Backend

| Composant | Technologie | Version |
|:----------|:-----------|:--------|
| Framework | FastAPI | 0.109.0 |
| Serveur ASGI | Uvicorn | 0.27.0 |
| Base de données | MongoDB (pymongo sync) | 4.6.1 |
| Vision | OpenCV | 4.9.0 |
| OCR principal | PaddleOCR (PP-OCRv5) | 3.0.0 |
| OCR alternatif | EasyOCR | 1.7.0 |
| OCR alternatif 2 | Tesseract | 0.3.10 |
| LaTeX | pix2tex / Transformers | — / 4.37.0 |
| LLM | OpenAI / Google Gemini / Anthropic Claude | — |
| Vector Store | ChromaDB | 0.4.22 |
| PDF | pdfplumber + pdf2image | 0.10.3 / 1.17.0 |
| Auth | JWT (python-jose + passlib/bcrypt) | — |
| Validation | Pydantic v2 | 2.5.3 |
| Tests | pytest + pytest-asyncio | 7.4.4 |

### Frontend

| Composant | Technologie | Version |
|:----------|:-----------|:--------|
| Framework | React Native | 0.81.5 |
| Navigation | Expo Router | 6.0.23 |
| SDK Expo | Expo | 54.0.33 |
| UI Components | React Native Paper | 5.14.4 |
| Caméra | expo-camera | 17.0.10 |
| Icônes | @expo/vector-icons (MaterialCommunityIcons) | 15.0.3 |
| Gradients | expo-linear-gradient | 15.0.8 |
| Dates | date-fns v4 (locale `fr`) | 4.1.0 |
| HTTP | Axios | 1.11.0 |
| Stockage sécurisé | expo-secure-store | 15.0.8 |
| Animations | React Native Animated + Reanimated | — / 4.1.1 |
| TypeScript | TypeScript | 5.9.2 |

---

## Structure du projet

### Services backend

| Service | Rôle |
|:--------|:-----|
| `pipeline.py` | Orchestrateur principal : image → contenu pédagogique |
| `ocr_service.py` | OCR multi-moteur avec fallback OpenAI Vision |
| `paddle_ocr_service.py` | Moteur PaddleOCR (PP-OCRv5) — moteur par défaut |
| `custom_ocr_service.py` | Moteur OCR personnalisé |
| `image_processor.py` | Prétraitement image (perspective, contraste) |
| `latex_service.py` | Extraction de formules mathématiques |
| `llm_service.py` | Multi-provider LLM (OpenAI / Google / Anthropic) avec cache |
| `subject_classifier.py` | Classification automatique de matière |
| `rag_service.py` | Pipeline RAG : indexation + recherche sémantique + Q&A |
| `vector_store_service.py` | Persistance ChromaDB par utilisateur |
| `embedding_service.py` | Génération d'embeddings (OpenAI text-embedding-3-small) |
| `adaptive_learning.py` | Algorithme SM-2, niveau cognitif, recommandations |
| `mongodb_service.py` | Couche base de données MongoDB |
| `local_storage.py` | Stockage fichiers local |
| `pdf_service.py` | Traitement PDF multi-pages |

---

## Prérequis

- **Python** 3.13+
- **Node.js** 18+ et npm
- **MongoDB** 7.0 (local ou Atlas)
- **Docker** (optionnel, pour MongoDB via conteneur)
- **Expo Go** sur iOS/Android (pour tester sur téléphone physique)
- Au moins une clé API LLM : OpenAI, Google Gemini, ou Anthropic

---

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd aaca-project
```

### 2. Backend

```bash
cd backend

# Créer et activer le virtualenv
python3 -m venv venv
source venv/bin/activate        # Linux / Mac
# venv\Scripts\activate         # Windows

# Installer les dépendances
pip install -r requirements.txt

# Installer pix2tex séparément (reconnaisseur LaTeX)
pip install pix2tex
```

### 3. Frontend

```bash
cd frontend
npm install
```

---

## Configuration

### Backend — fichier `backend/.env`

Créer le fichier à partir du modèle :

```bash
cp backend/.env.example backend/.env
```

Variables à configurer :

```env
# Sécurité (OBLIGATOIRE en production)
SECRET_KEY=votre-clé-secrète-très-longue
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# MongoDB
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=aaca_db

# LLM — au moins une clé obligatoire
OPENAI_API_KEY=sk-...          # Priorité 1
GOOGLE_API_KEY=...             # Priorité 2
ANTHROPIC_API_KEY=sk-ant-...   # Priorité 3 (modèle : claude-sonnet-4-6)
OPENAI_MODEL=gpt-4o

# CORS — inclure l'IP de votre téléphone pour les tests mobiles
CORS_ORIGINS=http://localhost:19006,http://localhost:8081,http://192.168.x.x:8081,exp://192.168.x.x:8081

# OCR engine : paddleocr | easyocr | tesseract | custom
OCR_ENGINE=paddleocr

# Cache LLM
ENABLE_LLM_CACHE=true
LLM_CACHE_TTL=3600
```

**Note CORS** : le backend utilise une whitelist stricte (jamais `*`). Sans variable `CORS_ORIGINS`, seuls `localhost:3000`, `localhost:5173` et `localhost:8080` sont autorisés. Pour les tests mobiles, renseignez l'IP locale de votre machine dans `CORS_ORIGINS`.

### Sélection automatique du provider LLM

Le service LLM détecte automatiquement le provider disponible dans cet ordre :

1. **OpenAI** si `OPENAI_API_KEY` est présent
2. **Google Gemini** si `GOOGLE_API_KEY` est présent
3. **Anthropic Claude** (`claude-sonnet-4-6`) si `ANTHROPIC_API_KEY` est présent

---

## Lancer le projet

### Étape 1 — Démarrer MongoDB

**Option A — Service système :**
```bash
sudo systemctl start mongod
```

**Option B — Docker :**
```bash
bash backend/scripts/start-mongodb.sh
```

**Option C — MongoDB Atlas :** mettre à jour `MONGODB_URL` dans `.env`.

Vérifier que MongoDB répond :
```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

### Étape 2 — Démarrer le backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

| URL | Description |
|:----|:-----------|
| `http://localhost:8000` | API REST |
| `http://localhost:8000/docs` | Documentation Swagger interactive |
| `http://localhost:8000/redoc` | Documentation ReDoc |

### Étape 3 — Démarrer le frontend

Dans un second terminal :

```bash
cd frontend
npx expo start
```

| Plateforme | Action |
|:-----------|:-------|
| Navigateur web | Appuyer `w` dans le terminal |
| Android (émulateur) | Appuyer `a` |
| iOS (simulateur Mac) | Appuyer `i` |
| Téléphone physique | Scanner le QR code avec l'app **Expo Go** |

---

## API Reference

Toutes les routes sont préfixées par `/api/v1`. Les routes protégées nécessitent le header `Authorization: Bearer <token>`.

### Authentification

| Méthode | Route | Auth | Description |
|:--------|:------|:----:|:-----------|
| `POST` | `/auth/register` | Non | Créer un compte |
| `POST` | `/auth/login` | Non | Connexion, retourne un JWT |

### Traitement d'images / PDF

| Méthode | Route | Auth | Description |
|:--------|:------|:----:|:-----------|
| `POST` | `/process/image` | Oui | Traiter une image (OCR + IA) |
| `POST` | `/process/capture` | Oui | Capture complète (image → note sauvegardée) |

### Notes

| Méthode | Route | Auth | Description |
|:--------|:------|:----:|:-----------|
| `GET` | `/notes` | Oui | Lister toutes les notes de l'utilisateur |
| `GET` | `/notes/{note_id}` | Oui | Détail d'une note |
| `PATCH` | `/notes/{note_id}` | Oui | Modifier une note |
| `DELETE` | `/notes/{note_id}` | Oui | Supprimer une note |
| `POST` | `/notes/{note_id}/summary` | Oui | Générer un résumé |
| `GET` | `/notes/{note_id}/quizzes` | Oui | Lister les quiz d'une note |
| `POST` | `/notes/{note_id}/quizzes` | Oui | Générer un nouveau quiz |
| `GET` | `/notes/{note_id}/flashcards` | Oui | Lister les flashcards d'une note |

### Quiz & Flashcards

| Méthode | Route | Auth | Description |
|:--------|:------|:----:|:-----------|
| `POST` | `/quizzes/{quiz_id}/submit` | Oui | Soumettre les réponses d'un quiz |
| `POST` | `/flashcards/{card_id}/review` | Oui | Enregistrer une révision (SM-2, note 1-5) |
| `GET` | `/flashcards/due` | Oui | Flashcards à réviser aujourd'hui |

### Recherche & Utilisateur

| Méthode | Route | Auth | Description |
|:--------|:------|:----:|:-----------|
| `POST` | `/search` | Oui | Recherche plein texte dans les notes |
| `GET` | `/user/me` | Oui | Profil de l'utilisateur connecté |
| `GET` | `/user/progress` | Oui | Statistiques de progression |
| `GET` | `/user/recommendations` | Oui | Recommandations d'apprentissage adaptatif |
| `GET` | `/subjects` | Non | Liste des matières disponibles |
| `GET` | `/stats` | Non | Statistiques globales |

---

## Modèles de données

### Matières (`SubjectCategory`)
`mathematics` · `physics` · `chemistry` · `biology` · `computer_science` · `engineering` · `economics` · `literature` · `history` · `philosophy` · `other`

### Niveaux cognitifs (`CognitiveLevel`)
`beginner` · `intermediate` · `advanced` · `expert`

### Types de quiz (`QuizType`)
`qcm` · `open_ended` · `fill_in_blank` · `matching`

### Note (structure complète)

```json
{
  "id": "string",
  "user_id": "string",
  "title": "string",
  "subject": "mathematics",
  "raw_text": "string",
  "summary": "string | null",
  "latex_formulas": [],
  "processed_content": {
    "title": "string",
    "sections": [],
    "definitions": [],
    "examples": [],
    "formulas": [],
    "key_concepts": []
  },
  "cognitive_level": "intermediate",
  "tags": [],
  "quizzes": ["quiz_id_1"],
  "flashcards": ["card_id_1"],
  "original_image_url": "string",
  "processing_metadata": {},
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

### Flashcard (algorithme SM-2)

```json
{
  "id": "string",
  "note_id": "string",
  "front": "string",
  "back": "string",
  "difficulty": "intermediate",
  "tags": [],
  "last_reviewed": "2026-01-01T00:00:00Z | null",
  "next_review": "2026-01-01T00:00:00Z | null",
  "review_count": 0,
  "mastery_level": 0.0
}
```

---

## Pipeline de traitement

```
Image / PDF
    │
    ▼
Prétraitement (OpenCV)
  ├── Correction de perspective
  └── Amélioration du contraste
    │
    ▼
OCR (moteur sélectionné via OCR_ENGINE)
  ├── PaddleOCR PP-OCRv5  ← défaut
  ├── EasyOCR
  ├── Tesseract
  └── Fallback OpenAI Vision (si score < OCR_CONFIDENCE_THRESHOLD)
    │
    ▼
Extraction LaTeX (pix2tex)
    │
    ▼
Classification de matière (LLM)
    │
    ▼
Structuration du contenu (LLM)
  ├── Titre, sections, définitions
  ├── Exemples, formules, concepts clés
  └── Niveau cognitif estimé
    │
    ▼
Indexation RAG (ChromaDB)
  ├── Génération d'embeddings (OpenAI text-embedding-3-small)
  └── Stockage vectoriel par utilisateur
    │
    ▼
Génération de contenu pédagogique (LLM)
  ├── Résumé adaptatif (brief / detailed / bullet_points / simplified)
  ├── Quiz QCM (difficulté ajustée au niveau cognitif)
  └── Flashcards avec planning de révision SM-2
```

---

## Tests

```bash
cd backend
source venv/bin/activate

# Lancer tous les tests
python3 -m pytest

# Avec rapport de couverture
python3 -m pytest --cov=app

# Verbose sur un fichier
python3 -m pytest tests/test_security_and_integration.py -v
```

### Tests disponibles

| Test | Description |
|:-----|:-----------|
| `test_pipeline_complete_flow` | Pipeline complet de traitement image |
| `test_review_foreign_flashcard_returns_403` | Protection d'ownership des flashcards |
| `test_review_own_flashcard_returns_200` | Révision d'une flashcard propriétaire |
| `test_review_nonexistent_flashcard_returns_404` | Flashcard inexistante |
| `test_register_without_mongodb_returns_503` | Inscription sans MongoDB → HTTP 503 |
| `test_create_note_without_mongodb_returns_503` | Création de note sans MongoDB → HTTP 503 |
| `test_service_unavailable_error_attributes` | Attributs de ServiceUnavailableError |
| `test_mongodb_service_raises_when_disconnected` | MongoDB déconnecté → exception |

**Important** : ne pas utiliser le fixture `authorized_client` (incompatibilité bcrypt/Python 3.13). Utiliser le fixture `_auth_client` local et mocker `app.api.routes.get_password_hash` dans les tests de routes qui hachent des mots de passe.

---

## Docker

### Backend uniquement

```bash
cd backend
docker build -t aaca-backend .
docker run -p 8000:8000 --env-file .env aaca-backend
```

Le Dockerfile installe automatiquement les langues Tesseract : `eng`, `fra`, `deu`, `spa`.

### MongoDB via Docker

```bash
docker run -d \
  --name mongodb-aaca \
  -p 27017:27017 \
  -v mongodb_aaca_data:/data/db \
  --restart unless-stopped \
  mongo:7.0
```

Commandes utiles :
```bash
docker logs mongodb-aaca          # Voir les logs
docker stop mongodb-aaca          # Arrêter
docker start mongodb-aaca         # Redémarrer
docker exec -it mongodb-aaca mongosh  # Connexion shell
```

---

## Variables d'environnement — référence complète

| Variable | Défaut | Description |
|:---------|:-------|:-----------|
| `SECRET_KEY` | — | Clé JWT (obligatoire en production) |
| `ALGORITHM` | `HS256` | Algorithme JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Durée de vie du token (minutes) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Durée de vie du refresh token (jours) |
| `MONGODB_URL` | `mongodb://localhost:27017` | URL de connexion MongoDB |
| `DATABASE_NAME` | `aaca_db` | Nom de la base de données |
| `OPENAI_API_KEY` | — | Clé API OpenAI |
| `OPENAI_MODEL` | `gpt-4` | Modèle OpenAI à utiliser |
| `GOOGLE_API_KEY` | — | Clé API Google Gemini |
| `ANTHROPIC_API_KEY` | — | Clé API Anthropic |
| `OCR_ENGINE` | `paddleocr` | Moteur OCR (`paddleocr`/`easyocr`/`tesseract`/`custom`) |
| `OCR_CONFIDENCE_THRESHOLD` | `0.8` | Seuil avant fallback OpenAI Vision |
| `CORS_ORIGINS` | localhost dev | Origines CORS autorisées (valeurs séparées par virgule) |
| `ENABLE_LLM_CACHE` | `true` | Activer le cache des réponses LLM |
| `LLM_CACHE_TTL` | `3600` | TTL du cache LLM (secondes) |
| `MAX_UPLOAD_SIZE` | `10485760` | Taille max d'upload (10 MB) |
| `UPLOAD_DIR` | `uploads` | Répertoire de stockage des images |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Modèle d'embeddings OpenAI |
| `VECTOR_STORE_DIR` | `vector_store` | Répertoire de persistance ChromaDB |
| `MAX_PROCESSING_TIME` | `30` | Timeout du pipeline de traitement (secondes) |

---

## Licence

MIT
