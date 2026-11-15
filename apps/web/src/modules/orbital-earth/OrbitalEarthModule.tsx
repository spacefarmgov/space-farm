import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EarthSatelliteCanvas } from "./components/EarthSatelliteCanvas";
import { SatelliteFieldMap } from "./components/SatelliteFieldMap";
import {
  buildParcelAroundPoint,
  computeGeodesicAreaHa,
  DEFAULT_NASA_SATELLITE_TLES,
  ORBITAL_PRESETS,
  SATELLITE_FILTERS,
} from "./data/presets";
import { AZ_DISTRICTS, findAzDistrict } from "../../data/azDistricts";
import {
  fetchGlobalRealWindGrid,
  fetchLiveSatelliteTles,
  fetchPointWeatherAndClimate,
  sampleWindField,
} from "./services/realTelemetry";
import type {
  ActiveSatelliteId,
  EarthCameraMode,
  LiveClimateSnapshot,
  OrbitalEarthModuleProps,
  OrbitalStageMode,
  RealSatelliteTelemetry,
  RealWeatherSnapshot,
  RealWindGridPoint,
  SatelliteFilterMode,
  SatellitePovStyle,
  SatelliteTleRecord,
  SelectedOrbitalLocation,
} from "./types";

function matchNearestPreset(lat: number, lon: number) {
  return ORBITAL_PRESETS.find(
    (p) => Math.hypot(p.lat - lat, p.lon - lon) < 0.08
  );
}

