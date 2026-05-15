import React, { useState, useMemo, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors, useAppGradients, useAppearance } from '@/contexts/AppearanceContext';
import { SIZES, FONTS, SHADOWS } from '@/theme';
import { API_URL } from '@/config/api';

// ----- types ----------------------------------------------------------------

type Step = 'email' | 'otp' | 'password';

interface StepHeaderProps {
    icon: string;
    title: string;
    subtitle: string;
    C: any;
}

// ----- tiny sub-components --------------------------------------------------

function StepHeader({ icon, title, subtitle, C }: StepHeaderProps) {
    return (
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: C.primary + '20',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <MaterialCommunityIcons name={icon as any} size={26} color={C.primary} />
            </View>
            <Text style={{ ...FONTS.h3, color: C.textPrimary, textAlign: 'center' }}>{title}</Text>
            <Text style={{ ...FONTS.body2, color: C.textSecondary, textAlign: 'center' }}>{subtitle}</Text>
        </View>
    );
}

// ----- main screen ----------------------------------------------------------

export default function ForgotPasswordScreen() {
    const C = useAppColors();
    const G = useAppGradients();
    const { isDark } = useAppearance();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [step, setStep] = useState<Step>('email');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // form values
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // focus states
    const [emailFocused, setEmailFocused] = useState(false);
    const [otpFocused, setOtpFocused] = useState(false);
    const [pw1Focused, setPw1Focused] = useState(false);
    const [pw2Focused, setPw2Focused] = useState(false);

    // ── Step 1: request OTP ──────────────────────────────────────────────────

    const handleRequestOtp = async () => {
        setError('');
        if (!email.trim()) { setError('Veuillez saisir votre adresse email.'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Erreur lors de l\'envoi.');
            setSuccess(data.message || 'Code envoyé.');
            setStep('otp');
        } catch (e: any) {
            setError(e.message || 'Une erreur est survenue.');
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: verify OTP ───────────────────────────────────────────────────

    const handleVerifyOtp = async () => {
        setError('');
        if (otp.length !== 6) { setError('Le code doit contenir 6 chiffres.'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/verify-reset-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Code invalide ou expiré.');
            if (data.verified) {
                setSuccess('');
                setStep('password');
            }
        } catch (e: any) {
            setError(e.message || 'Code invalide ou expiré.');
        } finally {
            setLoading(false);
        }
    };

    // ── Step 3: reset password ───────────────────────────────────────────────

    const handleResetPassword = async () => {
        setError('');
        if (newPassword.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
        if (newPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code: otp,
                    new_password: newPassword,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Erreur lors de la réinitialisation.');
            // Success — go back to login with a param so it can show a banner
            router.replace({ pathname: '/(auth)/login', params: { resetSuccess: '1' } });
        } catch (e: any) {
            setError(e.message || 'Une erreur est survenue.');
        } finally {
            setLoading(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <LinearGradient colors={G.hero} style={StyleSheet.absoluteFill} />

            {/* Back button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={C.textSecondary} />
                <Text style={styles.backText}>Retour</Text>
            </TouchableOpacity>

            {/* Step indicators */}
            <View style={styles.stepRow}>
                {(['email', 'otp', 'password'] as Step[]).map((s, i) => (
                    <View key={s} style={styles.stepDotRow}>
                        <View style={[
                            styles.stepDot,
                            step === s && styles.stepDotActive,
                            ['otp', 'password'].includes(step) && s === 'email' && styles.stepDotDone,
                            step === 'password' && s === 'otp' && styles.stepDotDone,
                        ]} />
                        {i < 2 && <View style={styles.stepLine} />}
                    </View>
                ))}
            </View>

            {/* Card */}
            <View style={styles.card}>

                {/* ── Step 1: email ── */}
                {step === 'email' && (
                    <>
                        <StepHeader
                            C={C}
                            icon="email-lock-outline"
                            title="Mot de passe oublié ?"
                            subtitle="Saisissez votre email pour recevoir un code de vérification."
                        />

                        {error ? <ErrorBox msg={error} C={C} styles={styles} /> : null}
                        {success ? <SuccessBox msg={success} C={C} styles={styles} /> : null}

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Adresse email</Text>
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

                        <SubmitBtn label="Envoyer le code" loading={loading} onPress={handleRequestOtp} G={G} styles={styles} />
                    </>
                )}

                {/* ── Step 2: OTP ── */}
                {step === 'otp' && (
                    <>
                        <StepHeader
                            C={C}
                            icon="shield-check-outline"
                            title="Vérification"
                            subtitle={`Un code à 6 chiffres a été envoyé à ${email}`}
                        />

                        {error ? <ErrorBox msg={error} C={C} styles={styles} /> : null}

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Code de vérification</Text>
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

                        <SubmitBtn label="Vérifier le code" loading={loading} onPress={handleVerifyOtp} G={G} styles={styles} />

                        <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); setError(''); }} style={styles.linkRow}>
                            <Text style={styles.linkHighlight}>← Changer d'adresse email</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* ── Step 3: new password ── */}
                {step === 'password' && (
                    <>
                        <StepHeader
                            C={C}
                            icon="lock-reset"
                            title="Nouveau mot de passe"
                            subtitle="Choisissez un mot de passe sécurisé (8 caractères minimum)."
                        />

                        {error ? <ErrorBox msg={error} C={C} styles={styles} /> : null}

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
                            <View style={[styles.inputWrapper, pw1Focused && styles.inputFocused]}>
                                <MaterialCommunityIcons name="lock-outline" size={18} color={pw1Focused ? C.primary : C.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor={C.textMuted}
                                    value={newPassword}
                                    onChangeText={t => { setNewPassword(t); setError(''); }}
                                    secureTextEntry={!showPw}
                                    onFocus={() => setPw1Focused(true)}
                                    onBlur={() => setPw1Focused(false)}
                                />
                                <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <MaterialCommunityIcons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Confirmer le mot de passe</Text>
                            <View style={[styles.inputWrapper, pw2Focused && styles.inputFocused]}>
                                <MaterialCommunityIcons name="lock-check-outline" size={18} color={pw2Focused ? C.primary : C.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor={C.textMuted}
                                    value={confirmPassword}
                                    onChangeText={t => { setConfirmPassword(t); setError(''); }}
                                    secureTextEntry={!showConfirm}
                                    onFocus={() => setPw2Focused(true)}
                                    onBlur={() => setPw2Focused(false)}
                                />
                                <TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <MaterialCommunityIcons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <SubmitBtn label="Réinitialiser le mot de passe" loading={loading} onPress={handleResetPassword} G={G} styles={styles} />
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

// ----- shared tiny components -----------------------------------------------

function ErrorBox({ msg, C, styles }: { msg: string; C: any; styles: any }) {
    return (
        <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={styles.errorText}>{msg}</Text>
        </View>
    );
}

function SuccessBox({ msg, C, styles }: { msg: string; C: any; styles: any }) {
    return (
        <View style={styles.successBox}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={C.success} />
            <Text style={styles.successText}>{msg}</Text>
        </View>
    );
}

function SubmitBtn({ label, loading, onPress, G, styles }: { label: string; loading: boolean; onPress: () => void; G: any; styles: any }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading}
            style={[styles.submitBtn, loading && styles.submitDisabled]}
            activeOpacity={0.85}
        >
            <LinearGradient colors={G.primary} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitText}>{label}</Text>
                }
            </LinearGradient>
        </TouchableOpacity>
    );
}

// ----- styles ---------------------------------------------------------------

const makeStyles = (C: any) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background, justifyContent: 'center', padding: SIZES.xl },

    backBtn: { position: 'absolute', top: 56, left: SIZES.xl, flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { ...FONTS.body2, color: C.textSecondary },

    stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.xl, gap: 0 },
    stepDotRow: { flexDirection: 'row', alignItems: 'center' },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border },
    stepDotActive: { backgroundColor: C.primary, width: 12, height: 12, borderRadius: 6 },
    stepDotDone: { backgroundColor: C.success },
    stepLine: { width: 32, height: 2, backgroundColor: C.border, marginHorizontal: 4 },

    card: { backgroundColor: C.surface, borderRadius: SIZES.borderRadiusXl, padding: SIZES.xl, gap: SIZES.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },

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

    linkRow: { alignItems: 'center', paddingTop: SIZES.xs },
    linkHighlight: { fontSize: SIZES.fontSm, color: C.primary, fontWeight: '700' },
});
