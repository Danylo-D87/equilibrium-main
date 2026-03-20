/**
 * Open Interest Trend Chart.
 *
 * Shows Open Interest trend over time with percentage change indicators.
 *
 * Top 70%: Price panel
 * Bottom 30%: OI line chart
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import PricePanel from './PricePanel';
import { D, MARGIN_NARROW, fmtK, fmtTick, fmtDateShort } from './chartTheme';
import type { DashboardData } from '../../types/dashboard';

interface OITrendChartProps {
    data: DashboardData;
}

interface OIDataPoint {
    date: string;
    oi: number;
    oiChange?: number;
    oiChangePct?: number;
}

export default function OITrendChart({ data }: OITrendChartProps) {
    const { weeks, priceSeries } = data;

    const oiData = useMemo((): OIDataPoint[] => {
        const points = weeks.map((w, i) => {
            const oi = (w.open_interest as number) ?? 0;
            const prevOI = i > 0 ? ((weeks[i - 1].open_interest as number) ?? 0) : oi;
            const oiChange = oi - prevOI;
            const oiChangePct = prevOI !== 0 ? (oiChange / prevOI) * 100 : 0;

            return {
                date: w.date,
                oi,
                oiChange: i > 0 ? oiChange : undefined,
                oiChangePct: i > 0 ? oiChangePct : undefined,
            };
        });
        return points;
    }, [weeks]);

    // Current stats
    const currentOI = oiData[oiData.length - 1]?.oi ?? 0;
    const currentChange = oiData[oiData.length - 1]?.oiChange ?? 0;
    const currentChangePct = oiData[oiData.length - 1]?.oiChangePct ?? 0;

    if (oiData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Top 70%: Price */}
            <div className="h-[70%] w-full">
                <PricePanel prices={priceSeries} />
            </div>

            {/* Bottom 30%: OI Trend */}
            <div className="w-full h-[30%] border-t border-white/[0.03]">
                {/* Header badges */}
                <div className="flex items-center gap-2 px-3 py-1 border-b border-white/[0.03]">
                    <span className="text-[9px] text-white/40">Current OI:</span>
                    <span className="text-[10px] font-mono text-white/70">{fmtK(currentOI)}</span>
                    <span className={`text-[9px] font-mono ${currentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {currentChange >= 0 ? '+' : ''}{fmtK(currentChange)} ({currentChangePct >= 0 ? '+' : ''}{currentChangePct.toFixed(1)}%)
                    </span>
                </div>

                <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                    <ComposedChart data={oiData} margin={{ ...MARGIN_NARROW, top: 8 }}>
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
                                const d = payload[0]?.payload as OIDataPoint;
                                if (!d) return null;
                                return (
                                    <div className="bg-[#141414] border border-white/[0.06] rounded-md px-2 py-1 text-[10px]">
                                        <div className="text-white/40 text-[9px] mb-1">{fmtDateShort(d.date)}</div>
                                        <div className="text-white/70">OI: {fmtK(d.oi)}</div>
                                        {d.oiChange !== undefined && (
                                            <div className={`${d.oiChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                Change: {d.oiChange >= 0 ? '+' : ''}{fmtK(d.oiChange)}
                                            </div>
                                        )}
                                        {d.oiChangePct !== undefined && (
                                            <div className="text-white/40 text-[9px]">
                                                {d.oiChangePct >= 0 ? '+' : ''}{d.oiChangePct.toFixed(1)}%
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="oi"
                            fill="rgba(59,130,246,0.15)"
                            stroke="rgba(59,130,246,0.6)"
                            strokeWidth={1.5}
                        />
                        <Line
                            type="monotone"
                            dataKey="oi"
                            stroke={D.specLine}
                            strokeWidth={2}
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="h-5 flex items-center justify-center gap-3 text-[9px] text-white/30">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: D.specLine }} />
                    Open Interest
                </span>
            </div>
        </div>
    );
}
