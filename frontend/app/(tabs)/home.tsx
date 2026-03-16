import React, { useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { SIZES, SHADOWS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
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

export default function HomeScreen() {
    const { auth } = useAuth();
    const { notes, fetchNotes, isLoading } = useNotes();
    const C = useAppColors();
    const G = useAppGradients();

    const styles = useMemo(() => makeStyles(C), [C]);

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
                    tintColor={C.primary}
                    colors={[C.primary]}
                />
            }
        >
            {/* ── Hero Header ── */}
            <LinearGradient
                colors={G.hero}
                style={styles.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.heroTop}>
                    <View>
                        <Text style={[styles.greetingText, { color: C.textSecondary }]}>{greeting} 👋</Text>
                        <Text style={[styles.heroName, { color: C.textPrimary }]}>{firstName}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.bellBtn, { backgroundColor: C.surfaceHigh }]}
                        activeOpacity={0.7}
                        onPress={() => Alert.alert('Notifications', 'Aucune nouvelle notification pour l\'instant.')}
                    >
                        <MaterialCommunityIcons name="bell-outline" size={22} color={C.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                    <StatPill icon="notebook-multiple"   value={notes.length} label="Notes"  color={C.primary}  C={C} />
                    <StatPill icon="fire"                 value="—"           label="Streak" color={C.warning}  C={C} />
                    <StatPill icon="chart-line-variant"   value="—"           label="Score"  color={C.success}  C={C} />
                </View>
            </LinearGradient>

            {/* ── Quick capture ── */}
            <TouchableOpacity
                style={styles.captureCard}
                onPress={() => router.push('/capture')}
                activeOpacity={0.85}
            >
                <LinearGradient
                    colors={G.primary}
                    style={styles.captureGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.captureLeft}>
                        <MaterialCommunityIcons name="camera-plus-outline" size={28} color="#fff" />
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
                <QuickAction icon="cards-outline"          label="Flashcards" color={C.accent}   onPress={() => router.push('/(tabs)/study')} C={C} />
                <QuickAction icon="clipboard-check-outline" label="Quiz"      color={C.success}  onPress={() => router.push('/(tabs)/study')} C={C} />
                <QuickAction icon="notebook-outline"        label="Mes notes" color={C.primary}  onPress={() => router.push('/(tabs)/notes')} C={C} />
            </View>

            {/* ── Recent notes ── */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Notes récentes</Text>
                {notes.length > 0 && (
                    <TouchableOpacity onPress={() => router.push('/(tabs)/notes')}>
                        <Text style={[styles.seeAll, { color: C.primary }]}>Voir tout</Text>
                    </TouchableOpacity>
                )}
            </View>

            {recentNotes.length === 0 ? (
                <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="notebook-plus-outline" size={52} color={C.textMuted} />
                    <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>Aucune note pour l'instant</Text>
                    <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>Capturez votre premier cours avec le bouton ci-dessus.</Text>
                </View>
            ) : (
                recentNotes.map((note: any) => (
                    <TouchableOpacity
                        key={note.id}
                        style={[styles.noteCard, { backgroundColor: C.surface, borderColor: C.border }]}
                        onPress={() => router.push({ pathname: '/note-detail', params: { id: note.id } })}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.noteAccent, { backgroundColor: SUBJECT_COLORS[note.subject] || C.primary }]} />
                        <View style={styles.noteBody}>
                            <Text style={[styles.noteTitle, { color: C.textPrimary }]} numberOfLines={1}>{note.title}</Text>
                            <Text style={[styles.notePreview, { color: C.textSecondary }]} numberOfLines={2}>
                                {note.preview || note.raw_text || ''}
                            </Text>
                            <View style={styles.noteMeta}>
                                <View style={[styles.dot, { backgroundColor: SUBJECT_COLORS[note.subject] || C.primary }]} />
                                <Text style={[styles.noteSubjectLabel, { color: C.textMuted }]}>
                                    {SUBJECT_LABELS[note.subject] || note.subject || 'Autre'}
                                </Text>
                                <Text style={[styles.noteSep, { color: C.textMuted }]}>·</Text>
                                <Text style={[styles.noteDate, { color: C.textMuted }]}>{formatDate(note.created_at)}</Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={C.textMuted} />
                    </TouchableOpacity>
                ))
            )}

            <View style={{ height: 24 }} />
        </ScrollView>
    );
}

