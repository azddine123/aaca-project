import React from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TouchableOpacity, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { ZelligePattern } from '@/components/ZelligePattern';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Moroccan Design Tokens ───────────────────────────────────────────
const T = {
    bg:           '#F0F2F5',
    surface:      '#FFFFFF',
    surfaceAlt:   '#F7F8FA',
    text:         '#1C1E21',
    textMuted:    '#65676B',
    textFaint:    '#8A8D91',
    border:       '#E4E6EB',
    borderSoft:   '#EEF0F3',
    cobalt:       '#1B4FD8',
    cobaltDeep:   '#143FAE',
    cobaltSoft:   '#E8EEFC',
    terracotta:   '#C1440E',
    terracottaSoft: '#FBE9E0',
    gold:         '#D4A017',
    goldSoft:     '#FAF1D9',
    saffron:      '#F59E0B',
    saffronSoft:  '#FEF1D6',
    green:        '#1F8A5B',
    greenSoft:    '#E2F1EA',
} as const;

// ── Subject map (matches backend SubjectCategory)
const SUBJ: Record<string, { fg: string; soft: string; glyph: string; label: string }> = {
    mathematics: { fg: '#1B4FD8', soft: '#E8EEFC', glyph: '∫', label: 'Math' },
    physics:     { fg: '#C1440E', soft: '#FBE9E0', glyph: 'φ', label: 'Physique' },
    biology:     { fg: '#1F8A5B', soft: '#E2F1EA', glyph: '⌬', label: 'Biologie' },
    cs:          { fg: '#F59E0B', soft: '#FEF1D6', glyph: '{ }', label: 'Informatique' },
    chemistry:   { fg: '#7C3AED', soft: '#EFE7FB', glyph: '⚗', label: 'Chimie' },
    history:     { fg: '#D4A017', soft: '#FAF1D9', glyph: '§',  label: 'Histoire' },
    engineering: { fg: '#06B6D4', soft: '#E0F7FA', glyph: '⚙', label: 'Ingénierie' },
    economics:   { fg: '#EAB308', soft: '#FEF9C3', glyph: '€', label: 'Économie' },
    literature:  { fg: '#EC4899', soft: '#FCE7F3', glyph: 'L',  label: 'Littérature' },
    philosophy:  { fg: '#64748B', soft: '#F1F5F9', glyph: 'Φ', label: 'Philo' },
    other:       { fg: '#6B7280', soft: '#F3F4F6', glyph: '?', label: 'Autre' },
};

function getSubj(key: string) {
    return SUBJ[key] ?? SUBJ.other;
}

// ── Helpers ───────────────────────────────────────────────────────────
function formatDate(d: string | undefined): string {
    if (!d) return '';
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
    catch { return ''; }
}

// ── Sub-components ────────────────────────────────────────────────────

