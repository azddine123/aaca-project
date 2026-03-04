import React from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TouchableOpacity, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotes } from '../contexts/NotesContext';
import { COLORS, SIZES, FONTS, SHADOWS } from '../theme';

export default function HomeScreen() {
    const { auth } = useAuth();
    const { notes, fetchNotes, isLoading } = useNotes();

    const stats = {
        totalNotes: notes.length,
        streak: 3,
        avgScore: 78,
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchNotes} tintColor={COLORS.primary} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Bonjour 👋</Text>
                    <Text style={styles.username}>{auth.userName || 'Étudiant'}</Text>
                </View>
                <MaterialCommunityIcons name="bell-outline" size={24} color={COLORS.textSecondary} />
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <StatCard icon="notebook-outline" value={stats.totalNotes} label="Notes" color={COLORS.primary} />
                <StatCard icon="fire" value={`${stats.streak}j`} label="Streak" color={COLORS.warning} />
                <StatCard icon="chart-line" value={`${stats.avgScore}%`} label="Score" color={COLORS.success} />
            </View>

            {/* Quick Capture Button */}
            <TouchableOpacity style={styles.captureBtn} onPress={() => router.push('/capture')} activeOpacity={0.85}>
                <MaterialCommunityIcons name="camera-outline" size={24} color={COLORS.white} />
                <Text style={styles.captureBtnText}>Capturer une nouvelle note</Text>
            </TouchableOpacity>

            {/* Recent Notes */}
            <Text style={[FONTS.h3, { marginTop: SIZES.xl, marginBottom: SIZES.md }]}>Notes récentes</Text>
            {notes.length === 0 ? (
                <View style={styles.empty}>
                    <MaterialCommunityIcons name="notebook-outline" size={48} color={COLORS.textSecondary} />
                    <Text style={[FONTS.body2, { marginTop: SIZES.sm }]}>Aucune note pour le moment</Text>
                    <Text style={[FONTS.caption, { marginTop: 4, textAlign: 'center' }]}>
                        Capturez votre première note avec le bouton ci-dessus
                    </Text>
                </View>
            ) : (
                notes.slice(0, 5).map((note: any) => (
                    <TouchableOpacity
                        key={note.id}
                        style={styles.noteCard}
                        onPress={() => router.push({ pathname: '/note-detail', params: { id: note.id } })}
                    >
                        <View style={styles.noteInfo}>
                            <Text style={[FONTS.body1, { fontWeight: '600' }]} numberOfLines={1}>{note.title}</Text>
                            <Text style={FONTS.body2} numberOfLines={2}>{note.preview || note.raw_text}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                ))
            )}
        </ScrollView>
    );
}

function StatCard({ icon, value, label, color }: any) {
    return (
        <View style={[styles.statCard, { borderTopColor: color }]}>
            <MaterialCommunityIcons name={icon} size={24} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={FONTS.caption}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SIZES.xl, paddingTop: 56 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.xl },
    greeting: { ...FONTS.body2 },
    username: { ...FONTS.h2 },
    statsRow: { flexDirection: 'row', gap: SIZES.md, marginBottom: SIZES.xl },
    statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.md, alignItems: 'center', gap: 4, borderTopWidth: 3, ...SHADOWS.sm },
    statValue: { fontSize: SIZES.fontXl, fontWeight: 'bold' },
    captureBtn: { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, height: 56, borderRadius: SIZES.borderRadius, ...SHADOWS.md },
    captureBtnText: { color: COLORS.white, fontSize: SIZES.fontMd, fontWeight: '700' },
    noteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.md, marginBottom: SIZES.sm, ...SHADOWS.sm },
    noteInfo: { flex: 1, gap: 4 },
    empty: { alignItems: 'center', padding: SIZES.xxl },
});
