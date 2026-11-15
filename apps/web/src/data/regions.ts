import type {
  ClimateBundle,
  IrrigationType,
  ScenarioKind,
  SimulationRequest,
  SimulationResponse,
  SoilSourceType,
  SoilTexture,
} from "../api/types";

export interface LabSoilMetrics {
  organicMatterPct: number;
  nitrogenMgKg: number;
  phosphorusMgKg: number;
  potassiumMgKg: number;
  ecDsM: number;
  moistureCapacityPct: number;
}

export interface VerifiedRegionPreset {
  id: string;
  farmId: string;
  nameEn: string;
  nameAz: string;
  regionLabelEn: string;
  regionLabelAz: string;
  hasBoundary: boolean;
  latitude: number;
  longitude: number;
  areaHa: number;
  irrigationType: IrrigationType;
  irrigationBudgetMm: number | null;
  ph: number;
  texture: SoilTexture;
  soilSourceType: SoilSourceType;
  soilSourceRef: string;
  soilSampleDate: string;
  soilDepthTopCm: string;
  soilDepthBottomCm: string;
  labMetrics: LabSoilMetrics;
  priorCropId: string;
  snapshotNoteEn: string;
  snapshotNoteAz: string;
  /** Boundary polygon for highlighted primary regional pilot parcel. */
  illustrativePolygon?: Array<[number, number]>;
}

export const DEFAULT_CLIMATE_PERIOD = {
  start_date: "2024-01-01",
  end_date: "2024-12-31",
} as const;

export const REPO_GITHUB_URL = "https://github.com/spacefarmgov/space-farm";

export const VERIFIED_AZ_REGIONS: VerifiedRegionPreset[] = [
  {
    id: "ganja-dashkasan",
    farmId: "ganja-dashkasan",
    nameEn: "Ganja–Dashkasan field",
    nameAz: "Gəncə–Daşkəsən sahəsi",
    regionLabelEn: "Ganja–Dashkasan · Real NASA & Lab Profile (506.5 mm · pH 6.8)",
    regionLabelAz: "Gəncə–Daşkəsən · Real NASA & Lab Profili (506.5 mm · pH 6.8)",
    hasBoundary: true,
    latitude: 40.68,
    longitude: 46.36,
    areaHa: 28.4,
    irrigationType: "irrigated",
    irrigationBudgetMm: 240,
    ph: 6.8,
    texture: "loam",
    soilSourceType: "laboratory",
    soilSourceRef: "LAB-AZ-GD-2025",
    soilSampleDate: "2025-03-14",
    soilDepthTopCm: "0",
    soilDepthBottomCm: "30",
    labMetrics: {
      organicMatterPct: 2.4,
      nitrogenMgKg: 42.0,
      phosphorusMgKg: 28.5,
      potassiumMgKg: 245.0,
      ecDsM: 0.62,
      moistureCapacityPct: 31.0,
    },
    priorCropId: "wheat",
    snapshotNoteEn: "Primary region with real 2024 NASA POWER climate archive and verified Soil Lab profile.",
    snapshotNoteAz: "Real 2024 NASA POWER iqlim arxivi və laboratoriya torpaq analizi olan əsas bölgə.",
    illustrativePolygon: [
      [40.6822, 46.3568],
      [40.6828, 46.3629],
      [40.6782, 46.3641],
      [40.6775, 46.3581],
    ],
  },
  {
    id: "aran-barda",
    farmId: "az-aran-barda",
    nameEn: "Aran (Barda–Yevlakh)",
    nameAz: "Aran (Bərdə–Yevlax)",
    regionLabelEn: "Aran Plain · Real NASA & Lab Profile (457.5 mm · pH 7.3)",
    regionLabelAz: "Aran Düzənliyi · Real NASA & Lab Profili (457.5 mm · pH 7.3)",
    hasBoundary: false,
    latitude: 40.38,
    longitude: 47.12,
    areaHa: 35.0,
    irrigationType: "irrigated",
    irrigationBudgetMm: 420,
    ph: 7.3,
    texture: "loam",
    soilSourceType: "laboratory",
    soilSourceRef: "LAB-AZ-BR-2025",
    soilSampleDate: "2025-03-18",
    soilDepthTopCm: "0",
    soilDepthBottomCm: "30",
    labMetrics: {
      organicMatterPct: 1.9,
      nitrogenMgKg: 36.0,
      phosphorusMgKg: 24.0,
      potassiumMgKg: 268.0,
      ecDsM: 1.15,
      moistureCapacityPct: 28.5,
    },
    priorCropId: "wheat",
    snapshotNoteEn: "Verified semi-arid Aran lowland climate archive and Lab salinity/pH profile.",
    snapshotNoteAz: "Aran düzənliyi üçün təsdiqlənmiş iqlim arxivi və Lab pH/EC göstəriciləri.",
  },
  {
    id: "quba-khachmaz",
    farmId: "az-quba-khachmaz",
    nameEn: "Quba–Khachmaz",
    nameAz: "Quba–Xaçmaz",
    regionLabelEn: "Foothills · Real NASA & Lab Profile (516.2 mm · pH 6.4)",
    regionLabelAz: "Dağətəyi · Real NASA & Lab Profili (516.2 mm · pH 6.4)",
    hasBoundary: false,
    latitude: 41.36,
    longitude: 48.51,
    areaHa: 22.0,
    irrigationType: "irrigated",
    irrigationBudgetMm: 260,
    ph: 6.4,
    texture: "clay",
    soilSourceType: "laboratory",
    soilSourceRef: "LAB-AZ-QK-2025",
    soilSampleDate: "2025-03-21",
    soilDepthTopCm: "0",
    soilDepthBottomCm: "30",
    labMetrics: {
      organicMatterPct: 3.1,
      nitrogenMgKg: 48.0,
      phosphorusMgKg: 31.0,
      potassiumMgKg: 230.0,
      ecDsM: 0.48,
      moistureCapacityPct: 34.5,
    },
    priorCropId: "barley",
    snapshotNoteEn: "Verified climate series and fertile humus-rich Lab soil profile for northeastern foothills.",
    snapshotNoteAz: "Şimal-şərq dağətəyi zonası üçün iqlim seriyası və yüksək humuslu Lab torpaq profili.",
  },
  {
    id: "sheki-zaqatala",
    farmId: "az-sheki-zaqatala",
    nameEn: "Sheki–Zaqatala",
    nameAz: "Şəki–Zaqatala",
    regionLabelEn: "Northwest · Real NASA & Lab Profile (588.5 mm · pH 6.7)",
    regionLabelAz: "Şimal-qərb · Real NASA & Lab Profili (588.5 mm · pH 6.7)",
    hasBoundary: false,
    latitude: 41.19,
    longitude: 47.17,
    areaHa: 30.0,
    irrigationType: "rainfed",
    irrigationBudgetMm: null,
    ph: 6.7,
    texture: "loam",
    soilSourceType: "laboratory",
    soilSourceRef: "LAB-AZ-SZ-2025",
    soilSampleDate: "2025-03-25",
    soilDepthTopCm: "0",
    soilDepthBottomCm: "30",
    labMetrics: {
      organicMatterPct: 2.9,
      nitrogenMgKg: 45.0,
      phosphorusMgKg: 29.0,
      potassiumMgKg: 224.0,
      ecDsM: 0.52,
      moistureCapacityPct: 32.0,
    },
    priorCropId: "maize",
    snapshotNoteEn: "Verified precipitation-rich Greater Caucasus foothills climate and balanced Lab profile.",
    snapshotNoteAz: "Böyük Qafqaz ətəkləri üçün bol yağıntılı iqlim və balanslı Lab torpaq profili.",
  },
];

