import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './contexts/AuthContext';
import { API_URL } from './config/api';
import { COLORS, SIZES, FONTS, SHADOWS } from './theme';


export default function CaptureScreen() {
    const { auth } = useAuth();
    const [processing, setProcessing] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);

    const pickImage = async (fromCamera: boolean) => {
        const { status } = fromCamera
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission requise', fromCamera ? "L'accès à la caméra est nécessaire." : "L'accès à la galerie est nécessaire.");
            return;
        }

        const picked = fromCamera
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });

        if (!picked.canceled && picked.assets[0]) {
            setPreview(picked.assets[0].uri);
            setResult(null);
            await processImage(picked.assets[0].uri);
        }
    };

    const processImage = async (uri: string) => {
        setProcessing(true);
        try {
            const form = new FormData();
            form.append('file', { uri, name: 'capture.jpg', type: 'image/jpeg' } as any);
            const res = await fetch(`${API_URL}/process/capture`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${auth.token}` },
                body: form,
            });
            if (!res.ok) throw new Error('Traitement échoué');
            const data = await res.json();
            setResult(data);
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Impossible de traiter l\'image');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={FONTS.h3}>Capturer une note</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* Preview */}
            <View style={styles.previewArea}>
                {preview ? (
                    <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="contain" />
                ) : (
                    <View style={styles.placeholder}>
                        <MaterialCommunityIcons name="image-outline" size={64} color={COLORS.textSecondary} />
                        <Text style={FONTS.body2}>Aucune image sélectionnée</Text>
                    </View>
                )}
                {processing && (
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={[FONTS.body1, { color: COLORS.white, marginTop: SIZES.md }]}>Analyse en cours…</Text>
                    </View>
                )}
            </View>

            {/* Result */}
            {result && !processing && (
                <View style={styles.resultCard}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
                    <Text style={[FONTS.body1, { fontWeight: '600' }]}>Note créée avec succès !</Text>
                    <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => router.push({ pathname: '/note-detail', params: { id: result.note_id } })}
                    >
                        <Text style={styles.viewBtnText}>Voir la note</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(true)} disabled={processing}>
                    <MaterialCommunityIcons name="camera-outline" size={28} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.surface }]} onPress={() => pickImage(false)} disabled={processing}>
                    <MaterialCommunityIcons name="image-outline" size={28} color={COLORS.primary} />
                    <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Galerie</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 56 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, marginBottom: SIZES.xl },
    backBtn: { padding: 4 },
    previewArea: { flex: 1, margin: SIZES.xl, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', ...SHADOWS.sm },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center', gap: SIZES.md },
    processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.85)', justifyContent: 'center', alignItems: 'center' },
    resultCard: { margin: SIZES.xl, backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.xl, alignItems: 'center', gap: SIZES.md, borderWidth: 1, borderColor: COLORS.success },
    viewBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xl, paddingVertical: SIZES.sm, borderRadius: SIZES.borderRadius },
    viewBtnText: { color: COLORS.white, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: SIZES.md, padding: SIZES.xl, paddingTop: 0 },
    actionBtn: { flex: 1, backgroundColor: COLORS.primary, height: 56, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', gap: 4, ...SHADOWS.sm },
    actionBtnText: { color: COLORS.white, fontWeight: '600', fontSize: SIZES.fontSm },
});
