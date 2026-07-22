import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { AacaButton, AacaCard, ProgressBar } from '@/components/UIKit';
import { ZelligePattern } from '@/components/ZelligePattern';
import { GRADIENTS, SIZES, FONTS, SHADOWS, DARK_COLORS } from '@/theme';
import { getCurrentOffering, purchasePackage, restorePurchases } from '@/lib/purchases';

const FEATURES: { icon: string; label: string }[] = [
    { icon: 'infinity', label: 'Notes illimitées, chaque mois' },
    { icon: 'brain', label: 'Résumés, quiz et flashcards IA sans restriction' },
    { icon: 'flash-outline', label: 'Traitement prioritaire de vos captures' },
];

export default function PaywallScreen() {
    const { auth, refreshPremiumStatus, setPremiumOptimistic } = useAuth();
    const C = useAppColors();
    const insets = useSafeAreaInsets();
    const [offering, setOffering] = useState<any>(null);
    const [loadingOffering, setLoadingOffering] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const current = await getCurrentOffering();
                setOffering(current);
            } catch {
                // Best effort — offering stays null; the UI already handles that gracefully.
            } finally {
                setLoadingOffering(false);
            }
        })();
    }, []);

    const monthlyPackage = offering?.monthly ?? offering?.availablePackages?.[0] ?? null;

    const handlePurchase = useCallback(async () => {
        if (!monthlyPackage) {
            Alert.alert('Indisponible', "L'offre premium n'est pas encore configurée. Réessayez plus tard.");
            return;
        }
        setPurchasing(true);
        try {
            const unlocked = await purchasePackage(monthlyPackage);
            if (unlocked) {
                await refreshPremiumStatus();
                // Always applied last: a stale server read from refreshPremiumStatus() must
                // never clobber the premium unlock we just paid for.
                setPremiumOptimistic();
                Alert.alert('Bienvenue dans Premium', 'Votre abonnement est actif. Bonne étude !');
                router.back();
            }
        } catch (e: any) {
            if (e?.userCancelled) return;
            Alert.alert('Erreur', "L'achat n'a pas pu être finalisé. Réessayez.");
        } finally {
            setPurchasing(false);
        }
    }, [monthlyPackage, refreshPremiumStatus, setPremiumOptimistic]);

    const handleRestore = useCallback(async () => {
        setRestoring(true);
        try {
            const unlocked = await restorePurchases();
            await refreshPremiumStatus();
            if (unlocked) {
                // Always applied last: a stale server read from refreshPremiumStatus() must
                // never clobber the premium unlock we just restored.
                setPremiumOptimistic();
            }
            Alert.alert(
                unlocked ? 'Abonnement restauré' : 'Aucun abonnement trouvé',
                unlocked ? 'Votre accès premium a été restauré.' : "Aucun achat premium actif n'a été trouvé sur ce compte."
            );
            if (unlocked) router.back();
        } catch {
            Alert.alert('Erreur', "La restauration n'a pas pu aboutir. Réessayez.");
        } finally {
            setRestoring(false);
        }
    }, [refreshPremiumStatus, setPremiumOptimistic]);

    const priceLabel = monthlyPackage?.product?.priceString ?? '—';

    return (
        <View style={[styles.container, { backgroundColor: C.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SIZES.lg }]} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <LinearGradient colors={GRADIENTS.hero} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.heroPattern}>
                        <ZelligePattern color={C.primary} opacity={0.5} tileSize={28} cols={9} rows={4} />
                    </View>
                    <View style={[styles.crown, SHADOWS.primary]}>
                        <LinearGradient colors={GRADIENTS.primary} style={StyleSheet.absoluteFillObject} />
                        <MaterialCommunityIcons name="crown" size={30} color="#fff" />
                    </View>
                    <Text style={[FONTS.h2, styles.heroTitle, { color: DARK_COLORS.textPrimary }]}>Passez à Premium</Text>
                    <Text style={[FONTS.body1, styles.heroSub, { color: DARK_COLORS.textSecondary }]}>
                        Débloquez des notes illimitées et toute la puissance de l'IA, sans limite mensuelle.
                    </Text>
                </View>

                <AacaCard style={styles.quotaCard}>
                    <View style={styles.quotaHeader}>
                        <Text style={[FONTS.body2, { color: C.textSecondary }]}>Votre quota gratuit ce mois-ci</Text>
                        <Text style={[FONTS.h4, { color: C.textPrimary }]}>
                            {auth.notesUsedThisMonth}/{auth.notesQuota}
                        </Text>
                    </View>
                    <ProgressBar
                        value={auth.notesQuota > 0 ? auth.notesUsedThisMonth / auth.notesQuota : 0}
                        color={auth.notesUsedThisMonth >= auth.notesQuota ? C.error : C.primary}
                    />
                </AacaCard>

                <View style={styles.features}>
                    {FEATURES.map((f) => (
                        <View key={f.label} style={styles.featureRow}>
                            <View style={[styles.featureIcon, { backgroundColor: C.accent + '18' }]}>
                                <MaterialCommunityIcons name={f.icon as any} size={18} color={C.accent} />
                            </View>
                            <Text style={[FONTS.body1, styles.featureLabel, { color: C.textPrimary }]}>{f.label}</Text>
                        </View>
                    ))}
                </View>

                <AacaCard style={styles.offerCard} accentColor={C.primary}>
                    {loadingOffering ? (
                        <ActivityIndicator color={C.primary} />
                    ) : (
                        <>
                            <Text style={[FONTS.h3, { color: C.textPrimary }]}>{priceLabel} / mois</Text>
                            <Text style={[FONTS.body2, styles.offerSub, { color: C.textMuted }]}>Résiliable à tout moment</Text>
                        </>
                    )}
                </AacaCard>

                <AacaButton
                    label="S'abonner"
                    icon="crown-outline"
                    full
                    loading={purchasing}
                    disabled={loadingOffering || purchasing}
                    onPress={handlePurchase}
                    style={styles.subscribeBtn}
                />
                <AacaButton
                    label="Restaurer mes achats"
                    variant="ghost"
                    full
                    loading={restoring}
                    disabled={restoring}
                    onPress={handleRestore}
                    style={styles.restoreBtn}
                />
                <Text
                    style={[FONTS.caption, styles.closeLink, { color: C.textMuted }]}
                    onPress={() => router.back()}
                >
                    Pas maintenant
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl, gap: SIZES.lg },
    hero: {
        borderRadius: SIZES.borderRadiusXl,
        overflow: 'hidden',
        alignItems: 'center',
        paddingVertical: SIZES.xxl,
        paddingHorizontal: SIZES.lg,
    },
    heroPattern: { ...StyleSheet.absoluteFillObject },
    crown: {
        width: 64, height: 64, borderRadius: SIZES.borderRadiusFull,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        marginBottom: SIZES.md,
    },
    heroTitle: { textAlign: 'center', marginBottom: SIZES.xs },
    heroSub: { textAlign: 'center', maxWidth: 280 },
    quotaCard: { gap: SIZES.sm },
    quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    features: { gap: SIZES.md },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    featureIcon: { width: 34, height: 34, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center' },
    featureLabel: { flex: 1 },
    offerCard: { alignItems: 'center', paddingVertical: SIZES.lg },
    offerSub: { marginTop: 2 },
    subscribeBtn: { marginTop: SIZES.sm },
    restoreBtn: {},
    closeLink: { textAlign: 'center', marginTop: SIZES.sm, textDecorationLine: 'underline' },
});
