import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import { COLORS, SIZES, FONTS, SHADOWS } from '../theme';

const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (pwd.length === 0) return { level: 0, label: '', color: COLORS.border };
    if (pwd.length < 6) return { level: 1, label: 'Faible', color: COLORS.error };
    if (pwd.length < 10) return { level: 2, label: 'Moyen', color: COLORS.warning };
    return { level: 3, label: 'Fort', color: COLORS.success };
};

export default function RegisterScreen() {
    const { login } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const strength = getPasswordStrength(password);

    const handleRegister = async () => {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
            return;
        }
        if (password.length < 8) {
            Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        try {
            setLoading(true);
            console.log('🌐 Registering to:', `${API_URL}/auth/register`);
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password, full_name: fullName.trim() }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Erreur d'inscription");
            }
            await login(email.trim(), password);
            router.replace('/(tabs)/home');
        } catch (err: any) {
            Alert.alert("Inscription échouée", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={FONTS.h2}>Créer un compte</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputWrapper}>
                        <MaterialCommunityIcons name="account-outline" size={20} color={COLORS.textSecondary} style={styles.icon} />
                        <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor={COLORS.textPlaceholder} value={fullName} onChangeText={setFullName} />
                    </View>

                    <View style={styles.inputWrapper}>
                        <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.textSecondary} style={styles.icon} />
                        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.textPlaceholder} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                    </View>

                    <View style={styles.inputWrapper}>
                        <MaterialCommunityIcons name="lock-outline" size={20} color={COLORS.textSecondary} style={styles.icon} />
                        <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor={COLORS.textPlaceholder} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Strength bar */}
                    {password.length > 0 && (
                        <View>
                            <View style={styles.strengthBar}>
                                {[1, 2, 3].map(i => (
                                    <View key={i} style={[styles.strengthSegment, { backgroundColor: i <= strength.level ? strength.color : COLORS.surface }]} />
                                ))}
                            </View>
                            <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                        </View>
                    )}

                    <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                        {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Créer mon compte</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.back()} style={styles.linkRow}>
                        <Text style={FONTS.body2}>Déjà un compte ? </Text>
                        <Text style={[FONTS.body2, { color: COLORS.primary, fontWeight: '600' }]}>Se connecter</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scroll: { flexGrow: 1, padding: SIZES.xl, justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginBottom: SIZES.xxl },
    backBtn: { padding: 4 },
    form: { gap: SIZES.md },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, borderWidth: 1, borderColor: COLORS.border },
    icon: { marginRight: SIZES.sm },
    input: { flex: 1, height: 52, color: COLORS.textPrimary, fontSize: SIZES.fontMd },
    strengthBar: { flexDirection: 'row', gap: 6, marginTop: 4 },
    strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: SIZES.fontXs, marginTop: 4, fontWeight: '600' },
    button: { backgroundColor: COLORS.primary, height: 52, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', marginTop: SIZES.sm, ...SHADOWS.md },
    buttonText: { color: COLORS.white, fontSize: SIZES.fontMd, fontWeight: '700' },
    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SIZES.sm },
});
