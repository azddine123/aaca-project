import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../theme';

export default function StudyScreen() {
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={[FONTS.h2, { paddingTop: 56 }]}>Zone d'étude</Text>
            <Text style={[FONTS.body2, { marginBottom: SIZES.xl }]}>
                Sélectionnez une note pour commencer à étudier
            </Text>

            <View style={styles.card}>
                <MaterialCommunityIcons name="cards-outline" size={40} color={COLORS.primary} />
                <Text style={FONTS.h3}>Flashcards</Text>
                <Text style={styles.cardDesc}>Révisez avec des cartes mémoire à répétition espacée</Text>
            </View>

            <View style={styles.card}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={40} color={COLORS.success} />
                <Text style={FONTS.h3}>Quiz</Text>
                <Text style={styles.cardDesc}>Testez vos connaissances avec des QCM adaptatifs</Text>
            </View>

            <View style={styles.empty}>
                <MaterialCommunityIcons name="arrow-up-circle-outline" size={36} color={COLORS.textSecondary} />
                <Text style={FONTS.body2}>Ouvrez une note depuis l'onglet Notes pour démarrer une session</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SIZES.xl, gap: SIZES.lg },
    card: { backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.xl, alignItems: 'center', gap: SIZES.sm, ...SHADOWS.sm },
    cardDesc: { ...FONTS.body2, textAlign: 'center' },
    empty: { alignItems: 'center', padding: SIZES.xl, gap: SIZES.md, marginTop: SIZES.xl },
});
