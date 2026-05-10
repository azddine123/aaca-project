import React, { useState, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    TouchableOpacity, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotes, Note } from '@/contexts/NotesContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { AacaButton, AacaCard, CaptureMenuModal, EmptyState, SubjectBadge } from '@/components/UIKit';
import { SIZES, SUBJECT_COLORS, SUBJECT_LABELS } from '@/theme';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const FILTER_LABELS: Record<string, string> = { all: 'Toutes', ...SUBJECT_LABELS };

function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr }); }
    catch { return ''; }
}

function subjectIcon(subject: string): string {
    const map: Record<string, string> = {
        mathematics: 'function-variant',
        physics: 'atom',
        chemistry: 'flask-outline',
        biology: 'leaf-outline',
        cs: 'code-braces',
        computer_science: 'code-braces',
        engineering: 'cog-outline',
        economics: 'chart-areaspline',
        literature: 'book-open-outline',
        history: 'castle',
        philosophy: 'lightbulb-outline',
        french: 'alphabetical-variant',
        arabic: 'abjad-arabic',
        geography: 'map-outline',
    };
    return map[subject] || 'file-document-outline';
}

function notePreview(note: Note): string {
    return note.preview || note.summary || note.raw_text || 'Fiche de cours générée par PicLearn.';
}