function SubjectPill({ subject }: { subject: string }) {
    const c = getSubj(subject);
    return (
        <View style={[pill.wrap, { backgroundColor: c.soft }]}>
            <View style={[pill.dot, { backgroundColor: c.fg }]} />
            <Text style={[pill.label, { color: c.fg }]}>{c.label}</Text>
        </View>
    );
}
const pill = StyleSheet.create({
    wrap:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    dot:   { width: 5, height: 5, borderRadius: 3 },
    label: { fontSize: 11, fontWeight: '600' },
});

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
    return (
        <View style={sh.wrap}>
            <Text style={sh.title}>{title}</Text>
            {action && (
                <TouchableOpacity onPress={onAction} style={sh.btn} activeOpacity={0.7}>
                    <Text style={sh.action}>{action}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={T.cobalt} />
                </TouchableOpacity>
            )}
        </View>
    );
}
const sh = StyleSheet.create({
    wrap:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
    title:  { fontSize: 16, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
    btn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
    action: { fontSize: 12, fontWeight: '600', color: T.cobalt },
});

// ── Main Screen ───────────────────────────────────────────────────────
export default function HomeScreen() {
    const { auth } = useAuth();
    const { notes, fetchNotes, isLoading } = useNotes();

    const firstName = (auth.userName || 'Étudiant').split(' ')[0];
    const initials  = (auth.userName || 'YE')
        .split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase();
    const recentNotes = notes.slice(0, 4);

    return (
        <ScrollView
            style={s.container}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={fetchNotes} tintColor={T.cobalt} colors={[T.cobalt]} />
            }
        >
            {/* ── Header ── */}
            <View style={s.header}>
                <View>
                    <Text style={s.greeting}>Bonjour, {firstName}</Text>
                    <Text style={s.headline}>Prête à réviser ?</Text>
                </View>
                <View style={s.avatar}>
                    <LinearGradient
                        colors={[T.cobaltSoft, T.goldSoft]}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    <Text style={s.avatarText}>{initials}</Text>
                </View>
            </View>

            {/* ── Streak Hero Card ── */}
            <View style={s.hPad}>
                <View style={s.streakCard}>
                    <LinearGradient
                        colors={[T.cobalt, T.cobaltDeep]}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    {/* Zellige watermark top-right */}
                    <View style={s.streakZellige} pointerEvents="none">
                        <ZelligePattern color="#ffffff" opacity={1} tileSize={32} cols={7} rows={6} />
                    </View>

                    <View style={s.streakInner}>
                        {/* Left — streak info */}
                        <View>
                            <View style={s.streakLabelRow}>
                                <MaterialCommunityIcons name="fire" size={14} color="#fff" />
                                <Text style={s.streakLabel}>Série d'étude</Text>
                            </View>
                            <View style={s.streakNumRow}>
                                <Text style={s.streakNum}>12</Text>
                                <Text style={s.streakUnit}>jours</Text>
                            </View>
                            <Text style={s.streakSub}>+3 vs. semaine dernière</Text>
                        </View>

                        {/* Right — week dots */}
                        <View style={s.weekRow}>
                            {['L','M','M','J','V','S','D'].map((d, i) => {
                                const done = i <= 5;
                                return (
                                    <View key={i} style={s.weekCol}>
                                        <View style={[
                                            s.weekDot,
                                            done ? s.weekDotDone : s.weekDotEmpty,
                                            i === 5 && { borderWidth: 2, borderColor: T.gold },
                                        ]}>
                                            {done && (
                                                <MaterialCommunityIcons name="check" size={10} color={T.cobaltDeep} />
                                            )}
                                        </View>
                                        <Text style={s.weekDay}>{d}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </View>

            {/* ── Stats Row ── */}
            <View style={s.statsRow}>
                {[
                    { v: String(notes.length), l: 'Notes',     c: T.cobalt },
                    { v: '—',                  l: 'Cartes',    c: T.terracotta },
                    { v: '—',                  l: 'Précision', c: T.green },
                ].map((stat, i) => (
                    <View key={i} style={s.statCard}>
                        <Text style={[s.statValue, { color: stat.c }]}>{stat.v}</Text>
                        <Text style={s.statLabel}>{stat.l}</Text>
                    </View>
                ))}
            </View>

            {/* ── Flashcards due today ── */}
            <SectionHeader
                title="À réviser aujourd'hui"
                action="Tout voir"
                onAction={() => router.push('/(tabs)/study')}
            />
            <View style={s.hPad}>
                <View style={s.flashCard}>
                    {/* Gold gradient top bar */}
                    <LinearGradient
                        colors={[T.gold, T.saffron, T.terracotta]}
                        style={s.flashTopBar}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    />
                    <View style={s.flashBody}>
                        {/* Icon with badge */}
                        <View style={s.flashIconWrap}>
                            <LinearGradient
                                colors={[T.saffronSoft, T.goldSoft]}
                                style={StyleSheet.absoluteFillObject}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            />
                            <MaterialCommunityIcons name="cards-outline" size={24} color={T.saffron} />
                            <View style={s.flashBadge}>
                                <Text style={s.flashBadgeText}>24</Text>
                            </View>
                        </View>
                        {/* Text */}
                        <View style={{ flex: 1 }}>
                            <Text style={s.flashTitle}>24 cartes à réviser</Text>
                            <Text style={s.flashSub}>≈ 8 min · répétition espacée</Text>
                        </View>
                        {/* Button */}
                        <TouchableOpacity
                            style={s.flashBtn}
                            onPress={() => router.push('/(tabs)/study')}
                            activeOpacity={0.85}
                        >
                            <Text style={s.flashBtnText}>Démarrer</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Progress bar */}
                    <View style={s.flashProgressRow}>
                        <View style={s.flashProgressBg}>
                            <LinearGradient
                                colors={[T.cobalt, T.saffron]}
                                style={[s.flashProgressFill, { width: '35%' }]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            />
                        </View>
                        <Text style={s.flashProgressText}>8/24</Text>
                    </View>
                </View>
            </View>

            {/* ── Recent Notes ── */}
            <SectionHeader
                title="Notes récentes"
                action="Voir tout"
                onAction={() => router.push('/(tabs)/notes')}
            />

            {recentNotes.length === 0 ? (
                <View style={s.empty}>
                    <MaterialCommunityIcons name="notebook-plus-outline" size={48} color={T.textFaint} />
                    <Text style={s.emptyTitle}>Aucune note pour l'instant</Text>
                    <Text style={s.emptySub}>
                        Capturez votre premier cours avec le bouton ci-dessous.
                    </Text>
                </View>
            ) : (
                <View style={s.notesWrap}>
                    {recentNotes.map((note: any) => {
                        const c = getSubj(note.subject);
                        return (
                            <TouchableOpacity
                                key={note.id}
                                style={s.noteCardWrap}
                                onPress={() => router.push({ pathname: '/note-detail', params: { id: note.id } })}
                                activeOpacity={0.8}
                            >
                                <View style={[s.noteCard, { borderLeftColor: c.fg }]}>
                                    {/* Subject icon with zellige texture */}
                                    <View style={[s.noteIcon, { backgroundColor: c.soft }]}>
                                        <ZelligePattern color={c.fg} opacity={0.45} tileSize={18} cols={4} rows={4} />
                                        <Text style={[s.noteGlyph, { color: c.fg }]}>{c.glyph}</Text>
                                    </View>
                                    {/* Content */}
                                    <View style={s.noteBody}>
                                        <View style={s.notePillRow}>
                                            <SubjectPill subject={note.subject} />
                                            <Text style={s.noteTime}>{formatDate(note.created_at)}</Text>
                                        </View>
                                        <Text style={s.noteTitle} numberOfLines={1}>{note.title}</Text>
                                        <View style={s.noteMeta}>
                                            <MaterialCommunityIcons name="file-document-outline" size={11} color={T.textMuted} />
                                            <Text style={s.noteMetaText}>{note.pages ?? '—'} p.</Text>
                                            <View style={s.metaDot} />
                                            <MaterialCommunityIcons name="cards-outline" size={11} color={T.textMuted} />
                                            <Text style={s.noteMetaText}>{note.flashcards?.length ?? '—'} cartes</Text>
                                        </View>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={16} color={T.textFaint} />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* ── Capture prompt ── */}
            <View style={s.hPad16}>
                <TouchableOpacity
                    style={s.capturePrompt}
                    onPress={() => router.push('/capture')}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="camera-plus-outline" size={16} color={T.cobalt} />
                    <View>
                        <Text style={s.captureTitle}>Capturer de nouvelles notes</Text>
                        <Text style={s.captureSub}>Photo, PDF ou import depuis la galerie</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={{ height: 24 }} />
        </ScrollView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────
const CARD_SHADOW = {
    shadowColor: '#14203C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
} as const;

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg },
    content:   { paddingBottom: 32 },

    // Header
    header:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
    greeting:   { fontSize: 14, color: T.textMuted, fontWeight: '500' },
    headline:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 2, color: T.text },
    avatar:     { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 16, fontWeight: '700', color: T.cobalt },

    // Paddings
    hPad:   { paddingHorizontal: 16 },
    hPad16: { paddingHorizontal: 16, paddingTop: 18 },

    // Streak card
    streakCard:     { borderRadius: 22, overflow: 'hidden', padding: 18, shadowColor: T.cobalt, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 28, elevation: 12 },
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
    statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 10 },
    statCard:  { flex: 1, backgroundColor: T.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: T.borderSoft, ...CARD_SHADOW },
    statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    statLabel: { fontSize: 11, color: T.textMuted, fontWeight: '500', marginTop: 2 },

    // Flashcard due
    flashCard:        { backgroundColor: T.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.borderSoft, ...CARD_SHADOW },
    flashTopBar:      { height: 3 },
    flashBody:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    flashIconWrap:    { width: 50, height: 50, borderRadius: 14, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    flashBadge:       { position: 'absolute', top: -4, right: -4, backgroundColor: T.terracotta, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    flashBadgeText:   { fontSize: 10, fontWeight: '700', color: '#fff' },
    flashTitle:       { fontSize: 15, fontWeight: '700', color: T.text },
    flashSub:         { fontSize: 12, color: T.textMuted, marginTop: 2 },
    flashBtn:         { backgroundColor: T.cobalt, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, shadowColor: T.cobalt, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
    flashBtnText:     { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.1 },
    flashProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
    flashProgressBg:  { flex: 1, height: 5, borderRadius: 999, backgroundColor: T.borderSoft, overflow: 'hidden' },
    flashProgressFill:{ height: '100%' as any, borderRadius: 999 },
    flashProgressText:{ fontSize: 11, color: T.textMuted, fontWeight: '600' },

    // Note cards
    notesWrap:    { paddingHorizontal: 16, gap: 10 },
    noteCardWrap: { ...CARD_SHADOW },
    noteCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: T.borderSoft, borderLeftWidth: 3, overflow: 'hidden' },
    noteIcon:     { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' },
    noteGlyph:    { fontSize: 18, fontWeight: '800' },
    noteBody:     { flex: 1, minWidth: 0 },
    notePillRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    noteTitle:    { fontSize: 14, fontWeight: '700', color: T.text },
    noteTime:     { fontSize: 11, color: T.textFaint, fontWeight: '500' },
    noteMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    noteMetaText: { fontSize: 11, color: T.textMuted },
    metaDot:      { width: 2, height: 2, borderRadius: 1, backgroundColor: T.textFaint },

    // Capture prompt
    capturePrompt: { backgroundColor: T.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.border, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    captureTitle:  { fontSize: 13, fontWeight: '600', color: T.text },
    captureSub:    { fontSize: 11, color: T.textMuted, marginTop: 3 },

    // Empty state
    empty:      { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: T.textMuted, textAlign: 'center' },
    emptySub:   { fontSize: 13, color: T.textFaint, textAlign: 'center', lineHeight: 20 },
});
