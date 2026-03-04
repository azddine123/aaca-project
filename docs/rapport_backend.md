# 📚 Comprendre le Backend AACA
## Guide pédagogique pour débutants

---

## 🎯 Introduction : Qu'est-ce qu'un Backend ?

### Définition simple
Le **backend** (ou "arrière-plan") est comme le **cerveau** et le **cœur** d'une application. C'est la partie invisible pour les utilisateurs, mais qui fait tout le travail de :

- Traiter les données
- Prendre des décisions
- Communiquer avec la base de données
- Répondre aux demandes du frontend (l'interface utilisateur)

### Analogie pour mieux comprendre

Imaginez un restaurant :

| Élément | Équivalent technique |
|---------|---------------------|
| La salle du restaurant, le menu, les tables | **Frontend** (ce que le client voit) |
| La cuisine, le chef, les ingrédients, les recettes | **Backend** (ce qui se passe derrière) |
| Le serveur qui prend la commande et apporte les plats | **API** |

### Notre projet : AACA

**AACA** (AI Academic Cognitive Assistant) est une application qui :

1. 📷 Prend une photo d'un tableau ou de notes
2. 🔤 Extrait le texte et les formules mathématiques
3. 📝 Génère des résumés, quiz et flashcards
4. 🎓 Adapte l'apprentissage selon votre niveau

---

## 🏗️ Architecture du Backend

### Vue d'ensemble

```
                    ┌─────────────────────────────────────┐
                    │           CLIENT (Frontend)         │
                    │         (React Native/Expo)         │
                    └──────────────┬──────────────────────┘
                                   │ Requête HTTP
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                         │
│                                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐    │
│  │  main.py    │───▶│ api/routes   │───▶│    Services      │    │
│  │ (Point d'   │    │  (Endpoints) │    │                  │    │
│  │   entrée)   │    └──────────────┘    │ • pipeline.py    │    │
│  └─────────────┘           │            │ • llm_service    │    │
│                            │            │ • database.py    │    │
│                            ▼            │ • image_proc     │    │
│                     ┌──────────────┐    │ • ocr_service    │    │
│                     │ models/      │    └──────────────────┘    │
│                     │  schemas.py  │              │              │
│                     └──────────────┘              ▼              │
│                            │            ┌──────────────────┐    │
│                            ▼            │   Firebase DB    │    │
│                     ┌──────────────┐    │   + Storage      │    │
│                     │ core/        │    └──────────────────┘    │
│                     │ • config.py  │                             │
│                     │ • security.py│                             │
│                     └──────────────┘                             │
└──────────────────────────────────────────────────────────────────┘
```

### Structure des dossiers

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              ← Point d'entrée
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        ← Endpoints API
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        ← Configuration
│   │   ├── security.py      ← Authentification
│   │   ├── firebase.py      ← Connexion Firebase
│   │   └── logging.py       ← Logs
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py       ← Modèles de données
│   └── services/
│       ├── __init__.py
│       ├── pipeline.py      ← Pipeline principal
│       ├── llm_service.py   ← Service IA
│       ├── database.py      ← Accès BDD
│       ├── image_processor.py ← OpenCV
│       ├── ocr_service.py   ← OCR
│       ├── latex_service.py ← Formules
│       ├── subject_classifier.py
│       └── adaptive_learning.py
├── tests/
├── requirements.txt         ← Dépendances
├── Dockerfile
└── .env                     ← Variables d'environnement
```

**Organisation :**

| Dossier | Rôle |
|---------|------|
| `app/` | Code source principal |
| `api/` | Routes et endpoints (les "portes d'entrée") |
| `core/` | Configuration et utilitaires centraux |
| `models/` | Définition des données (schémas) |
| `services/` | Logique métier (le "cerveau") |
| `tests/` | Tests pour vérifier le fonctionnement |

---

## 🛠️ Les Technologies Utilisées

### Python et FastAPI

**FastAPI** est un framework moderne pour créer des APIs en Python :

| Caractéristique | Description |
|-----------------|-------------|
| ⚡ **Rapide** | Parmi les frameworks Python les plus rapides |
| 🎯 **Simple** | Facile à apprendre et utiliser |
| 📖 **Documenté** | Génère automatiquement la documentation |
| 🔧 **Moderne** | Utilise les dernières fonctionnalités de Python |

### Les bibliothèques principales

| Bibliothèque | Rôle | Description simple |
|--------------|------|-------------------|
| `fastapi` | Serveur Web | Crée l'API et gère les requêtes |
| `uvicorn` | Serveur HTTP | Fait tourner l'application |
| `pydantic` | Validation | Vérifie que les données sont correctes |
| `firebase-admin` | Base de données | Stocke les données utilisateurs |
| `opencv-python` | Traitement d'image | Améliore les photos |
| `easyocr` | OCR | Extrait le texte des images |
| `openai` | IA | Utilise GPT pour générer du contenu |
| `python-jose` | Sécurité | Gère les tokens d'authentification |

---

## 🔄 Le Pipeline de Traitement

Le **pipeline** est le cœur du backend - il transforme une image en contenu éducatif.

### Diagramme du flux de données

```
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────────┐
│  Image   │────▶│Prétraitement │────▶│   OCR    │────▶│    LaTeX     │
│  Photo   │     │   OpenCV     │     │  EasyOCR │     │   Formules   │
└──────────┘     └──────────────┘     └──────────┘     └──────┬───────┘
                                                               │
                                                               ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Contenu    │◀────│     IA       │◀────│ Classification   │
│  Résumé,Quiz │     │   GPT-4      │     │    Matière       │
└──────────────┘     └──────────────┘     └──────────────────┘
```

### Explication détaillée des étapes

#### Étape 1 : Prétraitement de l'image (`image_processor.py`)

```python
async def preprocess(image_bytes, 
                     perspective_correction=True,
                     enhance_contrast=True):
    # 1. Redimensionner si trop grande
    image = resize_if_needed(image)
    
    # 2. Correction de perspective (redresser le document)
    if perspective_correction:
        image = correct_perspective(image)
    
    # 3. Conversion en niveaux de gris
    gray = cv2.cvtColor(image, COLOR_BGR2GRAY)
    
    # 4. Réduction du bruit
    gray = denoise(gray)
    
    # 5. Amélioration du contraste
    if enhance_contrast:
        gray = enhance_contrast(gray)
    
    return processed_image
```

**Analogie :** Vous prenez une photo d'un tableau blanc depuis un angle. Le prétraitement va :
1. Redresser l'image pour qu'elle soit droite
2. Améliorer le contraste pour que le texte soit plus lisible
3. Enlever le "bruit" (pixels parasites)

#### Étape 2 : OCR (Reconnaissance de caractères)

**OCR** = **O**ptical **C**haracter **R**ecognition

C'est une technologie qui convertit une image contenant du texte en texte "numérique" éditable.

```python
async def extract_text(image, detect_formulas=True):
    # Utilise EasyOCR pour lire le texte
    result = reader.readtext(image)
    
    text = ""
    for detection in result:
        bbox, detected_text, conf = detection
        text += detected_text + " "
    
    return {"text": text, "confidence": confidence}
```

#### Étape 3 : Reconnaissance des formules LaTeX

Pour les formules mathématiques comme ∫₀^∞ e^(-x²) dx = √π/2, on utilise **pix2tex**.

#### Étape 4 : Classification de la matière

```python
def classify(text, formulas):
    keywords = {
        "mathematics": ["equation", "derivative", "integral"],
        "physics": ["force", "energy", "velocity"],
        "chemistry": ["molecule", "reaction", "acid"],
        # ... etc
    }
    
    # Compte les mots-clés et choisit la matière la plus probable
    return subject, confidence
```

#### Étape 5 : Traitement par IA (LLM)

**LLM** = **L**arge **L**anguage **M**odel

Un LLM est un modèle d'intelligence artificielle entraîné sur des millions de textes :

| Capacité | Description |
|----------|-------------|
| Compréhension | Comprendre le sens des phrases |
| Résumé | Résumer des textes longs |
| Génération | Créer des questions de quiz |
| Adaptation | Adapter le niveau de difficulté |

**Fournisseurs supportés :**
- OpenAI (GPT-4)
- Google (Gemini)
- Anthropic (Claude)

---

## 🔌 Les Endpoints API (Routes)

Les **endpoints** sont les "adresses" auxquelles le frontend peut envoyer des demandes.

### Routes principales

#### 🔐 Authentification
```
POST /auth/register    → Créer un compte
POST /auth/login       → Se connecter
```

#### 🖼️ Traitement
```
POST /process/image    → Traiter une image
POST /process/capture  → Capturer & sauvegarder
```

#### 📝 Notes
```
GET  /notes            → Liste des notes
GET  /notes/{id}       → Détails d'une note
PATCH /notes/{id}      → Modifier une note
DELETE /notes/{id}     → Supprimer une note
```

#### ❓ Quiz
```
POST /notes/{id}/quizzes      → Créer un quiz
POST /quizzes/{id}/submit     → Soumettre réponses
GET  /notes/{id}/quizzes      → Voir les quiz
```

#### 🎴 Flashcards
```
GET  /notes/{id}/flashcards   → Voir les flashcards
POST /flashcards/{id}/review  → Réviser une carte
GET  /flashcards/due          → Cartes à réviser
```

### Exemple d'un endpoint complet (Connexion)

```python
@router.post("/auth/login")
async def login(email: str = Form(...), 
                password: str = Form(...)):
    """Connexion d'un utilisateur"""
    
    # 1. Chercher l'utilisateur dans la base
    user = await database.get_user_by_email(email)
    
    # 2. Vérifier le mot de passe
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Identifiants invalides"
        )
    
    # 3. Créer les tokens JWT
    access_token = create_access_token({"sub": user["id"]})
    refresh_token = create_refresh_token({"sub": user["id"]})
    
    # 4. Retourner les tokens
    return {
        "user_id": user["id"],
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
```

---

## 📋 Les Modèles de Données (Schemas)

### Qu'est-ce qu'un modèle ?

Un **modèle** (ou *schema*) définit la structure des données. C'est comme un formulaire qui indique quelles informations sont nécessaires.

**Analogie :** Un modèle Pydantic est comme un formulaire administratif :
- **Champs obligatoires** = Informations requises
- **Types de données** = Format attendu (texte, nombre, date)
- **Validation** = Vérification automatique

### Exemple : Le modèle User

```python
class User(BaseModel):
    id: str                    # Identifiant unique
    email: str                 # Adresse email
    full_name: str             # Nom complet
    cognitive_level: str       # Niveau: débutant/inter/avancé
    preferred_subjects: List   # Matières préférées
    created_at: datetime       # Date de création
    is_active: bool            # Compte actif ?
    is_premium: bool           # Compte premium ?
```

### Diagramme des entités

```
┌──────────────────┐         ┌──────────────────┐
│      USER        │         │      NOTE        │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ id (PK)          │
│ email            │    ┌────│ user_id (FK)     │
│ full_name        │◀───┘    │ title            │
│ cognitive_level  │  crée   │ subject          │
│ created_at       │         │ raw_text         │
│ is_active        │         │ summary          │
│ is_premium       │         │ created_at       │
└──────────────────┘         └────────┬─────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
           ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
           │     QUIZ       │  │   FLASHCARD    │  │ QUIZ_RESULT    │
           ├────────────────┤  ├────────────────┤  ├────────────────┤
           │ id (PK)        │  │ id (PK)        │  │ id (PK)        │
           │ note_id (FK)   │  │ note_id (FK)   │  │ quiz_id (FK)   │
           │ title          │  │ front          │  │ user_id (FK)   │
           │ questions      │  │ back           │  │ score          │
           │ difficulty     │  │ difficulty     │  │ time_taken     │
           │ total_points   │  │ mastery_level  │  │ created_at     │
           └────────────────┘  └────────────────┘  └────────────────┘
```

---

## 🔒 La Sécurité

### Authentification JWT

**JWT** = **J**SON **W**eb **T**oken

Un token JWT est comme une **carte d'identité numérique** :
- L'identité de l'utilisateur
- Une date d'expiration
- Une signature pour vérifier qu'il est authentique

**Structure d'un JWT :**
```
xxxxx.yyyyy.zzzzz
   │      │      │
   │      │      └── Signature (clé secrète)
   │      └───────── Payload (ID + expiration)
   └──────────────── Header (type + algorithme)
```

### Hashage des mots de passe

> ⚠️ **IMPORTANT :** On ne stocke **JAMAIS** les mots de passe en clair !

On utilise **bcrypt** pour les hasher :

```python
# Hasher un mot de passe
password_hash = get_password_hash("mon_mot_de_passe")
# Résultat: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttx...

# Vérifier un mot de passe
is_valid = verify_password("mon_mot_de_passe", password_hash)
# Retourne: True ou False
```

---

## 💾 La Base de Données (Firebase)

### Pourquoi Firebase ?

| Service | Utilisation |
|---------|-------------|
| **Firestore** | Base de données NoSQL flexible |
| **Authentication** | Gestion des utilisateurs |
| **Storage** | Stockage des images |
| **Gratuit** | Niveau gratuit généreux |

### Structure Firestore

```
Firestore Database
├── users/                    ← Collection
│   ├── user_001/            ← Document
│   │   ├── email: "john@..."
│   │   ├── full_name: "John Doe"
│   │   └── cognitive_level: "intermediate"
│   └── user_002/
│
├── notes/
│   ├── note_001/
│   │   ├── user_id: "user_001"
│   │   ├── title: "Mathématiques"
│   │   ├── raw_text: "Le théorème de Pythagore..."
│   │   └── subject: "mathematics"
│   └── note_002/
│
├── quizzes/
│   ├── quiz_001/
│   │   ├── note_id: "note_001"
│   │   ├── questions: [...]
│   │   └── difficulty: "intermediate"
│   └── quiz_002/
│
├── flashcards/
└── quiz_results/
```

---

## 📖 Exemple Complet : Capture d'une Image

### Flux complet d'une capture :

```
Étape 1: Utilisateur ──────▶ Prend une photo du tableau
         │
         ▼
Étape 2: Frontend ─────────▶ Envoie l'image au backend
         │
         ▼
Étape 3: Image Processor ──▶ Redresse, améliore le contraste
         │
         ▼
Étape 4: OCR Service ──────▶ Extrait le texte de l'image
         │
         ▼
Étape 5: LaTeX Service ────▶ Détecte les formules mathématiques
         │
         ▼
Étape 6: Subject Classifier ▶ Détermine la matière (Math, Physique...)
         │
         ▼
Étape 7: LLM Service ──────▶ Structure le contenu, génère résumé
         │
         ▼
Étape 8: LLM Service ──────▶ Génère quiz et flashcards
         │
         ▼
Étape 9: Database ─────────▶ Sauvegarde tout dans Firebase
         │
         ▼
Étape 10: Backend ─────────▶ Retourne le résultat au frontend
```

### Code du pipeline principal

```python
# pipeline.py - Le chef d'orchestre

async def process_image(self, image_bytes, options=None):
    result = {"success": False, "steps": {}}
    
    try:
        # Étape 1: Prétraitement
        processed_image, meta = await image_processor.preprocess(image_bytes)
        result["steps"]["preprocessing"] = {"status": "success"}
        
        # Étape 2: OCR
        ocr_result = await ocr_service.extract_text(processed_image)
        raw_text = ocr_result["text"]
        
        # Étape 3: Formules LaTeX
        formulas = await latex_service.extract_formulas(processed_image)
        
        # Étape 4: Classification
        subject, confidence = subject_classifier.classify(raw_text, formulas)
        
        # Étape 5: Structuration avec IA
        structured = await llm_service.structure_content(raw_text, subject)
        
        # Étape 6: Génération du résumé
        summary = await llm_service.generate_summary(raw_text)
        
        # Étape 7: Génération du quiz
        quiz = await llm_service.generate_quiz(raw_text)
        
        # Compilation du résultat final
        result.update({
            "success": True,
            "raw_text": raw_text,
            "structured_content": structured,
            "summary": summary,
            "quiz": quiz,
            "detected_subject": subject
        })
        
    except Exception as e:
        result["error"] = str(e)
    
    return result
```

---

## 🚀 Pour Aller Plus Loin

### Concepts avancés à explorer

1. **Tests automatisés** : Vérifier que tout fonctionne avec pytest
2. **Cache** : Stocker temporairement les résultats pour aller plus vite
3. **Async/Await** : Gérer plusieurs tâches en parallèle
4. **Docker** : Conteneuriser l'application pour le déploiement
5. **CI/CD** : Automatiser les tests et déploiements

### Ressources recommandées

- 📖 Documentation FastAPI : https://fastapi.tiangolo.com
- 🐍 Tutoriels Python : https://docs.python.org/fr/3/tutorial/
- 📷 Cours OpenCV : https://opencv.org/courses/
- 🤖 OpenAI API : https://platform.openai.com/docs

---

## ✅ Conclusion

### Résumé

Le backend AACA est une application **Python/FastAPI** qui :

1. ✅ Reçoit des images via une API REST
2. ✅ Les prétraite avec OpenCV
3. ✅ Extrait le texte avec OCR
4. ✅ Analyse le contenu avec l'IA
5. ✅ Génère du matériel pédagogique
6. ✅ Stocke tout dans Firebase

### Schéma récapitulatif

```
┌─────────────────────────────────────────────────────────────────┐
│                     AACA BACKEND ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ENTRÉE                    TRAITEMENT                   SORTIE  │
│   ────────                  ──────────                   ──────  │
│                                                                  │
│   ┌────────┐              ┌──────────────┐              ┌──────┐│
│   │ Image  │─────────────▶│Prétraitement │─────────────▶│ Texte││
│   │ Photo  │              │   OpenCV     │              │Brut  ││
│   └────────┘              └──────────────┘              └──┬───┘│
│                                                            │    │
│   ┌────────┐              ┌──────────────┐                 │    │
│   │ Formule│◀─────────────│    OCR       │◀────────────────┘    │
│   │ LaTeX  │              │   EasyOCR    │                      │
│   └────┬───┘              └──────────────┘                      │
│        │                                                       │
│        │              ┌──────────────────────┐                 │
│        └─────────────▶│ Classification + LLM │                 │
│                       │   • Structuration    │                 │
│                       │   • Résumé           │                 │
│                       │   • Quiz             │                 │
│                       │   • Flashcards       │                 │
│                       └──────────┬───────────┘                 │
│                                  │                             │
│                                  ▼                             │
│                       ┌──────────────────────┐                 │
│                       │   Firebase Storage   │                 │
│                       │   • Images           │                 │
│                       │   • Notes            │                 │
│                       │   • Quiz             │                 │
│                       └──────────────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Fichier requirements.txt

```txt
# FastAPI Core
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# AI/ML Libraries
opencv-python==4.9.0.80
numpy==1.26.3
Pillow==10.2.0
easyocr==1.7.0
transformers==4.37.0
torch==2.1.2

# LLM Integration
openai==1.9.0
google-generativeai==0.3.2
anthropic==0.18.0

# Database
firebase-admin==6.3.0
pymongo==4.6.1

# Authentication
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Validation
pydantic==2.5.3
pydantic-settings==2.1.0

# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
```

---

**Merci d'avoir lu ce rapport !** 🎉

*N'hésitez pas à revenir sur les sections qui vous paraissent difficiles. La programmation s'apprend avec la pratique !*
