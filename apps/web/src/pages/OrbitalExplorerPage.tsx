import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CloudRain, Layers, Sprout } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "../modules/orbital-earth/styles/orbital-module.css";
import { OrbitalEarthModule, type SelectedOrbitalLocation } from "../modules/orbital-earth";
import { AppShell } from "../components/layout/AppShell";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import { formatLocaleNumber } from "../locales/translations";
import { formatLatLon } from "../utils/locationSearch";

const ORBITAL_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function OrbitalExplorerPage() {
  const {
    t,
    locale,
    setLocale,
    draft,
    applyOrbitalSelection,
    showToast,
  } = useSpaceFarm();
  const navigate = useNavigate();

  const lastSelectionKeyRef = useRef<string>("");
  const pipelineLabels = useMemo(
    () => ({
      activeSector: locale === "az" ? "Seçilmiş Orbital Sektor" : "Active Orbital Target",
      toField: locale === "az" ? "Sahə & Torpaq Lab" : "Field & Soil Lab",
      toClimate: locale === "az" ? "NASA İqlim" : "NASA Climate",
      toRotation: locale === "az" ? "3 İllik Plan" : "Rotation Plan",
    }),
    [locale],
  );

  const handleLocationSelect = useCallback(
    (selection: SelectedOrbitalLocation) => {
      const polyKey = selection.polygon?.length ?? 0;
      const key = `${selection.lat.toFixed(4)}:${selection.lon.toFixed(4)}:${selection.presetId ?? ""}:${selection.areaHa.toFixed(1)}:${polyKey}`;
      if (lastSelectionKeyRef.current === key) return;
      lastSelectionKeyRef.current = key;
      applyOrbitalSelection(
        {
          lat: selection.lat,
          lon: selection.lon,
          label: selection.label,
          presetId: selection.presetId,
          areaHa: selection.areaHa,
          polygon: selection.polygon,
        },
        false,
      );
    },
    [applyOrbitalSelection],
  );

  const handleConfirmProceed = useCallback(
    (selection: SelectedOrbitalLocation) => {
      const nextDraft = applyOrbitalSelection(
        {
          lat: selection.lat,
          lon: selection.lon,
          label: selection.label,
          presetId: selection.presetId,
          areaHa: selection.areaHa,
          polygon: selection.polygon,
        },
        true,
      );
      showToast(
        locale === "az"
          ? `${nextDraft.label} (${nextDraft.areaHa.toFixed(1)} ha) seçildi — NASA POWER iqlim və əkin rotasiyası yenilənir`
          : `${nextDraft.label} (${nextDraft.areaHa.toFixed(1)} ha) locked — syncing NASA POWER climate & rotation pipeline`,
      );
      navigate("/field");
    },
    [applyOrbitalSelection, locale, navigate, showToast],
  );

  const handlePipelineNavigate = useCallback(
    (route: "/field" | "/climate" | "/rotation") => {
      applyOrbitalSelection(
        {
          lat: draft.latitude,
          lon: draft.longitude,
          label: draft.label,
          presetId: draft.regionPresetId,
          areaHa: draft.areaHa,
          polygon: draft.boundaryPolygon,
        },
        route !== "/field",
      );
      navigate(route);
    },
    [applyOrbitalSelection, draft, navigate],
  );

  return (
    <AppShell variant="inner">
      <div className="sf-container" style={{ gap: 14 }}>
        {/* Compact Synced Pipeline Bar above Full-Stage 3D Earth + Satellite POV + Esri Map */}
        <div
          className="sf-panel sf-panel-compact"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 className="sf-page-title" style={{ fontSize: 22, margin: 0 }}>
                {t.explore.title}
              </h1>
              <span className="sf-badge sf-badge-violet">{pipelineLabels.activeSector}</span>
            </div>
            <div className="mono" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{draft.label}</strong>
              {" · "}
              {formatLatLon(draft.latitude, draft.longitude, 4)}
              {" · "}
              {formatLocaleNumber(draft.areaHa, locale, 1)} ha
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="sf-btn sf-btn-sm"
              onClick={() => handlePipelineNavigate("/field")}
            >
              <Layers size={14} aria-hidden="true" />
              <span>{pipelineLabels.toField}</span>
            </button>
            <button
              type="button"
              className="sf-btn sf-btn-sm"
              onClick={() => handlePipelineNavigate("/climate")}
            >
              <CloudRain size={14} aria-hidden="true" />
              <span>{pipelineLabels.toClimate}</span>
            </button>
            <button
              type="button"
              className="sf-btn sf-btn-sm sf-btn-primary"
              onClick={() => handlePipelineNavigate("/rotation")}
            >
              <Sprout size={14} aria-hidden="true" />
              <span>{pipelineLabels.toRotation}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Interactive Orbital Earth + SGP4 Beacon + Satellite POV + Zoomed Esri Wind Map Module */}
        <section className="sf-explore-stage sf-explore-orbital-host" aria-label={t.explore.title}>
          <OrbitalEarthModule
            initialLat={draft.latitude}
            initialLon={draft.longitude}
            initialPolygon={draft.boundaryPolygon}
            language={locale}
            apiBaseUrl={ORBITAL_API_BASE_URL}
            onLocationSelect={handleLocationSelect}
            onRegionSelected={handleLocationSelect}
            onConfirmProceed={handleConfirmProceed}
            onLanguageChange={(nextLang) => setLocale(nextLang)}
          />
        </section>
      </div>
    </AppShell>
  );
}