function matchNearestAzDistrict(lat: number, lon: number) {
  let best = null as (typeof AZ_DISTRICTS)[number] | null;
  let bestDist = 0.08;
  for (const d of AZ_DISTRICTS) {
    const dist = Math.hypot(d.lat - lat, d.lon - lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

export const OrbitalEarthModule: React.FC<OrbitalEarthModuleProps> = ({
  initialLat = 40.68,
  initialLon = 46.36,
  language: initialLang = "en",
  apiBaseUrl = "",
  onLocationSelect,
  onRegionSelected,
  onConfirmProceed,
  onLanguageChange,
  onFilterChange,
}) => {
  const initialPreset = useMemo(
    () => matchNearestPreset(initialLat, initialLon) ?? ORBITAL_PRESETS[0],
    [initialLat, initialLon]
  );

  const [language, setLanguage] = useState<"en" | "az">(initialLang);
  useEffect(() => {
    setLanguage(initialLang);
  }, [initialLang]);
  const [stageMode, setStageMode] = useState<OrbitalStageMode>("globe");
  const [selectedLat, setSelectedLat] = useState<number>(initialLat);
  const [selectedLon, setSelectedLon] = useState<number>(initialLon);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    matchNearestPreset(initialLat, initialLon)?.id ?? null
  );
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [polygon, setPolygon] = useState<Array<[number, number]>>(() =>
    initialPreset && Math.hypot(initialPreset.lat - initialLat, initialPreset.lon - initialLon) < 0.08
      ? initialPreset.polygon
      : buildParcelAroundPoint(initialLat, initialLon)
  );
  const [areaHa, setAreaHa] = useState<number>(() =>
    computeGeodesicAreaHa(
      initialPreset && Math.hypot(initialPreset.lat - initialLat, initialPreset.lon - initialLon) < 0.08
        ? initialPreset.polygon
        : buildParcelAroundPoint(initialLat, initialLon)
    )
  );

  const [filterMode, setFilterMode] = useState<SatelliteFilterMode>("normal");
  const [cameraMode, setCameraMode] = useState<EarthCameraMode>("orbit");
  const [satPovStyle, setSatPovStyle] = useState<SatellitePovStyle>("aperture");
  const [activeSatelliteId, setActiveSatelliteId] = useState<ActiveSatelliteId>("terra");
  const [satOverflyTarget, setSatOverflyTarget] = useState<boolean>(false);
  const [targetDetailsOpen, setTargetDetailsOpen] = useState<boolean>(false);
  const [filterInfoOpen, setFilterInfoOpen] = useState<boolean>(false);

  const [tles, setTles] = useState<Record<ActiveSatelliteId, SatelliteTleRecord>>(
    DEFAULT_NASA_SATELLITE_TLES
  );
  const [satTelemetry, setSatTelemetry] = useState<RealSatelliteTelemetry>({
    id: "terra",
    name: DEFAULT_NASA_SATELLITE_TLES.terra.name,
    noradId: 25994,
    lat: 40.68,
    lon: 46.36,
    altitudeKm: 705.2,
    velocityKms: 7.51,
    isLiveUtc: true,
    instrument: DEFAULT_NASA_SATELLITE_TLES.terra.instrument,
  });

  const [windGrid, setWindGrid] = useState<RealWindGridPoint[]>([]);
  const [weather, setWeather] = useState<RealWeatherSnapshot>({
    status: "loading",
    tempC: null,
    apparentTempC: null,
    windSpeedMs: null,
    windDirDeg: null,
    humidityPct: null,
    cloudCoverPct: null,
    soilTemp0Cm: null,
  });
  const [climate, setClimate] = useState<LiveClimateSnapshot>({ status: "idle" });

  // Dive telemetry overlay state
  const [diveAltitudeKm, setDiveAltitudeKm] = useState<number>(1850);
  const [diveProgress, setDiveProgress] = useState<number>(0);

  const activePreset = useMemo(
    () => (selectedPresetId ? ORBITAL_PRESETS.find((p) => p.id === selectedPresetId) ?? null : null),
    [selectedPresetId]
  );

  const locationLabel = useMemo(() => {
    if (activePreset) return language === "az" ? activePreset.nameAz : activePreset.nameEn;
    if (selectedPresetId) {
      const dist = findAzDistrict(selectedPresetId);
      if (dist) {
        return language === "az"
          ? `${dist.nameAz} (${dist.economicRegionAz})`
          : `${dist.nameEn} (${dist.economicRegionEn})`;
      }
    }
    if (customLabel) return customLabel;
    return language === "az"
      ? `Sektor (${selectedLat.toFixed(2)}°N, ${selectedLon.toFixed(2)}°E)`
      : `Sector (${selectedLat.toFixed(2)}°N, ${selectedLon.toFixed(2)}°E)`;
  }, [customLabel, activePreset, selectedPresetId, language, selectedLat, selectedLon]);

  // Fetch live TLEs + Global Real Wind/Temperature Grid once on mount
  useEffect(() => {
    let mounted = true;
    fetchLiveSatelliteTles(apiBaseUrl).then((res) => {
      if (mounted) setTles(res);
    });
    fetchGlobalRealWindGrid(apiBaseUrl).then((grid) => {
      if (mounted) setWindGrid(grid);
    });
    return () => {
      mounted = false;
    };
  }, [apiBaseUrl]);

  // Fetch live Open-Meteo point surface weather + optional SpaceFarm NASA POWER stats on selection
  useEffect(() => {
    let cancelled = false;
    setWeather((prev) => ({ ...prev, status: "loading" }));
    fetchPointWeatherAndClimate(selectedLat, selectedLon, apiBaseUrl).then(
      ({ weather: nextWeather, climate: nextClimate }) => {
        if (cancelled) return;
        setWeather(nextWeather);
        setClimate(nextClimate);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedLat, selectedLon, apiBaseUrl]);

  const emitSelection = useCallback(
    (
      lat: number,
      lon: number,
      label: string,
      presetId: string | null,
      poly: Array<[number, number]>,
      ha: number,
      mode: SatelliteFilterMode
    ) => {
      if (!onLocationSelect && !onRegionSelected) return;
      const payload: SelectedOrbitalLocation = {
        lat,
        lon,
        label,
        presetId,
        filterMode: mode,
        polygon: poly,
        areaHa: ha,
      };
      onLocationSelect?.(payload);
      onRegionSelected?.(payload);
    },
    [onLocationSelect, onRegionSelected]
  );

  const handleSelectLocation = useCallback(
    (lat: number, lon: number, presetId: string | null, labelOverride?: string) => {
      const matched = presetId
        ? ORBITAL_PRESETS.find((p) => p.id === presetId) ?? null
        : matchNearestPreset(lat, lon) ?? null;
      const matchedDistrict = !matched ? matchNearestAzDistrict(lat, lon) : null;

      const resolvedPresetId = matched?.id ?? presetId ?? matchedDistrict?.id ?? null;
      const resolvedLat =
        matched && presetId ? matched.lat : matchedDistrict ? matchedDistrict.lat : lat;
      const resolvedLon =
        matched && presetId ? matched.lon : matchedDistrict ? matchedDistrict.lon : lon;
      const nextPoly = matched
        ? matched.polygon
        : buildParcelAroundPoint(resolvedLat, resolvedLon);
      const nextHa = matched ? matched.defaultAreaHa : computeGeodesicAreaHa(nextPoly);
      const nextLabel =
        labelOverride ??
        (matched
          ? language === "az"
            ? matched.nameAz
            : matched.nameEn
          : matchedDistrict
            ? language === "az"
              ? `${matchedDistrict.nameAz} (${matchedDistrict.economicRegionAz})`
              : `${matchedDistrict.nameEn} (${matchedDistrict.economicRegionEn})`
            : `${resolvedLat.toFixed(3)}°N, ${resolvedLon.toFixed(3)}°E`);

      setSelectedLat(resolvedLat);
      setSelectedLon(resolvedLon);
      setSelectedPresetId(resolvedPresetId);
      setCustomLabel(matched ? null : (labelOverride ?? nextLabel));
      setPolygon(nextPoly);
      setAreaHa(nextHa);

      emitSelection(resolvedLat, resolvedLon, nextLabel, resolvedPresetId, nextPoly, nextHa, filterMode);
    },
    [language, filterMode, emitSelection]
  );

  const handleRequestDive = useCallback(
    (lat: number, lon: number, presetId: string | null, labelOverride?: string) => {
      handleSelectLocation(lat, lon, presetId, labelOverride);
      if (stageMode === "globe") {
        setDiveAltitudeKm(1850);
        setDiveProgress(0);
        setCameraMode("orbit");
        setStageMode("diving");
      }
    },
    [handleSelectLocation, stageMode]
  );

  const handleEnterSatellitePov = useCallback(() => {
    setSatPovStyle("aperture");
    setCameraMode("satellite");
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stageMode === "map") {
        setStageMode("globe");
        setDiveProgress(0);
      } else if (cameraMode === "satellite") {
        setCameraMode("orbit");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stageMode, cameraMode]);

  const handleFilterChange = useCallback(
    (nextMode: SatelliteFilterMode) => {
      setFilterMode(nextMode);
      onFilterChange?.(nextMode);
      emitSelection(
        selectedLat,
        selectedLon,
        locationLabel,
        selectedPresetId,
        polygon,
        areaHa,
        nextMode
      );
    },
    [onFilterChange, emitSelection, selectedLat, selectedLon, locationLabel, selectedPresetId, polygon, areaHa]
  );

  const handlePolygonChange = useCallback(
    (nextPoly: Array<[number, number]>, nextHa: number) => {
      setPolygon(nextPoly);
      setAreaHa(nextHa);
      emitSelection(
        selectedLat,
        selectedLon,
        locationLabel,
        selectedPresetId,
        nextPoly,
        nextHa,
        filterMode
      );
    },
    [emitSelection, selectedLat, selectedLon, locationLabel, selectedPresetId, filterMode]
  );

  const triggerOrbitalDive = useCallback(() => {
    if (stageMode !== "globe") return;
    setDiveAltitudeKm(1850);
    setDiveProgress(0);
    setCameraMode("orbit");
    setStageMode("diving");
  }, [stageMode]);

  const handleDiveComplete = useCallback(() => {
    setStageMode("map");
    setDiveProgress(1);
  }, []);

  const handleReturnToGlobe = useCallback(() => {
    setStageMode("globe");
    setDiveProgress(0);
  }, []);

  const handleDiveProgress = useCallback((altKm: number, prog: number) => {
    setDiveAltitudeKm(altKm);
    setDiveProgress(prog);
  }, []);

  const activeTle = tles[activeSatelliteId];
  const activeFilterMeta = SATELLITE_FILTERS.find((f) => f.id === filterMode) ?? SATELLITE_FILTERS[0];
  const gridSample = useMemo(
    () => sampleWindField(windGrid, selectedLat, selectedLon),
    [windGrid, selectedLat, selectedLon]
  );

  const isAz = language === "az";
  const latestDiveRef = useRef(0);
  latestDiveRef.current = diveProgress;

  return (
    <div className={`sf-orbital-root sf-stage-${stageMode}`}>
      {/* STAGE 1 & 2: Full-Screen 3D Orbital Earth + Real NASA CAD Spacecraft */}
      <div
        className={`sf-globe-stage ${stageMode === "map" ? "is-hidden" : ""}`}
        aria-hidden={stageMode === "map"}
      >
        <EarthSatelliteCanvas
          selectedLat={selectedLat}
          selectedLon={selectedLon}
          selectedPresetId={selectedPresetId}
          filterMode={filterMode}
          cameraMode={cameraMode}
          satPovStyle={satPovStyle}
          activeSatelliteId={activeSatelliteId}
          satelliteTle={activeTle}
          satOverflyTarget={satOverflyTarget}
          windGrid={windGrid}
          isDiving={stageMode === "diving"}
          isPaused={stageMode === "map"}
          language={language}
          onSelectLocation={handleSelectLocation}
          onRequestDive={handleRequestDive}
          onEnterSatellitePov={handleEnterSatellitePov}
          onTelemetryUpdate={setSatTelemetry}
          onDiveProgress={handleDiveProgress}
          onDiveComplete={handleDiveComplete}
        />

        {/* Spacecraft Optical Sensor Aperture HUD (visible in Satellite POV) */}
        {stageMode === "globe" && cameraMode === "satellite" && (
          <div className="sf-cockpit-hud is-aperture">
            <div className="sf-cockpit-frame" aria-hidden="true">
              <div className="sf-cockpit-corner tl" />
              <div className="sf-cockpit-corner tr" />
              <div className="sf-cockpit-corner bl" />
              <div className="sf-cockpit-corner br" />
              <div className="sf-cockpit-nadir-crosshair" />
            </div>
            <div className="sf-cockpit-bar">
              <span className="sf-cockpit-status">
                <i />
                {satPovStyle === "aperture"
                  ? isAz
                    ? `${activeTle.id.toUpperCase()} OPTİK SENSOR • SABİT HƏDƏF (SÜRÜŞDÜR-FIRLAT)`
                    : `${activeTle.id.toUpperCase()} SENSOR POV • STEADY TARGET LOCK (DRAG TO PAN)`
                  : isAz
                  ? `${activeTle.id.toUpperCase()} OPTİK SENSOR • CANLI SGP4 ORBİT İZİ (7.5 KM/S)`
                  : `${activeTle.id.toUpperCase()} SENSOR POV • LIVE SGP4 ORBIT PASS (7.5 KM/S)`}
              </span>
              <div className="sf-cockpit-actions">
                <button
                  type="button"
                  className={satPovStyle === "aperture" ? "is-active" : ""}
                  onClick={() => setSatPovStyle("aperture")}
                >
                  {isAz ? "⌖ Sabit Hədəf" : "⌖ Steady Target"}
                </button>
                <button
                  type="button"
                  className={satPovStyle === "exterior" ? "is-active" : ""}
                  onClick={() => setSatPovStyle("exterior")}
                >
                  {isAz ? "🛰 Canlı SGP4 İzi" : "🛰 Live SGP4 Pass"}
                </button>
                <button
                  type="button"
                  className="sf-cockpit-exit"
                  onClick={() => setCameraMode("orbit")}
                >
                  {isAz ? "Orbitə Qayıt (ESC)" : "Exit POV (ESC)"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Atmospheric Hyper-Dive HUD & Transition Flash */}
        {stageMode === "diving" && (
          <div className="sf-dive-hud" aria-live="polite">
            <div className="sf-dive-reticle" />
            <div className="sf-dive-readout">
              <span className="sf-dive-tag">
                {isAz ? "ORBİTAL ENİŞ AKTİVDİR" : "ORBITAL INSERTION ACTIVE"}
              </span>
              <div className="sf-dive-alt">
                ALT: {String(diveAltitudeKm).padStart(4, "0")} KM
              </div>
              <div className="sf-dive-target">
                {locationLabel} • {selectedLat.toFixed(3)}°N {selectedLon.toFixed(3)}°E
              </div>
            </div>
            <div
              className="sf-dive-cloud-flash"
              style={{
                opacity: diveProgress > 0.72 ? Math.min(0.92, (diveProgress - 0.72) * 3.4) : 0,
              }}
            />
          </div>
        )}

        {/* Top Floating Aerospace Header & Quick Region Switcher */}
        <header className="sf-hud-topbar">
          <div className="sf-brand-pill">
            <span className="sf-brand-orb" />
            <div>
              <strong>SPACEFARM // CODE44</strong>
              <span>{isAz ? "Orbital Kəşfiyyat Modulu" : "Orbital Earth Reconnaissance"}</span>
            </div>
          </div>

          <nav className="sf-preset-strip" aria-label={isAz ? "Hazır sahələr" : "Preset sectors"}>
            {ORBITAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`sf-preset-chip ${selectedPresetId === preset.id ? "is-active" : ""}`}
                onClick={() => handleSelectLocation(preset.lat, preset.lon, preset.id)}
                onDoubleClick={() => handleRequestDive(preset.lat, preset.lon, preset.id)}
                title={isAz ? "Əsas Bölgə ★ • Seçmək üçün 1× • Xəritəyə enmək üçün 2× klik" : "Primary Region ★ • 1× Target • 2× Dive"}
              >
                ★ {(isAz ? preset.nameAz : preset.nameEn).split(/[\s—/-]+/)[0]}
              </button>
            ))}
            <select
              className="sf-district-select"
              aria-label={isAz ? "Bütün 67 rayon" : "All 67 districts"}
              value={selectedPresetId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                const primary = ORBITAL_PRESETS.find((p) => p.id === id);
                if (primary) {
                  handleSelectLocation(primary.lat, primary.lon, primary.id);
                  return;
                }
                const dist = findAzDistrict(id);
                if (dist) {
                  const lbl = isAz
                    ? `${dist.nameAz} (${dist.economicRegionAz})`
                    : `${dist.nameEn} (${dist.economicRegionEn})`;
                  handleSelectLocation(dist.lat, dist.lon, dist.id, lbl);
                }
              }}
            >
              <option value="">{isAz ? "67 Rayon…" : "67 Districts…"}</option>
              <optgroup label={isAz ? "★ Əsas Bölgələr (4)" : "★ Primary Regions (4)"}>
                {ORBITAL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    ★ {isAz ? preset.nameAz : preset.nameEn}
                  </option>
                ))}
              </optgroup>
              <optgroup label={isAz ? `Bütün ${AZ_DISTRICTS.length} Rayon (A–Z)` : `All ${AZ_DISTRICTS.length} Districts (A–Z)`}>
                {AZ_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {isAz ? `${d.nameAz} · ${d.elevationM.toFixed(0)}m` : `${d.nameEn} · ${d.elevationM.toFixed(0)}m`}
                  </option>
                ))}
              </optgroup>
            </select>
          </nav>

          <div className="sf-hud-controls-right">
            {/* Spacecraft Selection (NASA TERRA / LANDSAT 8 Real 3D .glb + TLE) */}
            <div className="sf-segmented-pill" role="group" aria-label="NASA Spacecraft">
              {(["terra", "landsat8"] as ActiveSatelliteId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={activeSatelliteId === id ? "is-active" : ""}
                  onClick={() => setActiveSatelliteId(id)}
                >
                  {id === "terra" ? "TERRA" : "LANDSAT 8"}
                </button>
              ))}
            </div>

            {/* Camera Perspective: Orbit vs Chase NASA Spacecraft POV */}
            <div className="sf-segmented-pill" role="group" aria-label="Camera Perspective">
              <button
                type="button"
                className={cameraMode === "orbit" ? "is-active" : ""}
                onClick={() => setCameraMode("orbit")}
              >
                {isAz ? "Yer Orbiti" : "Earth Orbit"}
              </button>
              <button
                type="button"
                className={cameraMode === "satellite" ? "is-active" : ""}
                onClick={() => setCameraMode("satellite")}
              >
                {isAz ? "Peyk Kamerası" : "Satellite POV"}
              </button>
            </div>

            {/* AZ / EN Toggle */}
            <button
              type="button"
              className="sf-lang-toggle"
              onClick={() => {
                const next = language === "az" ? "en" : "az";
                setLanguage(next);
                onLanguageChange?.(next);
              }}
            >
              {language.toUpperCase()}
            </button>
          </div>
        </header>

        {/* Bottom-Left Compact Spectral Filter Pills (details collapsible so globe stays open) */}
        <aside className={`sf-hud-filters ${filterInfoOpen ? "is-expanded" : "is-compact"}`}>
          <div className="sf-filter-pills">
            {SATELLITE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`sf-filter-pill ${filterMode === f.id ? "is-active" : ""}`}
                onClick={() => handleFilterChange(f.id)}
              >
                {isAz ? f.labelAz : f.labelEn}
              </button>
            ))}
            <button
              type="button"
              className={`sf-filter-info-btn ${filterInfoOpen ? "is-active" : ""}`}
              onClick={() => setFilterInfoOpen((v) => !v)}
              aria-expanded={filterInfoOpen}
              title={isAz ? "Filtr izahı" : "Toggle filter technical notes"}
            >
              ⓘ
            </button>
          </div>

          {activeFilterMeta.legendStops && (
            <div className="sf-legend-bar">
              {activeFilterMeta.legendStops.map((stop) => (
                <span key={stop.label} className="sf-legend-stop">
                  <i style={{ background: stop.color }} />
                  {stop.label}
                </span>
              ))}
            </div>
          )}

          {filterInfoOpen && (
            <div className="sf-filter-caption">
              <div className="sf-filter-desc">
                <strong>{activeFilterMeta.shortTag}:</strong>{" "}
                {isAz ? activeFilterMeta.descriptionAz : activeFilterMeta.descriptionEn}
              </div>
            </div>
          )}
        </aside>

        {/* Bottom-Right Compact Target Summary Card + Expandable Telemetry */}
        <aside className={`sf-target-card ${targetDetailsOpen ? "is-expanded" : "is-compact"}`}>
          <div className="sf-target-card-header">
            <div>
              <span className="sf-chip-purple">
                {activePreset
                  ? isAz
                    ? "TƏSDİQLƏNMİŞ ZONA"
                    : "VERIFIED REGION"
                  : isAz
                  ? "SEÇİLƏN KOORDİNAT"
                  : "CUSTOM COORDINATE"}
              </span>
              <h2>{locationLabel}</h2>
              <p className="sf-coord-mono">
                {selectedLat.toFixed(4)}°N • {selectedLon.toFixed(4)}°E • {areaHa.toFixed(1)} ha
              </p>
            </div>
            <button
              type="button"
              className="sf-card-collapse-btn"
              onClick={() => setTargetDetailsOpen((v) => !v)}
              aria-expanded={targetDetailsOpen}
              title={
                targetDetailsOpen
                  ? isAz
                    ? "Məlumatları yığ"
                    : "Collapse details"
                  : isAz
                  ? "Tam telemetriyanı aç"
                  : "Expand full telemetry"
              }
            >
              {targetDetailsOpen ? (isAz ? "Yığ ▾" : "Hide ▾") : isAz ? "Ətraflı ▴" : "Details ▴"}
            </button>
          </div>

          {!targetDetailsOpen && (
            <div className="sf-target-compact-summary">
              <span>
                {weather.status === "ready" && weather.tempC !== null
                  ? `${weather.tempC.toFixed(1)}°C`
                  : `${gridSample.tempC.toFixed(1)}°C`}
              </span>
              <span>•</span>
              <span>
                {weather.windSpeedMs !== null
                  ? `${weather.windSpeedMs.toFixed(1)} m/s`
                  : `${gridSample.speedMs.toFixed(1)} m/s`}
              </span>
              <span>•</span>
              <span className="sf-compact-sat-name">
                <i className={`sf-status-dot ${satTelemetry.isLiveUtc ? "is-utc" : "is-overfly"}`} />
                {satTelemetry.name.replace(/^NASA\s*(?:\/\s*USGS\s*)?/i, "").split(" (")[0]}
              </span>
            </div>
          )}

          {targetDetailsOpen && (
            <>
              {/* Live Open-Meteo Point Telemetry */}
              <div className="sf-telemetry-mini-grid">
                <div className="sf-t-cell">
                  <span>{isAz ? "Səth Hava" : "Air Temp"}</span>
                  <strong>
                    {weather.status === "ready" && weather.tempC !== null
                      ? `${weather.tempC.toFixed(1)}°C`
                      : `${gridSample.tempC.toFixed(1)}°C`}
                  </strong>
                </div>
                <div className="sf-t-cell">
                  <span>{isAz ? "Torpaq 0cm" : "Soil 0cm"}</span>
                  <strong>
                    {weather.soilTemp0Cm !== null ? `${weather.soilTemp0Cm.toFixed(1)}°C` : "—"}
                  </strong>
                </div>
                <div className="sf-t-cell">
                  <span>{isAz ? "Real Külək" : "Real Wind"}</span>
                  <strong>
                    {weather.windSpeedMs !== null
                      ? `${weather.windSpeedMs.toFixed(1)} m/s`
                      : `${gridSample.speedMs.toFixed(1)} m/s`}
                  </strong>
                </div>
                <div className="sf-t-cell">
                  <span>{isAz ? "Buludluluq" : "Cloud Cover"}</span>
                  <strong>
                    {weather.cloudCoverPct !== null ? `${Math.round(weather.cloudCoverPct)}%` : "—"}
                  </strong>
                </div>
              </div>

              {/* Real CelesTrak SGP4 Spacecraft Telemetry Bar */}
              <div className="sf-sat-tle-strip">
                <div className="sf-sat-tle-info">
                  <span className={`sf-status-dot ${satTelemetry.isLiveUtc ? "is-utc" : "is-overfly"}`} />
                  <span>
                    <strong>
                      {satTelemetry.name.replace(/^NASA\s*(?:\/\s*USGS\s*)?/i, "").split(" (")[0]}
                    </strong>{" "}
                    •{" "}
                    {satTelemetry.lat.toFixed(1)}°, {satTelemetry.lon.toFixed(1)}° •{" "}
                    {satTelemetry.altitudeKm.toFixed(0)} km • {satTelemetry.velocityKms.toFixed(1)} km/s
                  </span>
                </div>
                <button
                  type="button"
                  className={`sf-overfly-toggle ${satOverflyTarget ? "is-active" : ""}`}
                  onClick={() => setSatOverflyTarget((v) => !v)}
                  title={
                    isAz
                      ? "Real UTC orbiti və ya seçilən ərazi üzərindən keçid arasında dəyiş"
                      : "Toggle Live UTC SGP4 orbit vs Simulated Target Overfly"
                  }
                >
                  {satOverflyTarget
                    ? isAz
                      ? "Simulyasiya Keçidi"
                      : "Target Overfly"
                    : "LIVE SGP4 UTC"}
                </button>
              </div>

              <p className="sf-dblclick-hint">
                {isAz
                  ? "İpucu: Dünyaya 2× klik → Xəritə • Peykə 2× klik → Peyk içi baxış"
                  : "Tip: 2× click Earth → Field Map • 2× click Satellite → Payload POV"}
              </p>
            </>
          )}

          <div className="sf-target-card-cta-row">
            <button
              type="button"
              className="sf-btn-dive-primary"
              onClick={triggerOrbitalDive}
            >
              <span aria-hidden="true">🚀</span>
              {isAz ? "Seçilən Məkana Bax" : "Inspect Selected Area"}
              <span aria-hidden="true">→</span>
            </button>

            {onConfirmProceed && (
              <button
                type="button"
                className="sf-btn-ghost-proceed"
                onClick={() =>
                  onConfirmProceed({
                    lat: selectedLat,
                    lon: selectedLon,
                    label: locationLabel,
                    presetId: selectedPresetId,
                    filterMode,
                    polygon,
                    areaHa,
                  })
                }
                title={isAz ? "Bu koordinatları növbəti ekrana göndər" : "Send location to pipeline"}
              >
                {isAz ? "Seç" : "Use"}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* STAGE 3: Preloaded Full-Screen Interactive Satellite Field Map */}
      {(stageMode === "diving" || stageMode === "map") && (
        <SatelliteFieldMap
          selectedLat={selectedLat}
          selectedLon={selectedLon}
          locationLabel={locationLabel}
          polygon={polygon}
          areaHa={areaHa}
          filterMode={filterMode}
          weather={weather}
          climate={climate}
          windGrid={windGrid}
          language={language}
          isVisible={stageMode === "map"}
          onReturnToGlobe={handleReturnToGlobe}
          onSelectLocation={(lat, lon) => handleSelectLocation(lat, lon, null)}
          onPolygonChange={handlePolygonChange}
          onFilterChange={handleFilterChange}
          onProceed={
            onConfirmProceed
              ? () =>
                  onConfirmProceed({
                    lat: selectedLat,
                    lon: selectedLon,
                    label: locationLabel,
                    presetId: selectedPresetId,
                    filterMode,
                    polygon,
                    areaHa,
                  })
              : undefined
          }
        />
      )}
    </div>
  );
};

export default OrbitalEarthModule;
