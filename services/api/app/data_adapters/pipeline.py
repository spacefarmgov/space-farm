"""Normalization, quality verification, and feature aggregation pipeline for NASA POWER."""

from __future__ import annotations

import hashlib
import math
from datetime import date, datetime, timedelta

from app.config import PIPELINE_VERSION
from app.data_adapters.exceptions import DataQualityError
from app.data_adapters.nasa_power import (
    NASA_POWER_ALL_PARAMETERS,
    NASA_POWER_DOCS_URL,
    NASA_POWER_PARAMETERS,
)
from app.schemas.models import (
    AnnualClimateSummary,
    ClimateBundle,
    ClimateFeature,
    ClimateQuality,
    ClimateQuery,
    ClimateTimeseriesBundle,
    ClimateTimeseriesQuery,
    ClimateTrendSummary,
    DataMode,
    MonthlyClimatePoint,
    SourceRecord,
)

METHOD_VERSION = PIPELINE_VERSION


def _expected_dates(start_date: date, end_date: date) -> list[date]:
    days = (end_date - start_date).days + 1
    return [start_date + timedelta(days=offset) for offset in range(days)]


def _parse_series(
    raw_series: dict[str, object],
    expected: list[date],
    fill_value: float,
) -> tuple[list[float], int, list[str]]:
    """Extract ordered finite values for expected dates without coercing missing days to 0."""
    flags: list[str] = []
    expected_keys = {d.strftime("%Y%m%d") for d in expected}
    extra_keys = [k for k in raw_series.keys() if k not in expected_keys]
    if extra_keys:
        flags.append("OUT_OF_RANGE_DATES_IGNORED")

    valid_values: list[float] = []
    missing_count = 0

    for d in expected:
        key = d.strftime("%Y%m%d")
        if key not in raw_series:
            missing_count += 1
            continue
        raw_val = raw_series[key]
        if raw_val is None or isinstance(raw_val, bool):
            missing_count += 1
            continue
        try:
            num = float(raw_val)
        except (TypeError, ValueError):
            missing_count += 1
            continue
        if not math.isfinite(num) or abs(num - fill_value) < 1e-6:
            missing_count += 1
            continue
        valid_values.append(num)

    if missing_count > 0:
        flags.append("MISSING_DAYS_DETECTED")
    return valid_values, missing_count, flags


def _classify_quality(coverage_ratio: float) -> ClimateQuality:
    if coverage_ratio >= 1.0 - 1e-9:
        return "complete"
    if coverage_ratio >= 0.95:
        return "partial"
    return "insufficient"


_EXTENDED_POWER_FEATURES: tuple[tuple[str, str, str], ...] = (
    ("GWETTOP", "mean_surface_soil_wetness", "1"),
    ("GWETROOT", "mean_root_zone_soil_wetness", "1"),
    ("ALLSKY_SFC_SW_DWN", "mean_solar_irradiance_mj_m2_day", "MJ/m^2/day"),
    ("RH2M", "mean_relative_humidity_pct", "%"),
    ("WS2M", "mean_wind_speed_m_s", "m/s"),
)


def _present_parameters(raw_payload: dict) -> tuple[str, ...]:
    param_map = raw_payload.get("properties", {}).get("parameter", {})
    if not isinstance(param_map, dict):
        return NASA_POWER_PARAMETERS
    present = tuple(code for code in NASA_POWER_ALL_PARAMETERS if isinstance(param_map.get(code), dict))
    return present or NASA_POWER_PARAMETERS


def _extract_spatial_resolution(
    raw_payload: dict,
    parameters: tuple[str, ...] | None = None,
) -> dict[str, str]:
    header = raw_payload.get("header", {})
    sources = header.get("sources") or []
    coords = raw_payload.get("geometry", {}).get("coordinates") or []
    elev_note = ""
    if isinstance(coords, list) and len(coords) >= 3 and isinstance(coords[2], (int, float)):
        elev_note = f"; cell elevation {coords[2]} m"

    if any(str(s).upper() == "MERRA2" for s in sources):
        desc = f"0.5 x 0.625 deg (MERRA2 reanalysis grid{elev_note})"
    else:
        desc = "unknown"
    active_params = parameters or _present_parameters(raw_payload)
    return {param: desc for param in active_params}


