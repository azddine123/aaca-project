import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Redirect } from 'expo-router';
import { COLORS } from '../theme';

export default function TabsLayout() {
    const colorScheme = useColorScheme();
    const { auth } = useAuth();

    if (!auth.isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textSecondary,
                tabBarStyle: {
                    backgroundColor: colorScheme === 'dark' ? COLORS.surface : '#FFFFFF',
                    borderTopColor: COLORS.border,
                    borderTopWidth: 1,
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Accueil',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: 'Notes',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="notebook-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="study"
                options={{
                    title: 'Étude',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="brain" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profil',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-circle-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
