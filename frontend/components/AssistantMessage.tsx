import React from 'react';
import { View } from 'react-native';
import { MathParagraph, DisplayFormulaBlock } from './MathParagraph';

interface Props {
    text: string;
    C: any;
}

type Chunk = { kind: 'line'; text: string } | { kind: 'display'; latex: string };

// Extract multiline display math blocks BEFORE splitting by newline.
// \[...\] and $$...$$ can span multiple lines — splitting first breaks the regex.
function splitIntoChunks(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    const displayRe = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = displayRe.exec(text)) !== null) {
        // Plain text before this display block → split by lines
        const before = text.slice(last, m.index);
        before.split('\n').forEach(line => {
            if (line.trim()) chunks.push({ kind: 'line', text: line.trim() });
        });
        // The display math block as a single unit
        const latex = (m[1] ?? m[2]).trim();
        if (latex) chunks.push({ kind: 'display', latex });
        last = m.index + m[0].length;
    }

    // Remaining text after last display block
    text.slice(last).split('\n').forEach(line => {
        if (line.trim()) chunks.push({ kind: 'line', text: line.trim() });
    });

    return chunks;
}

export default function AssistantMessage({ text, C }: Props) {
    const chunks = splitIntoChunks(text);
    return (
        <View style={{ gap: 8 }}>
            {chunks.map((chunk, i) =>
                chunk.kind === 'display'
                    ? <DisplayFormulaBlock key={i} latex={chunk.latex} C={C} />
                    : <MathParagraph key={i} text={chunk.text} C={C} />
            )}
        </View>
    );
}