def _extract_and_validate_units(
    raw_payload: dict,
    parameters: tuple[str, ...] | None = None,
) -> dict[str, str]:
    param_meta = raw_payload.get("parameters", {})
    active_params = parameters or _present_parameters(raw_payload)
    units: dict[str, str] = {}
    for code in active_params:
        meta = param_meta.get(code)
        unit = str(meta.get("units", "unknown")).strip() if isinstance(meta, dict) else "unknown"
        units[code] = unit

    for temp_code in ("T2M", "T2M_MIN", "T2M_MAX"):
        if units[temp_code] not in {"C", "°C", "degC", "unknown"}:
            raise DataQualityError(
                f"Unexpected temperature unit '{units[temp_code]}' for {temp_code}",
                reason="unexpected_unit",
            )
    if units["PRECTOTCORR"] not in {"mm/day", "mm day-1", "unknown"}:
        raise DataQualityError(
            f"Unexpected precipitation unit '{units['PRECTOTCORR']}' for PRECTOTCORR",
            reason="unexpected_unit",
        )
    for wetness_code in ("GWETTOP", "GWETROOT"):
        if wetness_code in units and units[wetness_code] not in {"1", "dimensionless", "", "unknown"}:
            raise DataQualityError(
                f"Unexpected soil wetness unit '{units[wetness_code]}' for {wetness_code}",
                reason="unexpected_unit",
            )
    if "ALLSKY_SFC_SW_DWN" in units and units["ALLSKY_SFC_SW_DWN"] not in {
        "MJ/m^2/day",
        "MJ m-2 day-1",
        "kW-hr/m^2/day",
        "unknown",
    }:
        raise DataQualityError(
            f"Unexpected irradiance unit '{units['ALLSKY_SFC_SW_DWN']}' for ALLSKY_SFC_SW_DWN",
            reason="unexpected_unit",
        )
    if "RH2M" in units and units["RH2M"] not in {"%", "percent", "unknown"}:
        raise DataQualityError(
            f"Unexpected relative humidity unit '{units['RH2M']}' for RH2M",
            reason="unexpected_unit",
        )
    if "WS2M" in units and units["WS2M"] not in {"m/s", "m s-1", "unknown"}:
        raise DataQualityError(
            f"Unexpected wind speed unit '{units['WS2M']}' for WS2M",
            reason="unexpected_unit",
        )
    return units


