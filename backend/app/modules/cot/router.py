"""
COT module — API routes.
==========================
All /api/v1/cot/ endpoints.
"""

import asyncio
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from app.modules.cot.dependencies import get_cot_service
from app.modules.cot.service import CotService
from app.modules.cot.scheduler import get_update_status, cot_update_manager
from app.modules.prices.scheduler import price_update_manager, get_price_update_status
from app.modules.cot.schemas import (
    MarketMeta, MarketDetailResponse, ScreenerRow,
    GroupDef, StatusResponse, PaginatedResponse,
    DashboardResponse,
)
from app.core.cache import TTLCache
from app.middleware.auth import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cot",
    tags=["COT"],
    dependencies=[Depends(require_permission("cot"))],
)

# ------------------------------------------------------------------
# Module-level caches
# ------------------------------------------------------------------

# COT data updates only on Friday, so cache until then
# Standard TTL: 6 hours for most data (survives restarts within day)
# Dashboard/Screener can be longer as they're computationally expensive
MARKET_CACHE_TTL = 3600 * 6      # 6 hours — individual market detail
SCREENER_CACHE_TTL = 3600 * 6    # 6 hours — screener table (expensive to compute)
MARKETS_LIST_CACHE_TTL = 3600 * 6 # 6 hours — markets list (rarely changes)
DASHBOARD_CACHE_TTL = 3600 * 6   # 6 hours — dashboard data

_market_cache = TTLCache(name="cot.market", default_ttl=MARKET_CACHE_TTL)
_screener_cache = TTLCache(name="cot.screener", default_ttl=SCREENER_CACHE_TTL)
_markets_list_cache = TTLCache(name="cot.markets_list", default_ttl=MARKETS_LIST_CACHE_TTL)
_dashboard_cache = TTLCache(name="cot.dashboard", default_ttl=DASHBOARD_CACHE_TTL)


def invalidate_cot_caches() -> None:
    """Called after a pipeline update to clear all COT caches."""
    _market_cache.invalidate()
    _screener_cache.invalidate()
    _markets_list_cache.invalidate()
    _dashboard_cache.invalidate()
    logger.info("All COT caches invalidated")


async def warmup_cot_caches() -> None:
    """Pre-populate COT caches on startup for faster first requests.

    Called from main.py lifespan to ensure caches are warm before
    serving traffic.
    """
    from app.core.database import get_connection
    from app.modules.cot.storage import CotStorage
    from app.modules.cot.calculator import CotCalculator
    from app.modules.prices.service import PriceService

    logger.info("Starting COT cache warmup...")

    # Create service instance directly (not via Depends)
    conn = get_connection()
    try:
        store = CotStorage(conn=conn)
        calc = CotCalculator()
        price_service = PriceService()
        service = CotService(store, calc, price_service)

        # Popular assets to pre-cache (most frequently accessed)
        popular_assets = [
            # Crypto
            "133741", "133LM4", "146LM1", "133LM5",
            # Currencies
            "099741", "096742", "092741", "090741", "089741",
            # Indices
            "13874U", "209747", "124608",
            # Metals
            "088691", "084691", "076651",
            # Energy
            "067651", "023651", "022651",
        ]

        # Warm screener-v2 cache first (most important)
        for subtype in ["fo", "co"]:
            try:
                cache_key = f"screener-v2:{subtype}"
                rows = await asyncio.to_thread(service.get_screener_v2, subtype)
                if rows:
                    _screener_cache.set(cache_key, rows)
                    logger.info("Warmed screener-v2:%s (%d rows)", subtype, len(rows))
            except Exception as e:
                logger.warning("Warmup failed for screener-v2:%s: %s", subtype, e)

        # Warm dashboard cache for popular assets
        warmed = 0
        for code in popular_assets:
            try:
                cache_key = f"dashboard:{code}:auto:fo"
                data = await asyncio.to_thread(service.get_dashboard, code, None, "fo")
                if data:
                    _dashboard_cache.set(cache_key, data)
                    warmed += 1
            except Exception as e:
                logger.warning("Warmup failed for dashboard %s: %s", code, e)

        logger.info("COT cache warmup complete: %d/%d dashboards", warmed, len(popular_assets))
    finally:
        conn.close()


# Register so scheduler can trigger cache invalidation without importing router
cot_update_manager.on_pipeline_complete(invalidate_cot_caches)
price_update_manager.on_complete(invalidate_cot_caches)


# ------------------------------------------------------------------
# Type aliases
# ------------------------------------------------------------------

ReportType = Literal["legacy", "disagg", "tff"]
SubType = Literal["fo", "co"]


# ==================================================================
# Endpoints
# ==================================================================


