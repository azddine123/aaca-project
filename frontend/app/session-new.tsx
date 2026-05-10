import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, TextInput,
    ScrollView, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { AacaButton, AacaCard, CaptureTimelineItem, StatusBadge } from '@/components/UIKit';
import { ZelligePattern } from '@/components/ZelligePattern';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS } from '@/theme';

const AI_STEPS_SESSION = [
    { label: 'Fusion des pages', icon: 'layers-outline' },
    { label: 'Analyse du contenu', icon: 'magnify' },
    { label: 'Création du résumé', icon: 'text-box-outline' },
    { label: 'Génération des exercices', icon: 'clipboard-check-outline' },
    { label: 'Préparation des flashcards', icon: 'cards-outline' },
];

// idle -> creating -> capturing -> finalizing -> done | error
type Phase = 'idle' | 'creating' | 'capturing' | 'finalizing' | 'done' | 'error';
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

interface CaptureItem {
    id: string;
    imageUri: string;
    text: string;
    confidence: number;
    saving: boolean;
}

interface FinalResult {
    note_id: string;
    quiz_id?: string;
    flashcards_count: number;
    capture_count: number;
    title: string;
}

type TimelineStatus = {
    label: string;
    tone: 'success' | 'warning' | 'pending' | 'info';
    meta: string;
};

function captureStatus(item: CaptureItem): TimelineStatus {
    if (item.saving) {
        return { label: 'En attente', tone: 'pending', meta: 'OCR en cours' };
    }
    const confidence = Math.round((item.confidence || 0) * 100);
    if (!item.text.trim()) {
        return { label: 'OCR terminé', tone: 'info', meta: `Confiance ${confidence}%` };
    }
    if ((item.confidence || 0) < 0.78) {
        return { label: 'À corriger', tone: 'warning', meta: `Confiance ${confidence}%` };
    }
    return { label: 'Validé', tone: 'success', meta: `Confiance ${confidence}%` };
}

