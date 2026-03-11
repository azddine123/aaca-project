import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Animated, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStudy } from '@/contexts/StudyContext';
import { COLORS, SIZES, FONTS, SHADOWS, GRADIENTS } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
// FLASHCARD MODE
// ─────────────────────────────────────────────
function FlashcardSession({ cards, onExit }: { cards: any[]; onExit: () => void }) {
    const [index, setIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [done, setDone] = useState(false);
    const [ratings, setRatings] = useState<number[]>([]);
    const flipAnim = useRef(new Animated.Value(0)).current;

    const card = cards[index];

    const flip = useCallback(() => {
        Animated.spring(flipAnim, {
            toValue: isFlipped ? 0 : 1,
            friction: 8,
            tension: 12,
            useNativeDriver: true,
        }).start();
        setIsFlipped(!isFlipped);
    }, [isFlipped, flipAnim]);

    const rate = (rating: number) => {
        const newRatings = [...ratings, rating];
        setRatings(newRatings);
        setIsFlipped(false);
        flipAnim.setValue(0);
        if (index + 1 >= cards.length) {
            setDone(true);
        } else {
            setIndex(index + 1);
        }
    };

    const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
    const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

    if (done) {
        const known = ratings.filter(r => r >= 4).length;
        return (
            <View style={styles.resultContainer}>
                <LinearGradient colors={GRADIENTS.success} style={styles.resultBadge}>
                    <MaterialCommunityIcons name="check-decagram" size={40} color={COLORS.white} />
                </LinearGradient>
                <Text style={styles.resultTitle}>Session terminée !</Text>
                <Text style={styles.resultSub}>{known}/{cards.length} cartes maîtrisées</Text>
                <View style={styles.resultBar}>
                    <View style={[styles.resultFill, { width: `${(known / cards.length) * 100}%`, backgroundColor: COLORS.success }]} />
                </View>
                <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
                    <Text style={styles.exitBtnText}>Terminer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.sessionContainer}>
            {/* Header */}
            <View style={styles.sessionHeader}>
                <TouchableOpacity onPress={onExit} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.sessionProgress}>{index + 1} / {cards.length}</Text>
                <View style={{ width: 36 }} />
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((index) / cards.length) * 100}%` }]} />
            </View>

            {/* Flip card */}
            <TouchableOpacity onPress={flip} activeOpacity={0.9} style={styles.cardWrapper}>
                {/* Front */}
                <Animated.View style={[styles.flipCard, styles.flipCardFront, { transform: [{ rotateY: frontRotate }] }]}>
                    <LinearGradient colors={GRADIENTS.dark} style={styles.flipCardGrad}>
                        <Text style={styles.flipHint}>Question</Text>
                        <Text style={styles.flipCardText}>{card.front}</Text>
                        <View style={styles.tapHint}>
                            <MaterialCommunityIcons name="gesture-tap" size={16} color={COLORS.textMuted} />
                            <Text style={styles.tapHintText}>Toucher pour retourner</Text>
                        </View>
                    </LinearGradient>
                </Animated.View>
                {/* Back */}
                <Animated.View style={[styles.flipCard, styles.flipCardBack, { transform: [{ rotateY: backRotate }] }]}>
                    <LinearGradient colors={['#131A30', '#1A2540']} style={styles.flipCardGrad}>
                        <Text style={styles.flipHint}>Réponse</Text>
                        <Text style={styles.flipCardText}>{card.back}</Text>
                        {card.tags?.length > 0 && (
                            <View style={styles.tagsRow}>
                                {card.tags.slice(0, 3).map((t: string, i: number) => (
                                    <View key={i} style={styles.tag}>
                                        <Text style={styles.tagText}>{t}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </LinearGradient>
                </Animated.View>
            </TouchableOpacity>

            {/* Rating buttons */}
            {isFlipped && (
                <View style={styles.ratingRow}>
                    <RateBtn label="À revoir" color={COLORS.error} onPress={() => rate(1)} />
                    <RateBtn label="Difficile" color={COLORS.warning} onPress={() => rate(3)} />
                    <RateBtn label="Bien" color={COLORS.success} onPress={() => rate(4)} />
                    <RateBtn label="Facile" color={COLORS.accent} onPress={() => rate(5)} />
                </View>
            )}
            {!isFlipped && (
                <Text style={styles.ratingHint}>Lisez la question, puis touchez la carte pour voir la réponse</Text>
            )}
        </View>
    );
}

function RateBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.rateBtn, { borderColor: color }]} onPress={onPress} activeOpacity={0.8}>
            <Text style={[styles.rateBtnText, { color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─────────────────────────────────────────────
// QUIZ MODE
// ─────────────────────────────────────────────
function QuizSession({ quiz, onExit }: { quiz: any; onExit: () => void }) {
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
        if (qIndex + 1 >= questions.length) {
            setDone(true);
        } else {
            setQIndex(qIndex + 1);
        }
    };

    if (done) {
        const correct = answers.filter(a => a.correct).length;
        const pct = Math.round((correct / questions.length) * 100);
        const color = pct >= 80 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.error;
        return (
            <View style={styles.resultContainer}>
                <View style={[styles.resultBadge, { backgroundColor: color + '33', borderWidth: 2, borderColor: color }]}>
                    <Text style={[styles.bigScore, { color }]}>{pct}%</Text>
                </View>
                <Text style={styles.resultTitle}>Quiz terminé !</Text>
                <Text style={styles.resultSub}>{correct} bonne{correct > 1 ? 's' : ''} réponse{correct > 1 ? 's' : ''} sur {questions.length}</Text>
                <View style={styles.resultBar}>
                    <View style={[styles.resultFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
                    <Text style={styles.exitBtnText}>Terminer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const options = question.options || [];

    return (
        <View style={styles.sessionContainer}>
            <View style={styles.sessionHeader}>
                <TouchableOpacity onPress={onExit} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.sessionProgress}>{qIndex + 1} / {questions.length}</Text>
                <View style={{ width: 36 }} />
            </View>
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(qIndex / questions.length) * 100}%` }]} />
            </View>

            <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
                {question.related_concept && (
                    <Text style={styles.conceptTag}>{question.related_concept}</Text>
                )}
                <Text style={styles.questionText}>{question.question}</Text>

                <View style={styles.optionsCol}>
                    {options.map((opt: string, i: number) => {
                        const isSelected = selected === opt;
                        const isCorrect = opt.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
                        let borderColor = COLORS.border;
                        let bg = COLORS.surface;
                        if (confirmed) {
                            if (isCorrect) { borderColor = COLORS.success; bg = COLORS.success + '20'; }
                            else if (isSelected) { borderColor = COLORS.error; bg = COLORS.error + '20'; }
                        } else if (isSelected) {
                            borderColor = COLORS.primary; bg = COLORS.primary + '20';
                        }
                        return (
                            <TouchableOpacity
                                key={i}
                                style={[styles.option, { borderColor, backgroundColor: bg }]}
                                onPress={() => !confirmed && setSelected(opt)}
                                activeOpacity={confirmed ? 1 : 0.8}
                            >
                                <View style={[styles.optionLetter, { backgroundColor: borderColor + '33' }]}>
                                    <Text style={[styles.optionLetterText, { color: confirmed && isCorrect ? COLORS.success : confirmed && isSelected ? COLORS.error : isSelected ? COLORS.primary : COLORS.textSecondary }]}>
                                        {String.fromCharCode(65 + i)}
                                    </Text>
                                </View>
                                <Text style={styles.optionText}>{opt}</Text>
                                {confirmed && isCorrect && <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />}
                                {confirmed && isSelected && !isCorrect && <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.error} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {confirmed && question.explanation && (
                    <View style={styles.explanationBox}>
                        <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.accent} />
                        <Text style={styles.explanationText}>{question.explanation}</Text>
                    </View>
                )}

                {!confirmed ? (
                    <TouchableOpacity
                        style={[styles.primaryBtn, !selected && styles.primaryBtnDisabled]}
                        onPress={confirm}
                        disabled={!selected}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>Valider</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.primaryBtn} onPress={next} activeOpacity={0.85}>
                        <Text style={styles.primaryBtnText}>
                            {qIndex + 1 < questions.length ? 'Question suivante' : 'Voir le résultat'}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

// ─────────────────────────────────────────────
// IDLE / EMPTY STATE
// ─────────────────────────────────────────────
function IdleState() {
    return (
        <ScrollView style={styles.idleContainer} contentContainerStyle={styles.idleContent} showsVerticalScrollIndicator={false}>
            <Text style={[FONTS.h2, { paddingTop: 56 }]}>Zone d'étude</Text>
            <Text style={[FONTS.body2, { marginBottom: SIZES.xl }]}>
                Sélectionnez une note pour générer des exercices.
            </Text>

            <TouchableOpacity
                style={styles.modeCard}
                onPress={() => router.push('/(tabs)/notes')}
                activeOpacity={0.85}
            >
                <LinearGradient colors={['#1A2540', '#131A30']} style={styles.modeCardGrad}>
                    <View style={[styles.modeIconBg, { backgroundColor: COLORS.primary + '30' }]}>
                        <MaterialCommunityIcons name="cards-outline" size={32} color={COLORS.primary} />
                    </View>
                    <View style={styles.modeInfo}>
                        <Text style={styles.modeName}>Flashcards</Text>
                        <Text style={styles.modeDesc}>Répétition espacée SM-2 pour mémoriser durablement vos définitions et concepts clés.</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.modeCard}
                onPress={() => router.push('/(tabs)/notes')}
                activeOpacity={0.85}
            >
                <LinearGradient colors={['#1A2540', '#131A30']} style={styles.modeCardGrad}>
                    <View style={[styles.modeIconBg, { backgroundColor: COLORS.success + '30' }]}>
                        <MaterialCommunityIcons name="clipboard-check-outline" size={32} color={COLORS.success} />
                    </View>
                    <View style={styles.modeInfo}>
                        <Text style={styles.modeName}>Quiz adaptatif</Text>
                        <Text style={styles.modeDesc}>Questions QCM générées par IA depuis votre cours. Analysez vos points faibles.</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
                </LinearGradient>
            </TouchableOpacity>

            <View style={styles.hintBox}>
                <MaterialCommunityIcons name="lightbulb-outline" size={18} color={COLORS.warning} />
                <Text style={styles.hintText}>
                    Ouvrez une note → appuyez sur <Text style={{ fontWeight: '700' }}>Quiz</Text> ou <Text style={{ fontWeight: '700' }}>Flashcards</Text> pour démarrer une session.
                </Text>
            </View>
        </ScrollView>
    );
}

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function StudyScreen() {
    const { currentQuiz, currentFlashcards, setCurrentFlashcards, setCurrentQuiz } = useStudy();

    const exitFlashcards = () => setCurrentFlashcards([]);
    const exitQuiz = () => setCurrentQuiz(null);

    if (currentFlashcards && currentFlashcards.length > 0) {
        return (
            <View style={styles.root}>
                <FlashcardSession cards={currentFlashcards} onExit={exitFlashcards} />
            </View>
        );
    }

    if (currentQuiz && (currentQuiz.questions?.length ?? 0) > 0) {
        return (
            <View style={styles.root}>
                <QuizSession quiz={currentQuiz} onExit={exitQuiz} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <IdleState />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },

    // Idle
    idleContainer: { flex: 1 },
    idleContent: { padding: SIZES.xl, gap: SIZES.lg, paddingBottom: SIZES.xxxl },
    modeCard: { borderRadius: SIZES.borderRadiusLg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
    modeCardGrad: { flexDirection: 'row', alignItems: 'center', padding: SIZES.lg, gap: SIZES.md },
    modeIconBg: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    modeInfo: { flex: 1 },
    modeName: { fontSize: SIZES.fontLg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
    modeDesc: { ...FONTS.body2, lineHeight: 18 },
    hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm, backgroundColor: COLORS.warning + '15', borderRadius: SIZES.borderRadius, padding: SIZES.md, borderWidth: 1, borderColor: COLORS.warning + '30' },
    hintText: { ...FONTS.body2, flex: 1, lineHeight: 20, color: COLORS.textSecondary },

    // Session shared
    sessionContainer: { flex: 1, backgroundColor: COLORS.background },
    sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: 56, paddingBottom: SIZES.md },
    sessionProgress: { ...FONTS.body2, fontWeight: '600' },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
    progressTrack: { height: 3, backgroundColor: COLORS.surfaceHigh, marginHorizontal: SIZES.xl, borderRadius: 2, marginBottom: SIZES.xl },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },

    // Result screen
    resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xxl, gap: SIZES.lg },
    resultBadge: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary },
    bigScore: { fontSize: SIZES.fontXXl, fontWeight: '800' },
    resultTitle: { ...FONTS.h2, textAlign: 'center' },
    resultSub: { ...FONTS.body2, textAlign: 'center' },
    resultBar: { width: '100%', height: 8, backgroundColor: COLORS.surfaceHigh, borderRadius: 4, overflow: 'hidden' },
    resultFill: { height: '100%', borderRadius: 4 },
    exitBtn: { marginTop: SIZES.md, backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xxl, paddingVertical: SIZES.md, borderRadius: SIZES.borderRadius, ...SHADOWS.primary },
    exitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.fontMd },

    // Flashcard
    cardWrapper: { flex: 1, marginHorizontal: SIZES.xl, marginBottom: SIZES.lg },
    flipCard: { position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', borderRadius: SIZES.borderRadiusLg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.md },
    flipCardFront: {},
    flipCardBack: {},
    flipCardGrad: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xxl, gap: SIZES.lg },
    flipHint: { ...FONTS.label, color: COLORS.textMuted },
    flipCardText: { ...FONTS.h3, textAlign: 'center', lineHeight: 28 },
    tapHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SIZES.md },
    tapHintText: { ...FONTS.caption },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
    tag: { backgroundColor: COLORS.primary + '30', borderRadius: SIZES.borderRadiusFull, paddingHorizontal: SIZES.sm, paddingVertical: 3 },
    tagText: { fontSize: SIZES.fontXs, color: COLORS.primary, fontWeight: '600' },

    ratingRow: { flexDirection: 'row', paddingHorizontal: SIZES.lg, gap: SIZES.sm, marginBottom: SIZES.xxl },
    rateBtn: { flex: 1, paddingVertical: SIZES.sm, borderRadius: SIZES.borderRadius, borderWidth: 1.5, alignItems: 'center' },
    rateBtnText: { fontSize: SIZES.fontXs, fontWeight: '700' },
    ratingHint: { ...FONTS.caption, textAlign: 'center', paddingHorizontal: SIZES.xxl, marginBottom: SIZES.xxl },

    // Quiz
    quizContent: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxxl },
    conceptTag: { ...FONTS.label, color: COLORS.primary, marginBottom: SIZES.sm },
    questionText: { ...FONTS.h3, lineHeight: 26, marginBottom: SIZES.xl },
    optionsCol: { gap: SIZES.sm, marginBottom: SIZES.xl },
    option: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, padding: SIZES.md, borderRadius: SIZES.borderRadius, borderWidth: 1.5 },
    optionLetter: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    optionLetterText: { fontSize: SIZES.fontSm, fontWeight: '700' },
    optionText: { flex: 1, fontSize: SIZES.fontMd, color: COLORS.textPrimary, lineHeight: 21 },
    explanationBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm, backgroundColor: COLORS.accent + '15', borderRadius: SIZES.borderRadius, padding: SIZES.md, marginBottom: SIZES.xl, borderWidth: 1, borderColor: COLORS.accent + '30' },
    explanationText: { flex: 1, ...FONTS.body2, lineHeight: 20, color: COLORS.textSecondary },
    primaryBtn: { backgroundColor: COLORS.primary, height: 52, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', ...SHADOWS.primary },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { color: COLORS.white, fontSize: SIZES.fontMd, fontWeight: '700' },
});
