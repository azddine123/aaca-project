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
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';

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
    physics:     'atom',
    chemistry:   'flask-outline',
    biology:     'leaf-outline',
    cs:          'code-braces',
    engineering: 'cog-outline',
    economics:   'chart-areaspline',
    literature:  'book-open-outline',
    history:     'castle',
    philosophy:  'lightbulb-outline',
};

function getSubjectIcon(subject: string): string {
    return SUBJECT_ICONS[subject] || 'file-document-outline';
}

function formatDate(d: string | undefined): string {
    if (!d) return '';
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
    catch { return ''; }
}

// ── Main Screen ───────────────────────────────────────────────────────
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
        } catch { /* silent — offline */ }
    }, [authFetch, setCurrentFlashcards]);

    const firstName = (auth.userName || 'Étudiant').split(' ')[0];
    const initials  = (auth.userName || 'YE')
        .split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase();
    const recentNotes = notes.slice(0, 4);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={C.primary} colors={[C.primary]} />
            }
        >
            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
                    <Text style={styles.headline}>Prêt à réviser ?</Text>
                </View>
                <TouchableOpacity
                    style={styles.avatarWrap}
                    onPress={() => router.push('/(tabs)/profile')}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={G.primary}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.avatarText}>{initials}</Text>
                </TouchableOpacity>
            </View>

            {/* ── Streak Hero Card ── */}
            <View style={styles.hPad}>
                <View style={styles.streakCard}>
                    <LinearGradient
                        colors={G.primary}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    {/* Zellige watermark */}
                    <View style={styles.streakZellige} pointerEvents="none">
                        <ZelligePattern color="#ffffff" opacity={1} tileSize={32} cols={7} rows={6} />
                    </View>

                    <View style={styles.streakInner}>
                        {/* Left — streak info */}
                        <View>
                            <View style={styles.streakLabelRow}>
                                <MaterialCommunityIcons name="fire" size={14} color="#fff" />
                                <Text style={styles.streakLabel}>Série d'étude</Text>
                            </View>
                            <View style={styles.streakNumRow}>
                                <Text style={styles.streakNum}>{stats?.study_streak ?? 0}</Text>
                                <Text style={styles.streakUnit}>jours</Text>
                            </View>
                            <Text style={styles.streakSub}>{stats?.total_notes ?? 0} note{(stats?.total_notes ?? 0) > 1 ? 's' : ''} au total</Text>
                        </View>

                        {/* Right — week dots */}
                        <View style={styles.weekRow}>
                            {['L','M','M','J','V','S','D'].map((d, i) => {
                                const done = i <= 4;
                                const today = i === 5;
                                return (
                                    <View key={i} style={styles.weekCol}>
                                        <View style={[
                                            styles.weekDot,
                                            done ? styles.weekDotDone : styles.weekDotEmpty,
                                            today && { borderWidth: 2, borderColor: '#FFD700' },
                                        ]}>
                                            {done && <MaterialCommunityIcons name="check" size={10} color={C.primaryDark} />}
                                        </View>
                                        <Text style={styles.weekDay}>{d}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </View>

            {/* ── Stats Row ── */}
            <View style={styles.statsRow}>
                {[
                    { v: String(stats?.total_notes ?? notes.length),     l: 'Notes',     color: C.primary },
                    { v: String(stats?.total_flashcards ?? '—'),          l: 'Cartes',    color: C.accent },
                    { v: stats ? `${stats.average_score}%` : '—',        l: 'Précision', color: C.success },
                ].map((stat, i) => (
                    <View key={i} style={styles.statCard}>
                        <Text style={[styles.statValue, { color: stat.color }]}>{stat.v}</Text>
                        <Text style={styles.statLabel}>{stat.l}</Text>
                    </View>
                ))}
            </View>

            {/* ── Subject distribution ── */}
            {stats?.subject_distribution && Object.keys(stats.subject_distribution).length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: SIZES.md, paddingTop: 10, gap: 8 }}
                >
                    {Object.entries(stats.subject_distribution)
                        .sort(([, a], [, b]) => b - a)
                        .map(([subject, count]) => {
                            const color = SUBJECT_COLORS[subject] || C.primary;
                            const icon = getSubjectIcon(subject);
                            return (
                                <View key={subject} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color + '18', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: color + '30' }}>
                                    <MaterialCommunityIcons name={icon as any} size={13} color={color} />
                                    <Text style={{ fontSize: 12, fontWeight: '600', color }}>{SUBJECT_LABELS[subject] || subject}</Text>
                                    <View style={{ backgroundColor: color + '30', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color }}>{count as number}</Text>
                                    </View>
                                </View>
                            );
                        })}
                </ScrollView>
            )}

            {/* ── Flashcards due today ── */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>À réviser aujourd'hui</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/study')} style={styles.sectionAction} activeOpacity={0.7}>
                    <Text style={styles.sectionActionText}>Tout voir</Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={C.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.hPad}>
                <View style={styles.flashCard}>
                    {/* Gradient accent top bar */}
                    <LinearGradient
                        colors={G.accent}
                        style={styles.flashTopBar}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    />
                    <View style={styles.flashBody}>
                        {/* Icon with badge */}
                        <View style={[styles.flashIconWrap, { backgroundColor: C.accent + '20' }]}>
                            <MaterialCommunityIcons name="cards-outline" size={24} color={C.accent} />
                            {(stats?.flashcards_due_count ?? 0) > 0 && (
                                <View style={[styles.flashBadge, { backgroundColor: C.error }]}>
                                    <Text style={styles.flashBadgeText}>{stats!.flashcards_due_count}</Text>
                                </View>
                            )}
                        </View>
                        {/* Text */}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.flashTitle}>
                                {stats ? `${stats.flashcards_due_count} carte${stats.flashcards_due_count !== 1 ? 's' : ''} à réviser` : 'Flashcards à réviser'}
                            </Text>
                            <Text style={styles.flashSub}>≈ {Math.max(1, Math.round((stats?.flashcards_due_count ?? 0) / 3))} min · répétition espacée</Text>
                        </View>
                        {/* Button */}
                        <TouchableOpacity
                            style={[styles.flashBtn, { backgroundColor: C.primary }]}
                            onPress={startDueFlashcards}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.flashBtnText}>Démarrer</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Progress bar */}
                    {stats && stats.total_flashcards > 0 && (
                        <View style={styles.flashProgressRow}>
                            <View style={[styles.flashProgressBg, { backgroundColor: C.border }]}>
                                <LinearGradient
                                    colors={G.primary}
                                    style={[styles.flashProgressFill, { width: `${Math.round(((stats.total_flashcards - stats.flashcards_due_count) / stats.total_flashcards) * 100)}%` }]}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                />
                            </View>
                            <Text style={styles.flashProgressText}>{stats.total_flashcards - stats.flashcards_due_count}/{stats.total_flashcards}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* ── Recent Notes ── */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Notes récentes</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/notes')} style={styles.sectionAction} activeOpacity={0.7}>
                    <Text style={styles.sectionActionText}>Voir tout</Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={C.primary} />
                </TouchableOpacity>
            </View>

            {recentNotes.length === 0 ? (
                <View style={styles.empty}>
                    <View style={[styles.emptyIconWrap, { backgroundColor: C.primary + '18' }]}>
                        <MaterialCommunityIcons name="notebook-plus-outline" size={32} color={C.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>Aucune note pour l'instant</Text>
                    <Text style={styles.emptySub}>Capturez votre premier cours avec le bouton ci-dessous.</Text>
                </View>
            ) : (
                <View style={styles.notesWrap}>
                    {recentNotes.map((note: any) => {
                        const color = SUBJECT_COLORS[note.subject] || C.primary;
                        const icon = getSubjectIcon(note.subject);
                        return (
                            <TouchableOpacity
                                key={note.id}
                                style={styles.noteCard}
                                onPress={() => router.push({ pathname: '/note-detail', params: { id: note.id } })}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.noteAccent, { backgroundColor: color }]} />
                                <View style={[styles.noteIcon, { backgroundColor: color + '20' }]}>
                                    <MaterialCommunityIcons name={icon as any} size={18} color={color} />
                                </View>
                                <View style={styles.noteBody}>
                                    <View style={styles.notePillRow}>
                                        <View style={[styles.notePill, { backgroundColor: color + '18' }]}>
                                            <View style={[styles.notePillDot, { backgroundColor: color }]} />
                                            <Text style={[styles.notePillText, { color }]}>{SUBJECT_LABELS[note.subject] || 'Autre'}</Text>
                                        </View>
                                        <Text style={styles.noteTime}>{formatDate(note.created_at)}</Text>
                                    </View>
                                    <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                                    <View style={styles.noteMeta}>
                                        <MaterialCommunityIcons name="cards-outline" size={11} color={C.textMuted} />
                                        <Text style={styles.noteMetaText}>{note.flashcards?.length ?? '—'} cartes</Text>
                                    </View>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={16} color={C.textMuted} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* ── Capture prompt ── */}
            <View style={styles.hPad16}>
                <TouchableOpacity
                    style={styles.capturePrompt}
                    onPress={() => router.push('/capture')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.captureIcon, { backgroundColor: C.primary + '18' }]}>
                        <MaterialCommunityIcons name="camera-plus-outline" size={20} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.captureTitle}>Capturer de nouvelles notes</Text>
                        <Text style={styles.captureSub}>Photo ou import depuis la galerie</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={16} color={C.primary} />
                </TouchableOpacity>
            </View>

            <View style={{ height: 24 }} />
        </ScrollView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────
const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content:   { paddingBottom: 32 },

    // Header
    header:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: 14 },
    greeting:   { fontSize: SIZES.fontSm, color: C.textSecondary, fontWeight: '500' },
    headline:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 2, color: C.textPrimary },
    avatarWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary },
    avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    // Paddings
    hPad:   { paddingHorizontal: SIZES.md },
    hPad16: { paddingHorizontal: SIZES.md, paddingTop: SIZES.lg },

    // Streak card
    streakCard:     { borderRadius: 22, overflow: 'hidden', padding: 18, ...SHADOWS.primary },
    streakZellige:  { position: 'absolute', right: -30, top: -30, width: 230, height: 200, opacity: 0.18 },
    streakInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    streakLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    streakLabel:    { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.4, textTransform: 'uppercase' },
    streakNumRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    streakNum:      { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1.5, lineHeight: 50 },
    streakUnit:     { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
    streakSub:      { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    weekRow:        { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
    weekCol:        { alignItems: 'center', gap: 4 },
    weekDot:        { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    weekDotDone:    { backgroundColor: '#fff' },
    weekDotEmpty:   { backgroundColor: 'rgba(255,255,255,0.2)' },
    weekDay:        { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

    // Stats
    statsRow: { flexDirection: 'row', paddingHorizontal: SIZES.md, paddingTop: 14, gap: 10 },
    statCard: {
        flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 12,
        borderWidth: 1, borderColor: C.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    statLabel: { fontSize: 11, color: C.textMuted, fontWeight: '500', marginTop: 2 },

    // Section header
    sectionHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: SIZES.lg, paddingBottom: SIZES.sm },
    sectionTitle:      { fontSize: SIZES.fontLg, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.2 },
    sectionAction:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
    sectionActionText: { fontSize: SIZES.fontXs, fontWeight: '600', color: C.primary },

    // Flashcard due
    flashCard:        { backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
    flashTopBar:      { height: 3 },
    flashBody:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    flashIconWrap:    { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    flashBadge:       { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.surface },
    flashBadgeText:   { fontSize: 10, fontWeight: '700', color: '#fff' },
    flashTitle:       { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    flashSub:         { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    flashBtn:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, ...SHADOWS.primary },
    flashBtnText:     { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.1 },
    flashProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
    flashProgressBg:  { flex: 1, height: 5, borderRadius: 999, overflow: 'hidden' },
    flashProgressFill:{ height: '100%' as any, borderRadius: 999 },
    flashProgressText:{ fontSize: 11, color: C.textMuted, fontWeight: '600' },

    // Note cards
    notesWrap: { paddingHorizontal: SIZES.md, gap: 8 },
    noteCard:  {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden',
        borderWidth: 1, borderColor: C.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    noteAccent:    { width: 3, alignSelf: 'stretch' },
    noteIcon:      { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginLeft: 2 },
    noteBody:      { flex: 1, minWidth: 0, paddingVertical: 12, paddingRight: 4 },
    notePillRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    notePill:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    notePillDot:   { width: 4, height: 4, borderRadius: 2 },
    notePillText:  { fontSize: 10, fontWeight: '600' },
    noteTitle:     { fontSize: 14, fontWeight: '700', color: C.textPrimary },
    noteTime:      { fontSize: 10, color: C.textMuted, fontWeight: '400', marginLeft: 'auto' },
    noteMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    noteMetaText:  { fontSize: 11, color: C.textMuted },

    // Empty state
    empty:        { alignItems: 'center', paddingVertical: SIZES.xxxl, paddingHorizontal: SIZES.xxl, gap: SIZES.sm },
    emptyIconWrap:{ width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.xs },
    emptyTitle:   { fontSize: SIZES.fontLg, fontWeight: '600', color: C.textSecondary, textAlign: 'center' },
    emptySub:     { fontSize: SIZES.fontSm, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

    // Capture prompt
    capturePrompt: {
        backgroundColor: C.surface, borderWidth: 1.5, borderStyle: 'dashed',
        borderColor: C.primary + '50', borderRadius: 16, padding: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    captureIcon:   { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    captureTitle:  { fontSize: 13, fontWeight: '600', color: C.textPrimary },
    captureSub:    { fontSize: 11, color: C.textSecondary, marginTop: 2 },
});
