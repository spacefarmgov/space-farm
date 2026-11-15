import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Download, ExternalLink, HelpCircle, Satellite } from "lucide-react";
import { ProvenanceCards } from "../components/features/sources/ProvenanceCards";
import { AppShell } from "../components/layout/AppShell";
import { CropIcon, SimulationStatusBadge } from "../components/ui/StatusPrimitives";
import { useSpaceFarm, type SourceDrawerSection } from "../context/SpaceFarmContext";
import { formatCropName } from "../locales/translations";

export function SourcesExplanationsPage() {
  const {
    t,
    locale,
    draft,
    baselineSim,
    selectedPlan,
    openMethodology,
    showToast,
  } = useSpaceFarm();
  const navigate = useNavigate();

  const [focusedSec, setFocusedSec] = useState<SourceDrawerSection>("nasa");

  const missingInputs: string[] = [];
  if (!draft.soilPhKnown) missingInputs.push(`${t.field.soilPhLabel} (${t.badges.unknown})`);
  if (draft.soilTexture === "unknown") missingInputs.push(`${t.field.soilTextureLabel} (${t.badges.unknown})`);
  if (draft.soilSourceType === "unknown") missingInputs.push(`${t.field.soilSourceTypeLabel} (${t.badges.unknown})`);
  if (draft.irrigationType === "unknown") missingInputs.push(`${t.field.irrigationTypeLabel} (${t.badges.unknown})`);
  if (!draft.priorCropId) missingInputs.push(`${t.field.priorCropLabel} (${t.badges.unknown})`);

  function handleDownloadJson() {
    if (!baselineSim) return;
    const blob = new Blob([JSON.stringify(baselineSim, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spacefarm-${baselineSim.input_summary.farm_id}-${baselineSim.simulation_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t.sources.downloadedToast);
  }

  function focusCard(sec: SourceDrawerSection, elementId: string) {
    setFocusedSec(sec);
    document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <AppShell variant="inner">
      <div className="sf-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="sf-page-title">{t.sources.title}</h1>
            <p className="sf-subtitle">{t.sources.subtitle}</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="sf-btn sf-btn-sm"
              onClick={openMethodology}
            >
              <HelpCircle size={15} aria-hidden="true" />
              <span>{t.actions.viewMethodology}</span>
            </button>

            <button
              type="button"
              className="sf-btn sf-btn-sm sf-btn-primary"
              onClick={handleDownloadJson}
              disabled={!baselineSim}
              title={!baselineSim ? t.sources.noSimYetNote : undefined}
            >
              <Download size={15} aria-hidden="true" />
              <span>{t.actions.downloadResultJson}</span>
            </button>
          </div>
        </div>

        {/* Top Summary Row: Selected Plan + Unknown Inputs */}
        <div className="sf-grid-2">
          <article className="sf-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 18 }}>{t.sources.selectedRotationTitle}</h2>
              {baselineSim && <SimulationStatusBadge status={baselineSim.status} t={t} />}
            </div>

            {selectedPlan ? (
              <div className="sf-grid-3" style={{ gap: 10 }}>
                {selectedPlan.years.map((y) => (
                  <div
                    key={y.year_index}
                    style={{
                      padding: 10,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border-default)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CropIcon cropId={y.crop_id} size={17} />
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Y{y.year_index}</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{formatCropName(y.crop_id, y.crop_name, locale)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                {t.sources.noPlanSelected}
              </p>
            )}

            <div>
              <button type="button" className="sf-btn sf-btn-sm" onClick={() => navigate("/rotation")}>
                <span>{t.nav.rotation}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </article>

          <article className="sf-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 18 }}>{t.sources.unknownInputsTitle}</h2>
              <span className={`sf-badge ${missingInputs.length > 0 ? "sf-badge-warning" : "sf-badge-success"}`}>
                {missingInputs.length > 0 ? (
                  <AlertCircle size={13} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={13} aria-hidden="true" />
                )}
                <span>
                  {missingInputs.length} {t.sources.missingBadgeSuffix}
                </span>
              </span>
            </div>

            {missingInputs.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--status-warning)", fontSize: 13.5, display: "flex", flexDirection: "column", gap: 4 }}>
                {missingInputs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                {t.sources.noUnknownInputs}
              </p>
            )}

            <div>
              <button type="button" className="sf-btn sf-btn-sm" onClick={() => navigate("/field")}>
                <span>{t.actions.completeInputs}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </article>
        </div>

        {/* Clickable Provenance Chain: Inputs -> Rules -> Comparison */}
        <section className="sf-panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontSize: 17 }}>{t.sources.flowTitle}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`sf-btn ${focusedSec === "nasa" ? "sf-btn-primary" : ""}`}
              onClick={() => focusCard("nasa", "source-nasa")}
            >
              <span>1. {t.sources.nasaCardTitle}</span>
            </button>
            <ArrowRight size={16} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
            <button
              type="button"
              className={`sf-btn ${focusedSec === "soil" ? "sf-btn-primary" : ""}`}
              onClick={() => focusCard("soil", "source-soil")}
            >
              <span>2. {t.sources.soilCardTitle}</span>
            </button>
            <ArrowRight size={16} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
            <button
              type="button"
              className={`sf-btn ${focusedSec === "rules" ? "sf-btn-primary" : ""}`}
              onClick={() => focusCard("rules", "source-rules")}
            >
              <span>3. {t.sources.rulesCardTitle} → {t.sources.flowComparison}</span>
            </button>
          </div>
        </section>

        {/* Full Provenance Cards */}
        <ProvenanceCards focusedSection={focusedSec} onSelectSection={setFocusedSec} />

        {/* NASA Space Apps Challenge Official Dataset Traceability Matrix */}
        <section className="sf-panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: 18, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
                <Satellite size={18} style={{ color: "var(--accent-cyan)" }} aria-hidden="true" />
                <span>{t.sources.challengeMatrixTitle}</span>
              </h2>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
                {t.sources.challengeMatrixSubtitle}
              </p>
            </div>
            <a
              href="https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/?tab=resources"
              target="_blank"
              rel="noreferrer"
              className="sf-btn sf-btn-sm"
            >
              <span>NASA Space Apps Resources</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>

          <div className="sf-grid-3">
            {[
              {
                name: "NASA LaRC POWER (MERRA-2)",
                live: true,
                scope: "T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, RH2M, WS2M, GWETTOP, GWETROOT, ALLSKY_SFC_SW_DWN",
                url: "https://power.larc.nasa.gov/",
              },
              {
                name: "NASA EOSDIS GIBS WMTS",
                live: true,
                scope: "MODIS Terra NDVI (16-Day), MODIS Daytime LST, GPM IMERG, SMAP L4 Soil Moisture, Blue Marble",
                url: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api",
              },
              {
                name: "SRTM / Copernicus 90m DEM",
                live: true,
                scope: "Coordinate terrain elevation (meters a.s.l.) via /api/orbital/elevation + Open-Meteo",
                url: "https://www.earthdata.nasa.gov/data/instruments/srtm",
              },
              {
                name: "CelesTrak SGP4 & Esri Imagery",
                live: true,
                scope: "Live TERRA / LANDSAT 8 orbital pass tracking & high-res farm parcel orthophoto",
                url: "https://celestrak.org/",
              },
              {
                name: "NASA SMAP & ECOSTRESS",
                live: false,
                scope: "Root-zone moisture & evaporative stress cross-reference for drought risk verification",
                url: "https://smap.jpl.nasa.gov/",
              },
              {
                name: "FAO GAEZ & ESA Copernicus",
                live: false,
                scope: "Global agro-ecological suitability zones & Sentinel-2 multispectral parcel baselines",
                url: "https://gaez.fao.org/",
              },
            ].map((item) => (
              <article
                key={item.name}
                className="sf-panel sf-panel-compact"
                style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{item.name}</strong>
                    <span className={`sf-badge ${item.live ? "sf-badge-success" : "sf-badge-violet"}`} style={{ fontSize: 11 }}>
                      {item.live ? t.sources.challengeLiveBadge : t.sources.challengeReferenceBadge}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {item.scope}
                  </p>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--accent-cyan)", textDecoration: "none" }}
                >
                  <span>{t.sources.openOfficialSource}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
