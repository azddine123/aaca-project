import React, { useState, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Image, TextInput,
    ScrollView, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useNotes } from '@/contexts/NotesContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS } from '@/theme';

// idle → creating → capturing → finalizing → done | error
type Phase = 'idle' | 'creating' | 'capturing' | 'finalizing' | 'done' | 'error';

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

export default function SessionNewScreen() {
    const { authFetch } = useAuth();
    const { fetchNotes } = useNotes();
    const C = useAppColors();
    const G = useAppGradients();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [phase, setPhase] = useState<Phase>('idle');
    const [sessionTitle, setSessionTitle] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [captures, setCaptures] = useState<CaptureItem[]>([]);
    const [result, setResult] = useState<FinalResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    // ── Create session ────────────────────────────────────────────────────
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

    // ── Add a capture ─────────────────────────────────────────────────────
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

        // Optimistically add a placeholder
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

    // ── Save corrected text to backend on blur ─────────────────────────────
    const saveCapturText = useCallback(async (captureId: string, text: string) => {
        if (!sessionId || captureId.startsWith('local-')) return;
        try {
            await authFetch(`${API_URL}/sessions/${sessionId}/captures/${captureId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ corrected_text: text }),
            });
        } catch {
            // silent — user can retry via finalize
        }
    }, [authFetch, sessionId]);

    const updateCaptureText = useCallback((id: string, text: string) => {
        setCaptures(prev => prev.map(c => c.id === id ? { ...c, text } : c));
    }, []);

    // ── Finalize session ──────────────────────────────────────────────────
    const finalize = useCallback(async () => {
        if (!sessionId) return;
        if (captures.length === 0) {
            Alert.alert('Aucune capture', 'Ajoutez au moins une photo avant de finaliser.');
            return;
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
    }, [authFetch, sessionId, captures, fetchNotes]);

    const reset = () => {
        setPhase('idle');
        setSessionTitle('');
        setSessionId(null);
        setCaptures([]);
        setResult(null);
        setErrorMsg('');
    };

    const isWorking = phase === 'creating' || phase === 'finalizing';

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={C.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Séance multi-photos</Text>
                {phase === 'capturing' ? (
                    <TouchableOpacity onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialCommunityIcons name="close" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 38 }} />
                )}
            </View>

            {/* ── Setup phase ── */}
            {phase === 'idle' && (
                <ScrollView contentContainerStyle={styles.setupContent}>
                    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                        <View style={[styles.iconWrap, { backgroundColor: C.primary + '18' }]}>
                            <MaterialCommunityIcons name="book-multiple-outline" size={28} color={C.primary} />
                        </View>
                        <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Nouvelle séance</Text>
                        <Text style={[styles.cardSub, { color: C.textSecondary }]}>
                            Capturez plusieurs photos d'un même cours. Elles seront fusionnées en une note complète.
                        </Text>

                        <Text style={[styles.label, { color: C.textSecondary }]}>Titre de la séance</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: C.surfaceMid, borderColor: C.border, color: C.textPrimary }]}
                            value={sessionTitle}
                            onChangeText={setSessionTitle}
                            placeholder="ex: Cours de thermodynamique"
                            placeholderTextColor={C.textMuted}
                            returnKeyType="done"
                        />

                        <TouchableOpacity
                            style={[styles.primaryBtn, { opacity: !sessionTitle.trim() ? 0.4 : 1 }]}
                            onPress={startSession}
                            disabled={!sessionTitle.trim()}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={G.primary} style={styles.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <MaterialCommunityIcons name="play-circle-outline" size={18} color="#fff" />
                                <Text style={styles.primaryBtnText}>Démarrer la séance</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}

            {/* ── Creating spinner ── */}
            {phase === 'creating' && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={[styles.loadingText, { color: C.textSecondary }]}>Création de la séance…</Text>
                </View>
            )}

            {/* ── Capturing phase ── */}
            {phase === 'capturing' && (
                <>
                    {/* Session info bar */}
                    <View style={[styles.sessionBar, { backgroundColor: C.surface, borderColor: C.border }]}>
                        <MaterialCommunityIcons name="book-multiple-outline" size={18} color={C.primary} />
                        <Text style={[styles.sessionBarTitle, { color: C.textPrimary }]} numberOfLines={1}>
                            {sessionTitle}
                        </Text>
                        <View style={[styles.countBadge, { backgroundColor: C.primary + '20' }]}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary }}>
                                {captures.length} photo{captures.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>

                    {/* Captures list */}
                    <FlatList
                        data={captures}
                        keyExtractor={item => item.id}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <MaterialCommunityIcons name="camera-plus-outline" size={48} color={C.textMuted} />
                                <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                                    Ajoutez votre première photo
                                </Text>
                            </View>
                        }
                        renderItem={({ item, index }) => (
                            <View style={[styles.captureCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                                <View style={styles.captureHeader}>
                                    <View style={[styles.orderBadge, { backgroundColor: C.primary }]}>
                                        <Text style={styles.orderBadgeText}>{index + 1}</Text>
                                    </View>
                                    <Text style={[styles.captureLabel, { color: C.textSecondary }]}>
                                        {item.saving ? 'Extraction OCR…' : `Confiance: ${Math.round(item.confidence * 100)}%`}
                                    </Text>
                                    {item.saving && <ActivityIndicator size="small" color={C.primary} />}
                                </View>

                                <Image source={{ uri: item.imageUri }} style={styles.thumb} resizeMode="cover" />

                                <TextInput
                                    style={[styles.textEditor, { backgroundColor: C.surfaceMid, borderColor: C.border, color: C.textPrimary }]}
                                    value={item.text}
                                    onChangeText={text => updateCaptureText(item.id, text)}
                                    onBlur={() => saveCapturText(item.id, item.text)}
                                    multiline
                                    textAlignVertical="top"
                                    placeholder="Texte extrait par OCR…"
                                    placeholderTextColor={C.textMuted}
                                    editable={!item.saving}
                                />
                            </View>
                        )}
                    />

                    {/* Bottom actions */}
                    <View style={styles.bottomBar}>
                        <TouchableOpacity
                            style={[styles.addBtnOutline, { borderColor: C.border }]}
                            onPress={() => Alert.alert(
                                'Ajouter une photo',
                                'Choisissez la source',
                                [
                                    { text: 'Caméra', onPress: () => addCapture(true) },
                                    { text: 'Galerie', onPress: () => addCapture(false) },
                                    { text: 'Annuler', style: 'cancel' },
                                ],
                            )}
                            activeOpacity={0.85}
                        >
                            <MaterialCommunityIcons name="camera-plus-outline" size={20} color={C.textSecondary} />
                            <Text style={[styles.addBtnText, { color: C.textSecondary }]}>Ajouter</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.finalizeBtn, { opacity: captures.length === 0 ? 0.4 : 1 }]}
                            onPress={finalize}
                            disabled={captures.length === 0}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={G.primary} style={styles.finalizGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <MaterialCommunityIcons name="brain" size={18} color="#fff" />
                                <Text style={styles.finalizeBtnText}>Finaliser ({captures.length})</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* ── Finalizing spinner ── */}
            {phase === 'finalizing' && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={[styles.loadingText, { color: C.textPrimary }]}>Fusion des captures…</Text>
                    <Text style={[styles.loadingSub, { color: C.textSecondary }]}>
                        L'IA analyse et structure votre cours
                    </Text>
                    <View style={styles.processingTags}>
                        {['Fusion', 'Résumé', 'Quiz', 'Flashcards'].map(tag => (
                            <View key={tag} style={[styles.processingTag, { backgroundColor: C.primary + '20', borderColor: C.primary + '40' }]}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: C.primary }}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* ── Done ── */}
            {phase === 'done' && result && (
                <View style={styles.centered}>
                    <View style={[styles.doneIcon, { backgroundColor: C.success + '18' }]}>
                        <MaterialCommunityIcons name="check-circle-outline" size={56} color={C.success} />
                    </View>
                    <Text style={[styles.doneTitle, { color: C.textPrimary }]}>Note créée !</Text>
                    <Text style={[styles.doneSub, { color: C.textSecondary }]}>
                        {result.capture_count} captures · {result.flashcards_count} flashcards{result.quiz_id ? ' · Quiz disponible' : ''}
                    </Text>
                    <Text style={[styles.doneNoteTitle, { color: C.textPrimary }]} numberOfLines={2}>
                        {result.title}
                    </Text>

                    <View style={styles.doneActions}>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { flex: 1 }]}
                            onPress={() => router.push({ pathname: '/note-detail', params: { id: result.note_id } })}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={G.primary} style={styles.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <Text style={styles.primaryBtnText}>Voir la note</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.outlineBtn, { borderColor: C.border, flex: 1 }]}
                            onPress={reset}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.outlineBtnText, { color: C.textSecondary }]}>Nouvelle séance</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── Error ── */}
            {phase === 'error' && (
                <View style={styles.centered}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={56} color={C.error} />
                    <Text style={[styles.doneTitle, { color: C.error }]}>Erreur</Text>
                    <Text style={[styles.doneSub, { color: C.textSecondary, textAlign: 'center' }]}>{errorMsg}</Text>
                    <TouchableOpacity
                        style={[styles.primaryBtn, { marginTop: SIZES.xl, minWidth: 160 }]}
                        onPress={reset}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={G.primary} style={styles.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={styles.primaryBtnText}>Réessayer</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
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

    // Setup
    setupContent: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl },
    card: { borderRadius: SIZES.borderRadiusLg, padding: SIZES.xl, borderWidth: 1, gap: SIZES.md, ...SHADOWS.sm },
    iconWrap: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.xs },
    cardTitle: { fontSize: SIZES.fontXl, fontWeight: '700' },
    cardSub:   { fontSize: SIZES.fontSm, lineHeight: 20 },
    label:     { fontSize: SIZES.fontXs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    input:     { borderWidth: 1.5, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, paddingVertical: 12, fontSize: SIZES.fontMd },

    // Session bar
    sessionBar: {
        flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
        marginHorizontal: SIZES.xl, marginBottom: SIZES.md,
        padding: SIZES.md, borderRadius: SIZES.borderRadius, borderWidth: 1, ...SHADOWS.sm,
    },
    sessionBarTitle: { flex: 1, fontWeight: '600', fontSize: SIZES.fontSm },
    countBadge: { paddingHorizontal: SIZES.sm, paddingVertical: 3, borderRadius: 999 },

    // Capture cards
    listContent: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl, gap: SIZES.md },
    captureCard: { borderRadius: SIZES.borderRadiusLg, padding: SIZES.md, borderWidth: 1, gap: SIZES.sm, ...SHADOWS.sm },
    captureHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    orderBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    orderBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    captureLabel: { flex: 1, fontSize: SIZES.fontXs },
    thumb: { width: '100%', height: 160, borderRadius: SIZES.borderRadius },
    textEditor: { borderWidth: 1.5, borderRadius: SIZES.borderRadius, padding: SIZES.md, fontSize: SIZES.fontSm, lineHeight: 22, minHeight: 100 },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: SIZES.sm },
    emptyText:  { fontSize: SIZES.fontMd, textAlign: 'center' },

    // Bottom bar
    bottomBar: {
        flexDirection: 'row', gap: SIZES.md,
        paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl, paddingTop: SIZES.sm,
    },
    addBtnOutline: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: SIZES.xs, height: 52, borderRadius: SIZES.borderRadius, borderWidth: 1.5,
    },
    addBtnText: { fontWeight: '600', fontSize: SIZES.fontSm },
    finalizeBtn: { flex: 2, borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.primary },
    finalizGrad: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm },
    finalizeBtnText: { color: '#fff', fontWeight: '700', fontSize: SIZES.fontSm },

    // Shared
    primaryBtn:  { borderRadius: SIZES.borderRadius, overflow: 'hidden', ...SHADOWS.primary },
    primaryGrad: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, paddingHorizontal: SIZES.xl },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: SIZES.fontMd },
    outlineBtn:     { height: 52, borderRadius: SIZES.borderRadius, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    outlineBtnText: { fontWeight: '600', fontSize: SIZES.fontMd },

    // Centered states
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIZES.xxl, gap: SIZES.md },
    loadingText: { fontSize: SIZES.fontLg, fontWeight: '600', marginTop: SIZES.sm },
    loadingSub:  { fontSize: SIZES.fontSm, textAlign: 'center' },
    processingTags: { flexDirection: 'row', gap: SIZES.xs, flexWrap: 'wrap', justifyContent: 'center' },
    processingTag:  { paddingHorizontal: SIZES.sm, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },

    doneIcon:      { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.sm },
    doneTitle:     { fontSize: SIZES.fontXXl, fontWeight: '700' },
    doneSub:       { fontSize: SIZES.fontSm, lineHeight: 20 },
    doneNoteTitle: { fontSize: SIZES.fontMd, fontWeight: '600', color: C.textPrimary, textAlign: 'center', marginVertical: SIZES.xs },
    doneActions:   { flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.md, width: '100%' },
});
