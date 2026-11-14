"""Tests T01-T08 and T23 for NASA POWER client, normalization pipeline, and exact cache."""

from __future__ import annotations

import asyncio
import hashlib
import json
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

import httpx

API_DIR = Path(__file__).resolve().parents[2]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import Settings  # noqa: E402
from app.data_adapters.cache import compute_query_hash, load_cached_climate_bundle  # noqa: E402
from app.data_adapters.exceptions import DataQualityError, DataUnavailable, InvalidDataQuery  # noqa: E402
from app.data_adapters.pipeline import normalize_and_aggregate_power  # noqa: E402
from app.data_adapters.provider import get_climate_features  # noqa: E402
from app.schemas.models import ClimateQuery  # noqa: E402


def _make_sample_power_payload(
    *,
    start: date = date(2024, 1, 1),
    days: int = 366,
    t2m_override: dict[str, float] | None = None,
    pr_override: dict[str, float] | None = None,
    omit_keys: set[str] | None = None,
    time_standard: str = "UTC",
    precip_unit: str = "mm/day",
) -> dict:
    from datetime import timedelta

    t2m = {}
    tmin = {}
    tmax = {}
    pr = {}
    omit = omit_keys or set()
    for i in range(days):
        d_str = (start + timedelta(days=i)).strftime("%Y%m%d")
        if d_str in omit:
            continue
        t2m[d_str] = (t2m_override or {}).get(d_str, 10.0)
        tmin[d_str] = (t2m_override or {}).get(d_str, 4.0)
        tmax[d_str] = (t2m_override or {}).get(d_str, 16.0)
        pr[d_str] = (pr_override or {}).get(d_str, 1.5)

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [46.36, 40.68, 1313.31]},
        "properties": {
            "parameter": {
                "T2M": t2m,
                "T2M_MIN": tmin,
                "T2M_MAX": tmax,
                "PRECTOTCORR": pr,
            }
        },
        "header": {
            "api": {"version": "v2.10.3", "name": "POWER Daily API"},
            "sources": ["MERRA2", "POWER"],
            "fill_value": -999.0,
            "time_standard": time_standard,
        },
        "parameters": {
            "T2M": {"units": "C"},
            "T2M_MIN": {"units": "C"},
            "T2M_MAX": {"units": "C"},
            "PRECTOTCORR": {"units": precip_unit},
        },
    }


class PowerAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[4]
        self.ganja_query = ClimateQuery(
            latitude=40.68,
            longitude=46.36,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            time_standard="UTC",
        )

    def test_t01_committed_real_snapshot_manifest_and_sha256(self) -> None:
        settings = Settings(DATA_DIR=str(self.repo_root / "data"))
        qhash = compute_query_hash(self.ganja_query, community="AG")
        raw_path = settings.raw_data_dir / f"{qhash}.json"
        manifest_path = settings.processed_data_dir / f"{qhash}.manifest.json"
        self.assertTrue(raw_path.exists(), f"Missing real snapshot {raw_path}")
        self.assertTrue(manifest_path.exists(), f"Missing manifest {manifest_path}")

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["payload_sha256"], hashlib.sha256(raw_path.read_bytes()).hexdigest())
        bundle = load_cached_climate_bundle(self.ganja_query, settings)
        self.assertIsNotNone(bundle)
        assert bundle is not None
        self.assertEqual(bundle.data_mode, "cached")
        self.assertEqual(bundle.quality, "complete")
        feat_map = {f.feature_id: f for f in bundle.features}
        self.assertEqual(feat_map["total_precipitation_mm"].valid_days, 366)
        self.assertEqual(feat_map["total_precipitation_mm"].expected_days, 366)
        self.assertAlmostEqual(feat_map["mean_temperature"].value or 0.0, 10.58, places=2)
        self.assertAlmostEqual(feat_map["total_precipitation_mm"].value or 0.0, 506.52, places=2)

    def test_t02_negative_temperatures_preserved(self) -> None:
        payload = _make_sample_power_payload(
            start=date(2024, 1, 1),
            days=5,
            t2m_override={
                "20240101": -10.5,
                "20240102": -2.5,
                "20240103": -1.0,
                "20240104": 4.0,
                "20240105": 0.0,
            },
        )
        raw_bytes = json.dumps(payload).encode("utf-8")
        query = ClimateQuery(
            latitude=40.68,
            longitude=46.36,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 5),
        )
        bundle = normalize_and_aggregate_power(
            payload,
            raw_bytes=raw_bytes,
            request_url="https://power.larc.nasa.gov/api/temporal/daily/point",
            retrieved_at=datetime(2026, 11, 14, tzinfo=timezone.utc),
            query=query,
            data_mode="live",
        )
        feat_map = {f.feature_id: f for f in bundle.features}
        self.assertEqual(feat_map["mean_temperature"].valid_days, 5)
        self.assertAlmostEqual(feat_map["mean_temperature"].value or 0.0, -2.0, places=2)
        self.assertAlmostEqual(feat_map["min_temperature"].value or 0.0, -10.5, places=2)
        self.assertEqual(feat_map["frost_days_count"].value, 3.0)

    def test_t03_missing_rainfall_not_coerced_to_zero(self) -> None:
        payload = _make_sample_power_payload(
            start=date(2024, 1, 1),
            days=10,
            pr_override={"20240102": -999.0},
            omit_keys={"20240103"},
        )
        raw_bytes = json.dumps(payload).encode("utf-8")
        query = ClimateQuery(
            latitude=40.68,
            longitude=46.36,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 10),
        )
        bundle = normalize_and_aggregate_power(
            payload,
            raw_bytes=raw_bytes,
            request_url="https://power.larc.nasa.gov/api/temporal/daily/point",
            retrieved_at=datetime(2026, 11, 14, tzinfo=timezone.utc),
            query=query,
            data_mode="live",
        )
        feat_map = {f.feature_id: f for f in bundle.features}
        pr = feat_map["total_precipitation_mm"]
        self.assertEqual(pr.valid_days, 8)
        self.assertEqual(pr.expected_days, 10)
        self.assertAlmostEqual(pr.value or 0.0, 12.0, places=2)  # 8 * 1.5
        self.assertIn("MISSING_DAYS_DETECTED", pr.quality_flags)
        self.assertIn("PARTIAL_PRECIPITATION_SUM", pr.quality_flags)
        self.assertEqual(bundle.quality, "insufficient")

    def test_t04_http_422_never_retries(self) -> None:
        calls = 0

        def handler(_: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(422, json={"message": "Invalid parameter"})

        with tempfile.TemporaryDirectory() as tmpdir:
            settings = Settings(
                DATA_DIR=str(self.repo_root / "data"),
                DATA_CACHE_DIR=tmpdir,
                NASA_POWER_MAX_RETRIES=2,
            )
            with self.assertRaises(InvalidDataQuery):
                asyncio.run(
                    get_climate_features(
                        self.ganja_query,
                        mode_override="live",
                        settings=settings,
                        transport=httpx.MockTransport(handler),
                    )
                )
        self.assertEqual(calls, 1)

    def test_t05_429_and_timeout_bounded_retry_then_unavailable(self) -> None:
        calls = 0

        def handler(_: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(429, headers={"Retry-After": "0"})

        other_query = ClimateQuery(
            latitude=40.4093,
            longitude=49.8671,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            settings = Settings(
                DATA_DIR=str(self.repo_root / "data"),
                DATA_CACHE_DIR=tmpdir,
                NASA_POWER_MAX_RETRIES=2,
                NASA_POWER_RETRY_BUDGET_SECONDS=2.0,
            )
            with self.assertRaises(DataUnavailable):
                asyncio.run(
                    get_climate_features(
                        other_query,
                        mode_override="live",
                        settings=settings,
                        transport=httpx.MockTransport(handler),
                    )
                )
        self.assertEqual(calls, 3)  # 1 initial + 2 retries

    def test_t06_mismatched_coordinate_or_date_never_returns_ganja_cache(self) -> None:
        settings = Settings(DATA_DIR=str(self.repo_root / "data"))
        baku_query = ClimateQuery(
            latitude=40.4093,
            longitude=49.8671,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        with self.assertRaises(DataUnavailable):
            asyncio.run(
                get_climate_features(baku_query, mode_override="cached", settings=settings)
            )

        ganja_2023 = ClimateQuery(
            latitude=40.68,
            longitude=46.36,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
        )
        with self.assertRaises(DataUnavailable):
            asyncio.run(
                get_climate_features(ganja_2023, mode_override="cached", settings=settings)
            )

    def test_t07_leap_year_gap_detection(self) -> None:
        payload = _make_sample_power_payload(
            start=date(2024, 1, 1),
            days=366,
            omit_keys={"20240229"},
        )
        raw_bytes = json.dumps(payload).encode("utf-8")
        bundle = normalize_and_aggregate_power(
            payload,
            raw_bytes=raw_bytes,
            request_url="https://power.larc.nasa.gov/api/temporal/daily/point",
            retrieved_at=datetime(2026, 11, 14, tzinfo=timezone.utc),
            query=self.ganja_query,
            data_mode="live",
        )
        pr = next(f for f in bundle.features if f.feature_id == "total_precipitation_mm")
        self.assertEqual(pr.expected_days, 366)
        self.assertEqual(pr.valid_days, 365)
        self.assertEqual(bundle.quality, "partial")

    def test_t08_rejects_lst_standard_and_unexpected_units(self) -> None:
        with self.assertRaises(ValueError):
            ClimateQuery(
                latitude=40.68,
                longitude=46.36,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
                time_standard="LST",
            )

        bad_unit_payload = _make_sample_power_payload(
            start=date(2024, 1, 1), days=3, precip_unit="m/s"
        )
        with self.assertRaises(DataQualityError):
            normalize_and_aggregate_power(
                bad_unit_payload,
                raw_bytes=json.dumps(bad_unit_payload).encode("utf-8"),
                request_url="https://power.larc.nasa.gov/api/temporal/daily/point",
                retrieved_at=datetime(2026, 11, 14, tzinfo=timezone.utc),
                query=ClimateQuery(
                    latitude=40.68,
                    longitude=46.36,
                    start_date=date(2024, 1, 1),
                    end_date=date(2024, 1, 3),
                ),
                data_mode="live",
            )

    def test_t23_upstream_outage_falls_back_only_to_matching_real_snapshot(self) -> None:
        def failing_handler(_: httpx.Request) -> httpx.Response:
            raise httpx.ConnectTimeout("Simulated upstream network outage")

        with tempfile.TemporaryDirectory() as tmpdir:
            settings = Settings(
                DATA_DIR=str(self.repo_root / "data"),
                DATA_CACHE_DIR=tmpdir,
                NASA_POWER_MAX_RETRIES=1,
                NASA_POWER_RETRY_BUDGET_SECONDS=0.5,
            )
            # Exact Ganja 2024 query succeeds via verified snapshot fallback
            bundle = asyncio.run(
                get_climate_features(
                    self.ganja_query,
                    mode_override="live",
                    settings=settings,
                    transport=httpx.MockTransport(failing_handler),
                )
            )
            self.assertEqual(bundle.data_mode, "cached")
            self.assertFalse(bundle.synthetic)
            self.assertTrue(any("verified cached snapshot" in w for w in bundle.warnings))

    def test_c04_all_committed_regional_snapshots_and_catalog_audit(self) -> None:
        from app.data_adapters.catalog import get_crop_catalog

        settings = Settings(DATA_DIR=str(self.repo_root / "data"))
        regional_queries = [
            ("Ganja 2024", 40.68, 46.36, 506.52),
            ("Aran 2024", 40.38, 47.12, 457.50),
            ("Quba-Khachmaz 2024", 41.36, 48.51, 516.20),
            ("Sheki-Zaqatala 2024", 41.19, 47.17, 588.52),
        ]
        for label, lat, lon, expected_precip in regional_queries:
            query = ClimateQuery(
                latitude=lat,
                longitude=lon,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
                time_standard="UTC",
            )
            qhash = compute_query_hash(query, community="AG")
            raw_path = settings.raw_data_dir / f"{qhash}.json"
            manifest_path = settings.processed_data_dir / f"{qhash}.manifest.json"
            self.assertTrue(raw_path.exists(), f"Missing raw snapshot for {label}: {raw_path}")
            self.assertTrue(manifest_path.exists(), f"Missing manifest for {label}: {manifest_path}")

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(
                manifest["payload_sha256"],
                hashlib.sha256(raw_path.read_bytes()).hexdigest(),
                f"SHA-256 mismatch for {label}",
            )
            bundle = asyncio.run(get_climate_features(query, mode_override="cached", settings=settings))
            self.assertEqual(bundle.data_mode, "cached")
            self.assertFalse(bundle.synthetic)
            self.assertEqual(bundle.quality, "complete")
            feat_map = {f.feature_id: f for f in bundle.features}
            self.assertEqual(feat_map["total_precipitation_mm"].valid_days, 366)
            self.assertEqual(feat_map["total_precipitation_mm"].expected_days, 366)
            self.assertAlmostEqual(
                feat_map["total_precipitation_mm"].value or 0.0,
                expected_precip,
                places=2,
            )

        catalog = get_crop_catalog(settings)
        self.assertEqual(len(catalog.crops), 6)
        self.assertEqual(len(catalog.rules), 7)
        for crop in catalog.crops:
            self.assertNotEqual(crop.validation_status, "expert_reviewed")
        for rule in catalog.rules:
            self.assertNotEqual(rule.validation_status, "expert_reviewed")


if __name__ == "__main__":
    unittest.main()
