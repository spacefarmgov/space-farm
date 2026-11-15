import { useState } from "react";
import { ChevronDown, ChevronRight, Database, ExternalLink, FileCheck2, Sprout } from "lucide-react";
import { useSpaceFarm, type SourceDrawerSection } from "../../../context/SpaceFarmContext";
import { extractGridElevation } from "../../../data/regions";
import { formatLocaleDateTime, getValidationStatusLabel } from "../../../locales/translations";
import { CopyableValue } from "../../ui/StatusPrimitives";

interface ProvenanceCardsProps {
  focusedSection?: SourceDrawerSection;
  onSelectSection?: (sec: SourceDrawerSection) => void;
  compact?: boolean;
}

export function ProvenanceCards({
  focusedSection,
  onSelectSection,
  compact = false,
}: ProvenanceCardsProps) {
  const {
    t,
    locale,
    draft,
    climate,
    baselineSim,
    cropCatalog,
    selectedPlan,
    showToast,
  } = useSpaceFarm();

  const [hashExpanded, setHashExpanded] = useState(false);

  const activeClimate = baselineSim?.climate ?? climate;
  const nasaSource =
    activeClimate?.sources?.find((s) => s.source_kind === "upstream_dataset") ??
    activeClimate?.sources?.[0] ??
    null;

  const resolutionValues = nasaSource?.spatial_resolution
    ? Array.from(new Set(Object.values(nasaSource.spatial_resolution).filter(Boolean)))
    : [];
  const resolutionDisplay =
    resolutionValues.length > 0 ? resolutionValues.join(" · ") : t.climate.notAvailable;
  const rawElevation = extractGridElevation(activeClimate);
  const elevation =
    rawElevation && !resolutionDisplay.includes(rawElevation) ? rawElevation : null;

  const unitsDisplay = nasaSource?.units
    ? Object.entries(nasaSource.units)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : t.climate.notAvailable;

  const rulesInCatalog = cropCatalog?.rules ?? [];
  const selectedRuleIds = new Set<string>();
  selectedPlan?.explanations.forEach((ex) => ex.rule_ids.forEach((id) => selectedRuleIds.add(id)));
  selectedPlan?.constraints_checked.forEach((c) => selectedRuleIds.add(c.rule_id));

  const matchedRules =
    selectedRuleIds.size > 0 && rulesInCatalog.length > 0
      ? rulesInCatalog.filter((r) => selectedRuleIds.has(r.rule_id))
      : rulesInCatalog.slice(0, 4);

  const soilMissingItems: string[] = [];
  if (!draft.soilPhKnown) soilMissingItems.push(t.field.soilPhLabel);
  if (draft.soilTexture === "unknown") soilMissingItems.push(t.field.soilTextureLabel);
  if (draft.soilSourceType === "unknown") soilMissingItems.push(t.field.soilSourceTypeLabel);
  if (draft.irrigationType === "unknown") soilMissingItems.push(t.field.irrigationTypeLabel);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* NASA POWER Card */}
      <article
        id="source-nasa"
        className={`sf-panel ${compact ? "sf-panel-compact" : ""} ${
          focusedSection === "nasa" ? "sf-panel-selected" : ""
        }`}
        onClick={() => onSelectSection?.("nasa")}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17 }}>
            <Database size={18} style={{ color: "var(--accent-cyan)" }} aria-hidden="true" />
            <span>{t.sources.nasaCardTitle}</span>
          </h3>
          {nasaSource ? (
            <span className="sf-badge sf-badge-cyan">
              {nasaSource.source_kind}
            </span>
          ) : (
            <span className="sf-badge">{t.badges.dataNeeded}</span>
          )}
        </div>

        {nasaSource ? (
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 150px) minmax(0, 1fr)",
              gap: "8px 14px",
              margin: 0,
              fontSize: 13.5,
            }}
          >
            <dt style={{ color: "var(--text-muted)" }}>{t.sources.providerField}</dt>
            <dd style={{ margin: 0 }}>{nasaSource.provider}</dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.datasetField}</dt>
            <dd style={{ margin: 0 }}>{nasaSource.dataset}</dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.periodField}</dt>
            <dd className="tabular" style={{ margin: 0 }}>
              {nasaSource.observation_start} → {nasaSource.observation_end} ({nasaSource.time_standard})
            </dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.unitsField}</dt>
            <dd className="mono sf-wrap-anywhere" style={{ margin: 0, fontSize: 12.5 }}>
              {unitsDisplay}
            </dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.resolutionField}</dt>
            <dd className="sf-wrap-anywhere" style={{ margin: 0 }}>
              {resolutionDisplay}
              {elevation ? ` (${elevation})` : ""}
            </dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.retrievedField}</dt>
            <dd style={{ margin: 0 }}>{formatLocaleDateTime(nasaSource.retrieved_at, locale)}</dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.hashField}</dt>
            <dd style={{ margin: 0 }}>
              <CopyableValue
                value={nasaSource.payload_sha256}
                shortDisplay={
                  hashExpanded
                    ? nasaSource.payload_sha256
                    : `${nasaSource.payload_sha256.slice(0, 16)}…${nasaSource.payload_sha256.slice(-8)}`
                }
                copyLabel={t.actions.copy}
                copiedLabel={t.actions.copied}
                onCopySuccess={(m) => showToast(m)}
                onCopyError={() => showToast(t.errors.clipboardUnavailable)}
              />
              <button
                type="button"
                className="sf-btn sf-btn-sm"
                style={{ marginTop: 6, minHeight: 28 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setHashExpanded((x) => !x);
                }}
              >
                {hashExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>{hashExpanded ? t.sources.compactHashLabel : t.sources.fullHashLabel}</span>
              </button>
            </dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.sourceUrlField}</dt>
            <dd style={{ margin: 0 }}>
              <a
                href={nasaSource.source_url}
                target="_blank"
                rel="noreferrer"
                className="sf-wrap-anywhere"
                style={{
                  color: "var(--accent-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{nasaSource.source_url}</span>
                <ExternalLink size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
              </a>
            </dd>

            <dt style={{ color: "var(--text-muted)" }}>{t.sources.gibsField}</dt>
            <dd style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span>{t.sources.gibsValue}</span>
              <a
                href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api"
                target="_blank"
                rel="noreferrer"
                className="sf-wrap-anywhere"
                style={{
                  color: "var(--accent-cyan)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                }}
              >
                <span>NASA EOSDIS GIBS WMTS</span>
                <ExternalLink size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
              </a>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {t.sources.nasaAttributionNote}
              </span>
            </dd>
          </dl>
        ) : (
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13.5 }}>
            {t.sources.noSimYetNote}
          </p>
        )}
      </article>

      {/* Local Soil Inputs Card */}
      <article
        id="source-soil"
        className={`sf-panel ${compact ? "sf-panel-compact" : ""} ${
          focusedSection === "soil" ? "sf-panel-selected" : ""
        }`}
        onClick={() => onSelectSection?.("soil")}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17 }}>
            <Sprout size={18} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
            <span>{t.sources.soilCardTitle}</span>
          </h3>
          <span className="sf-badge sf-badge-violet">
            {t.field.soilSources[draft.soilSourceType]}
          </span>
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 150px) minmax(0, 1fr)",
            gap: "8px 14px",
            margin: 0,
            fontSize: 13.5,
          }}
        >
          <dt style={{ color: "var(--text-muted)" }}>{t.field.soilPhLabel}</dt>
          <dd className="tabular" style={{ margin: 0 }}>
            {`${draft.soilPh.toFixed(1)} pH · Humus ${draft.labMetrics.organicMatterPct.toFixed(1)}%`}
          </dd>

          <dt style={{ color: "var(--text-muted)" }}>NPK / EC (Lab)</dt>
          <dd className="mono" style={{ margin: 0, fontSize: 12.5 }}>
            {`N ${draft.labMetrics.nitrogenMgKg} · P ${draft.labMetrics.phosphorusMgKg} · K ${draft.labMetrics.potassiumMgKg} mg/kg · EC ${draft.labMetrics.ecDsM.toFixed(2)} dS/m`}
          </dd>

          <dt style={{ color: "var(--text-muted)" }}>{t.field.soilTextureLabel}</dt>
          <dd style={{ margin: 0 }}>{t.field.textures[draft.soilTexture]}</dd>

          <dt style={{ color: "var(--text-muted)" }}>{t.field.irrigationTypeLabel}</dt>
          <dd style={{ margin: 0 }}>
            {t.field.irrigations[draft.irrigationType]}
            {draft.irrigationType === "irrigated" ? ` (${draft.irrigationBudgetMm} mm)` : ""}
          </dd>

          <dt style={{ color: "var(--text-muted)" }}>{t.field.soilSourceRefLabel}</dt>
          <dd className="sf-wrap-anywhere" style={{ margin: 0 }}>
            {draft.soilSourceRef.trim() || "LAB-AZ-2025"}
          </dd>

          {soilMissingItems.length > 0 && (
            <>
              <dt style={{ color: "var(--text-muted)" }}>{t.sources.unknownInputsTitle}</dt>
              <dd style={{ margin: 0, color: "var(--status-warning)" }}>
                {soilMissingItems.join(", ")}
              </dd>
            </>
          )}
        </dl>
      </article>

      {/* Crop Rules Card */}
      <article
        id="source-rules"
        className={`sf-panel ${compact ? "sf-panel-compact" : ""} ${
          focusedSection === "rules" ? "sf-panel-selected" : ""
        }`}
        onClick={() => onSelectSection?.("rules")}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17 }}>
            <FileCheck2 size={18} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
            <span>{t.sources.rulesCardTitle}</span>
          </h3>
          {cropCatalog && (
            <span className="sf-badge">
              {cropCatalog.catalog_version} · {cropCatalog.rules_version}
            </span>
          )}
        </div>

        {matchedRules.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {matchedRules.map((rule) => (
              <div
                key={rule.rule_id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-deep)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 4,
                  }}
                >
                  <code className="mono" style={{ fontSize: 12, color: "var(--accent-soft)" }}>
                    {rule.rule_id}
                  </code>
                  <span
                    className={`sf-badge ${
                      rule.validation_status === "provisional"
                        ? "sf-badge-warning"
                        : "sf-badge-violet"
                    }`}
                  >
                    {getValidationStatusLabel(rule.validation_status, t)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                  {rule.condition} · <span className="mono">{rule.threshold} {rule.unit}</span>
                </p>
                {rule.source_url && (
                  <a
                    href={rule.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="sf-wrap-anywhere"
                    style={{ fontSize: 12, color: "var(--accent-cyan)", display: "inline-block", marginTop: 4 }}
                  >
                    {rule.source_url}
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13.5 }}>
            {t.sources.noSimYetNote}
          </p>
        )}
      </article>
    </div>
  );
}
