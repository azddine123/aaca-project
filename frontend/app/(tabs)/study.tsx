import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStudy } from '@/contexts/StudyContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { SIZES, SHADOWS, GRADIENTS } from '@/theme';
import MathFormula from '@/components/MathFormula';

// ── Parseur math inline ───────────────────────────────────────────────────────
type Seg = { t: 'text' | 'math' | 'display'; v: string };
function parse(text: string): Seg[] {
    const out: Seg[] = [];
    // Supports $$...$$ / $...$ and \[...\] / \(...\) delimiters
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

// ── Rendu texte + math sur fond coloré ───────────────────────────────────────
function MathText({ text, textStyle, bg, C }: { text: string; textStyle?: any; bg: string; C: any }) {
    if (!text?.trim()) return null;
    const segs = parse(text.trim());
    const hasMath = segs.some(s => s.t !== 'text');

    if (!hasMath) {
        return <Text style={textStyle}>{text.trim()}</Text>;
    }

    const color = textStyle?.color ?? C.textPrimary;

    return (
        <View style={{ gap: 8, alignItems: 'center', width: '100%' }}>
            {segs.map((s, i) => {
                if (s.t === 'text' && s.v.trim())
                    return <Text key={i} style={textStyle}>{s.v.trim()}</Text>;
                if (s.t === 'display')
                    return (
                        <MathFormula
                            key={i}
                            formula={s.v}
                            display
                            color={color}
                            background={bg}
                            fontSize={20}
                        />
                    );
                if (s.t === 'math')
                    return (
                        <MathFormula
                            key={i}
                            formula={s.v}
                            display={false}
                            color={color}
                            background={bg}
                            fontSize={17}
                        />
                    );
                return null;
            })}
        </View>
    );
}

// ── Rendu option quiz (inline) ────────────────────────────────────────────────
function OptionText({ text, color, bg }: { text: string; color: string; bg: string }) {
    const segs = parse(text);
    const hasMath = segs.some(s => s.t !== 'text');
    if (!hasMath) return <Text style={{ flex: 1, fontSize: SIZES.fontMd, color, lineHeight: 21 }}>{text}</Text>;
    return (
        <View style={{ flex: 1, gap: 4 }}>
            {segs.map((s, i) => {
                if (s.t === 'text' && s.v.trim())
                    return <Text key={i} style={{ fontSize: SIZES.fontMd, color, lineHeight: 21 }}>{s.v.trim()}</Text>;
                if (s.t === 'display' || s.t === 'math')
                    return <MathFormula key={i} formula={s.v} display={s.t === 'display'} color={color} background={bg} fontSize={15} />;
                return null;
            })}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASHCARD MODE  (animation fade/scale — compatible WebView sur Android)
// ─────────────────────────────────────────────────────────────────────────────
function FlashcardSession({ cards, onExit }: { cards: any[]; onExit: () => void }) {
    const C = useAppColors();
    const G = useAppGradients();
    const [index, setIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [done, setDone] = useState(false);
    const [ratings, setRatings] = useState<number[]>([]);

    // Fade + scale (compatible WebView — pas de rotateY)
    const anim = useRef(new Animated.Value(1)).current;
    const card = cards[index];

    const flip = useCallback(() => {
        Animated.sequence([
            Animated.timing(anim, { toValue: 0, duration: 120, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
        // Bascule au milieu de l'animation
        setTimeout(() => setIsFlipped(f => !f), 120);
    }, [anim]);

    const rate = (rating: number) => {
        const newRatings = [...ratings, rating];
        setRatings(newRatings);
        Animated.sequence([
            Animated.timing(anim, { toValue: 0, duration: 100, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
        setTimeout(() => {
            setIsFlipped(false);
            if (index + 1 >= cards.length) setDone(true);
            else setIndex(index + 1);
        }, 100);
    };

    if (done) {
        const known = ratings.filter(r => r >= 4).length;
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xxl, gap: SIZES.lg, backgroundColor: C.background }}>
                <LinearGradient colors={GRADIENTS.success} style={{ width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary }}>
                    <MaterialCommunityIcons name="check-decagram" size={40} color="#fff" />
                </LinearGradient>
                <Text style={{ fontSize: SIZES.fontXXl, fontWeight: '700', color: C.textPrimary, textAlign: 'center' }}>Session terminée !</Text>
                <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, textAlign: 'center' }}>{known}/{cards.length} cartes maîtrisées</Text>
                <View style={{ width: '100%', height: 8, backgroundColor: C.surfaceHigh, borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${(known / cards.length) * 100}%`, backgroundColor: C.success, borderRadius: 4 }} />
                </View>
                <TouchableOpacity style={{ backgroundColor: C.primary, paddingHorizontal: SIZES.xxl, paddingVertical: SIZES.md, borderRadius: SIZES.borderRadius, marginTop: SIZES.md, ...SHADOWS.primary }} onPress={onExit}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: SIZES.fontMd }}>Terminer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Gradient face recto / verso
    const faceGradient: [string, string] = isFlipped
        ? ['#131A30', '#1A2540']
        : G.dark as [string, string];
    const faceLabel = isFlipped ? 'Réponse' : 'Question';
    const faceText  = isFlipped ? card.back : card.front;
    const faceBg    = isFlipped ? '#131A30' : (G.dark?.[0] ?? '#0D1117');

    return (
        <View style={{ flex: 1, backgroundColor: C.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md }}>
                <TouchableOpacity onPress={onExit} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="close" size={22} color={C.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: SIZES.fontSm, fontWeight: '600', color: C.textSecondary }}>{index + 1} / {cards.length}</Text>
                <View style={{ width: 36 }} />
            </View>

            {/* Barre de progression */}
            <View style={{ height: 3, backgroundColor: C.surfaceHigh, marginHorizontal: SIZES.xl, borderRadius: 2, marginBottom: SIZES.xl }}>
                <View style={{ height: '100%', width: `${(index / cards.length) * 100}%`, backgroundColor: C.primary, borderRadius: 2 }} />
            </View>

            {/* Carte (fade/scale au lieu de rotateY) */}
            <TouchableOpacity onPress={flip} activeOpacity={0.9} style={{ flex: 1, marginHorizontal: SIZES.xl, marginBottom: SIZES.lg }}>
                <Animated.View style={{ flex: 1, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }], borderRadius: SIZES.borderRadiusLg, overflow: 'hidden', borderWidth: 1, borderColor: C.border, ...SHADOWS.md }}>
                    <LinearGradient colors={faceGradient} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xxl, gap: SIZES.lg }}>
                        <Text style={{ fontSize: SIZES.fontXs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {faceLabel}
                        </Text>

                        <MathText
                            text={faceText}
                            textStyle={{ fontSize: SIZES.fontXl, fontWeight: '600', color: C.textPrimary, textAlign: 'center', lineHeight: 28 }}
                            bg={faceBg}
                            C={C}
                        />

                        {isFlipped && card.tags?.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                {card.tags.slice(0, 3).map((t: string, i: number) => (
                                    <View key={i} style={{ backgroundColor: C.primary + '30', borderRadius: SIZES.borderRadiusFull, paddingHorizontal: SIZES.sm, paddingVertical: 3 }}>
                                        <Text style={{ fontSize: SIZES.fontXs, color: C.primary, fontWeight: '600' }}>{t}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {!isFlipped && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SIZES.md }}>
                                <MaterialCommunityIcons name="gesture-tap" size={16} color={C.textMuted} />
                                <Text style={{ fontSize: SIZES.fontXs, color: C.textMuted }}>Toucher pour retourner</Text>
                            </View>
                        )}
                    </LinearGradient>
                </Animated.View>
            </TouchableOpacity>

            {/* Boutons de difficulté */}
            {isFlipped ? (
                <View style={{ flexDirection: 'row', paddingHorizontal: SIZES.lg, gap: SIZES.sm, marginBottom: SIZES.xxl }}>
                    {[
                        { label: 'À revoir', color: C.error,   rating: 1 },
                        { label: 'Difficile', color: C.warning, rating: 3 },
                        { label: 'Bien',      color: C.success, rating: 4 },
                        { label: 'Facile',    color: C.accent,  rating: 5 },
                    ].map(({ label, color, rating }) => (
                        <TouchableOpacity key={label} style={{ flex: 1, paddingVertical: SIZES.sm, borderRadius: SIZES.borderRadius, borderWidth: 1.5, borderColor: color, alignItems: 'center' }} onPress={() => rate(rating)} activeOpacity={0.8}>
                            <Text style={{ fontSize: SIZES.fontXs, fontWeight: '700', color }}>{label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <Text style={{ fontSize: SIZES.fontXs, color: C.textMuted, textAlign: 'center', paddingHorizontal: SIZES.xxl, marginBottom: SIZES.xxl }}>
                    Lisez la question, puis touchez la carte pour voir la réponse
                </Text>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ MODE
// ─────────────────────────────────────────────────────────────────────────────
function QuizSession({ quiz, onExit }: { quiz: any; onExit: () => void }) {
    const C = useAppColors();
    const questions = quiz.questions || [];
    const [qIndex, setQIndex] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [answers, setAnswers] = useState<{ correct: boolean }[]>([]);
    const [done, setDone] = useState(false);

    const question = questions[qIndex];

    const confirm = () => {
        if (!selected) return;
        const isCorrect = selected.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
        setConfirmed(true);
        setAnswers(prev => [...prev, { correct: isCorrect }]);
    };

    const next = () => {
        setSelected(null);
        setConfirmed(false);
        if (qIndex + 1 >= questions.length) setDone(true);
        else setQIndex(qIndex + 1);
    };

    if (done) {
        const correct = answers.filter(a => a.correct).length;
        const pct = Math.round((correct / questions.length) * 100);
        const color = pct >= 80 ? C.success : pct >= 50 ? C.warning : C.error;
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xxl, gap: SIZES.lg, backgroundColor: C.background }}>
                <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: color + '33', borderWidth: 2, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: SIZES.fontXXl, fontWeight: '800', color }}>{pct}%</Text>
                </View>
                <Text style={{ fontSize: SIZES.fontXXl, fontWeight: '700', color: C.textPrimary, textAlign: 'center' }}>Quiz terminé !</Text>
                <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, textAlign: 'center' }}>
                    {correct} bonne{correct > 1 ? 's' : ''} réponse{correct > 1 ? 's' : ''} sur {questions.length}
                </Text>
                <View style={{ width: '100%', height: 8, backgroundColor: C.surfaceHigh, borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 4 }} />
                </View>
                <TouchableOpacity style={{ backgroundColor: C.primary, paddingHorizontal: SIZES.xxl, paddingVertical: SIZES.md, borderRadius: SIZES.borderRadius, marginTop: SIZES.md, ...SHADOWS.primary }} onPress={onExit}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: SIZES.fontMd }}>Terminer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const options = question.options || [];

    return (
        <View style={{ flex: 1, backgroundColor: C.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md }}>
                <TouchableOpacity onPress={onExit} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="close" size={22} color={C.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: SIZES.fontSm, fontWeight: '600', color: C.textSecondary }}>{qIndex + 1} / {questions.length}</Text>
                <View style={{ width: 36 }} />
            </View>

            {/* Progression */}
            <View style={{ height: 3, backgroundColor: C.surfaceHigh, marginHorizontal: SIZES.xl, borderRadius: 2, marginBottom: SIZES.xl }}>
                <View style={{ height: '100%', width: `${(qIndex / questions.length) * 100}%`, backgroundColor: C.primary, borderRadius: 2 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxxl }} showsVerticalScrollIndicator={false}>
                {/* Concept */}
                {question.related_concept && (
                    <Text style={{ fontSize: SIZES.fontXs, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SIZES.sm }}>
                        {question.related_concept}
                    </Text>
                )}

                {/* Question avec math */}
                <View style={{ marginBottom: SIZES.xl }}>
                    <MathText
                        text={question.question}
                        textStyle={{ fontSize: SIZES.fontXl, fontWeight: '600', color: C.textPrimary, lineHeight: 26 }}
                        bg={C.background}
                        C={C}
                    />
                </View>

                {/* Options */}
                <View style={{ gap: SIZES.sm, marginBottom: SIZES.xl }}>
                    {options.map((opt: string, i: number) => {
                        const isSelected = selected === opt;
                        const isCorrect = opt.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
                        let borderColor = C.border;
                        let bg = C.surface;
                        if (confirmed) {
                            if (isCorrect)        { borderColor = C.success; bg = C.success + '20'; }
                            else if (isSelected)  { borderColor = C.error;   bg = C.error   + '20'; }
                        } else if (isSelected)    { borderColor = C.primary; bg = C.primary + '20'; }

                        const textColor = confirmed && isCorrect ? C.success
                            : confirmed && isSelected ? C.error
                            : isSelected ? C.primary : C.textPrimary;

                        return (
                            <TouchableOpacity
                                key={i}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.md, padding: SIZES.md, borderRadius: SIZES.borderRadius, borderWidth: 1.5, borderColor, backgroundColor: bg }}
                                onPress={() => !confirmed && setSelected(opt)}
                                activeOpacity={confirmed ? 1 : 0.8}
                            >
                                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: borderColor + '33', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                                    <Text style={{ fontSize: SIZES.fontSm, fontWeight: '700', color: textColor }}>
                                        {String.fromCharCode(65 + i)}
                                    </Text>
                                </View>
                                <OptionText text={opt} color={textColor} bg={bg} />
                                {confirmed && isCorrect  && <MaterialCommunityIcons name="check-circle" size={18} color={C.success} />}
                                {confirmed && isSelected && !isCorrect && <MaterialCommunityIcons name="close-circle" size={18} color={C.error} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Explication avec math */}
                {confirmed && question.explanation && (
                    <View style={{ gap: SIZES.xs, backgroundColor: C.accent + '15', borderRadius: SIZES.borderRadius, padding: SIZES.md, marginBottom: SIZES.xl, borderWidth: 1, borderColor: C.accent + '30' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="information-outline" size={16} color={C.accent} />
                            <Text style={{ fontSize: SIZES.fontXs, fontWeight: '700', color: C.accent }}>Explication</Text>
                        </View>
                        <MathText
                            text={question.explanation}
                            textStyle={{ fontSize: SIZES.fontSm, lineHeight: 20, color: C.textSecondary }}
                            bg={C.accent + '15'}
                            C={C}
                        />
                    </View>
                )}

                {/* Boutons */}
                {!confirmed ? (
                    <TouchableOpacity
                        style={{ backgroundColor: C.primary, height: 52, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary, opacity: selected ? 1 : 0.4 }}
                        onPress={confirm} disabled={!selected} activeOpacity={0.85}
                    >
                        <Text style={{ color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' }}>Valider</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={{ backgroundColor: C.primary, height: 52, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary }}
                        onPress={next} activeOpacity={0.85}
                    >
                        <Text style={{ color: '#fff', fontSize: SIZES.fontMd, fontWeight: '700' }}>
                            {qIndex + 1 < questions.length ? 'Question suivante' : 'Voir le résultat'}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// IDLE STATE
// ─────────────────────────────────────────────────────────────────────────────
function IdleState() {
    const C = useAppColors();
    const G = useAppGradients();
    return (
        <ScrollView style={{ flex: 1, backgroundColor: C.background }} contentContainerStyle={{ padding: SIZES.xl, gap: SIZES.lg, paddingBottom: SIZES.xxxl }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: SIZES.fontXXl, fontWeight: '700', color: C.textPrimary, paddingTop: 56 }}>Zone d'étude</Text>
            <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, marginBottom: SIZES.xl }}>
                Sélectionnez une note pour générer des exercices.
            </Text>
            {[
                { icon: 'cards-outline',           label: 'Flashcards',     desc: 'Répétition espacée SM-2 pour mémoriser durablement vos définitions et concepts clés.', color: C.primary },
                { icon: 'clipboard-check-outline', label: 'Quiz adaptatif', desc: 'Questions QCM générées par IA depuis votre cours. Analysez vos points faibles.',        color: C.success },
            ].map((item) => (
                <TouchableOpacity key={item.label} style={{ borderRadius: SIZES.borderRadiusLg, overflow: 'hidden', borderWidth: 1, borderColor: C.border, ...SHADOWS.sm }} onPress={() => router.push('/(tabs)/notes')} activeOpacity={0.85}>
                    <LinearGradient colors={G.dark} style={{ flexDirection: 'row', alignItems: 'center', padding: SIZES.lg, gap: SIZES.md }}>
                        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: item.color + '30', justifyContent: 'center', alignItems: 'center' }}>
                            <MaterialCommunityIcons name={item.icon as any} size={32} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: SIZES.fontLg, fontWeight: '700', color: C.textPrimary, marginBottom: 4 }}>{item.label}</Text>
                            <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, lineHeight: 18 }}>{item.desc}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={C.textMuted} />
                    </LinearGradient>
                </TouchableOpacity>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm, backgroundColor: C.warning + '15', borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: C.warning + '30' }}>
                <MaterialCommunityIcons name="lightbulb-outline" size={18} color={C.warning} />
                <Text style={{ fontSize: SIZES.fontSm, flex: 1, lineHeight: 20, color: C.textSecondary }}>
                    Ouvrez une note → appuyez sur <Text style={{ fontWeight: '700' }}>Quiz</Text> ou <Text style={{ fontWeight: '700' }}>Flashcards</Text> pour démarrer une session.
                </Text>
            </View>
        </ScrollView>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function StudyScreen() {
    const { currentQuiz, currentFlashcards, setCurrentFlashcards, setCurrentQuiz } = useStudy();
    const C = useAppColors();

    if (currentFlashcards && currentFlashcards.length > 0)
        return <View style={{ flex: 1, backgroundColor: C.background }}><FlashcardSession cards={currentFlashcards} onExit={() => setCurrentFlashcards([])} /></View>;

    if (currentQuiz && (currentQuiz.questions?.length ?? 0) > 0)
        return <View style={{ flex: 1, backgroundColor: C.background }}><QuizSession quiz={currentQuiz} onExit={() => setCurrentQuiz(null)} /></View>;

    return <View style={{ flex: 1, backgroundColor: C.background }}><IdleState /></View>;
}
