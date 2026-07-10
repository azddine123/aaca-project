import React, { useState, useMemo } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { AppLogo } from '@/components/AppLogo';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { apiFetch } from '@/lib/api';
import { SIZES, FONTS, SHADOWS } from '@/theme';

type Strength = { level: 0 | 1 | 2 | 3; label: string; color: string };

function getStrength(pwd: string, C: any): Strength {
    if (!pwd) return { level: 0, label: '', color: C.border };
    if (pwd.length < 6) return { level: 1, label: 'Trop court', color: C.error };
    if (pwd.length < 10 || !/[0-9]/.test(pwd)) return { level: 2, label: 'Moyen', color: C.warning };
    return { level: 3, label: 'Fort', color: C.success };
}

const PRIVACY_POLICY_VERSION = '2026-05-v1';

const PRIVACY_POLICY_TEXT = `POLITIQUE DE CONFIDENTIALITÉ — PicLearn
Version ${PRIVACY_POLICY_VERSION} — Mai 2026

1. DONNÉES COLLECTÉES
Nous collectons les données suivantes :
• Identité : email, nom complet, institution (optionnel)
• Contenu pédagogique : images de cours, texte extrait par OCR, notes structurées, résumés
• Activité : quiz, flashcards, résultats, progression académique, captures

2. FINALITÉS DU TRAITEMENT
• Authentification et gestion de votre compte
• Génération de notes, quiz et flashcards via IA/OCR
• Suivi de votre progression pédagogique personnalisée
• Amélioration de la qualité du service

3. INTELLIGENCE ARTIFICIELLE ET OCR
Vos images et textes sont traités par des services OCR et des modèles de langage (LLM) pour extraire et structurer le contenu. Ces traitements sont effectués dans le cadre contractuel du service.

4. VOS DROITS
Conformément au RGPD, vous disposez des droits suivants :
• Accès : consulter toutes vos données via Profil → Exporter mes données
• Portabilité : télécharger vos données au format JSON
• Suppression : supprimer intégralement votre compte et données via Profil → Supprimer mon compte
• Rectification : modifier vos informations dans les paramètres du profil

5. DURÉE DE CONSERVATION
• Données de compte et notes : 365 jours après la dernière activité
• Images capturées : 90 jours après la capture
• Vous pouvez supprimer votre compte à tout moment

6. SÉCURITÉ
Vos mots de passe sont hachés (bcrypt). Les communications sont chiffrées (HTTPS). Les accès sont contrôlés par tokens JWT à durée limitée.

7. SOUS-TRAITANTS
• Base de données : MongoDB (stockage local ou hébergé)
• IA/OCR : PaddleOCR, OpenAI, Anthropic (traitement des images et textes)

8. CONTACT
Pour toute question : support@piclearn-app.com`;

