/** Frozen v0.1.0 API Contract TypeScript definitions for Space Farm Frontend (Role A). */

export type DataMode = "live" | "cached" | "demo_fixture";
export type IrrigationType = "rainfed" | "irrigated" | "unknown";
export type SoilTexture = "unknown" | "sand" | "loam" | "clay" | "other";
export type SoilSourceType = "laboratory" | "user_reported" | "modeled" | "unknown";
export type ScenarioKind = "baseline" | "rainfall_stress";
export type ClimateQuality = "complete" | "partial" | "insufficient";
export type SimulationStatus = "completed" | "provisional" | "needs_data" | "no_feasible_plan";
export type UncertaintyLevel = "low" | "medium" | "high";
export type ValidationStatus = "source_supported" | "expert_reviewed" | "provisional";

export interface ErrorDetail {
  field: string;
  reason: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: ErrorDetail[];
    retryable: boolean;
    request_id: string;
  };
}

export interface HealthResponse {
  status: "ok";
  contract_version: string;
  model_version: string;
  rules_version: string;
  catalog_version: string;
  data_mode_default: DataMode;
}

export interface CropInfo {
  crop_id: string;
  name: string;
  family: string;
  season_windows: {
    planting_window: string | null;
    harvest_window: string | null;
    cycle_days_min: number | null;
    cycle_days_max: number | null;
    region_note: string | null;
  };
  soil_ph_range: {
    min_ph: number;
    max_ph: number;
    optimal_min_ph: number | null;
    optimal_max_ph: number | null;
  } | null;
  water_band_mm: {
    min_mm: number;
    max_mm: number;
    optimal_min_mm: number | null;
    optimal_max_mm: number | null;
  } | null;
  validation_status: ValidationStatus;
}

export interface CropCatalog {
  catalog_version: string;
  rules_version: string;
  crops: CropInfo[];
}

export interface ClimateFeature {
  feature_id: string;
  value: number | null;
  unit: string;
  period_start: string;
  period_end: string;
  aggregation: "mean" | "sum" | "count" | "min" | "max";
  source_ids: string[];
  parameter_codes: string[];
  coverage_ratio: number;
  valid_days: number;
  expected_days: number;
  quality_flags: string[];
  reason: string | null;
  method_version: string;
}

export interface SourceRecord {
  id: string;
  provider: string;
  dataset: string;
  source_url: string;
  request_url: string;
  retrieved_at: string;
  observation_start: string;
  observation_end: string;
  time_standard: string;
  parameter_codes: string[];
  units: Record<string, string>;
  spatial_resolution: Record<string, string>;
  payload_sha256: string;
  source_kind: "upstream_dataset" | "user_input" | "agronomic_reference";
}

export interface ClimateBundle {
  contract_version: string;
  query: {
    latitude: number;
    longitude: number;
    start_date: string;
    end_date: string;
    time_standard: string;
  };
  data_mode: DataMode;
  dataset_version: string;
  features: ClimateFeature[];
  sources: SourceRecord[];
  quality: ClimateQuality;
  warnings: string[];
  synthetic: boolean;
}

export interface SimulationRequest {
  contract_version: "0.1.0";
  farm: {
    farm_id: string;
    label: string;
    is_demo: boolean;
    location: {
      latitude: number;
      longitude: number;
      crs: "EPSG:4326";
    };
    area_ha: number;
    irrigation_type: IrrigationType;
    irrigation_budget_mm_per_season: number | null;
    soil: {
      ph: number | null;
      texture: SoilTexture;
      source_type: SoilSourceType;
      sample_date: string | null;
      depth_cm: { top: number; bottom: number } | null;
      source_ref: string | null;
    };
    crop_history: Array<{ year: number; crop_id: string }>;
  };
  climate_period: {
    start_date: string;
    end_date: string;
  };
  horizon_years: 3;
  preferences: {
    water: number;
    soil: number;
    income: number;
  };
  scenario: {
    kind: ScenarioKind;
    rainfall_multiplier: number;
  };
  max_plans: 1 | 2 | 3;
}

export interface ScoreComponent {
  value: number | null;
  reason: string;
  source_ids: string[];
  rule_ids: string[];
}

export interface RotationPlan {
  plan_id: string;
  years: Array<{
    year_index: 1 | 2 | 3;
    crop_id: string;
    crop_name: string;
    family: string;
    planting_window: string | null;
    harvest_window: string | null;
  }>;
  score: number | null;
  score_components: {
    water: ScoreComponent;
    soil: ScoreComponent;
    income: ScoreComponent;
  };
  explanations: Array<{
    code: string;
    text: string;
    feature_ids: string[];
    rule_ids: string[];
    source_ids: string[];
  }>;
  constraints_checked: Array<{
    rule_id: string;
    result: "pass" | "unknown";
    reason: string;
  }>;
  uncertainty: UncertaintyLevel;
  scenario_label: "baseline" | "hypothetical_rainfall_stress";
}

export interface SimulationResponse {
  contract_version: string;
  request_id: string;
  simulation_id: string;
  created_at: string;
  model_version: string;
  rules_version: string;
  catalog_version: string;
  dataset_version: string;
  status: SimulationStatus;
  data_mode: DataMode;
  input_summary: {
    farm_id: string;
    climate_period: { start_date: string; end_date: string };
    horizon_years: 3;
    scenario: { kind: ScenarioKind; rainfall_multiplier: number };
    effective_precipitation_mm: number | null;
    effective_water_supply_mm: number | null;
    soil_ph_known: boolean;
    irrigation_type: IrrigationType;
  };
  weights_requested: { water: number; soil: number; income: number };
  weights_effective: { water: number; soil: number; income: number };
  unavailable_objectives: Array<{ objective: "water" | "soil" | "income"; reason: string }>;
  plans: RotationPlan[];
  climate: ClimateBundle;
  warnings: string[];
  rejected_summary: Array<{ rule_id: string; count: number; reason: string }>;
  limitations: string[];
  synthetic: boolean;
}