def normalize_and_aggregate_power(
    raw_payload: dict,
    *,
    raw_bytes: bytes,
    request_url: str,
    retrieved_at: datetime,
    query: ClimateQuery,
    data_mode: DataMode,
) -> ClimateBundle:
    """Validate units/time-standard, detect missing days/leap years, and build ClimateBundle."""
    header = raw_payload.get("header", {})
    raw_time_std = str(header.get("time_standard", "UTC")).upper()
    if raw_time_std != "UTC":
        raise DataQualityError(
            f"Upstream time_standard '{raw_time_std}' does not match requested UTC",
            reason="time_standard_mismatch",
        )

    fill_value = float(header.get("fill_value", -999.0))
    present_params = _present_parameters(raw_payload)
    units = _extract_and_validate_units(raw_payload, present_params)
    spatial_resolution = _extract_spatial_resolution(raw_payload, present_params)
    payload_sha256 = hashlib.sha256(raw_bytes).hexdigest()

    expected = _expected_dates(query.start_date, query.end_date)
    expected_days = len(expected)
    param_series = raw_payload["properties"]["parameter"]

    t2m_vals, t2m_missing, t2m_flags = _parse_series(param_series["T2M"], expected, fill_value)
    tmin_vals, tmin_missing, tmin_flags = _parse_series(param_series["T2M_MIN"], expected, fill_value)
    tmax_vals, tmax_missing, tmax_flags = _parse_series(param_series["T2M_MAX"], expected, fill_value)
    pr_vals, pr_missing, pr_flags = _parse_series(param_series["PRECTOTCORR"], expected, fill_value)

    source_id = f"nasa-power-{payload_sha256[:12]}"
    source_record = SourceRecord(
        id=source_id,
        provider="NASA LaRC POWER",
        dataset=f"POWER Daily Point ({header.get('api', {}).get('version', 'unknown')})",
        source_url=NASA_POWER_DOCS_URL,
        request_url=request_url,
        retrieved_at=retrieved_at,
        observation_start=query.start_date,
        observation_end=query.end_date,
        time_standard="UTC",
        parameter_codes=list(present_params),
        units=units,
        spatial_resolution=spatial_resolution,
        payload_sha256=payload_sha256,
        source_kind="upstream_dataset",
    )

    def _build_feature(
        feature_id: str,
        value: float | None,
        unit: str,
        aggregation: str,
        param_code: str,
        valid_days: int,
        flags: list[str],
        reason: str | None = None,
    ) -> ClimateFeature:
        cov = round(valid_days / expected_days, 6) if expected_days > 0 else 0.0
        return ClimateFeature(
            feature_id=feature_id,
            value=round(value, 2) if value is not None else None,
            unit=unit,
            period_start=query.start_date,
            period_end=query.end_date,
            aggregation=aggregation,  # type: ignore[arg-type]
            source_ids=[source_id],
            parameter_codes=[param_code],
            coverage_ratio=cov,
            valid_days=valid_days,
            expected_days=expected_days,
            quality_flags=sorted(set(flags)),
            reason=reason,
            method_version=METHOD_VERSION,
        )

    t2m_valid = len(t2m_vals)
    tmin_valid = len(tmin_vals)
    tmax_valid = len(tmax_vals)
    pr_valid = len(pr_vals)

    mean_temp = sum(t2m_vals) / t2m_valid if t2m_valid > 0 else None
    min_temp = min(tmin_vals) if tmin_valid > 0 else None
    max_temp = max(tmax_vals) if tmax_valid > 0 else None
    total_precip = sum(pr_vals) if pr_valid > 0 else None
    frost_days = float(sum(1 for v in tmin_vals if v < 0.0)) if tmin_valid > 0 else None
    wet_days = float(sum(1 for v in pr_vals if v >= 1.0)) if pr_valid > 0 else None

    pr_extra_flags = list(pr_flags)
    pr_reason: str | None = None
    if pr_missing > 0:
        pr_extra_flags.append("PARTIAL_PRECIPITATION_SUM")
        pr_reason = f"missing_{pr_missing}_of_{expected_days}_days"
    if pr_valid == 0:
        pr_reason = "no_valid_precipitation_days"

    features = [
        _build_feature(
            "mean_temperature",
            mean_temp,
            "C",
            "mean",
            "T2M",
            t2m_valid,
            t2m_flags,
            reason=f"missing_{t2m_missing}_days" if t2m_missing else None,
        ),
        _build_feature(
            "min_temperature",
            min_temp,
            "C",
            "min",
            "T2M_MIN",
            tmin_valid,
            tmin_flags,
            reason=f"missing_{tmin_missing}_days" if tmin_missing else None,
        ),
        _build_feature(
            "max_temperature",
            max_temp,
            "C",
            "max",
            "T2M_MAX",
            tmax_valid,
            tmax_flags,
            reason=f"missing_{tmax_missing}_days" if tmax_missing else None,
        ),
        _build_feature(
            "total_precipitation_mm",
            total_precip,
            "mm",
            "sum",
            "PRECTOTCORR",
            pr_valid,
            pr_extra_flags,
            reason=pr_reason,
        ),
        _build_feature(
            "frost_days_count",
            frost_days,
            "day",
            "count",
            "T2M_MIN",
            tmin_valid,
            tmin_flags,
            reason=f"missing_{tmin_missing}_days" if tmin_missing else None,
        ),
        _build_feature(
            "wet_days_count",
            wet_days,
            "day",
            "count",
            "PRECTOTCORR",
            pr_valid,
            pr_flags,
            reason=f"missing_{pr_missing}_days" if pr_missing else None,
        ),
    ]

    for code, feature_id, default_unit in _EXTENDED_POWER_FEATURES:
        raw_series = param_series.get(code)
        if not isinstance(raw_series, dict):
            continue
        ext_vals, ext_missing, ext_flags = _parse_series(raw_series, expected, fill_value)
        ext_valid = len(ext_vals)
        ext_mean = sum(ext_vals) / ext_valid if ext_valid > 0 else None
        raw_unit = units.get(code, "unknown")
        unit = raw_unit if raw_unit and raw_unit != "unknown" else default_unit
        reason = "no_valid_days" if ext_valid == 0 else (f"missing_{ext_missing}_days" if ext_missing else None)
        features.append(
            _build_feature(
                feature_id,
                ext_mean,
                unit,
                "mean",
                code,
                ext_valid,
                ext_flags,
                reason=reason,
            )
        )

    min_cov = min(f.coverage_ratio for f in features if f.feature_id in {"mean_temperature", "total_precipitation_mm"})
    overall_quality = _classify_quality(min_cov)
    warnings: list[str] = []
    if overall_quality == "partial":
        warnings.append(
            f"Historical climate series has partial coverage ({min_cov:.1%}); missing days were NOT imputed or coerced to 0."
        )
    elif overall_quality == "insufficient":
        warnings.append(
            f"Historical climate series has insufficient coverage ({min_cov:.1%} < 95%); simulation ranking is blocked."
        )

    coords = raw_payload.get("geometry", {}).get("coordinates") or []
    if isinstance(coords, list) and len(coords) >= 3 and isinstance(coords[2], (int, float)):
        warnings.append(
            f"NASA POWER MERRA-2 grid cell elevation is {coords[2]} m; point temperatures reflect grid-cell elevation rather than micro-plot station readings."
        )

    dataset_version = (
        f"nasa-power-{query.start_date.isoformat()}-{query.end_date.isoformat()}-{payload_sha256[:12]}"
    )

    return ClimateBundle(
        query=query,
        data_mode=data_mode,
        dataset_version=dataset_version,
        features=features,
        sources=[source_record],
        quality=overall_quality,
        warnings=warnings,
        synthetic=False,
    )


