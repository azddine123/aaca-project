import React, { useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, router, Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { CaptureMenuModal } from '@/components/UIKit';

function CaptureTabButton() {
    const C = useAppColors();
    const [menuVisible, setMenuVisible] = useState(false);
    return (
        <>
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setMenuVisible(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une note"
            >
                <View style={styles.fabInner}>
                    <LinearGradient
                        colors={[C.primary, C.primaryDark]}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    <MaterialCommunityIcons name="camera-plus" size={26} color="#fff" />
                </View>
            </TouchableOpacity>
            <CaptureMenuModal
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                onSelectSession={() => router.push('/session-new')}
                onSelectCapture={() => router.push('/capture')}
            />
        </>
    );
}

export default function TabsLayout() {
    const { auth } = useAuth();
    const C = useAppColors();

    if (!auth.isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: C.primary,
                tabBarInactiveTintColor: C.textMuted,
                tabBarStyle: [styles.tabBar, { backgroundColor: C.surface, borderTopColor: C.border }],
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
                    title: 'Révisions',
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
        borderTopWidth: 1,
        height: 72,
        paddingBottom: 12,
        paddingTop: 8,
        shadowColor: '#14203C',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 10,
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
        width: 58,
        height: 58,
        borderRadius: 29,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#1B4FD8',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.42,
        shadowRadius: 24,
        elevation: 12,
    },
});
