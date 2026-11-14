"""Normalization, quality verification, and feature aggregation pipeline for NASA POWER."""

from __future__ import annotations

import hashlib
import math
from datetime import date, datetime, timedelta

from app.config import PIPELINE_VERSION
from app.data_adapters.exceptions import DataQualityError
from app.data_adapters.nasa_power import NASA_POWER_DOCS_URL, NASA_POWER_PARAMETERS
from app.schemas.models import (
    ClimateBundle,
    ClimateFeature,
    ClimateQuality,
    ClimateQuery,
    DataMode,
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


def _extract_spatial_resolution(raw_payload: dict) -> dict[str, str]:
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
    return {param: desc for param in NASA_POWER_PARAMETERS}


def _extract_and_validate_units(raw_payload: dict) -> dict[str, str]:
    param_meta = raw_payload.get("parameters", {})
    units: dict[str, str] = {}
    for code in NASA_POWER_PARAMETERS:
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
    units = _extract_and_validate_units(raw_payload)
    spatial_resolution = _extract_spatial_resolution(raw_payload)
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
        parameter_codes=list(NASA_POWER_PARAMETERS),
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
