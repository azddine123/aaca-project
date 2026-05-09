import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert,
    TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '@/contexts/NotesContext';
import { useStudy } from '@/contexts/StudyContext';
import NoteContentView from '@/components/NoteContentView';
import { AacaCard, StatusBadge, SubjectBadge } from '@/components/UIKit';
import { ZelligePattern } from '@/components/ZelligePattern';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Tab = 'resume' | 'contenu' | 'etudier' | 'assistant';
interface QAMessage { role: 'user' | 'assistant'; text: string; }

const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'resume',    label: 'Résumé',    icon: 'text-box-outline' },
    { key: 'contenu',   label: 'Contenu',   icon: 'file-document-outline' },
    { key: 'etudier',   label: 'Étudier',   icon: 'school-outline' },
    { key: 'assistant', label: 'Assistant', icon: 'robot-outline' },
];

export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { currentNote, fetchNote, isLoading } = useNotes();
    const { setCurrentQuiz, setCurrentFlashcards } = useStudy();
    const { auth, authFetch } = useAuth();
    const C = useAppColors();
    const G = useAppGradients();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [activeTab, setActiveTab] = useState<Tab>('resume');
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [loadingCards, setLoadingCards] = useState(false);

    // Q&A assistant state
    const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
    const [qaInput, setQaInput] = useState('');
    const [qaLoading, setQaLoading] = useState(false);
    const qaScrollRef = useRef<ScrollView>(null);

    useEffect(() => { if (id) fetchNote(id); }, [id, fetchNote]);

    const handleAskQuestion = async () => {
        const q = qaInput.trim();
        if (!q || qaLoading || !id) return;
        setQaMessages(prev => [...prev, { role: 'user', text: q }]);
        setQaInput('');
        setQaLoading(true);
        setTimeout(() => qaScrollRef.current?.scrollToEnd({ animated: true }), 100);
        try {
            const res = await authFetch(`${API_URL}/notes/${id}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q }),
            });
            if (!res.ok) throw new Error('Erreur serveur');
            const data = await res.json();
            setQaMessages(prev => [...prev, { role: 'assistant', text: data.answer || 'Pas de réponse.' }]);
        } catch {
            setQaMessages(prev => [...prev, { role: 'assistant', text: "Impossible de répondre pour l'instant. Réessayez." }]);
        } finally {
            setQaLoading(false);
            setTimeout(() => qaScrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    const handleGenerateQuiz = async () => {
        if (!id || !auth.token) return;
        try {
            setLoadingQuiz(true);
            const res = await authFetch(`${API_URL}/notes/${id}/quizzes`, { method: 'POST' });
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
        } catch (e: unknown) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur génération quiz');
        } finally { setLoadingQuiz(false); }
    };

    const handleLoadFlashcards = async () => {
        if (!id || !auth.token) return;
        try {
            setLoadingCards(true);
            const res = await authFetch(`${API_URL}/notes/${id}/flashcards`);
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
        } catch (e: unknown) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur chargement flashcards');
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
    const concepts = currentNote.processed_content?.key_concepts?.slice(0, 5) ?? [];
    const flashcardsCount = (currentNote as any).flashcards?.length ?? (currentNote as any).flashcards_count ?? null;

    return (
        <View style={styles.container}>
            <LinearGradient colors={G.hero} style={styles.header}>
                <View style={styles.headerPattern}>
                    <ZelligePattern color={C.primary} opacity={1} tileSize={30} cols={8} rows={4} />
                </View>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={C.textSecondary} />
                </TouchableOpacity>
                <StatusBadge label="Document de cours" tone="info" icon="file-document-edit-outline" />
            </LinearGradient>

            <View style={styles.titleBlock}>
                <View style={styles.metaRow}>
                    <SubjectBadge
                        label={SUBJECT_LABELS[currentNote.subject] || currentNote.subject || 'Général'}
                        color={subjectColor}
                    />
                    {createdAt ? (
                        <View style={styles.datePill}>
                            <MaterialCommunityIcons name="calendar-outline" size={12} color={C.textMuted} />
                            <Text style={styles.noteDate}>Créé le {createdAt}</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={styles.noteTitle} numberOfLines={3}>{currentNote.title}</Text>
                <View style={styles.docStats}>
                    <View style={styles.docStat}>
                        <MaterialCommunityIcons name="text-box-outline" size={14} color={C.primary} />
                        <Text style={styles.docStatText}>Résumé</Text>
                    </View>
                    <View style={styles.docStat}>
                        <MaterialCommunityIcons name="tag-multiple-outline" size={14} color={C.accent} />
                        <Text style={styles.docStatText}>{concepts.length} concept{concepts.length > 1 ? 's' : ''}</Text>
                    </View>
                    {flashcardsCount != null ? (
                        <View style={styles.docStat}>
                            <MaterialCommunityIcons name="cards-outline" size={14} color={C.success} />
                            <Text style={styles.docStatText}>{flashcardsCount} carte{flashcardsCount > 1 ? 's' : ''}</Text>
                        </View>
                    ) : null}
                </View>
            </View>

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
                                size={15}
                                color={active ? C.primary : C.textMuted}
                            />
                            <Text style={[styles.tabLabel, { color: active ? C.primary : C.textMuted }]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Content ── */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    ref={activeTab === 'assistant' ? qaScrollRef : undefined}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* RÉSUMÉ */}
                    {activeTab === 'resume' && (
                        currentNote.summary ? (
                            <View style={styles.section}>
                                <View style={styles.sectionTitleRow}>
                                    <MaterialCommunityIcons name="auto-fix" size={14} color={C.primary} />
                                    <Text style={styles.sectionTitle}>Résumé IA</Text>
                                </View>
                                <AacaCard style={styles.summaryCard}>
                                    <Text style={styles.bodyText}>{currentNote.summary}</Text>
                                </AacaCard>
                                {concepts.length > 0 ? (
                                    <View style={styles.conceptsBlock}>
                                        <View style={styles.sectionTitleRow}>
                                            <MaterialCommunityIcons name="tag-multiple-outline" size={14} color={C.accent} />
                                            <Text style={styles.sectionTitle}>Concepts clés</Text>
                                        </View>
                                        <View style={styles.conceptsRow}>
                                            {concepts.map((concept) => (
                                                <View key={concept} style={[styles.conceptChip, { backgroundColor: subjectColor + '12', borderColor: subjectColor + '30' }]}>
                                                    <Text style={[styles.conceptText, { color: subjectColor }]}>{concept}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        ) : (
                            <View style={styles.emptyTab}>
                                <MaterialCommunityIcons name="text-box-remove-outline" size={40} color={C.textMuted} />
                                <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, textAlign: 'center' }}>
                                    Aucun résumé disponible.
                                </Text>
                            </View>
                        )
                    )}

                    {/* CONTENU */}
                    {activeTab === 'contenu' && (
                        <NoteContentView
                            raw_text={currentNote.raw_text}
                            processed_content={(currentNote as any).processed_content}
                            latex_formulas={(currentNote as any).latex_formulas}
                            C={C}
                        />
                    )}

                    {/* ÉTUDIER */}
                    {activeTab === 'etudier' && (
                        <View style={styles.studyActions}>
                            <View style={styles.sectionTitleRow}>
                                <MaterialCommunityIcons name="school-outline" size={14} color={C.primary} />
                                <Text style={styles.sectionTitle}>Générer des exercices</Text>
                            </View>
                            <Text style={styles.studyHint}>{"L'IA va analyser ce cours et créer des exercices personnalisés."}</Text>

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
                                    <View style={[styles.actionIcon, { backgroundColor: item.color + '20' }]}>
                                        {item.loading
                                            ? <ActivityIndicator size="small" color={item.color} />
                                            : <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                                        }
                                    </View>
                                    <View style={styles.actionInfo}>
                                        <Text style={styles.actionName}>{item.label}</Text>
                                        <Text style={styles.actionDesc}>{item.desc}</Text>
                                    </View>
                                    <View style={[styles.actionArrow, { backgroundColor: item.color + '18' }]}>
                                        <MaterialCommunityIcons name="arrow-right" size={16} color={item.color} />
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <View style={[styles.infoNote, { backgroundColor: C.accent + '12', borderColor: C.accent + '30' }]}>
                                <MaterialCommunityIcons name="information-outline" size={14} color={C.accent} />
                                <Text style={[styles.infoNoteText, { color: C.textSecondary }]}>
                                    La génération peut prendre quelques secondes selon la longueur du cours.
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* ASSISTANT */}
                    {activeTab === 'assistant' && (
                        <View style={{ gap: SIZES.sm, flex: 1 }}>
                            {qaMessages.length === 0 && (
                                <View style={styles.emptyTab}>
                                    <View style={[styles.assistantEmptyIcon, { backgroundColor: C.primary + '18' }]}>
                                        <MaterialCommunityIcons name="robot-outline" size={28} color={C.primary} />
                                    </View>
                                    <Text style={[styles.assistantEmptyTitle, { color: C.textSecondary }]}>
                                        Posez une question sur ce cours
                                    </Text>
                                    <Text style={[styles.assistantEmptySub, { color: C.textMuted }]}>
                                        {"L'assistant répond en se basant sur le contenu de la note."}
                                    </Text>
                                </View>
                            )}
                            {qaMessages.map((msg, i) => (
                                <View key={i} style={[
                                    styles.qaMsg,
                                    msg.role === 'user'
                                        ? { backgroundColor: C.primary + '18', borderColor: C.primary + '30', alignSelf: 'flex-end' }
                                        : { backgroundColor: C.surface, borderColor: C.border, alignSelf: 'flex-start' },
                                ]}>
                                    {msg.role === 'assistant' && (
                                        <View style={styles.assistantHeader}>
                                            <MaterialCommunityIcons name="robot-outline" size={12} color={C.primary} />
                                            <Text style={[styles.assistantTag, { color: C.primary }]}>Assistant</Text>
                                        </View>
                                    )}
                                    <Text style={{ fontSize: SIZES.fontSm, color: C.textPrimary, lineHeight: 20 }}>{msg.text}</Text>
                                </View>
                            ))}
                            {qaLoading && (
                                <View style={[styles.qaMsg, { backgroundColor: C.surface, borderColor: C.border, alignSelf: 'flex-start', flexDirection: 'row', gap: SIZES.sm }]}>
                                    <ActivityIndicator size="small" color={C.primary} />
                                    <Text style={{ color: C.textMuted, fontSize: SIZES.fontXs }}>{"L'assistant réfléchit..."}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={{ height: 48 }} />
                </ScrollView>

                {/* Q&A Input bar */}
                {activeTab === 'assistant' && (
                    <View style={[styles.qaBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
                        <TextInput
                            style={[styles.qaInput, { backgroundColor: C.surfaceMid, borderColor: C.border, color: C.textPrimary }]}
                            value={qaInput}
                            onChangeText={setQaInput}
                            placeholder="Posez une question…"
                            placeholderTextColor={C.textMuted}
                            returnKeyType="send"
                            onSubmitEditing={handleAskQuestion}
                            editable={!qaLoading}
                        />
                        <TouchableOpacity
                            style={[styles.qaSend, { backgroundColor: qaInput.trim() && !qaLoading ? C.primary : C.border }]}
                            onPress={handleAskQuestion}
                            disabled={!qaInput.trim() || qaLoading}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="send" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </View>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    loading:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md,
        overflow: 'hidden',
    },
    headerPattern: { position: 'absolute', right: -26, top: 18, width: 230, height: 120, opacity: 0.08 },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: C.border,
    },
    titleBlock: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.lg, gap: SIZES.sm },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' },
    noteTitle:  { fontSize: SIZES.fontXXl, fontWeight: '800', color: C.textPrimary, lineHeight: 34, letterSpacing: 0 },
    datePill:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: C.surfaceMid },
    noteDate:   { fontSize: SIZES.fontXs, color: C.textMuted, fontWeight: '700' },
    docStats: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs },
    docStat: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: SIZES.borderRadiusFull, paddingHorizontal: SIZES.sm, paddingVertical: 5 },
    docStatText: { fontSize: SIZES.fontXs, color: C.textSecondary, fontWeight: '700' },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
        padding: 5,
        gap: 4,
    },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: SIZES.sm, borderRadius: SIZES.borderRadius },
    tabBtnActive: { backgroundColor: C.primary + '12' },
    tabLabel: { fontSize: 11, fontWeight: '600' },

    // Content
    scrollContent: { padding: SIZES.xl },

    section: { gap: SIZES.sm },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SIZES.xs },
    sectionTitle: { fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0 },

    summaryCard: { gap: SIZES.sm },
    bodyText: { fontSize: SIZES.fontMd, lineHeight: 26, color: C.textPrimary },
    conceptsBlock: { gap: SIZES.sm, marginTop: SIZES.lg },
    conceptsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs },
    conceptChip: { borderRadius: SIZES.borderRadiusFull, borderWidth: 1, paddingHorizontal: SIZES.sm, paddingVertical: 5 },
    conceptText: { fontSize: SIZES.fontXs, fontWeight: '800' },

    studyActions: { gap: SIZES.sm },
    studyHint:    { fontSize: SIZES.fontSm, color: C.textSecondary, marginBottom: SIZES.sm },

    actionCard: {
        flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
        backgroundColor: C.surface, borderRadius: SIZES.borderRadius,
        padding: SIZES.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm,
    },
    actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionInfo: { flex: 1 },
    actionName: { fontSize: SIZES.fontMd, fontWeight: '700', color: C.textPrimary, marginBottom: 3 },
    actionDesc: { fontSize: SIZES.fontXs, color: C.textSecondary },
    actionArrow:{ width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: SIZES.md, borderRadius: SIZES.borderRadiusSm, marginTop: SIZES.sm, borderWidth: 1 },
    infoNoteText: { flex: 1, fontSize: SIZES.fontXs, lineHeight: 17 },

    emptyTab: { alignItems: 'center', gap: SIZES.sm, paddingTop: SIZES.xxxl },
    assistantEmptyIcon: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.xs },
    assistantEmptyTitle: { fontSize: SIZES.fontMd, fontWeight: '600', textAlign: 'center' },
    assistantEmptySub: { fontSize: SIZES.fontSm, textAlign: 'center', lineHeight: 20 },

    qaMsg: { maxWidth: '88%', borderRadius: 14, borderWidth: 1, padding: SIZES.sm + 2 },
    assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    assistantTag: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0 },

    qaBar: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, padding: SIZES.sm, borderTopWidth: 1 },
    qaInput: { flex: 1, borderWidth: 1, borderRadius: SIZES.borderRadiusFull, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.fontSm },
    qaSend: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
});
