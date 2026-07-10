# Rapport Technique de Soutenance - Projet PicLearn (AACA)

Ce document est le guide de référence complet pour préparer votre soutenance de projet devant le jury. Il détaille le fonctionnement, l'architecture et les concepts clés pour l'ensemble des composants Backend et Frontend.

---

## 1. BACKEND (FastAPI + Python)

### 📁 main.py — `backend/app/main.py`
- **🎯 Rôle & Responsabilité :** Point d'entrée principal de l'API. Il initialise FastAPI, configure les middlewares (CORS), gère le cycle de vie de l'application (connexion à MongoDB au démarrage) et inclut les routes.
- **🏗️ Architecture & Patterns :** Pattern *Application Factory* et *Dependency Injection* (via FastAPI `Depends`). Utilisation de gestionnaires de contexte asynchrones (`lifespan`).
- **🔧 Technologies clés :** FastAPI, Uvicorn, Motor (MongoDB asynchrone), Uvicorn.
- **📦 Composants principaux :** `lifespan` (gestionnaire de démarrage/arrêt), `app` (instance FastAPI).
- **🔗 Dépendances :** Fait appel à `app.api.routes`, `app.core.config`, `app.services.mongodb_service`.
- **💡 Concepts clés :** Asynchronisme en Python (async/await), Middlewares (CORS pour autoriser le frontend à appeler l'API), Cycle de vie d'une app web.
- **⚙️ Scénario :** Quand le serveur démarre, `main.py` est exécuté. Il tente de se connecter à MongoDB. Si un utilisateur fait une requête HTTP, elle entre par ici avant d'être routée.

### 📁 config.py — `backend/app/core/config.py`
- **🎯 Rôle & Responsabilité :** Charge et centralise toutes les variables d'environnement (clés API, URI de base de données, JWT secrets) de manière sécurisée et typée.
- **🏗️ Architecture & Patterns :** Pattern *Singleton* et validation de configuration (Pydantic BaseSettings).
- **🔧 Technologies clés :** Pydantic (BaseSettings), python-dotenv.
- **📦 Composants principaux :** Classe `Settings` avec ses attributs typés (`MONGODB_URL`, `OPENAI_API_KEY`, etc.).
- **🔗 Dépendances :** Utilisé par la quasi-totalité des services (ex: `mongodb_service.py`, `llm_service.py`) pour accéder à la configuration.
- **💡 Concepts clés :** Variables d'environnement (sécurité, ne jamais commiter des secrets), Validation de type à l'exécution.
- **⚙️ Scénario :** Au lancement, Pydantic lit le fichier `.env`. Si `MONGODB_URL` manque, l'application crash explicitement pour éviter un comportement indéfini.

### 📁 routes.py — `backend/app/api/routes.py`
- **🎯 Rôle & Responsabilité :** Définit tous les "endpoints" (URL d'API) accessibles par le Frontend (Auth, Upload, Notes, Quiz). Lie les requêtes HTTP aux services métier.
- **🏗️ Architecture & Patterns :** *Controller* dans le pattern MVC. *Dependency Injection* (FastAPI `Depends`) pour injecter l'utilisateur courant ou la base de données.
- **🔧 Technologies clés :** FastAPI (APIRouter).
- **📦 Composants principaux :** Endpoints `@router.post("/auth/login")`, `@router.post("/upload")`, `@router.get("/notes")`.
- **🔗 Dépendances :** Appelle les schémas (`schemas.py`) pour valider les données entrantes et les services (`pipeline.py`, `mongodb_service.py`) pour la logique métier.
- **💡 Concepts clés :** RESTful API (Verbes HTTP, Codes de statut), Injection de dépendance, Rate Limiting.
- **⚙️ Scénario :** Le Frontend envoie une image à `/upload`. La route valide le format, vérifie le token de l'utilisateur, puis passe le fichier au `pipeline.py`.

### 📁 schemas.py — `backend/app/models/schemas.py`
- **🎯 Rôle & Responsabilité :** Définit la structure (schémas) des données d'entrée (Requêtes) et de sortie (Réponses) de l'API. Assure la validation des données.
- **🏗️ Architecture & Patterns :** *Data Transfer Objects* (DTOs). Séparation stricte entre les modèles d'API et les modèles de base de données.
- **🔧 Technologies clés :** Pydantic (BaseModel).
- **📦 Composants principaux :** `UserCreate`, `Token`, `NoteResponse`, `UploadResponse`, `QuizGenerationRequest`.
- **🔗 Dépendances :** Utilisé massivement par `routes.py` pour valider les payloads HTTP.
- **💡 Concepts clés :** Typage fort, Validation de données, Sérialisation/Désérialisation (JSON vers objet Python).
- **⚙️ Scénario :** Un utilisateur s'inscrit. Le JSON envoyé est converti en objet `UserCreate`. Si l'email est mal formaté, Pydantic lève une erreur 422 Automatiquement.

### 📁 mongodb_service.py — `backend/app/services/mongodb_service.py`
- **🎯 Rôle & Responsabilité :** Gère toutes les interactions directes avec la base de données NoSQL MongoDB (CRUD utilisateurs, notes, flashcards).
- **🏗️ Architecture & Patterns :** Pattern *Repository* (abstraire la BDD) et *Singleton*.
- **🔧 Technologies clés :** Motor (client asynchrone MongoDB).
- **📦 Composants principaux :** Classe `MongoDBService`, méthodes `get_user()`, `save_note()`, `get_user_notes()`.
- **🔗 Dépendances :** Dépend de `config.py` (URL BDD). Utilisé par `routes.py` et l'Auth.
- **💡 Concepts clés :** Base de données NoSQL (Collections, Documents BSON), Requêtes asynchrones, Indexation (pour accélérer les recherches).
- **⚙️ Scénario :** L'utilisateur demande son historique. Le service interroge la collection `notes` en filtrant par `user_id` et renvoie la liste.

### 📁 llm_service.py — `backend/app/services/llm_service.py`
- **🎯 Rôle & Responsabilité :** Gère les interactions avec les Large Language Models (OpenAI, Gemini, Anthropic) pour générer du texte, résumer, créer des quiz.
- **🏗️ Architecture & Patterns :** Pattern *Adapter* ou *Strategy* (permet de changer de modèle facilement : OpenAI vs Gemini).
- **🔧 Technologies clés :** SDK OpenAI (`openai`), LangChain (potentiellement).
- **📦 Composants principaux :** Classe `LLMService`, `generate_summary()`, `generate_quiz_from_text()`.
- **🔗 Dépendances :** Appelé par `pipeline.py` (à la fin) et `rag_service.py`.
- **💡 Concepts clés :** Prompt Engineering, Tokens limit, Température (créativité vs déterminisme).
- **⚙️ Scénario :** Après OCR, le texte brut est envoyé au LLMService avec un prompt : "Génère 3 questions à choix multiples à partir de ce cours."

### 📁 pipeline.py — `backend/app/services/pipeline.py`
- **🎯 Rôle & Responsabilité :** C'est le chef d'orchestre (Orchestrator). Il coordonne toutes les étapes : image -> OCR -> structuration LLM -> RAG.
- **🏗️ Architecture & Patterns :** Pattern *Facade* ou *Pipeline* (chaînage de responsabilités).
- **🔧 Technologies clés :** Asyncio (pour exécuter des étapes en parallèle si possible).
- **📦 Composants principaux :** Classe `ProcessingPipeline`, méthode `process_image()`.
- **🔗 Dépendances :** Utilise `ocr_service.py`, `llm_service.py`, `rag_service.py`, `subject_classifier.py`.
- **💡 Concepts clés :** Orchestration de micro-services, Gestion d'erreurs en cascade, Asynchronisme.
- **⚙️ Scénario :** Reçoit une photo. Appelle OCR, récupère le texte, appelle le classifieur de matière (ex: Math), puis appelle le LLM pour résumer, puis sauvegarde en BDD.

### 📁 ocr_service.py, custom_ocr_service.py, paddle_ocr_service.py
- **🎯 Rôle & Responsabilité :** Extraire le texte des images (Optical Character Recognition).
- **🏗️ Architecture & Patterns :** *Factory/Strategy Pattern*. Le système peut choisir le meilleur moteur selon le besoin.
- **🔧 Technologies clés :** PaddleOCR, EasyOCR, Tesseract, OpenCV (prétraitement).
- **📦 Composants principaux :** `extract_text()`, nettoyage des images.
- **🔗 Dépendances :** Appelé par `pipeline.py`.
- **💡 Concepts clés :** Vision par ordinateur (Computer Vision), Modèles pré-entraînés, Traitement d'image (Binarisation, Contraste).
- **⚙️ Scénario :** Une photo floue arrive. `image_processor` améliore le contraste, puis PaddleOCR détecte les zones de texte et les convertit en chaîne de caractères.

### 📁 latex_service.py — `backend/app/services/latex_service.py`
- **🎯 Rôle & Responsabilité :** Identifier et extraire spécifiquement les formules mathématiques des images pour les convertir en code LaTeX lisible.
- **🏗️ Architecture & Patterns :** Modèle spécialisé (Single Responsibility).
- **🔧 Technologies clés :** Pix2Tex (modèle d'IA spécialisé Math/LaTeX) ou Vision LLM.
- **📦 Composants principaux :** `extract_equations()`.
- **💡 Concepts clés :** Rendu Mathématique (LaTeX), Modèles multimodaux.
- **⚙️ Scénario :** L'étudiant prend en photo une intégrale. Le service classique OCR échoue. Ce service reconnaît la formule et sort `\int_0^\infty e^{-x} dx`.

### 📁 embedding_service.py & vector_store_service.py
- **🎯 Rôle & Responsabilité :** Convertir le texte en vecteurs mathématiques (Embeddings) et les stocker dans une base de données vectorielle pour la recherche sémantique.
- **🏗️ Architecture & Patterns :** *Repository Pattern* (Vector Store).
- **🔧 Technologies clés :** ChromaDB (Vector Store local), OpenAI Embeddings ou modèles HuggingFace.
- **📦 Composants principaux :** `generate_embedding()`, `store_document()`, `search_similar()`.
- **💡 Concepts clés :** Embeddings (représentation vectorielle du sens des mots), Distance Cosinus, Vector DB.
- **⚙️ Scénario :** Une nouvelle note est sauvegardée. Elle est transformée en vecteurs. Plus tard, quand l'étudiant cherche "Théorème de Pythagore", on fait une recherche de similarité vectorielle.

### 📁 rag_service.py — `backend/app/services/rag_service.py`
- **🎯 Rôle & Responsabilité :** Implémenter le système RAG (Retrieval-Augmented Generation). Permet au LLM de répondre aux questions de l'étudiant en se basant *uniquement* sur ses propres notes.
- **🏗️ Architecture & Patterns :** Pattern *RAG* classique (Retrieve -> Augment -> Generate).
- **🔧 Technologies clés :** LangChain (chaînage), ChromaDB, LLM.
- **📦 Composants principaux :** `ask_question_on_notes()`.
- **💡 Concepts clés :** RAG (pour éviter les hallucinations de l'IA), Context Window.
- **⚙️ Scénario :** L'étudiant demande à l'assistant "Quelles sont les formules du chapitre 2 ?". Le service cherche les textes du chap 2 dans la base vectorielle, et les donne au LLM avec pour consigne "Réponds à la question avec ce contexte".

### 📁 image_processor.py & pdf_service.py
- **🎯 Rôle & Responsabilité :** Préparer les fichiers (images ou PDF) avant l'extraction de texte. Nettoyage, découpage, conversion.
- **🔧 Technologies clés :** OpenCV, PIL (Pillow), PyMuPDF ou pdf2image.
- **💡 Concepts clés :** Traitement d'image (Niveaux de gris, Bounding boxes), Rasterisation PDF.

### 📁 adaptive_learning.py — `backend/app/services/adaptive_learning.py`
- **🎯 Rôle & Responsabilité :** Gérer l'algorithme de répétition espacée (Spaced Repetition) pour optimiser la révision des flashcards.
- **🏗️ Architecture & Patterns :** Implémentation mathématique isolée (algorithme pur).
- **🔧 Technologies clés :** Logique Python (Algorithme SuperMemo 2 ou dérivé).
- **📦 Composants principaux :** `calculate_next_review_date(quality, easiness_factor, interval, repetitions)`.
- **💡 Concepts clés :** Répétition Espacée (SRS - Spaced Repetition System), Facteur de facilité (EF).
- **⚙️ Scénario :** Un étudiant répond "Facile" à une flashcard. L'algorithme augmente l'intervalle et programme la prochaine révision dans 4 jours.

### 📁 subject_classifier.py
- **🎯 Rôle & Responsabilité :** Déterminer automatiquement la matière (Math, Histoire, Physique) d'une note à partir de son texte.
- **🔧 Technologies clés :** LLM ou heuristiques par mots-clés.
- **💡 Concepts clés :** Classification de texte (NLP - Natural Language Processing).

### 📁 requirements.txt & Dockerfile
- **🎯 Rôle & Responsabilité :** Gérer l'environnement, les dépendances et le déploiement du Backend.
- **🔧 Technologies clés :** pip, Docker.
- **💡 Concepts clés :** Conteneurisation (Docker), Reproductibilité des environnements, Gestionnaires de paquets.
- **⚙️ Scénario :** Sur le serveur de prod, `docker build -t aaca-backend .` crée une image contenant Python, FastAPI, et toutes les dépendances du requirements.txt, prête à s'exécuter de façon isolée.

---

## 2. FRONTEND (React Native / Expo + TypeScript)

### 📁 App.tsx / Frontend Entry
*(Note: Avec Expo Router, le vrai point d'entrée est le dossier `app/`, mais `App.tsx` ou `app/_layout.tsx` gèrent la coquille).*
- **🎯 Rôle & Responsabilité :** Point d'entrée de l'application mobile. Met en place les Providers (Contextes), la navigation racine, et le thème.
- **🏗️ Architecture & Patterns :** Pattern *Provider* (pour le state global), *Composition* de composants.
- **🔧 Technologies clés :** React Native, Expo Router.
- **📦 Composants principaux :** `RootLayout`, `ThemeProvider`, `AuthProvider`.
- **🔗 Dépendances :** Enveloppe toute l'application.
- **💡 Concepts clés :** Arbre de composants (Component Tree), React Context (State management global), Système de navigation par fichier (Expo Router).

### 📁 theme.ts — `frontend/theme.ts`
- **🎯 Rôle & Responsabilité :** Centralise les couleurs, typographies, espacements et styles globaux (Design System) de l'application.
- **🏗️ Architecture & Patterns :** *Design Tokens*.
- **💡 Concepts clés :** Design System, Mode Sombre/Clair, UI Consistency.
- **⚙️ Scénario :** Pour changer la couleur principale de toute l'app du bleu au vert, il suffit de modifier `colors.primary` ici.

### 📁 app/_layout.tsx, app/index.tsx
- **🎯 Rôle & Responsabilité :** `_layout.tsx` définit l'enrobage (Headers, Tab Bars) pour les écrans de ce dossier. `index.tsx` est l'écran par défaut (Splash screen ou redirection Auth/Home).
- **🔧 Technologies clés :** Expo Router (Stack, Tabs).
- **💡 Concepts clés :** File-based routing (comme Next.js mais pour le mobile).

### 📁 app/capture.tsx — `frontend/app/capture.tsx`
- **🎯 Rôle & Responsabilité :** L'écran d'appareil photo. Permet à l'utilisateur de prendre en photo un cours ou d'importer une image de la galerie.
- **🏗️ Architecture & Patterns :** Composant complexe gérant des permissions systèmes et des états locaux lourds.
- **🔧 Technologies clés :** `expo-camera`, `expo-image-picker`.
- **📦 Composants principaux :** Vue caméra, Bouton de capture, Crop/Recadrage UI.
- **💡 Concepts clés :** Gestion des permissions (Asynchrone), Accès matériel natif, Gestion de la mémoire (Nettoyage de la caméra en quittant).
- **⚙️ Scénario :** Demande la permission d'accès. Si ok, affiche le flux vidéo. Au clic, capture la frame, la stocke temporairement, puis navigue vers l'écran d'upload.

### 📁 app/note-detail.tsx
- **🎯 Rôle & Responsabilité :** Afficher le contenu riche (texte, formules, quiz, flashcards) d'une note spécifique générée par le Backend.
- **🔧 Technologies clés :** React Native ScrollView, rendu conditionnel.
- **🔗 Dépendances :** Utilise `NoteContentView.tsx`, `MathParagraph.tsx`, et le `NotesContext`.
- **💡 Concepts clés :** Rendu de listes virtuelles, Passing de Props, Rendu de Markdown/Latex sur mobile.

### 📁 app/session-new.tsx
- **🎯 Rôle & Responsabilité :** Écran pour démarrer une nouvelle session de révision (Flashcards) basée sur l'algorithme Spaced Repetition.
- **💡 Concepts clés :** Gestion d'état complexe (Quelle carte afficher, calculer le score, mettre à jour le backend avec le résultat).

### 📁 Composants : UIKit.tsx, NoteContentView.tsx, MathFormula.tsx, etc.
- **🎯 Rôle & Responsabilité :** `UIKit.tsx` regroupe des composants de base réutilisables (Boutons, Cards, Inputs). `MathFormula` et `MathParagraph` permettent d'afficher du LaTeX de manière esthétique.
- **🏗️ Architecture & Patterns :** *Atomic Design* (Atomes -> Molécules -> Organismes). Composants purs/dumbs.
- **🔧 Technologies clés :** `react-native-math-view` ou équivalent (ex: WebView) pour le rendu LaTeX.
- **💡 Concepts clés :** Réutilisabilité des composants, Separation of Concerns (UI vs Logique).

### 📁 Dossier `contexts/` (AuthContext, NotesContext, StudyContext)
- **🎯 Rôle & Responsabilité :** Gestion d'état global. Évite de passer des props "en cascade" sur 10 niveaux (Prop Drilling).
- **🏗️ Architecture & Patterns :** Pattern *Observer / Context*.
- **🔧 Technologies clés :** React `createContext`, `useReducer` ou `useState`.
- **🔗 Dépendances :** Consomment les API du dossier `config/api.ts`.
- **💡 Concepts clés :** Global State Management, React Hooks, Persistence locale (AsyncStorage pour garder le token).
- **⚙️ Scénario :** `AuthContext` gère le Token d'authentification. Quand on se log, il sauvegarde le token et informe toute l'application que l'utilisateur est connecté, provoquant le rerender du layout pour afficher les Tabs au lieu de l'écran de Login.

### 📁 Dossier `config/` (api.ts)
- **🎯 Rôle & Responsabilité :** Instance Axios configurée centralisant les appels réseau vers le Backend.
- **🔧 Technologies clés :** Axios, Interceptors.
- **💡 Concepts clés :** Axios Interceptors (pour ajouter le Bearer Token JWT à chaque requête automatiquement), Gestion centralisée des erreurs réseau (ex: déconnexion si 401).

---

## 🌐 Vue d'ensemble de l'architecture

### 🔄 Diagramme de flux simplifié (texte)

```text
[ UTILISATEUR MOBILE ] 
       │ 
       ▼ 
[ FRONTEND : Expo / React Native ] 
  (Prend photo -> Envoie via Axios avec Token JWT)
       │
       ▼ (Requête HTTP POST /upload)
       │
[ BACKEND : FastAPI ] (routes.py)
       │
       ├─► (Validation par schemas.py)
       │
       ▼
[ PIPELINE ORCHESTRATOR ] (pipeline.py)
       │
       ├─► 1. Préparation Image (image_processor.py)
       ├─► 2. Extraction Texte (ocr_service.py / latex_service.py)
       ├─► 3. Compréhension & Structuration (llm_service.py) -> [OpenAI/Gemini]
       ├─► 4. Vectorisation (embedding_service.py) -> [ChromaDB]
       │
       ▼
[ BASE DE DONNÉES ] (mongodb_service.py)
  (Sauvegarde la Note finale, les Quiz, les Flashcards)
       │
       ▼ (Réponse HTTP 200 OK avec les données JSON)
       │
[ FRONTEND ] (Mise à jour du Context, affichage de note-detail.tsx)
```

### 🧱 Stack technologique résumée

| Couche | Technologie | Rôle & Justification |
| :--- | :--- | :--- |
| **Frontend Mobile** | React Native / Expo | Développement cross-platform (iOS/Android) rapide avec un seul code TypeScript. |
| **Routage Mobile** | Expo Router | Routage basé sur les fichiers, simplifie la navigation et la gestion des deep links. |
| **Backend API** | FastAPI (Python) | Très rapide, asynchrone nativement, documentation automatique (Swagger), parfait pour l'IA/ML en Python. |
| **Base de Données** | MongoDB | NoSQL, flexibilité des schémas (une "Note" peut avoir des structures variées). |
| **Vector DB** | ChromaDB (local) | Stockage des embeddings pour permettre le RAG sans coût cloud supplémentaire. |
| **Moteurs d'IA** | LLM (OpenAI/Gemini), PaddleOCR, Pix2Tex | Extraction sémantique, vision par ordinateur, et structuration des connaissances. |

### ❓ Questions de jury probables & Réponses suggérées

1. **Jury : Pourquoi avoir choisi FastAPI plutôt que Django ou Node.js ?**
   * **Réponse :** Le cœur du projet nécessite de la Data Science, de l'OCR et des appels LLM, dont l'écosystème est presque exclusivement en Python (LangChain, PaddleOCR, Transformers). FastAPI a été choisi car il est asynchrone (non-bloquant pendant les longs appels à l'IA), très performant, et valide automatiquement les données grâce à Pydantic, ce qui évite beaucoup de bugs.

2. **Jury : Comment gérez-vous la sécurité des données utilisateurs ?**
   * **Réponse :** L'authentification utilise des JWT (JSON Web Tokens). Les mots de passe sont hachés en base (Bcrypt). De plus, les variables sensibles sont exclues du code source (`.env`) et les routes API sont protégées par injection de dépendance vérifiant la validité du token.

3. **Jury : Qu'est-ce que le RAG exactement et pourquoi l'utiliser ?**
   * **Réponse :** RAG (Retrieval-Augmented Generation) consiste à fournir à un LLM des informations pertinentes *issues de la base de l'utilisateur* juste avant qu'il réponde. Cela empêche les hallucinations de l'IA. Ainsi, quand l'étudiant pose une question, l'assistant répond *strictement* avec les notes de l'étudiant et non avec Internet de manière générique.

4. **Jury : Que se passe-t-il si la photo est floue ou l'OCR échoue ?**
   * **Réponse :** L'architecture est résiliente. Nous appliquons d'abord des filtres OpenCV (contraste, binarisation). Si l'OCR classique (PaddleOCR) échoue ou renvoie une confiance trop faible, nous avons prévu un mécanisme de *fallback* (secours) faisant appel à des modèles de vision multimodaux puissants (ex: GPT-4o Vision) pour extraire le texte.

5. **Jury : Comment fonctionne votre algorithme "Adaptive Learning" ?**
   * **Réponse :** Il est basé sur la répétition espacée (type SuperMemo-2). À chaque fois qu'une flashcard est révisée, l'utilisateur indique sa difficulté (Facile, Moyen, Difficile). L'algorithme ajuste alors un "facteur de facilité" et recalcule l'intervalle de temps avant la prochaine révision. Plus c'est facile, plus l'intervalle grandit exponentiellement.

6. **Jury : Pourquoi utiliser MongoDB (NoSQL) plutôt qu'une base SQL comme PostgreSQL ?**
   * **Réponse :** Le contenu généré par l'IA est très polymorphe. Une note de Mathématiques aura des objets "formules", une note d'Histoire aura des "frises chronologiques". Le JSON flexible (BSON) de MongoDB est parfait pour stocker ces objets imbriqués sans devoir créer des dizaines de tables de jointure SQL complexes.

7. **Jury : Comment avez-vous géré l'asynchronisme dans React Native ?**
   * **Réponse :** Nous utilisons des React Hooks (`useEffect`, `useState`) et `AsyncStorage` pour stocker le token. Les appels réseaux vers FastAPI sont faits via Axios encapsulé dans des fonctions `async/await`, gérées dans le `Context` pour centraliser le loading state et la gestion d'erreurs.

8. **Jury : Quelle est la différence entre votre OCR et l'utilisation de Pix2Tex ?**
   * **Réponse :** Un OCR classique détecte des lettres (A, B, C). Il échoue complètement sur des fractions, des intégrales ou des matrices. Pix2Tex (LaTeX service) est un modèle entraîné spécifiquement sur des documents scientifiques pour convertir une image mathématique en langage de formatage LaTeX, que notre frontend sait ensuite rendre visuellement.

### 📖 Glossaire des concepts importants

- **RAG (Retrieval-Augmented Generation) :** Technique IA permettant d'injecter du contexte spécifique dans un modèle linguistique pour améliorer sa réponse et limiter les hallucinations.
- **OCR (Optical Character Recognition) :** Technologie convertissant des images de texte en texte éditable par la machine.
- **LLM (Large Language Model) :** Modèle d'intelligence artificielle (comme GPT-4 ou Gemini) capable de comprendre, résumer et générer du texte.
- **Embedding :** Représentation mathématique (un vecteur/tableau de nombres) d'un mot ou d'une phrase. Des phrases au sens proche ont des vecteurs proches.
- **Vector Store (ex: ChromaDB) :** Base de données spécialisée pour stocker et rechercher rapidement ces fameux vecteurs (Embeddings).
- **Spaced Repetition (Répétition Espacée) :** Technique d'apprentissage cognitif optimisant les moments de révision pour faire passer l'information de la mémoire à court terme vers la mémoire à long terme.
- **JWT (JSON Web Token) :** Standard sécurisé pour transmettre des informations (comme l'identité de l'utilisateur) entre le front et le back.
- **Pipeline :** Séquence de processus où la sortie du processus A devient l'entrée du processus B.