export default function NotesScreen() {
    const { notes, fetchNotes, isLoading, searchNotes } = useNotes();
    const C = useAppColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(C, insets.top), [C, insets.top]);

    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [menuVisible, setMenuVisible] = useState(false);

    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const handleSearch = (text: string) => {
        setQuery(text);
        clearTimeout(searchTimeout.current);
        if (text.length > 2) {
            searchTimeout.current = setTimeout(() => searchNotes(text), 400);
        } else if (text.length === 0) {
            fetchNotes();
        }
    };

    const clearSearch = () => { setQuery(''); fetchNotes(); };

    const filteredNotes = activeFilter === 'all' ? notes : notes.filter((n: Note) => n.subject === activeFilter);
    const subjectsWithNotes = useMemo(() =>
        ['all', ...Array.from(new Set(notes.map((n: Note) => n.subject).filter(Boolean)))],
        [notes]
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>Bibliothèque</Text>
                    <Text style={styles.headerTitle}>Mes notes</Text>
                    <Text style={styles.headerCount}>{filteredNotes.length} fiche{filteredNotes.length !== 1 ? 's' : ''} affichée{filteredNotes.length !== 1 ? 's' : ''}</Text>
                </View>
                <AacaButton
                    label="Nouvelle"
                    icon="camera-plus-outline"
                    size="sm"
                    onPress={() => setMenuVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter une nouvelle note"
                />
            </View>
            <CaptureMenuModal
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                onSelectSession={() => router.push('/session-new')}
                onSelectCapture={() => router.push('/capture')}
            />

            <View style={styles.searchContainer}>
                <MaterialCommunityIcons name="magnify" size={18} color={C.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher un cours, une formule, un concept..."
                    placeholderTextColor={C.textMuted}
                    value={query}
                    onChangeText={handleSearch}
                    returnKeyType="search"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialCommunityIcons name="close-circle" size={16} color={C.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow} style={styles.filtersScroll}>
                {subjectsWithNotes.map((subject) => {
                    const isActive = activeFilter === subject;
                    const color = subject === 'all' ? C.primary : (SUBJECT_COLORS[subject] || C.primary);
                    return (
                        <TouchableOpacity
                            key={subject}
                            style={[
                                styles.chip,
                                { borderColor: isActive ? color : C.border, backgroundColor: isActive ? color : C.surface },
                            ]}
                            onPress={() => setActiveFilter(subject)}
                            activeOpacity={0.76}
                        >
                            {subject !== 'all' ? (
                                <MaterialCommunityIcons
                                    name={subjectIcon(subject) as any}
                                    size={13}
                                    color={isActive ? '#fff' : color}
                                />
                            ) : null}
                            <Text style={[styles.chipText, { color: isActive ? '#fff' : C.textSecondary }]}>
                                {FILTER_LABELS[subject] || subject}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <FlatList
                data={filteredNotes}
                keyExtractor={(item: any) => item.id}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={fetchNotes} tintColor={C.primary} colors={[C.primary]} />
                }
                contentContainerStyle={[styles.list, filteredNotes.length === 0 && styles.listEmpty]}
                ListEmptyComponent={
                    <EmptyState
                        icon={query.length > 0 ? 'file-search-outline' : 'notebook-plus-outline'}
                        title={query.length > 0 ? 'Aucun résultat' : 'Aucune note'}
                        subtitle={query.length > 0
                            ? `Aucune fiche ne correspond à "${query}".`
                            : 'Scannez une page ou lancez une séance multi-pages.'}
                        actionLabel={query.length === 0 ? 'Nouvelle séance' : undefined}
                        onAction={query.length === 0 ? () => router.push('/session-new') : undefined}
                    />
                }
                renderItem={({ item }: { item: Note }) => {
                    const color = SUBJECT_COLORS[item.subject] || C.primary;
                    const flashcards = (item as any).flashcards?.length ?? (item as any).flashcards_count ?? 0;
                    const concepts = item.processed_content?.key_concepts?.slice(0, 2) ?? [];
                    return (
                        <TouchableOpacity
                            onPress={() => router.push({ pathname: '/note-detail', params: { id: item.id } })}
                            activeOpacity={0.84}
                        >
                            <AacaCard accentColor={color} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconBox, { backgroundColor: color + '14' }]}>
                                        <MaterialCommunityIcons name={subjectIcon(item.subject) as any} size={20} color={color} />
                                    </View>
                                    <View style={styles.cardTitleWrap}>
                                        <SubjectBadge label={SUBJECT_LABELS[item.subject] || 'Autre'} color={color} />
                                        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={18} color={C.textMuted} />
                                </View>

                                <Text style={styles.cardPreview} numberOfLines={3}>{notePreview(item)}</Text>

                                {concepts.length > 0 ? (
                                    <View style={styles.conceptsRow}>
                                        {concepts.map((concept) => (
                                            <View key={concept} style={[styles.conceptChip, { backgroundColor: C.surfaceMid }]}>
                                                <Text style={styles.conceptText} numberOfLines={1}>{concept}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                <View style={styles.cardFooter}>
                                    <View style={styles.metaItem}>
                                        <MaterialCommunityIcons name="calendar-outline" size={13} color={C.textMuted} />
                                        <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <MaterialCommunityIcons name="cards-outline" size={13} color={C.textMuted} />
                                        <Text style={styles.metaText}>{flashcards} carte{flashcards !== 1 ? 's' : ''}</Text>
                                    </View>
                                </View>
                            </AacaCard>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}

const makeStyles = (C: any, topInset: number) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    header: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: SIZES.xl,
        paddingTop: topInset + SIZES.sm,
        paddingBottom: SIZES.md,
        gap: SIZES.md,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrow: { fontSize: SIZES.fontXs, color: C.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0 },
    headerTitle: { fontSize: SIZES.fontXXl, fontWeight: '800', color: C.textPrimary, letterSpacing: 0 },
    headerCount: { fontSize: SIZES.fontXs, color: C.textMuted, marginTop: 2, fontWeight: '600' },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SIZES.sm,
        marginHorizontal: SIZES.xl,
        marginBottom: SIZES.sm,
        backgroundColor: C.surface,
        borderRadius: SIZES.borderRadius,
        paddingHorizontal: SIZES.md,
        height: 48,
        borderWidth: 1,
        borderColor: C.border,
    },
    searchInput: { flex: 1, color: C.textPrimary, fontSize: SIZES.fontSm, height: '100%' },

    filtersScroll: { flexGrow: 0 },
    filtersRow: { paddingHorizontal: SIZES.xl, gap: SIZES.xs, paddingBottom: SIZES.md },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: SIZES.md,
        paddingVertical: 8,
        borderRadius: SIZES.borderRadiusFull,
        borderWidth: 1,
    },
    chipText: { fontSize: SIZES.fontXs, fontWeight: '700' },

    list: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxxl, gap: SIZES.md },
    listEmpty: { flex: 1 },

    card: { gap: SIZES.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    iconBox: { width: 44, height: 44, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center' },
    cardTitleWrap: { flex: 1, minWidth: 0, gap: 6 },
    cardTitle: { fontSize: SIZES.fontMd, fontWeight: '800', color: C.textPrimary, lineHeight: 21 },
    cardPreview: { fontSize: SIZES.fontSm, color: C.textSecondary, lineHeight: 20 },
    conceptsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs },
    conceptChip: { maxWidth: '48%', borderRadius: SIZES.borderRadiusFull, paddingHorizontal: SIZES.sm, paddingVertical: 4 },
    conceptText: { fontSize: 10, fontWeight: '700', color: C.textSecondary },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.sm, borderTopWidth: 1, borderTopColor: C.border, paddingTop: SIZES.sm },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    metaText: { fontSize: SIZES.fontXs, color: C.textMuted, fontWeight: '700' },
});