function StatPill({ icon, value, label, color, C }: { icon: string; value: any; label: string; color: string; C: any }) {
    return (
        <View style={{ flex: 1, backgroundColor: C.surfaceHigh, borderRadius: SIZES.borderRadius, padding: SIZES.sm, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: C.border }}>
            <MaterialCommunityIcons name={icon as any} size={16} color={color} />
            <Text style={{ fontSize: SIZES.fontXl, fontWeight: '700', color }}>{value}</Text>
            <Text style={{ fontSize: SIZES.fontXs, color: C.textMuted }}>{label}</Text>
        </View>
    );
}

function QuickAction({ icon, label, color, onPress, C }: { icon: string; label: string; color: string; onPress: () => void; C: any }) {
    return (
        <TouchableOpacity style={{ flex: 1, alignItems: 'center', gap: SIZES.xs, backgroundColor: C.surface, borderRadius: SIZES.borderRadius, paddingVertical: SIZES.md, borderWidth: 1, borderColor: C.border }} onPress={onPress} activeOpacity={0.8}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: color + '22', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name={icon as any} size={22} color={color} />
            </View>
            <Text style={{ fontSize: SIZES.fontXs, fontWeight: '600', color: C.textSecondary }}>{label}</Text>
        </TouchableOpacity>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingBottom: 32 },

    hero: { paddingTop: 56, paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xl },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SIZES.xl },
    greetingText: { fontSize: SIZES.fontSm, marginBottom: 2 },
    heroName: { fontSize: SIZES.fontXXl, fontWeight: '700' },
    bellBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

    statsRow: { flexDirection: 'row', gap: SIZES.sm },

    captureCard: { marginHorizontal: SIZES.xl, marginTop: SIZES.xl, borderRadius: SIZES.borderRadiusLg, overflow: 'hidden', ...SHADOWS.primary },
    captureGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SIZES.lg },
    captureLeft: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, flex: 1 },
    captureTitleText: { color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' },
    captureSubText: { color: 'rgba(255,255,255,0.65)', fontSize: SIZES.fontXs, marginTop: 2 },

    quickRow: { flexDirection: 'row', marginHorizontal: SIZES.xl, marginTop: SIZES.lg, gap: SIZES.sm },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: SIZES.xl, marginTop: SIZES.xxl, marginBottom: SIZES.md },
    sectionTitle: { fontSize: SIZES.fontLg, fontWeight: '600' },
    seeAll: { fontSize: SIZES.fontSm, fontWeight: '600' },

    noteCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SIZES.xl, marginBottom: SIZES.sm, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.sm, borderWidth: 1 },
    noteAccent: { width: 4, alignSelf: 'stretch' },
    noteBody: { flex: 1, padding: SIZES.md, gap: 3 },
    noteTitle: { fontSize: SIZES.fontMd, fontWeight: '600' },
    notePreview: { fontSize: SIZES.fontXs, lineHeight: 18 },
    noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    noteSubjectLabel: { fontSize: SIZES.fontXs, fontWeight: '600' },
    noteSep: { fontSize: SIZES.fontXs },
    noteDate: { fontSize: SIZES.fontXs },

    emptyState: { alignItems: 'center', paddingVertical: SIZES.xxxl, paddingHorizontal: SIZES.xxl, gap: SIZES.sm },
    emptyTitle: { fontSize: SIZES.fontLg, fontWeight: '600', textAlign: 'center' },
    emptySubtitle: { fontSize: SIZES.fontSm, textAlign: 'center', lineHeight: 20 },
});