export interface MerraCellBounds {
  centerLat: number;
  centerLon: number;
  south: number;
  north: number;
  west: number;
  east: number;
}

export function getMerra2CellBounds(lat: number, lon: number): MerraCellBounds {
  const latStep = 0.5;
  const lonStep = 0.625;
  const centerLat = Math.round(lat / latStep) * latStep;
  const centerLon = Math.round(lon / lonStep) * lonStep;
  return {
    centerLat: Number(centerLat.toFixed(4)),
    centerLon: Number(centerLon.toFixed(4)),
    south: Math.max(-90, Number((centerLat - latStep / 2).toFixed(4))),
    north: Math.min(90, Number((centerLat + latStep / 2).toFixed(4))),
    west: Math.max(-180, Number((centerLon - lonStep / 2).toFixed(4))),
    east: Math.min(180, Number((centerLon + lonStep / 2).toFixed(4))),
  };
}

export interface FieldDraft {
  regionPresetId: string | null;
  farmId: string;
  label: string;
  hasBoundary: boolean;
  latitude: number;
  longitude: number;
  areaHa: number;
  irrigationType: IrrigationType;
  irrigationBudgetMm: number;
  soilPhKnown: boolean;
  soilPh: number;
  soilTexture: SoilTexture;
  soilSourceType: SoilSourceType;
  soilSourceRef: string;
  soilSampleDate: string;
  soilDepthTopCm: string;
  soilDepthBottomCm: string;
  labMetrics: LabSoilMetrics;
  priorCropId: string;
  priorCropYear: number;
}

export interface PriorityWeights {
  water: number;
  soil: number;
  income: number;
}

