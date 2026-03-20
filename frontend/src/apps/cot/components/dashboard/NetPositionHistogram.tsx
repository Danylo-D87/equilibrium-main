/**
 * Net Position Histogram (Bidirectional).
 *
 * Shows net position (Long - Short) as a bidirectional bar chart:
 * - Green bars up for positive (Long > Short)
 * - Red bars down for negative (Short > Long)
 *
 * Top 70%: Price panel
 * Bottom 30%: Bidirectional histogram
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Bar, Cell,
    XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import PricePanel from './PricePanel';
import { D, MARGIN_NARROW, fmtK, fmtTick, fmtDateShort } from './chartTheme';
import type { DashboardData } from '../../types/dashboard';

interface NetPositionHistogramProps {
    data: DashboardData;
}

interface NetDataPoint {
    date: string;
    netPosition: number;
    long: number;
    short: number;
}

export default function NetPositionHistogram({ data }: NetPositionHistogramProps) {
    const { weeks, priceSeries, specGroupKey } = data;

    const netData = useMemo((): NetDataPoint[] => {
        return weeks.map((w) => {
            const long = (w[`${specGroupKey}_long`] as number) ?? 0;
            const short = (w[`${specGroupKey}_short`] as number) ?? 0;
            return {
                date: w.date,
                netPosition: long - short,
                long,
                short,
            };
        });
    }, [weeks, specGroupKey]);

    if (netData.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/20 text-xs">No data</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Top 70%: Price */}
            <div className="h-[70%] w-full">
                <PricePanel prices={priceSeries} />
            </div>

            {/* Bottom 30%: Bidirectional Net Position Bars */}
            <div className="w-full h-[30%] border-t border-white/[0.03]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={netData} margin={MARGIN_NARROW}>
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
                                const d = payload[0]?.payload as NetDataPoint;
                                if (!d) return null;
                                return (
                                    <div className="bg-[#141414] border border-white/[0.06] rounded-md px-2 py-1 text-[10px]">
                                        <div className="text-white/40 text-[9px] mb-1">{fmtDateShort(d.date)}</div>
                                        <div className="text-emerald-400">Long: {fmtK(d.long)}</div>
                                        <div className="text-red-400">Short: {fmtK(d.short)}</div>
                                        <div className={`font-medium ${d.netPosition >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            Net: {d.netPosition >= 0 ? '+' : ''}{fmtK(d.netPosition)}
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <ReferenceLine y={0} stroke={D.axis} strokeWidth={1} />
                        <Bar dataKey="netPosition" radius={[2, 2, 0, 0]}>
                            {netData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.netPosition >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'}
                                />
                            ))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="h-5 flex items-center justify-center gap-3 text-[9px] text-white/30">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded" style={{ background: 'rgba(34,197,94,0.7)' }} />
                    Net Long (↑)
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded" style={{ background: 'rgba(239,68,68,0.7)' }} />
                    Net Short (↓)
                </span>
            </div>
        </div>
    );
}
