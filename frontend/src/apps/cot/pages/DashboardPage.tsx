/**
 * /cot/dashboard/:code — Asset dashboard page.
 * Renders header snapshot + analytics blocks.
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useCotStore } from '../store/useCotStore';
import { getAssetConfig, getGroupLabel } from '../utils/assetConfig';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import NetAnalysisChart from '../components/dashboard/NetAnalysisChart';
import DivergenceChart from '../components/dashboard/DivergenceChart';
import OIAnalysisChart from '../components/dashboard/OIAnalysisChart';
import DistributionHistogram from '../components/dashboard/DistributionHistogram';
import FlipChart from '../components/dashboard/FlipChart';
import MarketPowerChart from '../components/dashboard/MarketPowerChart';
import VelocityChart from '../components/dashboard/VelocityChart';
import SentimentDivergenceChart from '../components/dashboard/SentimentDivergenceChart';
import RangeSelector from '../components/dashboard/RangeSelector';
import ConcentrationGauge from '../components/dashboard/ConcentrationGauge';
import TripleLookbackHeatmap from '../components/dashboard/TripleLookbackHeatmap';

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

// ─── Main component ──────────────────────────────────────────

export default function DashboardPage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const setAvailableReports = useCotStore((s) => s.setAvailableReports);
    const { data, isLoading, error } = useDashboardData(code ?? null);

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
    const cfg = getAssetConfig(market.code);
    const specLabel = getGroupLabel(cfg.primaryReport, cfg.specGroup);

    return (
        <>
            {/* Header */}
            <header className="flex-shrink-0 border-b border-white/[0.04] bg-[#0a0a0a]">
                {/* Top bar */}
                <div className="h-12 flex items-center px-2 sm:px-3 md:px-5 gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto">
                    <Link to="/" className="flex items-center gap-2 flex-shrink-0 select-none group mr-3">
                        <span className="font-sans text-[14px] font-medium tracking-[0.12em] text-white/50 uppercase group-hover:text-white/80 transition-colors duration-300">
                            Equilibrium
                        </span>
                    </Link>

                    <div className="w-px h-4 bg-white/[0.06] flex-shrink-0" />

                    <Link
                        to="/cot/screener"
                        className="px-3 py-1 text-[11px] font-medium tracking-[0.1em] uppercase text-white/30 hover:text-white/60 transition-all duration-300 rounded-full"
                    >
                        ← Screener
                    </Link>

                    <div className="w-px h-4 bg-white/[0.06] flex-shrink-0" />

                    {/* Ticker + Name */}
                    <h1 className="text-[13px] sm:text-[14px] font-semibold tracking-wide text-white/90 truncate min-w-0">
                        {market.exchange_code || market.code}
                        <span className="text-white/30 font-normal ml-2 hidden sm:inline">—</span>
                        <span className="text-white/50 font-normal ml-2 hidden sm:inline">{market.name}</span>
                    </h1>

                    <div className="flex-1" />

                    <Link
                        to={`/cot/report/${market.code}`}
                        className="px-3 py-1 text-[11px] font-medium tracking-[0.1em] uppercase text-white/30 hover:text-white/60 transition-all duration-300 rounded-full hover:bg-white/[0.06]"
                    >
                        View Table →
                    </Link>
                </div>

                {/* Snapshot bar */}
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
                        {specLabel} · {cfg.primaryReport.toUpperCase()}
                    </span>

                    <div className="flex-1" />

                    <RangeSelector />
                </div>
            </header>

            {/* Body — Dashboard grid */}
            <main className="flex-1 overflow-auto px-3 md:px-5 py-3 md:py-4">
                <ErrorBoundary>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                        {/* Row 1: Core Analysis (600px) */}
                        <DashboardBlock
                            title="Net Long Analysis"
                            subtitle="Spec longs · percentile zones · Z-score"
                            className="lg:col-span-6 h-[400px] lg:h-[600px]"
                        >
                            <NetAnalysisChart data={data} side="long" />
                        </DashboardBlock>

                        <DashboardBlock
                            title="Net Short Analysis"
                            subtitle="Spec shorts · percentile zones · Z-score"
                            className="lg:col-span-6 h-[400px] lg:h-[600px]"
                        >
                            <NetAnalysisChart data={data} side="short" />
                        </DashboardBlock>

                        {/* Row 2: Market Dynamics (450px) */}
                        <DashboardBlock
                            title="Price vs Positioning"
                            subtitle="Spec net vs Commercial net · Spread percentile"
                            className="lg:col-span-5 h-[350px] lg:h-[450px]"
                        >
                            <DivergenceChart data={data} />
                        </DashboardBlock>

                        <DashboardBlock
                            title="Open Interest Pulse"
                            subtitle="OI signal matrix"
                            className="lg:col-span-4 h-[350px] lg:h-[450px]"
                        >
                            <OIAnalysisChart data={data} />
                        </DashboardBlock>

                        <DashboardBlock
                            title="FLIP Detection"
                            subtitle={`${data.flips.length} flips detected`}
                            className="lg:col-span-3 h-[350px] lg:h-[450px]"
                        >
                            <FlipChart data={data} />
                        </DashboardBlock>

                        {/* Row 3: Signals & Power (450px) */}
                        <DashboardBlock
                            title="Market Power"
                            subtitle="Spec % of OI"
                            className="lg:col-span-3 h-[350px] lg:h-[450px]"
                        >
                            <MarketPowerChart data={data} />
                        </DashboardBlock>

                        <DashboardBlock
                            title="Position Velocity"
                            subtitle="Momentum acceleration"
                            className="lg:col-span-3 h-[350px] lg:h-[450px]"
                        >
                            <VelocityChart data={data} />
                        </DashboardBlock>

                        <DashboardBlock
                            title="Sentiment Divergence"
                            subtitle="Spec vs Comm percentile"
                            className="lg:col-span-3 h-[350px] lg:h-[450px]"
                        >
                            <SentimentDivergenceChart data={data} />
                        </DashboardBlock>

                        <DashboardBlock
                            title="Distribution"
                            subtitle="Net position histogram"
                            className="lg:col-span-3 h-[350px] lg:h-[450px]"
                        >
                            <DistributionHistogram data={data} />
                        </DashboardBlock>

                        {/* Row 4: Auxiliary (350px) */}
                        <DashboardBlock
                            title="Concentration Ratio"
                            subtitle="Top-4 / Top-8 trader share"
                            className="lg:col-span-6 h-[300px] lg:h-[350px]"
                        >
                            <ConcentrationGauge data={data} />
                        </DashboardBlock>

                        <DashboardBlock
                            title="Triple Lookback"
                            subtitle="1Y / 3Y / 5Y alignment"
                            className="lg:col-span-6 h-[300px] lg:h-[350px]"
                        >
                            <TripleLookbackHeatmap data={data} />
                        </DashboardBlock>

                    </div>
                </ErrorBoundary>
            </main>
        </>
    );
}

// ─── Reusable block wrapper ──────────────────────────────────

interface DashboardBlockProps {
    title: string;
    subtitle?: string;
    className?: string;
    children: React.ReactNode;
}

function DashboardBlock({ title, subtitle, className = '', children }: DashboardBlockProps) {
    return (
        <div className={`bg-[#0d0d0d] border border-white/[0.04] rounded-lg overflow-hidden flex flex-col ${className}`}>
            <div className="px-3 md:px-4 py-2 md:py-2.5 border-b border-white/[0.03] flex items-center justify-between flex-shrink-0">
                <div>
                    <h3 className="text-[12px] font-medium text-white/70 tracking-wide">{title}</h3>
                    {subtitle && (
                        <p className="text-[10px] text-white/25 mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
}
