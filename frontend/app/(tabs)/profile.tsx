import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useAppearance, useAppColors, type Theme } from '@/contexts/AppearanceContext';
import { SIZES, SHADOWS, GRADIENTS } from '@/theme';
import { API_URL } from '@/config/api';
import { AacaCard, StatusBadge } from '@/components/UIKit';
import { ZelligePattern } from '@/components/ZelligePattern';

type MenuItem = {
    icon: string;
    label: string;
    sub?: string;
    color?: string;
    onPress: () => void;
};

// ─── Theme Picker Modal ───────────────────────────────────────────────────────
function ThemeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { theme, setTheme } = useAppearance();
    const C = useAppColors();

    const options: { value: Theme; label: string; icon: string; desc: string }[] = [
        { value: 'dark',   label: 'Sombre',  icon: 'weather-night',    desc: 'Fond bleu foncé, idéal la nuit' },
        { value: 'light',  label: 'Clair',   icon: 'white-balance-sunny', desc: 'Fond blanc, confortable le jour' },
        { value: 'system', label: 'Système', icon: 'cellphone',        desc: 'Suit le réglage de votre téléphone' },
    ];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose} />
            <View style={[modal.sheet, { backgroundColor: C.surfaceMid, borderColor: C.border }]}>
                <View style={[modal.handle, { backgroundColor: C.border }]} />
                <Text style={[modal.title, { color: C.textPrimary }]}>Apparence</Text>
                {options.map((opt) => {
                    const active = theme === opt.value;
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            style={[modal.option, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary + '15' : C.surface }]}
                            onPress={() => { setTheme(opt.value); onClose(); }}
                            activeOpacity={0.8}
                        >
                            <View style={[modal.optionIcon, { backgroundColor: (active ? C.primary : C.textSecondary) + '20' }]}>
                                <MaterialCommunityIcons name={opt.icon as any} size={22} color={active ? C.primary : C.textSecondary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[modal.optionLabel, { color: C.textPrimary }]}>{opt.label}</Text>
                                <Text style={[modal.optionDesc, { color: C.textSecondary }]}>{opt.desc}</Text>
                            </View>
                            {active && <MaterialCommunityIcons name="check-circle" size={20} color={C.primary} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </Modal>
    );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { auth, authFetch, updateUserName } = useAuth();
    const C = useAppColors();
    const [name, setName] = useState(auth.userName || '');
    const [loading, setLoading] = useState(false);

    const save = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_URL}/user/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: trimmed }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as any).detail || 'Échec de la mise à jour');
            }
            await updateUserName(trimmed);
            Alert.alert('Succès', 'Profil mis à jour.');
            onClose();
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Impossible de mettre à jour le profil.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose} />
            <View style={[modal.sheet, { backgroundColor: C.surfaceMid, borderColor: C.border }]}>
                <View style={[modal.handle, { backgroundColor: C.border }]} />
                <Text style={[modal.title, { color: C.textPrimary }]}>Modifier le profil</Text>

                <Text style={[modal.inputLabel, { color: C.textSecondary }]}>Nom complet</Text>
                <TextInput
                    style={[modal.input, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Votre nom"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="words"
                />

                <Text style={[modal.inputLabel, { color: C.textSecondary, marginTop: SIZES.sm }]}>Email</Text>
                <View style={[modal.input, { backgroundColor: C.surfaceHigh, borderColor: C.border, justifyContent: 'center' }]}>
                    <Text style={{ color: C.textMuted }}>{auth.userEmail || '—'}</Text>
                </View>

                <TouchableOpacity
                    style={[modal.saveBtn, loading && { opacity: 0.6 }]}
                    onPress={save}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={modal.saveBtnText}>Enregistrer</Text>
                    }
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

// ─── Change Password Modal ────────────────────────────────────────────────────
function PasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { authFetch } = useAuth();
    const C = useAppColors();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [loading, setLoading] = useState(false);

    const save = async () => {
        if (!current || !next) { Alert.alert('Erreur', 'Remplissez les deux champs.'); return; }
        if (next.length < 6) { Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.'); return; }
        setLoading(true);
        try {
            await authFetch(`${API_URL}/user/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: current, new_password: next }),
            });
            Alert.alert('Succès', 'Mot de passe modifié.');
            setCurrent(''); setNext('');
            onClose();
        } catch {
            Alert.alert('Erreur', 'Mot de passe actuel incorrect ou serveur indisponible.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose} />
            <View style={[modal.sheet, { backgroundColor: C.surfaceMid, borderColor: C.border }]}>
                <View style={[modal.handle, { backgroundColor: C.border }]} />
                <Text style={[modal.title, { color: C.textPrimary }]}>Changer le mot de passe</Text>

                {[
                    { label: 'Mot de passe actuel', value: current, onChange: setCurrent },
                    { label: 'Nouveau mot de passe',  value: next,    onChange: setNext },
                ].map((field) => (
                    <View key={field.label}>
                        <Text style={[modal.inputLabel, { color: C.textSecondary }]}>{field.label}</Text>
                        <TextInput
                            style={[modal.input, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                            value={field.value}
                            onChangeText={field.onChange}
                            secureTextEntry
                            placeholder="••••••••"
                            placeholderTextColor={C.textMuted}
                        />
                    </View>
                ))}

                <TouchableOpacity
                    style={[modal.saveBtn, loading && { opacity: 0.6 }]}
                    onPress={save}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={modal.saveBtnText}>Modifier</Text>
                    }
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
    const { auth, logout } = useAuth();
    const { notes } = useNotes();
    const { theme } = useAppearance();
    const C = useAppColors();

    const [showTheme,    setShowTheme]    = useState(false);
    const [showEdit,     setShowEdit]     = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const themeLabel: Record<string, string> = { dark: 'Sombre', light: 'Clair', system: 'Système' };

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
    const subjectCount = new Set(notes.map((n: any) => n.subject).filter(Boolean)).size;
    const latestNote = notes[0];

    const sections: { title: string; items: MenuItem[] }[] = [
        {
            title: 'Compte',
            items: [
                {
                    icon: 'account-edit-outline',
                    label: 'Modifier le profil',
                    onPress: () => setShowEdit(true),
                },
                {
                    icon: 'bell-badge-outline',
                    label: 'Notifications',
                    sub: 'Activées',
                    onPress: () => Alert.alert('Notifications', 'Les notifications push seront disponibles prochainement.'),
                },
                {
                    icon: 'shield-lock-outline',
                    label: 'Sécurité',
                    sub: 'Mot de passe',
                    onPress: () => setShowPassword(true),
                },
            ],
        },
        {
            title: 'Application',
            items: [
                {
                    icon: 'palette-outline',
                    label: 'Apparence',
                    sub: themeLabel[theme] || 'Sombre',
                    onPress: () => setShowTheme(true),
                },
                {
                    icon: 'translate',
                    label: 'Langue',
                    sub: 'Français',
                    onPress: () => Alert.alert('Langue', 'D\'autres langues seront disponibles prochainement.\nActuellement : Français'),
                },
                {
                    icon: 'help-circle-outline',
                    label: 'Aide & Support',
                    onPress: () => Alert.alert('Aide & Support', 'Pour toute question :\n\n📧 support@aaca-app.com\n\nConsultez aussi la documentation dans vos notes de cours.'),
                },
                {
                    icon: 'information-outline',
                    label: 'À propos',
                    sub: 'v1.0.0',
                    onPress: () => Alert.alert('AACA — AI Academic Cognitive Assistant', 'Version 1.0.0\n\nTransformez vos cours en ressources pédagogiques interactives grâce à l\'IA.\n\n© 2026 AACA Project'),
                },
            ],
        },
    ];

    const styles = useMemo(() => makeStyles(C), [C]);

    return (
        <>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.profileCard}>
                    <View style={styles.profilePattern}>
                        <ZelligePattern color={C.primary} opacity={1} tileSize={30} cols={8} rows={5} />
                    </View>
                    <LinearGradient colors={GRADIENTS.primary} style={styles.avatar}>
                        <Text style={styles.avatarText}>{initial}</Text>
                    </LinearGradient>
                    <StatusBadge label="Espace étudiant" tone="info" icon="school-outline" />
                    <Text style={styles.userName}>{auth.userName || 'Étudiant'}</Text>
                    <Text style={styles.userEmail}>{auth.userEmail || ''}</Text>

                    <View style={styles.statsRow}>
                        <StatBadge icon="notebook-multiple" value={notes.length} label="Notes"  color={C.primary} C={C} />
                        <View style={styles.statsDivider} />
                        <StatBadge icon="shape-outline" value={subjectCount || '—'} label="Matières" color={C.accent} C={C} />
                        <View style={styles.statsDivider} />
                        <StatBadge icon="clock-outline" value={latestNote ? 'Actif' : '—'} label="Statut" color={C.success} C={C} />
                    </View>
                </View>

                <AacaCard style={styles.studyCard}>
                    <View style={[styles.studyIcon, { backgroundColor: C.primary + '14' }]}>
                        <MaterialCommunityIcons name="notebook-check-outline" size={22} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.studyTitle}>Carnet académique</Text>
                        <Text style={styles.studySub} numberOfLines={2}>
                            {latestNote ? `Dernière note : ${latestNote.title}` : 'Vos prochaines captures apparaîtront ici.'}
                        </Text>
                    </View>
                </AacaCard>

                {/* ── Achievement chips ── */}
                <View style={styles.achieveRow}>
                    <AchieveBadge icon="star-shooting" label="Premier cours" color={C.warning}  unlocked={notes.length > 0} C={C} />
                    <AchieveBadge icon="fire"           label="Streak 7j"    color={C.error}    unlocked={false} C={C} />
                    <AchieveBadge icon="school"         label="Quiz 80%"     color={C.success}  unlocked={false} C={C} />
                    <AchieveBadge icon="brain"          label="Expert"       color={C.primary}  unlocked={false} C={C} />
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
                                    <View style={[styles.menuIcon, { backgroundColor: (item.color || C.primary) + '20' }]}>
                                        <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color || C.primary} />
                                    </View>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    <View style={styles.menuRight}>
                                        {item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
                                        <MaterialCommunityIcons name="chevron-right" size={16} color={C.textMuted} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* ── Logout ── */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
                    <MaterialCommunityIcons name="logout-variant" size={18} color={C.error} />
                    <Text style={styles.logoutText}>Se déconnecter</Text>
                </TouchableOpacity>

                <View style={{ height: 32 }} />
            </ScrollView>

            <ThemeModal    visible={showTheme}    onClose={() => setShowTheme(false)} />
            <EditProfileModal visible={showEdit}  onClose={() => setShowEdit(false)} />
            <PasswordModal visible={showPassword} onClose={() => setShowPassword(false)} />
        </>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ icon, value, label, color, C }: { icon: string; value: any; label: string; color: string; C: any }) {
    return (
        <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <MaterialCommunityIcons name={icon as any} size={14} color={color} />
            <Text style={{ fontSize: SIZES.fontXl, fontWeight: '700', color }}>{value}</Text>
            <Text style={{ fontSize: SIZES.fontXs, color: C.textMuted }}>{label}</Text>
        </View>
    );
}

function AchieveBadge({ icon, label, color, unlocked, C }: { icon: string; label: string; color: string; unlocked: boolean; C: any }) {
    return (
        <View style={{
            flex: 1, alignItems: 'center', gap: 5,
            backgroundColor: C.surface, borderRadius: SIZES.borderRadius,
            padding: SIZES.sm, borderWidth: 1, borderColor: C.border,
            opacity: unlocked ? 1 : 0.45,
        }}>
            <MaterialCommunityIcons name={icon as any} size={20} color={unlocked ? color : C.textMuted} />
            <Text style={{ fontSize: 9, fontWeight: '700', color: unlocked ? C.textSecondary : C.textMuted, textAlign: 'center' }}>{label}</Text>
        </View>
    );
}

// ─── Styles factory ───────────────────────────────────────────────────────────

const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { padding: SIZES.xl, paddingTop: 56, gap: SIZES.xl },

    profileCard: {
        borderRadius: SIZES.borderRadius,
        padding: SIZES.xl,
        alignItems: 'center',
        gap: SIZES.sm,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
        overflow: 'hidden',
        ...SHADOWS.md,
    },
    profilePattern: { position: 'absolute', right: -34, top: -24, width: 230, height: 160, opacity: 0.07 },
    avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary },
    avatarText: { fontSize: 34, fontWeight: '800', color: '#fff' },
    userName: { fontSize: SIZES.fontXl, fontWeight: '800', color: C.textPrimary, marginTop: 4 },
    userEmail: { fontSize: SIZES.fontSm, color: C.textSecondary },

    statsRow: { flexDirection: 'row', marginTop: SIZES.sm, width: '100%' },
    statsDivider: { width: 1, backgroundColor: C.border },

    studyCard: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    studyIcon: { width: 46, height: 46, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center' },
    studyTitle: { fontSize: SIZES.fontMd, color: C.textPrimary, fontWeight: '800' },
    studySub: { fontSize: SIZES.fontXs, color: C.textSecondary, lineHeight: 18, marginTop: 2 },

    achieveRow: { flexDirection: 'row', gap: SIZES.sm },

    menuSection: { gap: SIZES.sm },
    sectionTitle: { fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0, paddingLeft: 4 },
    menuCard: { backgroundColor: C.surface, borderRadius: SIZES.borderRadius, overflow: 'hidden', borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, padding: SIZES.md },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    menuIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    menuLabel: { flex: 1, fontSize: SIZES.fontMd, color: C.textPrimary },
    menuRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    menuSub: { fontSize: SIZES.fontXs, color: C.textMuted },

    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: C.error + '15', borderRadius: SIZES.borderRadius, padding: SIZES.md + 2, borderWidth: 1, borderColor: C.error + '40' },
    logoutText: { color: C.error, fontSize: SIZES.fontMd, fontWeight: '700' },
});

// ─── Modal shared styles ──────────────────────────────────────────────────────

const modal = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.xl, paddingBottom: 40, gap: SIZES.md, borderWidth: 1 },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: SIZES.sm },
    title: { fontSize: SIZES.fontXl, fontWeight: '700', marginBottom: SIZES.sm },

    option: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, padding: SIZES.md, borderRadius: SIZES.borderRadius, borderWidth: 1.5 },
    optionIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    optionLabel: { fontSize: SIZES.fontMd, fontWeight: '600' },
    optionDesc: { fontSize: SIZES.fontXs, marginTop: 2 },

    inputLabel: { fontSize: SIZES.fontSm, fontWeight: '600', marginBottom: 4 },
    input: { height: 48, borderRadius: SIZES.borderRadius, borderWidth: 1, paddingHorizontal: SIZES.md, fontSize: SIZES.fontMd },

    saveBtn: { backgroundColor: '#6366F1', height: 50, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', marginTop: SIZES.sm },
    saveBtnText: { color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' },
});
