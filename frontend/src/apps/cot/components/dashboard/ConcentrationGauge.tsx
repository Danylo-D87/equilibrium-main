/**
 * Concentration Ratio — SVG Gauge Meter (Speedometer).
 *
 * Zones:
 *  0–40 %  → Healthy     (green)
 *  40–60%  → Elevated    (yellow)
 *  60–100% → Dangerous   (red)
 *
 * Shows Top-4 Long & Short, Top-8 Long & Short.
 * Gracefully handles null concentration data.
 *
 * Plan reference: Section 4.11
 */

import type { DashboardData } from '../../types/dashboard';

// ─── Constants ───────────────────────────────────────────────

const SIZE = 180;
const CX = SIZE / 2;
const CY = SIZE / 2 + 10;
const R = 68;
const STROKE = 10;

/** Arc angles: 180° gauge from -180° to 0° (left to right) */
const START_ANGLE = -180;
const END_ANGLE = 0;
const TOTAL_DEG = END_ANGLE - START_ANGLE; // 180

interface Zone {
    from: number; // percent
    to: number;
    color: string;
    label: string;
}

const ZONES: Zone[] = [
    { from: 0, to: 40, color: '#22C55E', label: 'Healthy' },
    { from: 40, to: 60, color: '#EAB308', label: 'Elevated' },
    { from: 60, to: 100, color: '#EF4444', label: 'Dangerous' },
];

// ─── Helpers ─────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
    const start = polarToCartesian(cx, cy, r, startDeg);
    const end = polarToCartesian(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function percentToAngle(pct: number): number {
    return START_ANGLE + (Math.min(100, Math.max(0, pct)) / 100) * TOTAL_DEG;
}

function getZoneForValue(pct: number): Zone {
    return ZONES.find((z) => pct >= z.from && pct < z.to) ?? ZONES[ZONES.length - 1];
}

// ─── Component ───────────────────────────────────────────────

interface ConcentrationGaugeProps {
    data: DashboardData;
}

export default function ConcentrationGauge({ data }: ConcentrationGaugeProps) {
    const { concentration } = data;
    if (!concentration) {
        return (
            <div className="h-full flex items-center justify-center">
                <span className="text-white/20 text-xs tracking-wider uppercase">
                    Data not available
                </span>
            </div>
        );
    }

    const primary = concentration.top4_long_pct ?? 0;
    const zone = getZoneForValue(primary);
    const needleAngle = percentToAngle(primary);
    const needleEnd = polarToCartesian(CX, CY, R - STROKE / 2 - 4, needleAngle);

    return (
        <div className="flex flex-col h-full items-center justify-center p-4">
            {/* SVG Gauge */}
            <svg width={SIZE} height={SIZE / 2 + 30} viewBox={`0 0 ${SIZE} ${SIZE / 2 + 30}`} className="flex-shrink-0 mb-4">
                {/* Zone arcs */}
                {ZONES.map((z) => (
                    <path
                        key={z.label}
                        d={describeArc(CX, CY, R, percentToAngle(z.from), percentToAngle(z.to))}
                        fill="none"
                        stroke={z.color}
                        strokeWidth={STROKE}
                        strokeLinecap="butt"
                        opacity={0.25}
                    />
                ))}

                {/* Active arc (filled up to value) */}
                {primary > 0 && (
                    <path
                        d={describeArc(CX, CY, R, START_ANGLE, needleAngle)}
                        fill="none"
                        stroke={zone.color}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        opacity={0.8}
                    />
                )}

                {/* Needle */}
                <line
                    x1={CX}
                    y1={CY}
                    x2={needleEnd.x}
                    y2={needleEnd.y}
                    stroke="white"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    opacity={0.7}
                />
                <circle cx={CX} cy={CY} r={3} fill="white" opacity={0.5} />

                {/* Center value */}
                <text
                    x={CX}
                    y={CY + 20}
                    textAnchor="middle"
                    className="fill-white/80 text-[18px] font-mono font-bold"
                >
                    {primary.toFixed(1)}%
                </text>

                {/* Zone label */}
                <text
                    x={CX}
                    y={CY + 34}
                    textAnchor="middle"
                    className="text-[9px] font-medium uppercase tracking-widest"
                    fill={zone.color}
                    opacity={0.8}
                >
                    {zone.label}
                </text>

                {/* Min / Max labels */}
                <text x={CX - R - 4} y={CY + 10} textAnchor="end" className="fill-white/20 text-[8px]">0%</text>
                <text x={CX + R + 4} y={CY + 10} textAnchor="start" className="fill-white/20 text-[8px]">100%</text>
            </svg>

            {/* Side metrics */}
            <div className="grid grid-cols-2 w-full gap-x-4 gap-y-3 pt-4 border-t border-white/[0.04] text-[10px]">
                <MetricCell label="Top-4 Long" value={concentration.top4_long_pct} />
                <MetricCell label="Top-8 Long" value={concentration.top8_long_pct} />
                <MetricCell label="Top-4 Short" value={concentration.top4_short_pct} />
                <MetricCell label="Top-8 Short" value={concentration.top8_short_pct} />
            </div>
        </div>
    );
}

function MetricCell({ label, value }: { label: string; value: number | null }) {
    const zone = value != null ? getZoneForValue(value) : null;
    return (
        <div className="text-center group">
            <div className="text-white/25 uppercase tracking-wider text-[8px] mb-1 group-hover:text-white/40 transition-colors">{label}</div>
            <div className="font-mono font-semibold text-[14px]" style={{ color: zone ? zone.color : 'rgba(255,255,255,0.2)' }}>
                {value != null ? `${value.toFixed(1)}%` : '—'}
            </div>
        </div>
    );
}
