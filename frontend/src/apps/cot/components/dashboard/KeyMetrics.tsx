/**
 * KeyMetrics — Horizontal summary cards showing key figures at the top of the dashboard.
 *
 * Displays: Open Interest, Net Long, Net Short, Net Position
 * Each card shows the current value and weekly change.
 */

import type { DashboardData } from '../../types/dashboard';
import { getGroupLabel } from '../../utils/assetConfig';
import { useRef, useState } from 'react';
import { domToBlob } from 'modern-screenshot';
import { Camera, Check } from 'lucide-react';

interface KeyMetricsProps {
    data: DashboardData;
}

/** Format large numbers with K / M suffix */
function fmtCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';
    if (abs >= 1_000) return (value / 1_000).toFixed(1) + 'K';
    return value.toLocaleString();
}

interface MetricCardProps {
    label: string;
    value: number;
    change?: number;
    changePct?: number;
    accentColor?: string;
}

function MetricCard({ label, value, change, changePct, accentColor }: MetricCardProps) {
    const isPositive = (change ?? 0) >= 0;
    const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400';
    const arrow = isPositive ? '▲' : '▼';

    return (
        <div className="flex-1 min-w-[140px] bg-white/[0.02] border border-white/[0.05] rounded-lg px-4 py-3 flex flex-col gap-1.5 hover:bg-white/[0.04] transition-colors duration-300">
            <span className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">
                {label}
            </span>
            <span
                className="text-[20px] font-mono font-semibold tracking-tight"
                style={{ color: accentColor || 'rgba(255,255,255,0.85)' }}
            >
                {fmtCompact(value)}
            </span>
            {change != null && (
                <span className={`text-[10px] font-mono ${changeColor} flex items-center gap-1`}>
                    <span className="text-[8px]">{arrow}</span>
                    {isPositive ? '+' : ''}{fmtCompact(change)}
                    {changePct != null && (
                        <span className="text-white/20 ml-1">
                            ({isPositive ? '+' : ''}{changePct.toFixed(1)}%)
                        </span>
                    )}
                </span>
            )}
        </div>
    );
}

export default function KeyMetrics({ data }: KeyMetricsProps) {
    const blockRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const { weeks, specGroupKey, market } = data;
    if (!weeks || weeks.length === 0) return null;

    const groupLabel = getGroupLabel(market.primary_report, specGroupKey);

    // Latest week is last element (oldest-first order in chart arrays)
    const latest = weeks[weeks.length - 1];
    const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    const oi = (latest.open_interest as number) ?? 0;
    const netLong = (latest[`${specGroupKey}_long`] as number) ?? 0;
    const netShort = (latest[`${specGroupKey}_short`] as number) ?? 0;
    const netPosition = netLong - netShort;

    const prevOI = prev ? ((prev.open_interest as number) ?? 0) : oi;
    const prevLong = prev ? ((prev[`${specGroupKey}_long`] as number) ?? 0) : netLong;
    const prevShort = prev ? ((prev[`${specGroupKey}_short`] as number) ?? 0) : netShort;
    const prevNet = prevLong - prevShort;

    const oiChange = oi - prevOI;
    const oiChangePct = prevOI !== 0 ? (oiChange / prevOI) * 100 : 0;
    const longChange = netLong - prevLong;
    const shortChange = netShort - prevShort;
    const netChange = netPosition - prevNet;

    const handleScreenshot = async () => {
        if (!blockRef.current) return;
        try {
            const blob = await domToBlob(blockRef.current, {
                scale: 2, // High DPI
                style: { backgroundColor: '#0a0a0a', padding: '16px' }
            });
            if (blob) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to capture KeyMetrics screenshot', err);
        }
    };

    return (
        <div ref={blockRef} className="mb-3 group relative rounded-xl">
            {/* Header + Screenshot Button */}
            <div className="flex items-center justify-between mb-2 px-0.5">
                <div className="text-[9px] text-white/20 uppercase tracking-[0.12em]">
                    {groupLabel} · Key Metrics
                </div>
                <button
                    onClick={handleScreenshot}
                    className={`opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md transition-all duration-300 ${copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-white/15 hover:text-white/50 hover:bg-white/[0.06]'}`}
                    title="Copy metrics to clipboard"
                >
                    {copied ? <Check size={12} strokeWidth={2.5} /> : <Camera size={12} strokeWidth={1.5} />}
                </button>
            </div>
            
            <div className="flex gap-3 overflow-x-auto">
                <MetricCard
                    label="Open Interest"
                    value={oi}
                    change={oiChange}
                    changePct={oiChangePct}
                />
                <MetricCard
                    label="Net Long"
                    value={netLong}
                    change={longChange}
                    accentColor="rgba(34,197,94,0.8)"
                />
                <MetricCard
                    label="Net Short"
                    value={netShort}
                    change={shortChange}
                    accentColor="rgba(239,68,68,0.8)"
                />
                <MetricCard
                    label="Net Position"
                    value={netPosition}
                    change={netChange}
                    accentColor={netPosition >= 0 ? 'rgba(59,130,246,0.8)' : 'rgba(239,68,68,0.8)'}
                />
            </div>
        </div>
    );
}
