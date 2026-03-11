import React from 'react';
import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, router, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, SIZES, SHADOWS } from '@/theme';

function CaptureTabButton() {
    return (
        <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push('/capture')}
            activeOpacity={0.85}
        >
            <View style={styles.fabInner}>
                <MaterialCommunityIcons name="camera-plus" size={26} color={COLORS.white} />
            </View>
        </TouchableOpacity>
    );
}

export default function TabsLayout() {
    const { auth } = useAuth();

    if (!auth.isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabLabel,
                tabBarItemStyle: styles.tabItem,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Accueil',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? 'home' : 'home-outline'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: 'Notes',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? 'notebook' : 'notebook-outline'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="snap"
                options={{
                    title: '',
                    tabBarButton: () => <CaptureTabButton />,
                }}
            />
            <Tabs.Screen
                name="study"
                options={{
                    title: 'Étude',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? 'brain' : 'brain'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profil',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? 'account-circle' : 'account-circle-outline'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: COLORS.surface,
        borderTopColor: COLORS.border,
        borderTopWidth: 1,
        height: 72,
        paddingBottom: 12,
        paddingTop: 8,
        ...SHADOWS.md,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    tabItem: {
        flex: 1,
    },
    fab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -20,
    },
    fabInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: COLORS.surface,
        ...SHADOWS.primary,
    },
});
