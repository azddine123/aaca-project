import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Image, TextInput,
    ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useSubjects } from '@/contexts/SubjectsContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { AacaButton, AacaCard, StatusBadge } from '@/components/UIKit';
import { ZelligePattern } from '@/components/ZelligePattern';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS } from '@/theme';

// idle -> ocr -> review -> processing -> done | error
type Step = 'idle' | 'ocr' | 'review' | 'processing' | 'done' | 'error';

const STEPS = [
    { label: 'Photo', icon: 'camera-outline' },
    { label: 'Extraction', icon: 'text-recognition' },
    { label: 'Correction', icon: 'text-box-check-outline' },
    { label: 'Note créée', icon: 'check-circle-outline' },
];

const AI_STEPS = [
    { label: 'Analyse du contenu', icon: 'magnify' },
    { label: 'Création du résumé', icon: 'text-box-outline' },
    { label: 'Génération des exercices', icon: 'clipboard-check-outline' },
    { label: 'Préparation des flashcards', icon: 'cards-outline' },
];

interface ProcessResult {
    note_id: string; quiz_id?: string; flashcards_count: number;
    processing_time: number; detected_subject?: string; title: string;
}

function stepIndex(step: Step): number {
    if (step === 'idle') return 0;
    if (step === 'ocr') return 1;
    if (step === 'review') return 2;
    return 3;
}

