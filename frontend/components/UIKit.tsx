import React from 'react';
import {
    View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image,
    type StyleProp, type TextStyle, type TouchableOpacityProps, type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '@/contexts/AppearanceContext';
import { SIZES } from '@/theme';

// ── AACA Card ─────────────────────────────────────────────────────────
interface AacaCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    accentColor?: string;
    padded?: boolean;
}
export function AacaCard({ children, style, accentColor, padded = true }: AacaCardProps) {
    const C = useAppColors();
    return (
        <View style={[
            ac.card,
            { backgroundColor: C.surface, borderColor: C.border },
            padded && ac.padded,
            style,
        ]}>
            {accentColor ? <View style={[ac.accent, { backgroundColor: accentColor }]} /> : null}
            {children}
        </View>
    );
}
const ac = StyleSheet.create({
    card: {
        borderRadius: SIZES.borderRadius,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#14203C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    padded: { padding: SIZES.md },
    accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});

// ── AACA Button ───────────────────────────────────────────────────────
interface AacaButtonProps extends TouchableOpacityProps {
    label: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    color?: string;
    loading?: boolean;
    full?: boolean;
    textStyle?: StyleProp<TextStyle>;
}
export function AacaButton({
    label, icon, variant = 'primary', size = 'md', color, loading,
    full, disabled, style, textStyle, ...props
}: AacaButtonProps) {
    const C = useAppColors();
    const tone = color || (variant === 'danger' ? C.error : C.primary);
    const isPrimary = variant === 'primary' || variant === 'danger';
    const isGhost = variant === 'ghost';
    const fg = isPrimary ? '#fff' : tone;
    return (
        <TouchableOpacity
            {...props}
            disabled={disabled || loading}
            activeOpacity={0.84}
            style={[
                ab.btn,
                size === 'sm' ? ab.sm : ab.md,
                full && { flex: 1 },
                isPrimary && { backgroundColor: tone, borderColor: tone },
                variant === 'secondary' && { backgroundColor: tone + '12', borderColor: tone + '42' },
                isGhost && { backgroundColor: 'transparent', borderColor: C.border },
                (disabled || loading) && { opacity: 0.48 },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={fg} />
            ) : icon ? (
                <MaterialCommunityIcons name={icon as any} size={size === 'sm' ? 16 : 18} color={fg} />
            ) : null}
            <Text style={[ab.label, size === 'sm' && ab.labelSm, { color: fg }, textStyle]}>{label}</Text>
        </TouchableOpacity>
    );
}
const ab = StyleSheet.create({
    btn: {
        borderRadius: SIZES.borderRadius,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SIZES.xs,
    },
    md: { minHeight: 48, paddingHorizontal: SIZES.lg, paddingVertical: SIZES.sm },
    sm: { minHeight: 36, paddingHorizontal: SIZES.md, paddingVertical: 7 },
    label: { fontSize: SIZES.fontSm, fontWeight: '700' },
    labelSm: { fontSize: SIZES.fontXs },
});

// ── EmptyState ────────────────────────────────────────────────────────
interface EmptyStateProps {
    icon: string;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
}
export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
    const C = useAppColors();
    return (
        <View style={es.wrap}>
            <View style={[es.iconWrap, { backgroundColor: C.primary + '12', borderColor: C.primary + '24' }]}>
                <MaterialCommunityIcons name={icon as any} size={32} color={C.primary} />
            </View>
            <Text style={[es.title, { color: C.textPrimary }]}>{title}</Text>
            {subtitle ? <Text style={[es.sub, { color: C.textMuted }]}>{subtitle}</Text> : null}
            {actionLabel && onAction ? (
                <AacaButton label={actionLabel} onPress={onAction} size="sm" icon="plus" style={{ marginTop: SIZES.sm }} />
            ) : null}
        </View>
    );
}
const es = StyleSheet.create({
    wrap:     { alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.xxxl, paddingHorizontal: SIZES.xxl },
    iconWrap: { width: 64, height: 64, borderRadius: SIZES.borderRadius, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.xs, borderWidth: 1 },
    title:    { fontSize: SIZES.fontLg, fontWeight: '600', textAlign: 'center' },
    sub:      { fontSize: SIZES.fontSm, textAlign: 'center', lineHeight: 20 },
});

