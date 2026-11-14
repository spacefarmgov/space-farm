import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SpaceFarmApiError,
  getClimateFeatures,
  getCrops,
  getHealth,
  runSimulation,
} from "./api/client";
import type {
  ClimateBundle,
  CropCatalog,
  DataMode,
  HealthResponse,
  IrrigationType,
  RotationPlan,
  SimulationRequest,
  SimulationResponse,
  SoilTexture,
} from "./api/types";
import {
  AZERBAIJAN_REGIONS,
  CROP_VISUALS,
  NASA_SUBMISSION_CITATION_AZ,
  NASA_SUBMISSION_CITATION_EN,
  type Language,
  type RegionPreset,
  type ScreenId,
} from "./data/orbitalData";
import "./styles/orbital.css";

const SCREEN_META: Array<{
  id: ScreenId;
  num: string;
  navGroup: "overview" | "explore" | "plan" | "sources";
  icon: string;
  titleEn: string;
  titleAz: string;
}> = [
  {
    id: "01-home",
    num: "01",
    navGroup: "overview",
    icon: "🛰",
    titleEn: "01. HOME — FROM ORBIT TO EARTH",
    titleAz: "01. ANA SƏHİFƏ — ORBİTDƏN YERƏ",
  },
  {
    id: "02-explorer",
    num: "02",
    navGroup: "explore",
    icon: "🌍",
    titleEn: "02. ORBITAL EXPLORER",
    titleAz: "02. ORBİTAL KƏŞFİYYATÇI",
  },
  {
    id: "03-field",
    num: "03",
    navGroup: "explore",
    icon: "🗺",
    titleEn: "03. FIELD INTELLIGENCE",
    titleAz: "03. SAHƏ KƏŞFİYYATI",
  },
  {
    id: "04-climate",
    num: "04",
    navGroup: "explore",
    icon: "📈",
    titleEn: "04. CLIMATE HISTORY",
    titleAz: "04. İQLİM TARİXÇƏSİ",
  },
  {
    id: "05-rotation",
    num: "05",
    navGroup: "plan",
    icon: "🌱",
    titleEn: "05. ROTATION STUDIO",
    titleAz: "05. NÖVBƏLİ ƏKİN STUDİYASI",
  },
  {
    id: "06-scenario",
    num: "06",
    navGroup: "plan",
    icon: "🧪",
    titleEn: "06. SCENARIO LAB",
    titleAz: "06. SSENARİ LABORATORİYASI",
  },
  {
    id: "07-sources",
    num: "07",
    navGroup: "sources",
    icon: "📚",
    titleEn: "07. SOURCES & EXPLANATIONS",
    titleAz: "07. MƏNBƏLƏR VƏ İZAHATLAR",
  },
];

function findFeature(bundle: ClimateBundle | null | undefined, id: string): number | null {
  if (!bundle) return null;
  const f = bundle.features.find((item) => item.feature_id === id);
  return f ? f.value : null;
}

