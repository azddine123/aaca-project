import React, { useState } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    TouchableOpacity, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '@/contexts/NotesContext';
import { COLORS, SIZES, FONTS, SHADOWS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const ALL_SUBJECTS = ['all', 'mathematics', 'physics', 'chemistry', 'biology', 'cs', 'engineering', 'economics', 'literature', 'history', 'other'];
const FILTER_LABELS: Record<string, string> = {
    all: 'Toutes',
    ...SUBJECT_LABELS,
};

function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
    } catch {
        return '';
    }
}

export default function NotesScreen() {
    const { notes, fetchNotes, isLoading, searchNotes } = useNotes();
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const handleSearch = (text: string) => {
        setQuery(text);
        if (text.length > 2) searchNotes(text);
        else if (text.length === 0) fetchNotes();
    };

    const clearSearch = () => {
        setQuery('');
        fetchNotes();
    };

    const filteredNotes = activeFilter === 'all'
        ? notes
        : notes.filter((n: any) => n.subject === activeFilter);

    const subjectsWithNotes = ['all', ...Array.from(new Set(notes.map((n: any) => n.subject).filter(Boolean))) as string[]];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mes Notes</Text>
                <Text style={styles.headerCount}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchContainer}>
                <MaterialCommunityIcons name="magnify" size={18} color={COLORS.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher dans vos notes…"
                    placeholderTextColor={COLORS.textMuted}
                    value={query}
                    onChangeText={handleSearch}
                    returnKeyType="search"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Subject filter chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersRow}
                style={styles.filtersScroll}
            >
                {subjectsWithNotes.map((subject) => {
                    const isActive = activeFilter === subject;
                    const color = subject === 'all' ? COLORS.primary : (SUBJECT_COLORS[subject] || COLORS.primary);
                    return (
                        <TouchableOpacity
                            key={subject}
                            style={[
                                styles.chip,
                                isActive && { backgroundColor: color, borderColor: color },
                            ]}
                            onPress={() => setActiveFilter(subject)}
                            activeOpacity={0.75}
                        >
                            {subject !== 'all' && (
                                <View style={[styles.chipDot, { backgroundColor: isActive ? COLORS.white : color }]} />
                            )}
                            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                {FILTER_LABELS[subject] || subject}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Notes list */}
            <FlatList
                data={filteredNotes}
                keyExtractor={(item: any) => item.id}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={fetchNotes}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
                contentContainerStyle={[styles.list, filteredNotes.length === 0 && styles.listEmpty]}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="notebook-plus-outline" size={56} color={COLORS.textMuted} />
                        <Text style={styles.emptyTitle}>
                            {query.length > 0 ? 'Aucun résultat' : 'Aucune note'}
                        </Text>
                        <Text style={styles.emptySub}>
                            {query.length > 0
                                ? `Aucune note ne correspond à "${query}"`
                                : 'Capturez votre première note depuis le bouton central.'}
                        </Text>
                    </View>
                }
                renderItem={({ item }: any) => {
                    const color = SUBJECT_COLORS[item.subject] || COLORS.primary;
                    return (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => router.push({ pathname: '/note-detail', params: { id: item.id } })}
                            activeOpacity={0.8}
                        >
                            {/* Color accent bar */}
                            <View style={[styles.cardAccent, { backgroundColor: color }]} />

                            {/* Subject icon */}
                            <View style={[styles.cardIcon, { backgroundColor: color + '25' }]}>
                                <MaterialCommunityIcons
                                    name={subjectIcon(item.subject)}
                                    size={20}
                                    color={color}
                                />
                            </View>

                            {/* Content */}
                            <View style={styles.cardContent}>
                                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.cardPreview} numberOfLines={2}>
                                    {item.preview || item.raw_text || ''}
                                </Text>
                                <View style={styles.cardFooter}>
                                    <Text style={[styles.cardSubject, { color }]}>
                                        {SUBJECT_LABELS[item.subject] || item.subject || 'Autre'}
                                    </Text>
                                    <Text style={styles.cardDot}>·</Text>
                                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                                </View>
                            </View>

                            <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}

function subjectIcon(subject: string): any {
    const map: Record<string, string> = {
        mathematics: 'function-variant',
        physics: 'atom',
        chemistry: 'flask-outline',
        biology: 'leaf-outline',
        cs: 'code-braces',
        engineering: 'cog-outline',
        economics: 'chart-areaspline',
        literature: 'book-open-outline',
        history: 'castle',
        philosophy: 'lightbulb-outline',
    };
    return map[subject] || 'file-document-outline';
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md },
    headerTitle: { ...FONTS.h2 },
    headerCount: { ...FONTS.caption, paddingBottom: 4 },

    searchContainer: {
        flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
        marginHorizontal: SIZES.xl, marginBottom: SIZES.sm,
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.borderRadius,
        paddingHorizontal: SIZES.md,
        height: 46,
        borderWidth: 1, borderColor: COLORS.border,
    },
    searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.fontMd, height: '100%' },

    filtersScroll: { flexGrow: 0 },
    filtersRow: { paddingHorizontal: SIZES.xl, gap: SIZES.xs, paddingBottom: SIZES.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SIZES.md, paddingVertical: 6, borderRadius: SIZES.borderRadiusFull, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    chipDot: { width: 6, height: 6, borderRadius: 3 },
    chipText: { fontSize: SIZES.fontXs, fontWeight: '600', color: COLORS.textSecondary },
    chipTextActive: { color: COLORS.white },

    list: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxxl },
    listEmpty: { flex: 1 },

    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface, borderRadius: SIZES.borderRadius,
        marginBottom: SIZES.sm, overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    cardAccent: { width: 3, alignSelf: 'stretch' },
    cardIcon: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: SIZES.sm },
    cardContent: { flex: 1, paddingVertical: SIZES.md, paddingLeft: SIZES.sm, paddingRight: 4, gap: 3 },
    cardTitle: { fontSize: SIZES.fontMd, fontWeight: '600', color: COLORS.textPrimary },
    cardPreview: { fontSize: SIZES.fontXs, color: COLORS.textSecondary, lineHeight: 17 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    cardSubject: { fontSize: SIZES.fontXs, fontWeight: '700' },
    cardDot: { fontSize: SIZES.fontXs, color: COLORS.textMuted },
    cardDate: { fontSize: SIZES.fontXs, color: COLORS.textMuted },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, paddingTop: SIZES.xxxl },
    emptyTitle: { ...FONTS.h4, color: COLORS.textSecondary },
    emptySub: { ...FONTS.body2, textAlign: 'center', paddingHorizontal: SIZES.xl },
});