// ── SectionHeader ─────────────────────────────────────────────────────
interface SectionHeaderProps {
    title: string;
    action?: string;
    onAction?: () => void;
}
export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
    const C = useAppColors();
    return (
        <View style={sth.wrap}>
            <Text style={[sth.title, { color: C.textPrimary }]}>{title}</Text>
            {action ? (
                <TouchableOpacity onPress={onAction} style={sth.btn} activeOpacity={0.7}>
                    <Text style={[sth.action, { color: C.primary }]}>{action}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={C.primary} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
const sth = StyleSheet.create({
    wrap:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.xl, paddingTop: SIZES.lg, paddingBottom: SIZES.sm },
    title:  { fontSize: SIZES.fontLg, fontWeight: '700', letterSpacing: 0 },
    btn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
    action: { fontSize: SIZES.fontXs, fontWeight: '600' },
});

// ── SubjectBadge ──────────────────────────────────────────────────────
interface SubjectBadgeProps { label: string; color: string; }
export function SubjectBadge({ label, color }: SubjectBadgeProps) {
    return (
        <View style={[sb.wrap, { backgroundColor: color + '20' }]}>
            <View style={[sb.dot, { backgroundColor: color }]} />
            <Text style={[sb.label, { color }]}>{label}</Text>
        </View>
    );
}
const sb = StyleSheet.create({
    wrap:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
    dot:   { width: 5, height: 5, borderRadius: 3 },
    label: { fontSize: 11, fontWeight: '600' },
});

// ── StatusBadge ───────────────────────────────────────────────────────
type StatusTone = 'success' | 'warning' | 'pending' | 'info' | 'error' | 'neutral';
interface StatusBadgeProps {
    label: string;
    tone?: StatusTone;
    icon?: string;
}
export function StatusBadge({ label, tone = 'neutral', icon }: StatusBadgeProps) {
    const C = useAppColors();
    const color = {
        success: C.success,
        warning: C.warning,
        pending: C.textMuted,
        info: C.info,
        error: C.error,
        neutral: C.textSecondary,
    }[tone];
    const iconName = icon || {
        success: 'check-circle-outline',
        warning: 'pencil-circle-outline',
        pending: 'clock-outline',
        info: 'progress-check',
        error: 'alert-circle-outline',
        neutral: 'circle-outline',
    }[tone];
    return (
        <View style={[stb.wrap, { backgroundColor: color + '14', borderColor: color + '32' }]}>
            <MaterialCommunityIcons name={iconName as any} size={12} color={color} />
            <Text style={[stb.label, { color }]}>{label}</Text>
        </View>
    );
}
const stb = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    label: { fontSize: 10, fontWeight: '700' },
});

// ── ProgressBar ───────────────────────────────────────────────────────
interface ProgressBarProps {
    value: number;
    color?: string;
    height?: number;
    style?: StyleProp<ViewStyle>;
}
export function ProgressBar({ value, color, height = 7, style }: ProgressBarProps) {
    const C = useAppColors();
    const width = `${Math.max(0, Math.min(1, value)) * 100}%`;
    return (
        <View style={[pb.track, { height, backgroundColor: C.surfaceHigh }, style]}>
            <View style={[pb.fill, { width: width as any, backgroundColor: color || C.primary }]} />
        </View>
    );
}
const pb = StyleSheet.create({
    track: { width: '100%', borderRadius: 999, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 999 },
});

// ── StatTile ──────────────────────────────────────────────────────────
interface StatTileProps {
    icon: string;
    value: string | number;
    label: string;
    color?: string;
    sub?: string;
    style?: StyleProp<ViewStyle>;
}
export function StatTile({ icon, value, label, color, sub, style }: StatTileProps) {
    const C = useAppColors();
    const tone = color || C.primary;
    return (
        <AacaCard style={[stat.tile, style]}>
            <View style={[stat.icon, { backgroundColor: tone + '14' }]}>
                <MaterialCommunityIcons name={icon as any} size={18} color={tone} />
            </View>
            <Text style={[stat.value, { color: C.textPrimary }]}>{value}</Text>
            <Text style={[stat.label, { color: C.textSecondary }]}>{label}</Text>
            {sub ? <Text style={[stat.sub, { color: C.textMuted }]}>{sub}</Text> : null}
        </AacaCard>
    );
}
const stat = StyleSheet.create({
    tile: { flex: 1, minHeight: 104, gap: 5 },
    icon: { width: 34, height: 34, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    value: { fontSize: 21, fontWeight: '800', letterSpacing: 0 },
    label: { fontSize: SIZES.fontXs, fontWeight: '700' },
    sub: { fontSize: 10, lineHeight: 14 },
});

// ── SessionCard ───────────────────────────────────────────────────────
interface SessionCardProps {
    title: string;
    subtitle: string;
    meta?: string;
    onPress: () => void;
}
export function SessionCard({ title, subtitle, meta, onPress }: SessionCardProps) {
    const C = useAppColors();
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.86}>
            <AacaCard style={sc.card}>
                <View style={[sc.icon, { backgroundColor: C.primary + '14' }]}>
                    <MaterialCommunityIcons name="book-plus-multiple-outline" size={24} color={C.primary} />
                </View>
                <View style={sc.body}>
                    <Text style={[sc.title, { color: C.textPrimary }]}>{title}</Text>
                    <Text style={[sc.sub, { color: C.textSecondary }]}>{subtitle}</Text>
                    {meta ? <Text style={[sc.meta, { color: C.textMuted }]}>{meta}</Text> : null}
                </View>
                <View style={[sc.arrow, { backgroundColor: C.primary }]}>
                    <MaterialCommunityIcons name="arrow-right" size={17} color="#fff" />
                </View>
            </AacaCard>
        </TouchableOpacity>
    );
}
const sc = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    icon: { width: 52, height: 52, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, minWidth: 0, gap: 3 },
    title: { fontSize: SIZES.fontLg, fontWeight: '800' },
    sub: { fontSize: SIZES.fontSm, lineHeight: 19 },
    meta: { fontSize: SIZES.fontXs, fontWeight: '600' },
    arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

