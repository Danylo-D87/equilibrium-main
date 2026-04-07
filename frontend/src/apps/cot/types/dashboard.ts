/**
 * Dashboard-specific types for the COT asset detail view.
 */

import type { ReportType } from './signals';

// ─── Display / Lookback ranges ───────────────────────────────

export type DisplayRange = '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y';
export type LookbackDays = 30 | 90 | 180 | 365;

export const DISPLAY_RANGES: readonly { key: DisplayRange; label: string; weeks: number }[] = [
    { key: '1M', label: '1M', weeks: 4 },
    { key: '3M', label: '3M', weeks: 13 },
    { key: '6M', label: '6M', weeks: 26 },
    { key: '1Y', label: '1Y', weeks: 52 },
    { key: '2Y', label: '2Y', weeks: 104 },
    { key: '3Y', label: '3Y', weeks: 156 },
    { key: '5Y', label: '5Y', weeks: 260 },
] as const;

export const LOOKBACK_OPTIONS: readonly { key: LookbackDays; label: string; weeks: number }[] = [
    { key: 30, label: '30D', weeks: 4 },
    { key: 90, label: '90D', weeks: 13 },
    { key: 180, label: '180D', weeks: 26 },
    { key: 365, label: '365D', weeks: 52 },
] as const;

// ─── Raw week data from backend (for dashboard) ─────────────

export interface DashboardWeek {
    date: string;
    open_interest: number;
    oi_change: number;
    /** Dynamic group data: g3_long, g3_short, g3_net, g3_change_long, etc. */
    [key: string]: number | string | null | undefined;
}

export interface DashboardPricePoint {
    date: string;
    close: number;
}

export interface ConcentrationData {
    top4_long_pct: number | null;
    top4_short_pct: number | null;
    top8_long_pct: number | null;
    top8_short_pct: number | null;
}

export interface DashboardMeta {
    data_as_of: string;
    published_at: string | null;
    latest_week_index: number;
}

export interface DashboardMarketInfo {
    code: string;
    name: string;
    exchange_code: string;
    sector: string;
    primary_report: ReportType;
    spec_group: string;
    comm_group: string | null;
    available_reports: ReportType[];
}

/** Raw response from GET /api/v1/cot/dashboard/{code} */
export interface DashboardResponse {
    market: DashboardMarketInfo;
    groups: { key: string; name: string; short: string; role: string; has_spread: boolean }[];
    weeks: DashboardWeek[];
    prices: DashboardPricePoint[];
    concentration: ConcentrationData | null;
    meta: DashboardMeta;
}

// ─── Computed / enriched types (frontend calculations) ───────

export interface PercentileResult {
    value: number;
    percentile: number;
    zScore: number;
    cotIndex: number;
}

export interface FlipEvent {
    date: string;
    type: 'LONG' | 'SHORT';
    magnitude: number;
    price: number | null;
    netBefore: number;
    netAfter: number;
}

export type OISignalType = 'strong_demand' | 'long_liquidation' | 'short_covering' | 'new_supply';

export interface OISignal {
    date: string;
    signal: OISignalType;
    priceChange: number;
    oiChange: number;
}

export interface VelocityPoint {
    date: string;
    velocity: number;
    netPosition: number;
    /** true when velocity direction opposes net position direction */
    warning: boolean;
}

export interface SentimentDivergencePoint {
    date: string;
    specPercentile: number;
    commPercentile: number;
    /** true when spec >= 90 && comm <= 10, or vice versa */
    divergent: boolean;
}

export interface TripleLookbackRow {
    label: string;
    lookbackWeeks: number;
    netPosition: number;
    percentile: number;
    zScore: number;
}

export interface MarketPowerPoint {
    date: string;
    longPower: number;  // spec longs / OI * 100
    shortPower: number; // spec shorts / OI * 100
}

export interface LongShortBiasPoint {
    date: string;
    longPct: number;   // longs / (longs + shorts) * 100
    shortPct: number;  // 100 - longPct
}

/** Full dashboard computed data, passed to Dashboard UI components. */
export interface DashboardData {
    market: DashboardMarketInfo;
    /** Available participant groups from the backend */
    groups: { key: string; name: string; short: string; role: string; has_spread: boolean }[];
    /** Spec group metrics */
    specGroupKey: string;
    commGroupKey: string | null;
    /** Raw weeks (newest first) */
    weeks: DashboardWeek[];
    prices: DashboardPricePoint[];
    /** Concentration if available */
    concentration: ConcentrationData | null;
    meta: DashboardMeta;

    // ─── Computed metrics (for current lookback) ───
    specNetSeries: number[];           // net position per week
    commNetSeries: number[];           // comm net per week (if commGroup exists)
    specLongSeries: number[];          // long positions
    specShortSeries: number[];         // short positions
    oiSeries: number[];                // open interest
    dateSeries: string[];              // dates aligned with above
    priceSeries: { date: string; close: number }[];

    currentPercentile: number;         // of net position
    currentZScore: number;
    currentCotIndex: number;
    weeklyChange: number;

    flips: FlipEvent[];
    oiSignals: OISignal[];
    velocity: VelocityPoint[];
    sentimentDivergence: SentimentDivergencePoint[];
    marketPower: MarketPowerPoint[];
    tripleLookback: TripleLookbackRow[];
    spreadPercentile: number | null;
    longShortBias: LongShortBiasPoint[];
}
