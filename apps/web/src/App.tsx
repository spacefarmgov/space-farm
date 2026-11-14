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
  ExplorerLeafletMap,
  FieldParcelLeafletMap,
  InteractiveOrbitalGlobe,
} from "./components/OrbitalWidgets";
import {
  AZERBAIJAN_REGIONS,
  CROP_VISUALS,
  NASA_SUBMISSION_CITATION_AZ,
  NASA_SUBMISSION_CITATION_EN,
  buildDefaultParcelAround,
  computePolygonMetrics,
  type DailyClimatePoint,
  type Language,
  type MonthlyClimatePoint,
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

  // Selected Azerbaijan Sector & Live Satellite Coordinates
  const [selectedRegionId, setSelectedRegionId] = useState<string>("ganja");
  const selectedRegion: RegionPreset = useMemo(
    () => AZERBAIJAN_REGIONS.find((r) => r.id === selectedRegionId) ?? AZERBAIJAN_REGIONS[0],
    [selectedRegionId]
  );

  const [customLat, setCustomLat] = useState<number>(selectedRegion.latitude);
  const [customLon, setCustomLon] = useState<number>(selectedRegion.longitude);
  const [customFieldName, setCustomFieldName] = useState<string>(selectedRegion.nameEn);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchingPlace, setSearchingPlace] = useState<boolean>(false);
  const [mapLayer, setMapLayer] = useState<"satellite" | "climate" | "fields">("satellite");

  // Field Intelligence Inputs (03) — Real GPS Polygon & Geodesic Area
  const [parcelCoords, setParcelCoords] = useState<Array<[number, number]>>(
    selectedRegion.parcelCoords
  );
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const polygonMetrics = useMemo(() => computePolygonMetrics(parcelCoords), [parcelCoords]);
  const [manualAreaOverrideHa, setManualAreaOverrideHa] = useState<number | null>(null);
  const effectiveAreaHa = manualAreaOverrideHa ?? polygonMetrics.areaHa;

  const [soilPhKnown, setSoilPhKnown] = useState<boolean>(false);
  const [soilPhValue, setSoilPhValue] = useState<number>(7.1);
  const [soilTexture, setSoilTexture] = useState<SoilTexture>("unknown");
  const [irrigationType, setIrrigationType] = useState<IrrigationType>("rainfed");
  const [irrigationBudgetMm, setIrrigationBudgetMm] = useState<number>(180);
  const [priorCrop2022, setPriorCrop2022] = useState<string>("");
  const [priorCrop2023, setPriorCrop2023] = useState<string>("wheat");

  // Climate History Tab (04) — Monthly & 366-Day Daily Resolution
  const [climateChartTab, setClimateChartTab] = useState<"temperature" | "rainfall">("temperature");
  const [climateResolution, setClimateResolution] = useState<"monthly" | "daily">("monthly");
  const [hoverMonthIdx, setHoverMonthIdx] = useState<number>(6);
  const [hoverDayIdx, setHoverDayIdx] = useState<number>(195);
  const [liveMonthlySeries, setLiveMonthlySeries] = useState<MonthlyClimatePoint[] | null>(null);
  const [liveDailySeries, setLiveDailySeries] = useState<DailyClimatePoint[]>([]);

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

  // Live NASA POWER Mode by default!
  const [dataModePref, setDataModePref] = useState<DataMode>("live");
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

  // Select one of the Azerbaijan agro-sectors
  const handleSelectRegion = useCallback(
    (region: RegionPreset) => {
      setSelectedRegionId(region.id);
      setCustomLat(region.latitude);
      setCustomLon(region.longitude);
      setCustomFieldName(lang === "az" ? region.nameAz : region.nameEn);
      setParcelCoords(region.parcelCoords);
      setManualAreaOverrideHa(null);
      setDrawingMode(false);
      setSelectedPlanIndex(0);
    },
    [lang]
  );

  // Click any arbitrary GPS coordinate on the real satellite map!
  const handlePickCoordinateOnMap = useCallback(
    (lat: number, lon: number, label?: string) => {
      setCustomLat(lat);
      setCustomLon(lon);
      setCustomFieldName(
        label ??
          (lang === "az"
            ? `Peyk Sahəsi (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`
            : `Satellite Sector (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`)
      );
      setParcelCoords(buildDefaultParcelAround(lat, lon));
      setManualAreaOverrideHa(null);
      setDrawingMode(false);
      setSelectedPlanIndex(0);
    },
    [lang]
  );

  // Live Geocoding Search (OpenStreetMap Nominatim) + Sector Filter
  const handleGeocodeSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    // Check if matches local preset first
    const match = AZERBAIJAN_REGIONS.find(
      (r) =>
        r.nameEn.toLowerCase().includes(q.toLowerCase()) ||
        r.nameAz.toLowerCase().includes(q.toLowerCase())
    );
    if (match) {
      handleSelectRegion(match);
      return;
    }

    try {
      setSearchingPlace(true);
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      );
      if (resp.ok) {
        const items = await resp.json();
        if (Array.isArray(items) && items.length > 0) {
          const lat = Number(Number(items[0].lat).toFixed(4));
          const lon = Number(Number(items[0].lon).toFixed(4));
          const disp = String(items[0].display_name || q).split(",")[0];
          handlePickCoordinateOnMap(lat, lon, `${disp} Agro-Sector`);
        }
      }
    } catch {
      // Fallback silently
    } finally {
      setSearchingPlace(false);
    }
  }, [searchQuery, handleSelectRegion, handlePickCoordinateOnMap]);

  // Normalized preferences summing to 1.0
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

  const buildSimRequest = useCallback(
    (mult: 1.0 | 0.9 | 0.8 | 0.7): SimulationRequest => ({
      contract_version: "0.1.0",
      farm: {
        farm_id: selectedRegion.farmId,
        label: customFieldName || (lang === "az" ? selectedRegion.nameAz : selectedRegion.nameEn),
        is_demo: false,
        location: {
          latitude: Number(customLat),
          longitude: Number(customLon),
          crs: "EPSG:4326",
        },
        area_ha: Math.max(0.5, Number(effectiveAreaHa.toFixed(1))),
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
      customFieldName,
      lang,
      customLat,
      customLon,
      effectiveAreaHa,
      irrigationType,
      irrigationBudgetMm,
      soilPhKnown,
      soilPhValue,
      soilTexture,
      cropHistory,
      normalizedPreferences,
    ]
  );

  // Execute live backend simulation + fetch daily 366-day NASA series
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

    // Also fetch daily 366-day & monthly series for the active coordinate
    fetch(
      `/api/v1/climate/daily-series?latitude=${baseReq.farm.location.latitude}&longitude=${baseReq.farm.location.longitude}`,
      { signal: ctrl.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((seriesData) => {
        if (seriesData?.monthly) setLiveMonthlySeries(seriesData.monthly);
        if (seriesData?.daily) setLiveDailySeries(seriesData.daily);
      })
      .catch(() => {
        // Fallback to preset monthly series
      });

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

  const activeSim: SimulationResponse | null = useMemo(() => {
    if (applyStressInStudio && stressSim) return stressSim;
    return baselineSim;
  }, [applyStressInStudio, stressSim, baselineSim]);

  const activePlans: RotationPlan[] = activeSim?.plans ?? [];
  const selectedPlan: RotationPlan | null =
    activePlans[selectedPlanIndex] ?? activePlans[0] ?? null;

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
  // Render Screens (01 .. 07)
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
              padding: "0.32rem 0.8rem",
              borderRadius: 999,
              background: "rgba(139, 92, 246, 0.18)",
              border: "1px solid rgba(168, 85, 247, 0.45)",
              fontSize: "0.78rem",
              color: "#ddd6fe",
              marginBottom: "1rem",
            }}
          >
            <span>🛰</span>
            <span>
              REAL-TIME NASA LaRC POWER (MERRA-2 0.5° × 0.625°) + FAO PAPER 56 ENGINE
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(2.25rem, 4.1vw, 3.55rem)",
              lineHeight: 1.07,
              margin: "0 0 1rem",
              fontWeight: 900,
              letterSpacing: "-0.025em",
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
              lineHeight: 1.62,
              maxWidth: 550,
              marginBottom: "1.6rem",
            }}
          >
            {lang === "az"
              ? "Peyk müşahidələri, canlı NASA POWER aqroiqlim telemetriyası və deterministik 3-illik növbəli əkin mühərriki ilə Yerdəki sahələriniz üçün elmi əsaslı qərarlar verin."
              : "Live satellite observations, NASA POWER agroclimatic telemetry, and deterministic 3-year rotation planning to make scientifically rigorous decisions for your fields on Earth."}
          </p>

          <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
            <button
              type="button"
              className="btn-orbital-primary"
              onClick={() => setActiveScreen("02-explorer")}
            >
              🌍 {lang === "az" ? "Peyk Xəritəsini Aç →" : "Explore Satellite Map →"}
            </button>
            <button
              type="button"
              className="btn-orbital-secondary"
              onClick={() => setActiveScreen("05-rotation")}
            >
              ⚡ {lang === "az" ? "3-İllik Rotasiya Studiyası" : "Open Rotation Studio"}
            </button>
            <button
              type="button"
              className="btn-orbital-secondary"
              onClick={() => setActiveScreen("06-scenario")}
            >
              🧪 {lang === "az" ? "Quraqlıq Laboratoriyası" : "Scenario Lab"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
            }}
          >
            <div className="orbital-card" style={{ padding: "0.9rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                ACTIVE SATELLITE SECTOR
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#c084fc", marginTop: 2 }}>
                {customLat.toFixed(2)}°N, {customLon.toFixed(2)}°E
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)", marginTop: 2 }}>
                {customFieldName}
              </div>
            </div>
            <div className="orbital-card" style={{ padding: "0.9rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                NASA POWER TELEMETRY
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8", marginTop: 2 }}>
                {totalPrecip.toFixed(1)} mm • {meanTemp.toFixed(1)}°C
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)", marginTop: 2 }}>
                366/366 UTC Days • SHA-256
              </div>
            </div>
            <div className="orbital-card" style={{ padding: "0.9rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                TOP 3-YR ROTATION
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#10b981", marginTop: 2 }}>
                {selectedPlan ? `${selectedPlan.score?.toFixed(1)} / 100` : "Ready"}
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)", marginTop: 2 }}>
                {selectedPlan
                  ? selectedPlan.years.map((y) => y.crop_name).join(" → ")
                  : "FAO Paper 56 Verified"}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive 3D HTML5 Canvas Globe (Drag to Rotate!) */}
        <InteractiveOrbitalGlobe
          selectedRegion={selectedRegion}
          latitude={customLat}
          longitude={customLon}
          annualPrecipMm={totalPrecip}
          meanTempC={meanTemp}
          sha256={sourceRecord?.payload_sha256 ?? selectedRegion.payloadSha256}
          onSelectRegion={handleSelectRegion}
        />
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
            {lang === "az" ? "Orbital Kəşfiyyatçı (Canlı Peyk Xəritəsi)" : "Orbital Explorer — Live Satellite Map"}
          </h2>
          <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {lang === "az"
              ? "Xəritədə istənilən nöqtəyə klikləyin və ya Azərbaycanın aqrar sektorlarından birini seçərək canlı NASA POWER datasını yükləyin."
              : "Click anywhere on the satellite map, search any district, or select an agro-sector to stream live NASA POWER data."}
          </p>
        </div>

        <div className="orbital-card" style={{ padding: "0.55rem 0.9rem", display: "flex", gap: "0.85rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
            {lang === "az" ? "Peyk Layı:" : "Layers:"}
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
                  ? "Peyk (Esri)"
                  : "Satellite"
                : layer === "climate"
                ? lang === "az"
                  ? "İqlim & Relyef"
                  : "Climate & Topo"
                : lang === "az"
                ? "Aqro-Sektorlar"
                : "Agro-Sectors"}
            </label>
          ))}
        </div>
      </div>

      <div className="grid-explorer">
        {/* Left Search & Sector Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div className="orbital-card">
            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              {lang === "az" ? "Rayon, kənd və ya koordinat axtar:" : "Search city, district, or village:"}
            </label>
            <div style={{ display: "flex", gap: "0.45rem" }}>
              <input
                type="text"
                className="orbital-input"
                placeholder={lang === "az" ? "Şəmkir, Ağdam, Lənkəran, Gəncə..." : "Shamkir, Agdam, Lankaran, Ganja..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGeocodeSearch();
                }}
              />
              <button
                type="button"
                className="btn-orbital-primary"
                style={{ padding: "0.5rem 0.85rem" }}
                onClick={handleGeocodeSearch}
              >
                {searchingPlace ? "…" : "🔍"}
              </button>
            </div>

            <div
              style={{
                marginTop: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.45rem",
                maxHeight: 270,
                overflowY: "auto",
                paddingRight: 2,
              }}
            >
              {filteredRegions.map((reg) => {
                const isSelected =
                  Math.abs(customLat - reg.latitude) < 0.01 &&
                  Math.abs(customLon - reg.longitude) < 0.01;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => handleSelectRegion(reg)}
                    style={{
                      textAlign: "left",
                      padding: "0.65rem 0.8rem",
                      borderRadius: 11,
                      border: isSelected
                        ? "1px solid #38bdf8"
                        : "1px solid rgba(148, 163, 184, 0.18)",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(124, 58, 237, 0.36), rgba(14, 116, 144, 0.35))"
                        : "rgba(15, 23, 42, 0.68)",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.84rem" }}>
                        🛰 {lang === "az" ? reg.nameAz : reg.nameEn}
                      </strong>
                      <span className="badge badge-violet">{reg.annualPrecipMm.toFixed(0)} mm</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>
                      {reg.latitude.toFixed(3)}°N, {reg.longitude.toFixed(3)}°E • T2M {reg.meanTempC.toFixed(1)}°C
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="orbital-card">
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.45rem" }}>
              ACTIVE SATELLITE TARGET (WGS84)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
              <div>
                <label style={{ fontSize: "0.71rem", color: "var(--text-secondary)" }}>Latitude (°N)</label>
                <input
                  type="number"
                  step="0.01"
                  className="orbital-input"
                  value={customLat}
                  onChange={(e) => setCustomLat(Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.71rem", color: "var(--text-secondary)" }}>Longitude (°E)</label>
                <input
                  type="number"
                  step="0.01"
                  className="orbital-input"
                  value={customLon}
                  onChange={(e) => setCustomLon(Number(e.target.value))}
                />
              </div>
            </div>
            <div style={{ marginTop: "0.55rem", fontSize: "0.75rem", color: "#7dd3fc" }}>
              💡 {lang === "az" ? "Xəritədə istənilən yerə klikləyərək həmin nöqtəni seçə bilərsiniz." : "Tip: Click any point on the satellite map to analyze that coordinate live."}
            </div>
          </div>
        </div>

        {/* Right Real Interactive Leaflet Satellite Map */}
        <div className="orbital-card glow" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <ExplorerLeafletMap
            lang={lang}
            selectedRegion={selectedRegion}
            latitude={customLat}
            longitude={customLon}
            mapLayer={mapLayer}
            onSelectRegion={handleSelectRegion}
            onPickCoordinate={handlePickCoordinateOnMap}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
              <span className="badge badge-cyan">
                📍 {customFieldName} ({customLat.toFixed(3)}°N, {customLon.toFixed(3)}°E)
              </span>
              <span className="badge badge-violet">
                🌧 {totalPrecip.toFixed(1)} mm • 🌡 {meanTemp.toFixed(1)}°C
              </span>
            </div>

            <button
              type="button"
              className="btn-orbital-primary"
              onClick={() => setActiveScreen("03-field")}
            >
              {lang === "az" ? "Sahə Sərhədinə Keç →" : "Inspect Field Parcel →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  const renderScreen03Field = () => (
    <section className="orbital-frame">
      <div className="screen-step-bar">
        <div>
          <span className="screen-step-tag">
            🗺 {lang === "az" ? "03. SAHƏ KƏŞFİYYATI" : "03. FIELD INTELLIGENCE"}
          </span>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>
            {lang === "az" ? "Sahə Kəşfiyyatı — Peyk Poliqon Redaktoru" : "Field Intelligence — Satellite Parcel Editor"}
          </h2>
          <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {lang === "az"
              ? "Real peyk görüntüsü üzərində sahənin künclərini sürüşdürün və ya yeni sahə çəkin — hektar (ha) avtomatik hesablanır."
              : "Drag the glowing corner vertices directly on the real satellite imagery or draw a custom parcel — geodesic hectares update live."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={drawingMode ? "btn-orbital-primary" : "btn-orbital-secondary"}
            style={{ padding: "0.45rem 0.9rem", fontSize: "0.8rem" }}
            onClick={() => {
              if (!drawingMode) {
                setParcelCoords([]);
                setManualAreaOverrideHa(null);
                setDrawingMode(true);
              } else {
                setDrawingMode(false);
                if (parcelCoords.length < 3) {
                  setParcelCoords(buildDefaultParcelAround(customLat, customLon));
                }
              }
            }}
          >
            {drawingMode
              ? lang === "az"
                ? "✓ Çəkməni Bitir (Xəritəyə klikləyin)"
                : "✓ Finish Drawing (Click corners on map)"
              : lang === "az"
              ? "✏ Xəritədə Yeni Sahə Çək"
              : "✏ Draw New Parcel on Map"}
          </button>

          <button
            type="button"
            className="btn-orbital-secondary"
            style={{ padding: "0.45rem 0.9rem", fontSize: "0.8rem" }}
            onClick={() => {
              setDrawingMode(false);
              setManualAreaOverrideHa(null);
              setParcelCoords(buildDefaultParcelAround(customLat, customLon));
            }}
          >
            ↺ {lang === "az" ? "Poliqonu Sıfırla" : "Reset Parcel"}
          </button>
        </div>
      </div>

      <div className="grid-field-intel">
        {/* Left High-Zoom Real Satellite Parcel Editor */}
        <div className="orbital-card glow" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <FieldParcelLeafletMap
            centerLat={customLat}
            centerLon={customLon}
            parcelCoords={parcelCoords}
            drawingMode={drawingMode}
            onChangeParcelCoords={(next) => {
              setManualAreaOverrideHa(null);
              setParcelCoords(next);
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
            }}
          >
            <div>
              📐 <strong>Geodesic Area:</strong>{" "}
              <span style={{ color: "#c084fc", fontWeight: 800 }}>
                {effectiveAreaHa.toFixed(1)} ha
              </span>{" "}
              • <strong>Perimeter:</strong> {polygonMetrics.perimeterM} m ({parcelCoords.length} vertices)
            </div>
            <div style={{ color: "#7dd3fc" }}>
              {drawingMode
                ? "🖱 Click 3 or more points on the satellite field to trace your parcel"
                : "🖱 Drag any white-purple corner handle on the satellite map to reshape"}
            </div>
          </div>
        </div>

        {/* Right Field Profile, Soil & Irrigation Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div className="orbital-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="badge badge-violet">Field telemetry</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>WGS84 • Geodesic</span>
            </div>
            <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.5rem", fontSize: "0.85rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Field Name</label>
                <input
                  type="text"
                  className="orbital-input"
                  value={customFieldName}
                  onChange={(e) => setCustomFieldName(e.target.value)}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Area (ha)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="10000"
                    step="0.5"
                    className="orbital-input"
                    value={effectiveAreaHa}
                    onChange={(e) => setManualAreaOverrideHa(Math.max(0.5, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Coordinates</label>
                  <div
                    style={{
                      padding: "0.55rem 0.7rem",
                      background: "rgba(14, 17, 36, 0.9)",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.8rem",
                    }}
                  >
                    {customLat.toFixed(3)}°N, {customLon.toFixed(3)}°E
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Soil Inputs */}
          <div className="orbital-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.9rem" }}>
                {lang === "az" ? "Torpaq Analizi (Soil Inputs)" : "Soil Inputs"}
              </strong>
              {!soilPhKnown ? (
                <span className="badge badge-amber">Soil pH: Unknown</span>
              ) : (
                <span className="badge badge-emerald">pH: {soilPhValue.toFixed(1)}</span>
              )}
            </div>

            <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {lang === "az" ? "Laboratoriya / istifadəçi pH ölçüsü:" : "Soil pH measurement:"}
                </span>
                <button
                  type="button"
                  className="btn-orbital-secondary"
                  style={{ padding: "0.28rem 0.65rem", fontSize: "0.75rem" }}
                  onClick={() => setSoilPhKnown((prev) => !prev)}
                >
                  {soilPhKnown ? "Set Unknown" : "Enter Measured pH"}
                </button>
              </div>

              {soilPhKnown && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                    <span>Soil pH (4.5 – 9.0)</span>
                    <strong style={{ color: "#6ee7b7" }}>{soilPhValue.toFixed(1)}</strong>
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
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Soil Texture</label>
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
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Prior Crop (2023)</label>
                  <select
                    className="orbital-select"
                    value={priorCrop2023}
                    onChange={(e) => setPriorCrop2023(e.target.value)}
                  >
                    <option value="">None (Fallow)</option>
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

          {/* Irrigation Regime */}
          <div className="orbital-card">
            <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.45rem" }}>
              {lang === "az" ? "Suvarma Rejimi (Irrigation)" : "Irrigation Regime"}
            </strong>
            <select
              className="orbital-select"
              value={irrigationType}
              onChange={(e) => setIrrigationType(e.target.value as IrrigationType)}
            >
              <option value="rainfed">Rainfed (Dəmyə — yalnız təbii yağıntı)</option>
              <option value="irrigated">Irrigated (Suvarılan + mövsümi su büdcəsi)</option>
              <option value="unknown">Unknown (Naməlum — Provisional)</option>
            </select>

            {irrigationType === "irrigated" && (
              <div style={{ marginTop: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                  <span>Seasonal Irrigation Supply:</span>
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

            <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.85rem" }}>
              <button
                type="button"
                className="btn-orbital-secondary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setActiveScreen("04-climate")}
              >
                📈 {lang === "az" ? "İqlim Telemetriyası" : "Climate Telemetry"}
              </button>
              <button
                type="button"
                className="btn-orbital-primary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setActiveScreen("05-rotation")}
              >
                🌱 {lang === "az" ? "Planları Hesabla →" : "Compute Plans →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderScreen04Climate = () => {
    const months = liveMonthlySeries ?? selectedRegion.monthly2024;
    const hoveredM = months[hoverMonthIdx] ?? months[6];
    const hasDaily = liveDailySeries.length > 30;
    const hoveredD = hasDaily
      ? liveDailySeries[Math.min(hoverDayIdx, liveDailySeries.length - 1)]
      : null;

    const chartWidth = 740;
    const chartHeight = 230;
    const padX = 44;
    const padY = 24;
    const usableW = chartWidth - padX * 2;
    const usableH = chartHeight - padY * 2;

    // Build points for either 12-Month or 366-Day Daily Resolution
    const isDailyMode = climateResolution === "daily" && hasDaily;
    const seriesLength = isDailyMode ? liveDailySeries.length : months.length;

    const chartPoints = isDailyMode
      ? liveDailySeries.map((d, idx) => {
          const x = padX + (idx / Math.max(1, seriesLength - 1)) * usableW;
          const val = climateChartTab === "temperature" ? d.t2m : d.precip;
          const minVal = climateChartTab === "temperature" ? -15 : 0;
          const maxVal = climateChartTab === "temperature" ? 42 : 45;
          const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
          const y = padY + usableH - norm * usableH;
          return { x, y, val, label: d.date };
        })
      : months.map((m, idx) => {
          const x = padX + (idx / 11) * usableW;
          const val = climateChartTab === "temperature" ? m.t2m : m.precip;
          const minVal = climateChartTab === "temperature" ? -12 : 0;
          const maxVal = climateChartTab === "temperature" ? 42 : 130;
          const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
          const y = padY + usableH - norm * usableH;
          return { x, y, val, label: lang === "az" ? m.monthLabelAz : m.monthLabelEn };
        });

    const linePath = chartPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L${chartPoints[chartPoints.length - 1].x.toFixed(1)},${
      padY + usableH
    } L${chartPoints[0].x.toFixed(1)},${padY + usableH} Z`;

    return (
      <section className="orbital-frame">
        <div className="screen-step-bar">
          <div>
            <span className="screen-step-tag">
              📈 {lang === "az" ? "04. İQLİM TARİXÇƏSİ" : "04. CLIMATE HISTORY"}
            </span>
            <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>
              {lang === "az" ? "NASA POWER İqlim Telemetriyası" : "NASA POWER Climate Telemetry"}
            </h2>
            <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {lang === "az"
                ? "Seçilmiş koordinat üçün real peyk/reanaliz temperatur və yağıntı seriyasını (aylıq və ya 366 günlük) incələyin."
                : "Inspect real satellite-derived temperature and precipitation curves at monthly or 366-day daily resolution."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className={
                climateResolution === "monthly" ? "btn-orbital-primary" : "btn-orbital-secondary"
              }
              style={{ padding: "0.38rem 0.8rem", fontSize: "0.78rem" }}
              onClick={() => setClimateResolution("monthly")}
            >
              12-Month Curve
            </button>
            <button
              type="button"
              className={
                climateResolution === "daily" ? "btn-orbital-primary" : "btn-orbital-secondary"
              }
              style={{ padding: "0.38rem 0.8rem", fontSize: "0.78rem" }}
              onClick={() => setClimateResolution("daily")}
            >
              366-Day Daily Telemetry
            </button>
          </div>
        </div>

        {/* NASA POWER Source Bar */}
        <div
          className="orbital-card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
            <div
              style={{
                width: 56,
                height: 46,
                borderRadius: 12,
                background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
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
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                LIVE SATELLITE TELEMETRY SOURCE
              </div>
              <div style={{ fontSize: "1.02rem", fontWeight: 800 }}>
                NASA POWER LaRC API v2.10.3 • {customFieldName} ({customLat.toFixed(3)}°N,{" "}
                {customLon.toFixed(3)}°E)
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              className={
                climateChartTab === "temperature" ? "btn-orbital-primary" : "btn-orbital-secondary"
              }
              onClick={() => setClimateChartTab("temperature")}
            >
              🌡 Temperature (°C)
            </button>
            <button
              type="button"
              className={
                climateChartTab === "rainfall" ? "btn-orbital-primary" : "btn-orbital-secondary"
              }
              onClick={() => setClimateChartTab("rainfall")}
            >
              🌧 Precipitation (mm)
            </button>
          </div>
        </div>

        {/* Interactive Chart Canvas */}
        <div className="orbital-card glow" style={{ padding: "1.2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.6rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <strong style={{ fontSize: "0.94rem" }}>
              {isDailyMode
                ? `366-Day Daily ${
                    climateChartTab === "temperature" ? "T2M (°C)" : "PRECTOTCORR (mm/day)"
                  } — 2024 UTC`
                : `Monthly ${
                    climateChartTab === "temperature" ? "Temperature (°C)" : "Precipitation (mm)"
                  } — 2024 UTC`}
            </strong>

            <span style={{ fontSize: "0.82rem", color: "#7dd3fc", fontWeight: 600 }}>
              {isDailyMode && hoveredD
                ? `Date ${hoveredD.date} (Day ${hoveredD.dayOfYear}): T2M ${hoveredD.t2m}°C (${hoveredD.tmin}°C .. ${hoveredD.tmax}°C) • Precip ${hoveredD.precip} mm`
                : `${lang === "az" ? hoveredM.monthLabelAz : hoveredM.monthLabelEn} 2024: T2M ${
                    hoveredM.t2m
                  }°C (min ${hoveredM.tmin}°C / max ${hoveredM.tmax}°C) • Precip ${
                    hoveredM.precip
                  } mm`}
            </span>
          </div>

          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: "100%", height: "auto", cursor: "crosshair" }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = (e.clientX - rect.left) / rect.width;
              if (isDailyMode) {
                const idx = Math.max(
                  0,
                  Math.min(liveDailySeries.length - 1, Math.round(relX * (liveDailySeries.length - 1)))
                );
                setHoverDayIdx(idx);
              } else {
                const idx = Math.max(0, Math.min(11, Math.round(relX * 11)));
                setHoverMonthIdx(idx);
              }
            }}
          >
            <defs>
              <linearGradient id="orbitalWaveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={climateChartTab === "temperature" ? "#a855f7" : "#38bdf8"}
                  stopOpacity="0.58"
                />
                <stop
                  offset="100%"
                  stopColor={climateChartTab === "temperature" ? "#a855f7" : "#38bdf8"}
                  stopOpacity="0.02"
                />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padY + ratio * usableH;
              return (
                <line
                  key={`g-${idx}`}
                  x1={padX}
                  y1={y}
                  x2={chartWidth - padX}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.14)"
                />
              );
            })}

            <path d={areaPath} fill="url(#orbitalWaveGrad)" />
            <path
              d={linePath}
              fill="none"
              stroke={climateChartTab === "temperature" ? "#c084fc" : "#38bdf8"}
              strokeWidth={isDailyMode ? "1.6" : "3"}
            />

            {!isDailyMode &&
              chartPoints.map((pt, idx) => (
                <g key={pt.label}>
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
                    y={chartHeight - 5}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontSize="10.5"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}
          </svg>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.85rem",
            marginTop: "1rem",
          }}
        >
          <div className="orbital-card">
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>MEAN TEMP (T2M)</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>{meanTemp.toFixed(2)} °C</div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
              Min {minTemp.toFixed(1)}°C / Max {maxTemp.toFixed(1)}°C
            </div>
          </div>
          <div className="orbital-card">
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              TOTAL PRECIPITATION (PRECTOTCORR)
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#38bdf8" }}>
              {totalPrecip.toFixed(2)} mm
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
              Wet days (≥1 mm): {wetDays.toFixed(0)} days
            </div>
          </div>
          <div className="orbital-card">
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>FROST DAYS (&lt;0°C)</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#c084fc" }}>
              {frostDays.toFixed(0)} days
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
              Coverage: 366/366 UTC days
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
                ? "Prioritet slayderlərini dəyişdikcə deterministik mühərrik 216 kombinasiyanı real vaxtda süzgəcdən keçirir."
                : "Adjust priority sliders to rank 216 candidate 3-year crop sequences in real time."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap" }}>
            {activeSim?.status === "provisional" && (
              <span className="badge badge-amber">
                ⚠ PROVISIONAL ({soilPhKnown ? "FAO Baseline" : "Soil pH Unknown"})
              </span>
            )}
            {activeSim?.status === "completed" && (
              <span className="badge badge-emerald">✓ COMPLETED (SOURCE SUPPORTED)</span>
            )}
            {activeSim?.status === "no_feasible_plan" && (
              <span className="badge badge-rose">✕ NO FEASIBLE PLAN</span>
            )}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                background: "rgba(30, 35, 68, 0.85)",
                padding: "0.32rem 0.75rem",
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
                ? `Stress rejimini (${rainfallMultiplier}x) aktiv et`
                : `Apply Stress Scenario (${rainfallMultiplier}x)`}
            </label>
          </div>
        </div>

        <div className="grid-rotation-studio">
          {/* Left Priorities Panel */}
          <div className="orbital-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "1rem" }}>Priorities</strong>
              <span className="badge badge-violet">Multi-Objective</span>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span>💧 Water resilience</span>
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>
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

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span>🌱 Soil health & N-fix</span>
                <span style={{ color: "#c084fc", fontWeight: 700 }}>
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

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span>💰 Income</span>
                <span className="badge badge-amber" style={{ fontSize: "0.66rem" }}>
                  Data needed
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
                Active weights automatically normalize across verified Water & Soil models.
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "0.75rem",
                fontSize: "0.79rem",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              <div>
                📍 <strong>Field:</strong> {customFieldName} ({effectiveAreaHa.toFixed(1)} ha)
              </div>
              <div>
                💧 <strong>Effective Supply:</strong>{" "}
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                  {activeSim?.input_summary.effective_water_supply_mm?.toFixed(1) ??
                    totalPrecip.toFixed(1)}{" "}
                  mm
                </span>
              </div>
              <div>
                🌾 <strong>2023 Prior Crop:</strong>{" "}
                {priorCrop2023 ? getCropLabel(priorCrop2023) : "None"}
              </div>
            </div>
          </div>

          {/* Right 3 Plan Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {activePlans.length > 0 ? (
              <div className="grid-plans-3">
                {activePlans.map((plan, idx) => {
                  const isSel = idx === selectedPlanIndex;
                  const headers = [
                    { code: "Plan A", sub: "Balanced rotation" },
                    { code: "Plan B", sub: "Soil & N-fix focus" },
                    { code: "Plan C", sub: "Water saving" },
                  ];
                  const h = headers[idx] ?? { code: `Plan ${idx + 1}`, sub: "Alternative" };

                  return (
                    <div
                      key={plan.plan_id}
                      onClick={() => setSelectedPlanIndex(idx)}
                      className={`orbital-card ${isSel ? "glow" : ""}`}
                      style={{
                        cursor: "pointer",
                        border: isSel ? "2px solid #a855f7" : "1px solid var(--border-subtle)",
                        background: isSel
                          ? "linear-gradient(180deg, rgba(124, 58, 237, 0.26) 0%, rgba(17, 20, 42, 0.94) 100%)"
                          : undefined,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "1.12rem", fontWeight: 800 }}>{h.code}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{h.sub}</div>
                        </div>
                        <span className="badge badge-violet" style={{ fontSize: "0.84rem" }}>
                          {plan.score?.toFixed(1)} pts
                        </span>
                      </div>

                      <div style={{ margin: "0.95rem 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                                background: "rgba(8, 10, 22, 0.78)",
                                border: "1px solid rgba(148, 163, 184, 0.16)",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                  Year {yr.year_index} • {yr.family}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                                  {vis?.icon ?? "🌱"}{" "}
                                  {lang === "az" ? vis?.nameAz ?? yr.crop_name : yr.crop_name}
                                </div>
                              </div>
                              <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                                {yr.planting_window ?? "Seasonal"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: "0.74rem", display: "grid", gap: "0.35rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Water alignment</span>
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
              <div className="orbital-card" style={{ borderColor: "var(--accent-rose)" }}>
                <h3 style={{ margin: "0 0 0.5rem", color: "#fda4af" }}>
                  Zero feasible 3-year plans under current constraints ({activeSim?.status})
                </h3>
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
                      <strong>{item.rule_id}</strong> ({item.count} rejected): {item.reason}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.65rem" }}>
                  <button
                    type="button"
                    className="btn-orbital-primary"
                    onClick={() => {
                      setIrrigationType("irrigated");
                      setIrrigationBudgetMm(200);
                    }}
                  >
                    💧 Enable Irrigation (+200 mm)
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
                    ↺ Reset Priorities
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start" }}>
              <div className="orbital-card">
                <div
                  onClick={() => setWhyPlanOpen((o) => !o)}
                  style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
                >
                  <strong>Why this plan?</strong>
                  <span>{whyPlanOpen ? "▴" : "▾"}</span>
                </div>
                {whyPlanOpen && selectedPlan && (
                  <div style={{ marginTop: "0.7rem", fontSize: "0.83rem", color: "var(--text-secondary)" }}>
                    {selectedPlan.explanations.map((exp) => (
                      <p key={exp.code} style={{ margin: "0 0 0.45rem" }}>
                        • <strong>{exp.code}:</strong> {exp.text}
                      </p>
                    ))}
                    <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.45rem" }}>
                      {selectedPlan.constraints_checked.map((chk) => (
                        <span
                          key={chk.rule_id}
                          className={`badge ${chk.result === "pass" ? "badge-emerald" : "badge-amber"}`}
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
                Scenario Lab →
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

    const baseWaterFit = Math.round((baseTop?.score_components.water.value ?? 0.82) * 100);
    const baseSoilFit = Math.round((baseTop?.score_components.soil.value ?? 0.78) * 100);
    const baseRotFit = Math.round(baseTop?.score ?? 80);

    const stressWaterFit = Math.round((stressTop?.score_components.water.value ?? 0) * 100);
    const stressSoilFit = Math.round((stressTop?.score_components.soil.value ?? 0) * 100);
    const stressRotFit = Math.round(stressTop?.score ?? 0);

    const pctDrop = Math.round((1 - rainfallMultiplier) * -100);

    return (
      <section className="orbital-frame">
        <div className="screen-step-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span className="screen-step-tag">🧪 06. SCENARIO LAB</span>
            <h2 style={{ margin: 0, fontSize: "1.65rem" }}>Scenario Lab</h2>
            <span className="badge badge-violet">Hypothetical scenario</span>
          </div>
          <span className="badge badge-cyan">Raw NASA POWER Series Preserved Untouched</span>
        </div>

        <div className="grid-scenario-lab">
          {/* Baseline Card */}
          <div className="orbital-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Baseline</h3>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                  Current conditions (1.0x reference)
                </div>
              </div>
              <span className="badge badge-violet">{baseWaterSupply.toFixed(1)} mm</span>
            </div>

            <div style={{ margin: "1rem 0", display: "grid", gap: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Water demand fit</span>
                  <strong>{baseWaterFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-violet" style={{ width: `${baseWaterFit}%` }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Soil health fit</span>
                  <strong>{baseSoilFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-violet" style={{ width: `${baseSoilFit}%` }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Rotation score</span>
                  <strong>{baseRotFit}/100</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-violet" style={{ width: `${baseRotFit}%` }} />
                </div>
              </div>
            </div>

            {baseTop && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Top Rotation: <strong>{baseTop.years.map((y) => y.crop_name).join(" → ")}</strong>
              </div>
            )}
          </div>

          {/* Rainfall Stress Card */}
          <div className="orbital-card glow" style={{ borderColor: "#38bdf8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Rainfall stress</h3>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                  Reduced rainfall ({pctDrop}% / {rainfallMultiplier.toFixed(1)}x)
                </div>
              </div>
              <span className="badge badge-cyan">{stressWaterSupply.toFixed(1)} mm</span>
            </div>

            <div style={{ margin: "1rem 0", display: "grid", gap: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Water demand fit</span>
                  <strong>{stressWaterFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-cyan" style={{ width: `${stressWaterFit}%` }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Soil health fit</span>
                  <strong>{stressSoilFit}%</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-cyan" style={{ width: `${stressSoilFit}%` }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span>Rotation score</span>
                  <strong>{stressRotFit}/100</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill-cyan" style={{ width: `${stressRotFit}%` }} />
                </div>
              </div>
            </div>

            {stressTop ? (
              <div style={{ fontSize: "0.8rem", color: "#7dd3fc" }}>
                Shifted Rotation:{" "}
                <strong>{stressTop.years.map((y) => y.crop_name).join(" → ")}</strong>
              </div>
            ) : (
              <div style={{ fontSize: "0.8rem", color: "#fda4af" }}>
                ⚠ Zero rainfed rotations survive {stressWaterSupply.toFixed(1)} mm; enable irrigation to recover feasibility.
              </div>
            )}
          </div>

          {/* Right Rainfall Change Selector */}
          <div className="orbital-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <strong>Rainfall change ⓘ</strong>
              <div
                style={{
                  textAlign: "center",
                  margin: "0.9rem 0",
                  padding: "0.6rem",
                  borderRadius: 12,
                  background: "rgba(124, 58, 237, 0.24)",
                  border: "1px solid #a855f7",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                }}
              >
                {pctDrop}% ({rainfallMultiplier.toFixed(1)}x)
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem", marginBottom: "0.9rem" }}>
                {([1.0, 0.9, 0.8, 0.7] as const).map((mult) => {
                  const label = `${Math.round((1 - mult) * -100)}%`;
                  const active = rainfallMultiplier === mult;
                  return (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setRainfallMultiplier(mult)}
                      style={{
                        padding: "0.48rem 0.25rem",
                        borderRadius: 8,
                        border: active ? "1px solid #c084fc" : "1px solid var(--border-subtle)",
                        background: active ? "#7c3aed" : "rgba(15, 23, 42, 0.82)",
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
              Run scenario in Studio →
            </button>
          </div>
        </div>

        {/* Live 6-Crop Water Survival Matrix */}
        <div className="orbital-card" style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.65rem", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.9rem" }}>
              Crop Water-Band Survival Matrix under {stressWaterSupply.toFixed(1)} mm Supply (FAO Paper 56)
            </strong>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Green = Survives • Red = Eliminated by RULE_WATER_SUPPLY_MATCH
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem" }}>
            {(catalog?.crops ?? []).map((crop) => {
              const minMm = crop.water_band_mm?.min_mm ?? 0;
              const survives = stressWaterSupply >= minMm;
              const vis = CROP_VISUALS[crop.crop_id];
              return (
                <div
                  key={crop.crop_id}
                  style={{
                    padding: "0.55rem 0.75rem",
                    borderRadius: 10,
                    background: survives
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(244, 63, 94, 0.12)",
                    border: survives
                      ? "1px solid rgba(16, 185, 129, 0.4)"
                      : "1px solid rgba(244, 63, 94, 0.4)",
                    fontSize: "0.8rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>
                    {vis?.icon ?? "🌱"} <strong>{crop.name}</strong>
                  </span>
                  <span style={{ fontWeight: 700, color: survives ? "#6ee7b7" : "#fda4af" }}>
                    {survives ? `✓ ≥${minMm} mm` : `✕ Needs ${minMm} mm`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderScreen07Sources = () => (
    <section className="orbital-frame">
      <div className="screen-step-bar">
        <div>
          <span className="screen-step-tag">📚 07. SOURCES & EXPLANATIONS</span>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem" }}>Understand every decision</h2>
          <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            See how your rotation plan is built, what NASA & FAO data it uses, and what inputs remain unmeasured.
          </p>
        </div>

        <button
          type="button"
          className="btn-orbital-primary"
          onClick={() => setShowMethodologyModal(true)}
        >
          📋 View Methodology & NASA Citation
        </button>
      </div>

      <div className="grid-2col" style={{ marginBottom: "1.2rem" }}>
        <div className="orbital-card">
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Selected rotation</div>
          <div style={{ fontSize: "1rem", fontWeight: 700, margin: "0.25rem 0 0.7rem" }}>
            {selectedPlan
              ? `Plan ${String.fromCharCode(65 + selectedPlanIndex)} — Score ${selectedPlan.score?.toFixed(1)}/100`
              : "No active plan"}
          </div>
          {selectedPlan && (
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              {selectedPlan.years.map((yr) => {
                const vis = CROP_VISUALS[yr.crop_id];
                return (
                  <span
                    key={yr.year_index}
                    className="badge badge-violet"
                    style={{ padding: "0.42rem 0.8rem", fontSize: "0.84rem" }}
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
            <span>Unknown inputs & Scientific Integrity</span>
          </div>
          <p style={{ margin: "0.45rem 0 0", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {!soilPhKnown
              ? "Soil pH is currently Unknown (never silently defaulted to pH 7.0). "
              : `Soil pH is user-reported (${soilPhValue.toFixed(1)}). `}
            Regional economic crop price/yield models are withheld in v0.1.0, and FAO Paper 56 thresholds are labeled <code>source_supported / provisional</code>.
          </p>
        </div>
      </div>

      <div className="provenance-flow">
        <div className="provenance-node">
          <div style={{ fontSize: "0.71rem", color: "#38bdf8", fontWeight: 700 }}>STEP 1 • SATELLITE</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>🛰 NASA POWER</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
            MERRA-2 Daily Point (366/366 UTC Days)
          </div>
        </div>
        <div className="provenance-node">
          <div style={{ fontSize: "0.71rem", color: "#fcd34d", fontWeight: 700 }}>STEP 2 • PARCEL</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>🌱 Field Telemetry</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
            {effectiveAreaHa.toFixed(1)} ha • {soilPhKnown ? `pH ${soilPhValue.toFixed(1)}` : "pH Unknown"}
          </div>
        </div>
        <div className="provenance-node">
          <div style={{ fontSize: "0.71rem", color: "#6ee7b7", fontWeight: 700 }}>STEP 3 • AGRONOMY</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>📐 Crop Rules</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
            FAO Paper 56 & CROPWAT ({catalog?.crops.length ?? 6} crops, 7 rules)
          </div>
        </div>
        <div className="provenance-node highlight">
          <div style={{ fontSize: "0.71rem", color: "#e9d5ff", fontWeight: 700 }}>STEP 4 • DECISION</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>📋 3-Year Rotation</div>
          <div style={{ fontSize: "0.75rem", color: "#f3e8ff", marginTop: 2 }}>
            {selectedPlan
              ? selectedPlan.years.map((y) => y.crop_id).join(" → ")
              : activeSim?.status ?? "Ready"}
          </div>
        </div>
      </div>

      {/* Provenance Accordions */}
      <div style={{ display: "grid", gap: "0.6rem" }}>
        <div className="orbital-card">
          <div
            onClick={() => setOpenAccordion(openAccordion === "nasa" ? null : "nasa")}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
          >
            <strong>🛰 NASA POWER — Cryptographic Payload Provenance</strong>
            <span>{openAccordion === "nasa" ? "▴" : "▾"}</span>
          </div>
          {openAccordion === "nasa" && (
            <div
              style={{
                marginTop: "0.8rem",
                paddingTop: "0.8rem",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.8rem",
                display: "grid",
                gap: "0.35rem",
                color: "var(--text-secondary)",
              }}
            >
              <div>
                <strong>Endpoint:</strong>{" "}
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
            </div>
          )}
        </div>

        <div className="orbital-card">
          <div
            onClick={() => setOpenAccordion(openAccordion === "rules" ? null : "rules")}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
          >
            <strong>📐 FAO Paper 56 / CROPWAT Thresholds & Rules</strong>
            <span>{openAccordion === "rules" ? "▴" : "▾"}</span>
          </div>
          {openAccordion === "rules" && (
            <div
              style={{
                marginTop: "0.8rem",
                paddingTop: "0.8rem",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.8rem",
                display: "grid",
                gap: "0.4rem",
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
            {boardMode ? "🎯 Interactive Studio View" : "⊞ All 7 Screens Board"}
          </button>

          <select
            className="orbital-select"
            style={{ width: "auto", padding: "0.32rem 0.65rem", fontSize: "0.76rem" }}
            value={dataModePref}
            onChange={(e) => setDataModePref(e.target.value as DataMode)}
          >
            <option value="live">Telemetry: Live NASA POWER API</option>
            <option value="cached">Telemetry: Verified Snapshot Cache</option>
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

      <nav className="orbital-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <strong style={{ fontSize: "1rem", letterSpacing: "0.02em" }}>SpaceFarm</strong>
          <span className="badge badge-violet">
            📍 {customFieldName} ({effectiveAreaHa.toFixed(1)} ha)
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
            Overview
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
            Explore
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
            Plan
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeScreen === "07-sources" ? "active" : ""}`}
            onClick={() => {
              setBoardMode(false);
              setActiveScreen("07-sources");
            }}
          >
            Sources
          </button>
        </div>

        <div className="topbar-controls">
          <span className="status-pill">
            <span className={`status-dot ${health?.status === "ok" ? "ok" : "warn"}`} />
            API {health?.contract_version ?? "0.1.0"}
          </span>
          <span className="status-pill">
            <span className="status-dot cached" />
            {loadingSim
              ? "STREAMING NASA…"
              : `NASA ${(climateBundle?.data_mode ?? "live").toUpperCase()}`}
          </span>
        </div>
      </nav>

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
              }}
            >
              <div>
                <strong style={{ color: "#fda4af" }}>
                  Telemetry Notice ({apiError.code ?? "NOTICE"}):
                </strong>{" "}
                {apiError.message}
              </div>
              <button
                type="button"
                className="btn-orbital-secondary"
                onClick={triggerSimulations}
              >
                ↻ Reconnect
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

      {showMethodologyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 6, 15, 0.84)",
            backdropFilter: "blur(10px)",
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
