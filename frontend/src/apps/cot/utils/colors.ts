// =====================================================
// Shared color utilities for heatmap / cell backgrounds
// =====================================================

import type { CrowdedLevel } from '../types';

type RGB = [number, number, number];

export const GREEN: RGB = [0, 176, 80];
export const RED: RGB = [220, 53, 69];

const MAX_OPACITY = 0.85;
const MIN_OPACITY = 0.05;

/**
 * Heatmap color based on sign (green for positive, red for negative).
 */
export function getColorBySign(value: number | null | undefined, maxAbs: number): string {
    if (value == null || value === 0 || !maxAbs) return '';
    const color = value > 0 ? GREEN : RED;
    const raw = Math.min(Math.abs(value) / maxAbs, 1);
    const opacity = MIN_OPACITY + raw * (MAX_OPACITY - MIN_OPACITY);
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity.toFixed(3)})`;
}

/**
 * Mono-color heatmap (e.g. green-only for long changes, red-only for short).
 */
export function getColorMono(value: number | null | undefined, maxAbs: number, color: RGB): string {
    if (value == null || !maxAbs) return '';
    const raw = Math.min(Math.abs(value) / maxAbs, 1);
    if (raw < 0.01) return '';
    const opacity = MIN_OPACITY + raw * (MAX_OPACITY - MIN_OPACITY);
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity.toFixed(3)})`;
}

/**
 * Centered heatmap (0–100 scale, 50 = neutral).
 */
export function getColorCentered(value: number | null | undefined): string {
    if (value == null) return '';
    const v = Math.max(0, Math.min(100, value));
    const deviation = Math.abs(v - 50) / 50;
    if (deviation < 0.02) return '';
    const color = v > 50 ? GREEN : RED;
    const opacity = MIN_OPACITY + deviation * (MAX_OPACITY - MIN_OPACITY);
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity.toFixed(3)})`;
}

/**
 * Crowded level color (uses centered logic on .value).
 */
export function getColorCrowded(crowdedObj: CrowdedLevel | null | undefined): string {
    if (!crowdedObj || crowdedObj.value == null) return '';
    return getColorCentered(crowdedObj.value);
}

/**
 * Change background color for screener (subtle green/red).
 */
export function changeBg(v: number | null | undefined): string {
    if (v == null || v === 0) return '';
    const c = v > 0 ? [0, 176, 80] : [220, 53, 69];
    return `rgba(${c[0]},${c[1]},${c[2]},0.08)`;
}

/**
 * Category color palette for screener tags.
 */
export const CAT_COLORS: Record<string, { bg: string; text: string }> = {
    currencies: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa' },
    crypto: { bg: 'rgba(168,85,247,0.12)', text: '#c084fc' },
    energy: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
    metals: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
    grains: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80' },
    softs: { bg: 'rgba(244,114,182,0.12)', text: '#f472b6' },
    indices: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
    rates: { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf' },
    livestock: { bg: 'rgba(251,146,60,0.12)', text: '#fb923c' },
    other: { bg: 'rgba(75,85,99,0.15)', text: '#6b7280' },
};