_MONTH_LABELS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _extract_dated_series(
    raw_series: dict[str, object],
    expected: list[date],
    fill_value: float,
) -> dict[date, float]:
    """Return finite daily values keyed by date without imputing missing entries."""
    out: dict[date, float] = {}
    for d in expected:
        raw_val = raw_series.get(d.strftime("%Y%m%d"))
        if raw_val is None or isinstance(raw_val, bool):
            continue
        try:
            num = float(raw_val)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(num) or abs(num - fill_value) < 1e-6:
            continue
        out[d] = num
    return out


def _max_dry_spell(dates: list[date], pr_by_date: dict[date, float]) -> int:
    longest = 0
    current = 0
    for d in dates:
        val = pr_by_date.get(d)
        if val is None:
            current = 0
        elif val < 1.0:
            current += 1
            if current > longest:
                longest = current
        else:
            current = 0
    return longest


def _linear_slope_per_decade(points: list[tuple[int, float]]) -> float | None:
    if len(points) < 3:
        return None
    n = float(len(points))
    mean_x = sum(x for x, _ in points) / n
    mean_y = sum(y for _, y in points) / n
    denom = sum((x - mean_x) ** 2 for x, _ in points)
    if denom <= 1e-9:
        return 0.0
    slope = sum((x - mean_x) * (y - mean_y) for x, y in points) / denom
    return round(slope * 10.0, 2)