// ── CaptureTimelineItem ───────────────────────────────────────────────
interface CaptureTimelineItemProps {
    index: number;
    imageUri: string;
    title: string;
    statusLabel: string;
    statusTone: StatusTone;
    meta?: string;
    isLast?: boolean;
    children?: React.ReactNode;
}
export function CaptureTimelineItem({
    index, imageUri, title, statusLabel, statusTone, meta, isLast, children,
}: CaptureTimelineItemProps) {
    const C = useAppColors();
    return (
        <View style={cti.row}>
            <View style={cti.rail}>
                <View style={[cti.marker, { backgroundColor: C.primary }]}>
                    <Text style={cti.markerText}>{index}</Text>
                </View>
                {!isLast ? <View style={[cti.line, { backgroundColor: C.primary + '26' }]} /> : null}
            </View>
            <AacaCard style={cti.card}>
                <View style={cti.head}>
                    <Image source={{ uri: imageUri }} style={cti.thumb} resizeMode="cover" />
                    <View style={cti.info}>
                        <Text style={[cti.title, { color: C.textPrimary }]}>{title}</Text>
                        {meta ? <Text style={[cti.meta, { color: C.textMuted }]}>{meta}</Text> : null}
                    </View>
                    <StatusBadge label={statusLabel} tone={statusTone} />
                </View>
                {children}
            </AacaCard>
        </View>
    );
}
const cti = StyleSheet.create({
    row: { flexDirection: 'row', gap: SIZES.sm },
    rail: { width: 28, alignItems: 'center' },
    marker: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    markerText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    line: { flex: 1, width: 2, marginTop: 6, borderRadius: 1 },
    card: { flex: 1, gap: SIZES.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    thumb: { width: 52, height: 52, borderRadius: SIZES.borderRadius, backgroundColor: '#EEF4FF' },
    info: { flex: 1, minWidth: 0, gap: 2 },
    title: { fontSize: SIZES.fontSm, fontWeight: '800' },
    meta: { fontSize: SIZES.fontXs },
});

// ── LoadingScreen ─────────────────────────────────────────────────────
interface LoadingScreenProps { message?: string; }
export function LoadingScreen({ message }: LoadingScreenProps) {
    const C = useAppColors();
    return (
        <View style={[ls.wrap, { backgroundColor: C.background }]}>
            <ActivityIndicator size="large" color={C.primary} />
            {message ? <Text style={[ls.msg, { color: C.textSecondary }]}>{message}</Text> : null}
        </View>
    );
}
const ls = StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.md },
    msg:  { fontSize: SIZES.fontSm },
});

// ── ErrorBanner ───────────────────────────────────────────────────────
interface ErrorBannerProps { message: string; onRetry?: () => void; }
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
    const C = useAppColors();
    return (
        <View style={[eb.wrap, { backgroundColor: C.error + '18', borderColor: C.error + '40' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={[eb.msg, { color: C.error }]}>{message}</Text>
            {onRetry ? (
                <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[eb.retry, { color: C.error }]}>Réessayer</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
const eb = StyleSheet.create({
    wrap:  { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderRadius: SIZES.borderRadiusSm, borderWidth: 1, padding: SIZES.sm },
    msg:   { flex: 1, fontSize: SIZES.fontXs, lineHeight: 18 },
    retry: { fontWeight: '700', fontSize: SIZES.fontXs },
});
