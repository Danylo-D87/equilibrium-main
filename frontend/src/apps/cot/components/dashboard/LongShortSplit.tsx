/**
 * Long/Short Split Chart.
 *
 * Shows Long and Short positions separately as area charts,
 * allowing visual comparison of their trends and magnitudes.
 *
 * Top 70%: Price panel
 * Bottom 30%: Long (green) + Short (red) area charts
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Area, Line,
    XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import PricePanel from './PricePanel';
import { D, MARGIN_NARROW, fmtK, fmtTick, fmtDateShort } from './chartTheme';
import type { DashboardData } from '../../types/dashboard';

interface LongShortSplitProps {
    data: DashboardData;
}

interface SplitDataPoint {
    date: string;
    long: number;
    short: number;
}

export default function LongShortSplit({ data }: LongShortSplitProps) {
    const { weeks, priceSeries, specGroupKey } = data;

    const splitData = useMemo((): SplitDataPoint[] => {
        if (!weeks || !Array.isArray(weeks)) return [];
        return weeks.map((w) => ({
            date: w.date,
            long: (w[`${specGroupKey}_long`] as number) ?? 0,
            short: (w[`${specGroupKey}_short`] as number) ?? 0,
        }));
    }, [weeks, specGroupKey]);

    const currentLong = splitData[splitData.length - 1]?.long ?? 0;
    const currentShort = splitData[splitData.length - 1]?.short ?? 0;

    if (splitData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Top 70%: Price */}
            <div className="h-[70%] w-full">
                <PricePanel priceSeries={priceSeries} weeks={weeks} />
            </div>

            {/* Bottom 30%: Long/Short Areas */}
            <div className="w-full h-[30%] border-t border-white/[0.03]">
                {/* Header badges */}
                <div className="flex items-center gap-3 px-3 py-1 border-b border-white/[0.03]">
                    <span className="text-[9px] text-emerald-400">
                        Long: <span className="font-mono">{fmtK(currentLong)}</span>
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="text-[9px] text-red-400">
                        Short: <span className="font-mono">{fmtK(currentShort)}</span>
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="text-[9px] text-white/40">
                        Ratio: <span className="font-mono">{currentShort > 0 ? (currentLong / currentShort).toFixed(2) : '—'}</span>
                    </span>
                </div>

                <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                    <ComposedChart data={splitData} margin={{ ...MARGIN_NARROW, top: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={fmtTick}
                            tick={{ fontSize: 8, fill: D.axis }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={80}
                            hide
                        />
                        <YAxis
                            orientation="right"
                            tickFormatter={fmtK}
                            tick={{ fontSize: 8, fill: D.axis }}
                            axisLine={false}
                            tickLine={false}
                            width={45}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload as SplitDataPoint;
                                if (!d) return null;
                                const ratio = d.short > 0 ? d.long / d.short : 0;
                                return (
                                    <div className="bg-[#141414] border border-white/[0.06] rounded-md px-2 py-1 text-[10px]">
                                        <div className="text-white/40 text-[9px] mb-1">{fmtDateShort(d.date)}</div>
                                        <div className="text-emerald-400">Long: {fmtK(d.long)}</div>
                                        <div className="text-red-400">Short: {fmtK(d.short)}</div>
                                        <div className="text-white/50 text-[9px] mt-0.5">
                                            L/S Ratio: {ratio.toFixed(2)}
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="long"
                            fill="rgba(34,197,94,0.2)"
                            stroke="rgba(34,197,94,0.7)"
                            strokeWidth={1.5}
                        />
                        <Area
                            type="monotone"
                            dataKey="short"
                            fill="rgba(239,68,68,0.2)"
                            stroke="rgba(239,68,68,0.7)"
                            strokeWidth={1.5}
                        />
                        <Line
                            type="monotone"
                            dataKey="long"
                            stroke="#22C55E"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="short"
                            stroke="#EF4444"
                            strokeWidth={2}
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="h-5 flex items-center justify-center gap-3 text-[9px] text-white/30">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Long Positions
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Short Positions
                </span>
            </div>
        </div>
    );
}
