/**
 * BubbleChartView — inline chart panel (extracted from BubbleChartModal).
 * Renders Bubbles, Net Positions or Indicators directly inside DashboardPage.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { TIMEFRAMES } from '../../utils/constants';
import type { MarketData } from '../../types';

import {
    COLORS, COT_SIGNALS, COT_INDEX_PERIODS, INDICATOR_TYPES,
    buildGroupsMeta, buildGroupColors, fmtCompact,
} from './chartConstants';

import NetPositionsChart from './NetPositionsChart';
import IndicatorChart from './IndicatorChart';
import IndicatorPriceChart from './IndicatorPriceChart';
import PriceBubbleChart from './PriceBubbleChart';
import DeltaHistogram from './DeltaHistogram';

interface BubbleChartViewProps {
    data: MarketData | null;
    /** Which sub-view to display */
    viewMode: 'bubbles' | 'net' | 'indicators';
}

export default function BubbleChartView({ data, viewMode }: BubbleChartViewProps) {
    const [timeframe, setTimeframe] = useState('1y');
    const [cotPeriod, setCotPeriod] = useState('1y');
    const [indicatorType, setIndicatorType] = useState('cot_index');

    // Derive groups from data
    const groupsMeta = useMemo(() => buildGroupsMeta(data?.groups), [data?.groups]);
    const groupColors = useMemo(() => buildGroupColors(groupsMeta), [groupsMeta]);

    // Default active groups to first group (for bubbles)
    const [activeGroups, setActiveGroups] = useState<string[]>([]);
    const [indicatorGroups, setIndicatorGroups] = useState<string[]>([]);

    useEffect(() => {
        if (groupsMeta.length > 0) {
            setActiveGroups([groupsMeta[0].key]);
            setIndicatorGroups(groupsMeta.map(g => g.key));
        }
    }, [groupsMeta]);

    const toggleGroup = useCallback((key: string) => {
        setActiveGroups(prev =>
            prev.includes(key)
                ? prev.length > 1 ? prev.filter(g => g !== key) : prev
                : [...prev, key]
        );
    }, []);

    const toggleIndicatorGroup = useCallback((key: string) => {
        setIndicatorGroups(prev =>
            prev.includes(key)
                ? prev.length > 1 ? prev.filter(g => g !== key) : prev
                : [...prev, key]
        );
    }, []);

    // Weeks data (oldest-first) with aggregated Long/Short
    const weeksData = useMemo(() => {
        if (!data?.weeks) return [];
        const weeks = [...data.weeks].reverse();
        const tf = TIMEFRAMES.find(t => t.key === timeframe);
        if (!tf) return weeks;
        const sliced = tf.weeks === Infinity ? weeks : weeks.slice(-tf.weeks);
        return sliced.map(w => {
            const aggLong = activeGroups.reduce((s, g) => s + (Number(w[`${g}_long`]) || 0), 0);
            const aggShort = activeGroups.reduce((s, g) => s + (Number(w[`${g}_short`]) || 0), 0);
            const aggChange = activeGroups.reduce((s, g) => s + (Number(w[`${g}_change`]) || 0), 0);
            const aggChangeLong = activeGroups.reduce((s, g) => s + (Number(w[`${g}_change_long`]) || 0), 0);
            const aggChangeShort = activeGroups.reduce((s, g) => s + (Number(w[`${g}_change_short`]) || 0), 0);
            return {
                ...w,
                agg_long: aggLong, agg_short: aggShort, agg_oi: aggLong + aggShort,
                agg_change: aggChange, agg_change_long: aggChangeLong, agg_change_short: aggChangeShort,
            };
        });
    }, [data, timeframe, activeGroups]);

    // Chart data for net/cot_index views
    const chartData = useMemo(() => {
        if (!data?.weeks) return [];
        const weeks = [...data.weeks].reverse();
        const tf = TIMEFRAMES.find(t => t.key === timeframe);
        if (!tf) return weeks;
        return tf.weeks === Infinity ? weeks : weeks.slice(-tf.weeks);
    }, [data, timeframe]);

    const hasPrices = (data?.prices?.length ?? 0) > 0;

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Controls bar */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.01] flex-wrap">
                {/* Indicator sub-controls */}
                {viewMode === 'indicators' && (
                    <>
                        <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.05] rounded-lg p-0.5">
                            {INDICATOR_TYPES.map(it => (
                                <button
                                    key={it.key}
                                    onClick={() => setIndicatorType(it.key)}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase transition-all duration-200 ${indicatorType === it.key ? 'bg-white text-black' : 'text-white/30 hover:text-white/60'}`}
                                >
                                    {it.label}
                                </button>
                            ))}
                        </div>
                        {indicatorType === 'cot_index' && (
                            <>
                                <div className="w-px h-3 bg-white/[0.06]" />
                                <div className="flex gap-0.5">
                                    {COT_INDEX_PERIODS.map(p => (
                                        <button
                                            key={p.key}
                                            onClick={() => setCotPeriod(p.key)}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase transition-all duration-200 ${cotPeriod === p.key ? 'bg-white text-black' : 'text-white/30 hover:text-white/60'}`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                        {indicatorType === 'wci' && (
                            <>
                                <div className="w-px h-3 bg-white/[0.06]" />
                                <span className="text-[10px] text-white/25 tracking-wider">26W lookback</span>
                            </>
                        )}
                    </>
                )}

                {/* Net summary for bubbles */}
                {weeksData.length > 0 && viewMode === 'bubbles' && (() => {
                    const latest = weeksData[weeksData.length - 1];
                    const net = (Number(latest.agg_long) || 0) - (Number(latest.agg_short) || 0);
                    const isLong = net >= 0;
                    return (
                        <span className={`text-[11px] font-medium ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                            {isLong ? 'Net Long' : 'Net Short'} {fmtCompact(Math.abs(net))}
                        </span>
                    );
                })()}

                <div className="flex-1" />

                {/* Group toggles */}
                {(viewMode === 'bubbles' || viewMode === 'indicators') && (
                    <div className="flex gap-1">
                        {groupsMeta.map(g => {
                            const groups = viewMode === 'indicators' ? indicatorGroups : activeGroups;
                            const toggle = viewMode === 'indicators' ? toggleIndicatorGroup : toggleGroup;
                            const on = groups.includes(g.key);
                            return (
                                <button
                                    key={g.key}
                                    onClick={() => toggle(g.key)}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 border ${on
                                        ? ''
                                        : 'border-transparent text-white/20 hover:text-white/40 opacity-40'
                                    }`}
                                    style={on ? {
                                        backgroundColor: `${g.color}15`,
                                        borderColor: `${g.color}40`,
                                        color: g.color,
                                    } : {}}
                                >
                                    {g.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {(viewMode === 'bubbles' || viewMode === 'indicators') && (
                    <div className="w-px h-3 bg-white/[0.06]" />
                )}

                {/* Timeframe */}
                <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.05] rounded-lg p-0.5">
                    {TIMEFRAMES.map(tf => (
                        <button
                            key={tf.key}
                            onClick={() => setTimeframe(tf.key)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase transition-all duration-200 ${timeframe === tf.key
                                ? 'bg-white text-black'
                                : 'text-white/30 hover:text-white/60'
                            }`}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart area */}
            <div className="flex-1 flex flex-col min-h-0">
                {viewMode === 'net' ? (
                    <div className="flex-1 min-h-0 p-4">
                        {chartData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-white/20 text-xs uppercase tracking-wider">No data available</div>
                        ) : (
                            <NetPositionsChart chartData={chartData} groupsMeta={groupsMeta} groupColors={groupColors} />
                        )}
                    </div>
                ) : viewMode === 'indicators' ? (
                    <div className="flex-1 min-h-0 flex flex-col">
                        {hasPrices && (
                            <div style={{ flex: '65 1 0%' }} className="min-h-0 px-2 pt-1">
                                <IndicatorPriceChart prices={data?.prices} timeframe={timeframe} />
                            </div>
                        )}
                        {hasPrices && (
                            <div className="flex-shrink-0 h-px bg-white/[0.04] relative my-1">
                                <span className="absolute left-4 -top-2.5 text-[9px] text-white/25 bg-[#0a0a0a] px-1.5 tracking-widest uppercase font-bold">
                                    {indicatorType === 'wci' ? 'WCI (26W)' : `COT Index (${cotPeriod.toUpperCase()})`}
                                </span>
                            </div>
                        )}
                        <div style={{ flex: hasPrices ? '35 1 0%' : '1 1 0%' }} className="min-h-0 px-2 pb-1">
                            {chartData.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-white/20 text-xs uppercase tracking-wider">No data available</div>
                            ) : (
                                <IndicatorChart chartData={chartData} indicatorType={indicatorType} period={cotPeriod} groupsMeta={groupsMeta} activeGroups={indicatorGroups} />
                            )}
                        </div>
                    </div>
                ) : hasPrices ? (
                    <div className="flex-1 min-h-0 flex flex-col">
                        <div style={{ flex: '60 1 0%' }} className="min-h-0 px-2 pt-1">
                            <PriceBubbleChart prices={data?.prices} weeksData={weeksData} timeframe={timeframe} />
                        </div>
                        <div className="flex-shrink-0 h-px bg-white/[0.04] relative my-1">
                            <span className="absolute left-4 -top-2.5 text-[9px] text-white/25 bg-[#0a0a0a] px-1.5 tracking-widest uppercase font-bold">
                                Delta Long / Short
                            </span>
                        </div>
                        <div style={{ flex: '40 1 0%' }} className="min-h-0 px-2 pb-1">
                            <DeltaHistogram weeksData={weeksData} timeframe={timeframe} activeGroups={activeGroups} groupsMeta={groupsMeta} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-white/25 text-xs font-medium uppercase tracking-[0.14em]">Price data not available</p>
                            <p className="text-[10px] mt-1.5 text-white/10">No price history for this market</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend bar */}
            <div className="flex-shrink-0 h-8 border-t border-white/[0.04] flex items-center justify-center gap-6 px-4 bg-[#050505]">
                {viewMode === 'bubbles' && hasPrices ? (
                    <>
                        {COT_SIGNALS.map(s => (
                            <div key={s.key} className="flex items-center gap-1">
                                <svg width="10" height="4"><line x1="0" y1="2" x2="10" y2="2" stroke={s.color} strokeWidth="2" /></svg>
                                <span className="text-[9px] text-white/25">#{s.num} {s.label}</span>
                            </div>
                        ))}
                        <span className="text-[9px] text-white/10">│</span>
                        <span className="text-[9px] text-white/25">Line color = COT signal of period</span>
                    </>
                ) : viewMode === 'net' ? (
                    <>
                        {groupsMeta.map(g => (
                            <div key={g.key} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: g.color }} />
                                <span className="text-[10px] text-white/25 uppercase tracking-wider">{g.full}</span>
                            </div>
                        ))}
                    </>
                ) : viewMode === 'indicators' ? (
                    <>
                        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
                            {indicatorType === 'wci' ? 'WCI 26W' : `COT Index ${cotPeriod.toUpperCase()}`}
                        </span>
                        <span className="text-[10px] text-white/10">│</span>
                        {groupsMeta.filter(g => indicatorGroups.includes(g.key)).map(g => (
                            <div key={g.key} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: g.color }} />
                                <span className="text-[10px] text-white/25 uppercase tracking-wider">{g.full}</span>
                            </div>
                        ))}
                        <span className="text-[10px] text-white/10">│</span>
                        <span className="text-[10px] text-white/25">80% — overbought · 20% — oversold</span>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 10 10">
                                <polygon points="5,1 9,9 1,9" fill={COLORS.buy} />
                            </svg>
                            <span className="text-[10px] text-white/25">Buy (Net ↑)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 10 10">
                                <polygon points="5,9 9,1 1,1" fill={COLORS.sell} />
                            </svg>
                            <span className="text-[10px] text-white/25">Sell (Net ↓)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 10 10">
                                <circle cx="5" cy="5" r="4" fill={COLORS.mixed} />
                            </svg>
                            <span className="text-[10px] text-white/25">Mixed signal</span>
                        </div>
                        <span className="text-[10px] text-white/10">│</span>
                        <span className="text-[10px] text-white/25">Marker size = change magnitude</span>
                    </>
                )}
            </div>
        </div>
    );
}
