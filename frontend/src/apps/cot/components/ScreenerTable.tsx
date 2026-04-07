import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatNumber, formatDate } from '../utils/formatters';
import { changeBg } from '../utils/colors';
import { SECTORS, type Sector } from '../utils/assetConfig';
import { useAllScreenerData } from '../hooks/useMarketQueries';
import { enrichV2Rows, type V2EnrichedRow } from '../utils/screenerV2';
import { useWatchlist } from '../hooks/useWatchlist';
import Spinner from '@/components/ui/Spinner';

const ROW_HEIGHT = 34;

interface ScreenerTableProps {
    onSelectMarket: (code: string) => void;
}

// ─── Column definition ───────────────────────────────────────

interface Col {
    key: string;
    label: string;
    width: number;
    align: 'left' | 'right' | 'center';
    sortable: boolean;
    type: string;
    sticky?: boolean;
    sortBy?: string;
}

const V2_COLUMNS: Col[] = [
    { key: 'name',            label: 'Market',        width: 210, align: 'left',   sortable: true,  type: 'market', sticky: true },
    { key: 'sector',          label: 'Sector',        width: 80,  align: 'center', sortable: true,  type: 'sector' },
    { key: 'spec_net',        label: 'Net Position',  width: 110, align: 'right',  sortable: true,  type: 'net' },
    { key: 'spec_percentile', label: 'Percentile',    width: 130, align: 'center', sortable: true,  type: 'percentile' },
    { key: 'spec_zscore',     label: 'Z-Score',       width: 80,  align: 'right',  sortable: true,  type: 'zscore' },
    { key: 'spec_wow',        label: 'WoW \u0394',    width: 100, align: 'right',  sortable: true,  type: 'change' },
    { key: 'open_interest',   label: 'Open Interest', width: 110, align: 'right',  sortable: true,  type: 'number' },
    { key: 'oi_change',       label: 'OI Trend',      width: 100, align: 'right',  sortable: true,  type: 'oi_trend' },
    { key: 'flip_tag',        label: 'Signal',        width: 130, align: 'center', sortable: true,  type: 'flip', sortBy: 'flip_severity' },
    { key: 'date',            label: 'Date',          width: 85,  align: 'center', sortable: true,  type: 'date' },
];

const TOTAL_WIDTH = V2_COLUMNS.reduce((s, c) => s + c.width, 0);

// ─── Color palettes ──────────────────────────────────────────

