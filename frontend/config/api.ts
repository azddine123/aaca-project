/**
 * API Configuration
 * 
 * IMPORTANT: Pour Expo Go sur téléphone physique,
 * définissez EXPO_PUBLIC_API_URL dans le fichier .env
 * avec l'IP de votre ordinateur: http://VOTRE_IP:8000/api/v1
 */

// Utilise la variable d'environnement ou localhost par défaut
const getApiUrl = (): string => {
    // @ts-ignore - expo supporte EXPO_PUBLIC_ variables
    const manualUrl = process.env.EXPO_PUBLIC_API_URL;
    
    if (manualUrl) {
        console.log('📡 Using API URL from .env:', manualUrl);
        return manualUrl;
    }
    
    console.log('📡 Using default localhost API URL');
    return 'http://localhost:8000/api/v1';
};

// Export de l'URL finale
export const API_URL = getApiUrl();

export default { API_URL };
