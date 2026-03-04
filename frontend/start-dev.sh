#!/bin/bash
# Script de lancement pour le développement mobile

echo "🚀 AACA Mobile - Development Server"
echo "======================================"

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "📡 Local IP: $LOCAL_IP"

# Update config with current IP
sed -i "s|http://[^:]*:8000|http://$LOCAL_IP:8000|g" src/constants/config.ts
echo "✅ Updated API_BASE_URL to http://$LOCAL_IP:8000/api/v1"

echo ""
echo "📱 Options de lancement :"
echo "1) --tunnel (RECOMMENDED - pour test sur téléphone)"
echo "2) --lan (pour test sur le même réseau local)"
echo "3) --localhost (pour simulateur uniquement)"
echo ""
read -p "Choisissez une option (1/2/3) [1]: " choice

choice=${choice:-1}

case $choice in
  1)
    echo "🌐 Démarrage avec TUNNEL (ngrok)..."
    echo "   Cette option permet de tester sur n'importe quel téléphone"
    npx expo start --tunnel --clear
    ;;
  2)
    echo "🏠 Démarrage en mode LAN..."
    echo "   Votre téléphone doit être sur le même WiFi"
    npx expo start --lan --clear
    ;;
  3)
    echo "💻 Démarrage en mode LOCALHOST..."
    echo "   Pour simulateur uniquement"
    npx expo start --clear
    ;;
  *)
    echo "Option invalide, utilisation du mode tunnel..."
    npx expo start --tunnel --clear
    ;;
esac
