import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MathFormula from './MathFormula';
import { MathParagraph } from './MathParagraph';
import type { StructuredContent } from '@/contexts/NotesContext';
import { SIZES } from '@/theme';

interface Props {
    raw_text: string;
    processed_content?: StructuredContent;
    latex_formulas?: { latex?: string; original?: string; description?: string }[];
    C: any;
}

// ── Bloc formule display avec description optionnelle ─────────────────────────
function DisplayFormulaBlockWithDesc({ latex, description, C }: { latex: string; description?: string; C: any }) {
    if (!latex?.trim()) return null;
    return (
        <View style={[styles.displayBlock, { backgroundColor: C.surface, borderColor: C.border }]}>
            <MathFormula
                formula={latex}
                display
                color={C.textPrimary}
                background={C.surface}
                fontSize={19}
            />
            {description ? (
                <Text style={[styles.formulaDesc, { color: C.textSecondary, borderTopColor: C.border }]}>
                    {description}
                </Text>
            ) : null}
        </View>
    );
}

// ── Label de section ──────────────────────────────────────────────────────────
function SectionLabel({ icon, text, C }: { icon: string; text: string; C: any }) {
    return (
        <View style={[styles.sectionLabel, { borderBottomColor: C.border }]}>
            <MaterialCommunityIcons name={icon as any} size={13} color={C.textMuted} />
            <Text style={[styles.sectionLabelText, { color: C.textMuted }]}>{text}</Text>
        </View>
    );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function NoteContentView({ raw_text, processed_content, latex_formulas, C }: Props) {
    const pc = processed_content;

    // Normalise les formules : supporte "latex" (nouveau) et "original" (ancien)
    const getLatex = (f: any): string => f?.latex || f?.original || '';
    // Normalise les sections : supporte "title" (nouveau) et "heading" (ancien)
    const getTitle = (s: any): string => s?.title || s?.heading || '';

    const pcFormulas = pc?.formulas?.filter(f => getLatex(f).trim()) ?? [];
    const hasStructured = pc && (
        (pc.sections?.length ?? 0) > 0 ||
        pcFormulas.length > 0 ||
        (pc.definitions?.length ?? 0) > 0 ||
        (pc.key_concepts?.length ?? 0) > 0
    );

    return (
        <View style={styles.root}>

            {/* ── Sections ──────────────────────────────────── */}
            {hasStructured && pc!.sections?.length > 0 && (
                <View style={styles.block}>
                    {pc!.sections.map((sec: any, i: number) => (
                        <View key={i} style={styles.section}>
                            {getTitle(sec) ? (
                                <Text style={[styles.secTitle, { color: C.primary }]}>{getTitle(sec)}</Text>
                            ) : null}
                            <MathParagraph text={sec.content} C={C} />
                        </View>
                    ))}
                </View>
            )}

            {/* ── Texte brut (fallback) ─────────────────────── */}
            {!hasStructured && raw_text && (
                <View style={styles.block}>
                    <SectionLabel icon="text-long" text="Texte extrait" C={C} />
                    {raw_text.split('\n').filter(l => l.trim()).map((line, i) => (
                        <MathParagraph key={i} text={line} C={C} />
                    ))}
                </View>
            )}

            {/* ── Formules (processed_content) ─────────────── */}
            {pcFormulas.length > 0 && (
                <View style={styles.block}>
                    <SectionLabel icon="function-variant" text="Formules" C={C} />
                    {pcFormulas.map((f: any, i: number) => (
                        <DisplayFormulaBlockWithDesc
                            key={i}
                            latex={getLatex(f)}
                            description={f.description}
                            C={C}
                        />
                    ))}
                </View>
            )}

            {/* ── Formules (latex_formulas, fallback) ──────── */}
            {!hasStructured && latex_formulas && latex_formulas.length > 0 && (
                <View style={styles.block}>
                    <SectionLabel icon="function-variant" text="Formules détectées" C={C} />
                    {latex_formulas.map((f, i) => (
                        <DisplayFormulaBlockWithDesc
                            key={i}
                            latex={getLatex(f)}
                            description={f.description}
                            C={C}
                        />
                    ))}
                </View>
            )}

            {/* ── Définitions ───────────────────────────────── */}
            {hasStructured && pc!.definitions?.length > 0 && (
                <View style={styles.block}>
                    <SectionLabel icon="book-open-outline" text="Définitions" C={C} />
                    {pc!.definitions.map((d: any, i: number) => (
                        <View key={i} style={[styles.defCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                            <Text style={[styles.term, { color: C.primary }]}>{d.term}</Text>
                            <MathParagraph text={d.definition} C={C} />
                        </View>
                    ))}
                </View>
            )}

            {/* ── Exemples ──────────────────────────────────── */}
            {hasStructured && pc!.examples?.length > 0 && (
                <View style={styles.block}>
                    <SectionLabel icon="lightbulb-outline" text="Exemples" C={C} />
                    {pc!.examples.map((ex: string, i: number) => (
                        <View key={i} style={[styles.exCard, { backgroundColor: C.success + '12', borderColor: C.success + '35' }]}>
                            <MathParagraph text={ex} C={C} />
                        </View>
                    ))}
                </View>
            )}

            {/* ── Concepts clés ─────────────────────────────── */}
            {hasStructured && pc!.key_concepts?.length > 0 && (
                <View style={styles.block}>
                    <SectionLabel icon="tag-multiple-outline" text="Concepts clés" C={C} />
                    <View style={styles.tags}>
                        {pc!.key_concepts.map((k: string, i: number) => (
                            <View key={i} style={[styles.tag, { backgroundColor: C.primary + '18', borderColor: C.primary + '40' }]}>
                                <Text style={{ fontSize: SIZES.fontXs, color: C.primary, fontWeight: '700' }}>{k}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { gap: SIZES.xl },
    block: { gap: SIZES.sm },
    section: { gap: 6, marginBottom: SIZES.sm },
    secTitle: { fontSize: SIZES.fontMd, fontWeight: '700', marginBottom: 2 },
    body: { fontSize: SIZES.fontMd, lineHeight: 24 },

    displayBlock: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', alignItems: 'center' },
    formulaDesc: {
        width: '100%',
        fontSize: SIZES.fontXs,
        paddingHorizontal: SIZES.md,
        paddingVertical: 7,
        fontStyle: 'italic',
        borderTopWidth: 1,
        textAlign: 'center',
    },

    sectionLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingBottom: 8,
        borderBottomWidth: 1,
        marginBottom: SIZES.xs,
    },
    sectionLabelText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0 },

    defCard: { borderRadius: 10, borderWidth: 1, padding: SIZES.sm, gap: 5 },
    term: { fontSize: SIZES.fontSm, fontWeight: '700' },
    exCard: { borderRadius: 10, borderWidth: 1, padding: SIZES.sm },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
});
