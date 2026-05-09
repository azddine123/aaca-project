import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotesProvider } from '@/contexts/NotesContext';
import { StudyProvider } from '@/contexts/StudyContext';
import AppearanceProvider from '@/contexts/AppearanceContext';

export default function RootLayout() {
    return (
        <AppearanceProvider>
            <AuthProvider>
                <NotesProvider>
                    <StudyProvider>
                        <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="index" options={{ headerShown: false }} />
                            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                            <Stack.Screen
                                name="capture"
                                options={{ headerShown: false, presentation: 'modal' }}
                            />
                            <Stack.Screen
                                name="session-new"
                                options={{ headerShown: false, presentation: 'modal' }}
                            />
                            <Stack.Screen
                                name="note-detail"
                                options={{ headerShown: false }}
                            />
                        </Stack>
                    </StudyProvider>
                </NotesProvider>
            </AuthProvider>
        </AppearanceProvider>
    );
}
