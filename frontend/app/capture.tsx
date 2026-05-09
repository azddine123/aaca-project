import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Image, TextInput,
    ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS } from '@/theme';

// idle → ocr → review → processing → done | error
type Step = 'idle' | 'ocr' | 'review' | 'processing' | 'done' | 'error';

const STEPS = [
    { label: 'Sélection',  icon: 'camera-outline' },
    { label: 'Correction', icon: 'text-box-check-outline' },
    { label: 'Résultat',   icon: 'check-circle-outline' },
];

interface ProcessResult {
    note_id: string; quiz_id?: string; flashcards_count: number;
    processing_time: number; detected_subject?: string; title: string;
}

function StepIndicator({ step, C }: { step: Step; C: any }) {
    const active = step === 'idle' ? 0
        : (step === 'ocr' || step === 'review') ? 1
        : 2;
    return (
        <View style={si.wrap}>
            {STEPS.map((s, i) => {
                const done    = i < active;
                const current = i === active;
                return (
                    <React.Fragment key={i}>
                        <View style={si.stepCol}>
                            <View style={[
                                si.circle,
                                done    && { backgroundColor: C.success, borderColor: C.success },
                                current && { borderColor: C.primary, backgroundColor: C.primary + '20' },
                                !done && !current && { borderColor: C.border, backgroundColor: C.surface },
                            ]}>
                                {done
                                    ? <MaterialCommunityIcons name="check" size={13} color="#fff" />
                                    : <MaterialCommunityIcons
                                        name={s.icon as any}
                                        size={13}
                                        color={current ? C.primary : C.textMuted}
                                      />
                                }
                            </View>
                            <Text style={[si.label, { color: (done || current) ? C.textSecondary : C.textMuted }]}>{s.label}</Text>
                        </View>
                        {i < STEPS.length - 1 && (
                            <View style={[si.line, { backgroundColor: done ? C.success : C.border }]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}
const si = StyleSheet.create({
    wrap:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SIZES.xl, marginBottom: SIZES.xl },
    stepCol: { alignItems: 'center', gap: 4 },
    circle:  { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    label:   { fontSize: 9, fontWeight: '600' },
    line:    { flex: 1, height: 1.5, marginTop: 14, marginHorizontal: 4 },
});

export default function CaptureScreen() {
    const { authFetch } = useAuth();
    const { fetchNotes } = useNotes();
    const C = useAppColors();
    const G = useAppGradients();
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
                {step !== 'idle' && step !== 'ocr' ? (
                    <TouchableOpacity onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialCommunityIcons name="refresh" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 38 }} />
                )}
            </View>

            <StepIndicator step={step} C={C} />

            {/* ── Review step ── */}
            {step === 'review' ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.reviewScroll}>
                    <View style={[styles.reviewCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                        <View style={styles.reviewHeader}>
                            <View style={[styles.reviewIconWrap, { backgroundColor: C.primary + '18' }]}>
                                <MaterialCommunityIcons name="text-box-check-outline" size={18} color={C.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.reviewTitle}>Vérifiez le texte extrait</Text>
                                <Text style={styles.reviewHint}>Corrigez les erreurs OCR si nécessaire.</Text>
                            </View>
                        </View>
                        <TextInput
                            style={[styles.textEditor, { backgroundColor: C.surfaceMid, borderColor: C.border, color: C.textPrimary }]}
                            value={rawText}
                            onChangeText={setRawText}
                            multiline
                            textAlignVertical="top"
                            placeholder="Le texte extrait apparaîtra ici..."
                            placeholderTextColor={C.textMuted}
                        />
                        <View style={styles.reviewActions}>
                            <TouchableOpacity
                                style={[styles.secondaryBtn, { borderColor: C.border }]}
                                onPress={reset}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="close" size={16} color={C.textSecondary} />
                                <Text style={[styles.secondaryBtnText, { color: C.textSecondary }]}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryBtn, { opacity: !rawText.trim() ? 0.4 : 1 }]}
                                onPress={createNote}
                                disabled={!rawText.trim()}
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={G.primary} style={styles.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <MaterialCommunityIcons name="brain" size={16} color="#fff" />
                                    <Text style={styles.primaryBtnText}>Générer avec l'IA</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
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
                                <View style={[styles.placeholderIcon, { backgroundColor: C.primary + '15' }]}>
                                    <MaterialCommunityIcons name="image-area" size={40} color={C.primary} />
                                </View>
                                <Text style={styles.placeholderText}>Prenez une photo de votre cours</Text>
                                <Text style={styles.placeholderSub}>Le texte sera extrait automatiquement par OCR</Text>
                            </View>
                        )}

                        {/* OCR loading overlay */}
                        {step === 'ocr' && (
                            <View style={styles.overlay}>
                                <View style={[styles.overlayCard, { backgroundColor: C.surface }]}>
                                    <ActivityIndicator size="large" color={C.primary} />
                                    <Text style={[styles.overlayTitle, { color: C.textPrimary }]}>Extraction en cours…</Text>
                                    <Text style={{ color: C.textSecondary, fontSize: SIZES.fontSm }}>OCR analyse votre image</Text>
                                </View>
                            </View>
                        )}

                        {/* AI processing overlay */}
                        {step === 'processing' && (
                            <View style={styles.overlay}>
                                <View style={[styles.overlayCard, { backgroundColor: C.surface }]}>
                                    <ActivityIndicator size="large" color={C.primary} />
                                    <Text style={[styles.overlayTitle, { color: C.textPrimary }]}>Génération IA…</Text>
                                    <View style={styles.processingTags}>
                                        {['Résumé', 'Quiz', 'Flashcards'].map(tag => (
                                            <View key={tag} style={[styles.processingTag, { backgroundColor: C.primary + '20', borderColor: C.primary + '40' }]}>
                                                <Text style={{ fontSize: 10, fontWeight: '600', color: C.primary }}>{tag}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Success banner */}
                    {step === 'done' && result && (
                        <View style={[styles.banner, { backgroundColor: C.success + '18', borderColor: C.success + '40' }]}>
                            <MaterialCommunityIcons name="check-circle" size={20} color={C.success} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.bannerTitle, { color: C.textPrimary }]}>Note créée avec succès !</Text>
                                {result.flashcards_count > 0 && (
                                    <Text style={{ color: C.textSecondary, fontSize: SIZES.fontXs, marginTop: 2 }}>
                                        {result.flashcards_count} flashcards · {result.quiz_id ? 'Quiz disponible' : 'Pas de quiz'}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={[styles.bannerBtn, { backgroundColor: C.success }]}
                                onPress={() => router.push({ pathname: '/note-detail', params: { id: result.note_id } })}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.bannerBtnText}>Voir</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Error banner */}
                    {step === 'error' && (
                        <View style={[styles.banner, { backgroundColor: C.error + '18', borderColor: C.error + '40' }]}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={C.error} />
                            <Text style={{ color: C.error, flex: 1, fontSize: SIZES.fontXs, lineHeight: 18 }}>{errorMsg}</Text>
                            <TouchableOpacity onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={{ color: C.error, fontWeight: '700', fontSize: SIZES.fontSm }}>Réessayer</Text>
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
                            <LinearGradient colors={G.primary} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <MaterialCommunityIcons name="camera-outline" size={22} color="#fff" />
                                <Text style={styles.actionBtnText}>Caméra</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtnOutline, { borderColor: C.primary }, isWorking && { opacity: 0.5 }]}
                            onPress={() => pickImage(false)}
                            disabled={isWorking}
                            activeOpacity={0.85}
                        >
                            <MaterialCommunityIcons name="image-multiple-outline" size={22} color={C.primary} />
                            <Text style={[styles.actionBtnText, { color: C.primary }]}>Galerie</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </KeyboardAvoidingView>
    );
}

const makeStyles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background, paddingTop: 56 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SIZES.xl, marginBottom: SIZES.xl,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: C.border,
    },
    headerTitle: { fontSize: SIZES.fontLg, fontWeight: '600', color: C.textPrimary },

    // Review step
    reviewScroll: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },
    reviewCard: { borderRadius: SIZES.borderRadiusLg, padding: SIZES.md, borderWidth: 1, gap: SIZES.md, ...SHADOWS.sm },
    reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
    reviewIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    reviewTitle: { fontSize: SIZES.fontMd, fontWeight: '700', color: C.textPrimary },
    reviewHint:  { fontSize: SIZES.fontXs, color: C.textSecondary, marginTop: 2 },
    textEditor:  { borderWidth: 1.5, borderRadius: SIZES.borderRadius, padding: SIZES.md, fontSize: SIZES.fontSm, lineHeight: 22, minHeight: 240 },
    reviewActions: { flexDirection: 'row', gap: SIZES.sm },
    primaryBtn:    { flex: 1, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.primary },
    primaryGrad:   { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm },
    primaryBtnText:{ color: '#fff', fontWeight: '700', fontSize: SIZES.fontSm },
    secondaryBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.xs, height: 48, paddingHorizontal: SIZES.md, borderRadius: SIZES.borderRadius, borderWidth: 1.5 },
    secondaryBtnText: { fontWeight: '600', fontSize: SIZES.fontSm },

    // Preview
    previewWrapper: {
        flex: 1, marginHorizontal: SIZES.xl,
        backgroundColor: C.surface, borderRadius: SIZES.borderRadiusLg,
        overflow: 'hidden', marginBottom: SIZES.md,
        borderWidth: 1, borderColor: C.border, ...SHADOWS.sm,
    },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm, padding: SIZES.xxl },
    placeholderIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.sm },
    placeholderText: { fontSize: SIZES.fontMd, color: C.textSecondary, textAlign: 'center', fontWeight: '500' },
    placeholderSub:  { fontSize: SIZES.fontXs, color: C.textMuted, textAlign: 'center', lineHeight: 18 },

    overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    overlayCard: { borderRadius: SIZES.borderRadiusLg, padding: SIZES.xl, alignItems: 'center', gap: SIZES.md, minWidth: 200, ...SHADOWS.md },
    overlayTitle:{ fontSize: SIZES.fontLg, fontWeight: '600' },
    processingTags: { flexDirection: 'row', gap: SIZES.xs, flexWrap: 'wrap', justifyContent: 'center' },
    processingTag:  { paddingHorizontal: SIZES.sm, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },

    banner: {
        flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
        marginHorizontal: SIZES.xl, marginBottom: SIZES.sm,
        borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1,
    },
    bannerTitle:  { fontWeight: '700', fontSize: SIZES.fontSm, color: C.textPrimary },
    bannerBtn:    { paddingHorizontal: SIZES.md, paddingVertical: 6, borderRadius: SIZES.borderRadiusSm },
    bannerBtnText:{ color: '#fff', fontWeight: '700', fontSize: SIZES.fontSm },

    actionsRow: { flexDirection: 'row', gap: SIZES.md, paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },
    actionBtn: { flex: 1, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.primary },
    actionBtnOutline: { flex: 1, borderRadius: SIZES.borderRadius, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, height: 54 },
    actionGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm },
    actionBtnText: { color: '#fff', fontWeight: '700', fontSize: SIZES.fontMd },
});
