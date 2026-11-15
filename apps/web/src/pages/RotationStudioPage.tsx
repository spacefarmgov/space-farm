import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, BookOpenCheck, CheckCircle2, Layers3, SlidersHorizontal, Sparkles } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  CropIcon,
  DataModeBadge,
  ErrorPanel,
  LoadingSkeleton,
  SimulationStatusBadge,
  StaleBanner,
} from "../components/ui/StatusPrimitives";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import { normalizeWeightsForRequest } from "../data/regions";
import { formatLocaleNumber } from "../locales/translations";

export function RotationStudioPage() {
  const {
    t,
    locale,
    draft,
    requestedWeights,
    setRequestedWeights,
    baselineSim,
    baselineLoading,
    baselineError,
    isStale,
    previousSimFieldLabel,
    runBaselineSimulation,
    setSelectedPlanId,
    selectedPlan,
    openSourceDrawer,
  } = useSpaceFarm();
  const navigate = useNavigate();
  const explanationRef = useRef<HTMLDivElement | null>(null);

  const normalizedReq = normalizeWeightsForRequest(requestedWeights) ?? { water: 0.5, soil: 0.3, income: 0.2 };
  const plans = baselineSim?.plans ?? [];

  function handleSliderChange(key: "water" | "soil" | "income", rawPct: number) {
    const val = Math.max(0, Math.min(1, rawPct / 100));
    setRequestedWeights({
      ...requestedWeights,
      [key]: val,
    });
  }

  return (
    <AppShell variant="inner">
      <div className="sf-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="sf-page-title">{t.rotation.title}</h1>
            <p className="sf-subtitle">{t.rotation.subtitle}</p>
          </div>
          {baselineSim && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SimulationStatusBadge status={baselineSim.status} t={t} />
              <DataModeBadge mode={baselineSim.data_mode} synthetic={baselineSim.synthetic} t={t} />
            </div>
          )}
        </div>

        {/* Stale Inputs Banner */}
        {isStale && (
          <StaleBanner
            t={t}
            onRecalculate={() => void runBaselineSimulation()}
            loading={baselineLoading}
          />
        )}

        {previousSimFieldLabel && isStale && (
          <div className="sf-banner sf-banner-violet" role="status">
            <span>
              Previous field results still displayed for <strong>{previousSimFieldLabel}</strong>; current selected field is <strong>{draft.label}</strong>.
            </span>
          </div>
        )}

        {baselineError && (
          <ErrorPanel
            error={baselineError}
            t={t}
            onRetry={() => void runBaselineSimulation()}
          />
        )}

        <div className="sf-rotation-split">
          {/* Left Panel: Priorities + Active Field Summary */}
          <aside className="sf-panel sf-panel-compact" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SlidersHorizontal size={16} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
              <h2 style={{ fontSize: 17 }}>{t.rotation.prioritiesTitle}</h2>
            </div>

            <label className="sf-field">
              <div className="sf-label-row">
                <span>{t.rotation.weightWater}</span>
                <span className="mono">{Math.round(normalizedReq.water * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="sf-range"
                value={Math.round(requestedWeights.water * 100)}
                onChange={(e) => handleSliderChange("water", Number(e.target.value))}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.rotation.weightWaterHint}</span>
            </label>

            <label className="sf-field">
              <div className="sf-label-row">
                <span>{t.rotation.weightSoil}</span>
                <span className="mono">{Math.round(normalizedReq.soil * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="sf-range"
                value={Math.round(requestedWeights.soil * 100)}
                onChange={(e) => handleSliderChange("soil", Number(e.target.value))}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.rotation.weightSoilHint}</span>
            </label>

            <label className="sf-field">
              <div className="sf-label-row">
                <span>{t.rotation.weightIncome}</span>
                <span className="sf-badge sf-badge-violet">
                  {locale === "az" ? "Bazar modulu" : "Market add-on"}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="sf-range"
                value={Math.round(requestedWeights.income * 100)}
                onChange={(e) => handleSliderChange("income", Number(e.target.value))}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.rotation.weightIncomeHint}</span>
            </label>

            {baselineSim && (
              <div
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-deep)",
                  border: "1px solid var(--border-default)",
                  fontSize: 12.5,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.rotation.effectiveWeightsTitle}</div>
                <div className="mono" style={{ color: "var(--text-secondary)" }}>
                  {t.rotation.waterFit} {Math.round(baselineSim.weights_effective.water * 100)}% · {t.rotation.soilFit}{" "}
                  {Math.round(baselineSim.weights_effective.soil * 100)}% · {t.rotation.incomeFit}{" "}
                  {Math.round(baselineSim.weights_effective.income * 100)}%
                </div>
              </div>
            )}

            <div
              style={{
                borderTop: "1px solid var(--border-default)",
                paddingTop: 12,
                fontSize: 12.5,
                color: "var(--text-secondary)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>{t.rotation.inputSummaryTitle}</strong>
              <span>{draft.label} ({draft.areaHa} ha)</span>
              <span>
                {t.field.soilPhLabel}: {draft.soilPhKnown ? draft.soilPh.toFixed(1) : t.badges.unknown}
              </span>
              <span>{t.field.irrigationTypeLabel}: {t.field.irrigations[draft.irrigationType]}</span>
              <button
                type="button"
                className="sf-btn sf-btn-sm"
                style={{ alignSelf: "flex-start", marginTop: 4 }}
                onClick={() => navigate("/field")}
              >
                {t.actions.completeInputs}
              </button>
            </div>

            <button
              type="button"
              className="sf-btn sf-btn-primary"
              onClick={() => void runBaselineSimulation()}
              disabled={baselineLoading}
            >
              <Layers3 size={16} aria-hidden="true" />
              <span>{t.actions.compareAlternatives}</span>
            </button>
          </aside>

          {/* Center / Right Plans & Explanations */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {baselineLoading ? (
              <div className="sf-grid-3">
                <LoadingSkeleton height={340} />
                <LoadingSkeleton height={340} />
                <LoadingSkeleton height={340} />
              </div>
            ) : !baselineSim ? (
              <div className="sf-panel" style={{ textAlign: "center", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <Layers3 size={34} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
                <h2 style={{ fontSize: 21 }}>{t.rotation.emptyTitle}</h2>
                <p style={{ margin: 0, maxWidth: "52ch", color: "var(--text-secondary)" }}>
                  {t.rotation.emptyBody}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  <button
                    type="button"
                    className="sf-btn sf-btn-primary"
                    onClick={() => void runBaselineSimulation()}
                  >
                    {t.actions.compareAlternatives}
                  </button>
                  <button type="button" className="sf-btn" onClick={() => navigate("/field")}>
                    {t.actions.completeInputs}
                  </button>
                </div>
              </div>
            ) : baselineSim.status === "no_feasible_plan" ? (
              <div className="sf-panel" style={{ borderColor: "var(--status-error-border)", display: "flex", flexDirection: "column", gap: 14 }}>
                <h2 style={{ color: "var(--status-error)", fontSize: 20 }}>{t.rotation.noFeasibleTitle}</h2>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>{t.rotation.noFeasibleBody}</p>
                {baselineSim.rejected_summary.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", fontSize: 13.5 }}>
                    {baselineSim.rejected_summary.map((rej) => (
                      <li key={rej.rule_id}>
                        <code className="mono">{rej.rule_id}</code> ({rej.count}): {rej.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <button type="button" className="sf-btn sf-btn-primary" onClick={() => navigate("/field")}>
                    {t.actions.completeInputs}
                  </button>
                </div>
              </div>
            ) : baselineSim.status === "needs_data" ? (
              <div className="sf-panel" style={{ borderColor: "var(--status-warning-border)", display: "flex", flexDirection: "column", gap: 14 }}>
                <h2 style={{ color: "var(--status-warning)", fontSize: 20 }}>{t.rotation.needsDataTitle}</h2>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>{t.rotation.needsDataBody}</p>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", fontSize: 13.5 }}>
                  {baselineSim.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <div>
                  <button type="button" className="sf-btn sf-btn-primary" onClick={() => navigate("/field")}>
                    {t.actions.completeInputs}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {baselineSim.status === "provisional" && (
                  <div className="sf-banner sf-banner-warning" role="status">
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <AlertTriangle size={17} aria-hidden="true" />
                      <span>{t.rotation.provisionalBanner}</span>
                    </div>
                  </div>
                )}

                {/* Adaptive Plan Cards Grid (1, 2, or 3 plans) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      plans.length === 1
                        ? "minmax(0, 1fr)"
                        : plans.length === 2
                          ? "repeat(auto-fit, minmax(300px, 1fr))"
                          : "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 18,
                  }}
                >
                  {plans.map((plan, index) => {
                    const isSelected = selectedPlan?.plan_id === plan.plan_id;
                    const planLetter = String.fromCharCode(65 + index);
                    const waterPct =
                      plan.score_components.water.value !== null
                        ? Math.round(plan.score_components.water.value * 100)
                        : null;
                    const soilPct =
                      plan.score_components.soil.value !== null
                        ? Math.round(plan.score_components.soil.value * 100)
                        : null;

                    return (
                      <article
                        key={plan.plan_id}
                        className={`sf-panel ${isSelected ? "sf-panel-selected" : ""}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 14,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <h3 style={{ fontSize: 18 }}>Plan {planLetter}</h3>
                              {index === 0 && (
                                <span style={{ fontSize: 12, color: "var(--accent-soft)", fontWeight: 500 }}>
                                  {t.rotation.topRankedLabel}
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div
                                className="tabular"
                                style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                              >
                                {plan.score !== null ? formatLocaleNumber(plan.score, locale, 1) : "—"}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>/ 100</div>
                            </div>
                          </div>

                          {/* 3-Year Crop Sequence Timeline */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {plan.years.map((yr) => (
                              <div
                                key={yr.year_index}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "9px 11px",
                                  borderRadius: "var(--radius-sm)",
                                  background: "var(--bg-deep)",
                                  border: "1px solid var(--border-default)",
                                }}
                              >
                                <CropIcon cropId={yr.crop_id} size={18} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>{yr.crop_name}</span>
                                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                                      {t.rotation.yearLabel} {yr.year_index}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                    {yr.family}
                                    {yr.planting_window
                                      ? ` · ${yr.planting_window}${yr.harvest_window ? ` → ${yr.harvest_window}` : ""}`
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Component Meters */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ color: "var(--text-secondary)" }}>{t.rotation.waterFit}</span>
                                <span className="tabular">{waterPct !== null ? `${waterPct}%` : "—"}</span>
                              </div>
                              <div className="sf-meter-track">
                                <div className="sf-meter-fill-cyan" style={{ width: `${waterPct ?? 0}%` }} />
                              </div>
                            </div>

                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ color: "var(--text-secondary)" }}>{t.rotation.soilFit}</span>
                                <span className="tabular">{soilPct !== null ? `${soilPct}%` : "—"}</span>
                              </div>
                              <div className="sf-meter-track">
                                <div className="sf-meter-fill-violet" style={{ width: `${soilPct ?? 0}%` }} />
                              </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ color: "var(--text-secondary)" }}>{t.rotation.incomeFit}</span>
                              <span className="sf-badge sf-badge-violet">
                                {locale === "az" ? "Agroiqtisadi əlavə" : "Market index"}
                              </span>
                            </div>

                            {plan.indicators && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                  gap: 6,
                                  marginTop: 4,
                                  paddingTop: 8,
                                  borderTop: "1px dashed var(--border-default)",
                                  fontSize: 11.5,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                                  <span style={{ color: "var(--text-muted)" }}>{t.rotation.nitrogenFixation}</span>
                                  <strong className="tabular">{Math.round(plan.indicators.nitrogen_fixation_score * 100)}%</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                                  <span style={{ color: "var(--text-muted)" }}>{t.rotation.erosionCover}</span>
                                  <strong className="tabular">{Math.round(plan.indicators.erosion_protection_score * 100)}%</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                                  <span style={{ color: "var(--text-muted)" }}>{t.rotation.climateResilience}</span>
                                  <strong className="tabular">{Math.round(plan.indicators.climate_resilience_score * 100)}%</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                                  <span style={{ color: "var(--text-muted)" }}>{t.rotation.bareSoilGap}</span>
                                  <strong className="tabular">{plan.indicators.bare_soil_gap_months_3yr} {t.rotation.monthsUnit}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border-default)", paddingTop: 12 }}>
                          <button
                            type="button"
                            className={`sf-btn sf-btn-sm ${isSelected ? "sf-btn-primary" : ""}`}
                            style={{ flex: 1 }}
                            aria-pressed={isSelected}
                            onClick={() => setSelectedPlanId(plan.plan_id)}
                          >
                            {isSelected && <CheckCircle2 size={14} aria-hidden="true" />}
                            <span>{isSelected ? t.rotation.selectedBtn : `${t.rotation.selectPlanPrefix} ${planLetter}`}</span>
                          </button>

                          <button
                            type="button"
                            className="sf-btn sf-btn-sm"
                            onClick={() => {
                              setSelectedPlanId(plan.plan_id);
                              explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            }}
                          >
                            {t.actions.whyThisPlan}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Selected Plan Detailed Reasoning & Constraints */}
                {selectedPlan && (
                  <section ref={explanationRef} className="sf-panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <h2 className="sf-section-title">
                          <Sparkles size={18} style={{ color: "var(--accent-soft)", marginRight: 8, verticalAlign: "text-bottom" }} aria-hidden="true" />
                          {t.rotation.whyTitle} ({selectedPlan.years.map((y) => y.crop_name).join(" → ")})
                        </h2>
                        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
                          {t.rotation.scoreDisclaimer}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="sf-btn sf-btn-sm"
                          onClick={() => openSourceDrawer("rules")}
                        >
                          <BookOpenCheck size={14} aria-hidden="true" />
                          <span>{t.actions.viewSource}</span>
                        </button>
                        <button
                          type="button"
                          className="sf-btn sf-btn-sm sf-btn-primary"
                          onClick={() => navigate("/scenarios")}
                        >
                          <span>{t.nav.scenarios}</span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="sf-grid-2">
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <h3 style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t.rotation.whyTitle}</h3>
                        {selectedPlan.explanations.map((ex) => (
                          <div
                            key={ex.code}
                            style={{
                              padding: 12,
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-deep)",
                              border: "1px solid var(--border-default)",
                              fontSize: 13.5,
                            }}
                          >
                            <p style={{ margin: 0 }}>{ex.text}</p>
                            <div className="mono" style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                              {ex.rule_ids.join(", ")}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <h3 style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t.rotation.constraintsTitle}</h3>
                        {selectedPlan.constraints_checked.map((c) => (
                          <div
                            key={c.rule_id}
                            style={{
                              padding: 12,
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-deep)",
                              border: "1px solid var(--border-default)",
                              fontSize: 13.5,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <code className="mono" style={{ fontSize: 12 }}>{c.rule_id}</code>
                              <span className={`sf-badge ${c.result === "pass" ? "sf-badge-success" : "sf-badge-warning"}`}>
                                {c.result === "pass" ? t.rotation.constraintPassLabel : t.badges.unknown}
                              </span>
                            </div>
                            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>{c.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {((selectedPlan.benefits && selectedPlan.benefits.length > 0) ||
                      (selectedPlan.risk_factors && selectedPlan.risk_factors.length > 0)) && (
                      <div className="sf-grid-2">
                        {selectedPlan.benefits && selectedPlan.benefits.length > 0 && (
                          <div
                            style={{
                              padding: 12,
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-deep)",
                              border: "1px solid var(--border-default)",
                              fontSize: 13,
                            }}
                          >
                            <h3 style={{ fontSize: 14, color: "var(--accent-cyan)", marginBottom: 6 }}>
                              {t.rotation.benefitsTitle}
                            </h3>
                            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
                              {selectedPlan.benefits.map((b, idx) => (
                                <li key={idx}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selectedPlan.risk_factors && selectedPlan.risk_factors.length > 0 && (
                          <div
                            style={{
                              padding: 12,
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-deep)",
                              border: "1px solid var(--border-default)",
                              fontSize: 13,
                            }}
                          >
                            <h3 style={{ fontSize: 14, color: "var(--status-warning)", marginBottom: 6 }}>
                              {t.rotation.risksTitle}
                            </h3>
                            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
                              {selectedPlan.risk_factors.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {baselineSim.baseline_practice_plan && (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-deep)",
                          border: "1px solid var(--border-default)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div>
                            <strong style={{ fontSize: 13.5, color: "var(--text-primary)" }}>{t.rotation.benchmarkTitle}</strong>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.rotation.benchmarkSubtitle}</div>
                          </div>
                          <span className={`sf-badge ${baselineSim.baseline_practice_plan.feasible === false ? "sf-badge-warning" : "sf-badge-neutral"}`}>
                            {baselineSim.baseline_practice_plan.years.map((y) => y.crop_name).join(" → ")}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: 10,
                            fontSize: 12.5,
                          }}
                        >
                          <div>
                            <div style={{ color: "var(--text-muted)" }}>{t.rotation.suitabilityScore}</div>
                            <strong className="tabular">
                              {baselineSim.baseline_practice_plan.score !== null && baselineSim.baseline_practice_plan.score !== undefined
                                ? baselineSim.baseline_practice_plan.score.toFixed(1)
                                : "—"}{" "}
                              vs{" "}
                              {selectedPlan.score !== null && selectedPlan.score !== undefined
                                ? selectedPlan.score.toFixed(1)
                                : "—"}
                            </strong>
                          </div>
                          {baselineSim.baseline_practice_plan.indicators && selectedPlan.indicators && (
                            <>
                              <div>
                                <div style={{ color: "var(--text-muted)" }}>{t.rotation.nitrogenFixation}</div>
                                <strong className="tabular">
                                  {Math.round(baselineSim.baseline_practice_plan.indicators.nitrogen_fixation_score * 100)}% vs{" "}
                                  {Math.round(selectedPlan.indicators.nitrogen_fixation_score * 100)}%
                                </strong>
                              </div>
                              <div>
                                <div style={{ color: "var(--text-muted)" }}>{t.rotation.erosionCover}</div>
                                <strong className="tabular">
                                  {Math.round(baselineSim.baseline_practice_plan.indicators.erosion_protection_score * 100)}% vs{" "}
                                  {Math.round(selectedPlan.indicators.erosion_protection_score * 100)}%
                                </strong>
                              </div>
                              <div>
                                <div style={{ color: "var(--text-muted)" }}>{t.rotation.avgWaterDemand}</div>
                                <strong className="tabular">
                                  {Math.round(baselineSim.baseline_practice_plan.indicators.water_demand_mm_avg)} vs{" "}
                                  {Math.round(selectedPlan.indicators.water_demand_mm_avg)} mm
                                </strong>
                              </div>
                            </>
                          )}
                        </div>
                        {baselineSim.baseline_practice_plan.failed_rules && baselineSim.baseline_practice_plan.failed_rules.length > 0 && (
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            <code className="mono">{baselineSim.baseline_practice_plan.failed_rules.join(", ")}</code>
                          </div>
                        )}
                      </div>
                    )}

                    {(baselineSim.warnings.length > 0 || baselineSim.limitations.length > 0) && (
                      <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                        <strong style={{ color: "var(--text-primary)" }}>{t.rotation.warningsTitle}: </strong>
                        <span>{[...baselineSim.warnings, ...baselineSim.limitations].join(" · ")}</span>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