function PrivacyPolicyModal({ visible, onClose, C }: { visible: boolean; onClose: () => void; C: any }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[privacyModal.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <View style={[privacyModal.sheet, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <View style={[privacyModal.header, { borderBottomColor: C.border }]}>
                        <Text style={[privacyModal.title, { color: C.textPrimary }]}>Politique de confidentialité</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <MaterialCommunityIcons name="close" size={22} color={C.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={privacyModal.body} showsVerticalScrollIndicator={false}>
                        <Text style={[privacyModal.text, { color: C.textSecondary }]}>{PRIVACY_POLICY_TEXT}</Text>
                        <View style={{ height: 24 }} />
                    </ScrollView>
                    <TouchableOpacity
                        style={[privacyModal.closeBtn, { backgroundColor: C.primary }]}
                        onPress={onClose}
                        activeOpacity={0.85}
                    >
                        <Text style={privacyModal.closeBtnText}>J'ai compris</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

export default function RegisterScreen() {
    const C = useAppColors();
    const G = useAppGradients();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [privacyConsent, setPrivacyConsent] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [nameFocused, setNameFocused] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [pwFocused, setPwFocused] = useState(false);

    const strength = getStrength(password, C);

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
        if (!privacyConsent) {
            setError('Vous devez accepter la politique de confidentialité pour créer un compte.');
            return;
        }
        try {
            setLoading(true);
            await apiFetch('/auth/register', {
                method: 'POST',
                json: {
                    email: email.trim(),
                    password,
                    full_name: fullName.trim(),
                    privacy_consent: true,
                    privacy_policy_version: PRIVACY_POLICY_VERSION,
                },
                fallbackError: "Erreur lors de l'inscription",
            });
            // Account created — email must be confirmed via OTP before login
            router.replace({
                pathname: '/(auth)/verify-email',
                params: { email: email.trim().toLowerCase() },
            });
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
            <LinearGradient colors={G.hero} style={StyleSheet.absoluteFill} />

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Back button */}
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Logo */}
                <View style={styles.logoRow}>
                    <AppLogo width={260} height={86} />
                </View>

                <Text style={styles.title}>Créer un compte</Text>
                <Text style={styles.subtitle}>{"Rejoignez des milliers d'étudiants qui étudient mieux."}</Text>

                {/* Form card */}
                <View style={styles.card}>
                    {error ? (
                        <View style={styles.errorBox}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Full name */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Nom complet</Text>
                        <View style={[styles.inputWrapper, nameFocused && styles.inputFocused]}>
                            <MaterialCommunityIcons name="account-outline" size={18} color={nameFocused ? C.primary : C.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Prénom Nom"
                                placeholderTextColor={C.textMuted}
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
                            <MaterialCommunityIcons name="email-outline" size={18} color={emailFocused ? C.primary : C.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="votre@email.com"
                                placeholderTextColor={C.textMuted}
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
                            <MaterialCommunityIcons name="lock-outline" size={18} color={pwFocused ? C.primary : C.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="8 caractères minimum"
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

                        {/* Strength indicator */}
                        {password.length > 0 && (
                            <View style={styles.strengthRow}>
                                {[1, 2, 3].map(i => (
                                    <View
                                        key={i}
                                        style={[styles.strengthSeg, { backgroundColor: i <= strength.level ? strength.color : C.surfaceHigh }]}
                                    />
                                ))}
                                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                            </View>
                        )}
                    </View>

                    {/* Privacy consent */}
                    <TouchableOpacity
                        style={styles.consentRow}
                        onPress={() => { setPrivacyConsent(v => !v); setError(''); }}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.checkbox,
                            { borderColor: privacyConsent ? C.primary : C.border },
                            privacyConsent && { backgroundColor: C.primary },
                        ]}>
                            {privacyConsent && (
                                <MaterialCommunityIcons name="check" size={14} color="#fff" />
                            )}
                        </View>
                        <Text style={[styles.consentText, { color: C.textSecondary }]}>
                            {"J'accepte la "}
                            <Text
                                style={[styles.consentLink, { color: C.primary }]}
                                onPress={e => { e.stopPropagation?.(); setShowPrivacyPolicy(true); }}
                            >
                                politique de confidentialité
                            </Text>
                            {" et le traitement de mes données pour générer mes ressources pédagogiques."}
                        </Text>
                    </TouchableOpacity>

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.submitBtn, (loading || !privacyConsent) && styles.submitDisabled]}
                        onPress={handleRegister}
                        disabled={loading || !privacyConsent}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={G.primary} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.submitText}>Créer mon compte</Text>
                            }
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => router.back()} style={styles.linkRow}>
                    <Text style={styles.linkText}>Déjà un compte ? </Text>
                    <Text style={styles.linkHighlight}>Se connecter</Text>
                </TouchableOpacity>
            </ScrollView>

            <PrivacyPolicyModal
                visible={showPrivacyPolicy}
                onClose={() => setShowPrivacyPolicy(false)}
                C={C}
            />
        </KeyboardAvoidingView>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.background },
    scroll: { flexGrow: 1, padding: SIZES.xl, paddingTop: SIZES.xxxl },

    topRow: { marginBottom: SIZES.lg },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },

    logoRow: { alignItems: 'center', marginBottom: SIZES.lg },

    title:    { ...FONTS.h2, color: C.textPrimary, marginBottom: SIZES.xs },
    subtitle: { ...FONTS.body2, color: C.textSecondary, marginBottom: SIZES.xl },

    card: { backgroundColor: C.surface, borderRadius: SIZES.borderRadiusXl, padding: SIZES.xl, gap: SIZES.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },

    errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.xs, backgroundColor: C.error + '18', borderRadius: SIZES.borderRadiusSm, padding: SIZES.sm, borderWidth: 1, borderColor: C.error + '40' },
    errorText: { flex: 1, color: C.error, fontSize: SIZES.fontSm, lineHeight: 18 },

    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 2 },

    inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, backgroundColor: C.surfaceMid, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, borderWidth: 1, borderColor: C.border, height: 52 },
    inputFocused: { borderColor: C.borderActive },
    input: { flex: 1, color: C.textPrimary, fontSize: SIZES.fontMd },

    strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    strengthSeg: { flex: 1, height: 3, borderRadius: 2 },
    strengthLabel: { fontSize: SIZES.fontXs, fontWeight: '700', minWidth: 60 },

    consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm, marginTop: SIZES.xs },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 1, flexShrink: 0 },
    consentText: { flex: 1, fontSize: SIZES.fontSm, lineHeight: 20 },
    consentLink: { fontWeight: '700', textDecorationLine: 'underline' },

    submitBtn: { borderRadius: SIZES.borderRadius, overflow: 'hidden', marginTop: SIZES.xs, ...SHADOWS.primary },
    submitDisabled: { opacity: 0.5 },
    submitGrad: { height: 52, justifyContent: 'center', alignItems: 'center' },
    submitText: { color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' },

    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SIZES.xl },
    linkText: { ...FONTS.body2, color: C.textSecondary },
    linkHighlight: { fontSize: SIZES.fontSm, color: C.primary, fontWeight: '700' },
});

const privacyModal = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', borderWidth: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SIZES.xl, borderBottomWidth: 1 },
    title: { fontSize: SIZES.fontXl, fontWeight: '700' },
    body: { paddingHorizontal: SIZES.xl },
    text: { fontSize: SIZES.fontSm, lineHeight: 22 },
    closeBtn: { margin: SIZES.xl, height: 50, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center' },
    closeBtnText: { color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' },
});
