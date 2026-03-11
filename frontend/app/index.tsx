import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/theme';

export default function Index() {
    const { auth } = useAuth();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!auth.loading) setReady(true);
    }, [auth.loading]);

    if (!ready) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (auth.isAuthenticated) {
        return <Redirect href="/(tabs)/home" />;
    }

    return <Redirect href="/(auth)/login" />;
}
