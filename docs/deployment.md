# AACA Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment](#backend-deployment)
3. [Frontend Deployment](#frontend-deployment)
4. [Database Setup](#database-setup)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- **Firebase**: For database and storage
- **Cloud Provider**: AWS/GCP/Azure or any VPS provider
- **Domain Name**: For production deployment
- **SSL Certificate**: Let's Encrypt (free) or purchased

### Required Tools

```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Install gcloud (if using GCP)
curl https://sdk.cloud.google.com | bash

# Install AWS CLI (if using AWS)
pip install awscli

# Install EAS CLI (for mobile builds)
npm install -g eas-cli
```

---

## Backend Deployment

### Option 1: Docker Deployment (Recommended)

#### 1. Build Docker Image

```bash
cd backend

# Build the image
docker build -t aaca-backend:latest .

# Tag for registry
docker tag aaca-backend:latest your-registry/aaca-backend:v1.0.0
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    image: aaca-backend:latest
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - FIREBASE_CREDENTIALS_PATH=/app/firebase-credentials.json
      - MONGODB_URL=${MONGODB_URL}
    volumes:
      - ./firebase-credentials.json:/app/firebase-credentials.json:ro
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: unless-stopped
```

#### 3. Deploy

```bash
# Copy environment file
scp .env.production user@server:/app/.env

# Copy docker-compose
scp docker-compose.yml user@server:/app/

# Deploy
ssh user@server << 'EOF'
  cd /app
  docker-compose pull
  docker-compose up -d
  docker-compose logs -f
EOF
```

### Option 2: Cloud Run (GCP)

```bash
# Build and push
gcloud builds submit --tag gcr.io/your-project/aaca-backend

# Deploy
gcloud run deploy aaca-backend \
  --image gcr.io/your-project/aaca-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="SECRET_KEY=...,OPENAI_API_KEY=..."
```

### Option 3: AWS ECS

```bash
# Create cluster
aws ecs create-cluster --cluster-name aaca-cluster

# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster aaca-cluster \
  --service-name aaca-backend \
  --task-definition aaca-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

---

## Frontend Deployment

### Mobile Apps (EAS Build)

#### 1. Configure EAS

```bash
cd frontend

# Login to Expo
npx expo login

# Configure EAS
eas build:configure
```

#### 2. Update app.json

```json
{
  "expo": {
    "name": "AACA",
    "slug": "aaca-mobile",
    "version": "1.0.0",
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id"
    }
  }
}
```

#### 3. Build

```bash
# iOS Build
eas build --platform ios

# Android Build
eas build --platform android

# Both
eas build --platform all
```

#### 4. Submit to Stores

```bash
# Submit to App Store
eas submit -p ios

# Submit to Play Store
eas submit -p android
```

### Web Deployment

#### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

#### Netlify

```bash
# Build web version
npx expo export:web

# Deploy to Netlify
netlify deploy --prod --dir=web-build
```

---

## Database Setup

### Firebase Setup

#### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project"
3. Enable Firestore and Storage

#### 2. Service Account

```bash
# Generate service account key
# Firebase Console → Project Settings → Service Accounts → Generate Key

# Download and save as firebase-credentials.json
# Never commit this file to git!
```

#### 3. Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Notes - user can access their own
    match /notes/{noteId} {
      allow read, write: if request.auth != null && 
        resource.data.user_id == request.auth.uid;
    }
    
    // Quizzes
    match /quizzes/{quizId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/notes/$(resource.data.note_id)).data.user_id == request.auth.uid;
    }
    
    // Flashcards
    match /flashcards/{cardId} {
      allow read, write: if request.auth != null;
    }
    
    // Quiz results
    match /quiz_results/{resultId} {
      allow read, write: if request.auth != null && 
        resource.data.user_id == request.auth.uid;
    }
    
    // User progress
    match /user_progress/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### 4. Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Monitoring

### Logging

```python
# backend/app/core/logging.py
import logging
from google.cloud import logging as cloud_logging

# Setup cloud logging for production
def setup_cloud_logging():
    client = cloud_logging.Client()
    handler = client.get_default_handler()
    cloud_logger = logging.getLogger("aaca")
    cloud_logger.handlers = [handler]
    cloud_logger.setLevel(logging.INFO)
```

### Health Checks

```bash
# Add to docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Metrics (Prometheus + Grafana)

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker Image
        run: |
          docker build -t aaca-backend:${{ github.sha }} ./backend
      
      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push aaca-backend:${{ github.sha }}
      
      - name: Deploy
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} << EOF
            docker pull aaca-backend:${{ github.sha }}
            docker-compose up -d
          EOF

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install EAS CLI
        run: npm install -g eas-cli
      
      - name: Build iOS
        run: |
          cd frontend
          eas build --platform ios --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## Troubleshooting

### Common Issues

#### 1. Firebase Connection Failed

```bash
# Check credentials
python -c "
import firebase_admin
from firebase_admin import credentials
cred = credentials.Certificate('firebase-credentials.json')
firebase_admin.initialize_app(cred)
print('Firebase connected!')
"
```

#### 2. CORS Errors

```python
# Ensure CORS origins are configured correctly
# backend/app/core/config.py
CORS_ORIGINS = [
    "https://yourdomain.com",
    "https://app.yourdomain.com",
]
```

#### 3. Memory Issues with AI Models

```bash
# Increase Docker memory limit
docker run -m 4g aaca-backend:latest

# Or in docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 4G
```

#### 4. Slow Image Processing

- Ensure images are resized before upload
- Use CDN for image delivery
- Consider using GPU instances for AI processing

---

## Security Checklist

- [ ] Use strong SECRET_KEY (at least 32 characters)
- [ ] Enable HTTPS only
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable Firebase App Check
- [ ] Set up proper Firestore rules
- [ ] Regular security audits
- [ ] Keep dependencies updated

---

## Performance Optimization

### Backend

```python
# Enable response compression
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Use async database drivers
# Enable caching with Redis
```

### Frontend

```javascript
// Enable Hermes engine
// app.json
{
  "expo": {
    "jsEngine": "hermes"
  }
}

// Lazy load screens
const HeavyScreen = React.lazy(() => import('./HeavyScreen'));
```

---

## Backup Strategy

### Firebase Backup

```bash
# Automated backup using gcloud
0 0 * * * gcloud firestore export gs://your-bucket/backup-$(date +\%Y-\%m-\%d)
```

### Application Data

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec aaca-db pg_dump -U user dbname > backup_$DATE.sql
gsutil cp backup_$DATE.sql gs://your-backup-bucket/
```
