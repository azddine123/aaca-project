import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors, useAppGradients, useAppearance } from '@/contexts/AppearanceContext';
import { SIZES, FONTS, SHADOWS } from '@/theme';
import { apiFetch } from '@/lib/api';

const RESEND_COOLDOWN_S = 60;

export default function VerifyEmailScreen() {
    const { applySession } = useAuth();
    const C = useAppColors();
    const G = useAppGradients();
    const { isDark } = useAppearance();
    const styles = useMemo(() => makeStyles(C), [C]);

    const params = useLocalSearchParams<{ email?: string }>();
    const email = (typeof params.email === 'string' ? params.email : '').trim().toLowerCase();

    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [otpFocused, setOtpFocused] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

    // Resend cooldown ticker
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown(c => c - 1), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    const handleVerify = async () => {
        setError('');
        if (otp.length !== 6) { setError('Le code doit contenir 6 chiffres.'); return; }
        setLoading(true);
        try {
            const data = await apiFetch('/auth/verify-email', {
                method: 'POST',
                json: { email, code: otp },
                fallbackError: 'Code invalide ou expiré.',
            });
            await applySession(data, email);
            router.replace('/(tabs)/home');
        } catch (e: any) {
            setError(e.message || 'Code invalide ou expiré.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0 || resending) return;
        setError('');
        setSuccess('');
        setResending(true);
        try {
            const data = await apiFetch('/auth/resend-verification', {
                method: 'POST',
                json: { email },
                fallbackError: "Erreur lors de l'envoi.",
            });
            setSuccess(data.message || 'Un nouveau code a été envoyé.');
            setCooldown(RESEND_COOLDOWN_S);
        } catch (e: any) {
            setError(e.message || 'Une erreur est survenue.');
        } finally {
            setResending(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <LinearGradient colors={G.hero} style={StyleSheet.absoluteFill} />

            {/* Back to login */}
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(auth)/login')}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={C.textSecondary} />
                <Text style={styles.backText}>Connexion</Text>
            </TouchableOpacity>

            {/* Card */}
            <View style={styles.card}>
                <View style={{ alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <View style={styles.iconCircle}>
                        <MaterialCommunityIcons name="email-check-outline" size={26} color={C.primary} />
                    </View>
                    <Text style={{ ...FONTS.h3, color: C.textPrimary, textAlign: 'center' }}>Confirmez votre email</Text>
                    <Text style={{ ...FONTS.body2, color: C.textSecondary, textAlign: 'center' }}>
                        {`Un code à 6 chiffres a été envoyé à ${email}`}
                    </Text>
                </View>

                {error ? (
                    <View style={styles.errorBox}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}
                {success ? (
                    <View style={styles.successBox}>
                        <MaterialCommunityIcons name="check-circle-outline" size={16} color={C.success} />
                        <Text style={styles.successText}>{success}</Text>
                    </View>
                ) : null}

                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Code de confirmation</Text>
                    <View style={[styles.inputWrapper, otpFocused && styles.inputFocused]}>
                        <MaterialCommunityIcons name="numeric" size={18} color={otpFocused ? C.primary : C.textMuted} />
                        <TextInput
                            style={[styles.input, styles.otpInput]}
                            placeholder="123456"
                            placeholderTextColor={C.textMuted}
                            value={otp}
                            onChangeText={t => { setOtp(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                            keyboardType="number-pad"
                            maxLength={6}
                            onFocus={() => setOtpFocused(true)}
                            onBlur={() => setOtpFocused(false)}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleVerify}
                    disabled={loading}
                    style={[styles.submitBtn, loading && styles.submitDisabled]}
                    activeOpacity={0.85}
                >
                    <LinearGradient colors={G.primary} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.submitText}>Confirmer et continuer</Text>
                        }
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleResend}
                    disabled={cooldown > 0 || resending}
                    style={styles.linkRow}
                >
                    {resending
                        ? <ActivityIndicator size="small" color={C.primary} />
                        : (
                            <Text style={[styles.linkHighlight, cooldown > 0 && { color: C.textMuted }]}>
                                {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
                            </Text>
                        )
                    }
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background, justifyContent: 'center', padding: SIZES.xl },

    backBtn: { position: 'absolute', top: 56, left: SIZES.xl, flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { ...FONTS.body2, color: C.textSecondary },

    card: { backgroundColor: C.surface, borderRadius: SIZES.borderRadiusXl, padding: SIZES.xl, gap: SIZES.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },

    iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },

    errorBox: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: C.error + '18', borderRadius: SIZES.borderRadiusSm, padding: SIZES.sm, borderWidth: 1, borderColor: C.error + '40' },
    errorText: { flex: 1, color: C.error, fontSize: SIZES.fontSm, lineHeight: 18 },

    successBox: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: C.success + '18', borderRadius: SIZES.borderRadiusSm, padding: SIZES.sm, borderWidth: 1, borderColor: C.success + '40' },
    successText: { flex: 1, color: C.success, fontSize: SIZES.fontSm, lineHeight: 18 },

    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 2 },

    inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, backgroundColor: C.surfaceMid, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, borderWidth: 1, borderColor: C.border, height: 52 },
    inputFocused: { borderColor: C.borderActive },
    input: { flex: 1, color: C.textPrimary, fontSize: SIZES.fontMd },
    otpInput: { letterSpacing: 8, fontSize: SIZES.fontLg ?? 20, fontWeight: '700' },

    submitBtn: { borderRadius: SIZES.borderRadius, overflow: 'hidden', marginTop: SIZES.xs, ...SHADOWS.primary },
    submitDisabled: { opacity: 0.6 },
    submitGrad: { height: 52, justifyContent: 'center', alignItems: 'center' },
    submitText: { color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' },

    linkRow: { alignItems: 'center', paddingTop: SIZES.xs, minHeight: 24, justifyContent: 'center' },
    linkHighlight: { fontSize: SIZES.fontSm, color: C.primary, fontWeight: '700' },
});
