"""Generate frozen v0.1.0 OpenAPI schema and synthetic UI contract fixtures."""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_DIR = REPO_ROOT / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import CONTRACT_VERSION, PIPELINE_VERSION, get_settings  # noqa: E402
from app.data_adapters.catalog import get_crop_catalog  # noqa: E402
from app.engine.planner import run_simulation  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.models import (  # noqa: E402
    ClimateBundle,
    ClimateFeature,
    ClimateQuery,
    DatePeriod,
    ErrorBody,
    ErrorDetail,
    ErrorEnvelope,
    FarmInput,
    GeoPoint,
    PreferenceWeights,
    ScenarioInput,
    SimulationRequest,
    SoilInput,
    SourceRecord,
)


def _synthetic_climate(
    *,
    precip_mm: float = 506.5,
    mean_temp_c: float = 10.6,
    quality: str = "complete",
    coverage: float = 1.0,
    valid_days: int = 366,
    data_mode: str = "demo_fixture",
) -> ClimateBundle:
    src_id = "synthetic-demo-source"
    query = ClimateQuery(
        latitude=40.68,
        longitude=46.36,
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        time_standard="UTC",
    )
    return ClimateBundle(
        contract_version=CONTRACT_VERSION,
        query=query,
        data_mode=data_mode,  # type: ignore[arg-type]
        dataset_version="synthetic-demo-fixture-v0.1.0",
        features=[
            ClimateFeature(
                feature_id="mean_temperature",
                value=mean_temp_c,
                unit="C",
                period_start=date(2024, 1, 1),
                period_end=date(2024, 12, 31),
                aggregation="mean",
                source_ids=[src_id],
                parameter_codes=["T2M"],
                coverage_ratio=coverage,
                valid_days=valid_days,
                expected_days=366,
                quality_flags=["SYNTHETIC_CONTRACT_FIXTURE"],
                method_version=PIPELINE_VERSION,
            ),
            ClimateFeature(
                feature_id="total_precipitation_mm",
                value=precip_mm,
                unit="mm",
                period_start=date(2024, 1, 1),
                period_end=date(2024, 12, 31),
                aggregation="sum",
                source_ids=[src_id],
                parameter_codes=["PRECTOTCORR"],
                coverage_ratio=coverage,
                valid_days=valid_days,
                expected_days=366,
                quality_flags=["SYNTHETIC_CONTRACT_FIXTURE"],
                method_version=PIPELINE_VERSION,
            ),
        ],
        sources=[
            SourceRecord(
                id=src_id,
                provider="Synthetic Contract Fixture (Not Real NASA Data)",
                dataset="demo_fixture",
                source_url="https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
                request_url="synthetic://demo_fixture/ganja-2024",
                retrieved_at=datetime(2026, 11, 14, 0, 0, 0, tzinfo=timezone.utc),
                observation_start=date(2024, 1, 1),
                observation_end=date(2024, 12, 31),
                time_standard="UTC",
                parameter_codes=["T2M", "PRECTOTCORR"],
                units={"T2M": "C", "PRECTOTCORR": "mm/day"},
                spatial_resolution={"T2M": "synthetic", "PRECTOTCORR": "synthetic"},
                payload_sha256="0" * 64,
                source_kind="upstream_dataset",
            )
        ],
        quality=quality,  # type: ignore[arg-type]
        warnings=["SYNTHETIC CONTRACT FIXTURE ONLY (synthetic=true): not live NASA POWER observations."],
        synthetic=True,
    )


