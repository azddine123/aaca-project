import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, SIZES, FONTS, SHADOWS } from '../theme';

export default function ProfileScreen() {
    const { auth, logout } = useAuth();

    const handleLogout = () => {
        Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Déconnexion', style: 'destructive', onPress: logout },
        ]);
    };

    const menuItems = [
        { icon: 'account-edit-outline', label: 'Modifier le profil', onPress: () => { } },
        { icon: 'bell-outline', label: 'Notifications', onPress: () => { } },
        { icon: 'shield-lock-outline', label: 'Sécurité', onPress: () => { } },
        { icon: 'help-circle-outline', label: 'Aide & Support', onPress: () => { } },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Avatar card */}
            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {(auth.userName || 'U').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <Text style={[FONTS.h3, { marginTop: SIZES.md }]}>{auth.userName || 'Étudiant'}</Text>
                <Text style={FONTS.body2}>{auth.userEmail || ''}</Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={FONTS.caption}>Notes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={FONTS.caption}>Quiz</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statValue}>0%</Text>
                    <Text style={FONTS.caption}>Score moy.</Text>
                </View>
            </View>

            {/* Menu */}
            <View style={styles.menu}>
                {menuItems.map((item, i) => (
                    <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                        <MaterialCommunityIcons name={item.icon as any} size={22} color={COLORS.primary} />
                        <Text style={[FONTS.body1, styles.menuLabel]}>{item.label}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
                <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
                <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SIZES.xl, paddingTop: 56, gap: SIZES.xl },
    profileCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.xl, alignItems: 'center', ...SHADOWS.sm },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 36, fontWeight: 'bold', color: COLORS.white },
    statsRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.sm },
    stat: { flex: 1, alignItems: 'center', padding: SIZES.md },
    statValue: { fontSize: SIZES.fontXl, fontWeight: 'bold', color: COLORS.primary },
    statDivider: { width: 1, backgroundColor: COLORS.border },
    menu: { backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.sm },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: SIZES.md, gap: SIZES.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    menuLabel: { flex: 1 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: COLORS.error },
    logoutText: { color: COLORS.error, fontSize: SIZES.fontMd, fontWeight: '600' },
});
