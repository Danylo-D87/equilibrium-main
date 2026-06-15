"""
COT module — API service (business logic layer).
==================================================
Read-only service that computes API responses from SQLite data.
Delegates payload construction to CotPayloadBuilder.
"""

import logging

from app.modules.cot.config import cot_settings
from app.modules.cot.storage import CotStorage
from app.modules.cot.calculator import CotCalculator
from app.modules.cot.builder import CotPayloadBuilder
from app.modules.prices.service import PriceService
from app.utils.categories import build_market_meta

logger = logging.getLogger(__name__)

# Maps backend category → frontend sector label
_CATEGORY_TO_SECTOR: dict[str, str] = {
    "currencies": "Currencies",
    "crypto": "Crypto",
    "metals": "Metals",
    "energy": "Energy",
    "grains": "Grains",
    "softs": "Softs",
    "livestock": "Livestock",
    "indices": "Indices",
    "rates": "Rates",
}

# Primary report type heuristic: use disagg for commodities, legacy for financial
_COMMODITY_SECTORS = {"Metals", "Energy", "Grains", "Softs", "Livestock"}
_FINANCIAL_SECTORS = {"Currencies", "Crypto", "Indices", "Rates"}

# Spec/comm group mapping per report type
_SPEC_GROUP: dict[str, str] = {"legacy": "g1", "disagg": "g3", "tff": "g3"}
# NOTE: TFF has no single "commercial" equivalent — g1 (Dealers) is used as a
# rough proxy for the hedging counterpart. For per-market accuracy the frontend
# overrides this via assetConfig (e.g. Indices use g2 = Asset Managers as comm).
_COMM_GROUP: dict[str, str] = {"legacy": "g2", "disagg": "g1", "tff": "g1"}


