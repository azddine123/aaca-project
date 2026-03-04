// AACA Design System — adapted from labcollect-mobile structure

export const COLORS = {
    // Primary — Indigo
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    primaryLight: '#818CF8',

    // Backgrounds — Dark mode
    background: '#0F172A',   // slate-900
    surface: '#1E293B',      // slate-800
    surfaceHigh: '#334155',  // slate-700

    // Text
    textPrimary: '#F1F5F9',   // slate-100
    textSecondary: '#94A3B8', // slate-400
    textPlaceholder: '#64748B', // slate-500

    // Semantic
    white: '#FFFFFF',
    black: '#000000',
    border: '#334155',

    // Status
    error: '#EF4444',
    errorLight: '#FEF2F2',
    success: '#22C55E',
    successLight: '#F0FDF4',
    warning: '#EAB308',
    warningLight: '#FEFCE8',

    // Subject badges
    math: '#3B82F6',
    physics: '#8B5CF6',
    chemistry: '#10B981',
    biology: '#F59E0B',
    cs: '#6366F1',
    other: '#6B7280',
};

export const SIZES = {
    base: 8,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,

    fontXs: 12,
    fontSm: 14,
    fontMd: 16,
    fontLg: 18,
    fontXl: 24,
    fontXXl: 32,
    fontTitle: 36,

    borderRadius: 12,
    borderRadiusSm: 8,
    borderRadiusLg: 20,
};

export const FONTS: { [key: string]: any } = {
    h1: { fontSize: SIZES.fontXXl, fontWeight: 'bold' as const, color: COLORS.textPrimary },
    h2: { fontSize: SIZES.fontXl, fontWeight: 'bold' as const, color: COLORS.textPrimary },
    h3: { fontSize: SIZES.fontLg, fontWeight: '600' as const, color: COLORS.textPrimary },
    body1: { fontSize: SIZES.fontMd, color: COLORS.textPrimary },
    body2: { fontSize: SIZES.fontSm, color: COLORS.textSecondary },
    caption: { fontSize: SIZES.fontXs, color: COLORS.textSecondary },
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    lg: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 12,
    },
};

export const SUBJECT_COLORS: Record<string, string> = {
    mathematics: COLORS.math,
    physics: COLORS.physics,
    chemistry: COLORS.chemistry,
    biology: COLORS.biology,
    cs: COLORS.cs,
    other: COLORS.other,
};

export default { COLORS, SIZES, FONTS, SHADOWS, SUBJECT_COLORS };
