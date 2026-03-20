/**
 * Block 6 — FLIP Detection.
 *
 * Price line chart with scatter/bubble markers at flip points
 * (where net position crosses zero).
 * Green = flip to LONG, Red = flip to SHORT.
 * Bubble size ∝ magnitude of the position change.
 *
 * Includes Long/Short Bias sub-panel (§6.9):
 * 100% stacked area showing Long% vs Short% with 50% flip line.
 *
 * Plan reference: Section 4.7
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, Tooltip, CartesianGrid,
    ReferenceLine,
} from 'recharts';
import { D, MARGIN, MARGIN_NARROW, fmtK, fmtTick, fmtDateShort } from './chartTheme';
import type { DashboardData } from '../../types/dashboard';

interface FlipChartProps {
    data: DashboardData;
}

interface PricePoint {
    date: string;
    price: number | null;
    isFlip: boolean;
    flipType: 'LONG' | 'SHORT' | null;
    flipMag: number;
    netBefore: number;
    netAfter: number;
}

export default function FlipChart({ data }: FlipChartProps) {
    const { weeks, priceSeries, flips, longShortBias } = data;

    // Max magnitude for bubble sizing
    const maxMag = useMemo(
        () => {
            if (!flips || !Array.isArray(flips) || flips.length === 0) return 1;
            return Math.max(1, ...flips.map((f) => f.magnitude));
        },
        [flips],
    );

    // Merge flip metadata into price series — guarantees bubbles sit exactly on the line
    const priceData = useMemo((): PricePoint[] => {
        if (!weeks || !Array.isArray(weeks)) return [];
        if (!priceSeries || !Array.isArray(priceSeries)) return [];
        if (!flips || !Array.isArray(flips)) return [];

        const priceMap = new Map(priceSeries.map((p) => [p.date, p.close]));
        const flipMap = new Map(flips.map((f) => [f.date, f]));
        return weeks.map((w) => {
            const flip = flipMap.get(w.date);
            return {
                date: w.date,
                price: priceMap.get(w.date) ?? null,
                isFlip: !!flip,
                flipType: flip?.type ?? null,
                flipMag: flip?.magnitude ?? 0,
                netBefore: flip?.netBefore ?? 0,
                netAfter: flip?.netAfter ?? 0,
            };
        });
    }, [weeks, priceSeries, flips]);

    if (priceData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Top panel: Price + FLIP bubbles — 70% */}
            <div className="h-[70%] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={priceData} margin={MARGIN}>
                        <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
                        <YAxis yAxisId="price" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={50} domain={['auto', 'auto']} />

                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload as PricePoint;
                                if (!d) return null;
                                return (
                                    <div className="bg-[#141414] border border-white/[0.06] rounded-md px-3 py-2 text-[11px]">
                                        <div className="text-white/40 text-[10px] mb-1">{fmtDateShort(d.date)}</div>
                                        <div className="text-white/80">Price: {d.price?.toLocaleString() ?? '—'}</div>
                                        {d.isFlip && (
                                            <div className="mt-1 pt-1 border-t border-white/[0.06]">
                                                <span className={`font-medium ${d.flipType === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    FLIP → {d.flipType}
                                                </span>
                                                <div className="text-white/40 mt-0.5">
                                                    {fmtK(d.netBefore)} → {fmtK(d.netAfter)}
                                                </div>
                                                <div className="text-white/30">
                                                    Magnitude: {fmtK(d.flipMag)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
                        />

                        {/* Price line with custom dots for flip events — always on the line */}
                        <Line
                            yAxisId="price"
                            type="monotone"
                            dataKey="price"
                            stroke={D.priceLine}
                            strokeWidth={1.5}
                            connectNulls
                            dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload?.isFlip || payload.price == null) return <g key={props.key} />;
                                const isLong = payload.flipType === 'LONG';
                                const r = Math.max(4, Math.min(14, (payload.flipMag / maxMag) * 14));
                                return (
                                    <circle
                                        key={props.key}
                                        cx={cx}
                                        cy={cy}
                                        r={r}
                                        fill={isLong ? D.flipToLong : D.flipToShort}
                                        fillOpacity={0.85}
                                        stroke={isLong ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}
                                        strokeWidth={1.5}
                                    />
                                );
                            }}
                            activeDot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom panel: Long/Short Bias — 30% */}
            {longShortBias.length > 0 && (
                <div className="w-full h-[30%] border-t border-white/[0.03]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={longShortBias} margin={MARGIN_NARROW}>
                            <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                            <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 8, fill: D.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={80} hide />
                            <YAxis
                                orientation="right"
                                tick={{ fontSize: 8, fill: D.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={32}
                                domain={[0, 100]}
                                ticks={[0, 50, 100]}
                                tickFormatter={(v: number) => `${v}%`}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const d = payload[0]?.payload;
                                    return (
                                        <div className="bg-[#141414] border border-white/[0.06] rounded-md px-2 py-1 text-[10px]">
                                            <div className="text-white/40 text-[9px]">{fmtDateShort(d?.date)}</div>
                                            <div className="text-emerald-400">Long: {d?.longPct}%</div>
                                            <div className="text-red-400">Short: {d?.shortPct}%</div>
                                        </div>
                                    );
                                }}
                            />
                            <ReferenceLine y={50} stroke={D.warningDiamond} strokeDasharray="4 4" strokeWidth={0.6} />
                            <Area type="monotone" dataKey="longPct" stackId="bias" fill="rgba(34,197,94,0.25)" stroke="rgba(34,197,94,0.6)" strokeWidth={1} />
                            <Area type="monotone" dataKey="shortPct" stackId="bias" fill="rgba(239,68,68,0.25)" stroke="rgba(239,68,68,0.6)" strokeWidth={1} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Legend */}
            <div className="h-5 flex items-center justify-center gap-4 text-[9px] text-white/30">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: D.flipToLong }} />
                    Flip → Long
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: D.flipToShort }} />
                    Flip → Short
                </span>
                <span>{flips.length} flips</span>
                <span className="text-white/15">|</span>
                <span className="text-emerald-400/50">Long%</span>
                <span className="text-red-400/50">Short%</span>
            </div>
        </div>
    );
}
