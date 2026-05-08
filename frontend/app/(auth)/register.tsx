import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/api';
import { COLORS, SIZES, FONTS, SHADOWS, GRADIENTS } from '@/theme';

type Strength = { level: 0 | 1 | 2 | 3; label: string; color: string };

function getStrength(pwd: string): Strength {
    if (!pwd) return { level: 0, label: '', color: COLORS.border };
    if (pwd.length < 6) return { level: 1, label: 'Trop court', color: COLORS.error };
    if (pwd.length < 10 || !/[0-9]/.test(pwd)) return { level: 2, label: 'Moyen', color: COLORS.warning };
    return { level: 3, label: 'Fort', color: COLORS.success };
}

export default function RegisterScreen() {
    const { login } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [nameFocused, setNameFocused] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [pwFocused, setPwFocused] = useState(false);

    const strength = getStrength(password);

    const handleRegister = async () => {
        setError('');
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        if (password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password, full_name: fullName.trim() }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                const detail = Array.isArray(data.detail)
                    ? data.detail.map((e: any) => e.msg).join(', ')
                    : data.detail;
                throw new Error(detail || "Erreur lors de l'inscription");
            }
            await login(email.trim(), password);
            router.replace('/(tabs)/home');
        } catch (err: any) {
            setError(err.message || "Une erreur est survenue.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <LinearGradient colors={['#0A0E1F', '#07091A']} style={StyleSheet.absoluteFill} />

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Header row */}
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Logo small */}
                <View style={styles.logoRow}>
                    <LinearGradient colors={GRADIENTS.primary} style={styles.logoSmall}>
                        <Text style={styles.logoLetter}>A</Text>
                    </LinearGradient>
                    <Text style={styles.appName}>AACA</Text>
                </View>

                <Text style={styles.title}>Créer un compte</Text>
                <Text style={[FONTS.body2, { marginBottom: SIZES.xl }]}>
                    Rejoignez des milliers d'étudiants qui étudient mieux.
                </Text>

                {error ? (
                    <View style={styles.errorBox}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLORS.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Full name */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Nom complet</Text>
                    <View style={[styles.inputWrapper, nameFocused && styles.inputFocused]}>
                        <MaterialCommunityIcons name="account-outline" size={18} color={nameFocused ? COLORS.primary : COLORS.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="Prénom Nom"
                            placeholderTextColor={COLORS.textPlaceholder}
                            value={fullName}
                            onChangeText={t => { setFullName(t); setError(''); }}
                            onFocus={() => setNameFocused(true)}
                            onBlur={() => setNameFocused(false)}
                        />
                    </View>
                </View>

                {/* Email */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
                        <MaterialCommunityIcons name="email-outline" size={18} color={emailFocused ? COLORS.primary : COLORS.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="votre@email.com"
                            placeholderTextColor={COLORS.textPlaceholder}
                            value={email}
                            onChangeText={t => { setEmail(t); setError(''); }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            onFocus={() => setEmailFocused(true)}
                            onBlur={() => setEmailFocused(false)}
                        />
                    </View>
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Mot de passe</Text>
                    <View style={[styles.inputWrapper, pwFocused && styles.inputFocused]}>
                        <MaterialCommunityIcons name="lock-outline" size={18} color={pwFocused ? COLORS.primary : COLORS.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="8 caractères minimum"
                            placeholderTextColor={COLORS.textPlaceholder}
                            value={password}
                            onChangeText={t => { setPassword(t); setError(''); }}
                            secureTextEntry={!showPassword}
                            onFocus={() => setPwFocused(true)}
                            onBlur={() => setPwFocused(false)}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <MaterialCommunityIcons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={18}
                                color={COLORS.textMuted}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Strength indicator */}
                    {password.length > 0 && (
                        <View style={styles.strengthRow}>
                            {[1, 2, 3].map(i => (
                                <View
                                    key={i}
                                    style={[styles.strengthSeg, { backgroundColor: i <= strength.level ? strength.color : COLORS.surfaceHigh }]}
                                />
                            ))}
                            <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                        </View>
                    )}
                </View>

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.submitBtn, loading && styles.submitDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {loading
                            ? <ActivityIndicator color={COLORS.white} />
                            : <Text style={styles.submitText}>Créer mon compte</Text>
                        }
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.back()} style={styles.linkRow}>
                    <Text style={styles.linkText}>Déjà un compte ? </Text>
                    <Text style={styles.linkHighlight}>Se connecter</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },
    scroll: { flexGrow: 1, padding: SIZES.xl, justifyContent: 'center', paddingTop: SIZES.xxxl },

    topRow: { marginBottom: SIZES.xl },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },

    logoRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginBottom: SIZES.xl },
    logoSmall: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    logoLetter: { fontSize: 20, fontWeight: '900', color: COLORS.white },
    appName: { fontSize: SIZES.fontXl, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 4 },

    title: { ...FONTS.h2, marginBottom: SIZES.xs },

    errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.xs, backgroundColor: COLORS.error + '18', borderRadius: SIZES.borderRadiusSm, padding: SIZES.sm, borderWidth: 1, borderColor: COLORS.error + '40', marginBottom: SIZES.sm },
    errorText: { flex: 1, color: COLORS.error, fontSize: SIZES.fontSm, lineHeight: 18 },

    fieldGroup: { gap: 6, marginBottom: SIZES.sm },
    fieldLabel: { ...FONTS.label, paddingLeft: 2 },

    inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, borderWidth: 1, borderColor: COLORS.border, height: 52 },
    inputFocused: { borderColor: COLORS.borderActive },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.fontMd },

    strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    strengthSeg: { flex: 1, height: 3, borderRadius: 2 },
    strengthLabel: { fontSize: SIZES.fontXs, fontWeight: '700', minWidth: 60 },

    submitBtn: { borderRadius: SIZES.borderRadius, overflow: 'hidden', marginTop: SIZES.md, ...SHADOWS.primary },
    submitDisabled: { opacity: 0.6 },
    submitGrad: { height: 52, justifyContent: 'center', alignItems: 'center' },
    submitText: { color: COLORS.white, fontSize: SIZES.fontMd, fontWeight: '700' },

    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SIZES.lg },
    linkText: { ...FONTS.body2 },
    linkHighlight: { fontSize: SIZES.fontSm, color: COLORS.primary, fontWeight: '700' },
});
