"""CLI tool to fetch, verify, normalize, and store a real NASA POWER Daily Point snapshot."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_DIR = REPO_ROOT / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import get_settings  # noqa: E402
from app.data_adapters.cache import build_snapshot_manifest, compute_query_hash  # noqa: E402
from app.data_adapters.nasa_power import fetch_power_daily_raw  # noqa: E402
from app.data_adapters.pipeline import normalize_and_aggregate_power  # noqa: E402
from app.schemas.models import ClimateQuery  # noqa: E402


async def _fetch_and_store(lat: float, lon: float, start: date, end: date) -> int:
    settings = get_settings()
    query = ClimateQuery(
        latitude=lat,
        longitude=lon,
        start_date=start,
        end_date=end,
        time_standard="UTC",
    )
    query_hash = compute_query_hash(query, community=settings.nasa_power_community)

    raw_payload, request_url, raw_bytes, retrieved_at = await fetch_power_daily_raw(query, settings)
    bundle = normalize_and_aggregate_power(
        raw_payload,
        raw_bytes=raw_bytes,
        request_url=request_url,
        retrieved_at=retrieved_at,
        query=query,
        data_mode="cached",
    )

    settings.raw_data_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_data_dir.mkdir(parents=True, exist_ok=True)

    raw_path = settings.raw_data_dir / f"{query_hash}.json"
    processed_path = settings.processed_data_dir / f"{query_hash}.json"
    manifest_path = settings.processed_data_dir / f"{query_hash}.manifest.json"

    raw_path.write_bytes(raw_bytes)
    processed_path.write_text(bundle.model_dump_json(indent=2), encoding="utf-8")

    manifest = build_snapshot_manifest(
        query_hash=query_hash,
        query=query,
        community=settings.nasa_power_community,
        raw_file_rel=f"data/raw/{query_hash}.json",
        raw_bytes=raw_bytes,
        raw_payload=raw_payload,
        request_url=request_url,
        retrieved_at=retrieved_at,
        bundle=bundle,
    )
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    feat_map = {f.feature_id: f for f in bundle.features}
    mean_t = feat_map["mean_temperature"]
    tot_p = feat_map["total_precipitation_mm"]
    print(f"Saved NASA POWER snapshot: query_hash={query_hash}")
    print(f"  raw:       {raw_path}")
    print(f"  processed: {processed_path}")
    print(f"  manifest:  {manifest_path}")
    print(f"  sha256:    {manifest['payload_sha256']}")
    print(f"  quality:   {bundle.quality} ({tot_p.valid_days}/{tot_p.expected_days} days)")
    print(f"  T2M mean:  {mean_t.value} {mean_t.unit}")
    print(f"  PRECTOT:   {tot_p.value} {tot_p.unit}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch and verify a NASA POWER Daily Point snapshot.")
    parser.add_argument("--lat", type=float, default=40.68, help="Latitude in EPSG:4326 (default: 40.68)")
    parser.add_argument("--lon", type=float, default=46.36, help="Longitude in EPSG:4326 (default: 46.36)")
    parser.add_argument("--start", type=date.fromisoformat, default=date(2024, 1, 1), help="Start date YYYY-MM-DD")
    parser.add_argument("--end", type=date.fromisoformat, default=date(2024, 12, 31), help="End date YYYY-MM-DD")
    args = parser.parse_args()
    return asyncio.run(_fetch_and_store(args.lat, args.lon, args.start, args.end))


if __name__ == "__main__":
    raise SystemExit(main())