export default function SessionNewScreen() {
    const { authFetch } = useAuth();
    const { fetchNotes } = useNotes();
    const C = useAppColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(C, insets.top), [C, insets.top]);

    const [phase, setPhase] = useState<Phase>('idle');
    const [sessionTitle, setSessionTitle] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [captures, setCaptures] = useState<CaptureItem[]>([]);
    const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
    const [result, setResult] = useState<FinalResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [aiStep, setAiStep] = useState(0);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (phase !== 'finalizing') { setAiStep(0); return; }
        const t = setInterval(() => setAiStep(i => Math.min(i + 1, AI_STEPS_SESSION.length - 1)), 2200);
        return () => clearInterval(t);
    }, [phase]);

    const startSession = useCallback(async () => {
        const title = sessionTitle.trim();
        if (!title) {
            Alert.alert('Titre requis', 'Donnez un titre à votre séance.');
            return;
        }
        setPhase('creating');
        try {
            const res = await authFetch(`${API_URL}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });
            if (!res.ok) throw new Error('Impossible de créer la séance');
            const data = await res.json();
            setSessionId(data.id);
            setPhase('capturing');
        } catch (e: any) {
            setErrorMsg(e.message || 'Erreur réseau');
            setPhase('error');
        }
    }, [authFetch, sessionTitle]);

    const addCapture = useCallback(async (fromCamera: boolean) => {
        if (!sessionId) return;

        let uri: string | null = null;
        if (fromCamera) {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert('Permission requise', "L'accès à la caméra est nécessaire.");
                return;
            }
            const picked = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 });
            if (!picked.canceled && picked.assets[0]) uri = picked.assets[0].uri;
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', "L'accès à la galerie est nécessaire.");
                return;
            }
            const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
            if (!picked.canceled && picked.assets[0]) uri = picked.assets[0].uri;
        }

        if (!uri) return;

        const placeholderId = `local-${Date.now()}`;
        setCaptures(prev => [...prev, {
            id: placeholderId,
            imageUri: uri!,
            text: '',
            confidence: 0,
            saving: true,
        }]);

        try {
            const form = new FormData();
            form.append('file', { uri, name: 'capture.jpg', type: 'image/jpeg' } as any);
            const res = await authFetch(
                `${API_URL}/sessions/${sessionId}/captures/ocr`,
                { method: 'POST', body: form },
            );
            if (!res.ok) throw new Error('OCR échoué');
            const capture = await res.json();

            setCaptures(prev => prev.map(c =>
                c.id === placeholderId
                    ? { id: capture.id, imageUri: uri!, text: capture.corrected_text || capture.raw_text || '', confidence: capture.confidence || 0, saving: false }
                    : c
            ));
        } catch (e: any) {
            setCaptures(prev => prev.filter(c => c.id !== placeholderId));
            Alert.alert('Erreur OCR', e.message || "Impossible d'extraire le texte.");
        }
    }, [authFetch, sessionId]);

    const saveCapturText = useCallback(async (captureId: string, text: string): Promise<boolean> => {
        if (!sessionId || captureId.startsWith('local-')) return true;
        setSaveStates(prev => ({ ...prev, [captureId]: 'saving' }));
        try {
            await authFetch(`${API_URL}/sessions/${sessionId}/captures/${captureId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ corrected_text: text }),
            });
            setSaveStates(prev => ({ ...prev, [captureId]: 'saved' }));
            setTimeout(() => setSaveStates(prev =>
                prev[captureId] === 'saved' ? { ...prev, [captureId]: 'idle' } : prev
            ), 2500);
            return true;
        } catch {
            setSaveStates(prev => ({ ...prev, [captureId]: 'dirty' }));
            return false;
        }
    }, [authFetch, sessionId]);

    const updateCaptureText = useCallback((id: string, text: string) => {
        setCaptures(prev => prev.map(c => c.id === id ? { ...c, text } : c));
        setSaveStates(prev => ({ ...prev, [id]: 'dirty' }));
    }, []);

    const finalize = useCallback(async () => {
        if (!sessionId) return;
        if (captures.length === 0) {
            Alert.alert('Aucune capture', 'Ajoutez au moins une photo avant de finaliser.');
            return;
        }

        // Block if any save is already in progress
        const hasSaving = captures.some(c => saveStates[c.id] === 'saving');
        if (hasSaving) {
            Alert.alert('Enregistrement en cours', "Attendez la fin de l'enregistrement avant de finaliser.");
            return;
        }

        // Flush all dirty captures before calling finalize
        const dirty = captures.filter(c => !c.id.startsWith('local-') && saveStates[c.id] === 'dirty');
        if (dirty.length > 0) {
            const results = await Promise.all(dirty.map(c => saveCapturText(c.id, c.text)));
            if (results.some(ok => !ok)) {
                Alert.alert('Erreur', "Certaines corrections n'ont pas pu être sauvegardées. Vérifiez votre connexion.");
                return;
            }
        }

        setPhase('finalizing');
        try {
            const res = await authFetch(`${API_URL}/sessions/${sessionId}/finalize`, {
                method: 'POST',
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Finalisation échouée');
            }
            const data = await res.json();
            setResult(data);
            setPhase('done');
            fetchNotes();
        } catch (e: any) {
            setErrorMsg(e.message || 'Erreur lors de la finalisation');
            setPhase('error');
        }
    }, [authFetch, sessionId, captures, saveStates, saveCapturText, fetchNotes]);

    const removeCapture = useCallback((captureId: string, index: number) => {
        Alert.alert(
            'Supprimer la page',
            `Voulez-vous supprimer la page ${index + 1} ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer', style: 'destructive', onPress: async () => {
                        // Local-only captures (OCR not yet saved) just remove from state
                        if (captureId.startsWith('local-') || !sessionId) {
                            setCaptures(prev => prev.filter(c => c.id !== captureId));
                            setSaveStates(prev => { const next = { ...prev }; delete next[captureId]; return next; });
                            return;
                        }
                        setDeletingIds(prev => new Set(prev).add(captureId));
                        try {
                            const res = await authFetch(
                                `${API_URL}/sessions/${sessionId}/captures/${captureId}`,
                                { method: 'DELETE' },
                            );
                            if (!res.ok) {
                                const err = await res.json().catch(() => ({}));
                                Alert.alert('Erreur', err.detail || 'Impossible de supprimer la page.');
                                return;
                            }
                            setCaptures(prev => prev.filter(c => c.id !== captureId));
                            setSaveStates(prev => { const next = { ...prev }; delete next[captureId]; return next; });
                        } catch {
                            Alert.alert('Erreur réseau', 'La suppression a échoué. Vérifiez votre connexion.');
                        } finally {
                            setDeletingIds(prev => { const next = new Set(prev); next.delete(captureId); return next; });
                        }
                    },
                },
            ],
        );
    }, [authFetch, sessionId]);

    const reset = () => {
        setPhase('idle');
        setSessionTitle('');
        setSessionId(null);
        setCaptures([]);
        setResult(null);
        setErrorMsg('');
    };

    const showSourcePicker = () => Alert.alert(
        'Ajouter une photo',
        'Choisissez la source',
        [
            { text: 'Caméra', onPress: () => addCapture(true) },
            { text: 'Galerie', onPress: () => addCapture(false) },
            { text: 'Annuler', style: 'cancel' },
        ],
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
                    <Text style={styles.headerTitle}>Nouvelle séance</Text>
                    <Text style={styles.headerSub}>Séance multi-pages</Text>
                </View>
                {phase === 'capturing' ? (
                    <TouchableOpacity onPress={reset} style={styles.iconBtn}>
                        <MaterialCommunityIcons name="close" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 38 }} />
                )}
            </View>

            {phase === 'idle' && (
                <ScrollView contentContainerStyle={styles.setupContent}>
                    <AacaCard style={styles.setupCard}>
                        <View style={styles.setupPattern}>
                            <ZelligePattern color={C.primary} opacity={1} tileSize={30} cols={8} rows={5} />
                        </View>
                        <View style={[styles.iconWrap, { backgroundColor: C.primary + '14' }]}>
                            <MaterialCommunityIcons name="book-multiple-outline" size={28} color={C.primary} />
                        </View>
                        <Text style={styles.cardTitle}>Créer une séance de cours</Text>
                        <Text style={styles.cardSub}>
                            {"Chaque photo devient une étape du cours. Vous pourrez corriger l'OCR avant de fusionner la séance."}
                        </Text>

                        <Text style={styles.label}>Titre de la séance</Text>
                        <TextInput
                            style={styles.input}
                            value={sessionTitle}
                            onChangeText={setSessionTitle}
                            placeholder="ex: Thermodynamique - chapitre 2"
                            placeholderTextColor={C.textMuted}
                            returnKeyType="done"
                        />

                        <AacaButton
                            label="Démarrer la séance"
                            icon="play-circle-outline"
                            onPress={startSession}
                            disabled={!sessionTitle.trim()}
                        />
                    </AacaCard>
                </ScrollView>
            )}

            {phase === 'creating' && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={styles.loadingText}>Création de la séance...</Text>
                </View>
            )}

            {phase === 'capturing' && (
                <>
                    <View style={styles.sessionBar}>
                        <View style={[styles.sessionIcon, { backgroundColor: C.primary + '14' }]}>
                            <MaterialCommunityIcons name="book-open-page-variant-outline" size={18} color={C.primary} />
                        </View>
                        <View style={styles.sessionCopy}>
                            <Text style={styles.sessionBarTitle} numberOfLines={1}>{sessionTitle}</Text>
                            <Text style={styles.sessionBarSub}>Les captures seront fusionnées dans cet ordre.</Text>
                        </View>
                        <StatusBadge label={`${captures.length} photo${captures.length !== 1 ? 's' : ''}`} tone="info" />
                    </View>

                    <FlatList
                        data={captures}
                        keyExtractor={item => item.id}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <View style={styles.emptyRail} />
                                <View style={[styles.emptyIcon, { backgroundColor: C.primary + '12' }]}>
                                    <MaterialCommunityIcons name="camera-plus-outline" size={34} color={C.primary} />
                                </View>
                                <Text style={styles.emptyTitle}>Ajoutez la première étape</Text>
                                <Text style={styles.emptyText}>Une séance claire commence par une première capture de cours.</Text>
                            </View>
                        }
                        renderItem={({ item, index }) => {
                            const status = captureStatus(item);
                            const saveState = saveStates[item.id] || 'idle';
                            const editorBorderColor = saveState === 'dirty' ? C.warning + '80'
                                : saveState === 'saving' ? C.primary + '80'
                                : saveState === 'saved' ? C.success + '60'
                                : C.border;
                            return (
                                <CaptureTimelineItem
                                    index={index + 1}
                                    imageUri={item.imageUri}
                                    title={`Page ${index + 1}`}
                                    statusLabel={status.label}
                                    statusTone={status.tone}
                                    meta={status.meta}
                                    isLast={index === captures.length - 1}
                                >
                                    <TextInput
                                        style={[styles.textEditor, { borderColor: editorBorderColor }]}
                                        value={item.text}
                                        onChangeText={text => updateCaptureText(item.id, text)}
                                        onBlur={() => saveCapturText(item.id, item.text)}
                                        multiline
                                        textAlignVertical="top"
                                        placeholder={item.saving ? 'OCR en cours...' : 'Texte extrait par OCR...'}
                                        placeholderTextColor={C.textMuted}
                                        editable={!item.saving}
                                    />
                                    <View style={styles.captureActions}>
                                        {saveState !== 'idle' && (
                                            <View style={styles.saveIndicator}>
                                                {saveState === 'saving' && (
                                                    <ActivityIndicator size="small" color={C.textMuted} style={{ transform: [{ scale: 0.65 }] }} />
                                                )}
                                                <MaterialCommunityIcons
                                                    name={saveState === 'saved' ? 'check-circle-outline' : saveState === 'dirty' ? 'pencil-outline' : 'sync'}
                                                    size={11}
                                                    color={saveState === 'saved' ? C.success : saveState === 'dirty' ? C.warning : C.textMuted}
                                                />
                                                <Text style={[styles.saveStateText, {
                                                    color: saveState === 'saved' ? C.success : saveState === 'dirty' ? C.warning : C.textMuted,
                                                }]}>
                                                    {saveState === 'dirty' ? 'Modifié' : saveState === 'saving' ? 'Enregistrement…' : 'Enregistré'}
                                                </Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.deleteBtn, (item.saving || deletingIds.has(item.id)) && { opacity: 0.4 }]}
                                            onPress={() => removeCapture(item.id, index)}
                                            disabled={item.saving || deletingIds.has(item.id) || saveStates[item.id] === 'saving'}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Supprimer la page ${index + 1}`}
                                        >
                                            {deletingIds.has(item.id)
                                                ? <ActivityIndicator size="small" color={C.error} style={{ transform: [{ scale: 0.65 }] }} />
                                                : <MaterialCommunityIcons name="trash-can-outline" size={14} color={C.error} />
                                            }
                                            <Text style={[styles.deleteBtnText, { color: C.error }]}>
                                                {deletingIds.has(item.id) ? 'Suppression…' : 'Supprimer'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </CaptureTimelineItem>
                            );
                        }}
                    />

                    <View style={styles.bottomBar}>
                        <AacaButton
                            label="Ajouter"
                            icon="camera-plus-outline"
                            variant="secondary"
                            onPress={showSourcePicker}
                            full
                        />
                        <AacaButton
                            label={`Finaliser (${captures.length})`}
                            icon="brain"
                            onPress={finalize}
                            disabled={captures.length === 0 || captures.some(c => c.saving || saveStates[c.id] === 'saving') || deletingIds.size > 0}
                            full
                        />
                    </View>
                    {captures.length > 0 && (captures.some(c => c.saving || saveStates[c.id] === 'saving') || deletingIds.size > 0) && (
                        <Text style={[styles.finalizeHint, { color: C.textMuted }]}>
                            {'En attente de la fin des traitements OCR…'}
                        </Text>
                    )}
                </>
            )}

            {phase === 'finalizing' && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={styles.loadingText}>Génération de la note…</Text>
                    <Text style={styles.loadingSub}>PicLearn structure le cours, le résumé et les exercices.</Text>
                    <View style={[styles.aiSteps, { borderColor: C.border, backgroundColor: C.surface }]}>
                        {AI_STEPS_SESSION.map((s, i) => {
                            const done = i < aiStep;
                            const active = i === aiStep;
                            return (
                                <View key={s.label} style={styles.aiStepRow}>
                                    <MaterialCommunityIcons
                                        name={(done ? 'check-circle' : active ? s.icon : 'circle-outline') as any}
                                        size={18}
                                        color={done ? C.success : active ? C.primary : C.textMuted}
                                    />
                                    <Text style={[styles.aiStepLabel, {
                                        color: done ? C.success : active ? C.textPrimary : C.textMuted,
                                        fontWeight: active ? '700' : '500',
                                    }]}>{s.label}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {phase === 'done' && result && (
                <View style={styles.centered}>
                    <View style={[styles.doneIcon, { backgroundColor: C.success + '16' }]}>
                        <MaterialCommunityIcons name="check-circle-outline" size={56} color={C.success} />
                    </View>
                    <Text style={styles.doneTitle}>Séance finalisée</Text>
                    <Text style={styles.doneSub}>
                        {result.capture_count} captures · {result.flashcards_count} flashcards{result.quiz_id ? ' · Quiz disponible' : ''}
                    </Text>
                    <AacaCard style={styles.resultCard}>
                        <Text style={styles.doneNoteTitle} numberOfLines={2}>{result.title}</Text>
                    </AacaCard>

                    <View style={styles.doneActions}>
                        <AacaButton
                            label="Voir la note"
                            icon="file-document-outline"
                            onPress={() => router.push({ pathname: '/note-detail', params: { id: result.note_id } })}
                            full
                        />
                        <AacaButton
                            label="Nouvelle"
                            icon="plus"
                            variant="secondary"
                            onPress={reset}
                            full
                        />
                    </View>
                </View>
            )}

            {phase === 'error' && (
                <View style={styles.centered}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={56} color={C.error} />
                    <Text style={[styles.doneTitle, { color: C.error }]}>Erreur</Text>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <AacaButton
                        label="Réessayer"
                        icon="refresh"
                        onPress={reset}
                        style={{ marginTop: SIZES.lg, minWidth: 170 }}
                    />
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

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

    setupContent: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },
    setupCard: { gap: SIZES.md, position: 'relative' },
    setupPattern: { position: 'absolute', right: -30, top: -20, width: 220, height: 160, opacity: 0.07 },
    iconWrap: { width: 56, height: 56, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.xs },
    cardTitle: { fontSize: SIZES.fontXl, fontWeight: '800', color: C.textPrimary },
    cardSub: { fontSize: SIZES.fontSm, lineHeight: 20, color: C.textSecondary },
    label: { fontSize: SIZES.fontXs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0, color: C.textSecondary },
    input: {
        borderWidth: 1,
        borderRadius: SIZES.borderRadius,
        borderColor: C.border,
        backgroundColor: C.surfaceMid,
        color: C.textPrimary,
        paddingHorizontal: SIZES.md,
        paddingVertical: 12,
        fontSize: SIZES.fontMd,
    },

    sessionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SIZES.sm,
        marginHorizontal: SIZES.xl,
        marginBottom: SIZES.md,
        padding: SIZES.md,
        borderRadius: SIZES.borderRadius,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
        ...SHADOWS.sm,
    },
    sessionIcon: { width: 38, height: 38, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center' },
    sessionCopy: { flex: 1, minWidth: 0 },
    sessionBarTitle: { fontWeight: '800', fontSize: SIZES.fontSm, color: C.textPrimary },
    sessionBarSub: { fontSize: SIZES.fontXs, color: C.textMuted, marginTop: 2 },

    listContent: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl, gap: SIZES.md },
    textEditor: {
        borderWidth: 1,
        borderRadius: SIZES.borderRadius,
        borderColor: C.border,
        backgroundColor: C.surfaceMid,
        color: C.textPrimary,
        padding: SIZES.md,
        fontSize: SIZES.fontSm,
        lineHeight: 22,
        minHeight: 118,
    },

    emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 78, paddingHorizontal: SIZES.xl, gap: SIZES.sm },
    emptyRail: { width: 2, height: 58, backgroundColor: C.primary + '20', borderRadius: 1, marginBottom: -4 },
    emptyIcon: { width: 68, height: 68, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: SIZES.fontMd, color: C.textPrimary, fontWeight: '800', textAlign: 'center' },
    emptyText: { fontSize: SIZES.fontSm, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

    bottomBar: {
        flexDirection: 'row',
        gap: SIZES.md,
        paddingHorizontal: SIZES.xl,
        paddingBottom: SIZES.xxl,
        paddingTop: SIZES.sm,
        backgroundColor: C.background,
    },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIZES.xxl, gap: SIZES.md },
    loadingText: { fontSize: SIZES.fontLg, fontWeight: '800', color: C.textPrimary, marginTop: SIZES.sm },
    loadingSub: { fontSize: SIZES.fontSm, textAlign: 'center', color: C.textSecondary },
    processingTags: { flexDirection: 'row', gap: SIZES.xs, flexWrap: 'wrap', justifyContent: 'center' },

    doneIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.sm },
    doneTitle: { fontSize: SIZES.fontXXl, fontWeight: '800', color: C.textPrimary },
    doneSub: { fontSize: SIZES.fontSm, lineHeight: 20, color: C.textSecondary, textAlign: 'center' },
    resultCard: { width: '100%', alignItems: 'center', marginTop: SIZES.sm },
    doneNoteTitle: { fontSize: SIZES.fontMd, fontWeight: '800', color: C.textPrimary, textAlign: 'center' },
    doneActions: { flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.md, width: '100%' },
    errorText: { fontSize: SIZES.fontSm, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

    captureActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
    saveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    saveStateText: { fontSize: 10, fontWeight: '700' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
    deleteBtnText: { fontSize: 11, fontWeight: '700' },
    finalizeHint: { textAlign: 'center', fontSize: SIZES.fontXs, paddingBottom: SIZES.sm, paddingHorizontal: SIZES.xl },

    aiSteps: { width: '100%', borderWidth: 1, borderRadius: SIZES.borderRadius, padding: SIZES.md, gap: SIZES.sm, marginTop: SIZES.sm },
    aiStepRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    aiStepLabel: { fontSize: SIZES.fontSm },
});