def main() -> int:
    settings = get_settings()
    contracts_dir = settings.contracts_dir_path
    fixtures_dir = contracts_dir / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    # 1. OpenAPI spec
    openapi_path = contracts_dir / "openapi.json"
    openapi_path.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")

    catalog = get_crop_catalog(settings)
    base_location = GeoPoint(latitude=40.68, longitude=46.36)
    base_period = DatePeriod(start_date=date(2024, 1, 1), end_date=date(2024, 12, 31))

    # 2. completed
    req_completed = SimulationRequest(
        farm=FarmInput(
            farm_id="ganja-demo",
            label="Ganja demo field",
            is_demo=True,
            location=base_location,
            area_ha=10.0,
            irrigation_type="rainfed",
            soil=SoilInput(ph=7.1, texture="loam", source_type="user_reported"),
            crop_history=[],
        ),
        climate_period=base_period,
        preferences=PreferenceWeights(water=0.5, soil=0.3, income=0.2),
        scenario=ScenarioInput(kind="baseline", rainfall_multiplier=1.0),
    )
    res_completed = run_simulation(
        req_completed, _synthetic_climate(), catalog, request_id="fixture-completed-001"
    )

    # 3. provisional_unknown_soil
    req_provisional = SimulationRequest(
        farm=FarmInput(
            farm_id="ganja-demo",
            label="Ganja demo field",
            is_demo=True,
            location=base_location,
            area_ha=10.0,
            irrigation_type="rainfed",
            soil=SoilInput(ph=None, texture="unknown", source_type="unknown"),
            crop_history=[],
        ),
        climate_period=base_period,
        preferences=PreferenceWeights(water=0.5, soil=0.3, income=0.2),
        scenario=ScenarioInput(kind="baseline", rainfall_multiplier=1.0),
    )
    res_provisional = run_simulation(
        req_provisional, _synthetic_climate(), catalog, request_id="fixture-provisional-001"
    )

    # 4. needs_data (only unavailable income objective weighted)
    req_needs_data = SimulationRequest(
        farm=FarmInput(
            farm_id="ganja-demo",
            label="Ganja demo field",
            is_demo=True,
            location=base_location,
            area_ha=10.0,
            irrigation_type="rainfed",
            soil=SoilInput(ph=7.1, texture="loam", source_type="user_reported"),
        ),
        climate_period=base_period,
        preferences=PreferenceWeights(water=0.0, soil=0.0, income=1.0),
        scenario=ScenarioInput(kind="baseline", rainfall_multiplier=1.0),
    )
    res_needs_data = run_simulation(
        req_needs_data, _synthetic_climate(), catalog, request_id="fixture-needs-data-001"
    )

    # 5. no_feasible_plan (severe 0.7x rainfed stress -> cereals drop below 450mm, legumes cannot repeat)
    req_no_plan = SimulationRequest(
        farm=FarmInput(
            farm_id="ganja-demo",
            label="Ganja demo field",
            is_demo=True,
            location=base_location,
            area_ha=10.0,
            irrigation_type="rainfed",
            soil=SoilInput(ph=7.1, texture="loam", source_type="user_reported"),
        ),
        climate_period=base_period,
        preferences=PreferenceWeights(water=0.6, soil=0.4, income=0.0),
        scenario=ScenarioInput(kind="rainfall_stress", rainfall_multiplier=0.7),
    )
    res_no_plan = run_simulation(
        req_no_plan, _synthetic_climate(), catalog, request_id="fixture-no-plan-001"
    )

    # 6. cached_response (explicitly synthetic UI cache-state fixture per API_CONTRACT.md)
    res_cached = run_simulation(
        req_completed,
        _synthetic_climate(data_mode="demo_fixture"),
        catalog,
        request_id="fixture-cached-ui-001",
    )
    res_cached.warnings.append(
        "SYNTHETIC CACHE UI FIXTURE (synthetic=true, data_mode=demo_fixture): simulates cached UI badge only."
    )

    # 7. validation_error
    err_fixture = ErrorEnvelope(
        error=ErrorBody(
            code="VALIDATION_ERROR",
            message="preferences must sum to 1.0 (±1e-6)",
            details=[ErrorDetail(field="preferences", reason="sum_mismatch")],
            retryable=False,
            request_id="fixture-validation-error-001",
        )
    )

    outputs = {
        "completed.json": res_completed.model_dump(mode="json"),
        "provisional_unknown_soil.json": res_provisional.model_dump(mode="json"),
        "needs_data.json": res_needs_data.model_dump(mode="json"),
        "no_feasible_plan.json": res_no_plan.model_dump(mode="json"),
        "cached_response.json": {
            "synthetic": True,
            "fixture_purpose": "UI cache-state contract fixture (not a real NASA download)",
            **res_cached.model_dump(mode="json"),
        },
        "validation_error.json": {
            "synthetic": True,
            **err_fixture.model_dump(mode="json"),
        },
    }

    for name, payload in outputs.items():
        (fixtures_dir / name).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"Generated {openapi_path} and {len(outputs)} synthetic fixtures in {fixtures_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