@router.get("/dashboard/{code}", response_model=DashboardResponse)
async def get_dashboard(
    code: str,
    report_type: ReportType | None = None,
    subtype: SubType = "fo",
    service: CotService = Depends(get_cot_service),
):
    """Dashboard data for a single market.

    Returns raw weekly data (oldest → newest) with g1-g5 columns
    for frontend computation of percentiles, COT Index, flips, etc.

    If *report_type* is omitted, auto-detects the primary report
    based on market sector.
    """
    cache_key = f"dashboard:{code}:{report_type or 'auto'}:{subtype}"
    cached = _dashboard_cache.get(cache_key)
    if cached is not None:
        return cached

    data = await asyncio.to_thread(service.get_dashboard, code, report_type, subtype)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Market '{code}' not found")

    _dashboard_cache.set(cache_key, data)
    return data

@router.get("/markets/{report_type}/{subtype}", response_model=list[MarketMeta])
async def list_markets(
    report_type: ReportType,
    subtype: SubType,
    service: CotService = Depends(get_cot_service),
):
    """List all markets for a given report type / subtype."""
    cache_key = f"markets:{report_type}:{subtype}"
    cached = _markets_list_cache.get(cache_key)
    if cached is not None:
        return cached

    markets = await asyncio.to_thread(service.get_markets, report_type, subtype)
    if not markets:
        raise HTTPException(status_code=404, detail="No markets found for this combination")

    _markets_list_cache.set(cache_key, markets)
    return markets


@router.get("/markets/{report_type}/{subtype}/{code}", response_model=MarketDetailResponse)
async def get_market(
    report_type: ReportType,
    subtype: SubType,
    code: str,
    service: CotService = Depends(get_cot_service),
):
    """Get full data for a single market."""
    cache_key = f"market:{code}:{report_type}:{subtype}"
    cached = _market_cache.get(cache_key)
    if cached is not None:
        return cached

    data = await asyncio.to_thread(service.get_market_detail, code, report_type, subtype)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Market '{code}' not found")

    _market_cache.set(cache_key, data)
    return data


@router.get("/screener/{report_type}/{subtype}", response_model=PaginatedResponse)
async def get_screener(
    report_type: ReportType,
    subtype: SubType,
    limit: int = 0,
    offset: int = 0,
    service: CotService = Depends(get_cot_service),
):
    """Get screener data for all markets with optional pagination.

    Args:
        limit: Max rows to return. 0 = all (backwards compatible).
        offset: Number of rows to skip.

    When limit > 0, uses SQL-level pagination (only processes the
    requested page of markets). When limit = 0, loads everything
    into cache and returns all rows.
    """
    # SQL-paginated path: only load the requested page of markets
    if limit > 0:
        rows, total = await asyncio.to_thread(
            service.get_screener_page, report_type, subtype, limit, offset,
        )
        if not rows and total == 0:
            raise HTTPException(status_code=404, detail="No screener data for this combination")
        return PaginatedResponse(items=rows, total=total, limit=limit, offset=offset)

    # Full-cache path (limit=0): load everything, cache it
    cache_key = f"screener:{report_type}:{subtype}"
    cached = _screener_cache.get(cache_key)
    if cached is not None:
        rows = cached
    else:
        rows = await asyncio.to_thread(service.get_screener, report_type, subtype)
        if not rows:
            raise HTTPException(status_code=404, detail="No screener data for this combination")
        _screener_cache.set(cache_key, rows)

    return PaginatedResponse(items=rows, total=len(rows), limit=0, offset=0)


@router.get("/screener-v2", response_model=PaginatedResponse)
async def get_screener_v2(
    subtype: SubType = "fo",
    service: CotService = Depends(get_cot_service),
):
    """Screener V2: auto-detects primary report type per market.

    Returns one row per market using the best report type for its sector
    (TFF for financials, Disagg for commodities, Legacy fallback).
    """
    cache_key = f"screener-v2:{subtype}"
    cached = _screener_cache.get(cache_key)
    if cached is not None:
        rows = cached
    else:
        rows = await asyncio.to_thread(service.get_screener_v2, subtype)
        if not rows:
            raise HTTPException(status_code=404, detail="No screener data found")
        _screener_cache.set(cache_key, rows)

    return PaginatedResponse(items=rows, total=len(rows), limit=0, offset=0)


@router.get("/groups/{report_type}", response_model=list[GroupDef])
async def get_groups(
    report_type: ReportType,
    service: CotService = Depends(get_cot_service),
):
    """Get group definitions (metadata) for a report type."""
    groups = await asyncio.to_thread(service.get_groups, report_type)
    if not groups:
        raise HTTPException(status_code=404, detail=f"No groups for report type '{report_type}'")
    return groups


# ------------------------------------------------------------------
# System / admin endpoints
# ------------------------------------------------------------------

@router.get("/status", response_model=StatusResponse)
async def get_status(service: CotService = Depends(get_cot_service)):
    """System status: DB stats, scheduler status, last update info."""
    return {
        "data": await asyncio.to_thread(service.get_status),
        "scheduler": get_update_status(),
        "price_update": get_price_update_status(),
    }


