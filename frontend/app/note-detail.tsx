import React, { useEffect, useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '@/contexts/NotesContext';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Tab = 'resume' | 'contenu' | 'etudier';

export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { currentNote, fetchNote, isLoading } = useNotes();
    const { setCurrentQuiz, setCurrentFlashcards } = useStudy();
    const { auth } = useAuth();
    const C = useAppColors();
    const G = useAppGradients();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [activeTab, setActiveTab] = useState<Tab>('resume');
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [loadingCards, setLoadingCards] = useState(false);

    useEffect(() => { if (id) fetchNote(id); }, [id]);

    const handleGenerateQuiz = async () => {
        if (!id || !auth.token) return;
        try {
            setLoadingQuiz(true);
            const res = await fetch(`${API_URL}/notes/${id}/quizzes`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                Alert.alert('Erreur', err.detail || 'Impossible de générer le quiz.');
                return;
            }
            const quiz = await res.json();
            if (!quiz.questions || quiz.questions.length === 0) {
                Alert.alert('Quiz vide', 'Le quiz généré ne contient aucune question.');
                return;
            }
            setCurrentQuiz(quiz);
            router.push('/(tabs)/study');
        } catch (e: any) {
            Alert.alert('Erreur réseau', e.message || 'Impossible de contacter le serveur.');
        } finally { setLoadingQuiz(false); }
    };

    const handleLoadFlashcards = async () => {
        if (!id || !auth.token) return;
        try {
            setLoadingCards(true);
            const res = await fetch(`${API_URL}/notes/${id}/flashcards`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                Alert.alert('Erreur', err.detail || 'Impossible de charger les flashcards.');
                return;
            }
            const cards = await res.json();
            if (!cards || cards.length === 0) {
                Alert.alert('Aucune flashcard', 'Aucune flashcard disponible pour cette note.');
                return;
            }
            setCurrentFlashcards(cards);
            router.push('/(tabs)/study');
        } catch (e: any) {
            Alert.alert('Erreur réseau', e.message || 'Impossible de contacter le serveur.');
        } finally { setLoadingCards(false); }
    };

    if (isLoading || !currentNote) {
        return (
            <View style={[styles.loading, { backgroundColor: C.background }]}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, marginTop: SIZES.md }}>Chargement…</Text>
            </View>
        );
    }

    const subjectColor = SUBJECT_COLORS[currentNote.subject] || C.primary;
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
            <LinearGradient colors={G.hero} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={C.textSecondary} />
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
                            style={[styles.tabBtn, active && { borderBottomWidth: 2, borderBottomColor: C.primary }]}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.75}
                        >
                            <MaterialCommunityIcons name={tab.icon as any} size={16} color={active ? C.primary : C.textMuted} />
                            <Text style={[styles.tabLabel, { color: active ? C.primary : C.textMuted }]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Content ── */}
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* RÉSUMÉ */}
                {activeTab === 'resume' && (
                    currentNote.summary ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Résumé IA</Text>
                            <Text style={styles.bodyText}>{currentNote.summary}</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyTab}>
                            <MaterialCommunityIcons name="text-box-remove-outline" size={40} color={C.textMuted} />
                            <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary }}>Aucun résumé disponible.</Text>
                        </View>
                    )
                )}

                {/* CONTENU */}
                {activeTab === 'contenu' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Texte extrait</Text>
                        <Text style={styles.monoText}>{currentNote.raw_text}</Text>
                    </View>
                )}

                {/* ÉTUDIER */}
                {activeTab === 'etudier' && (
                    <View style={styles.studyActions}>
                        <Text style={styles.sectionTitle}>Générer des exercices</Text>
                        <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, marginBottom: SIZES.lg }}>
                            L'IA va analyser ce cours et créer des exercices personnalisés.
                        </Text>

                        {[
                            { label: 'Quiz adaptatif', desc: 'Questions QCM générées depuis ce cours', icon: 'clipboard-check-outline', color: C.success, loading: loadingQuiz, onPress: handleGenerateQuiz },
                            { label: 'Flashcards',     desc: 'Révision par répétition espacée SM-2',   icon: 'cards-outline',            color: C.primary, loading: loadingCards, onPress: handleLoadFlashcards },
                        ].map((item) => (
                            <TouchableOpacity
                                key={item.label}
                                style={styles.actionCard}
                                onPress={item.onPress}
                                activeOpacity={0.85}
                                disabled={item.loading}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: item.color + '25' }]}>
                                    {item.loading
                                        ? <ActivityIndicator size="small" color={item.color} />
                                        : <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                                    }
                                </View>
                                <View style={styles.actionInfo}>
                                    <Text style={styles.actionName}>{item.label}</Text>
                                    <Text style={styles.actionDesc}>{item.desc}</Text>
                                </View>
                                <MaterialCommunityIcons name="arrow-right" size={18} color={C.textMuted} />
                            </TouchableOpacity>
                        ))}

                        <View style={styles.infoNote}>
                            <MaterialCommunityIcons name="information-outline" size={14} color={C.accent} />
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

const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SIZES.sm, paddingVertical: 5, borderRadius: SIZES.borderRadiusFull, borderWidth: 1 },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: SIZES.fontXs, fontWeight: '700' },

    titleBlock: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.lg, gap: 5 },
    noteTitle: { fontSize: SIZES.fontXXl, fontWeight: '700', color: C.textPrimary, lineHeight: 34 },
    noteDate: { fontSize: SIZES.fontXs, color: C.textMuted },

    tabBar: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SIZES.sm + 2 },
    tabLabel: { fontSize: SIZES.fontSm, fontWeight: '600' },

    scrollContent: { padding: SIZES.xl },
    section: { gap: SIZES.sm },
    sectionTitle: { fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SIZES.sm },
    bodyText: { fontSize: SIZES.fontMd, lineHeight: 25, color: C.textPrimary },
    monoText: { fontSize: SIZES.fontSm, lineHeight: 22, color: C.textSecondary, fontFamily: 'monospace' },

    studyActions: { gap: SIZES.sm },
    actionCard: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, backgroundColor: C.surface, borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },
    actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionInfo: { flex: 1 },
    actionName: { fontSize: SIZES.fontMd, fontWeight: '700', color: C.textPrimary, marginBottom: 3 },
    actionDesc: { fontSize: SIZES.fontXs, color: C.textSecondary },
    infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: SIZES.md, backgroundColor: C.accent + '12', borderRadius: SIZES.borderRadiusSm, marginTop: SIZES.sm },
    infoNoteText: { flex: 1, fontSize: SIZES.fontXs, color: C.textMuted, lineHeight: 17 },

    emptyTab: { alignItems: 'center', gap: SIZES.sm, paddingTop: SIZES.xxxl },
});
