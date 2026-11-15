"""Frozen v0.1.0 Pydantic DTOs and validation models for Space Farm."""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CONTRACT_VERSION = "0.1.0"

DataMode = Literal["live", "cached", "demo_fixture"]
IrrigationType = Literal["rainfed", "irrigated", "unknown"]
SoilTexture = Literal["unknown", "sand", "loam", "clay", "other"]
SoilSourceType = Literal["laboratory", "user_reported", "modeled", "unknown"]
ScenarioKind = Literal["baseline", "rainfall_stress"]
ClimateQuality = Literal["complete", "partial", "insufficient"]
SimulationStatus = Literal["completed", "provisional", "needs_data", "no_feasible_plan"]
UncertaintyLevel = Literal["low", "medium", "high"]
ValidationStatus = Literal["source_supported", "expert_reviewed", "provisional"]
ConstraintResult = Literal["pass", "unknown"]
SourceKind = Literal["upstream_dataset", "user_input", "agronomic_reference"]


class StrictModel(BaseModel):
    """Base model forbidding NaN/Infinity and unknown fields on requests."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class OutputModel(BaseModel):
    """Base model forbidding NaN/Infinity on serialized outputs."""

    model_config = ConfigDict(allow_inf_nan=False)


def _ensure_finite(value: float, field_name: str) -> float:
    if not math.isfinite(value):
        raise ValueError(f"{field_name} must be a finite number")
    return value


# ---------------------------------------------------------------------------
# Health & Errors
# ---------------------------------------------------------------------------


class HealthResponse(OutputModel):
    status: Literal["ok"] = "ok"
    contract_version: str = CONTRACT_VERSION
    model_version: str
    rules_version: str
    catalog_version: str
    data_mode_default: DataMode


class ErrorDetail(OutputModel):
    field: str
    reason: str


class ErrorBody(OutputModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)
    retryable: bool = False
    request_id: str


class ErrorEnvelope(OutputModel):
    error: ErrorBody


# ---------------------------------------------------------------------------
# Crop Catalog & Agronomic Rules (C -> B interface & /api/v1/crops)
# ---------------------------------------------------------------------------


class SeasonWindow(OutputModel):
    planting_window: str | None = None
    harvest_window: str | None = None
    cycle_days_min: int | None = None
    cycle_days_max: int | None = None
    region_note: str | None = None


class PhRange(OutputModel):
    min_ph: float = Field(ge=0.0, le=14.0)
    max_ph: float = Field(ge=0.0, le=14.0)
    optimal_min_ph: float | None = Field(default=None, ge=0.0, le=14.0)
    optimal_max_ph: float | None = Field(default=None, ge=0.0, le=14.0)


class WaterBand(OutputModel):
    min_mm: float = Field(ge=0.0)
    max_mm: float = Field(ge=0.0)
    optimal_min_mm: float | None = Field(default=None, ge=0.0)
    optimal_max_mm: float | None = Field(default=None, ge=0.0)


class PredecessorRule(OutputModel):
    avoid_consecutive_same_crop: bool = True
    avoid_consecutive_same_family: bool = True
    nitrogen_contribution: Literal["fixes_nitrogen", "neutral", "heavy_feeder"] = "neutral"
    preferred_predecessor_families: list[str] = Field(default_factory=list)
    disallowed_predecessor_crops: list[str] = Field(default_factory=list)


class ObjectiveInputs(OutputModel):
    water_efficiency_hint: float | None = Field(default=None, ge=0.0, le=1.0)
    soil_health_contribution: float | None = Field(default=None, ge=0.0, le=1.0)
    income_model_available: bool = False
    income_unavailable_reason: str = "no_verified_regional_price_cost_model"


class AgronomicReference(OutputModel):
    rule_id: str
    source_name: str
    source_url: str
    citation: str
    checked_at: str


class CropInfo(OutputModel):
    crop_id: str
    name: str
    family: str
    season_windows: SeasonWindow
    soil_ph_range: PhRange | None = None
    water_band_mm: WaterBand | None = None
    predecessor_rules: PredecessorRule
    objective_inputs: ObjectiveInputs
    references: list[AgronomicReference] = Field(default_factory=list)
    validation_status: ValidationStatus


class AgronomicRule(OutputModel):
    rule_id: str
    rule_type: Literal["hard_constraint", "soft_scoring", "provisional_notice"]
    crop_ids: list[str] = Field(default_factory=list)
    families: list[str] = Field(default_factory=list)
    condition: str
    severity: Literal["hard", "warning", "info"]
    threshold: float | list[float] | str | None = None
    unit: str | None = None
    region: str
    applicability: str
    source_url: str
    checked_at: str
    validation_status: ValidationStatus


class CropCatalog(OutputModel):
    catalog_version: str
    rules_version: str
    crops: list[CropInfo]
    rules: list[AgronomicRule] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Climate Provider Models (C -> B interface & /api/v1/climate/features)
# ---------------------------------------------------------------------------


class ClimateQuery(StrictModel):
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    start_date: date
    end_date: date
    time_standard: str = "UTC"

    @field_validator("latitude", "longitude")
    @classmethod
    def _check_finite_coords(cls, value: float, info) -> float:
        return _ensure_finite(value, info.field_name)

    @model_validator(mode="after")
    def _validate_period_and_standard(self) -> ClimateQuery:
        if self.start_date > self.end_date:
            raise ValueError("start_date must be <= end_date")
        if self.start_date.year != self.end_date.year:
            raise ValueError("v0.1.0 supports climate queries within a single calendar year")
        if self.time_standard != "UTC":
            raise ValueError("v0.1.0 requires time_standard='UTC' (mixed standards rejected)")
        return self


class ClimateTimeseriesQuery(StrictModel):
    """Multi-year historical NASA POWER query (1-15 years, UTC) for trend & risk analysis."""

    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    start_date: date
    end_date: date
    time_standard: str = "UTC"

    @field_validator("latitude", "longitude")
    @classmethod
    def _check_finite_ts_coords(cls, value: float, info) -> float:
        return _ensure_finite(value, info.field_name)

    @model_validator(mode="after")
    def _validate_span_and_standard(self) -> ClimateTimeseriesQuery:
        if self.start_date > self.end_date:
            raise ValueError("start_date must be <= end_date")
        if (self.end_date.year - self.start_date.year) > 15:
            raise ValueError("climate timeseries queries support at most a 16-year span")
        if self.time_standard != "UTC":
            raise ValueError("climate timeseries requires time_standard='UTC'")
        return self


class AnnualClimateSummary(OutputModel):
    year: int = Field(ge=1950, le=2100)
    mean_temp_c: float | None = None
    min_temp_c: float | None = None
    max_temp_c: float | None = None
    total_precip_mm: float | None = None
    frost_days: int = Field(ge=0)
    heat_stress_days: int = Field(ge=0)
    wet_days: int = Field(ge=0)
    max_dry_spell_days: int = Field(ge=0)
    coverage_ratio: float = Field(ge=0.0, le=1.0)
    valid_days: int = Field(ge=0)
    expected_days: int = Field(ge=1)


class MonthlyClimatePoint(OutputModel):
    month: int = Field(ge=1, le=12)
    label: str
    mean_temp_c: float | None = None
    total_precip_mm: float | None = None
    frost_days: int = Field(ge=0)
    heat_stress_days: int = Field(ge=0)
    wet_days: int = Field(ge=0)


class ClimateTrendSummary(OutputModel):
    temp_shift_c_per_decade: float | None = None
    precip_trend_pct_per_decade: float | None = None
    multiyear_mean_temp_c: float | None = None
    multiyear_mean_precip_mm: float | None = None
    driest_year: int | None = None
    wettest_year: int | None = None
    hottest_year: int | None = None
    max_dry_spell_days_overall: int = Field(ge=0)
    drought_risk_level: Literal["low", "moderate", "elevated", "unknown"] = "unknown"


class ClimateFeature(OutputModel):
    feature_id: str
    value: float | None = None
    unit: str
    period_start: date
    period_end: date
    aggregation: Literal["mean", "sum", "count", "min", "max"]
    source_ids: list[str] = Field(default_factory=list)
    parameter_codes: list[str] = Field(default_factory=list)
    coverage_ratio: float = Field(ge=0.0, le=1.0)
    valid_days: int = Field(ge=0)
    expected_days: int = Field(ge=1)
    quality_flags: list[str] = Field(default_factory=list)
    reason: str | None = None
    method_version: str


class SourceRecord(OutputModel):
    id: str
    provider: str
    dataset: str
    source_url: str
    request_url: str
    retrieved_at: datetime
    observation_start: date
    observation_end: date
    time_standard: str
    parameter_codes: list[str]
    units: dict[str, str]
    spatial_resolution: dict[str, str]
    payload_sha256: str
    source_kind: SourceKind


class ClimateBundle(OutputModel):
    contract_version: str = CONTRACT_VERSION
    query: ClimateQuery
    data_mode: DataMode
    dataset_version: str
    features: list[ClimateFeature]
    sources: list[SourceRecord]
    quality: ClimateQuality
    warnings: list[str] = Field(default_factory=list)
    synthetic: bool = False


class ClimateTimeseriesBundle(OutputModel):
    contract_version: str = CONTRACT_VERSION
    query: ClimateTimeseriesQuery
    data_mode: DataMode
    dataset_version: str
    annual_series: list[AnnualClimateSummary] = Field(default_factory=list)
    focus_year: int = Field(ge=1950, le=2100)
    focus_monthly_series: list[MonthlyClimatePoint] = Field(default_factory=list)
    trend: ClimateTrendSummary
    sources: list[SourceRecord] = Field(default_factory=list)
    quality: ClimateQuality
    warnings: list[str] = Field(default_factory=list)
    synthetic: bool = False


# ---------------------------------------------------------------------------
# Simulation Request & Response (/api/v1/simulations)
# ---------------------------------------------------------------------------


class GeoPoint(StrictModel):
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    crs: Literal["EPSG:4326"] = "EPSG:4326"


class DepthInterval(StrictModel):
    top: float = Field(ge=0.0)
    bottom: float = Field(gt=0.0)

    @model_validator(mode="after")
    def _validate_interval(self) -> DepthInterval:
        if self.top >= self.bottom:
            raise ValueError("depth_cm.top must be strictly less than depth_cm.bottom")
        return self


class SoilInput(StrictModel):
    ph: float | None = Field(default=None, ge=0.0, le=14.0)
    texture: SoilTexture = "unknown"
    source_type: SoilSourceType = "unknown"
    sample_date: date | None = None
    depth_cm: DepthInterval | None = None
    source_ref: str | None = None

    @model_validator(mode="after")
    def _validate_source_ref(self) -> SoilInput:
        if self.source_type in {"laboratory", "modeled"} and not (self.source_ref or "").strip():
            raise ValueError(
                "soil.source_ref must not be empty when soil.source_type is 'laboratory' or 'modeled'"
            )
        return self


class CropHistoryEntry(StrictModel):
    year: int = Field(ge=1950, le=2100)
    crop_id: str = Field(min_length=1)


class FarmInput(StrictModel):
    farm_id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=200)
    is_demo: bool = False
    location: GeoPoint
    area_ha: float = Field(gt=0.0, le=100000.0)
    irrigation_type: IrrigationType = "unknown"
    irrigation_budget_mm_per_season: float | None = Field(default=None, ge=0.0, le=5000.0)
    soil: SoilInput = Field(default_factory=SoilInput)
    crop_history: list[CropHistoryEntry] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_irrigation_consistency(self) -> FarmInput:
        if (
            self.irrigation_type == "rainfed"
            and self.irrigation_budget_mm_per_season is not None
            and self.irrigation_budget_mm_per_season > 0
        ):
            raise ValueError(
                "irrigation_budget_mm_per_season must be null or 0 when irrigation_type is 'rainfed'"
            )
        return self


class DatePeriod(StrictModel):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _validate_dates(self) -> DatePeriod:
        if self.start_date > self.end_date:
            raise ValueError("climate_period.start_date must be <= end_date")
        if self.start_date.year != self.end_date.year:
            raise ValueError("v0.1.0 climate_period must stay within one calendar year")
        return self


class PreferenceWeights(StrictModel):
    water: float = Field(ge=0.0, le=1.0)
    soil: float = Field(ge=0.0, le=1.0)
    income: float = Field(ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _validate_sum(self) -> PreferenceWeights:
        total = self.water + self.soil + self.income
        if total <= 0.0:
            raise ValueError("preferences cannot all be 0")
        if abs(total - 1.0) > 1e-6:
            raise ValueError("preferences must sum to 1.0 (±1e-6)")
        return self


class ScenarioInput(StrictModel):
    kind: ScenarioKind = "baseline"
    rainfall_multiplier: float = 1.0

    @model_validator(mode="after")
    def _validate_scenario(self) -> ScenarioInput:
        if self.kind == "baseline":
            if abs(self.rainfall_multiplier - 1.0) > 1e-9:
                raise ValueError("baseline scenario requires rainfall_multiplier == 1.0")
        elif self.kind == "rainfall_stress":
            allowed = (0.7, 0.8, 0.9)
            if not any(abs(self.rainfall_multiplier - val) < 1e-9 for val in allowed):
                raise ValueError(
                    "rainfall_stress scenario requires rainfall_multiplier to be one of 0.7, 0.8, 0.9"
                )
        return self


class SimulationRequest(StrictModel):
    contract_version: Literal["0.1.0"] = CONTRACT_VERSION
    farm: FarmInput
    climate_period: DatePeriod
    horizon_years: Literal[3] = 3
    preferences: PreferenceWeights
    scenario: ScenarioInput = Field(default_factory=ScenarioInput)
    max_plans: int = Field(default=3, ge=1, le=3)
    pinned_plan_id: str | None = None


class PlanAgronomicIndicators(OutputModel):
    water_demand_mm_avg: float = Field(ge=0.0)
    nitrogen_fixation_score: float = Field(ge=0.0, le=1.0)
    erosion_protection_score: float = Field(ge=0.0, le=1.0)
    bare_soil_gap_months_3yr: int = Field(ge=0, le=36)
    climate_resilience_score: float = Field(ge=0.0, le=1.0)


class EffectiveWeights(OutputModel):
    water: float = Field(ge=0.0, le=1.0)
    soil: float = Field(ge=0.0, le=1.0)
    income: float = Field(ge=0.0, le=1.0)


class UnavailableObjective(OutputModel):
    objective: Literal["water", "soil", "income"]
    reason: str


class InputSummary(OutputModel):
    farm_id: str
    climate_period: DatePeriod
    horizon_years: Literal[3] = 3
    scenario: ScenarioInput
    effective_precipitation_mm: float | None = None
    effective_water_supply_mm: float | None = None
    soil_ph_known: bool
    irrigation_type: IrrigationType


class RotationYear(OutputModel):
    year_index: Literal[1, 2, 3]
    crop_id: str
    crop_name: str
    family: str
    planting_window: str | None = None
    harvest_window: str | None = None


class ScoreComponent(OutputModel):
    value: float | None = Field(default=None, ge=0.0, le=1.0)
    reason: str
    source_ids: list[str] = Field(default_factory=list)
    rule_ids: list[str] = Field(default_factory=list)


class PlanExplanation(OutputModel):
    code: str
    text: str
    feature_ids: list[str] = Field(default_factory=list)
    rule_ids: list[str] = Field(default_factory=list)
    source_ids: list[str] = Field(default_factory=list)


class ConstraintCheckResult(OutputModel):
    rule_id: str
    result: ConstraintResult
    reason: str


class RotationPlan(OutputModel):
    plan_id: str
    years: list[RotationYear] = Field(min_length=3, max_length=3)
    score: float | None = Field(default=None, ge=0.0, le=100.0)
    score_components: dict[Literal["water", "soil", "income"], ScoreComponent]
    explanations: list[PlanExplanation] = Field(default_factory=list)
    constraints_checked: list[ConstraintCheckResult] = Field(default_factory=list)
    uncertainty: UncertaintyLevel
    scenario_label: Literal["baseline", "hypothetical_rainfall_stress"]
    indicators: PlanAgronomicIndicators | None = None
    benefits: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    feasible: bool = True
    failed_rules: list[str] = Field(default_factory=list)


class RejectedSummaryItem(OutputModel):
    rule_id: str
    count: int = Field(ge=1)
    reason: str


class SimulationResponse(OutputModel):
    contract_version: str = CONTRACT_VERSION
    request_id: str
    simulation_id: str
    created_at: datetime
    model_version: str
    rules_version: str
    catalog_version: str
    dataset_version: str
    status: SimulationStatus
    data_mode: DataMode
    input_summary: InputSummary
    weights_requested: PreferenceWeights
    weights_effective: EffectiveWeights
    unavailable_objectives: list[UnavailableObjective] = Field(default_factory=list)
    plans: list[RotationPlan] = Field(default_factory=list, max_length=3)
    baseline_practice_plan: RotationPlan | None = None
    pinned_plan_evaluation: RotationPlan | None = None
    climate: ClimateBundle
    warnings: list[str] = Field(default_factory=list)
    rejected_summary: list[RejectedSummaryItem] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    synthetic: bool = False
