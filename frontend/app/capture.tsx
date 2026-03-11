import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/api';
import { COLORS, SIZES, FONTS, SHADOWS, GRADIENTS } from '@/theme';

type Step = 'idle' | 'processing' | 'done' | 'error';

const STEPS = ['Sélection', 'Analyse IA', 'Résultat'];

function StepIndicator({ step }: { step: Step }) {
    const active = step === 'idle' ? 0 : step === 'processing' ? 1 : 2;
    return (
        <View style={si.row}>
            {STEPS.map((label, i) => {
                const done = i < active;
                const current = i === active;
                return (
                    <React.Fragment key={i}>
                        <View style={si.step}>
                            <View style={[si.circle, done && si.circleDone, current && si.circleCurrent]}>
                                {done
                                    ? <MaterialCommunityIcons name="check" size={12} color={COLORS.white} />
                                    : <Text style={[si.num, current && si.numCurrent]}>{i + 1}</Text>
                                }
                            </View>
                            <Text style={[si.label, (done || current) && si.labelActive]}>{label}</Text>
                        </View>
                        {i < STEPS.length - 1 && (
                            <View style={[si.line, done && si.lineDone]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

const si = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.xl, marginBottom: SIZES.xl },
    step: { alignItems: 'center', gap: 4 },
    circle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
    circleCurrent: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '25' },
    circleDone: { borderColor: COLORS.success, backgroundColor: COLORS.success },
    num: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
    numCurrent: { color: COLORS.primary },
    label: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted },
    labelActive: { color: COLORS.textSecondary },
    line: { flex: 1, height: 1.5, backgroundColor: COLORS.border, marginBottom: 16 },
    lineDone: { backgroundColor: COLORS.success },
});

export default function CaptureScreen() {
    const { auth, authFetch } = useAuth();
    const [step, setStep] = useState<Step>('idle');
    const [preview, setPreview] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const pickImage = async (fromCamera: boolean) => {
        if (fromCamera) {
            const camPerm = await ImagePicker.requestCameraPermissionsAsync();
            if (camPerm.status !== 'granted') {
                Alert.alert('Permission requise', "L'accès à la caméra est nécessaire.");
                return;
            }
            const picked = await ImagePicker.launchCameraAsync({
                mediaTypes: 'images',
                quality: 0.9,
            });
            if (!picked.canceled && picked.assets[0]) {
                const uri = picked.assets[0].uri;
                // Sauvegarde automatique dans la galerie (silencieuse)
                try {
                    const libPerm = await MediaLibrary.requestPermissionsAsync();
                    if (libPerm.status === 'granted') {
                        await MediaLibrary.saveToLibraryAsync(uri);
                    }
                } catch { /* non critique si indisponible sur Expo Go */ }
                setPreview(uri);
                setResult(null);
                setErrorMsg('');
                await processImage(uri);
            }
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', "L'accès à la galerie est nécessaire.");
                return;
            }
            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                quality: 0.9,
            });
            if (!picked.canceled && picked.assets[0]) {
                const uri = picked.assets[0].uri;
                setPreview(uri);
                setResult(null);
                setErrorMsg('');
                await processImage(uri);
            }
        }
    };

    const processImage = async (uri: string) => {
        setStep('processing');
        try {
            const form = new FormData();
            form.append('file', { uri, name: 'capture.jpg', type: 'image/jpeg' } as any);
            const res = await authFetch(`${API_URL}/process/capture`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${auth.token}` },
                body: form,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Traitement échoué');
            }
            const data = await res.json();
            setResult(data);
            setStep('done');
        } catch (e: any) {
            setErrorMsg(e.message || "Impossible de traiter l'image");
            setStep('error');
        }
    };

    const reset = () => {
        setStep('idle');
        setPreview(null);
        setResult(null);
        setErrorMsg('');
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Capturer une note</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* Step indicator */}
            <StepIndicator step={step} />

            {/* Preview area */}
            <View style={styles.previewWrapper}>
                {preview ? (
                    <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="cover" />
                ) : (
                    <View style={styles.placeholder}>
                        <MaterialCommunityIcons name="image-area" size={64} color={COLORS.textMuted} />
                        <Text style={styles.placeholderText}>Prenez une photo de votre cours</Text>
                        <Text style={styles.placeholderSub}>Le texte sera extrait automatiquement par OCR</Text>
                    </View>
                )}

                {/* Processing overlay */}
                {step === 'processing' && (
                    <View style={styles.overlay}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.overlayTitle}>Analyse en cours…</Text>
                        <Text style={styles.overlaySub}>OCR · Structuration · IA</Text>
                    </View>
                )}
            </View>

            {/* Result / Error banners */}
            {step === 'done' && result && (
                <View style={styles.successBanner}>
                    <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.success} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.successTitle}>Note créée avec succès !</Text>
                        <Text style={styles.successSub}>
                            {result.flashcards_count > 0 ? `${result.flashcards_count} flashcards générées · ` : ''}
                            {result.quiz_id ? 'Quiz disponible' : ''}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => router.push({ pathname: '/note-detail', params: { id: result.note_id } })}
                    >
                        <Text style={styles.viewBtnText}>Voir</Text>
                    </TouchableOpacity>
                </View>
            )}
            {step === 'error' && (
                <View style={styles.errorBanner}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={22} color={COLORS.error} />
                    <Text style={[styles.successSub, { color: COLORS.error, flex: 1 }]}>{errorMsg}</Text>
                    <TouchableOpacity onPress={reset}>
                        <Text style={{ color: COLORS.error, fontWeight: '700' }}>Réessayer</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionBtn, step === 'processing' && styles.actionBtnDisabled]}
                    onPress={() => pickImage(true)}
                    disabled={step === 'processing'}
                    activeOpacity={0.85}
                >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.actionGrad}>
                        <MaterialCommunityIcons name="camera-outline" size={24} color={COLORS.white} />
                        <Text style={styles.actionBtnText}>Caméra</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnOutline, step === 'processing' && styles.actionBtnDisabled]}
                    onPress={() => pickImage(false)}
                    disabled={step === 'processing'}
                    activeOpacity={0.85}
                >
                    <View style={styles.actionOutlineInner}>
                        <MaterialCommunityIcons name="image-multiple-outline" size={24} color={COLORS.primary} />
                        <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Galerie</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 56 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, marginBottom: SIZES.xl },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    headerTitle: { ...FONTS.h4 },

    previewWrapper: {
        flex: 1, marginHorizontal: SIZES.xl,
        backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadiusLg,
        overflow: 'hidden', marginBottom: SIZES.md,
        borderWidth: 1, borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm, padding: SIZES.xxl },
    placeholderText: { ...FONTS.body1, textAlign: 'center', color: COLORS.textSecondary },
    placeholderSub: { ...FONTS.caption, textAlign: 'center' },

    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,9,26,0.88)', justifyContent: 'center', alignItems: 'center', gap: SIZES.md },
    overlayTitle: { color: COLORS.textPrimary, fontSize: SIZES.fontLg, fontWeight: '600' },
    overlaySub: { color: COLORS.textSecondary, fontSize: SIZES.fontSm },

    successBanner: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginHorizontal: SIZES.xl, marginBottom: SIZES.sm, backgroundColor: COLORS.success + '18', borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: COLORS.success + '40' },
    successTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: SIZES.fontSm },
    successSub: { color: COLORS.textSecondary, fontSize: SIZES.fontXs, marginTop: 2 },
    viewBtn: { backgroundColor: COLORS.success, paddingHorizontal: SIZES.md, paddingVertical: 6, borderRadius: SIZES.borderRadiusSm },
    viewBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.fontSm },

    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginHorizontal: SIZES.xl, marginBottom: SIZES.sm, backgroundColor: COLORS.error + '18', borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: COLORS.error + '40' },

    actionsRow: { flexDirection: 'row', gap: SIZES.md, paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },
    actionBtn: { flex: 1, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.primary },
    actionBtnOutline: { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: 'transparent', shadowOpacity: 0 },
    actionBtnDisabled: { opacity: 0.5 },
    actionGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm },
    actionOutlineInner: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm },
    actionBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.fontMd },
});
