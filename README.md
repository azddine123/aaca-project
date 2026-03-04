# 🎓 AI Academic Cognitive Assistant (AACA)

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-green)](https://fastapi.tiangolo.com)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-54.0.33-black)](https://expo.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)](https://mongodb.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Transform your classroom photos into interactive, personalized learning resources using AI**

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [License](#-license)

---

## 📝 Overview

**AACA** is an intelligent mobile application that uses **Generative AI** and **Computer Vision** to transform photos of classroom content (whiteboards, handwritten notes) into interactive educational materials.

### How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  1. CAPTURE     │ ──▶ │  2. AI ANALYSIS  │ ──▶ │ 3. LEARNING     │
│                 │     │                  │     │                 │
│  📷 Take a      │     │  🔤 Extract      │     │  📚 Summaries   │
│     photo       │     │     text         │     │  ❓ Quizzes     │
│                 │     │  📐 LaTeX        │     │  🎴 Flashcards  │
│                 │     │     formulas     │     │  📊 Progress    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## ✨ Features

| Feature | Description | Technology |
|:--------|:------------|:-----------|
| **Smart Capture** | Perspective correction, contrast enhancement | OpenCV |
| **Intelligent OCR** | Text extraction with EasyOCR | EasyOCR, Tesseract |
| **LaTeX Formulas** | Mathematical equation recognition | Transformers |
| **AI Classification** | Automatic subject detection | LLM |
| **Summaries** | Level-adaptive content summaries | GPT-4 / Gemini |
| **Quizzes** | Auto-generated multiple choice questions | LLM |
| **Flashcards** | Spaced repetition cards | SM-2 Algorithm |
| **Adaptive Learning** | Difficulty adjustment based on performance | ML |
| **Full-Text Search** | Search through all your notes | MongoDB |

---

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI 0.109.0
- **Database**: MongoDB (local or Atlas)
- **AI/Vision**: OpenCV, EasyOCR, Transformers, PyTorch
- **LLM**: OpenAI GPT-4, Google Gemini, Anthropic Claude
- **Auth**: JWT (python-jose, passlib)

### Frontend
- **Framework**: React Native 0.81.5 with Expo 54.0.33
- **Navigation**: Expo Router
- **UI**: React Native Paper
- **Camera**: Expo Camera
- **State Management**: Context API

### Infrastructure
- **Containerization**: Docker
- **Storage**: Local filesystem (images)

---

## 📋 Prerequisites

| Software | Version | Link |
|:---------|:--------|:-----|
| Python | 3.9+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| MongoDB | 5.0+ | [mongodb.com](https://mongodb.com) or Docker |
| Git | Latest | [git-scm.com](https://git-scm.com) |

### API Keys (Optional but Recommended)

| Service | Purpose | Required |
|:--------|:--------|:---------|
| **OpenAI** | GPT-4 content generation | ⚠️ Recommended |
| **Google AI** | Gemini (free alternative) | ❌ Optional |
| **Anthropic** | Claude (alternative) | ❌ Optional |

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-account/aaca-project.git
cd aaca-project
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate
# Activate (Windows)
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

---

## ⚙️ Configuration

### MongoDB Setup

**Option A: Using Docker (Recommended)**

```bash
docker run -d --name mongodb-aaca -p 27017:27017 -v mongodb_aaca_data:/data/db mongo:7.0
```

**Option B: Local MongoDB**

```bash
# Linux
sudo systemctl start mongod

# macOS (with Homebrew)
brew services start mongodb-community

# Windows
net start MongoDB
```

### Backend Environment Variables

Edit `backend/.env`:

```env
# Security
SECRET_KEY=your-secret-key-generate-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=aaca_db

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4
GOOGLE_API_KEY=your-google-key
ANTHROPIC_API_KEY=your-anthropic-key

# CORS
CORS_ORIGINS=http://localhost:19006,http://localhost:3000

# Processing
OCR_ENGINE=easyocr
ENABLE_LLM_CACHE=true
```

### Frontend Environment Variables

Edit `frontend/.env`:

```env
API_BASE_URL=http://localhost:8000/api/v1
APP_ENV=development
```

> **Note**: For Android Emulator use `http://10.0.2.2:8000/api/v1`
> For iOS Simulator use `http://localhost:8000/api/v1`

---

## 🚀 Usage

### Start the Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Access Points:**
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

### Start the Frontend

```bash
cd frontend
npx expo start
```

**Options:**
- Press `w` for web mode
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with **Expo Go** app on your phone

---

## 📁 Project Structure

```
aaca-project/
├── 📁 backend/                 # FastAPI REST API
│   ├── 📁 app/
│   │   ├── 📄 main.py         # Application entry point
│   │   ├── 📁 api/
│   │   │   └── 📄 routes.py   # API endpoints
│   │   ├── 📁 core/
│   │   │   ├── 📄 config.py   # Configuration
│   │   │   ├── 📄 security.py # JWT authentication
│   │   │   └── 📄 logging.py  # Logging setup
│   │   ├── 📁 models/
│   │   │   └── 📄 schemas.py  # Pydantic models
│   │   └── 📁 services/
│   │       ├── 📄 pipeline.py         # Main processing pipeline
│   │       ├── 📄 llm_service.py      # LLM integration
│   │       ├── 📄 mongodb_service.py  # Database operations
│   │       ├── 📄 image_processor.py  # OpenCV processing
│   │       ├── 📄 ocr_service.py      # OCR text extraction
│   │       ├── 📄 latex_service.py    # Formula extraction
│   │       ├── 📄 subject_classifier.py
│   │       └── 📄 adaptive_learning.py
│   ├── 📁 tests/              # Pytest tests
│   ├── 📄 requirements.txt
│   ├── 📄 Dockerfile
│   └── 📄 .env.example
│
├── 📁 frontend/                # React Native / Expo
│   ├── 📁 app/                # Expo Router routes
│   │   ├── 📁 (auth)/         # Auth screens (login, register)
│   │   ├── 📁 (tabs)/         # Main tabs (home, notes, profile, study)
│   │   ├── 📁 contexts/       # React Contexts
│   │   ├── 📄 capture.tsx     # Camera capture screen
│   │   ├── 📄 note-detail.tsx # Note detail view
│   │   └── 📄 theme.ts        # Design system
│   ├── 📁 assets/             # Images, fonts
│   ├── 📄 App.tsx
│   ├── 📄 app.json
│   └── 📄 package.json
│
├── 📁 docs/                   # Documentation
│   ├── 📄 api_reference.md
│   ├── 📄 architecture.md
│   ├── 📄 deployment.md
│   └── 📄 rapport_backend.md
│
├── 📁 scripts/                # Utility scripts
│   ├── 📄 seed_db.py
│   ├── 📄 setup.sh
│   └── 📄 test_pipeline.py
│
├── 📄 README.md
├── 📄 .gitignore
└── 📄 LICENSE
```

---

## 📚 API Documentation

### Authentication

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/v1/auth/register` | Register new user |
| `POST` | `/api/v1/auth/login` | Login user |

### Processing

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/v1/process/image` | Process an image |
| `POST` | `/api/v1/process/capture` | Capture and save note |

### Notes

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/v1/notes` | List user notes |
| `GET` | `/api/v1/notes/{id}` | Get note details |
| `PATCH` | `/api/v1/notes/{id}` | Update note |
| `DELETE` | `/api/v1/notes/{id}` | Delete note |
| `POST` | `/api/v1/notes/{id}/summary` | Generate summary |

### Quizzes

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/v1/notes/{id}/quizzes` | Get note quizzes |
| `POST` | `/api/v1/notes/{id}/quizzes` | Create quiz |
| `POST` | `/api/v1/quizzes/{id}/submit` | Submit answers |

### Flashcards

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/v1/notes/{id}/flashcards` | Get flashcards |
| `POST` | `/api/v1/flashcards/{id}/review` | Review card |
| `GET` | `/api/v1/flashcards/due` | Get due cards |

### User

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/v1/user/me` | Get profile |
| `GET` | `/api/v1/user/progress` | Get progress |
| `GET` | `/api/v1/user/recommendations` | Get recommendations |
| `GET` | `/api/v1/stats` | Get statistics |

---

## 🧪 Development

### Running Tests

**Backend:**

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# With coverage
pytest --cov=app

# Specific tests
pytest tests/test_auth.py
pytest tests/test_processing.py -v
```

**Frontend:**

```bash
cd frontend
npm test
```

### Code Style

- **Python**: Follow PEP 8 with `black` and `isort`
- **TypeScript**: Use strict types and ESLint configuration

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "✨ Add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Guidelines

- Write tests for new features
- Update documentation
- Follow existing code style
- Use conventional commits

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT models
- [Google](https://ai.google) for Gemini
- [EasyOCR](https://github.com/JaidedAI/EasyOCR) for OCR
- [FastAPI](https://fastapi.tiangolo.com) for the backend framework
- [Expo](https://expo.dev) for mobile development
- [MongoDB](https://mongodb.com) for database

---

<p align="center">
  <b>Built with ❤️ for students and educators worldwide</b>
</p>

<p align="center">
  <a href="https://github.com/your-account/aaca-project">⭐ Star this repo</a> if you find it useful!
</p>
