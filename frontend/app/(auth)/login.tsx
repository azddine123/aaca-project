import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, SIZES, FONTS, SHADOWS, GRADIENTS } from '@/theme';

export default function LoginScreen() {
    const { login } = useAuth();
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
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#0A0E1F', '#07091A']} style={styles.bg} />

            {/* Logo section */}
            <View style={styles.logoSection}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.logoCircle}>
                    <Text style={styles.logoLetter}>A</Text>
                </LinearGradient>
                <Text style={styles.appName}>AACA</Text>
                <Text style={styles.tagline}>AI Academic Cognitive Assistant</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
                <Text style={styles.formTitle}>Connexion</Text>

                {error ? (
                    <View style={styles.errorBox}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLORS.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Email */}
                <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
                    <MaterialCommunityIcons name="email-outline" size={18} color={emailFocused ? COLORS.primary : COLORS.textMuted} />
                    <TextInput
                        style={styles.input}
                        placeholder="Adresse email"
                        placeholderTextColor={COLORS.textPlaceholder}
                        value={email}
                        onChangeText={t => { setEmail(t); setError(''); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                    />
                </View>

                {/* Password */}
                <View style={[styles.inputWrapper, pwFocused && styles.inputFocused]}>
                    <MaterialCommunityIcons name="lock-outline" size={18} color={pwFocused ? COLORS.primary : COLORS.textMuted} />
                    <TextInput
                        style={styles.input}
                        placeholder="Mot de passe"
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

                {/* Submit */}
                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    style={[styles.submitBtn, loading && styles.submitDisabled]}
                    activeOpacity={0.85}
                >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {loading
                            ? <ActivityIndicator color={COLORS.white} />
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

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: SIZES.xl },
    bg: { ...StyleSheet.absoluteFillObject },

    logoSection: { alignItems: 'center', marginBottom: SIZES.xxl + 8, gap: SIZES.sm },
    logoCircle: { width: 76, height: 76, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary },
    logoLetter: { fontSize: 38, fontWeight: '900', color: COLORS.white },
    appName: { fontSize: SIZES.fontXXl, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 6 },
    tagline: { ...FONTS.body2, textAlign: 'center' },

    form: { gap: SIZES.md },
    formTitle: { ...FONTS.h3, marginBottom: SIZES.xs },

    errorBox: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: COLORS.error + '18', borderRadius: SIZES.borderRadiusSm, padding: SIZES.sm, borderWidth: 1, borderColor: COLORS.error + '40' },
    errorText: { flex: 1, color: COLORS.error, fontSize: SIZES.fontSm, lineHeight: 18 },

    inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, borderWidth: 1, borderColor: COLORS.border, height: 52 },
    inputFocused: { borderColor: COLORS.borderActive },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.fontMd },

    submitBtn: { borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.primary },
    submitDisabled: { opacity: 0.6 },
    submitGrad: { height: 52, justifyContent: 'center', alignItems: 'center' },
    submitText: { color: COLORS.white, fontSize: SIZES.fontMd, fontWeight: '700' },

    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SIZES.xs },
    linkText: { ...FONTS.body2 },
    linkHighlight: { fontSize: SIZES.fontSm, color: COLORS.primary, fontWeight: '700' },
});
