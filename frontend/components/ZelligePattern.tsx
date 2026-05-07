import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Rect, Circle } from 'react-native-svg';

// ── Single zellige tile — 8-point Moroccan star (two overlapping squares + circle)
interface ZelligeTileProps {
    size?: number;
    color?: string;
}

export function ZelligeTile({ size = 28, color = '#1B4FD8' }: ZelligeTileProps) {
    const margin = size * 6 / 28;
    const s = size * 16 / 28;
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 2.2 / 28;
    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G fill="none" stroke={color} strokeWidth={0.9} strokeLinejoin="round">
                <Rect x={margin} y={margin} width={s} height={s} />
                <Rect
                    x={margin} y={margin}
                    width={s} height={s}
                    transform={`rotate(45, ${cx}, ${cy})`}
                />
                <Circle cx={cx} cy={cy} r={r} />
            </G>
        </Svg>
    );
}

// ── Repeating zellige grid — fills parent with overflow:hidden
interface ZelligePatternProps {
    color?: string;
    opacity?: number;
    tileSize?: number;
    cols?: number;
    rows?: number;
    style?: object;
}

export function ZelligePattern({
    color = '#1B4FD8',
    opacity = 0.18,
    tileSize = 28,
    cols = 14,
    rows = 10,
    style,
}: ZelligePatternProps) {
    const totalWidth = cols * tileSize;
    const totalHeight = rows * tileSize;
    const margin = tileSize * 6 / 28;
    const s = tileSize * 16 / 28;
    const cx = tileSize / 2;
    const cy = tileSize / 2;
    const r = tileSize * 2.2 / 28;

    return (
        <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', opacity }, style]}
        >
            <Svg width={totalWidth} height={totalHeight}>
                {Array.from({ length: rows }).flatMap((_, row) =>
                    Array.from({ length: cols }).map((_, col) => (
                        <G
                            key={`${row}-${col}`}
                            fill="none"
                            stroke={color}
                            strokeWidth={0.9}
                            strokeLinejoin="round"
                            transform={`translate(${col * tileSize}, ${row * tileSize})`}
                        >
                            <Rect x={margin} y={margin} width={s} height={s} />
                            <Rect
                                x={margin} y={margin}
                                width={s} height={s}
                                transform={`rotate(45, ${cx}, ${cy})`}
                            />
                            <Circle cx={cx} cy={cy} r={r} />
                        </G>
                    ))
                )}
            </Svg>
        </View>
    );
}

// ── Horizontal gold zellige band (decorative divider)
interface ZelligeBandProps {
    color?: string;
    opacity?: number;
    height?: number;
}

export function ZelligeBand({ color = '#D4A017', opacity = 0.55, height = 14 }: ZelligeBandProps) {
    const tileW = 56;
    const cols = 8;
    return (
        <View style={{ height, width: '100%', overflow: 'hidden', opacity }}>
            <Svg width={tileW * cols} height={height}>
                {Array.from({ length: cols }).map((_, i) => (
                    <G key={i} fill="none" stroke={color} strokeWidth={1} strokeLinejoin="round"
                        transform={`translate(${i * tileW}, 0)`}>
                        <Rect x={0} y={0} width={14} height={14}
                            transform="rotate(45, 7, 7)" />
                        <Rect x={14} y={0} width={14} height={14}
                            transform="rotate(45, 21, 7)" />
                        <Rect x={28} y={0} width={14} height={14}
                            transform="rotate(45, 35, 7)" />
                        <Rect x={42} y={0} width={14} height={14}
                            transform="rotate(45, 49, 7)" />
                        <Circle cx={7} cy={7} r={1.5} />
                        <Circle cx={21} cy={7} r={1.5} />
                        <Circle cx={35} cy={7} r={1.5} />
                        <Circle cx={49} cy={7} r={1.5} />
                    </G>
                ))}
            </Svg>
        </View>
    );
}
