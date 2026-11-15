"""FastAPI routes implementing frozen v0.1.0 Space Farm contract."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query, Request
from pydantic import ValidationError

from app.config import CONTRACT_VERSION, MODEL_VERSION, get_settings
from app.data_adapters.exceptions import InvalidDataQuery
from app.data_adapters.provider import (
    get_climate_features,
    get_climate_timeseries,
    get_crop_catalog,
)
from app.engine.planner import run_simulation
from app.schemas.models import (
    ClimateBundle,
    ClimateQuery,
    ClimateTimeseriesBundle,
    ClimateTimeseriesQuery,
    CropCatalog,
    DataMode,
    HealthResponse,
    SimulationRequest,
    SimulationResponse,
)

router = APIRouter(prefix="/api/v1", tags=["space-farm-v1"])


@router.get("/health", response_model=HealthResponse, summary="Service health and active versions")
def get_health() -> HealthResponse:
    settings = get_settings()
    catalog = get_crop_catalog(settings)
    return HealthResponse(
        status="ok",
        contract_version=CONTRACT_VERSION,
        model_version=MODEL_VERSION,
        rules_version=catalog.rules_version,
        catalog_version=catalog.catalog_version,
        data_mode_default=settings.data_mode,
    )


@router.get("/crops", response_model=CropCatalog, summary="List versioned candidate crops and agronomic rules")
def list_crops() -> CropCatalog:
    settings = get_settings()
    return get_crop_catalog(settings)


@router.get(
    "/climate/features",
    response_model=ClimateBundle,
    summary="Fetch verified NASA POWER climate features and provenance",
)
async def get_climate_features_route(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    start_date: date = Query(...),
    end_date: date = Query(...),
    time_standard: str = Query(default="UTC"),
    mode: DataMode | None = Query(default=None),
) -> ClimateBundle:
    settings = get_settings()
    try:
        query = ClimateQuery(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
            time_standard=time_standard,
        )
    except ValidationError as exc:
        err_msg = "; ".join(e.get("msg", "invalid query") for e in exc.errors())
        raise InvalidDataQuery(err_msg, field="query", reason="invalid_climate_query") from exc

    return await get_climate_features(query, mode_override=mode, settings=settings)


@router.get(
    "/climate/timeseries",
    response_model=ClimateTimeseriesBundle,
    summary="Fetch multi-year NASA POWER climate series, trends, and drought/frost/heat indicators",
)
async def get_climate_timeseries_route(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    start_date: date = Query(default=date(2015, 1, 1)),
    end_date: date = Query(default=date(2024, 12, 31)),
    time_standard: str = Query(default="UTC"),
    mode: DataMode | None = Query(default=None),
) -> ClimateTimeseriesBundle:
    settings = get_settings()
    try:
        query = ClimateTimeseriesQuery(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
            time_standard=time_standard,
        )
    except ValidationError as exc:
        err_msg = "; ".join(e.get("msg", "invalid query") for e in exc.errors())
        raise InvalidDataQuery(
            err_msg, field="query", reason="invalid_climate_timeseries_query"
        ) from exc

    return await get_climate_timeseries(query, mode_override=mode, settings=settings)


@router.post(
    "/simulations",
    response_model=SimulationResponse,
    summary="Evaluate 3-year crop rotation alternatives under climate & soil inputs",
)
async def create_simulation(
    payload: SimulationRequest,
    request: Request,
    mode: DataMode | None = Query(default=None),
) -> SimulationResponse:
    settings = get_settings()
    catalog = get_crop_catalog(settings)
    valid_crop_ids = {c.crop_id for c in catalog.crops}

    for entry in payload.farm.crop_history:
        if entry.crop_id not in valid_crop_ids:
            raise InvalidDataQuery(
                f"Unknown crop_id '{entry.crop_id}' in farm.crop_history; valid IDs: {sorted(valid_crop_ids)}",
                field="farm.crop_history",
                reason="unknown_crop_id",
            )

    query = ClimateQuery(
        latitude=payload.farm.location.latitude,
        longitude=payload.farm.location.longitude,
        start_date=payload.climate_period.start_date,
        end_date=payload.climate_period.end_date,
        time_standard="UTC",
    )
    climate = await get_climate_features(query, mode_override=mode, settings=settings)
    request_id = getattr(request.state, "request_id", None)
    return run_simulation(payload, climate, catalog, request_id=request_id)
