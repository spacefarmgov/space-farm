import type {
  AnnualClimateSummary,
  ClimateBundle,
  ClimateTimeseriesBundle,
  ClimateTrendSummary,
  MonthlyClimatePoint,
  PlanAgronomicIndicators,
  CropCatalog,
  CropInfo,
  DataMode,
  ErrorEnvelope,
  HealthResponse,
  RotationPlan,
  ScenarioKind,
  SimulationRequest,
  SimulationResponse,
  SimulationStatus,
  SourceRecord,
  ValidationStatus,
} from "./types";

export type {
  AnnualClimateSummary,
  ClimateBundle,
  ClimateTimeseriesBundle,
  ClimateTrendSummary,
  MonthlyClimatePoint,
  PlanAgronomicIndicators,
  CropCatalog,
  CropInfo,
  DataMode,
  ErrorEnvelope,
  HealthResponse,
  RotationPlan,
  ScenarioKind,
  SimulationRequest,
  SimulationResponse,
  SimulationStatus,
  SourceRecord,
  ValidationStatus,
};

export interface AgronomicReference {
  rule_id: string;
  source_name: string;
  source_url: string;
  citation: string;
  checked_at: string;
}

export interface AgronomicRule {
  rule_id: string;
  rule_type: string;
  crop_ids: string[];
  families: string[];
  condition: string;
  severity: string;
  threshold: string;
  unit: string;
  region: string;
  applicability: string;
  source_url: string;
  checked_at: string;
  validation_status: ValidationStatus;
}

export interface ExtendedCropInfo extends CropInfo {
  references?: AgronomicReference[];
  predecessor_rules?: {
    avoid_consecutive_same_crop: boolean;
    avoid_consecutive_same_family: boolean;
    nitrogen_contribution: string;
    preferred_predecessor_families: string[];
    disallowed_predecessor_crops: string[];
  };
}

export interface ExtendedCropCatalog extends Omit<CropCatalog, "crops"> {
  crops: ExtendedCropInfo[];
  rules?: AgronomicRule[];
}
