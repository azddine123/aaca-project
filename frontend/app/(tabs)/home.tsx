import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useStudy } from '@/contexts/StudyContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { ZelligePattern } from '@/components/ZelligePattern';
import {
    AacaButton,
    AacaCard,
    EmptyState,
    ProgressBar,
    SessionCard,
    StatTile,
    StatusBadge,
    SubjectBadge,
} from '@/components/UIKit';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
import { AppLogo } from '@/components/AppLogo';

interface Stats {
    total_notes: number;
    total_flashcards: number;
    flashcards_due_count: number;
    average_score: number;
    study_streak: number;
    subject_distribution: Record<string, number>;
}

const SUBJECT_ICONS: Record<string, string> = {
    mathematics: 'function-variant',
    physics: 'atom',
    chemistry: 'flask-outline',
    biology: 'leaf-outline',
    cs: 'code-braces',
    computer_science: 'code-braces',
    engineering: 'cog-outline',
    economics: 'chart-areaspline',
    literature: 'book-open-outline',
    history: 'castle',
    philosophy: 'lightbulb-outline',
    french: 'alphabetical-variant',
    arabic: 'abjad-arabic',
    geography: 'map-outline',
};

function getSubjectIcon(subject: string): string {
    return SUBJECT_ICONS[subject] || 'file-document-outline';
}

function formatDate(d: string | undefined): string {
    if (!d) return '';
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
    catch { return ''; }
}

