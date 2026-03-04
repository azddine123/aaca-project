import React, { useState } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '../contexts/NotesContext';
import { COLORS, SIZES, FONTS, SHADOWS, SUBJECT_COLORS } from '../theme';

export default function NotesScreen() {
    const { notes, fetchNotes, isLoading, searchNotes } = useNotes();
    const [query, setQuery] = useState('');

    const handleSearch = (text: string) => {
        setQuery(text);
        if (text.length > 2) searchNotes(text);
        else if (text.length === 0) fetchNotes();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={FONTS.h2}>Mes Notes</Text>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher..."
                    placeholderTextColor={COLORS.textPlaceholder}
                    value={query}
                    onChangeText={handleSearch}
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => { setQuery(''); fetchNotes(); }}>
                        <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={notes}
                keyExtractor={(item: any) => item.id}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchNotes} tintColor={COLORS.primary} />}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="notebook-plus-outline" size={56} color={COLORS.textSecondary} />
                        <Text style={[FONTS.body1, { marginTop: SIZES.md }]}>Aucune note</Text>
                        <Text style={FONTS.body2}>Capturez votre première note depuis l'accueil</Text>
                    </View>
                }
                renderItem={({ item }: any) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => router.push({ pathname: '/note-detail', params: { id: item.id } })}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.subjectBadge, { backgroundColor: SUBJECT_COLORS[item.subject] || COLORS.primary }]}>
                            <Text style={styles.subjectText}>{item.subject?.toUpperCase().slice(0, 3) || 'GEN'}</Text>
                        </View>
                        <View style={styles.cardInfo}>
                            <Text style={[FONTS.body1, { fontWeight: '600' }]} numberOfLines={1}>{item.title}</Text>
                            <Text style={FONTS.body2} numberOfLines={2}>{item.preview || item.raw_text}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: SIZES.xl, borderRadius: SIZES.borderRadius, paddingHorizontal: SIZES.md, gap: SIZES.sm, marginBottom: SIZES.md, borderWidth: 1, borderColor: COLORS.border },
    searchInput: { flex: 1, height: 44, color: COLORS.textPrimary, fontSize: SIZES.fontMd },
    list: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xl },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius, padding: SIZES.md, marginBottom: SIZES.sm, gap: SIZES.md, ...SHADOWS.sm },
    subjectBadge: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    subjectText: { color: COLORS.white, fontSize: SIZES.fontXs, fontWeight: '700' },
    cardInfo: { flex: 1, gap: 4 },
    empty: { alignItems: 'center', paddingTop: SIZES.xxl * 2, gap: SIZES.sm },
});