export function App() {
  const [lang, setLang] = useState<Language>("en");
  const [activeScreen, setActiveScreen] = useState<ScreenId>("01-home");
  const [boardMode, setBoardMode] = useState<boolean>(false);

  // Selected Azerbaijan Region & Coordinates
  const [selectedRegionId, setSelectedRegionId] = useState<string>("ganja");
  const selectedRegion: RegionPreset = useMemo(
    () => AZERBAIJAN_REGIONS.find((r) => r.id === selectedRegionId) ?? AZERBAIJAN_REGIONS[0],
    [selectedRegionId]
  );

  const [customLat, setCustomLat] = useState<number>(selectedRegion.latitude);
  const [customLon, setCustomLon] = useState<number>(selectedRegion.longitude);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mapLayer, setMapLayer] = useState<"satellite" | "climate" | "fields">("satellite");

  // Field Intelligence Inputs (03)
  const [areaHa, setAreaHa] = useState<number>(selectedRegion.defaultAreaHa);
  const [soilPhKnown, setSoilPhKnown] = useState<boolean>(false); // T13: default unknown!
  const [soilPhValue, setSoilPhValue] = useState<number>(7.1);
  const [soilTexture, setSoilTexture] = useState<SoilTexture>("unknown");
  const [irrigationType, setIrrigationType] = useState<IrrigationType>("rainfed");
  const [irrigationBudgetMm, setIrrigationBudgetMm] = useState<number>(180);
  const [priorCrop2022, setPriorCrop2022] = useState<string>("");
  const [priorCrop2023, setPriorCrop2023] = useState<string>("wheat");
  const [boundaryScale, setBoundaryScale] = useState<number>(1.0);

  // Climate History Tab (04)
  const [climateChartTab, setClimateChartTab] = useState<"temperature" | "rainfall">("temperature");
  const [hoverMonthIdx, setHoverMonthIdx] = useState<number | null>(6);

  // Rotation Studio Priorities (05)
  const [rawWaterPref, setRawWaterPref] = useState<number>(50);
  const [rawSoilPref, setRawSoilPref] = useState<number>(30);
  const [rawIncomePref, setRawIncomePref] = useState<number>(20);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(0);
  const [whyPlanOpen, setWhyPlanOpen] = useState<boolean>(true);

  // Scenario Lab (06)
  const [rainfallMultiplier, setRainfallMultiplier] = useState<1.0 | 0.9 | 0.8 | 0.7>(0.8);
  const [applyStressInStudio, setApplyStressInStudio] = useState<boolean>(false);

  // Sources & Explanations (07)
  const [openAccordion, setOpenAccordion] = useState<"nasa" | "soil" | "rules" | null>("nasa");
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);
  const [copiedCitation, setCopiedCitation] = useState<boolean>(false);

  // Backend Data States
  const [dataModePref, setDataModePref] = useState<DataMode>("cached");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [catalog, setCatalog] = useState<CropCatalog | null>(null);
  const [climateBundle, setClimateBundle] = useState<ClimateBundle | null>(null);
  const [baselineSim, setBaselineSim] = useState<SimulationResponse | null>(null);
  const [stressSim, setStressSim] = useState<SimulationResponse | null>(null);
  const [loadingSim, setLoadingSim] = useState<boolean>(false);
  const [apiError, setApiError] = useState<{
    message: string;
    code?: string;
    requestId?: string;
    retryable?: boolean;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Sync coordinates & default area when user picks one of the 4 verified Azerbaijan regions
  const handleSelectRegion = useCallback((region: RegionPreset) => {
    setSelectedRegionId(region.id);
    setCustomLat(region.latitude);
    setCustomLon(region.longitude);
    setAreaHa(region.defaultAreaHa);
    setSelectedPlanIndex(0);
  }, []);

  // Normalized preferences summing exactly to 1.0 (±1e-6)
  const normalizedPreferences = useMemo(() => {
    const sum = rawWaterPref + rawSoilPref + rawIncomePref;
    if (sum <= 0) {
      return { water: 0.5, soil: 0.5, income: 0.0 };
    }
    const w = Number((rawWaterPref / sum).toFixed(4));
    const s = Number((rawSoilPref / sum).toFixed(4));
    const i = Number(Math.max(0, 1 - w - s).toFixed(4));
    return { water: w, soil: s, income: i };
  }, [rawWaterPref, rawSoilPref, rawIncomePref]);

  // Build crop history list
  const cropHistory = useMemo(() => {
    const items: Array<{ year: number; crop_id: string }> = [];
    if (priorCrop2022) items.push({ year: 2022, crop_id: priorCrop2022 });
    if (priorCrop2023) items.push({ year: 2023, crop_id: priorCrop2023 });
    return items;
  }, [priorCrop2022, priorCrop2023]);

  // Initial load: Health & Crop Catalog
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([getHealth(ctrl.signal), getCrops(ctrl.signal)])
      .then(([h, c]) => {
        setHealth(h);
        setCatalog(c);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => ctrl.abort();
  }, []);

  // Build base simulation request
  const buildSimRequest = useCallback(
    (mult: 1.0 | 0.9 | 0.8 | 0.7): SimulationRequest => ({
      contract_version: "0.1.0",
      farm: {
        farm_id: selectedRegion.farmId,
        label: lang === "az" ? selectedRegion.nameAz : selectedRegion.nameEn,
        is_demo: true,
        location: {
          latitude: Number(customLat),
          longitude: Number(customLon),
          crs: "EPSG:4326",
        },
        area_ha: Math.max(0.5, Number((areaHa * boundaryScale).toFixed(1))),
        irrigation_type: irrigationType,
        irrigation_budget_mm_per_season:
          irrigationType === "irrigated" ? Number(irrigationBudgetMm) : null,
        soil: {
          ph: soilPhKnown ? Number(soilPhValue) : null,
          texture: soilTexture,
          source_type: soilPhKnown ? "user_reported" : "unknown",
          sample_date: null,
          depth_cm: null,
          source_ref: null,
        },
        crop_history: cropHistory,
      },
      climate_period: {
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      },
      horizon_years: 3,
      preferences: normalizedPreferences,
      scenario: {
        kind: mult === 1.0 ? "baseline" : "rainfall_stress",
        rainfall_multiplier: mult,
      },
      max_plans: 3,
    }),
    [
      selectedRegion,
      lang,
      customLat,
      customLon,
      areaHa,
      boundaryScale,
      irrigationType,
      irrigationBudgetMm,
      soilPhKnown,
      soilPhValue,
      soilTexture,
      cropHistory,
      normalizedPreferences,
    ]
  );

  // Execute live backend simulation (Baseline + Scenario Stress) with AbortController (T18)
  const triggerSimulations = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingSim(true);
    setApiError(null);

    const baseReq = buildSimRequest(1.0);
    const stressReq = buildSimRequest(rainfallMultiplier);

    Promise.all([
      getClimateFeatures(
        {
          latitude: baseReq.farm.location.latitude,
          longitude: baseReq.farm.location.longitude,
          start_date: "2024-01-01",
          end_date: "2024-12-31",
          time_standard: "UTC",
          mode: dataModePref,
        },
        ctrl.signal
      ),
      runSimulation(baseReq, ctrl.signal, dataModePref),
      rainfallMultiplier === 1.0
        ? Promise.resolve(null)
        : runSimulation(stressReq, ctrl.signal, dataModePref),
    ])
      .then(([clim, baseRes, stressRes]) => {
        setClimateBundle(clim);
        setBaselineSim(baseRes);
        setStressSim(stressRes ?? baseRes);
        setLoadingSim(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadingSim(false);
        if (err instanceof SpaceFarmApiError) {
          setApiError({
            message: err.message,
            code: err.envelope?.error.code,
            requestId: err.envelope?.error.request_id,
            retryable: err.envelope?.error.retryable,
          });
        } else {
          setApiError({
            message: err instanceof Error ? err.message : "Network error connecting to Space Farm API",
            retryable: true,
          });
        }
      });
  }, [buildSimRequest, rainfallMultiplier, dataModePref]);

  useEffect(() => {
    triggerSimulations();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [triggerSimulations]);

  // Active simulation displayed in 05. Rotation Studio & 07. Sources
  const activeSim: SimulationResponse | null = useMemo(() => {
    if (applyStressInStudio && stressSim) return stressSim;
    return baselineSim;
  }, [applyStressInStudio, stressSim, baselineSim]);

  const activePlans: RotationPlan[] = activeSim?.plans ?? [];
  const selectedPlan: RotationPlan | null =
    activePlans[selectedPlanIndex] ?? activePlans[0] ?? null;

  // Derived climate metrics
  const meanTemp = findFeature(climateBundle, "mean_temperature") ?? selectedRegion.meanTempC;
  const minTemp = findFeature(climateBundle, "min_temperature") ?? selectedRegion.minTempC;
  const maxTemp = findFeature(climateBundle, "max_temperature") ?? selectedRegion.maxTempC;
  const totalPrecip =
    findFeature(climateBundle, "total_precipitation_mm") ?? selectedRegion.annualPrecipMm;
  const frostDays = findFeature(climateBundle, "frost_days_count") ?? selectedRegion.frostDays;
  const wetDays = findFeature(climateBundle, "wet_days_count") ?? selectedRegion.wetDays;
  const sourceRecord = climateBundle?.sources?.[0] ?? null;

  const filteredRegions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return AZERBAIJAN_REGIONS;
    return AZERBAIJAN_REGIONS.filter(
      (r) =>
        r.nameEn.toLowerCase().includes(q) ||
        r.nameAz.toLowerCase().includes(q) ||
        r.zoneEn.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const getCropLabel = (cropId: string) => {
    const meta = CROP_VISUALS[cropId];
    if (!meta) return cropId;
    return lang === "az" ? meta.nameAz : meta.nameEn;
  };

  // -------------------------------------------------------------------------
  // Render Individual Screens (01 .. 07)
  // -------------------------------------------------------------------------

  const renderScreen01Home = () => (
    <section className="orbital-frame">
      <div className="screen-step-bar">
        <span className="screen-step-tag">
          🛰 {lang === "az" ? "01. ANA SƏHİFƏ — ORBİTDƏN YERƏ" : "01. HOME — FROM ORBIT TO EARTH"}
        </span>
        <span className="badge badge-violet">
          NASA Space Apps 2026 • Field Shift: Adapting Farms with NASA Data
        </span>
      </div>

      <div className="grid-2col" style={{ alignItems: "center" }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.3rem 0.75rem",
              borderRadius: 999,
              background: "rgba(139, 92, 246, 0.16)",
              border: "1px solid rgba(168, 85, 247, 0.4)",
              fontSize: "0.78rem",
              color: "#ddd6fe",
              marginBottom: "1rem",
            }}
          >
            <span>🛰</span>
            <span>
              {lang === "az"
                ? "NASA LaRC POWER (MERRA-2 0.5° × 0.625°) + FAO Paper 56"
                : "NASA LaRC POWER (MERRA-2 0.5° × 0.625°) + FAO Paper 56"}
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(2.2rem, 4vw, 3.45rem)",
              lineHeight: 1.08,
              margin: "0 0 1rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {lang === "az" ? (
              <>
                Əkinçiliyə yeni{" "}
                <span
                  style={{
                    background: "linear-gradient(90deg, #c084fc, #38bdf8)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  orbital baxış.
                </span>
              </>
            ) : (
              <>
                A new perspective{" "}
                <span
                  style={{
                    background: "linear-gradient(90deg, #c084fc, #38bdf8)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  on farming.
                </span>
              </>
            )}
          </h1>

          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "1.04rem",
              lineHeight: 1.6,
              maxWidth: 540,
              marginBottom: "1.6rem",
            }}
          >
            {lang === "az"
              ? "Peyk müşahidələri, real NASA POWER iqlim analitikası və deterministik 3-illik növbəli əkin planlaması ilə Yerdəki sahələriniz üçün elmi cəhətdən dürüst qərarlar verin."
              : "Satellite data, climate insights and rotation planning to make better, scientifically honest decisions for your fields on Earth."}
          </p>

          <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
            <button
              type="button"
              className="btn-orbital-primary"
              onClick={() => setActiveScreen("02-explorer")}
            >
              {lang === "az" ? "Sahəni kəşf et →" : "Explore your field →"}
            </button>
            <button
              type="button"
              className="btn-orbital-secondary"
              onClick={() => {
                handleSelectRegion(AZERBAIJAN_REGIONS[0]);
                setActiveScreen("05-rotation");
              }}
            >
              ▶ {lang === "az" ? "Gəncə Demosuna Bax" : "View Ganja Demo"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
            }}
          >
            <div className="orbital-card" style={{ padding: "0.85rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {lang === "az" ? "DOĞRULANMIŞ REGİONLAR" : "VERIFIED REGIONS"}
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#c084fc" }}>4 Zones</div>
              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>
                Gəncə • Aran • Quba • Şəki
              </div>
            </div>
            <div className="orbital-card" style={{ padding: "0.85rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {lang === "az" ? "NASA POWER COVERAGE" : "NASA POWER COVERAGE"}
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#38bdf8" }}>366/366</div>
              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>
                2024 UTC • SHA-256 Sealed
              </div>
            </div>
            <div className="orbital-card" style={{ padding: "0.85rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {lang === "az" ? "AQRONOMİK MÜHƏRRİK" : "AGRONOMIC ENGINE"}
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#10b981" }}>
                6 Crops / 7 Rules
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>
                FAO Paper 56 • 3-Yr Horizon
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Orbital Earth & Satellite Telemetry Visual */}
        <div
          style={{
            position: "relative",
            minHeight: 370,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            viewBox="0 0 460 380"
            style={{ width: "100%", maxWidth: 460, height: "auto", overflow: "visible" }}
          >
            <defs>
              <radialGradient id="earthAtmosphere" cx="55%" cy="55%" r="52%">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#0f172a" stopOpacity="0.98" />
                <stop offset="82%" stopColor="#7c3aed" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="orbitArc" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Outer Orbital Ring */}
            <ellipse
              cx="260"
              cy="205"
              rx="195"
              ry="92"
              fill="none"
              stroke="url(#orbitArc)"
              strokeWidth="1.8"
              strokeDasharray="6 6"
              transform="rotate(-22 260 205)"
            />

            {/* Glowing Earth Globe */}
            <circle cx="275" cy="215" r="142" fill="url(#earthAtmosphere)" />
            <circle
              cx="275"
              cy="215"
              r="138"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeOpacity="0.45"
            />

            {/* Stylized Continents & Caucasus / Caspian highlight */}
            <path
              d="M210,135 Q255,115 310,140 T365,205 Q340,260 280,275 T195,220 Z"
              fill="rgba(16, 185, 129, 0.22)"
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth="1.2"
            />

            {/* Active Target Beacon on Azerbaijan (Ganja/Caucasus) */}
            <circle cx="272" cy="178" r="18" fill="rgba(168, 85, 247, 0.25)" />
            <circle cx="272" cy="178" r="9" fill="rgba(168, 85, 247, 0.55)" />
            <circle cx="272" cy="178" r="4.5" fill="#ffffff" />

            {/* Telemetry Laser Beam from Satellite to Azerbaijan */}
            <line
              x1="122"
              y1="78"
              x2="272"
              y2="178"
              stroke="#c084fc"
              strokeWidth="1.8"
              strokeDasharray="4 4"
            />

            {/* Satellite Icon */}
            <g transform="translate(88, 48) rotate(-18)">
              <rect
                x="0"
                y="12"
                width="26"
                height="12"
                rx="2"
                fill="#38bdf8"
                stroke="#e0f2fe"
                strokeWidth="1"
              />
              <rect
                x="30"
                y="8"
                width="20"
                height="20"
                rx="4"
                fill="#a855f7"
                stroke="#f3e8ff"
                strokeWidth="1.5"
              />
              <rect
                x="54"
                y="12"
                width="26"
                height="12"
                rx="2"
                fill="#38bdf8"
                stroke="#e0f2fe"
                strokeWidth="1"
              />
              <line x1="40" y1="28" x2="40" y2="38" stroke="#f8fafc" strokeWidth="2" />
              <circle cx="40" cy="40" r="3" fill="#38bdf8" />
            </g>

            {/* Telemetry Callout Box */}
            <g transform="translate(150, 200)">
              <rect
                x="0"
                y="0"
                width="215"
                height="66"
                rx="10"
                fill="rgba(9, 11, 26, 0.9)"
                stroke="rgba(168, 85, 247, 0.7)"
              />
              <text x="12" y="21" fill="#c084fc" fontSize="11" fontWeight="700">
                TARGET: {selectedRegion.nameEn.toUpperCase()}
              </text>
              <text x="12" y="39" fill="#e2e8f0" fontSize="11">
                {customLat.toFixed(3)}° N, {customLon.toFixed(3)}° E • {totalPrecip.toFixed(1)} mm
              </text>
              <text x="12" y="55" fill="#6ee7b7" fontSize="10" fontFamily="monospace">
                SHA256: {(sourceRecord?.payload_sha256 ?? selectedRegion.payloadSha256).slice(0, 18)}…
              </text>
            </g>
          </svg>
        </div>
      </div>
    </section>
  );

  const renderScreen02Explorer = () => (
    <section className="orbital-frame">
      <div className="screen-step-bar">
        <div>
          <span className="screen-step-tag">
            🌍 {lang === "az" ? "02. ORBİTAL KƏŞFİYYATÇI" : "02. ORBITAL EXPLORER"}
          </span>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>
            {lang === "az" ? "Orbital Kəşfiyyatçı" : "Orbital Explorer"}
          </h2>
          <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {lang === "az"
              ? "Yer kürəsini araşdırın, Azərbaycan aqrar zonasını tapın və sahənizi seçin."
              : "Browse the Earth, find your area, and select a field."}
          </p>
        </div>

        {/* Layer Switcher matching screen 02 */}
        <div className="orbital-card" style={{ padding: "0.55rem 0.9rem", display: "flex", gap: "0.85rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
            {lang === "az" ? "Laylar:" : "Layers:"}
          </span>
          {(["satellite", "climate", "fields"] as const).map((layer) => (
            <label
              key={layer}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.82rem",
                cursor: "pointer",
                color: mapLayer === layer ? "#c084fc" : "var(--text-secondary)",
                fontWeight: mapLayer === layer ? 700 : 500,
              }}
            >
              <input
                type="radio"
                name="orbital-layer"
                checked={mapLayer === layer}
                onChange={() => setMapLayer(layer)}
              />
              {layer === "satellite"
                ? lang === "az"
                  ? "Peyk"
                  : "Satellite"
                : layer === "climate"
                ? lang === "az"
                  ? "İqlim (Yağıntı)"
                  : "Climate"
                : lang === "az"
                ? "Sahələr"
                : "Fields"}
            </label>
          ))}
        </div>
      </div>

      <div className="grid-explorer">
        {/* Left Search & Coordinate Control Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <div className="orbital-card">
            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              {lang === "az" ? "Məkan və ya sahə axtar..." : "Search place or field..."}
            </label>
            <input
              type="text"
              className="orbital-input"
              placeholder={lang === "az" ? "Gəncə, Aran, Quba, Şəki..." : "Ganja, Aran, Quba, Sheki..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {filteredRegions.map((reg) => {
                const isSelected = reg.id === selectedRegion.id;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => handleSelectRegion(reg)}
                    style={{
                      textAlign: "left",
                      padding: "0.7rem 0.85rem",
                      borderRadius: 12,
                      border: isSelected
                        ? "1px solid #c084fc"
                        : "1px solid rgba(148, 163, 184, 0.18)",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(124, 58, 237, 0.32), rgba(30, 27, 75, 0.85))"
                        : "rgba(15, 23, 42, 0.65)",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.88rem" }}>
                        📍 {lang === "az" ? reg.nameAz : reg.nameEn}
                      </strong>
                      <span className="badge badge-violet">{reg.annualPrecipMm.toFixed(0)} mm</span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
                      {reg.latitude.toFixed(3)}° N, {reg.longitude.toFixed(3)}° E • T2M {reg.meanTempC.toFixed(1)}°C
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="orbital-card">
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              {lang === "az" ? "SEÇİLMİŞ KOORDİNATLAR (WGS84)" : "SELECTED COORDINATES (WGS84)"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Latitude (°N)</label>
                <input
                  type="number"
                  step="0.01"
                  className="orbital-input"
                  value={customLat}
                  onChange={(e) => setCustomLat(Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Longitude (°E)</label>
                <input
                  type="number"
                  step="0.01"
                  className="orbital-input"
                  value={customLon}
                  onChange={(e) => setCustomLon(Number(e.target.value))}
                />
              </div>
            </div>
            <div style={{ marginTop: "0.65rem", fontSize: "0.76rem", color: "#c4b5fd" }}>
              MERRA-2 Grid Elevation: <strong>{selectedRegion.elevationM.toFixed(1)} m</strong>
            </div>
          </div>
        </div>

        {/* Right Interactive Azerbaijan Satellite Map Canvas */}
        <div
          className="orbital-card glow"
          style={{
            position: "relative",
            minHeight: 420,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background:
              mapLayer === "climate"
                ? "radial-gradient(circle at 46% 35%, rgba(56, 189, 248, 0.28), rgba(15, 23, 42, 0.95))"
                : "radial-gradient(circle at 50% 45%, rgba(22, 42, 34, 0.72), rgba(9, 12, 26, 0.96))",
          }}
        >
          <svg viewBox="0 0 700 400" style={{ width: "100%", height: "auto", maxHeight: 350 }}>
            <defs>
              <filter id="violetGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Coordinate Grid Lines */}
            {[80, 160, 240, 320].map((y) => (
              <line
                key={`lat-${y}`}
                x1="0"
                y1={y}
                x2="700"
                y2={y}
                stroke="rgba(148, 163, 184, 0.1)"
                strokeDasharray="4 4"
              />
            ))}
            {[140, 280, 420, 560].map((x) => (
              <line
                key={`lon-${x}`}
                x1={x}
                y1="0"
                x2={x}
                y2="400"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeDasharray="4 4"
              />
            ))}

            {/* Caspian Sea on East */}
            <path
              d="M525,10 Q560,110 545,195 Q610,210 560,255 Q525,310 535,390 L700,390 L700,10 Z"
              fill="rgba(14, 116, 144, 0.26)"
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth="1.5"
            />
            <text x="605" y="195" fill="rgba(125, 211, 252, 0.55)" fontSize="12" letterSpacing="2">
              CASPIAN SEA
            </text>

            {/* Neighboring Country Labels matching Screen 02 */}
            <text x="235" y="52" fill="rgba(148, 163, 184, 0.65)" fontSize="11" fontWeight="700" letterSpacing="1.5">
              GEORGIA
            </text>
            <text x="95" y="235" fill="rgba(148, 163, 184, 0.65)" fontSize="11" fontWeight="700" letterSpacing="1.5">
              ARMENIA
            </text>
            <text x="315" y="365" fill="rgba(148, 163, 184, 0.65)" fontSize="11" fontWeight="700" letterSpacing="1.5">
              IRAN
            </text>

            {/* Glowing Azerbaijan Border Polygon matching Screen 02 */}
            <path
              d="M165,135 L255,95 L325,72 L370,108 L455,68 L538,145 L575,195 L535,235 L515,325 L435,345 L370,295 L285,318 L210,275 L155,215 Z"
              fill={
                mapLayer === "climate"
                  ? "rgba(56, 189, 248, 0.18)"
                  : "rgba(139, 92, 246, 0.16)"
              }
              stroke="#a855f7"
              strokeWidth="3"
              filter="url(#violetGlow)"
            />

            <text
              x="315"
              y="185"
              fill="#ffffff"
              fontSize="15"
              fontWeight="800"
              letterSpacing="3"
              opacity="0.9"
            >
              AZERBAIJAN
            </text>

            {/* Interactive Pins for all 4 Real NASA POWER Regions */}
            {AZERBAIJAN_REGIONS.map((reg) => {
              const cx = (reg.mapX / 100) * 700;
              const cy = (reg.mapY / 100) * 400;
              const isSelected = reg.id === selectedRegion.id;
              return (
                <g
                  key={reg.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSelectRegion(reg)}
                >
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="24"
                      fill="rgba(168, 85, 247, 0.28)"
                      stroke="#c084fc"
                      strokeWidth="1.5"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 9 : 6}
                    fill={isSelected ? "#a855f7" : "#38bdf8"}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <g transform={`translate(${cx - 58}, ${cy + 15})`}>
                    <rect
                      x="0"
                      y="0"
                      width="126"
                      height="24"
                      rx="12"
                      fill={isSelected ? "#7c3aed" : "rgba(15, 23, 42, 0.88)"}
                      stroke={isSelected ? "#e9d5ff" : "rgba(148, 163, 184, 0.4)"}
                    />
                    <text
                      x="63"
                      y="16"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10.5"
                      fontWeight="700"
                    >
                      {lang === "az" ? reg.nameAz : reg.nameEn}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Bottom Timeline & Action Bar matching Screen 02 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--border-subtle)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
              <span className="badge badge-violet">⏱ Jan 2024 — Dec 2024 (366/366 UTC Days)</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                NASA POWER Daily Point • MERRA-2 0.5° × 0.625°
              </span>
            </div>
            <button
              type="button"
              className="btn-orbital-primary"
              onClick={() => setActiveScreen("03-field")}
            >
              {lang === "az" ? "Sahəni seç →" : "Select field →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  const renderScreen03Field = () => {
    const scaledPoints = selectedRegion.polygonPoints
      .map((pt) => {
        const cx = 50 + (pt.x - 50) * boundaryScale;
        const cy = 50 + (pt.y - 50) * boundaryScale;
        return `${cx * 6},${cy * 3.6}`;
      })
      .join(" ");

    return (
      <section className="orbital-frame">
        <div className="screen-step-bar">
          <div>
            <span className="screen-step-tag">
              🗺 {lang === "az" ? "03. SAHƏ KƏŞFİYYATI" : "03. FIELD INTELLIGENCE"}
            </span>
            <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>
              {lang === "az" ? "Sahə Kəşfiyyatı" : "Field Intelligence"}
            </h2>
            <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {lang === "az"
                ? "Sahə sərhədini yoxlayın, torpaq və suvarma parametrlərini daxil edin."
                : "Inspect your field, review context and key inputs."}
            </p>
          </div>
          <span className="badge badge-violet">
            {lang === "az" ? selectedRegion.nameAz : selectedRegion.nameEn} •{" "}
            {(areaHa * boundaryScale).toFixed(1)} ha
          </span>
        </div>

        <div className="grid-field-intel">
          {/* Left Satellite Parcel Canvas with glowing purple polygon matching Screen 03 */}
          <div
            className="orbital-card glow"
            style={{
              position: "relative",
              background:
                "linear-gradient(135deg, rgba(28, 45, 32, 0.85) 0%, rgba(19, 32, 24, 0.92) 50%, rgba(15, 23, 42, 0.95) 100%)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <svg viewBox="0 0 600 360" style={{ width: "100%", height: "auto", borderRadius: 12 }}>
              {/* Agricultural Parcel Texture Lines */}
              {[40, 90, 140, 190, 240, 290].map((y, idx) => (
                <line
                  key={`furrow-${idx}`}
                  x1="0"
                  y1={y}
                  x2="600"
                  y2={y + 45}
                  stroke="rgba(163, 230, 53, 0.14)"
                  strokeWidth="12"
                />
              ))}
              {[80, 180, 290, 410, 510].map((x, idx) => (
                <line
                  key={`road-${idx}`}
                  x1={x}
                  y1="0"
                  x2={x - 60}
                  y2="360"
                  stroke="rgba(250, 204, 21, 0.12)"
                  strokeWidth="3"
                />
              ))}

              {/* Glowing Purple Parcel Polygon */}
              <polygon
                points={scaledPoints}
                fill="rgba(168, 85, 247, 0.28)"
                stroke="#c084fc"
                strokeWidth="3.5"
              />

              {/* Polygon Corner Handles */}
              {selectedRegion.polygonPoints.map((pt, i) => {
                const cx = (50 + (pt.x - 50) * boundaryScale) * 6;
                const cy = (50 + (pt.y - 50) * boundaryScale) * 3.6;
                return (
                  <circle
                    key={`vertex-${i}`}
                    cx={cx}
                    cy={cy}
                    r="6"
                    fill="#ffffff"
                    stroke="#7c3aed"
                    strokeWidth="3"
                  />
                );
              })}

              {/* Center Parcel Readout */}
              <text
                x="300"
                y="180"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="15"
                fontWeight="800"
              >
                {lang === "az" ? selectedRegion.nameAz : selectedRegion.nameEn}
              </text>
              <text x="300" y="202" textAnchor="middle" fill="#e9d5ff" fontSize="12" fontWeight="600">
                {(areaHa * boundaryScale).toFixed(1)} ha • {customLat.toFixed(3)}° N, {customLon.toFixed(3)}° E
              </text>
            </svg>

            {/* Scale Bar & Boundary Zoom Controls */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.75rem",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span>0</span>
                <div
                  style={{
                    width: 90,
                    height: 6,
                    background: "linear-gradient(90deg, #fff 50%, #64748b 50%)",
                    borderRadius: 3,
                  }}
                />
                <span>250 m / 500 m</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>{lang === "az" ? "Sərhəd miqyası:" : "Edit boundary scale:"}</span>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={boundaryScale}
                  onChange={(e) => setBoundaryScale(Number(e.target.value))}
                  style={{ width: 95 }}
                />
              </div>
            </div>
          </div>

          {/* Right Field Profile & Honest Soil/Irrigation Inputs Card matching Screen 03 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div className="orbital-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge badge-violet">Field profile</span>
                <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>EPSG:4326</span>
              </div>
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem", fontSize: "0.86rem" }}>
                <div>
                  🌱 <strong>{lang === "az" ? selectedRegion.nameAz : selectedRegion.nameEn}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>📐 {lang === "az" ? "Sahə (ha):" : "Area (ha):"}</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    step="0.5"
                    className="orbital-input"
                    style={{ width: 95, padding: "0.3rem 0.5rem" }}
                    value={areaHa}
                    onChange={(e) => setAreaHa(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div>
                  📍 {customLat.toFixed(3)}° N, {customLon.toFixed(3)}° E
                </div>
              </div>
            </div>

            {/* Soil Inputs (T13: Unknown by default, never secretly 7.0!) */}
            <div className="orbital-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem" }}>
                  {lang === "az" ? "Torpaq girişləri (Soil inputs)" : "Soil inputs"}
                </strong>
                {!soilPhKnown ? (
                  <span className="badge badge-amber">Soil pH: Unknown</span>
                ) : (
                  <span className="badge badge-emerald">pH: {soilPhValue.toFixed(1)}</span>
                )}
              </div>

              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.65rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    {lang === "az" ? "Torpaq pH məlumdurmu?" : "Is Soil pH measured?"}
                  </label>
                  <button
                    type="button"
                    className="btn-orbital-secondary"
                    style={{ padding: "0.3rem 0.7rem", fontSize: "0.76rem" }}
                    onClick={() => setSoilPhKnown((prev) => !prev)}
                  >
                    {soilPhKnown
                      ? lang === "az"
                        ? "Naməlum (Unknown) et"
                        : "Set Unknown"
                      : lang === "az"
                      ? "pH Daxil Et"
                      : "Enter pH Value"}
                  </button>
                </div>

                {soilPhKnown && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                      <span>Soil pH (4.5 – 9.0)</span>
                      <strong>{soilPhValue.toFixed(1)}</strong>
                    </div>
                    <input
                      type="range"
                      min="4.5"
                      max="9.0"
                      step="0.1"
                      className="orbital-slider"
                      value={soilPhValue}
                      onChange={(e) => setSoilPhValue(Number(e.target.value))}
                    />
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      {lang === "az" ? "Torpaq teksturası" : "Soil texture"}
                    </label>
                    <select
                      className="orbital-select"
                      value={soilTexture}
                      onChange={(e) => setSoilTexture(e.target.value as SoilTexture)}
                    >
                      <option value="unknown">Unknown (—)</option>
                      <option value="loam">Loam (Gillicə)</option>
                      <option value="clay">Clay (Gilli)</option>
                      <option value="sand">Sand (Qumlu)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      {lang === "az" ? "Əvvəlki bitki (2023)" : "Prior crop (2023)"}
                    </label>
                    <select
                      className="orbital-select"
                      value={priorCrop2023}
                      onChange={(e) => setPriorCrop2023(e.target.value)}
                    >
                      <option value="">None (Boş)</option>
                      <option value="wheat">🌾 Wheat (Buğda)</option>
                      <option value="barley">🌿 Barley (Arpa)</option>
                      <option value="chickpea">🫘 Chickpea (Noxud)</option>
                      <option value="lentil">🟢 Lentil (Mərcimək)</option>
                      <option value="sunflower">🌻 Sunflower (Günəbaxan)</option>
                      <option value="maize">🌽 Maize (Qarğıdalı)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Irrigation Card */}
            <div className="orbital-card">
              <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.5rem" }}>
                {lang === "az" ? "Suvarma (Irrigation)" : "Irrigation"}
              </strong>
              <select
                className="orbital-select"
                value={irrigationType}
                onChange={(e) => setIrrigationType(e.target.value as IrrigationType)}
              >
                <option value="rainfed">Rainfed (Dəmyə — yalnız NASA yağıntısı)</option>
                <option value="irrigated">Irrigated (Suvarılan + əlavə mm büdcə)</option>
                <option value="unknown">Unknown (Qeyd edilməyib — Provisional)</option>
              </select>

              {irrigationType === "irrigated" && (
                <div style={{ marginTop: "0.65rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                    <span>{lang === "az" ? "Mövsümi suvarma büdcəsi:" : "Seasonal irrigation budget:"}</span>
                    <strong style={{ color: "#38bdf8" }}>+{irrigationBudgetMm} mm</strong>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="450"
                    step="10"
                    className="orbital-slider"
                    value={irrigationBudgetMm}
                    onChange={(e) => setIrrigationBudgetMm(Number(e.target.value))}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.9rem" }}>
                <button
                  type="button"
                  className="btn-orbital-secondary"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setActiveScreen("04-climate")}
                >
                  {lang === "az" ? "İqlim Tarixçəsi" : "Climate History"}
                </button>
                <button
                  type="button"
                  className="btn-orbital-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setActiveScreen("05-rotation")}
                >
                  {lang === "az" ? "Planları müqayisə et →" : "Compare plans →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderScreen04Climate = () => {
    const months = selectedRegion.monthly2024;
    const hovered = months[hoverMonthIdx ?? 6] ?? months[6];

    // Build smooth SVG path for Temperature or Rainfall
    const chartWidth = 680;
    const chartHeight = 210;
    const padX = 42;
    const padY = 24;
    const usableW = chartWidth - padX * 2;
    const usableH = chartHeight - padY * 2;

    const points = months.map((m, idx) => {
      const x = padX + (idx / 11) * usableW;
      const val = climateChartTab === "temperature" ? m.t2m : m.precip;
      const minVal = climateChartTab === "temperature" ? -12 : 0;
      const maxVal = climateChartTab === "temperature" ? 40 : 125;
      const norm = (val - minVal) / (maxVal - minVal);
      const y = padY + usableH - norm * usableH;
      return { x, y, m, val };
    });

    const linePath = points
      .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${
      padY + usableH
    } L${points[0].x.toFixed(1)},${padY + usableH} Z`;

    return (
      <section className="orbital-frame">
        <div className="screen-step-bar">
          <div>
            <span className="screen-step-tag">
              📈 {lang === "az" ? "04. İQLİM TARİXÇƏSİ" : "04. CLIMATE HISTORY"}
            </span>
            <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>
              {lang === "az" ? "İqlim Tarixçəsi" : "Climate history"}
            </h2>
            <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {lang === "az"
                ? "Seçilmiş ərazi üçün tarixi NASA POWER temperatur və yağıntı müşahidələrini araşdırın."
                : "Explore historical temperature and rainfall for your area."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge badge-cyan">
              Data mode: {(climateBundle?.data_mode ?? "cached").toUpperCase()}
            </span>
            <span className="badge badge-emerald">Coverage: 366/366 UTC Days (100%)</span>
          </div>
        </div>

        {/* NASA POWER Source Header Card matching Screen 04 */}
        <div
          className="orbital-card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 64,
                height: 48,
                borderRadius: 10,
                background: "linear-gradient(135deg, #1e3a8a, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                border: "1px solid #c084fc",
              }}
            >
              🛰
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Data source</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>NASA POWER (LaRC API v2.10.3)</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Satellite-based meteorological and solar data (historical MERRA-2 0.5° × 0.625°)
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className={
                climateChartTab === "temperature" ? "btn-orbital-primary" : "btn-orbital-secondary"
              }
              onClick={() => setClimateChartTab("temperature")}
            >
              🌡 {lang === "az" ? "Temperatur (°C)" : "Temperature"}
            </button>
            <button
              type="button"
              className={
                climateChartTab === "rainfall" ? "btn-orbital-primary" : "btn-orbital-secondary"
              }
              onClick={() => setClimateChartTab("rainfall")}
            >
              🌧 {lang === "az" ? "Yağıntı (mm)" : "Rainfall"}
            </button>
          </div>
        </div>

        {/* Interactive Wave Chart matching Screen 04 */}
        <div className="orbital-card glow" style={{ padding: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.65rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <strong style={{ fontSize: "0.95rem" }}>
              {climateChartTab === "temperature"
                ? lang === "az"
                  ? `Temperatur (°C) — ${selectedRegion.nameAz} (2024 Gündəlik/Aylıq Aqreqat)`
                  : `Temperature (°C) — ${selectedRegion.nameEn} (2024 Verified NASA POWER)`
                : lang === "az"
                ? `Yağıntı PRECTOTCORR (mm) — ${selectedRegion.nameAz} (Cəmi ${totalPrecip.toFixed(2)} mm)`
                : `Precipitation PRECTOTCORR (mm) — ${selectedRegion.nameEn} (Total ${totalPrecip.toFixed(2)} mm)`}
            </strong>
            <span style={{ fontSize: "0.82rem", color: "#c4b5fd" }}>
              {lang === "az" ? hovered.monthLabelAz : hovered.monthLabelEn} 2024: T2M{" "}
              <strong>{hovered.t2m}°C</strong> (min {hovered.tmin}°C / max {hovered.tmax}°C) •{" "}
              Precip <strong>{hovered.precip} mm</strong>
            </span>
          </div>

          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", height: "auto" }}>
            <defs>
              <linearGradient id="climateWaveFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={climateChartTab === "temperature" ? "#a855f7" : "#38bdf8"}
                  stopOpacity="0.55"
                />
                <stop
                  offset="100%"
                  stopColor={climateChartTab === "temperature" ? "#a855f7" : "#38bdf8"}
                  stopOpacity="0.02"
                />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padY + ratio * usableH;
              const labelVal =
                climateChartTab === "temperature"
                  ? Math.round(40 - ratio * 52)
                  : Math.round(125 - ratio * 125);
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={chartWidth - padX}
                    y2={y}
                    stroke="rgba(148, 163, 184, 0.14)"
                  />
                  <text x={8} y={y + 4} fill="var(--text-muted)" fontSize="10">
                    {labelVal}
                  </text>
                </g>
              );
            })}

            {/* Area & Smooth Path */}
            <path d={areaPath} fill="url(#climateWaveFill)" />
            <path
              d={linePath}
              fill="none"
              stroke={climateChartTab === "temperature" ? "#c084fc" : "#38bdf8"}
              strokeWidth="3"
            />

            {/* Interactive Data Points */}
            {points.map((pt, idx) => (
              <g
                key={pt.m.month}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverMonthIdx(idx)}
                onClick={() => setHoverMonthIdx(idx)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoverMonthIdx === idx ? 7 : 4.5}
                  fill={climateChartTab === "temperature" ? "#a855f7" : "#38bdf8"}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={pt.x}
                  y={chartHeight - 4}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="10.5"
                >
                  {lang === "az" ? pt.m.monthLabelAz : pt.m.monthLabelEn}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Summary KPI Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "0.85rem",
            marginTop: "1rem",
          }}
        >
          <div className="orbital-card">
            <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>MEAN TEMP (T2M)</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>{meanTemp.toFixed(2)} °C</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Min {minTemp.toFixed(1)}°C / Max {maxTemp.toFixed(1)}°C
            </div>
          </div>
          <div className="orbital-card">
            <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
              ANNUAL PRECIP (PRECTOTCORR)
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#38bdf8" }}>
              {totalPrecip.toFixed(2)} mm
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Wet days (≥1 mm): {wetDays.toFixed(0)} days
            </div>
          </div>
          <div className="orbital-card">
            <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>FROST DAYS (T2M_MIN &lt; 0°C)</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#c084fc" }}>
              {frostDays.toFixed(0)} days
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              fill_value = -999.0 preserved
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderScreen05Rotation = () => {
    const effWeights = activeSim?.weights_effective ?? { water: 0.625, soil: 0.375, income: 0 };

    return (
      <section className="orbital-frame">
        <div className="screen-step-bar">
          <div>
            <span className="screen-step-tag">
              🌱 {lang === "az" ? "05. NÖVBƏLİ ƏKİN STUDİYASI" : "05. ROTATION STUDIO"}
            </span>
            <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>
              {lang === "az" ? "Növbəti üç ili planlaşdırın" : "Plan the next three years"}
            </h2>
            <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {lang === "az"
                ? "Sahəniz üçün 3-illik növbəli əkin alternativlərini yaradın və müqayisə edin."
                : "Create and compare crop rotation alternatives for your field."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap" }}>
            {activeSim?.status === "provisional" && (
              <span className="badge badge-amber">
                ⚠ PROVISIONAL ({soilPhKnown ? "Unverified Rules" : "Soil pH Unknown"})
              </span>
            )}
            {activeSim?.status === "completed" && (
              <span className="badge badge-emerald">✓ COMPLETED (SOURCE SUPPORTED)</span>
            )}
            {activeSim?.status === "no_feasible_plan" && (
              <span className="badge badge-rose">✕ NO FEASIBLE PLAN</span>
            )}
            {activeSim?.status === "needs_data" && (
              <span className="badge badge-amber">⚠ NEEDS DATA</span>
            )}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                background: "rgba(30, 35, 68, 0.8)",
                padding: "0.3rem 0.7rem",
                borderRadius: 999,
                border: "1px solid var(--border-violet)",
              }}
            >
              <input
                type="checkbox"
                checked={applyStressInStudio}
                onChange={(e) => setApplyStressInStudio(e.target.checked)}
              />
              {lang === "az"
                ? `Quraqlıq stressini (${rainfallMultiplier}x) tətbiq et`
                : `Preview Rainfall Stress (${rainfallMultiplier}x)`}
            </label>
          </div>
        </div>

        <div className="grid-rotation-studio">
          {/* Left Priorities Panel matching Screen 05 */}
          <div className="orbital-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "1rem" }}>
                {lang === "az" ? "Prioritetlər (Priorities)" : "Priorities"}
              </strong>
              <span title="Weights automatically renormalize when an objective is unavailable in MVP">ⓘ</span>
            </div>

            {/* Water Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span>💧 {lang === "az" ? "Su qənaəti (Water)" : "Water"}</span>
                <span style={{ color: "#c4b5fd", fontWeight: 700 }}>
                  Eff: {(effWeights.water * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                className="orbital-slider"
                value={rawWaterPref}
                onChange={(e) => setRawWaterPref(Number(e.target.value))}
              />
            </div>

            {/* Soil Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span>🌱 {lang === "az" ? "Torpaq (Soil)" : "Soil"}</span>
                <span style={{ color: "#c4b5fd", fontWeight: 700 }}>
                  Eff: {(effWeights.soil * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                className="orbital-slider"
                value={rawSoilPref}
                onChange={(e) => setRawSoilPref(Number(e.target.value))}
              />
            </div>

            {/* Income Slider with "Data needed" matching Screen 05 & T14 */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span>💰 {lang === "az" ? "Gəlir (Income)" : "Income"}</span>
                <span className="badge badge-amber" style={{ fontSize: "0.66rem" }}>
                  Data needed (MVP 0%)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                className="orbital-slider"
                value={rawIncomePref}
                onChange={(e) => setRawIncomePref(Number(e.target.value))}
              />
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                {lang === "az"
                  ? "Təsdiqlənmiş regional qiymət/xərc bazası olmadığı üçün AZN gəliri uydurulmur; aktiv çəkilər Su və Torpaq arasında paylanır."
                  : "No verified regional price/cost dataset in MVP; active weights renormalize across Water & Soil."}
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "0.75rem",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
              }}
            >
              <div>
                💧 {lang === "az" ? "Effektiv su təminatı:" : "Effective water supply:"}{" "}
                <strong style={{ color: "#38bdf8" }}>
                  {activeSim?.input_summary.effective_water_supply_mm?.toFixed(1) ??
                    totalPrecip.toFixed(1)}{" "}
                  mm
                </strong>
              </div>
              <div style={{ marginTop: 4 }}>
                🌾 {lang === "az" ? "2023 tarixçəsi:" : "2023 prior crop:"}{" "}
                <strong>{priorCrop2023 ? getCropLabel(priorCrop2023) : "None"}</strong>
              </div>
            </div>
          </div>

          {/* Right 3 Plan Cards (Plan A, Plan B, Plan C) + Why This Plan matching Screen 05 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {activePlans.length > 0 ? (
              <div className="grid-plans-3">
                {activePlans.map((plan, idx) => {
                  const isSel = idx === selectedPlanIndex;
                  const planTitles = [
                    { code: "Plan A", subEn: "Balanced rotation", subAz: "Balanslaşdırılmış rotasiya" },
                    { code: "Plan B", subEn: "Soil & N-fix focus", subAz: "Torpaq və Azot fokusu" },
                    { code: "Plan C", subEn: "Water resilience", subAz: "Su davamlılığı" },
                  ];
                  const header = planTitles[idx] ?? {
                    code: `Plan ${idx + 1}`,
                    subEn: "Alternative",
                    subAz: "Alternativ",
                  };

                  return (
                    <div
                      key={plan.plan_id}
                      onClick={() => setSelectedPlanIndex(idx)}
                      className={`orbital-card ${isSel ? "glow" : ""}`}
                      style={{
                        cursor: "pointer",
                        border: isSel ? "2px solid #a855f7" : "1px solid var(--border-subtle)",
                        background: isSel
                          ? "linear-gradient(180deg, rgba(124, 58, 237, 0.24) 0%, rgba(19, 22, 45, 0.92) 100%)"
                          : undefined,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{header.code}</div>
                          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                            {lang === "az" ? header.subAz : header.subEn}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="badge badge-violet" style={{ fontSize: "0.82rem" }}>
                            {plan.score?.toFixed(1)} pts
                          </span>
                        </div>
                      </div>

                      {/* Year 1 -> Year 2 -> Year 3 rows */}
                      <div style={{ margin: "1rem 0", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                        {plan.years.map((yr) => {
                          const vis = CROP_VISUALS[yr.crop_id];
                          return (
                            <div
                              key={yr.year_index}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0.55rem 0.7rem",
                                borderRadius: 10,
                                background: "rgba(9, 11, 24, 0.7)",
                                border: "1px solid rgba(148, 163, 184, 0.14)",
                              }}
                            >
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Year {yr.year_index}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                                {vis?.icon ?? "🌱"} {lang === "az" ? vis?.nameAz ?? yr.crop_name : yr.crop_name}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Component Bars */}
                      <div style={{ fontSize: "0.74rem", display: "grid", gap: "0.35rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Water fit</span>
                          <strong>
                            {((plan.score_components.water.value ?? 0) * 100).toFixed(0)}%
                          </strong>
                        </div>
                        <div className="meter-track" style={{ height: 6 }}>
                          <div
                            className="meter-fill-cyan"
                            style={{ width: `${(plan.score_components.water.value ?? 0) * 100}%` }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                          <span>Soil synergy</span>
                          <strong>
                            {((plan.score_components.soil.value ?? 0) * 100).toFixed(0)}%
                          </strong>
                        </div>
                        <div className="meter-track" style={{ height: 6 }}>
                          <div
                            className="meter-fill-violet"
                            style={{ width: `${(plan.score_components.soil.value ?? 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Honest No-Feasible-Plan / Needs-Data State (T12, T15) */
              <div className="orbital-card" style={{ borderColor: "var(--accent-rose)" }}>
                <h3 style={{ margin: "0 0 0.5rem", color: "#fda4af" }}>
                  {activeSim?.status === "needs_data"
                    ? lang === "az"
                      ? "Qiymətləndirmə üçün aktiv hədəf çəkisi lazımdır (needs_data)"
                      : "Active objective weight required (needs_data)"
                    : lang === "az"
                    ? "Heç bir 3-illik plan sərt aqronomik məhdudiyyətləri keçmədi (0 plan)"
                    : "Zero feasible 3-year plans under current constraints (no_feasible_plan)"}
                </h3>
                <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", margin: "0 0 0.85rem" }}>
                  {lang === "az"
                    ? "Elmi dürüstlük qaydasına əsasən uyğun olmayan şəraitdə saxta əkin planı uydurulmur. Rədd edilmə səbəbləri:"
                    : "Per scientific honesty rules, Space Farm never fabricates plans when hard constraints fail. Rejection breakdown:"}
                </p>
                <div style={{ display: "grid", gap: "0.45rem", marginBottom: "1rem" }}>
                  {activeSim?.rejected_summary.map((item) => (
                    <div
                      key={item.rule_id}
                      style={{
                        padding: "0.55rem 0.75rem",
                        borderRadius: 10,
                        background: "rgba(244, 63, 94, 0.12)",
                        border: "1px solid rgba(244, 63, 94, 0.35)",
                        fontSize: "0.8rem",
                      }}
                    >
                      <strong>{item.rule_id}</strong> ({item.count} combinations rejected): {item.reason}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-orbital-primary"
                    onClick={() => {
                      setIrrigationType("irrigated");
                      setIrrigationBudgetMm(200);
                    }}
                  >
                    💧 {lang === "az" ? "Suvarma əlavə et (+200 mm)" : "Enable Irrigation (+200 mm)"}
                  </button>
                  <button
                    type="button"
                    className="btn-orbital-secondary"
                    onClick={() => {
                      setApplyStressInStudio(false);
                      setRawWaterPref(50);
                      setRawSoilPref(30);
                      setRawIncomePref(20);
                    }}
                  >
                    ↺ {lang === "az" ? "Standart rejimi bərpa et" : "Restore Baseline"}
                  </button>
                </div>
              </div>
            )}

            {/* Why this plan? Drawer + Compare Alternatives CTA matching Screen 05 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start" }}>
              <div className="orbital-card">
                <div
                  onClick={() => setWhyPlanOpen((o) => !o)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <strong style={{ fontSize: "0.95rem" }}>
                    {lang === "az" ? "Niyə bu plan? (Why this plan?)" : "Why this plan?"}
                  </strong>
                  <span>{whyPlanOpen ? "▴" : "▾"}</span>
                </div>

                {whyPlanOpen && selectedPlan && (
                  <div style={{ marginTop: "0.75rem", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                    {selectedPlan.explanations.map((exp) => (
                      <p key={exp.code} style={{ margin: "0 0 0.5rem" }}>
                        • <strong>{exp.code}:</strong> {exp.text}
                      </p>
                    ))}
                    <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      {selectedPlan.constraints_checked.map((chk) => (
                        <span
                          key={chk.rule_id}
                          className={`badge ${
                            chk.result === "pass" ? "badge-emerald" : "badge-amber"
                          }`}
                          title={chk.reason}
                        >
                          {chk.result === "pass" ? "✓" : "?"} {chk.rule_id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-orbital-primary"
                style={{ height: "100%", minHeight: 54 }}
                onClick={() => setActiveScreen("06-scenario")}
              >
                {lang === "az" ? "Ssenari Laboratoriyası →" : "Compare in Scenario Lab →"}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderScreen06Scenario = () => {
    const baseTop = baselineSim?.plans?.[0] ?? null;
    const stressTop = stressSim?.plans?.[0] ?? null;

    const baseWaterSupply = baselineSim?.input_summary.effective_water_supply_mm ?? totalPrecip;
    const stressWaterSupply =
      stressSim?.input_summary.effective_water_supply_mm ?? totalPrecip * rainfallMultiplier;

    const baseWaterFit = Math.round(((baseTop?.score_components.water.value ?? 0.82) * 100));
    const baseSoilFit = Math.round(((baseTop?.score_components.soil.value ?? 0.78) * 100));
    const baseRotFit = Math.round(baseTop?.score ?? 80);

    const stressWaterFit = Math.round(((stressTop?.score_components.water.value ?? 0) * 100));
    const stressSoilFit = Math.round(((stressTop?.score_components.soil.value ?? 0) * 100));
    const stressRotFit = Math.round(stressTop?.score ?? 0);

    const pctDrop = Math.round((1 - rainfallMultiplier) * -100);

    return (
      <section className="orbital-frame">
        <div className="screen-step-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span className="screen-step-tag">
              🧪 {lang === "az" ? "06. SSENARİ LABORATORİYASI" : "06. SCENARIO LAB"}
            </span>
            <h2 style={{ margin: 0, fontSize: "1.65rem" }}>Scenario Lab</h2>
            <span className="badge badge-violet">Hypothetical scenario</span>
          </div>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            {lang === "az"
              ? "Xam NASA POWER müşahidəsi dəyişdirilmir (T16)"
              : "Raw NASA POWER series preserved untouched (T16)"}
          </span>
        </div>

        <p style={{ margin: "0 0 1.2rem", color: "var(--text-secondary)", fontSize: "0.92rem" }}>
          {lang === "az"
            ? "Yağıntının azalmasının (0.9x, 0.8x, 0.7x) növbəli əkin seçiminizə və su balansına necə təsir etdiyini sınaqdan keçirin."
            : "Explore how a change in rainfall could affect your rotation choice."}
        </p>

        <div className="grid-scenario-lab">
          {/* Baseline Card matching Screen 06 */}
          <div className="orbital-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Baseline</h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Current conditions (reference 1.0x)
                </div>
              </div>
              <span className="badge badge-violet">{baseWaterSupply.toFixed(1)} mm</span>
            </div>

            <div style={{ margin: "1.1rem 0", display: "grid", gap: "0.8rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Water demand alignment</span>
                  <strong>{baseWaterFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-violet" style={{ width: `${baseWaterFit}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Soil health & N-recovery</span>
                  <strong>{baseSoilFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-violet" style={{ width: `${baseSoilFit}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Rotation fit score</span>
                  <strong>{baseRotFit}/100</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-violet" style={{ width: `${baseRotFit}%` }} />
                </div>
              </div>
            </div>

            {baseTop && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Top Plan:{" "}
                <strong>{baseTop.years.map((y) => y.crop_name).join(" → ")}</strong>
              </div>
            )}
          </div>

          {/* Rainfall Stress Card matching Screen 06 */}
          <div className="orbital-card glow" style={{ borderColor: "#38bdf8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Rainfall stress</h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Reduced rainfall scenario ({pctDrop}% / {rainfallMultiplier.toFixed(1)}x)
                </div>
              </div>
              <span className="badge badge-cyan">{stressWaterSupply.toFixed(1)} mm</span>
            </div>

            <div style={{ margin: "1.1rem 0", display: "grid", gap: "0.8rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Water demand alignment</span>
                  <strong>{stressWaterFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-cyan" style={{ width: `${stressWaterFit}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Soil health & N-recovery</span>
                  <strong>{stressSoilFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-cyan" style={{ width: `${stressSoilFit}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Rotation fit score</span>
                  <strong>{stressRotFit}/100</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-cyan" style={{ width: `${stressRotFit}%` }} />
                </div>
              </div>
            </div>

            {stressTop ? (
              <div style={{ fontSize: "0.8rem", color: "#7dd3fc" }}>
                Adapted Top Plan:{" "}
                <strong>{stressTop.years.map((y) => y.crop_name).join(" → ")}</strong>
              </div>
            ) : (
              <div style={{ fontSize: "0.8rem", color: "#fda4af" }}>
                ⚠ <strong>no_feasible_plan:</strong> High-water crops eliminated; enable irrigation or select drought-tolerant legumes.
              </div>
            )}
          </div>

          {/* Right Rainfall Change Selector Card matching Screen 06 */}
          <div className="orbital-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.95rem" }}>Rainfall change ⓘ</strong>
              </div>

              <div
                style={{
                  textAlign: "center",
                  margin: "1rem 0",
                  padding: "0.65rem",
                  borderRadius: 12,
                  background: "rgba(124, 58, 237, 0.22)",
                  border: "1px solid #a855f7",
                  fontSize: "1.45rem",
                  fontWeight: 800,
                }}
              >
                {pctDrop}% ({rainfallMultiplier.toFixed(1)}x)
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem", marginBottom: "1rem" }}>
                {([1.0, 0.9, 0.8, 0.7] as const).map((mult) => {
                  const label = `${Math.round((1 - mult) * -100)}%`;
                  const active = rainfallMultiplier === mult;
                  return (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setRainfallMultiplier(mult)}
                      style={{
                        padding: "0.5rem 0.25rem",
                        borderRadius: 8,
                        border: active ? "1px solid #c084fc" : "1px solid var(--border-subtle)",
                        background: active ? "#7c3aed" : "rgba(15, 23, 42, 0.8)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="btn-orbital-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setApplyStressInStudio(rainfallMultiplier < 1.0);
                setActiveScreen("05-rotation");
              }}
            >
              {lang === "az" ? "Ssenarini Studio-da aç →" : "Run scenario in Studio →"}
            </button>
          </div>
        </div>

        {/* Scenario Details Footer Card matching Screen 06 */}
        <div className="orbital-card" style={{ marginTop: "1rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>Scenario details</strong>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
            A hypothetical sensitivity test evaluating how lower seasonal rainfall ({rainfallMultiplier.toFixed(1)}x of verified 2024 NASA POWER {totalPrecip.toFixed(2)} mm = {(totalPrecip * rainfallMultiplier).toFixed(2)} mm) affects crop water-band feasibility (FAO Paper 56) without modifying raw historical satellite records.
          </p>
        </div>
      </section>
    );
  };

  const renderScreen07Sources = () => (
    <section className="orbital-frame">
      <div className="screen-step-bar">
        <div>
          <span className="screen-step-tag">
            📚 {lang === "az" ? "07. MƏNBƏLƏR VƏ İZAHATLAR" : "07. SOURCES & EXPLANATIONS"}
          </span>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>
            {lang === "az" ? "Hər qərarı anlayın" : "Understand every decision"}
          </h2>
          <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {lang === "az"
              ? "Növbəli əkin planınızın necə qurulduğunu, hansı NASA və FAO mənbələrini istifadə etdiyini və nələrin naməlum qaldığını görün."
              : "See how your rotation plan is built, what data it uses, and what's still missing."}
          </p>
        </div>

        <button
          type="button"
          className="btn-orbital-primary"
          onClick={() => setShowMethodologyModal(true)}
        >
          📋 {lang === "az" ? "NASA Təqdimat Hesabatı" : "View NASA Methodology & Citation"}
        </button>
      </div>

      {/* Top Row: Selected Rotation + Unknown Inputs matching Screen 07 */}
      <div className="grid-2col" style={{ marginBottom: "1.25rem" }}>
        <div className="orbital-card">
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Selected rotation</div>
          <div style={{ fontSize: "1rem", fontWeight: 700, margin: "0.2rem 0 0.75rem" }}>
            {selectedPlan
              ? `Plan ${String.fromCharCode(65 + selectedPlanIndex)} — Score ${selectedPlan.score?.toFixed(1)}/100`
              : "No active plan selected"}
          </div>
          {selectedPlan && (
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              {selectedPlan.years.map((yr) => {
                const vis = CROP_VISUALS[yr.crop_id];
                return (
                  <span
                    key={yr.year_index}
                    className="badge badge-violet"
                    style={{ padding: "0.45rem 0.85rem", fontSize: "0.84rem" }}
                  >
                    {vis?.icon ?? "🌱"} {yr.crop_name} (Y{yr.year_index})
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="orbital-card" style={{ borderColor: "var(--accent-amber)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 700, color: "#fcd34d" }}>
            <span>⚠</span>
            <span>{lang === "az" ? "Naməlum girişlər (Unknown inputs)" : "Unknown inputs & Honest Limitations"}</span>
          </div>
          <p style={{ margin: "0.45rem 0 0", fontSize: "0.83rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {!soilPhKnown
              ? "Soil pH is currently Unknown (never silently defaulted to pH 7.0). "
              : `Soil pH is user-reported (${soilPhValue.toFixed(1)}). `}
            Regional economic crop price/yield datasets are unavailable in MVP v0.1.0, and FAO Paper 56 thresholds are marked <code>source_supported / provisional</code> pending local agronomist calibration.
          </p>
        </div>
      </div>

      {/* Provenance Flow Diagram matching Screen 07 */}
      <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
        Data sources and provenance
      </div>
      <div className="provenance-flow">
        <div className="provenance-node">
          <div style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700 }}>STEP 1 • SATELLITE</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>🛰 NASA POWER</div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 2 }}>
            Climate (historical 2024 • 366/366 UTC days)
          </div>
        </div>
        <div className="provenance-node">
          <div style={{ fontSize: "0.72rem", color: "#fcd34d", fontWeight: 700 }}>STEP 2 • FIELD</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>🌱 Local soil inputs</div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 2 }}>
            Field-specific ({soilPhKnown ? `pH ${soilPhValue.toFixed(1)}` : "pH Unknown"} • {irrigationType})
          </div>
        </div>
        <div className="provenance-node">
          <div style={{ fontSize: "0.72rem", color: "#6ee7b7", fontWeight: 700 }}>STEP 3 • AGRONOMY</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>📐 Crop rules</div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 2 }}>
            FAO Paper 56 & CROPWAT ({catalog?.crops.length ?? 6} crops, 7 rules)
          </div>
        </div>
        <div className="provenance-node highlight">
          <div style={{ fontSize: "0.72rem", color: "#e9d5ff", fontWeight: 700 }}>STEP 4 • OUTPUT</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>📋 Rotation plan</div>
          <div style={{ fontSize: "0.76rem", color: "#f3e8ff", marginTop: 2 }}>
            {selectedPlan
              ? selectedPlan.years.map((y) => y.crop_id).join(" → ")
              : activeSim?.status ?? "Ready"}
          </div>
        </div>
      </div>

      {/* Expandable Provenance Accordions matching Screen 07 */}
      <div style={{ display: "grid", gap: "0.65rem" }}>
        {/* 1. NASA POWER Accordion */}
        <div className="orbital-card">
          <div
            onClick={() => setOpenAccordion(openAccordion === "nasa" ? null : "nasa")}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", alignItems: "center" }}
          >
            <div>
              <strong>🛰 NASA POWER</strong>{" "}
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginLeft: 8 }}>
                Historical climate data (T2M, T2M_MIN, T2M_MAX, PRECTOTCORR)
              </span>
            </div>
            <span>{openAccordion === "nasa" ? "▴" : "▾"}</span>
          </div>
          {openAccordion === "nasa" && (
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.85rem",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.8rem",
                display: "grid",
                gap: "0.35rem",
                color: "var(--text-secondary)",
              }}
            >
              <div>
                <strong>Provider & Dataset:</strong>{" "}
                {sourceRecord?.provider ?? "NASA Langley Research Center (LaRC) POWER Project"} •{" "}
                {sourceRecord?.dataset ?? "NASA POWER Daily Point API v2.10.3 (AG Community, MERRA-2)"}
              </div>
              <div>
                <strong>Request URL:</strong>{" "}
                <code style={{ color: "#7dd3fc", wordBreak: "break-all" }}>
                  {sourceRecord?.request_url ??
                    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MIN,T2M_MAX,PRECTOTCORR&community=AG&longitude=${customLon}&latitude=${customLat}&start=20240101&end=20241231&format=JSON&time-standard=UTC`}
                </code>
              </div>
              <div>
                <strong>Payload SHA-256:</strong>{" "}
                <code style={{ color: "#6ee7b7" }}>
                  {sourceRecord?.payload_sha256 ?? selectedRegion.payloadSha256}
                </code>
              </div>
              <div>
                <strong>Spatial Resolution & Standard:</strong> 0.5° × 0.625° MERRA-2 grid • UTC time standard • fill_value = -999.0
              </div>
            </div>
          )}
        </div>

        {/* 2. Local Soil Inputs Accordion */}
        <div className="orbital-card">
          <div
            onClick={() => setOpenAccordion(openAccordion === "soil" ? null : "soil")}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", alignItems: "center" }}
          >
            <div>
              <strong>🌱 Local soil & field inputs</strong>{" "}
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginLeft: 8 }}>
                Soil properties, irrigation regime, and prior crop history
              </span>
            </div>
            <span>{openAccordion === "soil" ? "▴" : "▾"}</span>
          </div>
          {openAccordion === "soil" && (
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.85rem",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
              }}
            >
              Field: <strong>{selectedRegion.nameEn}</strong> ({customLat.toFixed(3)}°N, {customLon.toFixed(3)}°E) • Soil pH:{" "}
              <strong>{soilPhKnown ? soilPhValue.toFixed(1) : "Unknown (provisional)"}</strong> • Texture:{" "}
              <strong>{soilTexture}</strong> • Irrigation: <strong>{irrigationType}</strong>
            </div>
          )}
        </div>

        {/* 3. Crop Rules Accordion */}
        <div className="orbital-card">
          <div
            onClick={() => setOpenAccordion(openAccordion === "rules" ? null : "rules")}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", alignItems: "center" }}
          >
            <div>
              <strong>📐 Crop rules (FAO Paper 56 / CROPWAT)</strong>{" "}
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginLeft: 8 }}>
                Crop rotation and water/pH suitability rules used in planning
              </span>
            </div>
            <span>{openAccordion === "rules" ? "▴" : "▾"}</span>
          </div>
          {openAccordion === "rules" && (
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.85rem",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.8rem",
                display: "grid",
                gap: "0.45rem",
              }}
            >
              {(catalog?.crops ?? []).map((c) => (
                <div
                  key={c.crop_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    padding: "0.4rem 0.6rem",
                    background: "rgba(15, 23, 42, 0.65)",
                    borderRadius: 8,
                  }}
                >
                  <span>
                    <strong>{c.name}</strong> ({c.family})
                  </span>
                  <span>
                    Water: {c.water_band_mm?.min_mm}–{c.water_band_mm?.max_mm} mm • pH:{" "}
                    {c.soil_ph_range?.min_ph}–{c.soil_ph_range?.max_ph} •{" "}
                    <code style={{ color: "#c4b5fd" }}>{c.validation_status}</code>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="orbital-app">
      <div className="orbital-horizon-glow" />

      {/* Top Concept Brand Header */}
      <header className="orbital-brand-strip">
        <div className="brand-title-group">
          <span className="brand-logo-mark">
            🛰 SPACEFARM <span className="brand-slash">/</span>
          </span>
          <span className="brand-subtitle">ORBITAL AGRICULTURE</span>
          <span className="brand-team-tag">by CODE44</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={boardMode ? "btn-orbital-primary" : "btn-orbital-secondary"}
            style={{ padding: "0.35rem 0.85rem", fontSize: "0.78rem" }}
            onClick={() => setBoardMode((b) => !b)}
          >
            {boardMode
              ? lang === "az"
                ? "🎯 Tək Ekran Rejimi"
                : "🎯 Single Screen Studio"
              : lang === "az"
              ? "⊞ Bütün 7 Ekran Lövhəsi"
              : "⊞ 7-Screen Concept Board"}
          </button>

          <select
            className="orbital-select"
            style={{ width: "auto", padding: "0.32rem 0.65rem", fontSize: "0.76rem" }}
            value={dataModePref}
            onChange={(e) => setDataModePref(e.target.value as DataMode)}
          >
            <option value="cached">Mode: Verified Cached Snapshot</option>
            <option value="live">Mode: Live NASA POWER API</option>
          </select>

          <button
            type="button"
            className="btn-orbital-secondary"
            style={{ padding: "0.32rem 0.7rem", fontSize: "0.76rem" }}
            onClick={() => setLang((l) => (l === "en" ? "az" : "en"))}
          >
            🌐 {lang.toUpperCase()} ▾
          </button>
        </div>
      </header>

      {/* Main App Bar matching the design concept */}
      <nav className="orbital-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <strong style={{ fontSize: "1rem", letterSpacing: "0.02em" }}>SpaceFarm</strong>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {lang === "az" ? selectedRegion.nameAz : selectedRegion.nameEn}
          </span>
        </div>

        <div className="nav-tabs">
          <button
            type="button"
            className={`nav-tab-btn ${activeScreen === "01-home" ? "active" : ""}`}
            onClick={() => {
              setBoardMode(false);
              setActiveScreen("01-home");
            }}
          >
            {lang === "az" ? "İcmal" : "Overview"}
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${
              ["02-explorer", "03-field", "04-climate"].includes(activeScreen) ? "active" : ""
            }`}
            onClick={() => {
              setBoardMode(false);
              setActiveScreen("02-explorer");
            }}
          >
            {lang === "az" ? "Kəşf et" : "Explore"}
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${
              ["05-rotation", "06-scenario"].includes(activeScreen) ? "active" : ""
            }`}
            onClick={() => {
              setBoardMode(false);
              setActiveScreen("05-rotation");
            }}
          >
            {lang === "az" ? "Planla" : "Plan"}
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeScreen === "07-sources" ? "active" : ""}`}
            onClick={() => {
              setBoardMode(false);
              setActiveScreen("07-sources");
            }}
          >
            {lang === "az" ? "Mənbələr" : "Sources"}
          </button>
        </div>

        <div className="topbar-controls">
          <span className="status-pill">
            <span className={`status-dot ${health?.status === "ok" ? "ok" : "warn"}`} />
            API {health?.contract_version ?? "0.1.0"}
          </span>
          <span className="status-pill">
            <span className="status-dot cached" />
            {loadingSim ? "SYNCING NASA…" : (climateBundle?.data_mode ?? "cached").toUpperCase()}
          </span>
        </div>
      </nav>

      {/* Main Workspace: Left Vertical Icon Dock + Stage */}
      <div className="orbital-workspace">
        <aside className="orbital-dock">
          {SCREEN_META.map((sc) => (
            <button
              key={sc.id}
              type="button"
              title={lang === "az" ? sc.titleAz : sc.titleEn}
              className={`dock-btn ${!boardMode && activeScreen === sc.id ? "active" : ""}`}
              onClick={() => {
                setBoardMode(false);
                setActiveScreen(sc.id);
              }}
            >
              <span>{sc.icon}</span>
              <span className="dock-num">{sc.num}</span>
            </button>
          ))}
        </aside>

        <main className="orbital-stage">
          {apiError && (
            <div
              className="orbital-card"
              style={{
                borderColor: "var(--accent-rose)",
                marginBottom: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div>
                <strong style={{ color: "#fda4af" }}>
                  API Error ({apiError.code ?? "ERROR"}):
                </strong>{" "}
                {apiError.message}
              </div>
              <button
                type="button"
                className="btn-orbital-secondary"
                onClick={triggerSimulations}
              >
                ↻ Retry
              </button>
            </div>
          )}

          {boardMode ? (
            <div style={{ display: "grid", gap: "1.75rem" }}>
              {renderScreen01Home()}
              {renderScreen02Explorer()}
              {renderScreen03Field()}
              {renderScreen04Climate()}
              {renderScreen05Rotation()}
              {renderScreen06Scenario()}
              {renderScreen07Sources()}
            </div>
          ) : (
            <>
              {activeScreen === "01-home" && renderScreen01Home()}
              {activeScreen === "02-explorer" && renderScreen02Explorer()}
              {activeScreen === "03-field" && renderScreen03Field()}
              {activeScreen === "04-climate" && renderScreen04Climate()}
              {activeScreen === "05-rotation" && renderScreen05Rotation()}
              {activeScreen === "06-scenario" && renderScreen06Scenario()}
              {activeScreen === "07-sources" && renderScreen07Sources()}
            </>
          )}
        </main>
      </div>

      {/* Official NASA Space Apps Methodology & Attribution Modal */}
      {showMethodologyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 6, 15, 0.82)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => setShowMethodologyModal(false)}
        >
          <div
            className="orbital-frame"
            style={{ maxWidth: 760, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>
                🛰 NASA Space Apps 2026 — Official Data & Methodology Statement
              </h3>
              <button
                type="button"
                className="btn-orbital-secondary"
                onClick={() => setShowMethodologyModal(false)}
              >
                ✕ Close
              </button>
            </div>

            <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {lang === "az" ? NASA_SUBMISSION_CITATION_AZ : NASA_SUBMISSION_CITATION_EN}
            </p>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn-orbital-primary"
                onClick={() => {
                  navigator.clipboard.writeText(
                    lang === "az" ? NASA_SUBMISSION_CITATION_AZ : NASA_SUBMISSION_CITATION_EN
                  );
                  setCopiedCitation(true);
                  setTimeout(() => setCopiedCitation(false), 2000);
                }}
              >
                {copiedCitation ? "✓ Copied!" : "📋 Copy Official Citation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
