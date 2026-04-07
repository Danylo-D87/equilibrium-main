/**
 * /cot/dashboard/:code — Asset dashboard page.
 * Unified view with sub-tabs: Dashboard / Table / Bubbles / Net / Indicators
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useMarketData } from '../hooks/useMarketQueries';
import { useCotStore } from '../store/useCotStore';
import { getAssetConfig, getGroupLabel } from '../utils/assetConfig';
import { REPORT_TYPES, SUBTYPES } from '../utils/constants';
import type { ReportType, Subtype } from '../types';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import NetAnalysisChart from '../components/dashboard/NetAnalysisChart';
import OIAnalysisChart from '../components/dashboard/OIAnalysisChart';
import FlipChart from '../components/dashboard/FlipChart';
import SentimentDivergenceChart from '../components/dashboard/SentimentDivergenceChart';
import RangeSelector from '../components/dashboard/RangeSelector';
import ConcentrationGauge from '../components/dashboard/ConcentrationGauge';
import NetPositionHistogram from '../components/dashboard/NetPositionHistogram';
import GroupSelector from '../components/dashboard/GroupSelector';
import KeyMetrics from '../components/dashboard/KeyMetrics';
import FullscreenModal from '../components/dashboard/FullscreenModal';
import CotReportTable from '../components/CotReportTable';
import BubbleChartView from '../components/charts/BubbleChartView';
import { domToBlob } from 'modern-screenshot';

const DocumentationModal = lazy(() => import('../components/DocumentationModal'));

// ─── Types ────────────────────────────────────────────────────

type DashboardTab = 'dashboard' | 'table' | 'bubbles' | 'net' | 'indicators';

const TABS: { key: DashboardTab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'table', label: 'Table' },
    { key: 'bubbles', label: 'Bubbles' },
    { key: 'net', label: 'Net Pos' },
    { key: 'indicators', label: 'Indicators' },
];

// ─── Percentile badge ────────────────────────────────────────

function PercentileBadge({ value }: { value: number }) {
    let colorClass = 'text-white/50 bg-white/[0.06]';
    let label = 'Neutral';
    if (value >= 90) {
        colorClass = 'text-red-400 bg-red-500/10 border-red-500/20';
        label = 'Extreme Net Long';
    } else if (value >= 75) {
        colorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        label = 'Above Average';
    } else if (value <= 10) {
        colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        label = 'Extreme Net Short';
    } else if (value <= 25) {
        colorClass = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        label = 'Below Average';
    }

    return (
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${colorClass}`}>
            {label}
        </span>
    );
}

// ─── Icons ───────────────────────────────────────────────────

function ExpandIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
    );
}

function CameraIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

// ─── Main component ──────────────────────────────────────────

export default function DashboardPage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const setAvailableReports = useCotStore((s) => s.setAvailableReports);
    const {
        docsOpen, setDocsOpen,
        fitMode, toggleFitMode,
        reportType, setReportType,
        subtype, setSubtype,
        availableReports,
    } = useCotStore();
    const { data, isLoading, error } = useDashboardData(code ?? null);

    // Active sub-tab
    const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');

    // Fullscreen state
    const [fullscreenBlock, setFullscreenBlock] = useState<string | null>(null);

    // For Table tab — need raw market data
    const { data: marketData = null, isLoading: tableLoading } = useMarketData(
        reportType,
        subtype,
        activeTab === 'table' ? (code ?? null) : null, // only fetch when table tab is active
    );

    // Persist available report types for ReportPage
    useEffect(() => {
        if (data?.market?.available_reports) {
            setAvailableReports(data.market.available_reports);
        }
    }, [data, setAvailableReports]);

    if (isLoading || !data) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Spinner />
                    <span className="text-muted text-xs tracking-[0.14em] uppercase font-medium">
                        Loading dashboard…
                    </span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md">
                    <p className="text-destructive-fg text-sm font-medium">{(error as Error).message}</p>
                    <button
                        onClick={() => navigate('/cot/screener')}
                        className="text-xs text-white/60 hover:text-white transition-all duration-300 tracking-[0.1em] uppercase px-6 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.06]"
                    >
                        Back to Screener
                    </button>
                </div>
            </div>
        );
    }

    const { market, meta, currentPercentile, currentZScore } = data;
    const assetCfg = getAssetConfig(market.code);
    const specLabel = getGroupLabel(assetCfg.primaryReport, data.specGroupKey);

    // ─── Dashboard blocks definition ──────────────────────────

    const blocks: { key: string; title: string; subtitle: string; className: string; render: () => React.ReactNode }[] = [
        {
            key: 'net-long',
            title: 'Net Long Analysis',
            subtitle: 'Spec longs · percentile zones · Z-score',
            className: 'lg:col-span-6 h-[400px] lg:h-[500px]',
            render: () => <NetAnalysisChart data={data} side="long" />,
        },
        {
            key: 'net-short',
            title: 'Net Short Analysis',
            subtitle: 'Spec shorts · percentile zones · Z-score',
            className: 'lg:col-span-6 h-[400px] lg:h-[500px]',
            render: () => <NetAnalysisChart data={data} side="short" />,
        },
        {
            key: 'net-flow',
            title: 'Net Position Flow',
            subtitle: 'Long - Short bidirectional histogram',
            className: 'lg:col-span-6 h-[350px] lg:h-[400px]',
            render: () => <NetPositionHistogram data={data} />,
        },
        {
            key: 'sentiment',
            title: 'Sentiment Divergence',
            subtitle: 'Spec vs Comm percentile',
            className: 'lg:col-span-6 h-[350px] lg:h-[400px]',
            render: () => <SentimentDivergenceChart data={data} />,
        },
        {
            key: 'oi-pulse',
            title: 'Open Interest Pulse',
            subtitle: 'OI signal matrix',
            className: 'lg:col-span-5 h-[350px] lg:h-[280px]',
            render: () => <OIAnalysisChart data={data} />,
        },
        {
            key: 'flip',
            title: 'FLIP Detection',
            subtitle: `${data.flips.length} flips detected`,
            className: 'lg:col-span-4 h-[350px] lg:h-[280px]',
            render: () => <FlipChart data={data} />,
        },
        {
            key: 'concentration',
            title: 'Concentration Ratio',
            subtitle: 'Top-4 / Top-8 trader share',
            className: 'lg:col-span-3 h-[350px] lg:h-[280px]',
            render: () => <ConcentrationGauge data={data} />,
        },
    ];

    const activeFullscreenBlock = blocks.find((b) => b.key === fullscreenBlock);

    // Determine if the charts tabs should use raw dashboard data
    // BubbleChartView needs MarketData (raw) which includes weeks, groups, prices, market
    // The dashboard `data` has a compatible shape since it contains market, groups, weeks, prices
    const chartCompatData = data as any; // DashboardData has all fields BubbleChartView needs

    return (
        <>
            {/* Header */}
            <header className="flex-shrink-0 border-b border-white/[0.04] bg-[#0a0a0a]">
                {/* Top bar */}
                <div className="h-12 flex items-center px-2 sm:px-3 md:px-5 gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto">
                    {/* EQ Logo */}
                    <Link to="/" className="flex items-center gap-2 flex-shrink-0 select-none group mr-2">
                        <div
                            className="w-6 h-6 rounded-md flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            <span className="text-[10px] font-bold tracking-tight text-white/80 group-hover:text-white transition-colors duration-200">
                                EQ
                            </span>
                        </div>
                    </Link>

                    <div className="w-px h-4 bg-white/[0.06] flex-shrink-0" />

                    <Link
                        to="/cot/screener"
                        className="px-3 py-1 text-[11px] font-medium tracking-[0.1em] uppercase text-white/30 hover:text-white/60 transition-all duration-300 rounded-full flex-shrink-0"
                    >
                        ← Screener
                    </Link>

                    <div className="w-px h-4 bg-white/[0.06] flex-shrink-0" />

                    {/* Ticker + Name */}
                    <h1 className="text-[13px] sm:text-[14px] font-semibold tracking-wide text-white/90 truncate min-w-0 flex-shrink-0">
                        {market.exchange_code || market.code}
                        <span className="text-white/30 font-normal ml-2 hidden sm:inline">—</span>
                        <span className="text-white/50 font-normal ml-2 hidden sm:inline">{market.name}</span>
                    </h1>

                    <div className="flex-1" />

                    {/* Report Type & Subtype (Only relevant for Table view) */}
                    {activeTab === 'table' && (
                        <>
                            <div className="flex items-center gap-0.5 flex-shrink-0 bg-white/[0.03] border border-white/[0.04] rounded-full p-0.5 mr-2">
                                {REPORT_TYPES.map((rt) => {
                                    const available = availableReports.length === 0 || availableReports.includes(rt.key as ReportType);
                                    return (
                                        <button
                                            key={rt.key}
                                            onClick={() => available && setReportType(rt.key as ReportType)}
                                            disabled={!available}
                                            className={`px-2.5 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase transition-all duration-300 rounded-full ${
                                                !available
                                                    ? 'text-white/10 cursor-not-allowed'
                                                    : reportType === rt.key
                                                        ? 'text-white/90 bg-white/[0.08]'
                                                        : 'text-white/30 hover:text-white/50'
                                            }`}
                                            title={!available ? `${rt.label} not available for this market` : undefined}
                                        >
                                            {rt.shortLabel}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0 bg-white/[0.03] border border-white/[0.04] rounded-full p-0.5 mr-3">
                                {SUBTYPES.map((st) => (
                                    <button
                                        key={st.key}
                                        onClick={() => setSubtype(st.key as Subtype)}
                                        className={`px-2.5 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase transition-all duration-300 rounded-full ${subtype === st.key ? 'text-white/90 bg-white/[0.08]' : 'text-white/30 hover:text-white/50'}`}
                                    >
                                        {st.shortLabel}
                                    </button>
                                ))}
                            </div>
                            <div className="w-px h-4 bg-white/[0.06] flex-shrink-0 mr-3" />
                        </>
                    )}

                    {/* Sub-tabs */}
                    <nav className="flex items-center gap-0.5 flex-shrink-0 bg-white/[0.03] border border-white/[0.05] rounded-full p-0.5">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-3 py-1 text-[10px] font-semibold tracking-[0.06em] uppercase transition-all duration-200 rounded-full ${
                                    activeTab === tab.key
                                        ? 'text-black bg-white'
                                        : 'text-white/30 hover:text-white/60'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {/* Docs button */}
                    <button
                        onClick={() => setDocsOpen(!docsOpen)}
                        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-300"
                        title="Documentation"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            <path d="M9 7h6" /><path d="M9 11h6" /><path d="M9 15h4" />
                        </svg>
                    </button>
                </div>

                {/* Snapshot bar — only on dashboard tab */}
                {activeTab === 'dashboard' && (
                    <div className="min-h-[40px] flex flex-wrap items-center px-2 sm:px-3 md:px-5 gap-1.5 sm:gap-2 md:gap-4 py-1.5 border-t border-white/[0.03]">
                        <span className="text-[10px] text-white/30 tracking-[0.08em] uppercase">
                            Data as of {meta.data_as_of}
                            {meta.published_at && ` · Published ${meta.published_at}`}
                        </span>

                        <div className="w-px h-3 bg-white/[0.06]" />

                        <span className="text-[11px] text-white/60 font-mono">
                            {currentPercentile}th Percentile
                        </span>
                        <span className="text-[11px] text-white/40">|</span>
                        <span className="text-[11px] text-white/60 font-mono">
                            Z: {currentZScore > 0 ? '+' : ''}{currentZScore.toFixed(2)}
                        </span>

                        <PercentileBadge value={currentPercentile} />

                        <span className="text-[10px] text-white/25">
                            {specLabel} · {assetCfg.primaryReport.toUpperCase()}
                        </span>

                        <div className="flex-1" />

                        {/* Group Selector */}
                        <GroupSelector data={data} />

                        <div className="w-px h-3 bg-white/[0.06]" />

                        <RangeSelector />
                    </div>
                )}
            </header>

            {/* Documentation modal */}
            <Suspense fallback={null}>
                {docsOpen && <DocumentationModal isOpen={docsOpen} onClose={() => setDocsOpen(false)} />}
            </Suspense>

            {/* Fullscreen modal */}
            <FullscreenModal
                isOpen={!!activeFullscreenBlock}
                onClose={() => setFullscreenBlock(null)}
                title={activeFullscreenBlock?.title}
                subtitle={activeFullscreenBlock?.subtitle}
            >
                {activeFullscreenBlock?.render()}
            </FullscreenModal>

            {/* Body — content based on active tab */}
            {activeTab === 'dashboard' && (
                <main className="flex-1 overflow-auto px-3 md:px-5 py-3 md:py-4">
                    <ErrorBoundary>
                        {/* Key Metrics Summary */}
                        <KeyMetrics data={data} />

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            {blocks.map((block) => (
                                <DashboardBlock
                                    key={block.key}
                                    title={block.title}
                                    subtitle={block.subtitle}
                                    className={block.className}
                                    onExpand={() => setFullscreenBlock(block.key)}
                                >
                                    {block.render()}
                                </DashboardBlock>
                            ))}
                        </div>
                    </ErrorBoundary>
                </main>
            )}

            {activeTab === 'table' && (
                <main className="flex-1 overflow-hidden relative">
                    <ErrorBoundary>
                        {tableLoading ? (
                            <div className="flex items-center justify-center h-full"><Spinner /></div>
                        ) : marketData ? (
                            <CotReportTable data={marketData} fitMode={fitMode} />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-white/30 text-sm">No data available for this market / report combination.</p>
                            </div>
                        )}
                        {marketData && (
                            <button
                                onClick={toggleFitMode}
                                className={`fixed bottom-5 right-5 z-40 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${fitMode ? 'bg-white text-black' : 'bg-[#111111] text-white/40 border border-white/[0.06] hover:text-white/70 hover:bg-[#1a1a1a]'}`}
                                title={fitMode ? 'Normal size' : 'Fit to screen'}
                            >
                                {fitMode ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 4 20 10 20" /><polyline points="20 10 20 4 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                                )}
                            </button>
                        )}
                    </ErrorBoundary>
                </main>
            )}

            {(activeTab === 'bubbles' || activeTab === 'net' || activeTab === 'indicators') && (
                <main className="flex-1 overflow-hidden relative">
                    <ErrorBoundary>
                        <BubbleChartView data={chartCompatData} viewMode={activeTab} />
                    </ErrorBoundary>
                </main>
            )}
        </>
    );
}

// ─── Reusable block wrapper ──────────────────────────────────

interface DashboardBlockProps {
    title: string;
    subtitle?: string;
    className?: string;
    onExpand?: () => void;
    children: React.ReactNode;
}

function DashboardBlock({ title, subtitle, className = '', onExpand, children }: DashboardBlockProps) {
    const blockRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const handleScreenshot = async () => {
        if (!blockRef.current) return;
        try {
            const blob = await domToBlob(blockRef.current, {
                scale: 2,
                style: {
                    backgroundColor: '#0a0a0a',
                }
            });
            if (blob) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to capture screenshot', err);
        }
    };

    return (
        <div ref={blockRef} className={`group bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${className}`}>
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between flex-shrink-0 bg-white/[0.01]">
                <div>
                    <h3 className="text-[13px] font-semibold text-white/80 tracking-wide">{title}</h3>
                    {subtitle && (
                        <p className="text-[10px] text-white/25 mt-0.5">{subtitle}</p>
                    )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleScreenshot}
                        className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-300 ${copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-white/15 hover:text-white/50 hover:bg-white/[0.06]'}`}
                        title="Copy screenshot to clipboard"
                    >
                        {copied ? <CheckIcon /> : <CameraIcon />}
                    </button>
                    {onExpand && (
                        <button
                            onClick={onExpand}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-white/15 hover:text-white/50 hover:bg-white/[0.06] transition-all duration-300"
                            title="Fullscreen"
                        >
                            <ExpandIcon />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
}
