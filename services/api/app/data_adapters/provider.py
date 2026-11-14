"""Public C -> B Python provider interface (routes/engine import only this module)."""

from __future__ import annotations

import json
from pathlib import Path

import httpx

from app.config import Settings, get_settings
from app.data_adapters.cache import load_cached_climate_bundle, save_runtime_cache_snapshot
from app.data_adapters.catalog import get_crop_catalog
from app.data_adapters.exceptions import DataUnavailable, InvalidDataQuery
from app.data_adapters.nasa_power import fetch_power_daily_raw
from app.data_adapters.pipeline import normalize_and_aggregate_power
from app.schemas.models import ClimateBundle, ClimateQuery, DataMode

__all__ = ["get_climate_features", "get_crop_catalog"]


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
            query, cfg, transport=transport
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