def normalize_and_aggregate_timeseries(
    raw_payload: dict,
    *,
    raw_bytes: bytes,
    request_url: str,
    retrieved_at: datetime,
    query: ClimateTimeseriesQuery,
    data_mode: DataMode,
) -> ClimateTimeseriesBundle:
    """Aggregate multi-year NASA POWER daily series into annual, monthly, and trend summaries."""
    header = raw_payload.get("header", {})
    raw_time_std = str(header.get("time_standard", "UTC")).upper()
    if raw_time_std != "UTC":
        raise DataQualityError(
            f"Upstream time_standard '{raw_time_std}' does not match requested UTC",
            reason="time_standard_mismatch",
        )

    fill_value = float(header.get("fill_value", -999.0))
    present_params = _present_parameters(raw_payload)
    units = _extract_and_validate_units(raw_payload, present_params)
    spatial_resolution = _extract_spatial_resolution(raw_payload, present_params)
    payload_sha256 = hashlib.sha256(raw_bytes).hexdigest()

    expected = _expected_dates(query.start_date, query.end_date)
    param_series = raw_payload["properties"]["parameter"]

    t2m_map = _extract_dated_series(param_series["T2M"], expected, fill_value)
    tmin_map = _extract_dated_series(param_series["T2M_MIN"], expected, fill_value)
    tmax_map = _extract_dated_series(param_series["T2M_MAX"], expected, fill_value)
    pr_map = _extract_dated_series(param_series["PRECTOTCORR"], expected, fill_value)

    source_id = f"nasa-power-{payload_sha256[:12]}"
    source_record = SourceRecord(
        id=source_id,
        provider="NASA LaRC POWER",
        dataset=f"POWER Daily Point ({header.get('api', {}).get('version', 'unknown')})",
        source_url=NASA_POWER_DOCS_URL,
        request_url=request_url,
        retrieved_at=retrieved_at,
        observation_start=query.start_date,
        observation_end=query.end_date,
        time_standard="UTC",
        parameter_codes=list(present_params),
        units=units,
        spatial_resolution=spatial_resolution,
        payload_sha256=payload_sha256,
        source_kind="upstream_dataset",
    )

    dates_by_year: dict[int, list[date]] = {}
    for d in expected:
        dates_by_year.setdefault(d.year, []).append(d)

    annual_series: list[AnnualClimateSummary] = []
    min_cov = 1.0
    max_dry_overall = 0

    for yr, yr_dates in sorted(dates_by_year.items()):
        t2m_vals = [t2m_map[d] for d in yr_dates if d in t2m_map]
        tmin_vals = [tmin_map[d] for d in yr_dates if d in tmin_map]
        tmax_vals = [tmax_map[d] for d in yr_dates if d in tmax_map]
        pr_vals = [pr_map[d] for d in yr_dates if d in pr_map]

        exp_days = len(yr_dates)
        valid_days = min(len(t2m_vals), len(pr_vals))
        cov = round(valid_days / exp_days, 6) if exp_days > 0 else 0.0
        if cov < min_cov:
            min_cov = cov

        dry_spell = _max_dry_spell(yr_dates, pr_map)
        if dry_spell > max_dry_overall:
            max_dry_overall = dry_spell

        annual_series.append(
            AnnualClimateSummary(
                year=yr,
                mean_temp_c=round(sum(t2m_vals) / len(t2m_vals), 2) if t2m_vals else None,
                min_temp_c=round(min(tmin_vals), 2) if tmin_vals else None,
                max_temp_c=round(max(tmax_vals), 2) if tmax_vals else None,
                total_precip_mm=round(sum(pr_vals), 2) if pr_vals else None,
                frost_days=sum(1 for v in tmin_vals if v < 0.0),
                heat_stress_days=sum(1 for v in tmax_vals if v >= 35.0),
                wet_days=sum(1 for v in pr_vals if v >= 1.0),
                max_dry_spell_days=dry_spell,
                coverage_ratio=cov,
                valid_days=valid_days,
                expected_days=exp_days,
            )
        )

    focus_year = query.end_date.year
    focus_dates = dates_by_year.get(focus_year, [])
    focus_monthly_series: list[MonthlyClimatePoint] = []
    for month_idx in range(1, 13):
        m_dates = [d for d in focus_dates if d.month == month_idx]
        m_t2m = [t2m_map[d] for d in m_dates if d in t2m_map]
        m_tmin = [tmin_map[d] for d in m_dates if d in tmin_map]
        m_tmax = [tmax_map[d] for d in m_dates if d in tmax_map]
        m_pr = [pr_map[d] for d in m_dates if d in pr_map]
        focus_monthly_series.append(
            MonthlyClimatePoint(
                month=month_idx,
                label=_MONTH_LABELS[month_idx - 1],
                mean_temp_c=round(sum(m_t2m) / len(m_t2m), 2) if m_t2m else None,
                total_precip_mm=round(sum(m_pr), 2) if m_pr else None,
                frost_days=sum(1 for v in m_tmin if v < 0.0),
                heat_stress_days=sum(1 for v in m_tmax if v >= 35.0),
                wet_days=sum(1 for v in m_pr if v >= 1.0),
            )
        )

    temp_points = [
        (a.year, a.mean_temp_c)
        for a in annual_series
        if a.mean_temp_c is not None and a.coverage_ratio >= 0.95
    ]
    precip_points = [
        (a.year, a.total_precip_mm)
        for a in annual_series
        if a.total_precip_mm is not None and a.coverage_ratio >= 0.95
    ]

    mean_multi_temp = (
        round(sum(y for _, y in temp_points) / len(temp_points), 2) if temp_points else None
    )
    mean_multi_precip = (
        round(sum(y for _, y in precip_points) / len(precip_points), 2) if precip_points else None
    )
    temp_shift_decade = _linear_slope_per_decade(temp_points)
    precip_slope_decade = _linear_slope_per_decade(precip_points)
    precip_pct_decade = (
        round((precip_slope_decade / mean_multi_precip) * 100.0, 2)
        if (precip_slope_decade is not None and mean_multi_precip and mean_multi_precip > 1e-6)
        else None
    )

    driest_yr = min(precip_points, key=lambda p: (p[1], p[0]))[0] if precip_points else None
    wettest_yr = max(precip_points, key=lambda p: (p[1], -p[0]))[0] if precip_points else None
    hottest_yr = max(temp_points, key=lambda p: (p[1], -p[0]))[0] if temp_points else None

    if not precip_points:
        drought_risk: str = "unknown"
    elif (mean_multi_precip is not None and mean_multi_precip < 480.0) or max_dry_overall >= 45:
        drought_risk = "elevated"
    elif (mean_multi_precip is not None and mean_multi_precip < 600.0) or max_dry_overall >= 28:
        drought_risk = "moderate"
    else:
        drought_risk = "low"

    overall_quality = _classify_quality(min_cov)
    warnings: list[str] = []
    if overall_quality != "complete":
        warnings.append(
            f"Multi-year series minimum yearly coverage is {min_cov:.1%}; incomplete years were excluded from trend slopes rather than imputed."
        )
    coords = raw_payload.get("geometry", {}).get("coordinates") or []
    if isinstance(coords, list) and len(coords) >= 3 and isinstance(coords[2], (int, float)):
        warnings.append(
            f"NASA POWER MERRA-2 grid cell elevation is {coords[2]} m; multi-year values represent ~0.5x0.625 deg grid cell averages."
        )

    dataset_version = (
        f"nasa-power-ts-{query.start_date.isoformat()}-{query.end_date.isoformat()}-{payload_sha256[:12]}"
    )

    return ClimateTimeseriesBundle(
        query=query,
        data_mode=data_mode,
        dataset_version=dataset_version,
        annual_series=annual_series,
        focus_year=focus_year,
        focus_monthly_series=focus_monthly_series,
        trend=ClimateTrendSummary(
            temp_shift_c_per_decade=temp_shift_decade,
            precip_trend_pct_per_decade=precip_pct_decade,
            multiyear_mean_temp_c=mean_multi_temp,
            multiyear_mean_precip_mm=mean_multi_precip,
            driest_year=driest_yr,
            wettest_year=wettest_yr,
            hottest_year=hottest_yr,
            max_dry_spell_days_overall=max_dry_overall,
            drought_risk_level=drought_risk,  # type: ignore[arg-type]
        ),
        sources=[source_record],
        quality=overall_quality,
        warnings=warnings,
        synthetic=False,
    )
