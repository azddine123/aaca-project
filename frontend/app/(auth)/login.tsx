import React, { useState, useMemo } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors, useAppGradients, useAppearance } from '@/contexts/AppearanceContext';
import { SIZES, FONTS, SHADOWS } from '@/theme';

export default function LoginScreen() {
    const { login } = useAuth();
    const C = useAppColors();
    const G = useAppGradients();
    const { isDark } = useAppearance();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailFocused, setEmailFocused] = useState(false);
    const [pwFocused, setPwFocused] = useState(false);

    const handleLogin = async () => {
        setError('');
        if (!email.trim() || !password.trim()) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        try {
            setLoading(true);
            await login(email.trim(), password);
            router.replace('/(tabs)/home');
        } catch (err: any) {
            setError(err.message || 'Email ou mot de passe incorrect.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <LinearGradient colors={G.hero} style={StyleSheet.absoluteFill} />

            {/* Logo section */}
            <View style={styles.logoSection}>
                <View style={styles.logoCircleWrap}>
                    <LinearGradient colors={G.primary} style={styles.logoCircle}>
                        <Text style={styles.logoLetter}>A</Text>
                    </LinearGradient>
                </View>
                <Text style={styles.appName}>AACA</Text>
                <Text style={styles.tagline}>AI Academic Cognitive Assistant</Text>
            </View>

            {/* Form card */}
            <View style={styles.card}>
                <Text style={styles.formTitle}>Connexion</Text>
                <Text style={styles.formSub}>Bon retour ! Continuez là où vous vous êtes arrêté.</Text>

                {error ? (
                    <View style={styles.errorBox}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Email */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
                        <MaterialCommunityIcons name="email-outline" size={18} color={emailFocused ? C.primary : C.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="votre@email.com"
                            placeholderTextColor={C.textMuted}
                            value={email}
                            onChangeText={t => { setEmail(t); setError(''); }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            onFocus={() => setEmailFocused(true)}
                            onBlur={() => setEmailFocused(false)}
                        />
                    </View>
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Mot de passe</Text>
                    <View style={[styles.inputWrapper, pwFocused && styles.inputFocused]}>
                        <MaterialCommunityIcons name="lock-outline" size={18} color={pwFocused ? C.primary : C.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor={C.textMuted}
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
                                color={C.textMuted}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Submit */}
                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    style={[styles.submitBtn, loading && styles.submitDisabled]}
                    activeOpacity={0.85}
                >
                    <LinearGradient colors={G.primary} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.submitText}>Se connecter</Text>
                        }
                    </LinearGradient>
                </TouchableOpacity>

                {/* Link */}
                <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkRow}>
                    <Text style={styles.linkText}>Pas encore de compte ? </Text>
                    <Text style={styles.linkHighlight}>Créer un compte</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background, justifyContent: 'center', padding: SIZES.xl },

    logoSection: { alignItems: 'center', marginBottom: SIZES.xxl + 4, gap: SIZES.sm },
    logoCircleWrap: { ...SHADOWS.primary },
    logoCircle: { width: 76, height: 76, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    logoLetter: { fontSize: 38, fontWeight: '900', color: '#fff' },
    appName: { fontSize: SIZES.fontXXl, fontWeight: '900', color: C.textPrimary, letterSpacing: 6 },
    tagline: { ...FONTS.body2, color: C.textSecondary, textAlign: 'center' },

    card: { backgroundColor: C.surface, borderRadius: SIZES.borderRadiusXl, padding: SIZES.xl, gap: SIZES.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },
    formTitle: { ...FONTS.h3, color: C.textPrimary },
    formSub: { ...FONTS.body2, color: C.textSecondary, marginTop: -SIZES.xs },

    errorBox: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: C.error + '18', borderRadius: SIZES.borderRadiusSm, padding: SIZES.sm, borderWidth: 1, borderColor: C.error + '40' },
    errorText: { flex: 1, color: C.error, fontSize: SIZES.fontSm, lineHeight: 18 },

    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 2 },

    inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, backgroundColor: C.surfaceMid, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, borderWidth: 1, borderColor: C.border, height: 52 },
    inputFocused: { borderColor: C.borderActive },
    input: { flex: 1, color: C.textPrimary, fontSize: SIZES.fontMd },

    submitBtn: { borderRadius: SIZES.borderRadius, overflow: 'hidden', marginTop: SIZES.xs, ...SHADOWS.primary },
    submitDisabled: { opacity: 0.6 },
    submitGrad: { height: 52, justifyContent: 'center', alignItems: 'center' },
    submitText: { color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' },

    linkRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: SIZES.xs },
    linkText: { ...FONTS.body2, color: C.textSecondary },
    linkHighlight: { fontSize: SIZES.fontSm, color: C.primary, fontWeight: '700' },
});
