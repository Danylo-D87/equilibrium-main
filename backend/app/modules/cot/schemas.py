"""
COT module — Pydantic response schemas.
==========================================
Typed API response models for automatic validation,
OpenAPI documentation, and contract enforcement.
"""

from __future__ import annotations

import math
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


def _sanitize_nan(value: Any) -> Any:
    """Convert NaN/Inf floats to None for JSON serialization."""
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


# ------------------------------------------------------------------
# Shared / reusable models
# ------------------------------------------------------------------

class MarketMeta(BaseModel):
    """Standardized market metadata."""

    model_config = ConfigDict(extra="forbid")

    code: str
    name: str
    exchange: str
    category: str
    category_display: str
    report_type: str
    report_type_display: str
    subtype: str
    subtype_display: str


class GroupDef(BaseModel):
    """Trader group definition."""

    key: str
    name: str
    short: str
    role: str
    has_spread: bool


class PriceBar(BaseModel):
    """Single daily OHLCV bar."""

    date: str
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: int | None = None

    @field_validator("open", "high", "low", "close", mode="before")
    @classmethod
    def sanitize_floats(cls, v: Any) -> float | None:
        return _sanitize_nan(v)


# ------------------------------------------------------------------
# Market detail
# ------------------------------------------------------------------

class WeekData(BaseModel):
    """
    Single week's computed data.

    Uses ``extra="allow"`` because group columns (g1_long, g2_net,
    cot_index_g1_3m, crowded_g1, etc.) are dynamic per report type.
    """

    model_config = ConfigDict(extra="allow")

    date: str | None = None
    open_interest: float | None = None
    oi_change: float | None = None
    oi_pct: float | None = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_all_floats(cls, data: dict) -> dict:
        """Sanitize all float values in the week data."""
        if isinstance(data, dict):
            return {k: _sanitize_nan(v) for k, v in data.items()}
        return data


class StatsBlock(BaseModel):
    """Aggregate statistics (max, min, max_5y, min_5y, avg_13w)."""

    model_config = ConfigDict(extra="allow")


class MarketStats(BaseModel):
    """Full statistics object with named extremes."""

    model_config = ConfigDict(extra="allow")

    max: StatsBlock | dict | None = None
    min: StatsBlock | dict | None = None
    max_5y: StatsBlock | dict | None = None
    min_5y: StatsBlock | dict | None = None
    avg_13w: StatsBlock | dict | None = None


class MarketDetailResponse(BaseModel):
    """Full detail response for a single market."""

    market: MarketMeta
    groups: list[GroupDef]
    weeks: list[WeekData]
    stats: MarketStats
    prices: list[PriceBar] | None = None


# ------------------------------------------------------------------
# Screener
# ------------------------------------------------------------------

class SignalItem(BaseModel):
    """A single trading signal."""

    group: str
    signal: str


class ScreenerRow(BaseModel):
    """
    Single row of screener output.

    Uses ``extra="allow"`` because group-specific columns are dynamic.
    """

    model_config = ConfigDict(extra="allow")

    code: str
    name: str
    exchange_code: str
    category: str
    category_display: str
    date: str | None = None
    open_interest: float | None = None
    oi_change: float | None = None
    signals: list[SignalItem] = []

    @model_validator(mode="before")
    @classmethod
    def sanitize_all_floats(cls, data: dict) -> dict:
        """Sanitize all float values in the screener row."""
        if isinstance(data, dict):
            return {k: _sanitize_nan(v) for k, v in data.items()}
        return data


# ------------------------------------------------------------------
# Status
# ------------------------------------------------------------------

class VariantStats(BaseModel):
    """Stats for a single report_type/subtype variant."""

    total_records: int = 0
    total_markets: int = 0
    total_weeks: int = 0
    first_date: str | None = None
    last_date: str | None = None


class DataStatus(BaseModel):
    """Data status across all variants."""

    overall: VariantStats
    variants: dict[str, VariantStats]


class UpdateState(BaseModel):
    """Pipeline update tracker state."""

    model_config = ConfigDict(extra="allow")

    running: bool = False
    last_run: str | None = None
    last_status: str | None = None
    last_error: str | None = None
    last_duration_sec: float | None = None


class SchedulerStatus(BaseModel):
    """Scheduler + update status."""

    model_config = ConfigDict(extra="allow")

    scheduler_running: bool = False
    jobs: list[dict] = []
    update: UpdateState | None = None


class StatusResponse(BaseModel):
    """Full /status endpoint response."""

    data: DataStatus
    scheduler: SchedulerStatus
    price_update: UpdateState | None = None


# ------------------------------------------------------------------
# Dashboard
# ------------------------------------------------------------------

class DashboardWeekSchema(BaseModel):
    """Single week of raw COT data for dashboard computation."""

    model_config = ConfigDict(extra="allow")

    date: str
    open_interest: float | None = None
    oi_change: float | None = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_all_floats(cls, data: dict) -> dict:
        """Sanitize all float values in the week data."""
        if isinstance(data, dict):
            return {k: _sanitize_nan(v) for k, v in data.items()}
        return data


class DashboardMarketInfo(BaseModel):
    """Market metadata for dashboard header."""

    code: str
    name: str
    exchange_code: str
    sector: str
    primary_report: str
    spec_group: str
    comm_group: str | None = None
    available_reports: list[str]


class DashboardPricePoint(BaseModel):
    """Single price data point."""

    date: str
    close: float | None = None

    @field_validator("close", mode="before")
    @classmethod
    def sanitize_close(cls, v: Any) -> float | None:
        return _sanitize_nan(v)


class ConcentrationData(BaseModel):
    """Concentration ratio data (Top 4/8 traders)."""

    top4_long_pct: float | None = None
    top4_short_pct: float | None = None
    top8_long_pct: float | None = None
    top8_short_pct: float | None = None

    @field_validator("top4_long_pct", "top4_short_pct", "top8_long_pct", "top8_short_pct", mode="before")
    @classmethod
    def sanitize_pcts(cls, v: Any) -> float | None:
        return _sanitize_nan(v)


class DashboardMeta(BaseModel):
    """Dashboard metadata."""

    data_as_of: str
    published_at: str | None = None
    latest_week_index: int


class DashboardResponse(BaseModel):
    """Full response for GET /cot/dashboard/{code}."""

    market: DashboardMarketInfo
    groups: list[GroupDef]
    weeks: list[DashboardWeekSchema]
    prices: list[DashboardPricePoint]
    concentration: ConcentrationData | None = None
    meta: DashboardMeta


# ------------------------------------------------------------------
# Paginated response wrapper
# ------------------------------------------------------------------

class PaginatedResponse(BaseModel):
    """Generic paginated list response."""

    items: list
    total: int
    limit: int
    offset: int
