import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudy } from '@/contexts/StudyContext';
import { useAppColors, useAppGradients } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/api';
import { SIZES, SHADOWS, GRADIENTS } from '@/theme';
import MathFormula from '@/components/MathFormula';
import { AacaCard, ProgressBar, StatusBadge } from '@/components/UIKit';

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
    const { authFetch } = useAuth();
    const insets = useSafeAreaInsets();
    const [index, setIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [done, setDone] = useState(false);
    const [ratings, setRatings] = useState<number[]>([]);

    const anim = useRef(new Animated.Value(1)).current;
    const card = cards[index];

    const flip = useCallback(() => {
        Animated.sequence([
            Animated.timing(anim, { toValue: 0, duration: 120, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
        setTimeout(() => setIsFlipped(f => !f), 120);
    }, [anim]);

    const undo = () => {
        if (index === 0 || ratings.length === 0) return;
        setRatings(prev => prev.slice(0, -1));
        setIsFlipped(false);
        setIndex(index - 1);
    };

    const skip = () => {
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

    const rate = (rating: number) => {
        const newRatings = [...ratings, rating];
        setRatings(newRatings);

        // Persist review to backend (fire-and-forget)
        if (card?.id) {
            authFetch(`${API_URL}/flashcards/${card.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ difficulty_rating: rating, reviewed_at: new Date().toISOString() }),
            }).catch(() => { /* silent — offline resilience */ });
        }

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
                <Text style={{ fontSize: SIZES.fontXXl, fontWeight: '700', color: C.textPrimary, textAlign: 'center' }}>Séance terminée !</Text>
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

    const faceGradient: [string, string] = isFlipped
        ? [C.surface, C.surfaceMid]
        : G.dark as [string, string];
    const faceLabel = isFlipped ? 'Réponse' : 'Question';
    const faceText  = isFlipped ? card.back : card.front;
    const faceBg    = isFlipped ? C.surfaceMid : C.surface;

    return (
        <View style={{ flex: 1, backgroundColor: C.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: insets.top + SIZES.sm, paddingBottom: SIZES.md, gap: SIZES.md }}>
                <TouchableOpacity
                    onPress={onExit}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border }}
                    accessibilityRole="button"
                    accessibilityLabel="Quitter la session"
                >
                    <MaterialCommunityIcons name="close" size={22} color={C.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <StatusBadge label="Révision active" tone="info" icon="cards-outline" />
                    <Text style={{ fontSize: SIZES.fontXs, fontWeight: '800', color: C.textSecondary }}>{index + 1} / {cards.length}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <View style={{ marginHorizontal: SIZES.xl, marginBottom: SIZES.xl, gap: 7 }}>
                <ProgressBar value={(index + 1) / cards.length} color={C.primary} />
                <Text style={{ alignSelf: 'flex-end', fontSize: SIZES.fontXs, color: C.textMuted, fontWeight: '700' }}>
                    Progression {Math.round(((index + 1) / cards.length) * 100)}%
                </Text>
            </View>

            {/* Carte (fade/scale au lieu de rotateY) */}
            <TouchableOpacity onPress={flip} activeOpacity={0.9} style={{ flex: 1, marginHorizontal: SIZES.xl, marginBottom: SIZES.lg }}>
                <Animated.View style={{ flex: 1, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }], borderRadius: SIZES.borderRadius, overflow: 'hidden', borderWidth: 1, borderColor: C.border, ...SHADOWS.md }}>
                    <LinearGradient colors={faceGradient} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xxl, gap: SIZES.lg }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: SIZES.fontXs, fontWeight: '800', color: isFlipped ? C.primary : C.textMuted, textTransform: 'uppercase', letterSpacing: 0 }}>
                                {faceLabel}
                            </Text>
                            {card.mastery_level != null && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.warning + '16', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 }}>
                                    <MaterialCommunityIcons name="star" size={10} color={C.warning ?? '#F59E0B'} />
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: C.warning ?? '#F59E0B' }}>
                                        {Math.round((card.mastery_level ?? 0) * 100)}%
                                    </Text>
                                </View>
                            )}
                        </View>

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
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SIZES.lg, gap: SIZES.sm, marginBottom: SIZES.xxl }}>
                    {[
                        { label: 'À revoir', sub: 'Encore flou', icon: 'reload', color: C.error, rating: 1 },
                        { label: 'Difficile', sub: 'Presque', icon: 'alert-circle-outline', color: C.warning, rating: 3 },
                        { label: 'Bien', sub: 'Compris', icon: 'check-circle-outline', color: C.success, rating: 4 },
                        { label: 'Facile', sub: 'Maîtrisé', icon: 'star-outline', color: C.accent, rating: 5 },
                    ].map(({ label, sub, icon, color, rating }) => (
                        <TouchableOpacity key={label} style={{ width: '48%', minHeight: 58, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.sm, borderRadius: SIZES.borderRadius, borderWidth: 1.5, borderColor: color + '70', backgroundColor: color + '10', alignItems: 'center', justifyContent: 'center', gap: 3 }} onPress={() => rate(rating)} activeOpacity={0.8}>
                            <MaterialCommunityIcons name={icon as any} size={17} color={color} />
                            <Text style={{ fontSize: SIZES.fontXs, fontWeight: '800', color }}>{label}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: C.textMuted }}>{sub}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, paddingHorizontal: SIZES.xl, marginBottom: SIZES.xxl }}>
                    {index > 0 && ratings.length > 0 && (
                        <TouchableOpacity
                            onPress={undo}
                            style={{ paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, borderRadius: SIZES.borderRadius, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface }}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Annuler la dernière réponse"
                        >
                            <Text style={{ fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary }}>Annuler</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={{ fontSize: SIZES.fontXs, color: C.textMuted, flex: 1, textAlign: 'center' }}>
                        Lisez la question, puis touchez la carte pour voir la réponse
                    </Text>
                    <TouchableOpacity
                        onPress={skip}
                        style={{ paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, borderRadius: SIZES.borderRadius, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Passer cette carte"
                    >
                        <Text style={{ fontSize: SIZES.fontXs, fontWeight: '700', color: C.textSecondary }}>Passer</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ MODE
// ─────────────────────────────────────────────────────────────────────────────
function QuizSession({ quiz, onExit }: { quiz: any; onExit: () => void }) {
    const C = useAppColors();
    const { authFetch } = useAuth();
    const insets = useSafeAreaInsets();
    const questions = quiz.questions || [];
    const [qIndex, setQIndex] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [answers, setAnswers] = useState<{ question_id: string; answer: string; correct: boolean }[]>([]);
    const [done, setDone] = useState(false);
    const startedAt = useRef(new Date());

    const question = questions[qIndex];

    // Fire-and-forget quiz result submission on completion
    useEffect(() => {
        if (!done || !quiz?.id || answers.length === 0) return;
        const payload = {
            quiz_id: quiz.id,
            answers: answers.map(a => ({ question_id: a.question_id, answer: a.answer, time_spent: 0 })),
            started_at: startedAt.current.toISOString(),
            completed_at: new Date().toISOString(),
        };
        authFetch(`${API_URL}/quizzes/${quiz.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(() => { /* silent — offline resilience */ });
    }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

    const confirm = () => {
        if (!selected) return;
        const isCorrect = selected.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
        setConfirmed(true);
        setAnswers(prev => [...prev, { question_id: question.id, answer: selected, correct: isCorrect }]);
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: insets.top + SIZES.sm, paddingBottom: SIZES.md }}>
                <TouchableOpacity
                    onPress={onExit}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border }}
                    accessibilityRole="button"
                    accessibilityLabel="Quitter le quiz"
                >
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
                    <Text style={{ fontSize: SIZES.fontXs, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0, marginBottom: SIZES.sm }}>
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
function IdleState({ dueCards, onStartDue }: { dueCards: any[]; onStartDue: () => void }) {
    const C = useAppColors();
    const insets = useSafeAreaInsets();
    return (
        <ScrollView style={{ flex: 1, backgroundColor: C.background }} contentContainerStyle={{ padding: SIZES.xl, gap: SIZES.lg, paddingBottom: SIZES.xxxl }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingTop: insets.top + SIZES.sm, gap: 5 }}>
                <Text style={{ fontSize: SIZES.fontXXl, fontWeight: '800', color: C.textPrimary, letterSpacing: 0 }}>Révisions</Text>
                <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary }}>
                    Cartes, quiz et entraînement depuis vos notes.
                </Text>
            </View>

            {dueCards.length > 0 && (
                <TouchableOpacity
                    onPress={onStartDue}
                    activeOpacity={0.85}
                >
                    <AacaCard style={{ gap: SIZES.md, borderColor: C.accent + '42' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.md }}>
                            <View style={{ width: 52, height: 52, borderRadius: SIZES.borderRadius, backgroundColor: C.accent + '14', justifyContent: 'center', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="cards-outline" size={28} color={C.accent} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontSize: SIZES.fontLg, fontWeight: '800', color: C.textPrimary }}>
                                    {dueCards.length} carte{dueCards.length > 1 ? 's' : ''} à réviser
                                </Text>
                                <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, marginTop: 2 }}>
                                    {"Session courte recommandée aujourd'hui"}
                                </Text>
                            </View>
                            <View style={{ backgroundColor: C.accent, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                                <MaterialCommunityIcons name="play" size={18} color="#fff" />
                            </View>
                        </View>
                        <ProgressBar value={0.12} color={C.accent} />
                    </AacaCard>
                </TouchableOpacity>
            )}
            {[
                { icon: 'cards-outline', label: 'Flashcards', desc: 'Répétition espacée', color: C.primary },
                { icon: 'clipboard-check-outline', label: 'Quiz adaptatif', desc: 'Questions depuis un cours', color: C.success },
            ].map((item) => (
                <TouchableOpacity key={item.label} onPress={() => router.push('/(tabs)/notes')} activeOpacity={0.85}>
                    <AacaCard style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.md }}>
                        <View style={{ width: 52, height: 52, borderRadius: SIZES.borderRadius, backgroundColor: item.color + '14', justifyContent: 'center', alignItems: 'center' }}>
                            <MaterialCommunityIcons name={item.icon as any} size={32} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: SIZES.fontLg, fontWeight: '800', color: C.textPrimary, marginBottom: 4 }}>{item.label}</Text>
                            <Text style={{ fontSize: SIZES.fontSm, color: C.textSecondary, lineHeight: 18 }}>{item.desc}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={C.textMuted} />
                    </AacaCard>
                </TouchableOpacity>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm, backgroundColor: C.warning + '12', borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: C.warning + '30' }}>
                <MaterialCommunityIcons name="lightbulb-outline" size={18} color={C.warning} />
                <Text style={{ fontSize: SIZES.fontSm, flex: 1, lineHeight: 20, color: C.textSecondary }}>
                    Ouvrez une note pour lancer un quiz ou charger ses flashcards.
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
    const { authFetch } = useAuth();
    const C = useAppColors();
    const [dueCards, setDueCards] = useState<any[]>([]);

    const fetchDueCards = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/flashcards/due?limit=50`);
            if (res.ok) setDueCards(await res.json());
        } catch { /* silent */ }
    }, [authFetch]);

    useEffect(() => { fetchDueCards(); }, [fetchDueCards]);

    if (currentFlashcards && currentFlashcards.length > 0)
        return (
            <View style={{ flex: 1, backgroundColor: C.background }}>
                <FlashcardSession cards={currentFlashcards} onExit={() => { setCurrentFlashcards([]); fetchDueCards(); }} />
            </View>
        );

    if (currentQuiz && (currentQuiz.questions?.length ?? 0) > 0)
        return (
            <View style={{ flex: 1, backgroundColor: C.background }}>
                <QuizSession quiz={currentQuiz} onExit={() => setCurrentQuiz(null)} />
            </View>
        );

    return (
        <View style={{ flex: 1, backgroundColor: C.background }}>
            <IdleState dueCards={dueCards} onStartDue={() => setCurrentFlashcards(dueCards)} />
        </View>
    );
}
