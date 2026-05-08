import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MathFormula from './MathFormula';
import type { StructuredContent } from '@/contexts/NotesContext';
import { SIZES } from '@/theme';

interface Props {
    raw_text: string;
    processed_content?: StructuredContent;
    latex_formulas?: { latex?: string; original?: string; description?: string }[];
    C: any;
}

// ── Math text parser ──────────────────────────────────────────────────────────
type Seg = { t: 'text' | 'math' | 'display'; v: string };

function parse(text: string): Seg[] {
    const out: Seg[] = [];
    const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
        out.push(m[1] !== undefined ? { t: 'display', v: m[1] } : { t: 'math', v: m[2] });
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
    return out;
}

// ── Paragraph: mixed text + inline/display math ───────────────────────────────
function MathParagraph({ text, C }: { text: string; C: any }) {
    if (!text?.trim()) return null;
    const segs = parse(text.trim());

    const hasDisplay = segs.some(s => s.t === 'display');
    if (hasDisplay) {
        return (
            <View style={{ gap: 6 }}>
                {segs.map((s, i) => {
                    if (s.t === 'text' && s.v.trim())
                        return <Text key={i} style={[styles.body, { color: C.textPrimary }]}>{s.v}</Text>;
                    if (s.t === 'display')
                        return <DisplayFormulaBlock key={i} latex={s.v} C={C} />;
                    if (s.t === 'math')
                        return <MathFormula key={i} formula={s.v} display={false} color={C.textPrimary} />;
                    return null;
                })}
            </View>
        );
    }

    const hasMath = segs.some(s => s.t === 'math');
    if (!hasMath)
        return <Text style={[styles.body, { color: C.textPrimary }]}>{text.trim()}</Text>;

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            {segs.map((s, i) => {
                if (s.t === 'text' && s.v)
                    return <Text key={i} style={[styles.body, { color: C.textPrimary }]}>{s.v}</Text>;
                if (s.t === 'math')
                    return <MathFormula key={i} formula={s.v} display={false} fontSize={14} color={C.textPrimary} />;
                return null;
            })}
        </View>
    );
}

// ── Bloc formule display (centré, grand) ──────────────────────────────────────
function DisplayFormulaBlock({ latex, description, C }: { latex: string; description?: string; C: any }) {
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
                        <DisplayFormulaBlock
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
                        <DisplayFormulaBlock
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

    displayBlock: {
        borderRadius: 14,
        borderWidth: 1,
        marginVertical: 4,
        overflow: 'hidden',
        alignItems: 'center',
    },
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
    sectionLabelText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

    defCard: { borderRadius: 10, borderWidth: 1, padding: SIZES.sm, gap: 5 },
    term: { fontSize: SIZES.fontSm, fontWeight: '700' },
    exCard: { borderRadius: 10, borderWidth: 1, padding: SIZES.sm },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
});
