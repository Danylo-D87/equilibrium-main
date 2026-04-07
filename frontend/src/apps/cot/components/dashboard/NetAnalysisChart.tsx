/**
 * Block 1.1 / 1.2 — Net Long / Net Short Analysis.
 *
 * Three vertically stacked panels:
 *  1. Price line chart
 *  2. Position (longs or shorts) + 5th/95th percentile zone fills
 *  3. Z-Score oscillator with ±2 reference lines
 *
 * Plan reference: Section 4.1, 4.2
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
    ReferenceArea,
} from 'recharts';
import { D, MARGIN, MARGIN_NARROW, fmtK, fmtTick, fmtDateShort, TOOLTIP_STYLE } from './chartTheme';
import {
    extractSeries,
    calcPercentileSeries,
    calcZScoreSeries,
    getPercentileThreshold,
} from '../../utils/calculations';
import type { DashboardData } from '../../types/dashboard';

interface NetAnalysisChartProps {
    data: DashboardData;
    /** 'long' = Block 1.1, 'short' = Block 1.2 */
    side: 'long' | 'short';
}

export default function NetAnalysisChart({ data, side }: NetAnalysisChartProps) {
    const { weeks, priceSeries, specGroupKey } = data;
    const lookbackWeeks = weeks.length;

    const seriesKey = `${specGroupKey}_${side}`;

    const chartData = useMemo(() => {
        if (!weeks || !Array.isArray(weeks)) return [];
        if (!priceSeries || !Array.isArray(priceSeries)) return [];

        const rawSeries = extractSeries(weeks, seriesKey);
        const zSeries = calcZScoreSeries(rawSeries, lookbackWeeks);
        const pctSeries = calcPercentileSeries(rawSeries, lookbackWeeks);

        // Build price map
        const priceMap = new Map(priceSeries.map((p) => [p.date, p.close]));

        return weeks.map((w, i) => ({
            date: w.date,
            price: priceMap.get(w.date) ?? null,
            position: rawSeries[i],
            zScore: zSeries[i],
            percentile: pctSeries[i],
        }));
    }, [weeks, priceSeries, seriesKey, lookbackWeeks]);

    // Percentile zone thresholds (5th and 95th)
    const { p5, p95 } = useMemo(() => {
        const rawSeries = extractSeries(weeks, seriesKey);
        return {
            p5: getPercentileThreshold(rawSeries, 0, lookbackWeeks, 5),
            p95: getPercentileThreshold(rawSeries, 0, lookbackWeeks, 95),
        };
    }, [weeks, seriesKey, lookbackWeeks]);

    if (chartData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Panel 1: Price — 70% */}
            <div className="h-[70%] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={MARGIN} syncId="netAnalysis">
                        <defs>
                            <filter id="glow-price" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} hide />
                        <YAxis yAxisId="price" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
                        <Tooltip
                            {...TOOLTIP_STYLE}
                            labelFormatter={fmtDateShort}
                            formatter={(v: number) => [v?.toLocaleString(), 'Price']}
                        />
                        <Line yAxisId="price" type="monotone" dataKey="price" stroke={D.priceLine} dot={false} strokeWidth={2} filter="url(#glow-price)" connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Panel 2: Long/Short position + percentile zones — 20% */}
            <div className="h-[20%] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={MARGIN} syncId="netAnalysis">
                        <defs>
                            <filter id="glow-pos" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <linearGradient id={`gradient-${side}-pos`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={side === 'long' ? '#3B82F6' : '#EF4444'} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={side === 'long' ? '#3B82F6' : '#EF4444'} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} hide />
                        <YAxis yAxisId="pos" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />

                        {/* Percentile zone: 95th — overheated (red bg) */}
                        {p95 != null && (
                            <ReferenceArea yAxisId="pos" y1={p95} y2={p95 * 1.5} fill={D.zone95} fillOpacity={1} />
                        )}
                        {/* Percentile zone: 5th — capitulation (green bg) */}
                        {p5 != null && (
                            <ReferenceArea yAxisId="pos" y1={p5 * 0.5} y2={p5} fill={D.zone5} fillOpacity={1} />
                        )}

                        {/* 5th & 95th reference lines */}
                        {p95 != null && <ReferenceLine yAxisId="pos" y={p95} stroke={D.extremeLong} strokeDasharray="4 4" strokeWidth={0.8} />}
                        {p5 != null && <ReferenceLine yAxisId="pos" y={p5} stroke={D.extremeShort} strokeDasharray="4 4" strokeWidth={0.8} />}

                        <Tooltip
                            {...TOOLTIP_STYLE}
                            labelFormatter={fmtDateShort}
                            formatter={(v: number) => [fmtK(v), side === 'long' ? 'Longs' : 'Shorts']}
                        />

                        <Area yAxisId="pos" type="monotone" dataKey="position" stroke={side === 'long' ? D.specLine : D.extremeLong} fill={`url(#gradient-${side}-pos)`} strokeWidth={2} filter="url(#glow-pos)" dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Panel 3: Z-Score — 10% */}
            <div className="h-[10%] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={MARGIN_NARROW} syncId="netAnalysis">
                        <defs>
                            <linearGradient id="gradient-z" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
                        <YAxis yAxisId="z" orientation="right" tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={30} domain={[-4, 4]} />

                        <ReferenceLine yAxisId="z" y={0} stroke="#444" />
                        <ReferenceLine yAxisId="z" y={2} stroke={D.extremeLong} strokeDasharray="3 3" strokeWidth={0.7} />
                        <ReferenceLine yAxisId="z" y={-2} stroke={D.extremeShort} strokeDasharray="3 3" strokeWidth={0.7} />

                        <Tooltip
                            {...TOOLTIP_STYLE}
                            labelFormatter={fmtDateShort}
                            formatter={(v: number) => [v?.toFixed(2), 'Z-Score']}
                        />

                        <Area yAxisId="z" type="monotone" dataKey="zScore" stroke={D.specLine} fill="url(#gradient-z)" strokeWidth={1.5} dot={false} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
