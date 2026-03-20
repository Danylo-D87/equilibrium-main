/**
 * Block 3 — Open Interest Pulse (OI Analysis).
 *
 * Two panels:
 *  Top:    Price line whose segments are coloured by the OI signal matrix
 *          (green / yellow / blue / red)
 *  Bottom: Area chart of Open Interest
 *
 * Plan reference: Section 4.4
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, Tooltip, CartesianGrid, Cell, Bar,
} from 'recharts';
import { D, MARGIN, MARGIN_NARROW, fmtK, fmtTick, fmtDateShort, TOOLTIP_STYLE } from './chartTheme';
import type { DashboardData, OISignalType } from '../../types/dashboard';

const SIGNAL_COLORS: Record<OISignalType, string> = {
    strong_demand: D.strongDemand,
    long_liquidation: D.longLiquidation,
    short_covering: D.shortCovering,
    new_supply: D.newSupply,
};

const SIGNAL_LABELS: Record<OISignalType, string> = {
    strong_demand: 'Strong Demand',
    long_liquidation: 'Long Liquidation',
    short_covering: 'Short Covering',
    new_supply: 'New Supply',
};

interface OIAnalysisChartProps {
    data: DashboardData;
}

export default function OIAnalysisChart({ data }: OIAnalysisChartProps) {
    const { weeks, priceSeries, oiSignals } = data;

    const chartData = useMemo(() => {
        if (!weeks || !Array.isArray(weeks)) return [];
        if (!priceSeries || !Array.isArray(priceSeries)) return [];
        if (!oiSignals || !Array.isArray(oiSignals)) return [];

        const priceMap = new Map(priceSeries.map((p) => [p.date, p.close]));
        const signalMap = new Map(oiSignals.map((s) => [s.date, s.signal]));

        return weeks.map((w) => ({
            date: w.date,
            price: priceMap.get(w.date) ?? null,
            oi: w.open_interest,
            signal: signalMap.get(w.date) ?? null,
            // For the colored segment bar trick — a thin bar per point
            barHeight: priceMap.get(w.date) ?? 0,
        }));
    }, [weeks, priceSeries, oiSignals]);

    if (chartData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    // Latest signal for badge
    const latestSignal = oiSignals.length > 0 ? oiSignals[0] : null;

    return (
        <div className="flex flex-col h-full">
            {/* Top: Price line coloured by signal — 70% */}
            <div className="h-[70%] w-full relative">
                {/* Latest signal badge */}
                {latestSignal && (
                    <div className="absolute top-1 right-14 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-medium bg-white/[0.04] border border-white/[0.06]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: SIGNAL_COLORS[latestSignal.signal] }} />
                        <span style={{ color: SIGNAL_COLORS[latestSignal.signal] }}>
                            {SIGNAL_LABELS[latestSignal.signal]}
                        </span>
                    </div>
                )}

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={MARGIN} syncId="oiPulse">
                        <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} hide />
                        <YAxis yAxisId="price" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={50} domain={['auto', 'auto']} />

                        <Tooltip
                            {...TOOLTIP_STYLE}
                            labelFormatter={fmtDateShort}
                            formatter={(v: number, name: string) => {
                                if (name === 'price') return [v?.toLocaleString(), 'Price'];
                                return [v, name];
                            }}
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                    <div className="bg-[#141414] border border-white/[0.06] rounded-md px-3 py-2 text-[11px]">
                                        <div className="text-white/40 text-[10px] mb-1">{fmtDateShort(label)}</div>
                                        <div className="text-white/80">Price: {d?.price?.toLocaleString() ?? '—'}</div>
                                        {d?.signal && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: SIGNAL_COLORS[d.signal as OISignalType] }} />
                                                <span style={{ color: SIGNAL_COLORS[d.signal as OISignalType] }}>
                                                    {SIGNAL_LABELS[d.signal as OISignalType]}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
                        />

                        {/* Colored dots on price line showing signal */}
                        <Line yAxisId="price" type="monotone" dataKey="price" stroke={D.priceLine} dot={false} strokeWidth={1.5} connectNulls />

                        {/* Signal colored bar segments (thin vertical ticks at price level) */}
                        <Bar yAxisId="price" dataKey="barHeight" barSize={2} opacity={0.15}>
                            {chartData.map((entry, idx) => (
                                <Cell
                                    key={idx}
                                    fill={entry.signal ? SIGNAL_COLORS[entry.signal as OISignalType] : 'transparent'}
                                />
                            ))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom: OI area — 30% */}
            <div className="h-[30%] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={MARGIN_NARROW} syncId="oiPulse">
                        <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
                        <YAxis yAxisId="oi" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 9, fill: D.axis }} axisLine={false} tickLine={false} width={50} />

                        <Tooltip {...TOOLTIP_STYLE} labelFormatter={fmtDateShort} formatter={(v: number) => [fmtK(v), 'Open Interest']} />

                        <Area yAxisId="oi" type="monotone" dataKey="oi" stroke="#6366f1" fill="rgba(99,102,241,0.1)" strokeWidth={1.2} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="h-5 flex items-center justify-center gap-3 text-[9px] text-white/30">
                {Object.entries(SIGNAL_LABELS).map(([key, label]) => (
                    <span key={key} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: SIGNAL_COLORS[key as OISignalType] }} />
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}