function StepIndicator({ step, C }: { step: Step; C: any }) {
    const active = stepIndex(step);
    return (
        <View style={si.wrap}>
            {STEPS.map((s, i) => {
                const done = i < active || step === 'done';
                const current = i === active && step !== 'done';
                return (
                    <React.Fragment key={s.label}>
                        <View style={si.stepCol}>
                            <View style={[
                                si.circle,
                                { borderColor: C.border, backgroundColor: C.surface },
                                done && { backgroundColor: C.success, borderColor: C.success },
                                current && { borderColor: C.primary, backgroundColor: C.primary + '14' },
                            ]}>
                                {done
                                    ? <MaterialCommunityIcons name="check" size={13} color="#fff" />
                                    : <MaterialCommunityIcons name={s.icon as any} size={13} color={current ? C.primary : C.textMuted} />
                                }
                            </View>
                            <Text style={[si.label, { color: current ? C.primary : C.textMuted }]}>{s.label}</Text>
                        </View>
                        {i < STEPS.length - 1 ? (
                            <View style={[si.line, { backgroundColor: done ? C.success : C.border }]} />
                        ) : null}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

function ScannerFrame({ C }: { C: any }) {
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View style={[sf.corner, sf.tl, { borderColor: C.primary }]} />
            <View style={[sf.corner, sf.tr, { borderColor: C.primary }]} />
            <View style={[sf.corner, sf.bl, { borderColor: C.primary }]} />
            <View style={[sf.corner, sf.br, { borderColor: C.primary }]} />
            <View style={[sf.scanLine, { backgroundColor: C.primary + '50' }]} />
        </View>
    );
}

export default function CaptureScreen() {
    const { authFetch } = useAuth();
    const { fetchNotes } = useNotes();
    const { subjects, fetchSubjects } = useSubjects();
    const C = useAppColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(C, insets.top), [C, insets.top]);

    const [step, setStep] = useState<Step>('idle');
    const [preview, setPreview] = useState<string | null>(null);
    const [rawText, setRawText] = useState('');
    const [result, setResult] = useState<ProcessResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [aiStep, setAiStep] = useState(0);
    const [understood, setUnderstood] = useState(false);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
    const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

    useEffect(() => { fetchSubjects(); }, []);

    useEffect(() => {
        if (step !== 'processing') { setAiStep(0); return; }
        const t = setInterval(() => setAiStep(i => Math.min(i + 1, AI_STEPS.length - 1)), 2200);
        return () => clearInterval(t);
    }, [step]);

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
            setOriginalImageUrl(data.original_image_url || null);
            setProcessedImageUrl(data.processed_image_url || null);
            setStep('review');
        } catch (e: any) {
            setErrorMsg(e.message || "Impossible d'extraire le texte");
            setStep('error');
        }
    };

    const createNote = async () => {
        if (!rawText.trim()) {
            Alert.alert('Texte vide', 'Veuillez saisir ou corriger le texte extrait.');
            return;
        }
        setStep('processing');
        try {
            const body: Record<string, unknown> = { raw_text: rawText };
            if (selectedSubjectId) body.selected_subject_id = selectedSubjectId;
            if (originalImageUrl) body.original_image_url = originalImageUrl;
            if (processedImageUrl) body.processed_image_url = processedImageUrl;
            const res = await authFetch(`${API_URL}/notes/from-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status === 402) {
                router.push('/paywall');
                setStep('review');
                return;
            }
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
                setOriginalImageUrl(null); setProcessedImageUrl(null);
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
                setOriginalImageUrl(null); setProcessedImageUrl(null);
                await runOcr(uri);
            }
        }
    };

    const reset = () => {
        setStep('idle');
        setPreview(null);
        setRawText('');
        setResult(null);
        setErrorMsg('');
        setUnderstood(false);
        setSelectedSubjectId(null);
        setOriginalImageUrl(null);
        setProcessedImageUrl(null);
    };
    const isWorking = step === 'ocr' || step === 'processing';

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <MaterialCommunityIcons name="arrow-left" size={22} color={C.textSecondary} />
                </TouchableOpacity>
                <View style={styles.headerCopy}>
                    <Text style={styles.headerTitle}>Scanner un cours</Text>
                    <Text style={styles.headerSub}>Photographiez · Extrayez · Corrigez</Text>
                </View>
                {step !== 'idle' && step !== 'ocr' ? (
                    <TouchableOpacity
                        onPress={reset}
                        style={styles.iconBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Recommencer"
                    >
                        <MaterialCommunityIcons name="refresh" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 38 }} />
                )}
            </View>

            <StepIndicator step={step} C={C} />

            {step === 'review' ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.reviewScroll}>
                    <AacaCard style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                            <View style={[styles.reviewIconWrap, { backgroundColor: C.primary + '14' }]}>
                                <MaterialCommunityIcons name="text-box-check-outline" size={18} color={C.primary} />
                            </View>
                            <View style={styles.reviewCopy}>
                                <Text style={styles.reviewTitle}>Texte extrait</Text>
                                <Text style={styles.reviewHint}>Corrigez uniquement ce qui est nécessaire avant la génération.</Text>
                            </View>
                            <StatusBadge label="À corriger" tone="warning" />
                        </View>

                        {/* ── Bloc 1 : Vérification requise ── */}
                        <View style={[styles.infoBlock, { backgroundColor: C.warning + '14', borderColor: C.warning + '50' }]}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={C.warning} style={{ marginTop: 1 }} />
                            <View style={styles.infoBlockCopy}>
                                <Text style={[styles.infoBlockTitle, { color: C.warning }]}>Vérification requise</Text>
                                <Text style={[styles.infoBlockBody, { color: C.textSecondary }]}>
                                    {'Le texte extrait automatiquement peut contenir des erreurs, surtout si l\'image est floue, manuscrite ou mal cadrée. Relisez et corrigez le contenu avant de générer le résumé, les quiz et les flashcards.'}
                                </Text>
                            </View>
                        </View>

                        {preview ? (
                            <Image source={{ uri: preview }} style={styles.reviewThumb} resizeMode="cover" />
                        ) : null}
                        <TextInput
                            style={styles.textEditor}
                            value={rawText}
                            onChangeText={setRawText}
                            multiline
                            textAlignVertical="top"
                            placeholder="Le texte extrait apparaîtra ici..."
                            placeholderTextColor={C.textMuted}
                        />

                        {/* ── Sélection de la matière ── */}
                        {subjects.length > 0 && (
                            <View style={styles.subjectSection}>
                                <Text style={[styles.subjectLabel, { color: C.textSecondary }]}>Matière</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectPills}>
                                    {subjects.map(s => {
                                        const active = selectedSubjectId === s.id;
                                        return (
                                            <TouchableOpacity
                                                key={s.id}
                                                style={[styles.pill, { borderColor: active ? s.color : C.border, backgroundColor: active ? s.color + '22' : C.surfaceMid }]}
                                                onPress={() => setSelectedSubjectId(active ? null : s.id)}
                                                activeOpacity={0.7}
                                            >
                                                <MaterialCommunityIcons name={s.icon as any} size={13} color={active ? s.color : C.textMuted} />
                                                <Text style={[styles.pillText, { color: active ? s.color : C.textSecondary, fontWeight: active ? '700' : '400' }]}>{s.name}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {/* ── Bloc 2 : Contenu généré par IA ── */}
                        <View style={[styles.infoBlock, { backgroundColor: C.primary + '10', borderColor: C.primary + '40' }]}>
                            <MaterialCommunityIcons name="robot-outline" size={18} color={C.primary} style={{ marginTop: 1 }} />
                            <View style={styles.infoBlockCopy}>
                                <Text style={[styles.infoBlockTitle, { color: C.primary }]}>Contenu généré par IA</Text>
                                <Text style={[styles.infoBlockBody, { color: C.textSecondary }]}>
                                    {'Les résumés, quiz et flashcards sont générés automatiquement à partir de vos notes. Ils peuvent contenir des imprécisions. Vérifiez toujours les informations importantes avec votre cours original.'}
                                </Text>
                            </View>
                        </View>

                        {/* ── Case à cocher de confirmation ── */}
                        <TouchableOpacity
                            style={styles.consentRow}
                            onPress={() => setUnderstood(v => !v)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.checkbox,
                                { borderColor: understood ? C.primary : C.border },
                                understood && { backgroundColor: C.primary },
                            ]}>
                                {understood && (
                                    <MaterialCommunityIcons name="check" size={13} color="#fff" />
                                )}
                            </View>
                            <Text style={[styles.consentText, { color: C.textSecondary }]}>
                                {"J'ai vérifié le texte extrait et je comprends que le contenu IA peut contenir des erreurs."}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.reviewActions}>
                            <AacaButton label="Annuler" icon="close" variant="ghost" onPress={reset} full />
                            <AacaButton
                                label="Générer"
                                icon="brain"
                                onPress={createNote}
                                disabled={!rawText.trim() || !understood}
                                full
                            />
                        </View>
                    </AacaCard>
                </ScrollView>
            ) : (
                <>
                    <View style={styles.previewWrapper}>
                        <View style={styles.previewTop}>
                            <StatusBadge
                                label={step === 'ocr' ? 'OCR en cours' : step === 'processing' ? 'Génération IA' : preview ? 'Image prête' : 'En attente'}
                                tone={step === 'ocr' || step === 'processing' ? 'info' : preview ? 'success' : 'pending'}
                            />
                            <Text style={styles.previewHint}>Alignez la page dans le cadre</Text>
                        </View>
                        <View style={styles.scanArea}>
                            <View style={styles.scanPattern}>
                                <ZelligePattern color={C.primary} opacity={1} tileSize={28} cols={10} rows={8} />
                            </View>
                            {preview ? (
                                <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="cover" />
                            ) : (
                                <View style={styles.placeholder}>
                                    <View style={[styles.placeholderIcon, { backgroundColor: C.primary + '12' }]}>
                                        <MaterialCommunityIcons name="image-area" size={38} color={C.primary} />
                                    </View>
                                    <Text style={styles.placeholderText}>Photographiez une page de cours</Text>
                                    <Text style={styles.placeholderSub}>PicLearn extraira le texte sans modifier votre parcours OCR.</Text>
                                </View>
                            )}
                            <ScannerFrame C={C} />

                            {isWorking ? (
                                <View style={styles.overlay}>
                                    <AacaCard style={styles.overlayCard}>
                                        <ActivityIndicator size="large" color={C.primary} />
                                        <Text style={styles.overlayTitle}>
                                            {step === 'ocr' ? 'Extraction du texte' : 'Analyse IA'}
                                        </Text>
                                        {step === 'ocr' ? (
                                            <Text style={styles.overlaySub}>Reconnaissance optique en cours…</Text>
                                        ) : (
                                            <View style={styles.aiSteps}>
                                                {AI_STEPS.map((s, i) => (
                                                    <View key={i} style={[styles.aiStepRow, { opacity: i <= aiStep ? 1 : 0.28 }]}>
                                                        <MaterialCommunityIcons
                                                            name={(i < aiStep ? 'check-circle' : i === aiStep ? s.icon : 'circle-outline') as any}
                                                            size={13}
                                                            color={i < aiStep ? C.success : i === aiStep ? C.primary : C.textMuted}
                                                        />
                                                        <Text style={[styles.aiStepLabel, {
                                                            color: i < aiStep ? C.success : i === aiStep ? C.textPrimary : C.textMuted,
                                                            fontWeight: i === aiStep ? '700' : '400',
                                                        }]}>{s.label}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </AacaCard>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    {step === 'done' && result ? (
                        <View style={styles.bannerWrap}>
                            <AacaCard style={styles.banner}>
                                <MaterialCommunityIcons name="check-circle" size={22} color={C.success} />
                                <View style={styles.bannerCopy}>
                                    <Text style={styles.bannerTitle}>Note créée</Text>
                                    <Text style={styles.bannerSub}>
                                        {result.flashcards_count} flashcards · {result.quiz_id ? 'Quiz disponible' : 'Pas de quiz'}
                                    </Text>
                                </View>
                                <AacaButton
                                    label="Voir"
                                    size="sm"
                                    color={C.success}
                                    onPress={() => router.push({ pathname: '/note-detail', params: { id: result.note_id } })}
                                />
                            </AacaCard>
                        </View>
                    ) : null}

                    {step === 'error' ? (
                        <View style={styles.bannerWrap}>
                            <AacaCard style={styles.banner}>
                                <MaterialCommunityIcons name="alert-circle-outline" size={22} color={C.error} />
                                <Text style={styles.errorText}>{errorMsg}</Text>
                                <AacaButton label="Réessayer" size="sm" variant="secondary" color={C.error} onPress={reset} />
                            </AacaCard>
                        </View>
                    ) : null}

                    <View style={styles.actionsRow}>
                        <AacaButton
                            label="Caméra"
                            icon="camera-outline"
                            onPress={() => pickImage(true)}
                            disabled={isWorking}
                            full
                        />
                        <AacaButton
                            label="Galerie"
                            icon="image-multiple-outline"
                            variant="secondary"
                            onPress={() => pickImage(false)}
                            disabled={isWorking}
                            full
                        />
                    </View>
                </>
            )}
        </KeyboardAvoidingView>
    );
}

const si = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SIZES.xl, marginBottom: SIZES.lg },
    stepCol: { alignItems: 'center', gap: 4, width: 54 },
    circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    label: { fontSize: 9, fontWeight: '700' },
    line: { flex: 1, height: 1.5, marginTop: 14, marginHorizontal: -4 },
});

const sf = StyleSheet.create({
    corner: { position: 'absolute', width: 40, height: 40, borderWidth: 3 },
    tl: { top: 18, left: 18, borderRightWidth: 0, borderBottomWidth: 0 },
    tr: { top: 18, right: 18, borderLeftWidth: 0, borderBottomWidth: 0 },
    bl: { bottom: 18, left: 18, borderRightWidth: 0, borderTopWidth: 0 },
    br: { bottom: 18, right: 18, borderLeftWidth: 0, borderTopWidth: 0 },
    scanLine: { position: 'absolute', left: 22, right: 22, top: '48%', height: 1 },
});

const makeStyles = (C: any, topInset: number) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background, paddingTop: topInset + SIZES.xs },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SIZES.xl,
        marginBottom: SIZES.lg,
        gap: SIZES.sm,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: C.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: C.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    headerCopy: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: SIZES.fontLg, fontWeight: '800', color: C.textPrimary },
    headerSub: { fontSize: SIZES.fontXs, color: C.textMuted, marginTop: 2, fontWeight: '600' },

    reviewScroll: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },
    reviewCard: { gap: SIZES.md },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    reviewIconWrap: { width: 38, height: 38, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center' },
    reviewCopy: { flex: 1, minWidth: 0 },
    reviewTitle: { fontSize: SIZES.fontMd, fontWeight: '800', color: C.textPrimary },
    reviewHint: { fontSize: SIZES.fontXs, color: C.textSecondary, marginTop: 2 },
    reviewThumb: { width: '100%', height: 126, borderRadius: SIZES.borderRadius, backgroundColor: C.surfaceMid },
    textEditor: {
        borderWidth: 1,
        borderRadius: SIZES.borderRadius,
        borderColor: C.border,
        backgroundColor: C.surfaceMid,
        color: C.textPrimary,
        padding: SIZES.md,
        fontSize: SIZES.fontSm,
        lineHeight: 22,
        minHeight: 250,
    },
    reviewActions: { flexDirection: 'row', gap: SIZES.sm },

    infoBlock: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SIZES.sm,
        borderRadius: SIZES.borderRadius,
        borderWidth: 1,
        padding: SIZES.md,
    },
    infoBlockCopy: { flex: 1 },
    infoBlockTitle: { fontSize: SIZES.fontSm, fontWeight: '700', marginBottom: 3 },
    infoBlockBody: { fontSize: SIZES.fontXs, lineHeight: 18 },

    consentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SIZES.sm,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 1,
        flexShrink: 0,
    },
    consentText: { flex: 1, fontSize: SIZES.fontXs, lineHeight: 19 },

    previewWrapper: {
        flex: 1,
        marginHorizontal: SIZES.xl,
        marginBottom: SIZES.md,
        backgroundColor: C.surface,
        borderRadius: SIZES.borderRadius,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
        ...SHADOWS.sm,
    },
    previewTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SIZES.sm,
        padding: SIZES.md,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    previewHint: { fontSize: SIZES.fontXs, color: C.textMuted, fontWeight: '700' },
    scanArea: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: C.surfaceMid },
    scanPattern: { ...StyleSheet.absoluteFillObject, opacity: 0.07 },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm, padding: SIZES.xxl },
    placeholderIcon: { width: 78, height: 78, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.sm },
    placeholderText: { fontSize: SIZES.fontMd, color: C.textPrimary, textAlign: 'center', fontWeight: '800' },
    placeholderSub: { fontSize: SIZES.fontXs, color: C.textSecondary, textAlign: 'center', lineHeight: 18 },

    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,32,51,0.42)', justifyContent: 'center', alignItems: 'center', padding: SIZES.xl },
    overlayCard: { alignItems: 'center', gap: SIZES.sm, minWidth: 210 },
    overlayTitle: { fontSize: SIZES.fontLg, fontWeight: '800', color: C.textPrimary },
    overlaySub: { color: C.textSecondary, fontSize: SIZES.fontSm, textAlign: 'center' },
    aiSteps: { gap: 7, width: '100%' },
    aiStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiStepLabel: { fontSize: SIZES.fontXs, lineHeight: 18 },

    bannerWrap: { paddingHorizontal: SIZES.xl, marginBottom: SIZES.sm },
    banner: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    bannerCopy: { flex: 1, minWidth: 0 },
    bannerTitle: { fontWeight: '800', fontSize: SIZES.fontSm, color: C.textPrimary },
    bannerSub: { color: C.textSecondary, fontSize: SIZES.fontXs, marginTop: 2 },
    errorText: { color: C.error, flex: 1, fontSize: SIZES.fontXs, lineHeight: 18, fontWeight: '600' },

    actionsRow: { flexDirection: 'row', gap: SIZES.md, paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },

    subjectSection: { gap: 6 },
    subjectLabel: { fontSize: SIZES.fontXs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    subjectPills: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1.5,
    },
    pillText: { fontSize: SIZES.fontXs },
});
