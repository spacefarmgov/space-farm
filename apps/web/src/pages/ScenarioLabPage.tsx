import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FlaskConical, Play, RotateCcw } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { DataModeBadge, ErrorPanel, LoadingSkeleton } from "../components/ui/StatusPrimitives";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import { hasClimateContextMismatch } from "../data/regions";
import { formatCropName, formatLocaleNumber } from "../locales/translations";

const STRESS_STEPS: Array<{ value: 0.9 | 0.8 | 0.7; label: string }> = [
  { value: 0.9, label: "−10% (0.9×)" },
  { value: 0.8, label: "−20% (0.8×)" },
  { value: 0.7, label: "−30% (0.7×)" },
];

export function ScenarioLabPage() {
  const {
    t,
    locale,
    draft,
    baselineSim,
    stressSim,
    stressLoading,
    stressError,
    rainfallMultiplier,
    setRainfallMultiplier,
    runStressSimulation,
    resetStressComparison,
    selectedPlan,
  } = useSpaceFarm();

  const [detailsOpen, setDetailsOpen] = useState(true);

  const baselineMatchedPlan = selectedPlan ?? baselineSim?.plans?.[0] ?? null;

  // Match stress plan cleanly: pinned_plan_evaluation first, then plan_id or exact crop sequence (never blind array index!)
  const matchedStressPlan =
    baselineMatchedPlan &&
    stressSim?.pinned_plan_evaluation &&
    stressSim.pinned_plan_evaluation.plan_id === baselineMatchedPlan.plan_id
      ? stressSim.pinned_plan_evaluation
      : baselineMatchedPlan && stressSim?.plans?.length
        ? stressSim.plans.find((p) => p.plan_id === baselineMatchedPlan.plan_id) ??
          stressSim.plans.find(
            (p) =>
              p.years.map((y) => y.crop_id).join("-") ===
              baselineMatchedPlan.years.map((y) => y.crop_id).join("-"),
          ) ??
          null
        : null;

  const topStressPlan = stressSim?.plans?.[0] ?? null;
  const datasetMismatch = hasClimateContextMismatch(baselineSim, stressSim);

  const noRankingChange =
    baselineSim?.plans?.[0] &&
    topStressPlan &&
    baselineSim.plans[0].plan_id === topStressPlan.plan_id;

  const waterSupplyBase = baselineSim?.input_summary.effective_water_supply_mm ?? null;
  const waterSupplyStress = stressSim?.input_summary.effective_water_supply_mm ?? null;

  const baseWaterVal =
    baselineMatchedPlan?.score_components.water.value !== null &&
    baselineMatchedPlan?.score_components.water.value !== undefined
      ? Math.round(baselineMatchedPlan.score_components.water.value * 100)
      : null;
  const stressWaterVal =
    matchedStressPlan?.score_components.water.value !== null &&
    matchedStressPlan?.score_components.water.value !== undefined
      ? Math.round(matchedStressPlan.score_components.water.value * 100)
      : null;

  const baseSoilVal =
    baselineMatchedPlan?.score_components.soil.value !== null &&
    baselineMatchedPlan?.score_components.soil.value !== undefined
      ? Math.round(baselineMatchedPlan.score_components.soil.value * 100)
      : null;
  const stressSoilVal =
    matchedStressPlan?.score_components.soil.value !== null &&
    matchedStressPlan?.score_components.soil.value !== undefined
      ? Math.round(matchedStressPlan.score_components.soil.value * 100)
      : null;

  return (
    <AppShell variant="inner">
      <div className="sf-container">
        {/* Panoramic Backdrop Hero Container */}
        <section className="sf-scenario-hero">
          <img
            src="/assets/scenario-panorama.jpg"
            alt=""
            className="sf-scenario-bg"
            aria-hidden="true"
            decoding="async"
          />

          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h1 className="sf-page-title">{t.scenarios.title}</h1>
                  <span className="sf-badge sf-badge-violet">
                    <FlaskConical size={13} aria-hidden="true" />
                    <span>{t.badges.hypotheticalScenario}</span>
                  </span>
                </div>
                <p className="sf-subtitle">{t.scenarios.subtitle}</p>
              </div>

              {stressSim && (
                <DataModeBadge mode={stressSim.data_mode} synthetic={stressSim.synthetic} t={t} />
              )}
            </div>

            <div className="sf-banner sf-banner-violet" style={{ padding: "10px 14px", fontSize: 13 }}>
              <span>{t.scenarios.notForecastNote}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.scenarios.panoramaDisclaimer}</span>
            </div>

            {datasetMismatch && (
              <div className="sf-banner sf-banner-warning" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{t.scenarios.contextMismatchWarning}</span>
              </div>
            )}

            {stressError && (
              <ErrorPanel
                error={stressError}
                t={t}
                onRetry={() => void runStressSimulation()}
              />
            )}

            {/* Foreground Controls + Dual Comparison Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                gap: 18,
                alignItems: "stretch",
              }}
            >
              {/* Left Card: Baseline */}
              <article className="sf-panel-glass" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: 19 }}>{t.scenarios.baselineTitle}</h2>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t.scenarios.baselineSubtitle}</span>
                  </div>
                  <span className="sf-badge mono">1.0× (0%)</span>
                </div>

                {baselineSim ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{t.scenarios.waterSupplyLabel}</span>
                      <strong className="tabular">
                        {waterSupplyBase !== null ? `${formatLocaleNumber(waterSupplyBase, locale, 1)} mm` : "—"}
                      </strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{t.scenarios.topPlanLabel}</span>
                      <strong>
                        {baselineMatchedPlan
                          ? baselineMatchedPlan.years
                              .map((y) => formatCropName(y.crop_id, y.crop_name, locale))
                              .join(" → ")
                          : "—"}
                      </strong>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>{t.scenarios.planScoreLabel}</span>
                        <span className="tabular">{baselineMatchedPlan?.score !== null && baselineMatchedPlan?.score !== undefined ? `${baselineMatchedPlan.score.toFixed(1)} / 100` : "—"}</span>
                      </div>
                      <div className="sf-meter-track">
                        <div className="sf-meter-fill-violet" style={{ width: `${baselineMatchedPlan?.score ?? 0}%` }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>{t.scenarios.waterComponentLabel}</span>
                        <span className="tabular">{baseWaterVal !== null ? `${baseWaterVal}%` : "—"}</span>
                      </div>
                      <div className="sf-meter-track">
                        <div className="sf-meter-fill-cyan" style={{ width: `${baseWaterVal ?? 0}%` }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>{t.scenarios.soilComponentLabel}</span>
                        <span className="tabular">{baseSoilVal !== null ? `${baseSoilVal}%` : "—"}</span>
                      </div>
                      <div className="sf-meter-track">
                        <div className="sf-meter-fill-violet" style={{ width: `${baseSoilVal ?? 0}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
                    {t.scenarios.runPromptBody}
                  </p>
                )}
              </article>

              {/* Center/Middle or Right Card: Rainfall Stress Comparison */}
              <article className="sf-panel-glass sf-panel-selected" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: 19 }}>{t.scenarios.stressTitle}</h2>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t.scenarios.stressSubtitle}</span>
                  </div>
                  <span className="sf-badge sf-badge-cyan mono">
                    {Math.round((rainfallMultiplier - 1) * 100)}% ({rainfallMultiplier}×)
                  </span>
                </div>

                {stressLoading ? (
                  <LoadingSkeleton height={180} />
                ) : stressSim ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{t.scenarios.waterSupplyLabel}</span>
                      <strong className="tabular">
                        {waterSupplyStress !== null ? `${formatLocaleNumber(waterSupplyStress, locale, 1)} mm` : "—"}
                      </strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{t.scenarios.topPlanLabel}</span>
                      <strong>
                        {topStressPlan
                          ? topStressPlan.years.map((y) => formatCropName(y.crop_id, y.crop_name, locale)).join(" → ")
                          : t.badges.noFeasiblePlan}
                      </strong>
                    </div>

                    {baselineMatchedPlan && !matchedStressPlan ? (
                      <div className="sf-banner sf-banner-error" style={{ padding: "8px 10px", fontSize: 12.5 }}>
                        <span>{t.scenarios.planBecameInfeasible}</span>
                      </div>
                    ) : (
                      <>
                        {matchedStressPlan && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}>
                            <span>{t.scenarios.pinnedReferenceLabel}</span>
                            <span style={{ color: "var(--text-secondary)" }}>
                              {matchedStressPlan.years
                                .map((y) => formatCropName(y.crop_id, y.crop_name, locale))
                                .join(" → ")}
                            </span>
                          </div>
                        )}

                        {matchedStressPlan?.feasible === false && (
                          <div className="sf-banner sf-banner-error" style={{ padding: "8px 10px", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span>{t.scenarios.pinnedWaterGapNote}</span>
                            {matchedStressPlan.failed_rules && matchedStressPlan.failed_rules.length > 0 && (
                              <span style={{ fontSize: 11.5 }}>
                                {t.scenarios.pinnedFailedRulesLabel}:{" "}
                                <code className="mono">{matchedStressPlan.failed_rules.join(", ")}</code>
                              </span>
                            )}
                          </div>
                        )}

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span>{t.scenarios.planScoreLabel}</span>
                            <span className="tabular">{matchedStressPlan?.score !== null && matchedStressPlan?.score !== undefined ? `${matchedStressPlan.score.toFixed(1)} / 100` : "—"}</span>
                          </div>
                          <div className="sf-meter-track">
                            <div className="sf-meter-fill-violet" style={{ width: `${matchedStressPlan?.score ?? 0}%` }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span>{t.scenarios.waterComponentLabel}</span>
                            <span className="tabular">{stressWaterVal !== null ? `${stressWaterVal}%` : "—"}</span>
                          </div>
                          <div className="sf-meter-track">
                            <div className="sf-meter-fill-cyan" style={{ width: `${stressWaterVal ?? 0}%` }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span>{t.scenarios.soilComponentLabel}</span>
                            <span className="tabular">{stressSoilVal !== null ? `${stressSoilVal}%` : "—"}</span>
                          </div>
                          <div className="sf-meter-track">
                            <div className="sf-meter-fill-violet" style={{ width: `${stressSoilVal ?? 0}%` }} />
                          </div>
                        </div>
                      </>
                    )}

                    {noRankingChange && (
                      <div style={{ fontSize: 12.5, color: "var(--accent-soft)" }}>
                        {t.scenarios.noRankingChange}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5, color: "var(--text-secondary)", padding: "12px 0" }}>
                    <strong>{t.scenarios.runPromptTitle}</strong>
                    <p style={{ margin: "6px 0 0" }}>{t.scenarios.runPromptBody}</p>
                  </div>
                )}
              </article>

              {/* Right Control Box: Stepped Multiplier + Run/Reset */}
              <article className="sf-panel-glass" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.scenarios.rainfallChangeLabel}</div>

                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <span className="tabular" style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--accent-soft)" }}>
                      {Math.round((rainfallMultiplier - 1) * 100)}%
                    </span>
                  </div>

                  {/* Discrete contract steps */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                    {STRESS_STEPS.map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        className={`sf-btn sf-btn-sm ${rainfallMultiplier === st.value ? "sf-btn-primary" : ""}`}
                        onClick={() => setRainfallMultiplier(st.value)}
                      >
                        {st.value === 0.9 ? "−10%" : st.value === 0.8 ? "−20%" : "−30%"}
                      </button>
                    ))}
                  </div>

                  <label className="sf-field">
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {t.scenarios.steppedRangeHint}
                    </span>
                    <input
                      type="range"
                      min={0.7}
                      max={0.9}
                      step={0.1}
                      className="sf-range"
                      value={rainfallMultiplier}
                      onChange={(e) => {
                        const v = Number(Number(e.target.value).toFixed(1));
                        if (v === 0.7 || v === 0.8 || v === 0.9) setRainfallMultiplier(v);
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    type="button"
                    className="sf-btn sf-btn-primary"
                    onClick={() => void runStressSimulation()}
                    disabled={stressLoading}
                  >
                    <Play size={15} aria-hidden="true" />
                    <span>{t.actions.runScenario}</span>
                  </button>

                  {stressSim && (
                    <button
                      type="button"
                      className="sf-btn sf-btn-sm"
                      onClick={resetStressComparison}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      <span>{t.actions.resetToBaseline}</span>
                    </button>
                  )}
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Bottom Collapsible Scenario Details Accordion */}
        <section className="sf-accordion">
          <button
            type="button"
            className="sf-accordion-trigger"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((o) => !o)}
          >
            <span>{t.scenarios.accordionTitle}</span>
            {detailsOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          </button>

          {detailsOpen && (
            <div className="sf-accordion-panel">
              <div className="sf-grid-2" style={{ paddingTop: 12, gap: 14 }}>
                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                    {t.scenarios.accChanged}
                  </strong>
                  <span>
                    {t.scenarios.accChangedDesc
                      .replace("{multiplier}", String(rainfallMultiplier))
                      .replace("{pct}", String(Math.round((rainfallMultiplier - 1) * 100)))}
                  </span>
                </div>

                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                    {t.scenarios.accUnchanged}
                  </strong>
                  <span>
                    {t.scenarios.accUnchangedDesc
                      .replace("{lat}", draft.latitude.toFixed(2))
                      .replace("{lon}", draft.longitude.toFixed(2))}
                  </span>
                </div>

                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                    {t.scenarios.accRules}
                  </strong>
                  <span>{t.scenarios.accRulesDesc}</span>
                </div>

                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                    {t.scenarios.accLimits}
                  </strong>
                  <span>{t.scenarios.accLimitsDesc}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
