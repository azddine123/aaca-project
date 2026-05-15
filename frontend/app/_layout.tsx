import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotesProvider } from '@/contexts/NotesContext';
import { StudyProvider } from '@/contexts/StudyContext';
import { SubjectsProvider } from '@/contexts/SubjectsContext';
import AppearanceProvider from '@/contexts/AppearanceContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AppearanceProvider>
                <AuthProvider>
                    <NotesProvider>
                        <SubjectsProvider>
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
                        </SubjectsProvider>
                    </NotesProvider>
                </AuthProvider>
            </AppearanceProvider>
        </SafeAreaProvider>
    );
}
