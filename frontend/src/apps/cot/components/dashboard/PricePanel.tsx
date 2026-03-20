/**
 * Shared price line panel — used as the 70% top section in every dashboard block.
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line,
    XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { D, MARGIN, fmtK, fmtTick, fmtDateShort, TOOLTIP_STYLE } from './chartTheme';
import type { DashboardPricePoint, DashboardWeek } from '../../types/dashboard';

interface PricePanelProps {
    priceSeries: DashboardPricePoint[];
    weeks: DashboardWeek[];
    syncId?: string;
}

export default function PricePanel({ priceSeries, weeks, syncId }: PricePanelProps) {
    const chartData = useMemo(() => {
        if (!weeks || !Array.isArray(weeks)) return [];
        if (!priceSeries || !Array.isArray(priceSeries)) return [];

        const priceMap = new Map(priceSeries.map((p) => [p.date, p.close]));
        return weeks.map((w) => ({
            date: w.date,
            price: priceMap.get(w.date) ?? null,
        }));
    }, [priceSeries, weeks]);

    if (!chartData.length) return null;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={MARGIN} syncId={syncId}>
                <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false} />
                <XAxis
                    dataKey="date"
                    tickFormatter={fmtTick}
                    tick={{ fontSize: 9, fill: D.axis }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={80}
                    hide
                />
                <YAxis
                    yAxisId="price"
                    orientation="right"
                    tickFormatter={fmtK}
                    tick={{ fontSize: 9, fill: D.axis }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    domain={['auto', 'auto']}
                />
                <Tooltip
                    {...TOOLTIP_STYLE}
                    labelFormatter={fmtDateShort}
                    formatter={(v: number) => [v?.toLocaleString(), 'Price']}
                />
                <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="price"
                    stroke={D.priceLine}
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}
