import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '@/contexts/NotesContext';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/api';
import { COLORS, SIZES, FONTS, SHADOWS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Tab = 'resume' | 'contenu' | 'etudier';

export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { currentNote, fetchNote, isLoading } = useNotes();
    const { setCurrentQuiz, setCurrentFlashcards } = useStudy();
    const { auth } = useAuth();

    const [activeTab, setActiveTab] = useState<Tab>('resume');
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [loadingCards, setLoadingCards] = useState(false);

    useEffect(() => {
        if (id) fetchNote(id);
    }, [id]);

    const handleGenerateQuiz = async () => {
        if (!id || !auth.token) return;
        try {
            setLoadingQuiz(true);
            const res = await fetch(`${API_URL}/notes/${id}/quizzes`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (res.ok) {
                const quiz = await res.json();
                setCurrentQuiz(quiz);
                router.push('/(tabs)/study');
            }
        } catch { } finally {
            setLoadingQuiz(false);
        }
    };

    const handleLoadFlashcards = async () => {
        if (!id || !auth.token) return;
        try {
            setLoadingCards(true);
            const res = await fetch(`${API_URL}/notes/${id}/flashcards`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (res.ok) {
                const cards = await res.json();
                setCurrentFlashcards(cards);
                router.push('/(tabs)/study');
            }
        } catch { } finally {
            setLoadingCards(false);
        }
    };

    if (isLoading || !currentNote) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={[FONTS.body2, { marginTop: SIZES.md }]}>Chargement…</Text>
            </View>
        );
    }

    const subjectColor = SUBJECT_COLORS[currentNote.subject] || COLORS.primary;
    const createdAt = currentNote.created_at
        ? format(new Date(currentNote.created_at), 'dd MMM yyyy', { locale: fr })
        : '';

    const TABS: { key: Tab; label: string; icon: string }[] = [
        { key: 'resume',  label: 'Résumé',  icon: 'text-box-outline' },
        { key: 'contenu', label: 'Contenu', icon: 'file-document-outline' },
        { key: 'etudier', label: 'Étudier', icon: 'school-outline' },
    ];

    return (
        <View style={styles.container}>
            {/* ── Header ── */}
            <LinearGradient colors={['#0D1226', '#07091A']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <View style={[styles.badge, { backgroundColor: subjectColor + '25', borderColor: subjectColor + '60' }]}>
                    <View style={[styles.badgeDot, { backgroundColor: subjectColor }]} />
                    <Text style={[styles.badgeText, { color: subjectColor }]}>
                        {SUBJECT_LABELS[currentNote.subject] || currentNote.subject || 'Général'}
                    </Text>
                </View>
            </LinearGradient>

            {/* ── Title block ── */}
            <View style={styles.titleBlock}>
                <Text style={styles.noteTitle} numberOfLines={3}>{currentNote.title}</Text>
                {createdAt ? <Text style={styles.noteDate}>Créé le {createdAt}</Text> : null}
            </View>

            {/* ── Tab bar ── */}
            <View style={styles.tabBar}>
                {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabBtn, active && styles.tabBtnActive]}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.75}
                        >
                            <MaterialCommunityIcons
                                name={tab.icon as any}
                                size={16}
                                color={active ? COLORS.primary : COLORS.textMuted}
                            />
                            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Content ── */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* RÉSUMÉ */}
                {activeTab === 'resume' && (
                    <>
                        {currentNote.summary ? (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Résumé IA</Text>
                                <Text style={styles.bodyText}>{currentNote.summary}</Text>
                            </View>
                        ) : (
                            <View style={styles.emptyTab}>
                                <MaterialCommunityIcons name="text-box-remove-outline" size={40} color={COLORS.textMuted} />
                                <Text style={FONTS.body2}>Aucun résumé disponible.</Text>
                            </View>
                        )}
                    </>
                )}

                {/* CONTENU */}
                {activeTab === 'contenu' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Texte extrait</Text>
                        <Text style={[styles.bodyText, styles.monoText]}>{currentNote.raw_text}</Text>
                    </View>
                )}

                {/* ÉTUDIER */}
                {activeTab === 'etudier' && (
                    <View style={styles.studyActions}>
                        <Text style={styles.sectionTitle}>Générer des exercices</Text>
                        <Text style={[FONTS.body2, { marginBottom: SIZES.lg }]}>
                            L'IA va analyser ce cours et créer des exercices personnalisés.
                        </Text>

                        {/* Quiz card */}
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={handleGenerateQuiz}
                            activeOpacity={0.85}
                            disabled={loadingQuiz}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '25' }]}>
                                {loadingQuiz
                                    ? <ActivityIndicator size="small" color={COLORS.success} />
                                    : <MaterialCommunityIcons name="clipboard-check-outline" size={24} color={COLORS.success} />
                                }
                            </View>
                            <View style={styles.actionInfo}>
                                <Text style={styles.actionName}>Quiz adaptatif</Text>
                                <Text style={styles.actionDesc}>Questions QCM générées depuis ce cours</Text>
                            </View>
                            <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>

                        {/* Flashcard card */}
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={handleLoadFlashcards}
                            activeOpacity={0.85}
                            disabled={loadingCards}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + '25' }]}>
                                {loadingCards
                                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                                    : <MaterialCommunityIcons name="cards-outline" size={24} color={COLORS.primary} />
                                }
                            </View>
                            <View style={styles.actionInfo}>
                                <Text style={styles.actionName}>Flashcards</Text>
                                <Text style={styles.actionDesc}>Révision par répétition espacée SM-2</Text>
                            </View>
                            <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.infoNote}>
                            <MaterialCommunityIcons name="information-outline" size={14} color={COLORS.accent} />
                            <Text style={styles.infoNoteText}>
                                La génération peut prendre quelques secondes selon la longueur du cours.
                            </Text>
                        </View>
                    </View>
                )}
                <View style={{ height: 48 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, gap: SIZES.sm },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SIZES.sm, paddingVertical: 5, borderRadius: SIZES.borderRadiusFull, borderWidth: 1 },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: SIZES.fontXs, fontWeight: '700' },

    // Title
    titleBlock: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.lg, gap: 5 },
    noteTitle: { ...FONTS.h2, lineHeight: 34 },
    noteDate: { ...FONTS.caption },

    // Tab bar
    tabBar: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SIZES.sm + 2 },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
    tabLabel: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textMuted },
    tabLabelActive: { color: COLORS.primary },

    // Scroll content
    scrollContent: { padding: SIZES.xl },

    // Section
    section: { gap: SIZES.sm },
    sectionTitle: { ...FONTS.label, marginBottom: SIZES.sm },
    bodyText: { ...FONTS.body1, lineHeight: 25, color: COLORS.textPrimary },
    monoText: { fontSize: SIZES.fontSm, lineHeight: 22, color: COLORS.textSecondary, fontFamily: 'monospace' },

    // Study tab
    studyActions: { gap: SIZES.sm },
    actionCard: {
        flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
        backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius,
        padding: SIZES.md, borderWidth: 1, borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionInfo: { flex: 1 },
    actionName: { fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
    actionDesc: { fontSize: SIZES.fontXs, color: COLORS.textSecondary },
    infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: SIZES.md, backgroundColor: COLORS.accent + '12', borderRadius: SIZES.borderRadiusSm, marginTop: SIZES.sm },
    infoNoteText: { flex: 1, fontSize: SIZES.fontXs, color: COLORS.textMuted, lineHeight: 17 },

    // Empty
    emptyTab: { alignItems: 'center', gap: SIZES.sm, paddingTop: SIZES.xxxl },
});