function cleanNotePreview(text: string): string {
    if (!text) return '';
    return text
        .replace(/```[\w]*\n?/g, '')
        .replace(/`{1,3}/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
        .replace(/\n{2,}/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function isArabic(text: string): boolean {
    return /[؀-ۿݐ-ݿ]/.test(text);
}

function NoteCardSkeleton({ C }: { C: ReturnType<typeof useAppColors> }) {
    return (
        <View style={[skel.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[skel.icon, { backgroundColor: C.surfaceMid }]} />
            <View style={skel.body}>
                <View style={[skel.pill, { width: 60, backgroundColor: C.surfaceMid }]} />
                <View style={[skel.line, { width: '78%', backgroundColor: C.surfaceMid }]} />
                <View style={[skel.line, { width: '52%', backgroundColor: C.surfaceMid }]} />
            </View>
        </View>
    );
}
const skel = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, borderWidth: 1, padding: 14 },
    icon: { width: 40, height: 40, borderRadius: 8, flexShrink: 0 },
    body: { flex: 1, gap: 8 },
    pill: { height: 14, borderRadius: 20 },
    line: { height: 10, borderRadius: 5 },
});

export default function HomeScreen() {
    const { auth, authFetch } = useAuth();
    const { notes, fetchNotes, isLoading } = useNotes();
    const { setCurrentFlashcards } = useStudy();
    const C = useAppColors();
    const G = useAppGradients();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [stats, setStats] = useState<Stats | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/stats`);
            if (res.ok) setStats(await res.json());
        } catch { /* silent */ }
    }, [authFetch]);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const handleRefresh = useCallback(async () => {
        await Promise.all([fetchNotes(), fetchStats()]);
    }, [fetchNotes, fetchStats]);

    const startDueFlashcards = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/flashcards/due?limit=50`);
            if (!res.ok) return;
            const cards: any[] = await res.json();
            if (cards.length === 0) {
                Alert.alert('Révision terminée', 'Aucune carte à réviser aujourd\'hui.');
                return;
            }
            setCurrentFlashcards(cards);
            router.push('/(tabs)/study');
        } catch { /* silent - offline */ }
    }, [authFetch, setCurrentFlashcards]);

    const firstName = (auth.userName || 'Étudiant').split(' ')[0];
    const initials = (auth.userName || 'YE')
        .split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase();
    const recentNotes = notes.slice(0, 4);
    const dueCount = stats?.flashcards_due_count ?? 0;
    const totalCards = stats?.total_flashcards ?? 0;
    const reviewedCards = Math.max(0, totalCards - dueCount);
    const reviewProgress = totalCards > 0 ? reviewedCards / totalCards : 0;
    const subjectEntries = stats?.subject_distribution
        ? Object.entries(stats.subject_distribution).sort(([, a], [, b]) => b - a)
        : [];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={C.primary} colors={[C.primary]} />
            }
        >
            <View style={styles.header}>
                <View style={styles.headerCopy}>
                    <AppLogo width={140} height={46} />
                    <Text style={styles.greeting}>Bonjour, {firstName}</Text>
                </View>
                <TouchableOpacity
                    style={styles.avatarWrap}
                    onPress={() => router.push('/(tabs)/profile')}
                    activeOpacity={0.85}
                >
                    <LinearGradient colors={G.primary} style={StyleSheet.absoluteFillObject} />
                    <Text style={styles.avatarText}>{initials}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.hPad}>
                <View style={[styles.heroCard, { borderColor: C.border }]}>
                    <LinearGradient colors={G.hero} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.heroPattern}>
                        <ZelligePattern color={C.primary} opacity={1} tileSize={30} cols={9} rows={6} />
                    </View>
                    <View style={styles.heroTop}>
                        <StatusBadge label="Notebook IA" tone="info" icon="notebook-heart-outline" />
                        <Text style={styles.heroMeta}>{stats?.study_streak ?? 0} jour{(stats?.study_streak ?? 0) > 1 ? 's' : ''} de série</Text>
                    </View>
                    <Text style={styles.heroTitle}>Nouvelle séance</Text>
                    <Text style={styles.heroText}>
                        {"Capturez plusieurs pages d'un même cours, corrigez l'OCR puis transformez-les en note structurée."}
                    </Text>
                    <View style={styles.heroActions}>
                        <AacaButton
                            label="Nouvelle séance"
                            icon="book-plus-multiple-outline"
                            onPress={() => router.push('/session-new')}
                            full
                        />
                        <AacaButton
                            label="Capture"
                            icon="camera-outline"
                            variant="secondary"
                            onPress={() => router.push('/capture')}
                            style={styles.captureAction}
                        />
                    </View>
                </View>
            </View>

            <View style={styles.statsRow}>
                <StatTile icon="notebook-outline" value={stats?.total_notes ?? notes.length} label="Notes" color={C.primary} />
                <StatTile icon="cards-outline" value={totalCards || '—'} label="Flashcards" color={C.accent} />
                <StatTile icon="chart-line" value={stats ? `${stats.average_score}%` : '—'} label="Score moyen" color={C.success} />
            </View>

            <View style={styles.hPad}>
                <AacaCard style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                        <View style={[styles.reviewIcon, { backgroundColor: C.accent + '14' }]}>
                            <MaterialCommunityIcons name="calendar-check-outline" size={22} color={C.accent} />
                        </View>
                        <View style={styles.reviewCopy}>
                            <Text style={styles.reviewTitle}>Révisions du jour</Text>
                            <Text style={styles.reviewSub}>
                                {dueCount > 0
                                    ? `${dueCount} carte${dueCount > 1 ? 's' : ''} à revoir maintenant`
                                    : 'Aucune carte en retard pour aujourd\'hui'}
                            </Text>
                        </View>
                        <AacaButton
                            label={dueCount > 0 ? 'Étudier' : 'Voir'}
                            icon="play-circle-outline"
                            size="sm"
                            onPress={dueCount > 0 ? startDueFlashcards : () => router.push('/(tabs)/study')}
                        />
                    </View>
                    <View style={styles.progressLine}>
                        <ProgressBar value={reviewProgress} color={C.accent} />
                        <Text style={styles.progressText}>{reviewedCards}/{totalCards || 0} revues</Text>
                    </View>
                </AacaCard>
            </View>

            {subjectEntries.length > 0 ? (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Matières actives</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.subjectRow}
                    >
                        {subjectEntries.map(([subject, count]) => {
                            const color = SUBJECT_COLORS[subject] || C.primary;
                            return (
                                <View key={subject} style={[styles.subjectChip, { borderColor: color + '28' }]}>
                                    <MaterialCommunityIcons name={getSubjectIcon(subject) as any} size={15} color={color} />
                                    <SubjectBadge label={SUBJECT_LABELS[subject] || subject} color={color} />
                                    <Text style={[styles.subjectCount, { color }]}>{count as number}</Text>
                                </View>
                            );
                        })}
                    </ScrollView>
                </>
            ) : null}

            <View style={styles.hPad16}>
                <SessionCard
                    title="Séance multi-images"
                    subtitle="Idéal pour un chapitre complet, un tableau ou des pages successives."
                    meta="Timeline OCR + correction"
                    onPress={() => router.push('/session-new')}
                />
            </View>

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Dernières notes</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/notes')} style={styles.sectionAction} activeOpacity={0.7}>
                    <Text style={styles.sectionActionText}>Voir tout</Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={C.primary} />
                </TouchableOpacity>
            </View>

            {isLoading && notes.length === 0 ? (
                <View style={styles.notesWrap}>
                    {[0, 1, 3].map(i => <NoteCardSkeleton key={i} C={C} />)}
                </View>
            ) : recentNotes.length === 0 ? (
                <EmptyState
                    icon="notebook-plus-outline"
                    title="Aucune note pour l'instant"
                    subtitle="Démarrez une séance ou capturez une page de cours."
                    actionLabel="Nouvelle séance"
                    onAction={() => router.push('/session-new')}
                />
            ) : (
                <View style={styles.notesWrap}>
                    {recentNotes.map((note: any) => {
                        const color = SUBJECT_COLORS[note.subject] || C.primary;
                        const icon = getSubjectIcon(note.subject);
                        const cardCount = note.flashcards?.length ?? note.flashcards_count;
                        const rawPreview = note.preview || note.summary || note.raw_text || '';
                        const preview = cleanNotePreview(rawPreview);
                        const titleIsArabic = isArabic(note.title || '');
                        const previewIsArabic = isArabic(preview);
                        const hasAiSummary = !!note.summary;
                        return (
                            <TouchableOpacity
                                key={note.id}
                                onPress={() => router.push({ pathname: '/note-detail', params: { id: note.id } })}
                                activeOpacity={0.82}
                            >
                                <AacaCard accentColor={color} style={styles.noteCard}>
                                    <View style={[styles.noteIcon, { backgroundColor: color + '18' }]}>
                                        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                                    </View>
                                    <View style={styles.noteBody}>
                                        <View style={styles.noteTopRow}>
                                            <SubjectBadge label={SUBJECT_LABELS[note.subject] || 'Autre'} color={color} />
                                            {hasAiSummary && (
                                                <View style={[styles.aiBadge, { backgroundColor: C.primary + '14', borderColor: C.primary + '30' }]}>
                                                    <MaterialCommunityIcons name="creation" size={9} color={C.primary} />
                                                    <Text style={[styles.aiBadgeText, { color: C.primary }]}>IA</Text>
                                                </View>
                                            )}
                                            <Text style={styles.noteTime}>{formatDate(note.created_at)}</Text>
                                        </View>
                                        <Text
                                            style={[styles.noteTitle, titleIsArabic && styles.rtl]}
                                            numberOfLines={2}
                                        >
                                            {note.title}
                                        </Text>
                                        {preview ? (
                                            <Text
                                                style={[styles.notePreview, previewIsArabic && styles.rtl]}
                                                numberOfLines={2}
                                            >
                                                {preview}
                                            </Text>
                                        ) : (
                                            <Text style={[styles.notePreview, styles.notePlaceholder]}>
                                                Aucun aperçu disponible
                                            </Text>
                                        )}
                                        {cardCount != null && (
                                            <View style={styles.noteMeta}>
                                                <MaterialCommunityIcons name="cards-outline" size={11} color={C.textMuted} />
                                                <Text style={styles.noteMetaText}>
                                                    {cardCount} carte{Number(cardCount) > 1 ? 's' : ''}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={17} color={C.textMuted} />
                                </AacaCard>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            <View style={{ height: 24 }} />
        </ScrollView>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingBottom: 32 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SIZES.xl,
        paddingTop: 56,
        paddingBottom: SIZES.md,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    greeting: { fontSize: SIZES.fontSm, color: C.textSecondary, fontWeight: '600', marginTop: 4 },
    avatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.primary,
    },
    avatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },

    hPad: { paddingHorizontal: SIZES.md },
    hPad16: { paddingHorizontal: SIZES.md, paddingTop: SIZES.lg },

    heroCard: {
        borderRadius: SIZES.borderRadius,
        overflow: 'hidden',
        padding: SIZES.lg,
        borderWidth: 1,
        ...SHADOWS.sm,
    },
    heroPattern: {
        position: 'absolute',
        right: -36,
        top: -22,
        width: 250,
        height: 190,
        opacity: 0.08,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.sm },
    heroMeta: { fontSize: SIZES.fontXs, color: C.textMuted, fontWeight: '700' },
    heroTitle: { fontSize: 29, lineHeight: 35, fontWeight: '900', color: C.textPrimary, marginTop: SIZES.lg, letterSpacing: 0 },
    heroText: { fontSize: SIZES.fontSm, lineHeight: 21, color: C.textSecondary, marginTop: SIZES.xs },
    heroActions: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.lg },
    captureAction: { minWidth: 112 },

    statsRow: { flexDirection: 'row', paddingHorizontal: SIZES.md, paddingTop: SIZES.md, gap: SIZES.sm },

    reviewCard: { marginTop: SIZES.lg, gap: SIZES.md },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    reviewIcon: { width: 44, height: 44, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center' },
    reviewCopy: { flex: 1, minWidth: 0 },
    reviewTitle: { fontSize: SIZES.fontMd, fontWeight: '800', color: C.textPrimary },
    reviewSub: { fontSize: SIZES.fontXs, color: C.textSecondary, marginTop: 2 },
    progressLine: { gap: 6 },
    progressText: { alignSelf: 'flex-end', fontSize: SIZES.fontXs, color: C.textMuted, fontWeight: '700' },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SIZES.xl,
        paddingTop: SIZES.lg,
        paddingBottom: SIZES.sm,
    },
    sectionTitle: { fontSize: SIZES.fontLg, fontWeight: '800', color: C.textPrimary, letterSpacing: 0 },
    sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    sectionActionText: { fontSize: SIZES.fontXs, fontWeight: '700', color: C.primary },

    subjectRow: { paddingHorizontal: SIZES.md, gap: SIZES.xs, paddingBottom: SIZES.xs },
    subjectChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderRadius: SIZES.borderRadius,
        paddingHorizontal: SIZES.sm,
        paddingVertical: 7,
    },
    subjectCount: { fontSize: SIZES.fontXs, fontWeight: '800' },

    notesWrap: { paddingHorizontal: SIZES.md, gap: SIZES.sm },
    noteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SIZES.sm,
        paddingLeft: SIZES.md,
        paddingVertical: 12,
    },
    noteIcon: {
        width: 40,
        height: 40,
        borderRadius: SIZES.borderRadius,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    noteBody: { flex: 1, minWidth: 0, gap: 3 },
    noteTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    noteTitle: { fontSize: SIZES.fontMd, fontWeight: '800', color: C.textPrimary, lineHeight: 20 },
    notePreview: { fontSize: SIZES.fontXs, color: C.textSecondary, lineHeight: 16 },
    notePlaceholder: { fontStyle: 'italic', color: C.textMuted },
    noteTime: { fontSize: 10, color: C.textMuted, fontWeight: '600', marginLeft: 'auto' },
    noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
    noteMetaText: { fontSize: 10, color: C.textMuted, fontWeight: '600' },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        borderRadius: SIZES.borderRadiusFull,
        borderWidth: 1,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    aiBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
    rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
