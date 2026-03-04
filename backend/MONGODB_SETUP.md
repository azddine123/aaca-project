# 🍃 Configuration MongoDB pour AACA

Guide de configuration et d'utilisation de MongoDB pour le backend AACA.

## 🚀 Démarrage rapide

### Étape 1 : Démarrer MongoDB

```bash
# Avec Docker (RECOMMANDÉ)
docker run -d --name mongodb-aaca -p 27017:27017 -v mongodb_aaca_data:/data/db mongo:7.0

# Ou MongoDB local
sudo systemctl start mongod
```

### Étape 2 : Démarrer le backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

## ⚙️ Configuration

### Variables d'environnement (.env)

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=aaca_db
```

### Structure du stockage

```
backend/
├── uploads/                    ← Images stockées localement
│   └── {user_id}/{note_id}/
└── ...
```

## 📊 Structure des données

### Collection `users`
```json
{
  "id": "string",
  "email": "user@example.com",
  "full_name": "John Doe",
  "password_hash": "hashed_password",
  "cognitive_level": "intermediate",
  "preferred_subjects": ["mathematics"],
  "is_active": true,
  "created_at": ISODate
}
```

### Collection `notes`
```json
{
  "id": "string",
  "user_id": "user_id",
  "title": "Cours de Maths",
  "subject": "mathematics",
  "raw_text": "...",
  "summary": "...",
  "processed_content": { ... },
  "created_at": ISODate
}
```

## 🔧 Dépannage

### MongoDB non connecté
```bash
docker ps | grep mongo
docker start mongodb-aaca
```

### Permission denied sur uploads/
```bash
chmod -R 755 backend/uploads
```

### Port 27017 déjà utilisé
```bash
sudo lsof -i :27017
# Ou utiliser un autre port
docker run -d --name mongodb-aaca -p 27018:27017 mongo:7.0
```

## 📚 Commandes utiles

```bash
# Shell MongoDB
docker exec -it mongodb-aaca mongosh

# Lister les bases
show dbs

# Utiliser la base
use aaca_db

# Compter les documents
db.users.countDocuments()
db.notes.countDocuments()

# Voir les utilisateurs
db.users.find().pretty()
```

## 💡 Conseils

1. **Sauvegarde** : Le volume Docker `mongodb_aaca_data` persiste les données
2. **Accès images** : Les images sont dans `backend/uploads/` et servies par FastAPI
3. **Production** : Envisager MongoDB Atlas pour le déploiement
