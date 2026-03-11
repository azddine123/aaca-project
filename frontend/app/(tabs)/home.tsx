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
import { COLORS, SIZES, FONTS, SHADOWS, GRADIENTS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
    } catch {
        return '';
    }
}

function SubjectDot({ subject }: { subject: string }) {
    const color = SUBJECT_COLORS[subject] || COLORS.primary;
    return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export default function HomeScreen() {
    const { auth } = useAuth();
    const { notes, fetchNotes, isLoading } = useNotes();

    const firstName = (auth.userName || 'Étudiant').split(' ')[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

    const recentNotes = notes.slice(0, 5);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={isLoading}
                    onRefresh={fetchNotes}
                    tintColor={COLORS.primary}
                    colors={[COLORS.primary]}
                />
            }
        >
            {/* ── Hero Header ── */}
            <LinearGradient
                colors={['#0D1226', '#131A30']}
                style={styles.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.heroTop}>
                    <View>
                        <Text style={styles.greetingText}>{greeting} 👋</Text>
                        <Text style={styles.heroName}>{firstName}</Text>
                    </View>
                    <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="bell-outline" size={22} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                    <StatPill icon="notebook-multiple" value={notes.length} label="Notes" color={COLORS.primary} />
                    <StatPill icon="fire" value="—" label="Streak" color={COLORS.warning} />
                    <StatPill icon="chart-line-variant" value="—" label="Score" color={COLORS.success} />
                </View>
            </LinearGradient>

            {/* ── Quick capture ── */}
            <TouchableOpacity
                style={styles.captureCard}
                onPress={() => router.push('/capture')}
                activeOpacity={0.85}
            >
                <LinearGradient
                    colors={GRADIENTS.primary}
                    style={styles.captureGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.captureLeft}>
                        <MaterialCommunityIcons name="camera-plus-outline" size={28} color={COLORS.white} />
                        <View>
                            <Text style={styles.captureTitleText}>Nouvelle capture</Text>
                            <Text style={styles.captureSubText}>Photo → Note IA en quelques secondes</Text>
                        </View>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={22} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
            </TouchableOpacity>

            {/* ── Quick actions ── */}
            <View style={styles.quickRow}>
                <QuickAction icon="cards-outline" label="Flashcards" color={COLORS.accent} onPress={() => router.push('/(tabs)/study')} />
                <QuickAction icon="clipboard-check-outline" label="Quiz" color={COLORS.success} onPress={() => router.push('/(tabs)/study')} />
                <QuickAction icon="notebook-outline" label="Mes notes" color={COLORS.primary} onPress={() => router.push('/(tabs)/notes')} />
            </View>

            {/* ── Recent notes ── */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Notes récentes</Text>
                {notes.length > 0 && (
                    <TouchableOpacity onPress={() => router.push('/(tabs)/notes')}>
                        <Text style={styles.seeAll}>Voir tout</Text>
                    </TouchableOpacity>
                )}
            </View>

            {recentNotes.length === 0 ? (
                <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="notebook-plus-outline" size={52} color={COLORS.textMuted} />
                    <Text style={styles.emptyTitle}>Aucune note pour l'instant</Text>
                    <Text style={styles.emptySubtitle}>Capturez votre premier cours avec le bouton ci-dessus.</Text>
                </View>
            ) : (
                recentNotes.map((note: any) => (
                    <TouchableOpacity
                        key={note.id}
                        style={styles.noteCard}
                        onPress={() => router.push({ pathname: '/note-detail', params: { id: note.id } })}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.noteAccent, { backgroundColor: SUBJECT_COLORS[note.subject] || COLORS.primary }]} />
                        <View style={styles.noteBody}>
                            <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                            <Text style={styles.notePreview} numberOfLines={2}>
                                {note.preview || note.raw_text || ''}
                            </Text>
                            <View style={styles.noteMeta}>
                                <SubjectDot subject={note.subject} />
                                <Text style={styles.noteSubjectLabel}>
                                    {SUBJECT_LABELS[note.subject] || note.subject || 'Autre'}
                                </Text>
                                <Text style={styles.noteSep}>·</Text>
                                <Text style={styles.noteDate}>{formatDate(note.created_at)}</Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                ))
            )}

            <View style={{ height: 24 }} />
        </ScrollView>
    );
}

function StatPill({ icon, value, label, color }: { icon: string; value: any; label: string; color: string }) {
    return (
        <View style={styles.statPill}>
            <MaterialCommunityIcons name={icon as any} size={16} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function QuickAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.quickIcon, { backgroundColor: color + '22' }]}>
                <MaterialCommunityIcons name={icon as any} size={22} color={color} />
            </View>
            <Text style={styles.quickLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { paddingBottom: 32 },

    // Hero
    hero: { paddingTop: 56, paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xl, marginBottom: 0 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SIZES.xl },
    greetingText: { ...FONTS.body2, marginBottom: 2 },
    heroName: { ...FONTS.h2 },
    bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceHigh, justifyContent: 'center', alignItems: 'center' },

    // Stats
    statsRow: { flexDirection: 'row', gap: SIZES.sm },
    statPill: { flex: 1, backgroundColor: COLORS.surfaceHigh, borderRadius: SIZES.borderRadius, padding: SIZES.sm, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: COLORS.border },
    statValue: { fontSize: SIZES.fontXl, fontWeight: '700' },
    statLabel: { ...FONTS.caption },

    // Capture card
    captureCard: { marginHorizontal: SIZES.xl, marginTop: SIZES.xl, borderRadius: SIZES.borderRadiusLg, overflow: 'hidden', ...SHADOWS.primary },
    captureGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SIZES.lg },
    captureLeft: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, flex: 1 },
    captureTitleText: { color: COLORS.white, fontSize: SIZES.fontMd, fontWeight: '700' },
    captureSubText: { color: 'rgba(255,255,255,0.65)', fontSize: SIZES.fontXs, marginTop: 2 },

    // Quick actions
    quickRow: { flexDirection: 'row', marginHorizontal: SIZES.xl, marginTop: SIZES.lg, gap: SIZES.sm },
    quickAction: { flex: 1, alignItems: 'center', gap: SIZES.xs, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, paddingVertical: SIZES.md, borderWidth: 1, borderColor: COLORS.border },
    quickIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: SIZES.fontXs, fontWeight: '600', color: COLORS.textSecondary },

    // Section
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: SIZES.xl, marginTop: SIZES.xxl, marginBottom: SIZES.md },
    sectionTitle: { ...FONTS.h4 },
    seeAll: { fontSize: SIZES.fontSm, color: COLORS.primary, fontWeight: '600' },

    // Note cards
    noteCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SIZES.xl, marginBottom: SIZES.sm, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.border },
    noteAccent: { width: 4, alignSelf: 'stretch' },
    noteBody: { flex: 1, padding: SIZES.md, gap: 3 },
    noteTitle: { fontSize: SIZES.fontMd, fontWeight: '600', color: COLORS.textPrimary },
    notePreview: { ...FONTS.body2, lineHeight: 18 },
    noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    noteSubjectLabel: { fontSize: SIZES.fontXs, fontWeight: '600', color: COLORS.textMuted },
    noteSep: { fontSize: SIZES.fontXs, color: COLORS.textMuted },
    noteDate: { fontSize: SIZES.fontXs, color: COLORS.textMuted },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: SIZES.xxxl, paddingHorizontal: SIZES.xxl, gap: SIZES.sm },
    emptyTitle: { ...FONTS.h4, textAlign: 'center', color: COLORS.textSecondary },
    emptySubtitle: { ...FONTS.body2, textAlign: 'center', lineHeight: 20 },
});
