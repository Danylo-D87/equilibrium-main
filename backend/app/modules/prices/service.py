"""
Prices module — Service layer.
================================
High-level price data service that maps CFTC codes to tickers
and delegates to the appropriate downloader.

Includes a **class-level in-memory cache** so that the daily
scheduled job can populate it once, and every subsequent consumer
(COT pipeline, API endpoints) reads near-instantly.
"""

import logging
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.modules.prices.config import price_settings
from app.modules.prices.yahoo import YahooDownloader

logger = logging.getLogger(__name__)


def _sanitize_price_bars(bars: list[dict]) -> list[dict]:
    """Replace NaN/Inf values with None for JSON serialization safety.

    Yahoo Finance occasionally returns NaN for missing data points.
    JSON does not support NaN/Inf, so we convert them to None.
    """
    if not bars:
        return bars

    sanitized = []
    for bar in bars:
        clean_bar = {}
        for key, value in bar.items():
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                clean_bar[key] = None
            else:
                clean_bar[key] = value
        sanitized.append(clean_bar)
    return sanitized

MAX_PRICE_DOWNLOAD_WORKERS = 4

# Cache entry: (bars, timestamp)
_CacheEntry = tuple[list[dict], float]

# 23 hours — ensures daily 00:00 refresh always wins
PRICE_CACHE_TTL = 23 * 3600


class PriceService:
    """Fetches price data for CFTC market codes via Yahoo Finance.

    A class-level cache (shared across all instances) stores downloaded
    bars so they survive across pipeline / API calls without repeated
    network round-trips.
    """

    # ------ shared cache (class-level → survives instance re-creation) ------
    _price_cache: dict[str, _CacheEntry] = {}
    _cache_lock = threading.Lock()

    def __init__(self) -> None:
        self._ticker_map = price_settings.ticker_map
        self._downloader = YahooDownloader()

    # ------------------------------------------------------------------
    # Ticker helpers
    # ------------------------------------------------------------------

    def has_ticker(self, cftc_code: str) -> bool:
        """Check if a market has a price ticker mapping."""
        return cftc_code in self._ticker_map

    # ------------------------------------------------------------------
    # Single-market download (low-level, always hits Yahoo)
    # ------------------------------------------------------------------

    def download_prices(self, cftc_code: str) -> list[dict]:
        """Download daily OHLCV for a CFTC market code (no cache)."""
        ticker_symbol = self._ticker_map.get(cftc_code)
        if not ticker_symbol:
            return []

        logger.info("%s → %s", cftc_code, ticker_symbol)
        bars = self._downloader.download(ticker_symbol)
        return _sanitize_price_bars(bars)

    # ------------------------------------------------------------------
    # Cache-aware single-market read
    # ------------------------------------------------------------------

    def get_prices(self, cftc_code: str) -> list[dict]:
        """Return cached bars if fresh, otherwise download and cache."""
        now = time.time()
        with self._cache_lock:
            if cftc_code in self._price_cache:
                bars, ts = self._price_cache[cftc_code]
                if now - ts < PRICE_CACHE_TTL:
                    return bars

        bars = self.download_prices(cftc_code)
        if bars:
            with self._cache_lock:
                self._price_cache[cftc_code] = (bars, time.time())
        return bars

    # ------------------------------------------------------------------
    # Bulk cache read (no network calls)
    # ------------------------------------------------------------------

    def get_all_cached(self, cftc_codes: list[str]) -> dict[str, list[dict]]:
        """Return all cached (non-expired) bars for the given codes."""
        now = time.time()
        result: dict[str, list[dict]] = {}
        with self._cache_lock:
            for code in cftc_codes:
                entry = self._price_cache.get(code)
                if entry is not None:
                    bars, ts = entry
                    if now - ts < PRICE_CACHE_TTL:
                        result[code] = bars
        return result

    # ------------------------------------------------------------------
    # Bulk download + cache update
    # ------------------------------------------------------------------

    def refresh_all(self, cftc_codes: list[str]) -> dict[str, list[dict]]:
        """Force-download all prices and update the cache.

        Used by the daily scheduled job.
        """
        result = self.download_all(cftc_codes)
        now = time.time()
        with self._cache_lock:
            for code, bars in result.items():
                self._price_cache[code] = (bars, now)
        logger.info("Price cache updated: %d entries", len(result))
        return result

    # ------------------------------------------------------------------
    # Bulk download (original logic, no cache writes)
    # ------------------------------------------------------------------

    def download_all(self, cftc_codes: list[str]) -> dict[str, list[dict]]:
        """Download prices for multiple markets. Returns {code: [bars...]}.

        Deduplicates by ticker symbol so the same instrument is only
        downloaded once even when several CFTC codes share a ticker.
        """
        eligible = [c for c in cftc_codes if self.has_ticker(c)]
        logger.info("Downloading prices for %d/%d markets...", len(eligible), len(cftc_codes))

        # Group codes by ticker to avoid downloading the same symbol twice
        ticker_to_codes: dict[str, list[str]] = {}
        for code in eligible:
            ticker = self._ticker_map[code]
            ticker_to_codes.setdefault(ticker, []).append(code)

        unique_tickers = list(ticker_to_codes.keys())
        logger.info("Unique tickers: %d (from %d codes)", len(unique_tickers), len(eligible))

        results: dict[str, list[dict]] = {}
        max_workers = min(MAX_PRICE_DOWNLOAD_WORKERS, len(unique_tickers)) if unique_tickers else 1

        def _download_one(ticker: str) -> tuple[str, list[dict]]:
            bars = self._downloader.download(ticker)
            return ticker, _sanitize_price_bars(bars)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(_download_one, t): t for t in unique_tickers}
            for i, future in enumerate(as_completed(futures), 1):
                ticker = futures[future]
                codes = ticker_to_codes[ticker]
                try:
                    _, bars = future.result()
                    if bars:
                        for code in codes:
                            results[code] = bars
                    logger.info("[%d/%d] %s → %s (%d bars)",
                               i, len(unique_tickers), codes[0], ticker, len(bars))
                except (OSError, ValueError, KeyError, RuntimeError) as e:
                    logger.warning("[%d/%d] %s → %s failed: %s",
                                  i, len(unique_tickers), codes[0], ticker, e)

        logger.info("Done: %d/%d markets got price data", len(results), len(eligible))
        return results
