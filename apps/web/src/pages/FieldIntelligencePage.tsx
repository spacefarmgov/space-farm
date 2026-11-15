import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Compass, Edit3, FlaskConical, Layers3, Mountain, Save } from "lucide-react";
import { fetchOrbitalElevation } from "../api/extendedClient";
import type { IrrigationType, SoilSourceType, SoilTexture } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { SatelliteFieldMap } from "../components/map/SatelliteFieldMap";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import { VERIFIED_AZ_REGIONS } from "../data/regions";
import { AZ_DISTRICTS } from "../data/azDistricts";
import { formatCropName } from "../locales/translations";

const FALLBACK_CROP_OPTIONS = [
  { crop_id: "wheat", name: "Wheat" },
  { crop_id: "barley", name: "Barley" },
  { crop_id: "chickpea", name: "Chickpea" },
  { crop_id: "lentil", name: "Lentil" },
  { crop_id: "sunflower", name: "Sunflower" },
  { crop_id: "maize", name: "Maize" },
];

export function FieldIntelligencePage() {
  const {
    locale,
    t,
    selectedRegion,
    draft,
    updateDraft,
    setCustomCoordinates,
    selectRegion,
    cropCatalog,
    fieldErrors,
    validateInputs,
    loadClimateForField,
    runBaselineSimulation,
    baselineLoading,
    authToken,
    saveActiveParcelInputs,
    showToast,
  } = useSpaceFarm();
  const [savingParcel, setSavingParcel] = useState(false);
  const [elevationM, setElevationM] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    fetchOrbitalElevation(draft.latitude, draft.longitude, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setElevationM(res.elevation_m);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setElevationM(null);
        }
      });
    return () => controller.abort();
  }, [draft.latitude, draft.longitude]);

  const cropOptions = cropCatalog?.crops?.length ? cropCatalog.crops : FALLBACK_CROP_OPTIONS;

  function resolveFieldErr(key: string): string | null {
    const code = fieldErrors[key];
    if (!code) return null;
    if (code in t.errors) {
      return t.errors[code as keyof typeof t.errors];
    }
    return code;
  }

  async function handleContinueToClimate() {
    if (!validateInputs()) return;
    if (authToken) {
      await saveActiveParcelInputs();
    }
    await loadClimateForField();
    navigate("/climate");
  }

  async function handleComparePlans() {
    if (!validateInputs()) return;
    if (authToken) {
      await saveActiveParcelInputs();
    }
    await runBaselineSimulation();
    navigate("/rotation");
  }

  async function handleSaveToDatabase() {
    if (!validateInputs()) return;
    setSavingParcel(true);
    const res = await saveActiveParcelInputs();
    setSavingParcel(false);
    if (res.ok) {
      showToast(
        locale === "az"
          ? "Sahə və Laboratoriya pH/NPK analizi bazaya yazıldı"
          : "Field & Lab pH/NPK profile saved to database",
      );
    } else if (res.error) {
      showToast(res.error);
    }
  }

  return (
    <AppShell variant="inner">
      <div className="sf-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="sf-page-title">{t.field.title}</h1>
            <p className="sf-subtitle">{t.field.subtitle}</p>
          </div>
          {draft.hasBoundary && <span className="sf-badge sf-badge-violet">{t.badges.primaryPlot}</span>}
        </div>

        <div className="sf-field-split">
          {/* Left 68%: Satellite Field Visualization */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SatelliteFieldMap
              latitude={draft.latitude}
              longitude={draft.longitude}
              selectedRegion={selectedRegion}
              showIllustrativeBoundary={Boolean(selectedRegion?.illustrativePolygon)}
              zoom={selectedRegion?.hasBoundary ? 14 : 11}
              height={620}
              onPickCoordinate={(lat, lon) => setCustomCoordinates(lat, lon)}
              onSelectRegion={selectRegion}
            />

            <div className="sf-panel sf-panel-compact" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {selectedRegion?.illustrativePolygon
                  ? t.field.pilotBoundaryLabel
                  : t.field.pointOnlyLabel}
              </div>
              <button
                type="button"
                className="sf-btn sf-btn-sm"
                onClick={() => navigate("/explore")}
              >
                <Compass size={14} aria-hidden="true" />
                <span>{t.field.locationEditTitle}</span>
              </button>
            </div>
          </div>

          {/* Right 32%: Operational Inputs Form */}
          <aside className="sf-panel" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* 1. Field profile */}
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h2 style={{ fontSize: 17 }}>{t.field.profileSection}</h2>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm"
                  onClick={() => navigate("/explore")}
                >
                  <Edit3 size={13} aria-hidden="true" />
                  <span>{t.actions.editLocation}</span>
                </button>
              </div>

              <label className="sf-field">
                <span className="sf-label-row">
                  <span>{locale === "az" ? "Rayon / Əsas Bölgə (67 Rayon)" : "District / Primary Region (67)"}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--accent-cyan)" }}>
                    {locale === "az" ? "NASA + SRTM" : "NASA + SRTM"}
                  </span>
                </span>
                <select
                  className="sf-select"
                  aria-label={locale === "az" ? "Rayon seçimi (67 rayon)" : "District selector (67 districts)"}
                  value={draft.regionPresetId ?? ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      selectRegion(e.target.value);
                    }
                  }}
                >
                  {!draft.regionPresetId && (
                    <option value="">
                      {locale === "az" ? "— Xüsusi koordinat —" : "— Custom coordinates —"}
                    </option>
                  )}
                  <optgroup label={locale === "az" ? "★ Əsas Bölgələr (4)" : "★ Primary Regions (4)"}>
                    {VERIFIED_AZ_REGIONS.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        ★ {locale === "az" ? reg.nameAz : reg.nameEn}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup
                    label={
                      locale === "az"
                        ? `Bütün ${AZ_DISTRICTS.length} Rayon (A–Z)`
                        : `All ${AZ_DISTRICTS.length} Districts (A–Z)`
                    }
                  >
                    {AZ_DISTRICTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {locale === "az"
                          ? `${d.nameAz} · ${d.elevationM.toFixed(0)} m · ${d.annualRainMm.toFixed(0)} mm`
                          : `${d.nameEn} · ${d.elevationM.toFixed(0)} m · ${d.annualRainMm.toFixed(0)} mm`}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label className="sf-field">
                <span className="sf-label-row">{t.field.fieldLabelInput}</span>
                <input
                  type="text"
                  className="sf-input"
                  value={draft.label}
                  onChange={(e) => updateDraft({ label: e.target.value })}
                />
              </label>

              <div className="sf-grid-2" style={{ gap: 10 }}>
                <label className="sf-field">
                  <span className="sf-label-row">
                    <span>{t.field.areaLabel}</span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.field.areaUnit}</span>
                  </span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    className={`sf-input tabular ${resolveFieldErr("areaHa") ? "sf-input-error" : ""}`}
                    value={draft.areaHa}
                    onChange={(e) => updateDraft({ areaHa: Number(e.target.value) })}
                  />
                  {resolveFieldErr("areaHa") && (
                    <span className="sf-field-error">{resolveFieldErr("areaHa")}</span>
                  )}
                </label>

                <div className="sf-field">
                  <span className="sf-label-row">EPSG:4326</span>
                  <div
                    className="sf-input mono"
                    style={{ display: "flex", alignItems: "center", fontSize: 12.5, color: "var(--text-secondary)" }}
                  >
                    {draft.latitude.toFixed(3)}, {draft.longitude.toFixed(3)}
                  </div>
                </div>
              </div>

              <div className="sf-field">
                <span className="sf-label-row" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Mountain size={13} style={{ color: "var(--accent-cyan)" }} aria-hidden="true" />
                  <span>{t.field.elevationLabel}</span>
                </span>
                <div
                  className="sf-input mono"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-secondary)" }}
                >
                  <span>{elevationM !== null ? `${elevationM.toFixed(1)} m a.s.l.` : "—"}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Copernicus / SRTM DEM</span>
                </div>
              </div>
            </section>

            {/* 2. Soil & Lab Parameters */}
            <section
              style={{
                borderTop: "1px solid var(--border-default)",
                paddingTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 17, display: "flex", alignItems: "center", gap: 7, margin: 0 }}>
                  <FlaskConical size={16} style={{ color: "var(--accent-cyan)" }} aria-hidden="true" />
                  <span>{t.field.soilSection}</span>
                </h2>
                <span className="sf-badge sf-badge-success" style={{ fontSize: 11 }}>
                  <CheckCircle2 size={12} aria-hidden="true" />
                  <span>{draft.soilSourceRef || "LAB-AZ-2025"}</span>
                </span>
              </div>

              <label className="sf-field">
                <span className="sf-label-row">
                  <span>{t.field.soilPhLabel}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--accent-cyan)" }}>
                    {draft.soilPh < 6.0
                      ? locale === "az" ? "Zəif turş (6.0-)" : "Acidic (<6.0)"
                      : draft.soilPh > 7.5
                        ? locale === "az" ? "Qələvi (7.5+)" : "Alkaline (>7.5)"
                        : locale === "az" ? "Optimal neytral (6.0–7.5)" : "Optimal neutral (6.0–7.5)"}
                  </span>
                </span>
                <input
                  type="number"
                  min="3.5"
                  max="9.5"
                  step="0.1"
                  className={`sf-input tabular ${resolveFieldErr("soilPh") ? "sf-input-error" : ""}`}
                  value={draft.soilPh}
                  onChange={(e) => updateDraft({ soilPhKnown: true, soilPh: Number(e.target.value) })}
                />
                {resolveFieldErr("soilPh") && (
                  <span className="sf-field-error">{resolveFieldErr("soilPh")}</span>
                )}
              </label>

              {/* Lab Chemistry Grid: Humus, N, P, K, EC, Moisture */}
              <div
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-deep)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  <span>{locale === "az" ? "Laboratoriya NPK, Humus və Duzluluq (EC)" : "Lab Soil Chemistry (NPK, Humus & EC)"}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {draft.soilSampleDate || "2025-03-14"}
                  </span>
                </div>

                <div className="sf-grid-2" style={{ gap: 8 }}>
                  <label className="sf-field">
                    <span className="sf-label-row" style={{ fontSize: 11.5 }}>
                      {locale === "az" ? "Humus (%)" : "Humus (%)"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      step="0.1"
                      className="sf-input tabular"
                      value={draft.labMetrics.organicMatterPct}
                      onChange={(e) =>
                        updateDraft({
                          labMetrics: { ...draft.labMetrics, organicMatterPct: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="sf-field">
                    <span className="sf-label-row" style={{ fontSize: 11.5 }}>
                      {locale === "az" ? "Azot — N (mq/kq)" : "Nitrogen — N (mg/kg)"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.5"
                      className="sf-input tabular"
                      value={draft.labMetrics.nitrogenMgKg}
                      onChange={(e) =>
                        updateDraft({
                          labMetrics: { ...draft.labMetrics, nitrogenMgKg: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="sf-field">
                    <span className="sf-label-row" style={{ fontSize: 11.5 }}>
                      {locale === "az" ? "Fosfor — P₂O₅ (mq/kq)" : "Phosphorus — P₂O₅ (mg/kg)"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.5"
                      className="sf-input tabular"
                      value={draft.labMetrics.phosphorusMgKg}
                      onChange={(e) =>
                        updateDraft({
                          labMetrics: { ...draft.labMetrics, phosphorusMgKg: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="sf-field">
                    <span className="sf-label-row" style={{ fontSize: 11.5 }}>
                      {locale === "az" ? "Kalium — K₂O (mq/kq)" : "Potassium — K₂O (mg/kg)"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="1500"
                      step="1"
                      className="sf-input tabular"
                      value={draft.labMetrics.potassiumMgKg}
                      onChange={(e) =>
                        updateDraft({
                          labMetrics: { ...draft.labMetrics, potassiumMgKg: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="sf-field">
                    <span className="sf-label-row" style={{ fontSize: 11.5 }}>
                      {locale === "az" ? "Şorlaşma EC (dS/m)" : "Salinity EC (dS/m)"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.05"
                      className="sf-input tabular"
                      value={draft.labMetrics.ecDsM}
                      onChange={(e) =>
                        updateDraft({
                          labMetrics: { ...draft.labMetrics, ecDsM: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="sf-field">
                    <span className="sf-label-row" style={{ fontSize: 11.5 }}>
                      {locale === "az" ? "Tarla Su Tutumu (%)" : "Field Moisture Cap. (%)"}
                    </span>
                    <input
                      type="number"
                      min="5"
                      max="70"
                      step="0.5"
                      className="sf-input tabular"
                      value={draft.labMetrics.moistureCapacityPct}
                      onChange={(e) =>
                        updateDraft({
                          labMetrics: { ...draft.labMetrics, moistureCapacityPct: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="sf-grid-2" style={{ gap: 10 }}>
                <label className="sf-field">
                  <span className="sf-label-row">{t.field.soilTextureLabel}</span>
                  <select
                    className="sf-select"
                    value={draft.soilTexture}
                    onChange={(e) => updateDraft({ soilTexture: e.target.value as SoilTexture })}
                  >
                    {(Object.keys(t.field.textures) as SoilTexture[])
                      .filter((key) => key !== "unknown")
                      .map((key) => (
                        <option key={key} value={key}>
                          {t.field.textures[key]}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="sf-field">
                  <span className="sf-label-row">{t.field.soilSourceTypeLabel}</span>
                  <select
                    className="sf-select"
                    value={draft.soilSourceType}
                    onChange={(e) => updateDraft({ soilSourceType: e.target.value as SoilSourceType })}
                  >
                    {(Object.keys(t.field.soilSources) as SoilSourceType[])
                      .filter((key) => key !== "unknown")
                      .map((key) => (
                        <option key={key} value={key}>
                          {t.field.soilSources[key]}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {(draft.soilSourceType === "laboratory" ||
                draft.soilSourceType === "modeled" ||
                draft.soilSourceRef.length > 0) && (
                <label className="sf-field">
                  <span className="sf-label-row">{t.field.soilSourceRefLabel}</span>
                  <input
                    type="text"
                    className={`sf-input ${resolveFieldErr("soilSourceRef") ? "sf-input-error" : ""}`}
                    placeholder="LAB-AZ-2024-01"
                    value={draft.soilSourceRef}
                    onChange={(e) => updateDraft({ soilSourceRef: e.target.value })}
                  />
                  {resolveFieldErr("soilSourceRef") && (
                    <span className="sf-field-error">{resolveFieldErr("soilSourceRef")}</span>
                  )}
                </label>
              )}

              <div className="sf-grid-2" style={{ gap: 10 }}>
                <label className="sf-field">
                  <span className="sf-label-row">{t.field.soilDepthTopLabel}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className={`sf-input tabular ${resolveFieldErr("depthCm") ? "sf-input-error" : ""}`}
                    value={draft.soilDepthTopCm}
                    onChange={(e) => updateDraft({ soilDepthTopCm: e.target.value })}
                  />
                </label>
                <label className="sf-field">
                  <span className="sf-label-row">{t.field.soilDepthBottomLabel}</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="30"
                    className={`sf-input tabular ${resolveFieldErr("depthCm") ? "sf-input-error" : ""}`}
                    value={draft.soilDepthBottomCm}
                    onChange={(e) => updateDraft({ soilDepthBottomCm: e.target.value })}
                  />
                </label>
              </div>
              {resolveFieldErr("depthCm") && (
                <span className="sf-field-error">{resolveFieldErr("depthCm")}</span>
              )}
            </section>

            {/* 3. Irrigation */}
            <section
              style={{
                borderTop: "1px solid var(--border-default)",
                paddingTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h2 style={{ fontSize: 17 }}>{t.field.irrigationSection}</h2>

              <label className="sf-field">
                <span className="sf-label-row">{t.field.irrigationTypeLabel}</span>
                <select
                  className="sf-select"
                  value={draft.irrigationType}
                  onChange={(e) => updateDraft({ irrigationType: e.target.value as IrrigationType })}
                >
                  {(Object.keys(t.field.irrigations) as IrrigationType[])
                    .filter((key) => key !== "unknown")
                    .map((key) => (
                      <option key={key} value={key}>
                        {t.field.irrigations[key]}
                      </option>
                    ))}
                </select>
              </label>

              {draft.irrigationType === "irrigated" && (
                <label className="sf-field">
                  <span className="sf-label-row">
                    <span>{t.field.irrigationBudgetLabel}</span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>mm</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    step="10"
                    className={`sf-input tabular ${resolveFieldErr("irrigationBudget") ? "sf-input-error" : ""}`}
                    value={draft.irrigationBudgetMm}
                    onChange={(e) => updateDraft({ irrigationBudgetMm: Number(e.target.value) })}
                  />
                  {resolveFieldErr("irrigationBudget") && (
                    <span className="sf-field-error">{resolveFieldErr("irrigationBudget")}</span>
                  )}
                </label>
              )}
            </section>

            {/* 4. Crop History */}
            <section
              style={{
                borderTop: "1px solid var(--border-default)",
                paddingTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h2 style={{ fontSize: 17 }}>{t.field.cropHistorySection}</h2>

              <div className="sf-grid-2" style={{ gap: 10 }}>
                <label className="sf-field">
                  <span className="sf-label-row">{t.field.priorCropLabel}</span>
                  <select
                    className="sf-select"
                    value={draft.priorCropId}
                    onChange={(e) => updateDraft({ priorCropId: e.target.value })}
                  >
                    <option value="">{t.field.priorCropNone}</option>
                    {cropOptions.map((c) => (
                      <option key={c.crop_id} value={c.crop_id}>
                        {formatCropName(c.crop_id, c.name, locale)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sf-field">
                  <span className="sf-label-row">{t.field.priorYearLabel}</span>
                  <input
                    type="number"
                    min="1950"
                    max="2100"
                    className={`sf-input tabular ${resolveFieldErr("priorCropYear") ? "sf-input-error" : ""}`}
                    value={draft.priorCropYear}
                    onChange={(e) => updateDraft({ priorCropYear: Number(e.target.value) })}
                  />
                  {resolveFieldErr("priorCropYear") && (
                    <span className="sf-field-error">{resolveFieldErr("priorCropYear")}</span>
                  )}
                </label>
              </div>
            </section>

            {/* Actions */}
            <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="sf-btn sf-btn-primary"
                onClick={handleContinueToClimate}
              >
                <span>{t.actions.continueToClimate}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="sf-btn"
                onClick={handleComparePlans}
                disabled={baselineLoading}
              >
                <Layers3 size={16} aria-hidden="true" />
                <span>{t.actions.comparePlans}</span>
              </button>
              {authToken && (
                <button
                  type="button"
                  className="sf-btn sf-btn-sm"
                  onClick={handleSaveToDatabase}
                  disabled={savingParcel}
                >
                  <Save size={15} aria-hidden="true" />
                  <span>
                    {savingParcel
                      ? (locale === "az" ? "Saxlanılır..." : "Saving...")
                      : (locale === "az" ? "Lab & Sahə Məlumatlarını Bazaya Saxla" : "Save Lab & Field to Account")}
                  </span>
                </button>
              )}
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.field.saveToStateNote}</span>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
