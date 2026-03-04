import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, SIZES, FONTS, SHADOWS } from '../theme';

export default function LoginScreen() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
            return;
        }
        try {
            setLoading(true);
            await login(email.trim(), password);
            router.replace('/(tabs)/home');
        } catch (err: any) {
            Alert.alert('Connexion échouée', err.message || 'Email ou mot de passe incorrect.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Logo */}
            <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>A</Text>
                </View>
                <Text style={styles.appName}>AACA</Text>
                <Text style={styles.tagline}>AI Academic Cognitive Assistant</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
                <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={COLORS.textPlaceholder}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Mot de passe"
                        placeholderTextColor={COLORS.textPlaceholder}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <MaterialCommunityIcons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={COLORS.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <ActivityIndicator color={COLORS.white} />
                        : <Text style={styles.buttonText}>Se connecter</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkRow}>
                    <Text style={styles.linkText}>Pas encore de compte ? </Text>
                    <Text style={[styles.linkText, styles.linkHighlight]}>S'inscrire</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        padding: SIZES.xl,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: SIZES.xxl,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SIZES.md,
        ...SHADOWS.md,
    },
    logoText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    appName: {
        ...FONTS.h1,
        color: COLORS.primary,
        letterSpacing: 4,
    },
    tagline: {
        ...FONTS.body2,
        marginTop: 4,
        textAlign: 'center',
    },
    form: {
        gap: SIZES.md,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.borderRadius,
        paddingHorizontal: SIZES.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputIcon: {
        marginRight: SIZES.sm,
    },
    input: {
        flex: 1,
        height: 52,
        color: COLORS.textPrimary,
        fontSize: SIZES.fontMd,
    },
    button: {
        backgroundColor: COLORS.primary,
        height: 52,
        borderRadius: SIZES.borderRadius,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SIZES.sm,
        ...SHADOWS.md,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: SIZES.fontMd,
        fontWeight: '700',
    },
    linkRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: SIZES.sm,
    },
    linkText: {
        ...FONTS.body2,
    },
    linkHighlight: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});