class CotService:
    """Read-only service for COT API responses."""

    def __init__(
        self,
        store: CotStorage,
        calc: CotCalculator,
        price_service: PriceService | None = None,
    ):
        self.store = store
        self.calc = calc
        self.price_service = price_service or PriceService()
        self._builder = CotPayloadBuilder(store, calc)

    # ------------------------------------------------------------------
    # Markets list
    # ------------------------------------------------------------------

    def get_markets(self, report_type: str, subtype: str) -> list[dict]:
        markets = self.store.get_all_markets(report_type, subtype)
        categories = cot_settings.market_categories
        report_dn = cot_settings.report_display_names
        subtype_dn = cot_settings.subtype_display_names
        return [
            build_market_meta(
                m["code"], m["name"] or m["code"],
                m.get("exchange_code", ""), report_type, subtype,
                categories=categories,
                report_display_names=report_dn,
                subtype_display_names=subtype_dn,
            )
            for m in markets
        ]

    # ------------------------------------------------------------------
    # Single market detail
    # ------------------------------------------------------------------

    def get_market_detail(self, code: str, report_type: str, subtype: str) -> dict | None:
        raw_rows = self.store.get_market_data(code, report_type, subtype)
        if not raw_rows:
            return None

        first = raw_rows[0]
        name = first.get("market_and_exchange") or code
        exchange_code = first.get("exchange_code", "")

        # Prices — cache-first, downloads only if stale/missing
        prices = None
        if self.price_service and self.price_service.has_ticker(code):
            prices = self.price_service.get_prices(code)
            if not prices:
                prices = None

        return self._builder.build_market_detail(
            code, name, exchange_code, report_type, subtype, raw_rows, prices,
        )

    # ------------------------------------------------------------------
    # Screener
    # ------------------------------------------------------------------

    def get_screener(self, report_type: str, subtype: str) -> list[dict]:
        all_data = self.store.get_all_market_data_bulk(report_type, subtype)
        if not all_data:
            return []

        screener_rows: list[dict] = []
        for code, raw_rows in all_data.items():
            if not raw_rows:
                continue

            name = raw_rows[0].get("market_and_exchange") or code
            exchange_code = raw_rows[0].get("exchange_code", "")

            entry = self._builder.build_screener_entry(
                code, name, exchange_code, report_type, raw_rows,
            )
            if entry:
                screener_rows.append(entry)

        return screener_rows

    def get_screener_page(
        self, report_type: str, subtype: str, limit: int, offset: int,
    ) -> tuple[list[dict], int]:
        """SQL-paginated screener: only process markets for the requested page.

        Returns (rows, total_market_count).
        """
        total = self.store.get_market_count(report_type, subtype)
        if total == 0:
            return [], 0

        codes = self.store.get_market_codes_page(report_type, subtype, limit, offset)
        if not codes:
            return [], total

        bulk = self.store.get_bulk_for_codes(codes, report_type, subtype)
        rows: list[dict] = []
        for code in codes:
            raw_rows = bulk.get(code, [])
            if not raw_rows:
                continue
            name = raw_rows[0].get("market_and_exchange") or code
            exchange_code = raw_rows[0].get("exchange_code", "")
            entry = self._builder.build_screener_entry(
                code, name, exchange_code, report_type, raw_rows,
            )
            if entry:
                rows.append(entry)
        return rows, total

    # ------------------------------------------------------------------
    # Screener V2 (auto-detect primary report per market)
    # ------------------------------------------------------------------

    def get_screener_v2(self, subtype: str = "fo") -> list[dict]:
        """Build screener rows using auto-detected primary report per market.

        Iterates all report types, de-duplicates by market code
        keeping the best (primary) report type per sector classification.
        """
        # Collect all market codes across report types
        seen: dict[str, dict] = {}  # code → best screener row

        for rt in ("tff", "disagg", "legacy"):
            all_data = self.store.get_all_market_data_bulk(rt, subtype)
            if not all_data:
                continue

            for code, raw_rows in all_data.items():
                if not raw_rows or code in seen:
                    continue

                name = raw_rows[0].get("market_and_exchange") or code
                exchange_code = raw_rows[0].get("exchange_code", "")
                sector = self._classify_sector(name)
                available = self.store.get_available_reports(code)
                primary = self._primary_report(sector, available)

                # Only include if this report type IS the primary one
                if rt != primary:
                    continue

                entry = self._builder.build_screener_entry(
                    code, name, exchange_code, rt, raw_rows,
                )
                if entry:
                    entry["sector"] = sector
                    entry["primary_report"] = primary
                    seen[code] = entry

        return list(seen.values())

    # ------------------------------------------------------------------
    # Groups metadata
    # ------------------------------------------------------------------

    def get_groups(self, report_type: str) -> list[dict]:
        return cot_settings.report_groups.get(report_type, [])

    # ------------------------------------------------------------------
    # System status
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        overall = self.store.get_db_stats()
        variants = {}
        for rt in cot_settings.report_types:
            for st in cot_settings.subtypes:
                variants[f"{rt}_{st}"] = self.store.get_db_stats(rt, st)
        return {"overall": overall, "variants": variants}

    # ------------------------------------------------------------------
    # Dashboard (new 3-page flow)
    # ------------------------------------------------------------------

    def _classify_sector(self, market_name: str) -> str:
        """Classify a market into a sector using keyword matching."""
        name_upper = market_name.upper()
        for cat_key, cat_info in cot_settings.market_categories.items():
            for kw in cat_info["keywords"]:
                if kw in name_upper:
                    return _CATEGORY_TO_SECTOR.get(cat_key, "Other")
        return "Other"

    def _primary_report(self, sector: str, available: list[str]) -> str:
        """Pick the best report type for a market given available data."""
        if sector in _COMMODITY_SECTORS and "disagg" in available:
            return "disagg"
        if sector in _FINANCIAL_SECTORS and "tff" in available:
            return "tff"
        # fallback
        if "legacy" in available:
            return "legacy"
        return available[0] if available else "legacy"

    def get_dashboard(
        self,
        code: str,
        report_type: str | None = None,
        subtype: str = "fo",
    ) -> dict | None:
        """Build the dashboard payload for a single market.

        If *report_type* is None, auto-detect the primary report type.
        Returns a dict matching the DashboardResponse schema, or None if
        no data is found.
        """
        # 1. Determine available report types
        available_reports = self.store.get_available_reports(code)
        if not available_reports:
            return None

        # 2. Fetch the first available data to get name/exchange
        sample_rt = available_reports[0]
        sample_rows = self.store.get_market_data(code, sample_rt, subtype)
        if not sample_rows:
            # Try "co" if "fo" has no data
            subtype = "co"
            sample_rows = self.store.get_market_data(code, sample_rt, subtype)
            if not sample_rows:
                return None

        market_name = sample_rows[0].get("market_and_exchange") or code
        exchange_code = sample_rows[0].get("exchange_code", "")
        sector = self._classify_sector(market_name)

        # 3. Select report type
        primary = self._primary_report(sector, available_reports)
        rt = report_type if report_type and report_type in available_reports else primary

        # 4. Load all weekly rows for this report type / subtype
        raw_rows = self.store.get_market_data(code, rt, subtype)
        if not raw_rows:
            return None

        # 5. Build flat weeks list (oldest → newest for frontend)
        weeks: list[dict] = []
        for r in reversed(raw_rows):  # storage returns newest→oldest
            week: dict = {
                "date": r.get("report_date"),
                "open_interest": r.get("open_interest") or 0,
                "oi_change": r.get("oi_change") or 0,
            }
            # Add g1..g5 data
            for gi in range(1, 6):
                pfx = f"g{gi}"
                long_val = r.get(f"{pfx}_long")
                # Only add groups that have data
                if long_val is not None:
                    week[f"{pfx}_long"] = long_val or 0
                    week[f"{pfx}_short"] = r.get(f"{pfx}_short") or 0
                    week[f"{pfx}_spread"] = r.get(f"{pfx}_spread") or 0
                    week[f"{pfx}_net"] = (long_val or 0) - (r.get(f"{pfx}_short") or 0)
                    week[f"{pfx}_change_long"] = r.get(f"{pfx}_long_change") or 0
                    week[f"{pfx}_change_short"] = r.get(f"{pfx}_short_change") or 0
                    week[f"{pfx}_change"] = week[f"{pfx}_change_long"] - week[f"{pfx}_change_short"]
            weeks.append(week)

        # 6. Groups metadata
        groups = cot_settings.report_groups.get(rt, [])

        # 7. Prices
        prices: list[dict] = []
        if self.price_service and self.price_service.has_ticker(code):
            price_data = self.price_service.get_prices(code)
            if price_data:
                for p in price_data:
                    prices.append({"date": p["date"], "close": p["close"]})

        # 8. Concentration (from latest week's data)
        concentration = None
        latest_row = raw_rows[0]  # newest first
        c4l = latest_row.get("conc_top4_long")
        c4s = latest_row.get("conc_top4_short")
        c8l = latest_row.get("conc_top8_long")
        c8s = latest_row.get("conc_top8_short")
        if any(v is not None for v in (c4l, c4s, c8l, c8s)):
            concentration = {
                "top4_long_pct": c4l,
                "top4_short_pct": c4s,
                "top8_long_pct": c8l,
                "top8_short_pct": c8s,
            }

        # 9. Meta
        latest_date = raw_rows[0].get("report_date", "")
        spec_group = _SPEC_GROUP.get(rt, "g1")
        comm_group = _COMM_GROUP.get(rt, "g2")

        return {
            "market": {
                "code": code,
                "name": market_name,
                "exchange_code": exchange_code,
                "sector": sector,
                "primary_report": primary,
                "spec_group": spec_group,
                "comm_group": comm_group,
                "available_reports": available_reports,
            },
            "groups": groups,
            "weeks": weeks,
            "prices": prices,
            "concentration": concentration,
            "meta": {
                "data_as_of": latest_date,
                "published_at": None,
                "latest_week_index": len(weeks) - 1,
            },
        }
