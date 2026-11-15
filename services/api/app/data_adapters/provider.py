"""Public C -> B Python provider interface (routes/engine import only this module)."""

from __future__ import annotations

import json
from pathlib import Path

import httpx

from datetime import date, datetime, timezone

from app.config import Settings, get_settings
from app.data_adapters.cache import (
    load_cached_climate_bundle,
    load_cached_timeseries_bundle,
    save_runtime_cache_snapshot,
)
from app.data_adapters.catalog import get_crop_catalog
from app.data_adapters.exceptions import DataUnavailable, InvalidDataQuery
from app.data_adapters.nasa_power import (
    NASA_POWER_ALL_PARAMETERS,
    NASA_POWER_DOCS_URL,
    NASA_POWER_PARAMETERS,
    fetch_power_daily_raw,
)
from app.data_adapters.pipeline import (
    normalize_and_aggregate_power,
    normalize_and_aggregate_timeseries,
)
from app.schemas.models import (
    AnnualClimateSummary,
    ClimateBundle,
    ClimateQuery,
    ClimateTimeseriesBundle,
    ClimateTimeseriesQuery,
    ClimateTrendSummary,
    DataMode,
    MonthlyClimatePoint,
    SourceRecord,
)

__all__ = ["get_climate_features", "get_climate_timeseries", "get_crop_catalog"]


def _load_demo_fixture_climate(query: ClimateQuery, settings: Settings) -> ClimateBundle:
    """Explicit synthetic fixture loader for development/tests ONLY (never production fallback)."""
    if settings.is_production:
        raise InvalidDataQuery(
            "demo_fixture data mode is disabled in production",
            field="data_mode",
            reason="demo_fixture_disallowed_in_production",
        )
    fixture_path: Path = settings.contracts_dir_path / "fixtures" / "completed.json"
    if not fixture_path.exists():
        raise DataUnavailable(
            "Synthetic demo_fixture requested but contracts/fixtures/completed.json is missing",
            retryable=False,
            reason="fixture_missing",
        )
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    climate_payload = dict(raw["climate"])
    climate_payload["query"] = query.model_dump(mode="json")
    climate_payload["data_mode"] = "demo_fixture"
    climate_payload["synthetic"] = True
    features = list(climate_payload.get("features") or [])
    if features:
        tmpl = features[0]
        existing_ids = {f.get("feature_id") for f in features}
        ext_demo_specs = (
            ("mean_surface_soil_wetness", 0.42, "1", "GWETTOP"),
            ("mean_root_zone_soil_wetness", 0.48, "1", "GWETROOT"),
            ("mean_solar_irradiance_mj_m2_day", 16.4, "MJ/m^2/day", "ALLSKY_SFC_SW_DWN"),
        )
        for fid, val, unit, code in ext_demo_specs:
            if fid not in existing_ids:
                features.append(
                    {
                        **tmpl,
                        "feature_id": fid,
                        "value": val,
                        "unit": unit,
                        "aggregation": "mean",
                        "parameter_codes": [code],
                        "quality_flags": [],
                        "reason": None,
                    }
                )
        climate_payload["features"] = features
    return ClimateBundle.model_validate(climate_payload)


