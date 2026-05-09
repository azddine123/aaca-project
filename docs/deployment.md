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

- **MongoDB**: For database and GridFS image storage
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
      - MONGODB_URL=${MONGODB_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
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

### MongoDB Setup

#### 1. Local / Self-hosted

```bash
# Install MongoDB Community Edition
sudo apt-get install -y mongodb-org

# Start the service
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### 2. MongoDB Atlas (Cloud, Recommended for Production)

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster (M0 tier)
3. Create a database user with read/write permissions
4. Whitelist your server IP (or `0.0.0.0/0` for dev)
5. Copy the connection string

#### 3. Configure the Backend

```bash
# .env
MONGODB_URL=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/aaca?retryWrites=true&w=majority
```

The backend auto-creates all collections and GridFS buckets on first use — no manual schema setup required.

#### 4. MongoDB Indexes (Applied Automatically)

The service layer creates the following indexes on startup:

| Collection | Index |
|------------|-------|
| `users` | `email` (unique) |
| `notes` | `user_id`, `session_id` |
| `flashcards` | `note_id`, `next_review` |
| `quiz_results` | `quiz_id`, `user_id` |
| `course_sessions` | `user_id`, `status` |

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

#### 1. MongoDB Connection Failed

```bash
# Check connection from within the container
python -c "
from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017')
print(client.server_info())
print('MongoDB connected!')
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
- [ ] Set up MongoDB access controls and IP whitelist
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

### MongoDB Backup

```bash
# Dump all collections (cron daily at midnight)
0 0 * * * mongodump --uri="${MONGODB_URL}" --out=/backups/$(date +\%Y-\%m-\%d)
```

### Application Data

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec aaca-db pg_dump -U user dbname > backup_$DATE.sql
gsutil cp backup_$DATE.sql gs://your-backup-bucket/
```