export function createDraftFromRegion(region: VerifiedRegionPreset): FieldDraft {
  return {
    regionPresetId: region.id,
    farmId: region.farmId,
    label: region.nameEn,
    hasBoundary: region.hasBoundary,
    latitude: region.latitude,
    longitude: region.longitude,
    areaHa: region.areaHa,
    irrigationType: region.irrigationType,
    irrigationBudgetMm: region.irrigationBudgetMm ?? 240,
    soilPhKnown: true,
    soilPh: region.ph,
    soilTexture: region.texture,
    soilSourceType: region.soilSourceType,
    soilSourceRef: region.soilSourceRef,
    soilSampleDate: region.soilSampleDate,
    soilDepthTopCm: region.soilDepthTopCm,
    soilDepthBottomCm: region.soilDepthBottomCm,
    labMetrics: { ...region.labMetrics },
    priorCropId: region.priorCropId,
    priorCropYear: 2024,
  };
}

export function normalizeWeightsForRequest(weights: PriorityWeights): PriorityWeights | null {
  const sum = weights.water + weights.soil + weights.income;
  if (!Number.isFinite(sum) || sum <= 0) return null;
  const w = Number((weights.water / sum).toFixed(4));
  const s = Number((weights.soil / sum).toFixed(4));
  const i = Number(Math.max(0, 1 - w - s).toFixed(4));
  return { water: w, soil: s, income: i };
}

/**
 * Largest-remainder integer rounding so displayed effective/requested weight percentages always total 100%.
 */
export function toNormalizedPercentages(weights: PriorityWeights): {
  water: number;
  soil: number;
  income: number;
} {
  const rawSum = weights.water + weights.soil + weights.income;
  if (!Number.isFinite(rawSum) || rawSum <= 0) {
    return { water: 50, soil: 30, income: 20 };
  }
  const keys = ["water", "soil", "income"] as const;
  const exact = keys.map((k) => Math.max(0, (weights[k] / rawSum) * 100));
  const floored = exact.map((v) => Math.floor(v));
  let remainder = 100 - floored.reduce((acc, v) => acc + v, 0);
  const order = keys
    .map((key, idx) => ({ idx, key, frac: exact[idx] - floored[idx] }))
    .sort((a, b) => (b.frac !== a.frac ? b.frac - a.frac : a.idx - b.idx));
  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floored[order[i].idx] += 1;
    remainder -= 1;
  }
  return {
    water: floored[0],
    soil: floored[1],
    income: floored[2],
  };
}

export function validateDraftForSimulation(
  draft: FieldDraft,
  weights: PriorityWeights,
): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!Number.isFinite(draft.latitude) || draft.latitude < -90 || draft.latitude > 90) {
    errs.latitude = "invalidLatitude";
  }
  if (!Number.isFinite(draft.longitude) || draft.longitude < -180 || draft.longitude > 180) {
    errs.longitude = "invalidLongitude";
  }
  if (!Number.isFinite(draft.areaHa) || draft.areaHa <= 0 || draft.areaHa > 100000) {
    errs.areaHa = "invalidArea";
  }
  if (draft.soilPhKnown && (!Number.isFinite(draft.soilPh) || draft.soilPh < 3.5 || draft.soilPh > 9.5)) {
    errs.soilPh = "invalidPh";
  }
  if (
    (draft.soilSourceType === "laboratory" || draft.soilSourceType === "modeled") &&
    draft.soilSourceRef.trim().length === 0
  ) {
    errs.soilSourceRef = "missingSourceRef";
  }
  const topStr = draft.soilDepthTopCm.trim();
  const botStr = draft.soilDepthBottomCm.trim();
  if (Boolean(topStr) !== Boolean(botStr)) {
    errs.depthCm = "invalidDepth";
  } else if (topStr && botStr) {
    const top = Number(topStr);
    const bot = Number(botStr);
    if (!Number.isFinite(top) || !Number.isFinite(bot) || bot <= top || top < 0) {
      errs.depthCm = "invalidDepth";
    }
  }
  if (
    draft.irrigationType === "irrigated" &&
    (!Number.isFinite(draft.irrigationBudgetMm) || draft.irrigationBudgetMm < 0 || draft.irrigationBudgetMm > 5000)
  ) {
    errs.irrigationBudget = "invalidBudget";
  }
  if (
    draft.priorCropId.trim().length > 0 &&
    (!Number.isInteger(draft.priorCropYear) || draft.priorCropYear < 1950 || draft.priorCropYear > 2100)
  ) {
    errs.priorCropYear = "invalidPriorYear";
  }
  if (!normalizeWeightsForRequest(weights)) {
    errs.weights = "zeroWeights";
  }
  return errs;
}

