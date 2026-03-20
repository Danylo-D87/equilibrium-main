/**
 * Block 2 — Price vs Positioning (Divergence Chart).
 *
 * Two-panel chart:
 *  Top:    Price line
 *  Bottom: Spec net (blue) + Comm net (orange) lines
 *          + optional 10th percentile spread reference
 *
 * Plan reference: Section 4.3
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line,
    XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { D, MARGIN, MARGIN_NARROW, fmtK, fmtTick, fmtDateShort, TOOLTIP_STYLE } from './chartTheme';
import { getGroupLabel } from '../../utils/assetConfig';
import type { DashboardData } from '../../types/dashboard';

interface DivergenceChartProps {
    data: DashboardData;
}

export default function DivergenceChart({ data }: DivergenceChartProps) {
    const { weeks, priceSeries, specGroupKey, commGroupKey, market, spreadPercentile } = data;

    const specLabel = getGroupLabel(market.primary_report, specGroupKey);
    const commLabel = commGroupKey ? getGroupLabel(market.primary_report, commGroupKey) : null;

    const chartData = useMemo(() => {
        if (!weeks || !Array.isArray(weeks)) return [];
        if (!priceSeries || !Array.isArray(priceSeries)) return [];

        const priceMap = new Map(priceSeries.map((p) => [p.date, p.close]));
        const specNetKey = `${specGroupKey}_net`;
        const commNetKey = commGroupKey ? `${commGroupKey}_net` : null;

        return weeks.map((w) => ({
            date: w.date,
            price: priceMap.get(w.date) ?? null,
            specNet: typeof w[specNetKey] === 'number' ? w[specNetKey] as number : null,
            commNet: commNetKey && typeof w[commNetKey] === 'number' ? w[commNetKey] as number : null,
        }));
    }, [weeks, priceSeries, specGroupKey, commGroupKey]);

    if (chartData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    return (
        <div className="flex h-full">
            {/* Charts area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top: Price — 70% */}
                <div className="h-[70%] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={MARGIN} syncId="divergence">
                            <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                            <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} hide />
                            <YAxis yAxisId="price" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={50} domain={['auto', 'auto']} />
                            <Tooltip {...TOOLTIP_STYLE} labelFormatter={fmtDateShort} formatter={(v: number) => [v?.toLocaleString(), 'Price']} />
                            <Line yAxisId="price" type="monotone" dataKey="price" stroke={D.priceLine} dot={false} strokeWidth={1.5} connectNulls />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Bottom: Spec + Comm Net Positions — 30% */}
                <div className="h-[30%] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={MARGIN_NARROW} syncId="divergence">
                            <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                            <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
                            <YAxis yAxisId="net" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={50} />
                            <ReferenceLine yAxisId="net" y={0} stroke="#333" strokeWidth={0.5} />

                            <Tooltip
                                {...TOOLTIP_STYLE}
                                labelFormatter={fmtDateShort}
                                formatter={(v: number, name: string) => {
                                    const label = name === 'specNet' ? specLabel : commLabel ?? 'Comm';
                                    return [fmtK(v), label];
                                }}
                            />

                            <Line yAxisId="net" type="monotone" dataKey="specNet" name="specNet" stroke={D.specLine} dot={false} strokeWidth={1.5} connectNulls />
                            {commGroupKey && (
                                <Line yAxisId="net" type="monotone" dataKey="commNet" name="commNet" stroke={D.commLine} dot={false} strokeWidth={1.5} connectNulls />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="h-5 flex items-center justify-center gap-4 text-[9px] text-white/30">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 rounded-full" style={{ background: D.specLine }} />
                        {specLabel}
                    </span>
                    {commLabel && (
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-0.5 rounded-full" style={{ background: D.commLine }} />
                            {commLabel}
                        </span>
                    )}
                </div>
            </div>

            {/* Spread Percentile Sidebar */}
            {spreadPercentile != null && (
                <div className="w-[110px] flex-shrink-0 border-l border-white/[0.04] flex flex-col items-center justify-center gap-3 px-2">
                    <div className="text-[8px] text-white/25 uppercase tracking-widest font-medium text-center">
                        Spread<br />Percentile
                    </div>

                    {/* Visual gauge bar */}
                    <div className="relative w-full flex flex-col items-center">
                        <div className="w-3 h-[80px] rounded-full overflow-hidden bg-white/[0.04] relative">
                            {/* 10th percentile threshold */}
                            <div
                                className="absolute w-full h-px bg-emerald-500/40 left-0"
                                style={{ bottom: '10%' }}
                            />
                            {/* 90th percentile threshold */}
                            <div
                                className="absolute w-full h-px bg-red-500/40 left-0"
                                style={{ bottom: '90%' }}
                            />
                            {/* Fill */}
                            <div
                                className="absolute bottom-0 w-full rounded-full transition-all duration-500"
                                style={{
                                    height: `${Math.max(3, spreadPercentile)}%`,
                                    background: spreadPercentile >= 90
                                        ? '#EF4444'
                                        : spreadPercentile <= 10
                                            ? '#22C55E'
                                            : 'rgba(255,255,255,0.15)',
                                }}
                            />
                            {/* Current marker */}
                            <div
                                className="absolute w-5 h-1 rounded-full -left-1 transition-all duration-500"
                                style={{
                                    bottom: `${Math.max(1, Math.min(99, spreadPercentile))}%`,
                                    transform: 'translateY(50%)',
                                    background: spreadPercentile >= 90
                                        ? '#EF4444'
                                        : spreadPercentile <= 10
                                            ? '#22C55E'
                                            : 'rgba(255,255,255,0.3)',
                                }}
                            />
                        </div>
                    </div>

                    {/* Value */}
                    <div className="text-center">
                        <div
                            className="text-[20px] font-mono font-bold"
                            style={{
                                color: spreadPercentile >= 90
                                    ? '#f87171'
                                    : spreadPercentile <= 10
                                        ? '#4ade80'
                                        : 'rgba(255,255,255,0.6)',
                            }}
                        >
                            {spreadPercentile.toFixed(0)}
                        </div>
                        <div className="text-[8px] text-white/20 mt-0.5">
                            {spreadPercentile >= 90
                                ? 'Wide spread'
                                : spreadPercentile <= 10
                                    ? 'Narrow spread'
                                    : 'Normal range'}
                        </div>
                    </div>

                    {/* Reference labels */}
                    <div className="flex justify-between w-full text-[7px] text-white/15">
                        <span>P10</span>
                        <span>P90</span>
                    </div>
                </div>
            )}
        </div>
    );
}
