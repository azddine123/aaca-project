// AACA Design System — supports Dark & Light themes

export const DARK_COLORS = {
    // Brand
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    primaryLight: '#818CF8',
    accent: '#38BDF8',
    accentDark: '#0EA5E9',

    // Backgrounds — Deep Navy
    background: '#07091A',
    surface: '#0D1226',
    surfaceMid: '#131A30',
    surfaceHigh: '#1A2340',
    surfaceElevated: '#1F2A4A',

    // Borders
    border: 'rgba(255,255,255,0.07)',
    borderMid: 'rgba(255,255,255,0.13)',
    borderActive: 'rgba(99,102,241,0.6)',

    // Text
    textPrimary: '#F0F4FF',
    textSecondary: '#8892B0',
    textMuted: '#4A5568',
    textPlaceholder: '#2D3748',

    white: '#FFFFFF',
    black: '#000000',

    // Status
    error: '#F87171',
    errorDark: '#EF4444',
    success: '#34D399',
    successDark: '#10B981',
    warning: '#FBBF24',
    warningDark: '#F59E0B',
    info: '#60A5FA',

    // Subject palette
    mathematics: '#3B82F6',
    physics: '#A855F7',
    chemistry: '#10B981',
    biology: '#F97316',
    cs: '#6366F1',
    engineering: '#06B6D4',
    economics: '#EAB308',
    literature: '#EC4899',
    history: '#8B5CF6',
    philosophy: '#64748B',
    other: '#6B7280',
};

export const LIGHT_COLORS = {
    // Brand — same
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    primaryLight: '#818CF8',
    accent: '#0EA5E9',
    accentDark: '#0284C7',

    // Backgrounds — Clean white
    background: '#F4F6FF',
    surface: '#FFFFFF',
    surfaceMid: '#EEF2FF',
    surfaceHigh: '#E0E7FF',
    surfaceElevated: '#C7D2FE',

    // Borders
    border: 'rgba(0,0,0,0.08)',
    borderMid: 'rgba(0,0,0,0.14)',
    borderActive: 'rgba(99,102,241,0.5)',

    // Text
    textPrimary: '#1E2048',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    textPlaceholder: '#D1D5DB',

    white: '#FFFFFF',
    black: '#000000',

    // Status
    error: '#EF4444',
    errorDark: '#DC2626',
    success: '#10B981',
    successDark: '#059669',
    warning: '#F59E0B',
    warningDark: '#D97706',
    info: '#3B82F6',

    // Subject palette — same
    mathematics: '#3B82F6',
    physics: '#A855F7',
    chemistry: '#10B981',
    biology: '#F97316',
    cs: '#6366F1',
    engineering: '#06B6D4',
    economics: '#EAB308',
    literature: '#EC4899',
    history: '#8B5CF6',
    philosophy: '#64748B',
    other: '#6B7280',
};

// Default export keeps backward compatibility with static imports
export const COLORS = DARK_COLORS;

export const GRADIENTS = {
    primary:  ['#6366F1', '#8B5CF6'] as [string, string],
    accent:   ['#38BDF8', '#6366F1'] as [string, string],
    success:  ['#10B981', '#34D399'] as [string, string],
    warning:  ['#F59E0B', '#FBBF24'] as [string, string],
    error:    ['#EF4444', '#F87171'] as [string, string],
    dark:     ['#0D1226', '#131A30'] as [string, string],
    hero:     ['#07091A', '#0D1226'] as [string, string],
    card:     ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)'] as [string, string],
    capture:  ['#6366F1', '#06B6D4'] as [string, string],
};

export const LIGHT_GRADIENTS = {
    primary:  ['#6366F1', '#8B5CF6'] as [string, string],
    accent:   ['#38BDF8', '#6366F1'] as [string, string],
    success:  ['#10B981', '#34D399'] as [string, string],
    warning:  ['#F59E0B', '#FBBF24'] as [string, string],
    error:    ['#EF4444', '#F87171'] as [string, string],
    dark:     ['#EEF2FF', '#E0E7FF'] as [string, string],
    hero:     ['#E0E7FF', '#EEF2FF'] as [string, string],
    card:     ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)'] as [string, string],
    capture:  ['#6366F1', '#06B6D4'] as [string, string],
};

