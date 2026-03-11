// Placeholder for the central capture FAB in the tab bar.
// Navigation is handled by the custom tabBarButton in _layout.tsx;
// this file exists only to satisfy Expo Router's file-based routing.
import { useEffect } from 'react';
import { router } from 'expo-router';

export default function SnapPlaceholder() {
    useEffect(() => {
        router.replace('/capture');
    }, []);
    return null;
}