const SECTOR_COLORS: Record<Sector | string, { bg: string; text: string }> = {
    FX:        { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
    Metals:    { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
    Energy:    { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24' },
    Indices:   { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
    Bonds:     { bg: 'rgba(20,184,166,0.12)',  text: '#2dd4bf' },
    Grains:    { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
    Softs:     { bg: 'rgba(244,114,182,0.12)', text: '#f472b6' },
    Livestock: { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c' },
    Crypto:    { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc' },
    Other:     { bg: 'rgba(75,85,99,0.15)',    text: '#6b7280' },
};

const FLIP_COLORS: Record<string, { bg: string; text: string }> = {
    'FLIP \uD83D\uDD04':              { bg: 'rgba(168,85,247,0.20)', text: '#c084fc' },
    'Overcrowded \u26A0\uFE0F':       { bg: 'rgba(239,68,68,0.18)',  text: '#f87171' },
    'Reversal Watch \uD83D\uDC41\uFE0F': { bg: 'rgba(245,158,11,0.18)', text: '#fbbf24' },
    'Extreme':                          { bg: 'rgba(251,146,60,0.14)', text: '#fb923c' },
    'Pre-Flip':                         { bg: 'rgba(59,130,246,0.14)', text: '#60a5fa' },
    'Neutral':                          { bg: 'transparent',            text: '#4b5563' },
};

function getPercentileColor(p: number | null): string {
    if (p == null) return '#6b7280';
    if (p >= 95) return '#ef4444';
    if (p >= 90) return '#f97316';
    if (p >= 75) return '#f59e0b';
    if (p <= 5)  return '#22c55e';
    if (p <= 10) return '#4ade80';
    if (p <= 25) return '#3b82f6';
    return '#6b7280';
}

// ─── Sector filter list ──────────────────────────────────────

const SECTOR_FILTERS: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    ...SECTORS.map(s => ({ key: s.key, label: s.label })),
];

// ═════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════

export default function ScreenerTable({ onSelectMarket }: ScreenerTableProps) {
    const { screenerData, isLoading: loading, error } = useAllScreenerData();
    const { isPinned, toggleStar } = useWatchlist();
    const [search, setSearch] = useState('');
    const [sector, setSector] = useState('all');
    const [sortKey, setSortKey] = useState('flip_severity');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const tableScrollRef = useRef<HTMLDivElement>(null);

    // Enrich with v2 analytics (per-row primary_report used automatically)
    const data = useMemo(() => {
        if (!screenerData || !Array.isArray(screenerData)) return null;
        return enrichV2Rows(screenerData);
    }, [screenerData]);

    // Sort handler
    const handleSort = useCallback((key: string, sortBy?: string) => {
        const realKey = sortBy || key;
        if (sortKey === realKey) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(realKey);
            setSortDir('desc');
        }
    }, [sortKey]);

    // Filter + sort
    const rows = useMemo(() => {
        if (!data) return [];
        let list = [...data];

        // Sector filter
        if (sector !== 'all') {
            list = list.filter(r => r.sector === sector);
        }

        // Text search
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(r =>
                r.name.toLowerCase().includes(q) ||
                (r.exchange_code as string)?.toLowerCase().includes(q) ||
                r.code?.includes(q)
            );
        }

        // Sort — pinned first, then by sortKey
        const dir = sortDir === 'asc' ? 1 : -1;
        list.sort((a, b) => {
            // Pinned markets always float to top
            const ap = isPinned(a.code) ? 1 : 0;
            const bp = isPinned(b.code) ? 1 : 0;
            if (ap !== bp) return bp - ap;

            const va = (a as unknown as Record<string, unknown>)[sortKey];
            const vb = (b as unknown as Record<string, unknown>)[sortKey];

            if (typeof va === 'string' || typeof vb === 'string') {
                return String(va || '').localeCompare(String(vb || '')) * dir;
            }
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return ((va as number) - (vb as number)) * dir;
        });

        return list;
    }, [data, sector, search, sortKey, sortDir, isPinned]);

    // Sector counts
    const sectorCounts = useMemo(() => {
        if (!data) return {} as Record<string, number>;
        const counts: Record<string, number> = { all: data.length };
        for (const r of data) {
            counts[r.sector] = (counts[r.sector] || 0) + 1;
        }
        return counts;
    }, [data]);

    // Virtualizer
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableScrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 15,
    });

    // ── Guards ────────────────────────────────────────────────

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Spinner /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-destructive-fg text-sm font-medium">{error.message || 'Unknown error'}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="text-xs text-text-secondary hover:text-white transition-all duration-300 tracking-[0.14em] uppercase px-6 py-2.5 rounded-full border border-border hover:border-white/[0.15] hover:bg-white/[0.04]"
                >
                    Reload
                </button>
            </div>
        );
    }

    if (!data || !data.length) {
        return <div className="text-muted text-center py-10 text-xs uppercase tracking-[0.14em] font-medium">No screener data available</div>;
    }

    // ── Render ────────────────────────────────────────────────

    return (
        <div className="h-full flex flex-col">
            {/* ── Toolbar ─────────────────────────────────── */}
            <div className="flex-shrink-0 border-b border-border-subtle bg-background/50 px-3 sm:px-6 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {SECTOR_FILTERS.map(sf => {
                        const count = sectorCounts[sf.key] || 0;
                        const active = sector === sf.key;
                        const colors = sf.key !== 'all' ? SECTOR_COLORS[sf.key] : null;
                        return (
                            <button
                                key={sf.key}
                                onClick={() => setSector(sf.key)}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-300 ${
                                    active
                                        ? sf.key === 'all'
                                            ? 'bg-white/[0.10] text-white/90 border border-white/[0.08]'
                                            : 'border'
                                        : 'text-muted hover:text-text-secondary border border-transparent hover:border-border-subtle hover:bg-surface-hover'
                                }`}
                                style={active && colors ? { backgroundColor: colors.bg, color: colors.text, borderColor: colors.text + '30' } : undefined}
                            >
                                {sf.label}
                                {count > 0 && <span className="ml-1.5 text-[9px] opacity-40">{count}</span>}
                            </button>
                        );
                    })}

                    {/* Search + count */}
                    <div className="ml-auto flex items-center gap-3">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search market..."
                            className="bg-transparent border border-border-subtle rounded px-2.5 py-1 text-[10px] text-text-secondary placeholder:text-muted/50 focus:outline-none focus:border-white/[0.15] w-40 transition-all duration-300"
                        />
                        <div className="text-[10px] text-muted tabular-nums font-medium uppercase tracking-[0.14em] flex-shrink-0">
                            {rows.length} <span className="text-border-hover">markets</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Table ───────────────────────────────────── */}
            <div className="flex-1 overflow-auto" ref={tableScrollRef}>
                <table className="text-[11px] leading-tight" style={{ minWidth: TOTAL_WIDTH, borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead className="sticky top-0 z-20">
                        <tr style={{ background: '#0a0907' }}>
                            {/* Star column header */}
                            <th
                                className="px-1 py-2.5 text-[10px] font-medium border-b border-r border-border-subtle select-none text-muted text-center"
                                style={{ width: 36, minWidth: 36, maxWidth: 36, background: '#0a0907' }}
                                title="Watchlist"
                            >
                                ★
                            </th>
                            {V2_COLUMNS.map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => col.sortable && handleSort(col.key, col.sortBy)}
                                    className={`px-2 py-2.5 text-[10px] font-medium border-b border-r border-border-subtle select-none uppercase tracking-[0.10em] ${
                                        col.sortable ? 'cursor-pointer hover:text-white' : ''
                                    } ${sortKey === (col.sortBy || col.key) ? 'text-white' : 'text-muted'} ${
                                        col.sticky ? 'sticky left-[36px] z-10' : ''
                                    }`}
                                    style={{ width: col.width, minWidth: col.width, maxWidth: col.width, textAlign: col.align, background: '#0a0907' }}
                                    title={col.label}
                                >
                                    {col.label}
                                    {sortKey === (col.sortBy || col.key) && (
                                        <span className="ml-0.5 text-[8px]">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rowVirtualizer.getVirtualItems()[0]?.start > 0 && (
                            <tr><td colSpan={V2_COLUMNS.length + 1} style={{ height: rowVirtualizer.getVirtualItems()[0].start, padding: 0, border: 'none' }} /></tr>
                        )}
                        {rowVirtualizer.getVirtualItems().map(vr => {
                            const row = rows[vr.index];
                            const starred = isPinned(row.code);
                            return (
                                <tr
                                    key={row.code}
                                    data-index={vr.index}
                                    ref={rowVirtualizer.measureElement}
                                    onClick={() => onSelectMarket(row.code)}
                                    className={`border-b border-border-subtle hover:bg-surface-hover/30 cursor-pointer transition-colors duration-300 group ${starred ? 'bg-white/[0.015]' : ''}`}
                                >
                                    {/* Star cell */}
                                    <td
                                        className="px-1 py-[7px] border-r border-border-subtle text-center"
                                        style={{ width: 36, minWidth: 36 }}
                                        onClick={e => { e.stopPropagation(); toggleStar(row.code); }}
                                    >
                                        <span className={`text-[12px] cursor-pointer transition-colors duration-200 ${starred ? 'text-amber-400' : 'text-white/10 hover:text-white/30'}`}>
                                            ★
                                        </span>
                                    </td>
                                    {V2_COLUMNS.map(col => (
                                        <td
                                            key={col.key}
                                            className={`px-2 py-[7px] border-r border-border-subtle whitespace-nowrap ${
                                                col.sticky ? 'sticky left-[36px] z-10 bg-background group-hover:bg-surface-hover transition-colors' : ''
                                            }`}
                                            style={{ width: col.width, minWidth: col.width, textAlign: col.align, backgroundColor: col.sticky ? undefined : getCellBg(row, col) }}
                                        >
                                            {renderCell(row, col)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                        {(() => {
                            const items = rowVirtualizer.getVirtualItems();
                            const last = items[items.length - 1];
                            const pad = last ? rowVirtualizer.getTotalSize() - last.end : 0;
                            return pad > 0 ? <tr><td colSpan={V2_COLUMNS.length + 1} style={{ height: pad, padding: 0, border: 'none' }} /></tr> : null;
                        })()}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Cell background ─────────────────────────────────────────

function getCellBg(row: V2EnrichedRow, col: Col): string | undefined {
    if (col.type === 'change' || col.type === 'oi_trend') {
        return changeBg(row[col.key] as number | null | undefined);
    }
    if (col.type === 'net') {
        const v = (row as unknown as Record<string, unknown>)[col.key] as number | null;
        if (v == null || v === 0) return undefined;
        const c = v > 0 ? [0, 176, 80] : [220, 53, 69];
        return `rgba(${c[0]},${c[1]},${c[2]},0.06)`;
    }
    return undefined;
}

// ─── Cell rendering ──────────────────────────────────────────

function renderCell(row: V2EnrichedRow, col: Col): React.ReactNode {
    const raw = (row as unknown as Record<string, unknown>)[col.key];

    switch (col.type) {
        case 'market': {
            const name = row.name || '';
            const short = name.split(' - ')[0];
            const ticker = (row.exchange_code as string) || '';
            return (
                <div className="flex items-center gap-1.5 min-w-0">
                    {ticker && (
                        <span className="text-[10px] font-bold text-white/50 flex-shrink-0 w-[40px] truncate">{ticker}</span>
                    )}
                    <span className="text-primary group-hover:text-white font-medium truncate transition-colors" title={name}>
                        {short}
                    </span>
                </div>
            );
        }

        case 'sector': {
            const s = (raw as string) || 'Other';
            const colors = SECTOR_COLORS[s] || SECTOR_COLORS.Other;
            return (
                <span
                    className="inline-block px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                    {s}
                </span>
            );
        }

        case 'net': {
            const v = raw as number | null;
            if (v == null) return <span className="text-muted">—</span>;
            const color = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-text-secondary';
            return <span className={`tabular-nums font-mono font-medium ${color}`}>{formatNumber(v)}</span>;
        }

        case 'percentile': {
            const p = raw as number | null;
            if (p == null) return <span className="text-muted">—</span>;
            const c = getPercentileColor(p);
            return (
                <div className="flex items-center gap-2 justify-center">
                    <div className="w-[52px] h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(2, p)}%`, backgroundColor: c }}
                        />
                    </div>
                    <span className="tabular-nums font-mono text-[10px] w-[28px] text-right" style={{ color: c }}>
                        {p.toFixed(0)}
                    </span>
                </div>
            );
        }

        case 'zscore': {
            const z = raw as number | null;
            if (z == null) return <span className="text-muted">—</span>;
            const absZ = Math.abs(z);
            const color = absZ >= 2
                ? (z > 0 ? '#ef4444' : '#22c55e')
                : absZ >= 1.5
                    ? '#f59e0b'
                    : '#6b7280';
            return (
                <span className="tabular-nums font-mono text-[10px]" style={{ color }}>
                    {z > 0 ? '+' : ''}{z.toFixed(2)}
                    {absZ >= 2 && <span className="ml-0.5">{'\u26A0'}</span>}
                </span>
            );
        }

        case 'change': {
            const v = raw as number | null;
            if (v == null) return <span className="text-muted">—</span>;
            const color = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-muted';
            const arrow = v > 0 ? '\u25B2' : v < 0 ? '\u25BC' : '';
            return (
                <span className={`tabular-nums font-mono ${color}`}>
                    {arrow && <span className="text-[8px] mr-0.5">{arrow}</span>}
                    {v > 0 ? '+' : ''}{formatNumber(v)}
                </span>
            );
        }

        case 'oi_trend': {
            const v = raw as number | null;
            const pct = (row as V2EnrichedRow).oi_trend_pct;
            if (v == null) return <span className="text-muted">—</span>;
            const color = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-muted';
            const arrow = v > 0 ? '\u25B2' : v < 0 ? '\u25BC' : '';
            return (
                <span className={`tabular-nums font-mono ${color}`}>
                    {arrow && <span className="text-[8px] mr-0.5">{arrow}</span>}
                    {formatNumber(v)}
                    {pct != null && <span className="text-[8px] ml-0.5 opacity-50">{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>}
                </span>
            );
        }

        case 'number':
            return <span className="text-text-secondary tabular-nums font-mono">{formatNumber(raw as number | null | undefined)}</span>;

        case 'flip': {
            const tag = (raw as string) || 'Neutral';
            const colors = FLIP_COLORS[tag] || FLIP_COLORS.Neutral;
            if (tag === 'Neutral') return <span className="text-[9px] text-muted/40">—</span>;
            return (
                <span
                    className="inline-block px-2 py-0.5 rounded-sm text-[9px] font-bold tracking-wider whitespace-nowrap"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                    {tag}
                </span>
            );
        }

        case 'date':
            return <span className="text-text-secondary tabular-nums font-mono">{formatDate(raw as string | null | undefined)}</span>;

        default:
            return <span className="text-text-secondary">{String(raw ?? '—')}</span>;
    }
}
