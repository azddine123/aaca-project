import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Image, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS, GRADIENTS } from '@/theme';

// idle → ocr → review → processing → done | error
type Step = 'idle' | 'ocr' | 'review' | 'processing' | 'done' | 'error';

const STEPS = ['Sélection', 'Correction', 'Résultat'];

interface ProcessResult {
    note_id: string; quiz_id?: string; flashcards_count: number;
    processing_time: number; detected_subject?: string; title: string;
}

function StepIndicator({ step, C }: { step: Step; C: any }) {
    const active = (step === 'idle') ? 0
        : (step === 'ocr' || step === 'review') ? 1
        : 2;
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.xl, marginBottom: SIZES.xl }}>
            {STEPS.map((label, i) => {
                const done = i < active;
                const current = i === active;
                return (
                    <React.Fragment key={i}>
                        <View style={{ alignItems: 'center', gap: 4 }}>
                            <View style={{
                                width: 26, height: 26, borderRadius: 13,
                                borderWidth: 1.5,
                                borderColor: done ? C.success : current ? C.primary : C.border,
                                backgroundColor: done ? C.success : current ? C.primary + '25' : C.surface,
                                justifyContent: 'center', alignItems: 'center',
                            }}>
                                {done
                                    ? <MaterialCommunityIcons name="check" size={12} color="#fff" />
                                    : <Text style={{ fontSize: 11, fontWeight: '700', color: current ? C.primary : C.textMuted }}>{i + 1}</Text>
                                }
                            </View>
                            <Text style={{ fontSize: 9, fontWeight: '600', color: (done || current) ? C.textSecondary : C.textMuted }}>{label}</Text>
                        </View>
                        {i < STEPS.length - 1 && (
                            <View style={{ flex: 1, height: 1.5, backgroundColor: done ? C.success : C.border, marginBottom: 16 }} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

export default function CaptureScreen() {
    const { authFetch } = useAuth();
    const { fetchNotes } = useNotes();
    const C = useAppColors();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [step, setStep] = useState<Step>('idle');
    const [preview, setPreview] = useState<string | null>(null);
    const [rawText, setRawText] = useState('');
    const [result, setResult] = useState<ProcessResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    // ── Step 1: OCR only ───────────────────────────────────────────────
    const runOcr = async (uri: string) => {
        setStep('ocr');
        try {
            const form = new FormData();
            form.append('file', { uri, name: 'capture.jpg', type: 'image/jpeg' } as any);
            const res = await authFetch(`${API_URL}/process/ocr-only`, { method: 'POST', body: form });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Extraction OCR échouée');
            }
            const data = await res.json();
            setRawText(data.raw_text || '');
            setStep('review');
        } catch (e: any) {
            setErrorMsg(e.message || "Impossible d'extraire le texte");
            setStep('error');
        }
    };

    // ── Step 2: Create note from corrected text ────────────────────────
    const createNote = async () => {
        if (!rawText.trim()) {
            Alert.alert('Texte vide', 'Veuillez saisir ou corriger le texte extrait.');
            return;
        }
        setStep('processing');
        try {
            const res = await authFetch(`${API_URL}/notes/from-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw_text: rawText }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Génération IA échouée');
            }
            setResult(await res.json());
            setStep('done');
            fetchNotes();
        } catch (e: any) {
            setErrorMsg(e.message || 'Erreur lors de la génération');
            setStep('error');
        }
    };

    const pickImage = async (fromCamera: boolean) => {
        if (fromCamera) {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert('Permission requise', "L'accès à la caméra est nécessaire.");
                return;
            }
            const picked = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 });
            if (!picked.canceled && picked.assets[0]) {
                const uri = picked.assets[0].uri;
                try {
                    const lib = await MediaLibrary.requestPermissionsAsync();
                    if (lib.status === 'granted') await MediaLibrary.saveToLibraryAsync(uri);
                } catch { }
                setPreview(uri); setResult(null); setErrorMsg('');
                await runOcr(uri);
            }
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', "L'accès à la galerie est nécessaire.");
                return;
            }
            const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
            if (!picked.canceled && picked.assets[0]) {
                const uri = picked.assets[0].uri;
                setPreview(uri); setResult(null); setErrorMsg('');
                await runOcr(uri);
            }
        }
    };

    const reset = () => { setStep('idle'); setPreview(null); setRawText(''); setResult(null); setErrorMsg(''); };

    const isWorking = step === 'ocr' || step === 'processing';

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={C.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Capturer une note</Text>
                <View style={{ width: 38 }} />
            </View>

            <StepIndicator step={step} C={C} />

            {/* ── Review step: show extracted text for correction ── */}
            {step === 'review' ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl }}>
                    <View style={styles.reviewHeader}>
                        <MaterialCommunityIcons name="text-box-check-outline" size={20} color={C.primary} />
                        <Text style={[styles.reviewTitle, { color: C.textPrimary }]}>Vérifiez et corrigez le texte extrait</Text>
                    </View>
                    <Text style={[styles.reviewHint, { color: C.textSecondary }]}>
                        Corrigez les erreurs OCR si nécessaire, puis appuyez sur "Générer".
                    </Text>
                    <TextInput
                        style={[styles.textEditor, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                        value={rawText}
                        onChangeText={setRawText}
                        multiline
                        textAlignVertical="top"
                        placeholder="Le texte extrait apparaîtra ici..."
                        placeholderTextColor={C.textMuted}
                    />
                    <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md }}>
                        <TouchableOpacity
                            style={[styles.secondaryBtn, { borderColor: C.border }]}
                            onPress={reset}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="refresh" size={18} color={C.textSecondary} />
                            <Text style={{ color: C.textSecondary, fontWeight: '600', fontSize: SIZES.fontSm }}>Recommencer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: C.primary, flex: 1 }, !rawText.trim() && { opacity: 0.4 }]}
                            onPress={createNote}
                            disabled={!rawText.trim()}
                            activeOpacity={0.85}
                        >
                            <MaterialCommunityIcons name="brain" size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: SIZES.fontMd }}>Générer</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : (
                <>
                    {/* Preview area */}
                    <View style={styles.previewWrapper}>
                        {preview ? (
                            <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="cover" />
                        ) : (
                            <View style={styles.placeholder}>
                                <MaterialCommunityIcons name="image-area" size={64} color={C.textMuted} />
                                <Text style={[styles.placeholderText, { color: C.textSecondary }]}>Prenez une photo de votre cours</Text>
                                <Text style={[styles.placeholderSub, { color: C.textMuted }]}>Le texte sera extrait automatiquement par OCR</Text>
                            </View>
                        )}
                        {step === 'ocr' && (
                            <View style={styles.overlay}>
                                <ActivityIndicator size="large" color={C.primary} />
                                <Text style={[styles.overlayTitle, { color: C.textPrimary }]}>Extraction du texte…</Text>
                                <Text style={{ color: C.textSecondary, fontSize: SIZES.fontSm }}>OCR en cours</Text>
                            </View>
                        )}
                        {step === 'processing' && (
                            <View style={styles.overlay}>
                                <ActivityIndicator size="large" color={C.primary} />
                                <Text style={[styles.overlayTitle, { color: C.textPrimary }]}>Génération IA…</Text>
                                <Text style={{ color: C.textSecondary, fontSize: SIZES.fontSm }}>Résumé · Quiz · Flashcards</Text>
                            </View>
                        )}
                    </View>

                    {/* Banners */}
                    {step === 'done' && result && (
                        <View style={styles.successBanner}>
                            <MaterialCommunityIcons name="check-circle" size={22} color={C.success} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.bannerTitle, { color: C.textPrimary }]}>Note créée avec succès !</Text>
                                <Text style={{ color: C.textSecondary, fontSize: SIZES.fontXs, marginTop: 2 }}>
                                    {result.flashcards_count > 0 ? `${result.flashcards_count} flashcards · ` : ''}
                                    {result.quiz_id ? 'Quiz disponible' : ''}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={{ backgroundColor: C.success, paddingHorizontal: SIZES.md, paddingVertical: 6, borderRadius: SIZES.borderRadiusSm }}
                                onPress={() => router.push({ pathname: '/note-detail', params: { id: result.note_id } })}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: SIZES.fontSm }}>Voir</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {step === 'error' && (
                        <View style={styles.errorBanner}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={22} color={C.error} />
                            <Text style={{ color: C.error, flex: 1, fontSize: SIZES.fontXs }}>{errorMsg}</Text>
                            <TouchableOpacity onPress={reset}>
                                <Text style={{ color: C.error, fontWeight: '700' }}>Réessayer</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, isWorking && { opacity: 0.5 }]}
                            onPress={() => pickImage(true)}
                            disabled={isWorking}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={GRADIENTS.primary} style={styles.actionGrad}>
                                <MaterialCommunityIcons name="camera-outline" size={24} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: SIZES.fontMd }}>Caméra</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { borderWidth: 1.5, borderColor: C.primary, shadowOpacity: 0 }, isWorking && { opacity: 0.5 }]}
                            onPress={() => pickImage(false)}
                            disabled={isWorking}
                            activeOpacity={0.85}
                        >
                            <View style={styles.actionGrad}>
                                <MaterialCommunityIcons name="image-multiple-outline" size={24} color={C.primary} />
                                <Text style={{ color: C.primary, fontWeight: '700', fontSize: SIZES.fontMd }}>Galerie</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </KeyboardAvoidingView>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background, paddingTop: 56 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, marginBottom: SIZES.xl },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
    headerTitle: { fontSize: SIZES.fontLg, fontWeight: '600', color: C.textPrimary },

    // Review step
    reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.xs },
    reviewTitle: { fontSize: SIZES.fontMd, fontWeight: '700', flex: 1 },
    reviewHint: { fontSize: SIZES.fontXs, marginBottom: SIZES.md, lineHeight: 17 },
    textEditor: { borderWidth: 1.5, borderRadius: SIZES.borderRadius, padding: SIZES.md, fontSize: SIZES.fontSm, lineHeight: 22, minHeight: 260 },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, height: 50, borderRadius: SIZES.borderRadius, ...SHADOWS.sm },
    secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, height: 50, paddingHorizontal: SIZES.md, borderRadius: SIZES.borderRadius, borderWidth: 1.5 },

    // Preview
    previewWrapper: { flex: 1, marginHorizontal: SIZES.xl, backgroundColor: C.surface, borderRadius: SIZES.borderRadiusLg, overflow: 'hidden', marginBottom: SIZES.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm, padding: SIZES.xxl },
    placeholderText: { fontSize: SIZES.fontMd, textAlign: 'center' },
    placeholderSub: { fontSize: SIZES.fontXs, textAlign: 'center' },

    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,9,26,0.88)', justifyContent: 'center', alignItems: 'center', gap: SIZES.md },
    overlayTitle: { fontSize: SIZES.fontLg, fontWeight: '600' },

    successBanner: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginHorizontal: SIZES.xl, marginBottom: SIZES.sm, backgroundColor: C.success + '18', borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: C.success + '40' },
    bannerTitle: { fontWeight: '700', fontSize: SIZES.fontSm },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginHorizontal: SIZES.xl, marginBottom: SIZES.sm, backgroundColor: C.error + '18', borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: C.error + '40' },

    actionsRow: { flexDirection: 'row', gap: SIZES.md, paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },
    actionBtn: { flex: 1, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.primary },
    actionGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm },
});
