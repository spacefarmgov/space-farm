"""Exact query-keyed snapshot & runtime cache management with SHA-256 verification."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

from app.config import PIPELINE_VERSION, Settings, ensure_runtime_dirs
from app.data_adapters.nasa_power import (
    NASA_POWER_ALL_PARAMETERS,
    NASA_POWER_DOCS_URL,
    NASA_POWER_PARAMETERS,
)
from app.data_adapters.pipeline import (
    normalize_and_aggregate_power,
    normalize_and_aggregate_timeseries,
)
from app.schemas.models import (
    ClimateBundle,
    ClimateQuery,
    ClimateTimeseriesBundle,
    ClimateTimeseriesQuery,
)


def compute_query_hash(
    query: ClimateQuery | ClimateTimeseriesQuery,
    *,
    community: str = "AG",
    parameters: tuple[str, ...] = NASA_POWER_PARAMETERS,
) -> str:
    """Compute canonical 16-char SHA-256 query key (prevents mismatched coordinate/date hits)."""
    key_payload = {
        "provider": "nasa_power",
        "endpoint": "daily_point",
        "latitude": round(query.latitude, 4),
        "longitude": round(query.longitude, 4),
        "start_date": query.start_date.isoformat(),
        "end_date": query.end_date.isoformat(),
        "parameters": sorted(parameters),
        "community": community,
        "time_standard": query.time_standard,
        "pipeline_version": PIPELINE_VERSION,
    }
    encoded = json.dumps(key_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


def _manifest_matches_query(
    manifest: dict, query: ClimateQuery | ClimateTimeseriesQuery, community: str
) -> bool:
    stored = manifest.get("query")
    if not isinstance(stored, dict):
        return False
    return (
        abs(float(stored.get("latitude", 999)) - round(query.latitude, 4)) < 1e-4
        and abs(float(stored.get("longitude", 999)) - round(query.longitude, 4)) < 1e-4
        and stored.get("start_date") == query.start_date.isoformat()
        and stored.get("end_date") == query.end_date.isoformat()
        and stored.get("time_standard") == query.time_standard
        and stored.get("community") == community
    )


def _load_verified_raw(
    raw_path: Path,
    manifest_path: Path,
    query: ClimateQuery | ClimateTimeseriesQuery,
    community: str,
) -> tuple[dict, bytes, str, datetime] | None:
    if not raw_path.exists() or not manifest_path.exists():
        return None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        raw_bytes = raw_path.read_bytes()
        raw_payload = json.loads(raw_bytes.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None

    if not _manifest_matches_query(manifest, query, community):
        return None

    actual_sha = hashlib.sha256(raw_bytes).hexdigest()
    if manifest.get("payload_sha256") != actual_sha:
        return None

    retrieved_at_raw = manifest.get("retrieved_at")
    request_url = str(manifest.get("request_url", ""))
    if not retrieved_at_raw or not request_url:
        return None

    retrieved_at = datetime.fromisoformat(str(retrieved_at_raw).replace("Z", "+00:00"))
    return raw_payload, raw_bytes, request_url, retrieved_at


def _resolve_verified_raw(
    query: ClimateQuery | ClimateTimeseriesQuery,
    settings: Settings,
) -> tuple[dict, bytes, str, datetime] | None:
    search_plan = (
        (settings.raw_data_dir, settings.processed_data_dir, NASA_POWER_ALL_PARAMETERS),
        (settings.cache_dir_path, settings.cache_dir_path, NASA_POWER_ALL_PARAMETERS),
        (settings.raw_data_dir, settings.processed_data_dir, NASA_POWER_PARAMETERS),
        (settings.cache_dir_path, settings.cache_dir_path, NASA_POWER_PARAMETERS),
    )
    for raw_dir, manifest_dir, param_set in search_plan:
        query_hash = compute_query_hash(
            query,
            community=settings.nasa_power_community,
            parameters=param_set,
        )
        loaded = _load_verified_raw(
            raw_dir / f"{query_hash}.json",
            manifest_dir / f"{query_hash}.manifest.json",
            query,
            settings.nasa_power_community,
        )
        if loaded is not None:
            return loaded
    return None


def load_cached_timeseries_bundle(
    query: ClimateTimeseriesQuery, settings: Settings
) -> ClimateTimeseriesBundle | None:
    """Return cached ClimateTimeseriesBundle ONLY if exact query parameters and SHA-256 match."""
    loaded = _resolve_verified_raw(query, settings)
    if loaded is None:
        return None
    raw_payload, raw_bytes, request_url, retrieved_at = loaded
    return normalize_and_aggregate_timeseries(
        raw_payload,
        raw_bytes=raw_bytes,
        request_url=request_url,
        retrieved_at=retrieved_at,
        query=query,
        data_mode="cached",
    )


def load_cached_climate_bundle(query: ClimateQuery, settings: Settings) -> ClimateBundle | None:
    """Return cached ClimateBundle ONLY if exact query parameters and SHA-256 match."""
    loaded = _resolve_verified_raw(query, settings)
    if loaded is None:
        return None
    raw_payload, raw_bytes, request_url, retrieved_at = loaded
    return normalize_and_aggregate_power(
        raw_payload,
        raw_bytes=raw_bytes,
        request_url=request_url,
        retrieved_at=retrieved_at,
        query=query,
        data_mode="cached",
    )


def build_snapshot_manifest(
    *,
    query_hash: str,
    query: ClimateQuery | ClimateTimeseriesQuery,
    community: str,
    raw_file_rel: str,
    raw_bytes: bytes,
    raw_payload: dict,
    request_url: str,
    retrieved_at: datetime,
    bundle: ClimateBundle | ClimateTimeseriesBundle,
    parameters: tuple[str, ...] | None = None,
) -> dict:
    """Construct complete provenance manifest conforming to docs/DATA_RULES.md."""
    src = bundle.sources[0]
    if isinstance(bundle, ClimateBundle):
        valid_counts = {f.feature_id: f.valid_days for f in bundle.features}
        missing_counts = {f.feature_id: f.expected_days - f.valid_days for f in bundle.features}
        flags = sorted({flag for f in bundle.features for flag in f.quality_flags})
    else:
        valid_counts = {str(a.year): a.valid_days for a in bundle.annual_series}
        missing_counts = {str(a.year): a.expected_days - a.valid_days for a in bundle.annual_series}
        flags = []

    return {
        "dataset_id": bundle.dataset_version,
        "query_hash": query_hash,
        "provider": "NASA LaRC POWER",
        "source_url": NASA_POWER_DOCS_URL,
        "request_url": request_url,
        "query": {
            "latitude": round(query.latitude, 4),
            "longitude": round(query.longitude, 4),
            "start_date": query.start_date.isoformat(),
            "end_date": query.end_date.isoformat(),
            "community": community,
            "time_standard": query.time_standard,
        },
        "retrieved_at": retrieved_at.isoformat(),
        "observation_period": {
            "start": query.start_date.isoformat(),
            "end": query.end_date.isoformat(),
        },
        "parameters": list(parameters or src.parameter_codes or NASA_POWER_PARAMETERS),
        "units": src.units,
        "time_standard": "UTC",
        "spatial_resolution": src.spatial_resolution,
        "geometry": raw_payload.get("geometry"),
        "raw_file": raw_file_rel,
        "payload_sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "pipeline_version": PIPELINE_VERSION,
        "valid_day_counts": valid_counts,
        "missing_day_counts": missing_counts,
        "quality_flags": flags,
        "redistribution_notes": (
            "NASA LaRC POWER data is provided under NASA Earth Science open data / attribution terms, "
            "separate from Space Farm's MIT code license; attribution required without implying NASA endorsement."
        ),
    }


def save_runtime_cache_snapshot(
    *,
    query: ClimateQuery | ClimateTimeseriesQuery,
    settings: Settings,
    raw_bytes: bytes,
    raw_payload: dict,
    request_url: str,
    retrieved_at: datetime,
    bundle: ClimateBundle | ClimateTimeseriesBundle,
    parameters: tuple[str, ...] = NASA_POWER_PARAMETERS,
) -> Path:
    """Persist verified live response in runtime cache dir without touching committed snapshots."""
    ensure_runtime_dirs(settings)
    query_hash = compute_query_hash(
        query,
        community=settings.nasa_power_community,
        parameters=parameters,
    )
    raw_path = settings.cache_dir_path / f"{query_hash}.json"
    manifest_path = settings.cache_dir_path / f"{query_hash}.manifest.json"
    raw_path.write_bytes(raw_bytes)
    manifest = build_snapshot_manifest(
        query_hash=query_hash,
        query=query,
        community=settings.nasa_power_community,
        raw_file_rel=str(raw_path.name),
        raw_bytes=raw_bytes,
        raw_payload=raw_payload,
        request_url=request_url,
        retrieved_at=retrieved_at,
        bundle=bundle,
        parameters=parameters,
    )
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path
