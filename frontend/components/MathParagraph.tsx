import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MathFormula from './MathFormula';

// ── Parser ────────────────────────────────────────────────────────────────────
type Seg = { t: 'text' | 'math' | 'display'; v: string };

export function parseMathSegments(text: string): Seg[] {
    const out: Seg[] = [];
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
        if (m[1] !== undefined)      out.push({ t: 'display', v: m[1] });
        else if (m[2] !== undefined) out.push({ t: 'math',    v: m[2] });
        else if (m[3] !== undefined) out.push({ t: 'display', v: m[3] });
        else                         out.push({ t: 'math',    v: m[4] });
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
    return out;
}

// ── Rich text: **bold** + line breaks ────────────────────────────────────────
function RichText({ value, style }: { value: string; style: any }) {
    const parts = value.split(/(\*\*[^*]+\*\*)/g);
    return (
        <Text style={style}>
            {parts.map((p, i) =>
                p.startsWith('**') && p.endsWith('**')
                    ? <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text>
                    : <Text key={i}>{p}</Text>
            )}
        </Text>
    );
}

// ── Display formula block (même style que NoteContentView) ───────────────────
export function DisplayFormulaBlock({ latex, C }: { latex: string; C: any }) {
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
        </View>
    );
}

// ── Paragraphe mixte texte + maths ────────────────────────────────────────────
export function MathParagraph({ text, C }: { text: string; C: any }) {
    if (!text?.trim()) return null;
    const segs = parseMathSegments(text.trim());

    const bodyStyle = [styles.body, { color: C.textPrimary }];

    const hasDisplay = segs.some(s => s.t === 'display');
    if (hasDisplay) {
        return (
            <View style={{ gap: 6 }}>
                {segs.map((s, i) => {
                    if (s.t === 'text' && s.v.trim())
                        return <RichText key={i} value={s.v} style={bodyStyle} />;
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
        return <RichText value={text.trim()} style={bodyStyle} />;

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            {segs.map((s, i) => {
                if (s.t === 'text' && s.v)
                    return <RichText key={i} value={s.v} style={bodyStyle} />;
                if (s.t === 'math')
                    return <MathFormula key={i} formula={s.v} display={false} fontSize={14} color={C.textPrimary} />;
                return null;
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    body: { fontSize: 14, lineHeight: 24 },
    displayBlock: {
        borderRadius: 14,
        borderWidth: 1,
        marginVertical: 4,
        overflow: 'hidden',
        alignItems: 'center',
    },
});