export const SIZES = {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 48,

    fontXs: 11,
    fontSm: 13,
    fontMd: 15,
    fontLg: 17,
    fontXl: 22,
    fontXXl: 28,
    fontTitle: 36,

    borderRadius: 14,
    borderRadiusSm: 8,
    borderRadiusMd: 10,
    borderRadiusLg: 20,
    borderRadiusXl: 28,
    borderRadiusFull: 9999,
};

export const FONTS: Record<string, any> = {
    h1:    { fontSize: SIZES.fontTitle, fontWeight: '800', letterSpacing: -0.8 },
    h2:    { fontSize: SIZES.fontXXl,   fontWeight: '700', letterSpacing: -0.5 },
    h3:    { fontSize: SIZES.fontXl,    fontWeight: '600', letterSpacing: -0.2 },
    h4:    { fontSize: SIZES.fontLg,    fontWeight: '600' },
    body1: { fontSize: SIZES.fontMd,    fontWeight: '400', lineHeight: 23 },
    body2: { fontSize: SIZES.fontSm,    fontWeight: '400', lineHeight: 20 },
    caption: { fontSize: SIZES.fontXs,  fontWeight: '400' },
    label: { fontSize: SIZES.fontXs,    fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: 1 },
    mono:  { fontSize: SIZES.fontSm,    fontFamily: 'monospace' },
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
        elevation: 4,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
        elevation: 10,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.65,
        shadowRadius: 28,
        elevation: 18,
    },
    primary: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 10,
    },
    accent: {
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
};

export const SUBJECT_COLORS: Record<string, string> = {
    mathematics: DARK_COLORS.mathematics,
    physics:     DARK_COLORS.physics,
    chemistry:   DARK_COLORS.chemistry,
    biology:     DARK_COLORS.biology,
    cs:          DARK_COLORS.cs,
    engineering: DARK_COLORS.engineering,
    economics:   DARK_COLORS.economics,
    literature:  DARK_COLORS.literature,
    history:     DARK_COLORS.history,
    philosophy:  DARK_COLORS.philosophy,
    other:       DARK_COLORS.other,
};

export const SUBJECT_LABELS: Record<string, string> = {
    mathematics: 'Maths',
    physics:     'Physique',
    chemistry:   'Chimie',
    biology:     'Biologie',
    cs:          'Informatique',
    engineering: 'Ingénierie',
    economics:   'Économie',
    literature:  'Littérature',
    history:     'Histoire',
    philosophy:  'Philosophie',
    other:       'Autre',
};

export type AppColors = typeof DARK_COLORS;

// ── Moroccan Design System ───────────────────────────────────────────
// Used by screens that implement the Moroccan cultural redesign.
export const MOROCCAN = {
    // Base
    bg:             '#F0F2F5',
    surface:        '#FFFFFF',
    surfaceAlt:     '#F7F8FA',
    text:           '#1C1E21',
    textMuted:      '#65676B',
    textFaint:      '#8A8D91',
    border:         '#E4E6EB',
    borderSoft:     '#EEF0F3',
    // Brand — cobalt blue
    cobalt:         '#1B4FD8',
    cobaltDeep:     '#143FAE',
    cobaltSoft:     '#E8EEFC',
    // Moroccan accents
    terracotta:     '#C1440E',
    terracottaSoft: '#FBE9E0',
    gold:           '#D4A017',
    goldSoft:       '#FAF1D9',
    saffron:        '#F59E0B',
    saffronSoft:    '#FEF1D6',
    green:          '#1F8A5B',
    greenSoft:      '#E2F1EA',
    // Subjects
    subjectColors: {
        mathematics: '#1B4FD8',
        physics:     '#C1440E',
        biology:     '#1F8A5B',
        cs:          '#F59E0B',
        chemistry:   '#7C3AED',
        history:     '#D4A017',
        engineering: '#06B6D4',
        economics:   '#EAB308',
        literature:  '#EC4899',
        philosophy:  '#64748B',
        other:       '#6B7280',
    },
} as const;

export default { COLORS, DARK_COLORS, LIGHT_COLORS, SIZES, FONTS, SHADOWS, GRADIENTS, LIGHT_GRADIENTS, SUBJECT_COLORS, SUBJECT_LABELS, MOROCCAN };