export function toSimulationRequest(
  draft: FieldDraft,
  weights: PriorityWeights,
  multiplier: 1.0 | 0.9 | 0.8 | 0.7 = 1.0,
  pinnedPlanId?: string | null,
): SimulationRequest {
  const normWeights = normalizeWeightsForRequest(weights) ?? { water: 0.5, soil: 0.3, income: 0.2 };
  const scenarioKind: ScenarioKind = multiplier === 1.0 ? "baseline" : "rainfall_stress";

  let depthCm: { top: number; bottom: number } | null = null;
  if (draft.soilDepthTopCm.trim() && draft.soilDepthBottomCm.trim()) {
    const top = Number(draft.soilDepthTopCm);
    const bottom = Number(draft.soilDepthBottomCm);
    if (Number.isFinite(top) && Number.isFinite(bottom) && bottom > top && top >= 0) {
      depthCm = { top, bottom };
    }
  }

  return {
    contract_version: "0.1.0",
    farm: {
      farm_id: draft.farmId.trim() || "custom-field",
      label: draft.label.trim() || "Field parcel",
      is_demo: false,
      location: {
        latitude: Number(draft.latitude.toFixed(4)),
        longitude: Number(draft.longitude.toFixed(4)),
        crs: "EPSG:4326",
      },
      area_ha: Number(draft.areaHa),
      irrigation_type: draft.irrigationType,
      irrigation_budget_mm_per_season:
        draft.irrigationType === "irrigated" ? Number(draft.irrigationBudgetMm) : null,
      soil: {
        ph: draft.soilPhKnown ? Number(draft.soilPh.toFixed(1)) : null,
        texture: draft.soilTexture,
        source_type: draft.soilSourceType,
        sample_date: draft.soilSampleDate.trim() ? draft.soilSampleDate.trim() : null,
        depth_cm: depthCm,
        source_ref: draft.soilSourceRef.trim() ? draft.soilSourceRef.trim() : null,
      },
      crop_history: draft.priorCropId
        ? [{ year: draft.priorCropYear, crop_id: draft.priorCropId }]
        : [],
    },
    climate_period: {
      start_date: DEFAULT_CLIMATE_PERIOD.start_date,
      end_date: DEFAULT_CLIMATE_PERIOD.end_date,
    },
    horizon_years: 3,
    preferences: normWeights,
    scenario: {
      kind: scenarioKind,
      rainfall_multiplier: multiplier,
    },
    max_plans: 3,
    ...(pinnedPlanId ? { pinned_plan_id: pinnedPlanId } : {}),
  };
}

export function getClimateFeatureValue(
  bundle: ClimateBundle | null | undefined,
  featureId: string,
): number | null {
  if (!bundle?.features) return null;
  const hit = bundle.features.find((f) => f.feature_id === featureId);
  return hit ? hit.value : null;
}

export function getClimateCoverageSummary(bundle: ClimateBundle | null | undefined): string {
  const first = bundle?.features?.[0];
  if (!first) return "—";
  const pct = Math.round(first.coverage_ratio * 100);
  return `${first.valid_days}/${first.expected_days}d (${pct}%)`;
}

export function extractGridElevation(bundle: ClimateBundle | null | undefined): string | null {
  const res = bundle?.sources?.[0]?.spatial_resolution;
  if (!res) return null;
  const txt = Object.values(res)[0];
  if (!txt) return null;
  const match = /elevation\s+([\d.]+\s*m)/i.exec(txt);
  return match ? match[1] : null;
}

/**
 * Compare two simulations for underlying climate observation equivalence.
 * Live NASA POWER responses include volatile `times.data` server latency bytes that change
 * `dataset_version` hashes across identical queries; compare coordinates, period, quality,
 * synthetic flag, and derived feature values/coverage instead.
 */
export function hasClimateContextMismatch(
  a: SimulationResponse | null | undefined,
  b: SimulationResponse | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.dataset_version === b.dataset_version) return false;
  if (a.synthetic !== b.synthetic) return true;
  if (a.climate.quality !== b.climate.quality) return true;

  const qa = a.climate.query;
  const qb = b.climate.query;
  if (
    Math.abs(qa.latitude - qb.latitude) > 1e-4 ||
    Math.abs(qa.longitude - qb.longitude) > 1e-4 ||
    qa.start_date !== qb.start_date ||
    qa.end_date !== qb.end_date ||
    qa.time_standard !== qb.time_standard
  ) {
    return true;
  }

  if (a.climate.features.length !== b.climate.features.length) return true;
  const bMap = new Map(b.climate.features.map((f) => [f.feature_id, f]));
  for (const fa of a.climate.features) {
    const fb = bMap.get(fa.feature_id);
    if (!fb) return true;
    if (
      fa.value !== fb.value ||
      fa.valid_days !== fb.valid_days ||
      fa.expected_days !== fb.expected_days
    ) {
      return true;
    }
  }
  return false;
}

