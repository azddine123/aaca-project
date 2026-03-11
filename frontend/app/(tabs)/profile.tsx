import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { COLORS, SIZES, FONTS, SHADOWS, GRADIENTS } from '@/theme';

type MenuItem = {
    icon: string;
    label: string;
    sub?: string;
    color?: string;
    onPress: () => void;
};

export default function ProfileScreen() {
    const { auth, logout } = useAuth();
    const { notes } = useNotes();

    const handleLogout = () => {
        Alert.alert(
            'Déconnexion',
            'Voulez-vous vraiment vous déconnecter ?',
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnexion', style: 'destructive', onPress: logout },
            ]
        );
    };

    const initial = (auth.userName || 'U').charAt(0).toUpperCase();

    const sections: { title: string; items: MenuItem[] }[] = [
        {
            title: 'Compte',
            items: [
                { icon: 'account-edit-outline', label: 'Modifier le profil', onPress: () => { } },
                { icon: 'bell-badge-outline',   label: 'Notifications',     sub: 'Activées', onPress: () => { } },
                { icon: 'shield-lock-outline',  label: 'Sécurité',         onPress: () => { } },
            ],
        },
        {
            title: 'Application',
            items: [
                { icon: 'palette-outline',        label: 'Apparence',         sub: 'Sombre', onPress: () => { } },
                { icon: 'translate',              label: 'Langue',            sub: 'Français', onPress: () => { } },
                { icon: 'help-circle-outline',    label: 'Aide & Support',   onPress: () => { } },
                { icon: 'information-outline',    label: 'À propos',          sub: 'v1.0.0', onPress: () => { } },
            ],
        },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Profile card ── */}
            <LinearGradient colors={['#0D1226', '#131A30']} style={styles.profileCard}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </LinearGradient>
                <Text style={styles.userName}>{auth.userName || 'Étudiant'}</Text>
                <Text style={styles.userEmail}>{auth.userEmail || ''}</Text>

                {/* Stats inline */}
                <View style={styles.statsRow}>
                    <StatBadge icon="notebook-multiple" value={notes.length} label="Notes" color={COLORS.primary} />
                    <View style={styles.statsDivider} />
                    <StatBadge icon="clipboard-check" value="—" label="Quiz" color={COLORS.success} />
                    <View style={styles.statsDivider} />
                    <StatBadge icon="chart-line" value="—" label="Score" color={COLORS.warning} />
                </View>
            </LinearGradient>

            {/* ── Achievement chips ── */}
            <View style={styles.achieveRow}>
                <AchieveBadge icon="star-shooting" label="Premier cours" color={COLORS.warning} unlocked={notes.length > 0} />
                <AchieveBadge icon="fire" label="Streak 7j" color={COLORS.error} unlocked={false} />
                <AchieveBadge icon="school" label="Quiz 80%" color={COLORS.success} unlocked={false} />
                <AchieveBadge icon="brain" label="Expert" color={COLORS.primary} unlocked={false} />
            </View>

            {/* ── Menu sections ── */}
            {sections.map((section) => (
                <View key={section.title} style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <View style={styles.menuCard}>
                        {section.items.map((item, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.menuItem, i < section.items.length - 1 && styles.menuItemBorder]}
                                onPress={item.onPress}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: (item.color || COLORS.primary) + '20' }]}>
                                    <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color || COLORS.primary} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                                <View style={styles.menuRight}>
                                    {item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
                                    <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.textMuted} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}

            {/* ── Logout ── */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
                <MaterialCommunityIcons name="logout-variant" size={18} color={COLORS.error} />
                <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
        </ScrollView>
    );
}

function StatBadge({ icon, value, label, color }: { icon: string; value: any; label: string; color: string }) {
    return (
        <View style={styles.statBadge}>
            <MaterialCommunityIcons name={icon as any} size={14} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function AchieveBadge({ icon, label, color, unlocked }: { icon: string; label: string; color: string; unlocked: boolean }) {
    return (
        <View style={[styles.achieveBadge, !unlocked && styles.achieveLocked]}>
            <MaterialCommunityIcons name={icon as any} size={20} color={unlocked ? color : COLORS.textMuted} />
            <Text style={[styles.achieveLabel, !unlocked && { color: COLORS.textMuted }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SIZES.xl, paddingTop: 56, gap: SIZES.xl },

    // Profile card
    profileCard: { borderRadius: SIZES.borderRadiusLg, padding: SIZES.xl, alignItems: 'center', gap: SIZES.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.md },
    avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary },
    avatarText: { fontSize: 34, fontWeight: '800', color: COLORS.white },
    userName: { ...FONTS.h3, marginTop: 4 },
    userEmail: { ...FONTS.body2 },

    // Stats
    statsRow: { flexDirection: 'row', marginTop: SIZES.sm, width: '100%' },
    statBadge: { flex: 1, alignItems: 'center', gap: 3 },
    statsDivider: { width: 1, backgroundColor: COLORS.border },
    statValue: { fontSize: SIZES.fontXl, fontWeight: '700' },
    statLabel: { ...FONTS.caption },

    // Achievements
    achieveRow: { flexDirection: 'row', gap: SIZES.sm },
    achieveBadge: { flex: 1, alignItems: 'center', gap: 5, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.sm, borderWidth: 1, borderColor: COLORS.border },
    achieveLocked: { opacity: 0.45 },
    achieveLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },

    // Menu
    menuSection: { gap: SIZES.sm },
    sectionTitle: { ...FONTS.label, paddingLeft: 4 },
    menuCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, padding: SIZES.md },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
    menuIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    menuLabel: { flex: 1, ...FONTS.body1 },
    menuRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    menuSub: { ...FONTS.caption, color: COLORS.textMuted },

    // Logout
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: COLORS.error + '15', borderRadius: SIZES.borderRadius, padding: SIZES.md + 2, borderWidth: 1, borderColor: COLORS.error + '40' },
    logoutText: { color: COLORS.error, fontSize: SIZES.fontMd, fontWeight: '700' },
});