async def get_climate_features(
    query: ClimateQuery,
    *,
    mode_override: DataMode | None = None,
    settings: Settings | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> ClimateBundle:
    """Fetch or load verified climate features per DATA_RULES.md."""
    cfg = settings or get_settings()
    mode: DataMode = mode_override or cfg.data_mode

    if mode == "demo_fixture":
        return _load_demo_fixture_climate(query, cfg)

    if mode == "cached":
        cached = load_cached_climate_bundle(query, cfg)
        if cached is None:
            raise DataUnavailable(
                "No verified cached NASA POWER snapshot matches these exact coordinates, dates, and UTC standard.",
                retryable=False,
                reason="cache_miss",
            )
        return cached

    # mode == "live"
    try:
        raw_payload, request_url, raw_bytes, retrieved_at = await fetch_power_daily_raw(
            query,
            cfg,
            parameters=NASA_POWER_ALL_PARAMETERS,
            transport=transport,
        )
        bundle = normalize_and_aggregate_power(
            raw_payload,
            raw_bytes=raw_bytes,
            request_url=request_url,
            retrieved_at=retrieved_at,
            query=query,
            data_mode="live",
        )
        save_runtime_cache_snapshot(
            query=query,
            settings=cfg,
            raw_bytes=raw_bytes,
            raw_payload=raw_payload,
            request_url=request_url,
            retrieved_at=retrieved_at,
            bundle=bundle,
            parameters=NASA_POWER_ALL_PARAMETERS,
        )
        return bundle
    except DataUnavailable as exc:
        # Fallback ONLY to an exact-matching verified real snapshot (never synthetic fixture!)
        cached = load_cached_climate_bundle(query, cfg)
        if cached is not None:
            cached.warnings.append(
                f"Upstream NASA POWER could not be reached ({exc}); served exact-matching verified cached snapshot."
            )
            return cached
        raise


def _load_demo_fixture_timeseries(
    query: ClimateTimeseriesQuery, settings: Settings
) -> ClimateTimeseriesBundle:
    if settings.is_production:
        raise InvalidDataQuery(
            "demo_fixture data mode is disabled in production",
            field="data_mode",
            reason="demo_fixture_disallowed_in_production",
        )
    years = list(range(query.start_date.year, query.end_date.year + 1))
    annual = [
        AnnualClimateSummary(
            year=yr,
            mean_temp_c=round(10.1 + 0.08 * idx, 2),
            min_temp_c=-10.9,
            max_temp_c=32.1 + 0.15 * idx,
            total_precip_mm=round(518.0 - 2.0 * idx + (18.0 if idx % 2 == 0 else -12.0), 2),
            frost_days=96 - (idx % 4),
            heat_stress_days=2 + (idx % 3),
            wet_days=105 + (idx % 5),
            max_dry_spell_days=26 + (idx % 6),
            coverage_ratio=1.0,
            valid_days=366 if yr % 4 == 0 else 365,
            expected_days=366 if yr % 4 == 0 else 365,
        )
        for idx, yr in enumerate(years)
    ]
    monthly_temps = [1.2, 2.4, 6.1, 11.4, 16.0, 20.5, 23.8, 23.4, 18.8, 12.6, 6.8, 2.5]
    monthly_pr = [28.0, 32.0, 46.0, 58.0, 72.0, 62.0, 34.0, 29.0, 44.0, 46.5, 31.0, 24.0]
    labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly = [
        MonthlyClimatePoint(
            month=m_idx + 1,
            label=labels[m_idx],
            mean_temp_c=monthly_temps[m_idx],
            total_precip_mm=monthly_pr[m_idx],
            frost_days=22 if m_idx in (0, 1, 11) else (12 if m_idx in (2, 10) else 0),
            heat_stress_days=3 if m_idx in (6, 7) else 0,
            wet_days=9 if 3 <= m_idx <= 5 else 7,
        )
        for m_idx in range(12)
    ]
    return ClimateTimeseriesBundle(
        query=query,
        data_mode="demo_fixture",
        dataset_version="synthetic-demo-timeseries-v0.1.0",
        annual_series=annual,
        focus_year=query.end_date.year,
        focus_monthly_series=monthly,
        trend=ClimateTrendSummary(
            temp_shift_c_per_decade=0.8,
            precip_trend_pct_per_decade=-3.5,
            multiyear_mean_temp_c=10.5,
            multiyear_mean_precip_mm=510.0,
            driest_year=years[-2] if len(years) > 1 else years[0],
            wettest_year=years[0],
            hottest_year=years[-1],
            max_dry_spell_days_overall=31,
            drought_risk_level="moderate",
        ),
        sources=[
            SourceRecord(
                id="synthetic-demo-timeseries",
                provider="Synthetic Contract Fixture (Not Real NASA Data)",
                dataset="demo_fixture",
                source_url=NASA_POWER_DOCS_URL,
                request_url="synthetic://demo_fixture/timeseries",
                retrieved_at=datetime(2026, 11, 14, 0, 0, 0, tzinfo=timezone.utc),
                observation_start=query.start_date,
                observation_end=query.end_date,
                time_standard="UTC",
                parameter_codes=list(NASA_POWER_PARAMETERS),
                units={"T2M": "C", "T2M_MIN": "C", "T2M_MAX": "C", "PRECTOTCORR": "mm/day"},
                spatial_resolution={p: "Synthetic fixture" for p in NASA_POWER_PARAMETERS},
                payload_sha256="0" * 64,
                source_kind="upstream_dataset",
            )
        ],
        quality="complete",
        warnings=["SYNTHETIC DEMO TIMESERIES FIXTURE: not real NASA satellite data."],
        synthetic=True,
    )


async def get_climate_timeseries(
    query: ClimateTimeseriesQuery,
    *,
    mode_override: DataMode | None = None,
    settings: Settings | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> ClimateTimeseriesBundle:
    """Fetch or load verified multi-year NASA POWER climate series & trends."""
    cfg = settings or get_settings()
    mode: DataMode = mode_override or cfg.data_mode

    if mode == "demo_fixture":
        return _load_demo_fixture_timeseries(query, cfg)

    if mode == "cached":
        cached = load_cached_timeseries_bundle(query, cfg)
        if cached is None:
            raise DataUnavailable(
                "No verified cached NASA POWER multi-year snapshot matches these exact coordinates and dates.",
                retryable=False,
                reason="cache_miss",
            )
        return cached

    try:
        raw_payload, request_url, raw_bytes, retrieved_at = await fetch_power_daily_raw(
            query,
            cfg,
            parameters=NASA_POWER_ALL_PARAMETERS,
            transport=transport,
        )
        bundle = normalize_and_aggregate_timeseries(
            raw_payload,
            raw_bytes=raw_bytes,
            request_url=request_url,
            retrieved_at=retrieved_at,
            query=query,
            data_mode="live",
        )
        save_runtime_cache_snapshot(
            query=query,
            settings=cfg,
            raw_bytes=raw_bytes,
            raw_payload=raw_payload,
            request_url=request_url,
            retrieved_at=retrieved_at,
            bundle=bundle,
            parameters=NASA_POWER_ALL_PARAMETERS,
        )
        return bundle
    except DataUnavailable as exc:
        cached = load_cached_timeseries_bundle(query, cfg)
        if cached is not None:
            cached.warnings.append(
                f"Upstream NASA POWER could not be reached ({exc}); served exact-matching verified cached timeseries snapshot."
            )
            return cached
        raise
