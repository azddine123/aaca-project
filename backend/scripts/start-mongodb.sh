#!/bin/bash
# Script pour démarrer MongoDB avec Docker

echo "🚀 Démarrage de MongoDB pour AACA..."

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "Installez Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Arrêter le conteneur existant s'il existe
docker stop mongodb-aaca 2>/dev/null
docker rm mongodb-aaca 2>/dev/null

# Démarrer MongoDB
echo "📦 Téléchargement et démarrage de MongoDB..."
docker run -d \
    --name mongodb-aaca \
    -p 27017:27017 \
    -v mongodb_aaca_data:/data/db \
    --restart unless-stopped \
    mongo:7.0

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ MongoDB démarré avec succès!"
    echo ""
    echo "📊 Informations:"
    echo "   - Host: localhost:27017"
    echo "   - Database: aaca_db"
    echo "   - Container: mongodb-aaca"
    echo ""
    echo "📝 Commandes utiles:"
    echo "   - Voir les logs: docker logs mongodb-aaca"
    echo "   - Arrêter: docker stop mongodb-aaca"
    echo "   - Redémarrer: docker start mongodb-aaca"
    echo "   - Connexion: docker exec -it mongodb-aaca mongosh"
    echo ""
    echo "🚀 Vous pouvez maintenant démarrer le backend:"
    echo "   uvicorn app.main:app --reload"
else
    echo "❌ Erreur lors du démarrage de MongoDB"
    exit 1
fi
