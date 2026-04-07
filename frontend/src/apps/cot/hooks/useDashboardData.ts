/**
 * React Query hook for the dashboard endpoint.
 * Returns raw DashboardResponse + fully-computed DashboardData.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchDashboard } from '@/lib/api';
import { useCotStore } from '../store/useCotStore';
import { getAssetConfig } from '../utils/assetConfig';
import {
    extractSeries,
    computeSeriesMetrics,
    detectFlips,
    calcOISignals,
    calcVelocity,
    calcSentimentDivergence,
    calcMarketPower,
    calcTripleLookback,
    calcSpreadPercentile,
    calcLongShortBias,
} from '../utils/calculations';
import type { DashboardResponse, DashboardData, DisplayRange } from '../types';
import { DISPLAY_RANGES } from '../types';

/** Fetch raw dashboard data. */
export function useDashboardQuery(code: string | null) {
    return useQuery({
        queryKey: ['dashboard', code],
        queryFn: () => {
            if (!code) throw new Error('No market code');
            const cfg = getAssetConfig(code);
            return fetchDashboard(code, cfg.primaryReport, 'fo');
        },
        enabled: !!code,
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
    });
}

/** Slice weeks to the display range (weeks are newest-first). */
function sliceToRange(totalWeeks: number, range: DisplayRange): number {
    const found = DISPLAY_RANGES.find((r) => r.key === range);
    return found ? Math.min(found.weeks, totalWeeks) : totalWeeks;
}

/**
 * Full dashboard hook: fetches data and computes all metrics.
 * Returns loading/error state plus computed `DashboardData`.
 */
export function useDashboardData(code: string | null) {
    const displayRange = useCotStore((s) => s.displayRange);
    const dashboardGroupKey = useCotStore((s) => s.dashboardGroupKey);

    const { data: raw, isLoading, error } = useDashboardQuery(code);

    const dashboardData = useMemo<DashboardData | null>(() => {
        if (!raw) return null;
        return computeDashboard(raw, displayRange, dashboardGroupKey);
    }, [raw, displayRange, dashboardGroupKey]);

    return { data: dashboardData, raw, isLoading, error };
}

/**
 * Pure computation: raw response + range/lookback → DashboardData.
 * Deterministic and memoizable.
 *
 * @param overrideGroupKey — if provided, use this group key instead of assetConfig default
 */
export function computeDashboard(
    raw: DashboardResponse,
    displayRange: DisplayRange,
    overrideGroupKey?: string | null,
): DashboardData {
    const { market, groups, weeks: rawWeeks, prices: allPrices, concentration, meta } = raw;

    // Backend sends oldest→newest; calculations expect newest-first (index 0 = current).
    const allWeeks = [...rawWeeks].reverse();

    // Use frontend ASSET_CONFIG for accurate per-market group mapping
    // (backend uses flat mapping that doesn't distinguish Indices/Crypto comm groups)
    const cfg = getAssetConfig(market.code);
    const specGroupKey = overrideGroupKey || cfg.specGroup;
    // When user overrides group, comm is the opposite default (or null if same)
    const commGroupKey = overrideGroupKey
        ? (cfg.commGroup !== overrideGroupKey ? cfg.commGroup : null)
        : cfg.commGroup;

    // Slice to display range (newest-first, take first N)
    const displayCount = sliceToRange(allWeeks.length, displayRange);
    const weeks = allWeeks.slice(0, displayCount);

    // Lookback = full display range
    const lookbackWeeks = displayCount;

    // Extract series
    const specNetKey = `${specGroupKey}_net`;
    const specLongKey = `${specGroupKey}_long`;
    const specShortKey = `${specGroupKey}_short`;

    const specNetSeries = extractSeries(allWeeks, specNetKey).filter((v): v is number => v != null);
    const commNetSeries = commGroupKey
        ? extractSeries(allWeeks, `${commGroupKey}_net`).filter((v): v is number => v != null)
        : [];
    const specLongSeries = extractSeries(allWeeks, specLongKey).filter((v): v is number => v != null);
    const specShortSeries = extractSeries(allWeeks, specShortKey).filter((v): v is number => v != null);
    const oiSeries = allWeeks.map((w) => w.open_interest ?? 0);
    const dateSeries = weeks.map((w) => w.date);

    // Price series sliced to display range dates
    const priceSet = new Set(dateSeries);
    const priceSeries = allPrices.filter((p) => priceSet.has(p.date));

    // Current metrics
    const netMetrics = computeSeriesMetrics(extractSeries(allWeeks, specNetKey), lookbackWeeks);

    // Flips (from full history for display range)
    const flips = detectFlips(weeks, allPrices, specGroupKey);

    // OI Signals
    const oiSignals = calcOISignals(weeks, allPrices);

    // Velocity
    const velocity = calcVelocity(weeks, specGroupKey);

    // Sentiment Divergence
    const sentimentDivergence = calcSentimentDivergence(
        allWeeks, specGroupKey, commGroupKey, lookbackWeeks,
    ).slice(0, displayCount);

    // Market Power
    const marketPower = calcMarketPower(weeks, specGroupKey);

    // Long/Short Bias (for flip detection visualization)
    const longShortBias = calcLongShortBias(weeks, specGroupKey);

    // Triple Lookback (always from full data)
    const tripleLookback = calcTripleLookback(extractSeries(allWeeks, specNetKey));

    // Spread Percentile
    const spreadPercentile = calcSpreadPercentile(
        allWeeks, specGroupKey, commGroupKey, lookbackWeeks,
    );

    // Reverse chart-facing arrays to oldest-first so Recharts renders
    // left (oldest) → right (newest). Calculations above used newest-first.
    const weeksChart = [...weeks].reverse();
    const velocityChart = [...velocity].reverse();
    const sentimentDivergenceChart = [...sentimentDivergence].reverse();
    const marketPowerChart = [...marketPower].reverse();
    const longShortBiasChart = [...longShortBias].reverse();

    return {
        market,
        groups,
        specGroupKey,
        commGroupKey,
        weeks: weeksChart,
        prices: allPrices,
        concentration,
        meta,

        specNetSeries,
        commNetSeries,
        specLongSeries,
        specShortSeries,
        oiSeries,
        dateSeries,
        priceSeries,

        currentPercentile: netMetrics?.percentile ?? 50,
        currentZScore: netMetrics?.zScore ?? 0,
        currentCotIndex: netMetrics?.cotIndex ?? 50,
        weeklyChange: netMetrics?.weeklyChange ?? 0,

        flips,
        oiSignals,
        velocity: velocityChart,
        sentimentDivergence: sentimentDivergenceChart,
        marketPower: marketPowerChart,
        tripleLookback,
        spreadPercentile,
        longShortBias: longShortBiasChart,
    };
}

