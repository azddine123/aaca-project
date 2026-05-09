import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '@/contexts/AppearanceContext';
import { SIZES } from '@/theme';

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
            <View style={[es.iconWrap, { backgroundColor: C.primary + '18' }]}>
                <MaterialCommunityIcons name={icon as any} size={32} color={C.primary} />
            </View>
            <Text style={[es.title, { color: C.textSecondary }]}>{title}</Text>
            {subtitle ? <Text style={[es.sub, { color: C.textMuted }]}>{subtitle}</Text> : null}
            {actionLabel && onAction ? (
                <TouchableOpacity style={[es.btn, { backgroundColor: C.primary }]} onPress={onAction} activeOpacity={0.85}>
                    <Text style={es.btnText}>{actionLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
const es = StyleSheet.create({
    wrap:     { alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.xxxl, paddingHorizontal: SIZES.xxl },
    iconWrap: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.xs },
    title:    { fontSize: SIZES.fontLg, fontWeight: '600', textAlign: 'center' },
    sub:      { fontSize: SIZES.fontSm, textAlign: 'center', lineHeight: 20 },
    btn:      { paddingHorizontal: SIZES.xl, paddingVertical: SIZES.sm, borderRadius: SIZES.borderRadiusFull, marginTop: SIZES.sm },
    btnText:  { color: '#fff', fontWeight: '700', fontSize: SIZES.fontSm },
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
    title:  { fontSize: SIZES.fontLg, fontWeight: '700', letterSpacing: -0.3 },
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
    wrap:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    dot:   { width: 5, height: 5, borderRadius: 3 },
    label: { fontSize: 11, fontWeight: '600' },
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
