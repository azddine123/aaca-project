import React, { useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from './contexts/NotesContext';
import { useStudy } from './contexts/StudyContext';
import { useAuth } from './contexts/AuthContext';
import { COLORS, SIZES, FONTS, SHADOWS, SUBJECT_COLORS } from './theme';


export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { currentNote, fetchNote, isLoading } = useNotes();
    const { setCurrentQuiz, setCurrentFlashcards } = useStudy();
    const { auth } = useAuth();

    useEffect(() => {
        if (id) fetchNote(id);
    }, [id]);

    const handleGenerateQuiz = async () => {
        if (!id || !auth.token) return;
        try {
            const res = await fetch(`${API_URL}/notes/${id}/quizzes`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (res.ok) {
                const quiz = await res.json();
                setCurrentQuiz(quiz);
                router.push('/(tabs)/study');
            }
        } catch { }
    };

    const handleLoadFlashcards = async () => {
        if (!id || !auth.token) return;
        try {
            const res = await fetch(`${API_URL}/notes/${id}/flashcards`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (res.ok) {
                const cards = await res.json();
                setCurrentFlashcards(cards);
                router.push('/(tabs)/study');
            }
        } catch { }
    };

    if (isLoading || !currentNote) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    const subjectColor = SUBJECT_COLORS[currentNote.subject] || COLORS.primary;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={[styles.badge, { backgroundColor: subjectColor }]}>
                    <Text style={styles.badgeText}>{currentNote.subject?.replace('_', ' ') || 'General'}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={FONTS.h2}>{currentNote.title}</Text>

                {/* Summary */}
                {currentNote.summary && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📝 Résumé</Text>
                        <Text style={FONTS.body1}>{currentNote.summary}</Text>
                    </View>
                )}

                {/* Raw text */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📄 Contenu extrait</Text>
                    <Text style={[FONTS.body2, { lineHeight: 22 }]}>{currentNote.raw_text}</Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleGenerateQuiz}>
                        <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={COLORS.white} />
                        <Text style={styles.actionText}>Quiz</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary }]} onPress={handleLoadFlashcards}>
                        <MaterialCommunityIcons name="cards-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.actionText, { color: COLORS.primary }]}>Flashcards</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 56 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, marginBottom: SIZES.md },
    backBtn: { padding: 4 },
    badge: { paddingHorizontal: SIZES.md, paddingVertical: 4, borderRadius: 20 },
    badgeText: { color: COLORS.white, fontSize: SIZES.fontXs, fontWeight: '700', textTransform: 'uppercase' },
    content: { padding: SIZES.xl, gap: SIZES.xl },
    section: { backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.lg, gap: SIZES.sm, ...SHADOWS.sm },
    sectionTitle: { ...FONTS.body1, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
    actionsRow: { flexDirection: 'row', gap: SIZES.md },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: COLORS.primary, height: 52, borderRadius: SIZES.borderRadius, ...SHADOWS.sm },
    actionText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.fontMd },
});
