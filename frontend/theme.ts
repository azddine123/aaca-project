// PicLearn Design System — supports Dark & Light themes

export const DARK_COLORS = {
    // Brand
    primary: '#3B82F6',
    primaryDark: '#1B4FD8',
    primaryLight: '#7BA7FF',
    accent: '#22C7B8',
    accentDark: '#0F9F8F',

    // Backgrounds
    background: '#09111F',
    surface: '#101A2D',
    surfaceMid: '#17233A',
    surfaceHigh: '#20304D',
    surfaceElevated: '#293B5C',

    // Borders
    border: 'rgba(255,255,255,0.07)',
    borderMid: 'rgba(255,255,255,0.13)',
    borderActive: 'rgba(59,130,246,0.6)',

    // Text
    textPrimary: '#F5F8FF',
    textSecondary: '#A7B3C7',
    textMuted: '#6B7890',
    textPlaceholder: '#40506A',

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
    mathematics: '#2F6BFF',
    physics: '#8B5CF6',
    chemistry: '#0F9F8F',
    biology: '#1F8A5B',
    cs: '#2563EB',
    engineering: '#0891B2',
    economics: '#C4880A',
    literature: '#DB2777',
    history: '#B45309',
    philosophy: '#64748B',
    french: '#D946EF',
    arabic: '#16A34A',
    geography: '#0E7490',
    other: '#6B7280',
};

export const LIGHT_COLORS = {
    // Brand
    primary: '#1B4FD8',
    primaryDark: '#143FAE',
    primaryLight: '#4F7DF2',
    accent: '#0F9F8F',
    accentDark: '#0B7F73',

    // Backgrounds
    background: '#F6F8FC',
    surface: '#FFFFFF',
    surfaceMid: '#EEF4FF',
    surfaceHigh: '#E3ECFA',
    surfaceElevated: '#D5E3F8',

    // Borders
    border: 'rgba(0,0,0,0.08)',
    borderMid: 'rgba(0,0,0,0.14)',
    borderActive: 'rgba(27,79,216,0.5)',

    // Text
    textPrimary: '#172033',
    textSecondary: '#4C5A6E',
    textMuted: '#8B96A8',
    textPlaceholder: '#C7CEDA',

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
    mathematics: '#1B4FD8',
    physics: '#7C3AED',
    chemistry: '#0F9F8F',
    biology: '#1F8A5B',
    cs: '#2563EB',
    engineering: '#0891B2',
    economics: '#B7791F',
    literature: '#DB2777',
    history: '#B45309',
    philosophy: '#64748B',
    french: '#C026D3',
    arabic: '#16A34A',
    geography: '#0E7490',
    other: '#6B7280',
};

// Default export keeps backward compatibility with static imports
export const COLORS = DARK_COLORS;

export const GRADIENTS = {
    primary:  ['#1B4FD8', '#2563EB'] as [string, string],
    accent:   ['#0F9F8F', '#1B4FD8'] as [string, string],
    success:  ['#10B981', '#34D399'] as [string, string],
    warning:  ['#F59E0B', '#FBBF24'] as [string, string],
    error:    ['#EF4444', '#F87171'] as [string, string],
    dark:     ['#101A2D', '#17233A'] as [string, string],
    hero:     ['#09111F', '#13233B'] as [string, string],
    card:     ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)'] as [string, string],
    capture:  ['#1B4FD8', '#0F9F8F'] as [string, string],
};

export const LIGHT_GRADIENTS = {
    primary:  ['#1B4FD8', '#2563EB'] as [string, string],
    accent:   ['#0F9F8F', '#1B4FD8'] as [string, string],
    success:  ['#10B981', '#34D399'] as [string, string],
    warning:  ['#F59E0B', '#FBBF24'] as [string, string],
    error:    ['#EF4444', '#F87171'] as [string, string],
    dark:     ['#FFFFFF', '#EEF4FF'] as [string, string],
    hero:     ['#FFFFFF', '#EEF4FF'] as [string, string],
    card:     ['rgba(255,255,255,0.98)', 'rgba(238,244,255,0.82)'] as [string, string],
    capture:  ['#1B4FD8', '#0F9F8F'] as [string, string],
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

    borderRadius: 8,
    borderRadiusSm: 8,
    borderRadiusMd: 10,
    borderRadiusLg: 12,
    borderRadiusXl: 18,
    borderRadiusFull: 9999,
};

export const FONTS: Record<string, any> = {
    h1:    { fontSize: SIZES.fontTitle, fontWeight: '800', letterSpacing: 0 },
    h2:    { fontSize: SIZES.fontXXl,   fontWeight: '700', letterSpacing: 0 },
    h3:    { fontSize: SIZES.fontXl,    fontWeight: '600', letterSpacing: 0 },
    h4:    { fontSize: SIZES.fontLg,    fontWeight: '600' },
    body1: { fontSize: SIZES.fontMd,    fontWeight: '400', lineHeight: 23 },
    body2: { fontSize: SIZES.fontSm,    fontWeight: '400', lineHeight: 20 },
    caption: { fontSize: SIZES.fontXs,  fontWeight: '400' },
    label: { fontSize: SIZES.fontXs,    fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: 0 },
    mono:  { fontSize: SIZES.fontSm,    fontFamily: 'monospace' },
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 4,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.10,
        shadowRadius: 16,
        elevation: 10,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.14,
        shadowRadius: 28,
        elevation: 18,
    },
    primary: {
        shadowColor: '#1B4FD8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 10,
    },
    accent: {
        shadowColor: '#0F9F8F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
        elevation: 8,
    },
};

export const SUBJECT_COLORS: Record<string, string> = {
    mathematics: LIGHT_COLORS.mathematics,
    physics:     LIGHT_COLORS.physics,
    chemistry:   LIGHT_COLORS.chemistry,
    biology:     LIGHT_COLORS.biology,
    cs:          LIGHT_COLORS.cs,
    computer_science: LIGHT_COLORS.cs,
    engineering: LIGHT_COLORS.engineering,
    economics:   LIGHT_COLORS.economics,
    literature:  LIGHT_COLORS.literature,
    history:     LIGHT_COLORS.history,
    philosophy:  LIGHT_COLORS.philosophy,
    french:      LIGHT_COLORS.french,
    arabic:      LIGHT_COLORS.arabic,
    geography:   LIGHT_COLORS.geography,
    other:       LIGHT_COLORS.other,
};

export const SUBJECT_LABELS: Record<string, string> = {
    mathematics: 'Maths',
    physics:     'Physique',
    chemistry:   'Chimie',
    biology:     'Biologie',
    cs:          'Informatique',
    computer_science: 'Informatique',
    engineering: 'Ingénierie',
    economics:   'Économie',
    literature:  'Littérature',
    history:     'Histoire',
    philosophy:  'Philosophie',
    french:      'Français',
    arabic:      'Arabe',
    geography:   'Géographie',
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
