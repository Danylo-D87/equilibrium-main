/**
 * Indicator 3 — Sentiment Divergence.
 *
 * Dual-line chart (0-100 scale) showing Spec percentile vs Comm percentile.
 * Shaded divergence zones where positions are extremely opposed
 * (spec ≥ 90 & comm ≤ 10 or vice versa).
 *
 * Plan reference: Section 4.8 — Advanced Indicators
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { D, MARGIN_NARROW, fmtTick, fmtDateShort, TOOLTIP_STYLE } from './chartTheme';
import PricePanel from './PricePanel';
import type { DashboardData } from '../../types/dashboard';

interface SentimentDivergenceChartProps {
    data: DashboardData;
}

export default function SentimentDivergenceChart({ data }: SentimentDivergenceChartProps) {
    const { sentimentDivergence } = data;

    const chartData = useMemo(
        () => {
            if (!sentimentDivergence || !Array.isArray(sentimentDivergence)) return [];
            return sentimentDivergence.map((p) => ({
                date: p.date,
                spec: +p.specPercentile.toFixed(1),
                comm: +p.commPercentile.toFixed(1),
                divergent: p.divergent,
                // Area fill only when divergent
                divFill: p.divergent ? Math.abs(p.specPercentile - p.commPercentile) : 0,
            }));
        },
        [sentimentDivergence],
    );

    const latest = chartData[chartData.length - 1];
    const divergentCount = chartData.filter((d) => d.divergent).length;

    if (chartData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Price panel — 70% */}
            <div className="h-[70%]">
                <PricePanel priceSeries={data.priceSeries} weeks={data.weeks} />
            </div>

            {/* Sentiment — 30% */}
            <div className="h-[30%] flex flex-col border-t border-white/[0.03]">
                {/* Header badges */}
                <div className="flex items-center gap-3 px-1 pt-1 flex-shrink-0">
                    <span className="text-[10px] text-white/30">
                        Spec: <span className="text-blue-400">{latest?.spec ?? 0}%</span>
                    </span>
                    <span className="text-[10px] text-white/30">
                        Comm: <span className="text-orange-400">{latest?.comm ?? 0}%</span>
                    </span>
                    {divergentCount > 0 && (
                        <span className="text-[10px] text-purple-400 ml-auto">
                            {divergentCount} divergent weeks
                        </span>
                    )}
                </div>

                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={MARGIN_NARROW}>
                            <defs>
                                <filter id="glow-spec" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                <filter id="glow-comm" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                <linearGradient id="gradient-div" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={D.divergenceFill} stopOpacity={0.6} />
                                    <stop offset="95%" stopColor={D.divergenceFill} stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={fmtTick}
                                tick={{ fontSize: 9, fill: D.axis }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                                minTickGap={60}
                            />
                            <YAxis
                                orientation="right"
                                domain={[0, 100]}
                                ticks={[0, 10, 50, 90, 100]}
                                tick={{ fontSize: 9, fill: D.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={30}
                                tickFormatter={(v: number) => `${v}`}
                            />

                            <Tooltip
                                {...TOOLTIP_STYLE}
                                labelFormatter={fmtDateShort}
                                formatter={(value: number, name: string) => {
                                    const label = name === 'spec' ? 'Spec %ile' : name === 'comm' ? 'Comm %ile' : name;
                                    return [`${value.toFixed(1)}%`, label];
                                }}
                            />

                            {/* Extreme zones */}
                            <ReferenceLine y={90} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" strokeWidth={0.7} />
                            <ReferenceLine y={10} stroke="rgba(34,197,94,0.3)" strokeDasharray="3 3" strokeWidth={0.7} />
                            <ReferenceLine y={50} stroke={D.axis} strokeDasharray="2 4" strokeWidth={0.5} />

                            {/* Divergence fill — only visible in divergence weeks */}
                            <Area
                                type="monotone"
                                dataKey="divFill"
                                fill="url(#gradient-div)"
                                stroke="none"
                                fillOpacity={1}
                                baseValue={0}
                            />

                            {/* Spec percentile line */}
                            <Line
                                type="monotone"
                                dataKey="spec"
                                stroke={D.specLine}
                                dot={false}
                                strokeWidth={2}
                                filter="url(#glow-spec)"
                            />

                            {/* Comm percentile line */}
                            <Line
                                type="monotone"
                                dataKey="comm"
                                stroke={D.commLine}
                                dot={false}
                                strokeWidth={2}
                                filter="url(#glow-comm)"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="h-5 flex items-center justify-center gap-4 text-[9px] text-white/30 flex-shrink-0">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-[2px]" style={{ background: D.specLine }} />
                        Spec %ile
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-[2px]" style={{ background: D.commLine }} />
                        Comm %ile
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ background: D.divergenceFill }} />
                        Divergence
                    </span>
                </div>
            </div>
        </div>
    );
}
