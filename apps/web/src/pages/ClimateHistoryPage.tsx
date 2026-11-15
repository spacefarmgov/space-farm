import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpenCheck, CloudRain, Info, RefreshCw, Table as TableIcon, Thermometer } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { DataModeBadge, ErrorPanel, LoadingSkeleton } from "../components/ui/StatusPrimitives";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import {
  DEFAULT_CLIMATE_PERIOD,
  extractGridElevation,
  getClimateCoverageSummary,
  getClimateFeatureValue,
} from "../data/regions";
import { formatLocaleDateTime, formatLocaleNumber } from "../locales/translations";

export function ClimateHistoryPage() {
  const {
    t,
    locale,
    draft,
    climate,
    climateLoading,
    climateError,
    climateStale,
    loadClimateForField,
    climateTimeseries,
    timeseriesLoading,
    timeseriesError,
    timeseriesStale,
    loadTimeseriesForField,
    openSourceDrawer,
  } = useSpaceFarm();
  const navigate = useNavigate();

  const [chartTab, setChartTab] = useState<"temperature" | "rainfall" | "summary">("temperature");
  const [seriesGranularity, setSeriesGranularity] = useState<"annual" | "monthly">("annual");
  const [showTable, setShowTable] = useState(false);
  const [showIllustrativeCurve, setShowIllustrativeCurve] = useState(false);

  // Trigger initial load once on page visit if no active bundle exists
  useEffect(() => {
    if (!climate && !climateLoading && !climateError) {
      void loadClimateForField();
      return;
    }
    if (
      climate &&
      (!climateTimeseries || timeseriesStale) &&
      !timeseriesLoading &&
      !timeseriesError
    ) {
      void loadTimeseriesForField();
    }
  }, [
    climate,
    climateLoading,
    climateError,
    climateTimeseries,
    timeseriesStale,
    timeseriesLoading,
    timeseriesError,
    loadClimateForField,
    loadTimeseriesForField,
  ]);

  const meanT = getClimateFeatureValue(climate, "mean_temperature");
  const minT = getClimateFeatureValue(climate, "min_temperature");
  const maxT = getClimateFeatureValue(climate, "max_temperature");
  const totalPrecip = getClimateFeatureValue(climate, "total_precipitation_mm");
  const frostDays = getClimateFeatureValue(climate, "frost_days_count");
  const wetDays = getClimateFeatureValue(climate, "wet_days_count");
  const surfaceWetness = getClimateFeatureValue(climate, "mean_surface_soil_wetness");
  const rootWetness = getClimateFeatureValue(climate, "mean_root_zone_soil_wetness");
  const solarIrradiance = getClimateFeatureValue(climate, "mean_solar_irradiance_mj_m2_day");
  const humidityPct = getClimateFeatureValue(climate, "mean_relative_humidity_pct");
  const windSpeedMs = getClimateFeatureValue(climate, "mean_wind_speed_m_s");
  const coverage = getClimateCoverageSummary(climate);
  const elevation = extractGridElevation(climate);
  const source = climate?.sources?.[0] ?? null;

  // Build clean illustrative curve points ONLY when explicitly toggled on by user and timeseries is absent
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const illustrativeTemps =
    meanT !== null && minT !== null && maxT !== null
      ? months.map((_, i) => {
          const phase = ((i - 6.2) / 12) * Math.PI * 2;
          const amp = (maxT - minT) * 0.36;
          return Number((meanT + Math.cos(phase) * amp).toFixed(1));
        })
      : [];

  const activeTimeseries = climateTimeseries && !timeseriesStale ? climateTimeseries : null;
  const annualSeries = activeTimeseries?.annual_series ?? [];
  const monthlySeries = activeTimeseries?.focus_monthly_series ?? [];
  const trendSummary = activeTimeseries?.trend ?? null;
  const focusAnnualRow = activeTimeseries
    ? annualSeries.find((row) => row.year === activeTimeseries.focus_year) ?? null
    : null;
  const focusHeatDays = focusAnnualRow
    ? focusAnnualRow.heat_stress_days
    : monthlySeries.length > 0
      ? monthlySeries.reduce((sum, item) => sum + item.heat_stress_days, 0)
      : null;

  const droughtColorMap = {
    low: "var(--accent-cyan)",
    moderate: "var(--status-warning)",
    elevated: "var(--status-error)",
    unknown: "var(--text-muted)",
  } as const;

  return (
    <AppShell variant="inner">
      <div className="sf-container">
        {/* Top Context Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="sf-page-title">{t.climate.title}</h1>
            <p className="sf-subtitle">{t.climate.subtitle}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="sf-badge">
              {draft.label} ({draft.latitude.toFixed(2)}°N, {draft.longitude.toFixed(2)}°E)
            </span>
            <span className="sf-badge sf-badge-cyan">
              {t.badges.historicalData} · {DEFAULT_CLIMATE_PERIOD.start_date} → {DEFAULT_CLIMATE_PERIOD.end_date} (UTC)
            </span>
            {climate && (
              <DataModeBadge mode={climate.data_mode} synthetic={climate.synthetic} t={t} />
            )}
          </div>
        </div>

        {/* Stale field notice if coordinates changed since last fetch */}
        {climateStale && (
          <div className="sf-banner sf-banner-warning" role="status">
            <div>
              <strong>{t.staleBanner.title}: </strong>
              <span>{t.explore.verifiedSnapshotsLabel}</span>
            </div>
            <button
              type="button"
              className="sf-btn sf-btn-sm sf-btn-primary"
              onClick={() => void loadClimateForField()}
              disabled={climateLoading}
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>{t.actions.recalculate}</span>
            </button>
          </div>
        )}

        {climateError && (
          <ErrorPanel
            error={climateError}
            t={t}
            onRetry={() => void loadClimateForField()}
          />
        )}

        {climateLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="sf-grid-3">
              <LoadingSkeleton height={110} />
              <LoadingSkeleton height={110} />
              <LoadingSkeleton height={110} />
            </div>
            <LoadingSkeleton height={280} />
          </div>
        ) : climate ? (
          <>
            {/* Real Metric Cards */}
            <div className="sf-grid-3">
              <article className="sf-panel sf-panel-compact">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.climate.meanTemp}</span>
                  <Thermometer size={16} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
                </div>
                <div className="tabular" style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-display)" }}>
                  {meanT !== null ? `${formatLocaleNumber(meanT, locale, 1)} °C` : "—"}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {t.climate.minTemp}: {minT !== null ? `${formatLocaleNumber(minT, locale, 1)} °C` : "—"} ·{" "}
                  {t.climate.maxTemp}: {maxT !== null ? `${formatLocaleNumber(maxT, locale, 1)} °C` : "—"}
                </div>
                {trendSummary && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                    {t.climate.trendDecadeLabel}:{" "}
                    <strong className="tabular">
                      {trendSummary.temp_shift_c_per_decade !== null && trendSummary.temp_shift_c_per_decade !== undefined
                        ? `${trendSummary.temp_shift_c_per_decade >= 0 ? "+" : ""}${formatLocaleNumber(trendSummary.temp_shift_c_per_decade, locale, 2)} °C`
                        : "—"}
                    </strong>{" "}
                    · {t.climate.heatStressLabel}: <strong className="tabular">{focusHeatDays ?? "—"} d</strong>
                  </div>
                )}
              </article>

              <article className="sf-panel sf-panel-compact">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.climate.totalPrecip}</span>
                  <CloudRain size={16} style={{ color: "var(--accent-cyan)" }} aria-hidden="true" />
                </div>
                <div className="tabular" style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-display)" }}>
                  {totalPrecip !== null ? `${formatLocaleNumber(totalPrecip, locale, 1)} mm` : "—"}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {t.climate.wetDays}: {wetDays !== null ? wetDays : "—"} · {t.climate.frostDays}: {frostDays !== null ? frostDays : "—"}
                </div>
                {(surfaceWetness !== null || rootWetness !== null) && (
                  <div style={{ fontSize: 12, color: "var(--accent-cyan)", marginTop: 4 }}>
                    {surfaceWetness !== null && (
                      <span>
                        {t.climate.surfaceWetnessLabel}: <strong className="tabular">{formatLocaleNumber(surfaceWetness, locale, 2)}</strong>
                      </span>
                    )}
                    {surfaceWetness !== null && rootWetness !== null ? " · " : ""}
                    {rootWetness !== null && (
                      <span>
                        {t.climate.rootWetnessLabel}: <strong className="tabular">{formatLocaleNumber(rootWetness, locale, 2)}</strong>
                      </span>
                    )}
                  </div>
                )}
                {trendSummary && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                    {t.climate.drySpellLabel}: <strong className="tabular">{trendSummary.max_dry_spell_days_overall} d</strong> ·{" "}
                    {t.climate.droughtRiskLabel}:{" "}
                    <strong style={{ color: droughtColorMap[trendSummary.drought_risk_level] }}>
                      {t.climate.riskLevels[trendSummary.drought_risk_level]}
                    </strong>
                  </div>
                )}
              </article>

              <article className="sf-panel sf-panel-compact">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.climate.coverage}</span>
                  <Info size={16} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
                </div>
                <div className="tabular" style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-display)" }}>
                  {coverage}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {t.climate.elevation}: {elevation ?? t.climate.notAvailable}
                </div>
                {solarIrradiance !== null && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {t.climate.solarIrradianceLabel}:{" "}
                    <strong className="tabular">{formatLocaleNumber(solarIrradiance, locale, 2)} MJ/m²/d</strong>
                  </div>
                )}
                {(humidityPct !== null || windSpeedMs !== null) && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {humidityPct !== null && (
                      <span>
                        {t.climate.humidityLabel}: <strong className="tabular">{formatLocaleNumber(humidityPct, locale, 1)}%</strong>
                      </span>
                    )}
                    {humidityPct !== null && windSpeedMs !== null ? " · " : ""}
                    {windSpeedMs !== null && (
                      <span>
                        {t.climate.windSpeedLabel}: <strong className="tabular">{formatLocaleNumber(windSpeedMs, locale, 1)} m/s</strong>
                      </span>
                    )}
                  </div>
                )}
                {trendSummary && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                    {t.climate.multiyearMeanLabel} ({annualSeries.length}y):{" "}
                    <strong className="tabular">
                      {trendSummary.multiyear_mean_precip_mm !== null && trendSummary.multiyear_mean_precip_mm !== undefined
                        ? `${formatLocaleNumber(trendSummary.multiyear_mean_precip_mm, locale, 0)} mm`
                        : "—"}
                    </strong>{" "}
                    · {t.climate.driestYearLabel}: <strong className="tabular">{trendSummary.driest_year ?? "—"}</strong>
                  </div>
                )}
              </article>
            </div>

            {/* Scientific Aggregate View + Chart/Table Controls */}
            <section className="sf-panel" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div className="sf-segmented" role="tablist" aria-label="Climate metric view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={chartTab === "temperature"}
                    className={`sf-seg-btn ${chartTab === "temperature" ? "active" : ""}`}
                    onClick={() => setChartTab("temperature")}
                  >
                    {t.climate.toggleTemperature}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={chartTab === "rainfall"}
                    className={`sf-seg-btn ${chartTab === "rainfall" ? "active" : ""}`}
                    onClick={() => setChartTab("rainfall")}
                  >
                    {t.climate.toggleRainfall}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={chartTab === "summary"}
                    className={`sf-seg-btn ${chartTab === "summary" ? "active" : ""}`}
                    onClick={() => setChartTab("summary")}
                  >
                    {t.climate.toggleComparison}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {activeTimeseries && chartTab !== "summary" ? (
                    <div className="sf-segmented" role="group" aria-label="Timeseries granularity">
                      <button
                        type="button"
                        className={`sf-seg-btn ${seriesGranularity === "annual" ? "active" : ""}`}
                        onClick={() => setSeriesGranularity("annual")}
                      >
                        {t.climate.viewAnnualLabel}
                      </button>
                      <button
                        type="button"
                        className={`sf-seg-btn ${seriesGranularity === "monthly" ? "active" : ""}`}
                        onClick={() => setSeriesGranularity("monthly")}
                      >
                        {t.climate.viewMonthlyLabel}
                      </button>
                    </div>
                  ) : !activeTimeseries ? (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={showIllustrativeCurve}
                        onChange={(e) => setShowIllustrativeCurve(e.target.checked)}
                        style={{ accentColor: "var(--accent-primary)" }}
                      />
                      <span>{t.climate.illustrativeToggleLabel}</span>
                    </label>
                  ) : null}

                  <button
                    type="button"
                    className="sf-btn sf-btn-sm"
                    onClick={() => setShowTable((s) => !s)}
                  >
                    <TableIcon size={14} aria-hidden="true" />
                    <span>{showTable ? t.actions.viewChart : t.actions.viewDataTable}</span>
                  </button>
                </div>
              </div>

              {/* Explicit API Honesty Notice */}
              <div className="sf-banner sf-banner-violet" style={{ padding: "10px 14px", fontSize: 13 }}>
                <div>
                  <strong>
                    {activeTimeseries ? t.climate.timeseriesHonestyTitle : t.climate.aggregateHonestyTitle}:{" "}
                  </strong>
                  <span>
                    {activeTimeseries ? t.climate.timeseriesHonestyBody : t.climate.aggregateHonestyBody}
                  </span>
                </div>
              </div>

              {showTable ? (
                <div className="sf-table-wrap">
                  <table className="sf-table">
                    <thead>
                      <tr>
                        <th>{t.climate.tableColumns.metric}</th>
                        <th>{t.climate.tableColumns.value}</th>
                        <th>{t.climate.tableColumns.unit}</th>
                        <th>{t.climate.tableColumns.coverage}</th>
                        <th>{t.climate.tableColumns.parameters}</th>
                        <th>{t.climate.tableColumns.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {climate.features.map((f) => (
                        <tr key={f.feature_id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{t.climate.featureLabels[f.feature_id] ?? f.feature_id}</div>
                            <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.feature_id}</div>
                          </td>
                          <td className="tabular" style={{ fontWeight: 600 }}>
                            {f.value !== null ? formatLocaleNumber(f.value, locale, f.unit === "days" || f.unit === "day" ? 0 : 2) : `— (${f.reason ?? t.badges.unknown})`}
                          </td>
                          <td>{f.unit}</td>
                          <td className="tabular">
                            {f.valid_days}/{f.expected_days} ({Math.round(f.coverage_ratio * 100)}%)
                          </td>
                          <td className="mono">{f.parameter_codes.join(", ")}</td>
                          <td className="mono">{f.method_version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : chartTab === "temperature" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ width: "100%", overflowX: "auto" }}>
                    <svg
                      viewBox="0 0 760 240"
                      style={{ width: "100%", height: "auto", minWidth: 320, display: "block" }}
                      role="img"
                      aria-label={`2024 temperature profile: Min ${minT ?? "unknown"}°C, Mean ${meanT ?? "unknown"}°C, Max ${maxT ?? "unknown"}°C`}
                    >
                      <defs>
                        <linearGradient id="tempBandGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.28" />
                          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.32" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Calibration Grid Lines (-10°C .. 40°C) */}
                      {[-10, 0, 10, 20, 30, 40].map((deg) => {
                        const y = 200 - ((deg + 10) / 50) * 165;
                        return (
                          <g key={deg}>
                            <line x1="56" y1={y} x2="732" y2={y} stroke="#2b2b43" strokeDasharray="3 4" />
                            <text x="12" y={y + 4} fill="#9291a8" fontSize="11" fontFamily="JetBrains Mono, monospace">
                              {deg}°C
                            </text>
                          </g>
                        );
                      })}

                      {/* Real Multi-Year / Monthly NASA POWER Telemetry OR Min-Max Span Band Fallback */}
                      {activeTimeseries && seriesGranularity === "annual" && annualSeries.some((a) => a.mean_temp_c !== null && a.mean_temp_c !== undefined) ? (
                        (() => {
                          const toY = (v: number) => 200 - ((v + 10) / 50) * 165;
                          const count = Math.max(1, annualSeries.length - 1);
                          const points = annualSeries
                            .map((a, idx) => {
                              if (a.mean_temp_c === null || a.mean_temp_c === undefined) return null;
                              const x = annualSeries.length === 1 ? 390 : 76 + (idx / count) * 628;
                              return { a, x, y: toY(a.mean_temp_c) };
                            })
                            .filter((pt): pt is NonNullable<typeof pt> => pt !== null);
                          const pathD = points
                            .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
                            .join(" ");
                          return (
                            <>
                              {points.map((pt) => {
                                const minV = pt.a.min_temp_c;
                                const maxV = pt.a.max_temp_c;
                                return (
                                  <g key={pt.a.year}>
                                    {minV !== null && minV !== undefined && maxV !== null && maxV !== undefined && (
                                      <line
                                        x1={pt.x}
                                        y1={toY(maxV)}
                                        x2={pt.x}
                                        y2={toY(minV)}
                                        stroke="#8b5cf6"
                                        strokeOpacity="0.28"
                                        strokeWidth="6"
                                        strokeLinecap="round"
                                      />
                                    )}
                                  </g>
                                );
                              })}
                              <path d={pathD} fill="none" stroke="#c4b5fd" strokeWidth="2.8" />
                              {points.map((pt) => (
                                <g key={`pt-${pt.a.year}`}>
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r="5.5"
                                    fill={pt.a.year === trendSummary?.hottest_year ? "#fbbf24" : "var(--text-primary)"}
                                    stroke="#8b5cf6"
                                    strokeWidth="2.2"
                                  >
                                    <title>
                                      {`${pt.a.year}: Mean ${pt.a.mean_temp_c?.toFixed(1)}°C (Min ${pt.a.min_temp_c?.toFixed(1) ?? "—"}°C, Max ${pt.a.max_temp_c?.toFixed(1) ?? "—"}°C · Heat ≥35°C: ${pt.a.heat_stress_days}d)`}
                                    </title>
                                  </circle>
                                  <text
                                    x={pt.x}
                                    y={pt.y - 10}
                                    textAnchor="middle"
                                    fill="var(--text-primary)"
                                    fontSize="10.5"
                                    fontWeight="600"
                                  >
                                    {pt.a.mean_temp_c?.toFixed(1)}°
                                  </text>
                                  <text x={pt.x} y={224} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
                                    {pt.a.year}
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()
                      ) : activeTimeseries && seriesGranularity === "monthly" && monthlySeries.some((m) => m.mean_temp_c !== null && m.mean_temp_c !== undefined) ? (
                        (() => {
                          const toY = (v: number) => 200 - ((v + 10) / 50) * 165;
                          const points = monthlySeries
                            .map((m, idx) => {
                              if (m.mean_temp_c === null || m.mean_temp_c === undefined) return null;
                              const x = 76 + (idx / 11) * 628;
                              return { m, x, y: toY(m.mean_temp_c) };
                            })
                            .filter((pt): pt is NonNullable<typeof pt> => pt !== null);
                          const pathD = points
                            .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
                            .join(" ");
                          return (
                            <>
                              <path d={pathD} fill="none" stroke="#67e8f9" strokeWidth="2.8" />
                              {points.map((pt) => (
                                <g key={pt.m.month}>
                                  <circle cx={pt.x} cy={pt.y} r="5" fill="var(--text-primary)" stroke="var(--accent-cyan)" strokeWidth="2.2">
                                    <title>
                                      {`${pt.m.label} ${activeTimeseries.focus_year}: ${pt.m.mean_temp_c?.toFixed(1)}°C · Frost ${pt.m.frost_days}d · Heat ${pt.m.heat_stress_days}d`}
                                    </title>
                                  </circle>
                                  <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="var(--text-primary)" fontSize="10.5" fontWeight="600">
                                    {pt.m.mean_temp_c?.toFixed(1)}°
                                  </text>
                                  <text x={pt.x} y={224} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
                                    {pt.m.label}
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()
                      ) : (
                        minT !== null &&
                        maxT !== null &&
                        meanT !== null && (
                          <>
                            {(() => {
                              const toY = (v: number) => 200 - ((v + 10) / 50) * 165;
                              const yMin = toY(minT);
                              const yMax = toY(maxT);
                              const yMean = toY(meanT);
                              return (
                                <>
                                  <rect
                                    x="90"
                                    y={Math.min(yMax, yMin)}
                                    width="580"
                                    height={Math.max(4, Math.abs(yMin - yMax))}
                                    rx="10"
                                    fill="url(#tempBandGrad)"
                                    stroke="#8b5cf6"
                                    strokeOpacity="0.45"
                                  />
                                  <line x1="90" y1={yMean} x2="670" y2={yMean} stroke="var(--text-primary)" strokeWidth="2.5" />
                                  <circle cx="150" cy={yMin} r="5.5" fill="var(--accent-cyan)" />
                                  <text x="164" y={yMin - 6} fill="var(--accent-cyan)" fontSize="12" fontWeight="600">
                                    Min {minT.toFixed(1)} °C
                                  </text>
                                  <circle cx="380" cy={yMean} r="6.5" fill="var(--text-primary)" stroke="var(--accent-primary)" strokeWidth="2.5" />
                                  <text x="394" y={yMean - 8} fill="var(--text-primary)" fontSize="12.5" fontWeight="700">
                                    Mean {meanT.toFixed(1)} °C
                                  </text>
                                  <circle cx="600" cy={yMax} r="5.5" fill="var(--accent-soft)" />
                                  <text x="530" y={yMax - 8} fill="var(--accent-soft)" fontSize="12" fontWeight="600">
                                    Max {maxT.toFixed(1)} °C
                                  </text>
                                </>
                              );
                            })()}
                          </>
                        )
                      )}

                      {/* Optional Explicit Illustrative Seasonal Curve ONLY when no multi-year telemetry */}
                      {!activeTimeseries && showIllustrativeCurve && illustrativeTemps.length === 12 && (
                        <>
                          <path
                            d={illustrativeTemps
                              .map((temp, i) => {
                                const x = 96 + i * 52;
                                const y = 200 - ((temp + 10) / 50) * 165;
                                return `${i === 0 ? "M" : "L"}${x},${y}`;
                              })
                              .join(" ")}
                            fill="none"
                            stroke="#fde68a"
                            strokeWidth="2.2"
                            strokeDasharray="6 4"
                          />
                          {months.map((m, i) => (
                            <text key={m} x={88 + i * 52} y={224} fill="#9291a8" fontSize="11">
                              {m}
                            </text>
                          ))}
                        </>
                      )}
                    </svg>
                  </div>

                  {!activeTimeseries && showIllustrativeCurve && (
                    <div className="sf-badge sf-badge-warning" style={{ alignSelf: "flex-start" }}>
                      {t.badges.illustrativeData}: {t.climate.illustrativeWarning}
                    </div>
                  )}
                </div>
              ) : chartTab === "rainfall" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="sf-grid-2">
                    <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--bg-deep)", border: "1px solid var(--border-default)" }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                        {t.climate.totalPrecip} (2024 UTC)
                      </div>
                      <div className="tabular" style={{ fontSize: 28, fontWeight: 700, color: "var(--accent-cyan)", marginBottom: 10 }}>
                        {totalPrecip !== null ? `${formatLocaleNumber(totalPrecip, locale, 1)} mm` : "—"}
                      </div>
                      <div className="sf-meter-track">
                        <div
                          className="sf-meter-fill-cyan"
                          style={{ width: `${Math.min(100, Math.round(((totalPrecip ?? 0) / 900) * 100))}%` }}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                        Reference semi-arid range scale: 0–900 mm / yr
                      </div>
                    </div>

                    <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--bg-deep)", border: "1px solid var(--border-default)" }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                        {t.climate.wetDays} vs {t.climate.frostDays}
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginBottom: 10 }}>
                        <span className="tabular" style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-cyan)" }}>
                          {wetDays ?? "—"} d
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>/</span>
                        <span className="tabular" style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-soft)" }}>
                          {frostDays ?? "—"} d
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                        PRECTOTCORR &ge; 1 mm/day &middot; T2M_MIN &lt; 0 °C
                      </div>
                    </div>
                  </div>

                  {activeTimeseries && (
                    <div style={{ width: "100%", overflowX: "auto" }}>
                      <svg
                        viewBox="0 0 760 220"
                        style={{ width: "100%", height: "auto", minWidth: 320, display: "block" }}
                        role="img"
                        aria-label="Precipitation distribution chart"
                      >
                        {seriesGranularity === "annual" && annualSeries.length > 0
                          ? (() => {
                              const maxVal = Math.max(
                                600,
                                Math.ceil(Math.max(...annualSeries.map((a) => a.total_precip_mm ?? 0), 100) / 100) * 100,
                              );
                              const plotW = 636;
                              const barW = Math.min(42, Math.max(18, Math.floor((plotW / annualSeries.length) * 0.62)));
                              const meanY =
                                trendSummary?.multiyear_mean_precip_mm !== null &&
                                trendSummary?.multiyear_mean_precip_mm !== undefined
                                  ? 186 - (trendSummary.multiyear_mean_precip_mm / maxVal) * 146
                                  : null;
                              return (
                                <>
                                  {[0, Math.round(maxVal / 2), maxVal].map((tick) => {
                                    const y = 186 - (tick / maxVal) * 146;
                                    return (
                                      <g key={tick}>
                                        <line x1="56" y1={y} x2="732" y2={y} stroke="#2b2b43" strokeDasharray="3 4" />
                                        <text x="10" y={y + 4} fill="#9291a8" fontSize="11" fontFamily="JetBrains Mono, monospace">
                                          {tick}
                                        </text>
                                      </g>
                                    );
                                  })}
                                  {meanY !== null && (
                                    <line
                                      x1="56"
                                      y1={meanY}
                                      x2="732"
                                      y2={meanY}
                                      stroke="#c4b5fd"
                                      strokeOpacity="0.6"
                                      strokeDasharray="5 4"
                                    />
                                  )}
                                  {annualSeries.map((a, idx) => {
                                    const val = a.total_precip_mm ?? 0;
                                    const h = Math.max(3, (val / maxVal) * 146);
                                    const xCenter =
                                      annualSeries.length === 1
                                        ? 390
                                        : 82 + (idx / Math.max(1, annualSeries.length - 1)) * 608;
                                    const x = xCenter - barW / 2;
                                    const y = 186 - h;
                                    const isDriest = a.year === trendSummary?.driest_year;
                                    return (
                                      <g key={a.year}>
                                        <rect
                                          x={x}
                                          y={y}
                                          width={barW}
                                          height={h}
                                          rx="4"
                                          fill={isDriest ? "#fbbf24" : "#67e8f9"}
                                          fillOpacity={isDriest ? "0.85" : "0.78"}
                                        >
                                          <title>
                                            {`${a.year}: ${a.total_precip_mm?.toFixed(1) ?? "—"} mm · Wet days: ${a.wet_days} · Max dry spell: ${a.max_dry_spell_days}d`}
                                          </title>
                                        </rect>
                                        <text x={xCenter} y={y - 6} textAnchor="middle" fill="#e2e8f0" fontSize="10.5">
                                          {a.total_precip_mm !== null && a.total_precip_mm !== undefined ? Math.round(a.total_precip_mm) : "—"}
                                        </text>
                                        <text x={xCenter} y={208} textAnchor="middle" fill="#9291a8" fontSize="11">
                                          {a.year}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </>
                              );
                            })()
                          : monthlySeries.length > 0
                            ? (() => {
                                const maxM = Math.max(
                                  80,
                                  Math.ceil(Math.max(...monthlySeries.map((m) => m.total_precip_mm ?? 0), 20) / 20) * 20,
                                );
                                return (
                                  <>
                                    {[0, Math.round(maxM / 2), maxM].map((tick) => {
                                      const y = 186 - (tick / maxM) * 146;
                                      return (
                                        <g key={tick}>
                                          <line x1="56" y1={y} x2="732" y2={y} stroke="#2b2b43" strokeDasharray="3 4" />
                                          <text x="10" y={y + 4} fill="#9291a8" fontSize="11" fontFamily="JetBrains Mono, monospace">
                                            {tick}
                                          </text>
                                        </g>
                                      );
                                    })}
                                    {monthlySeries.map((m, idx) => {
                                      const val = m.total_precip_mm ?? 0;
                                      const h = Math.max(2, (val / maxM) * 146);
                                      const xCenter = 82 + (idx / 11) * 608;
                                      const barW = 28;
                                      const x = xCenter - barW / 2;
                                      const y = 186 - h;
                                      return (
                                        <g key={m.month}>
                                          <rect x={x} y={y} width={barW} height={h} rx="4" fill="#8b5cf6" fillOpacity="0.82">
                                            <title>{`${m.label} ${activeTimeseries.focus_year}: ${m.total_precip_mm?.toFixed(1) ?? "—"} mm · Wet days: ${m.wet_days}`}</title>
                                          </rect>
                                          <text x={xCenter} y={y - 6} textAnchor="middle" fill="#e2e8f0" fontSize="10.5">
                                            {m.total_precip_mm !== null && m.total_precip_mm !== undefined ? Math.round(m.total_precip_mm) : "—"}
                                          </text>
                                          <text x={xCenter} y={208} textAnchor="middle" fill="#9291a8" fontSize="11">
                                            {m.label}
                                          </text>
                                        </g>
                                      );
                                    })}
                                  </>
                                );
                              })()
                            : null}
                      </svg>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="sf-grid-3">
                    {climate.features.map((f) => (
                      <div
                        key={f.feature_id}
                        style={{
                          padding: 14,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-deep)",
                          border: "1px solid var(--border-default)",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                          {t.climate.featureLabels[f.feature_id] ?? f.feature_id}
                        </div>
                        <div className="tabular" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                          {f.value !== null ? `${formatLocaleNumber(f.value, locale, f.unit === "days" || f.unit === "day" ? 0 : 2)} ${f.unit}` : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          {f.valid_days}/{f.expected_days}d · {f.parameter_codes.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>

                  {trendSummary && (
                    <div className="sf-grid-3">
                      <div style={{ padding: 14, borderRadius: "var(--radius-sm)", background: "var(--bg-deep)", border: "1px solid var(--border-default)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.climate.trendDecadeLabel}</div>
                        <div className="tabular" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                          {trendSummary.temp_shift_c_per_decade !== null && trendSummary.temp_shift_c_per_decade !== undefined
                            ? `${trendSummary.temp_shift_c_per_decade >= 0 ? "+" : ""}${formatLocaleNumber(trendSummary.temp_shift_c_per_decade, locale, 2)} °C`
                            : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          {t.climate.hottestYearLabel}: {trendSummary.hottest_year ?? "—"}
                        </div>
                      </div>

                      <div style={{ padding: 14, borderRadius: "var(--radius-sm)", background: "var(--bg-deep)", border: "1px solid var(--border-default)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.climate.droughtRiskLabel}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: droughtColorMap[trendSummary.drought_risk_level] }}>
                          {t.climate.riskLevels[trendSummary.drought_risk_level]}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          {t.climate.drySpellLabel}: {trendSummary.max_dry_spell_days_overall} d
                        </div>
                      </div>

                      <div style={{ padding: 14, borderRadius: "var(--radius-sm)", background: "var(--bg-deep)", border: "1px solid var(--border-default)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {t.climate.driestYearLabel} / {t.climate.wettestYearLabel}
                        </div>
                        <div className="tabular" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                          {trendSummary.driest_year ?? "—"} / {trendSummary.wettest_year ?? "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          {t.climate.heatStressLabel}: {focusHeatDays ?? "—"} d
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* NASA POWER Source Summary Card */}
            <section className="sf-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16 }}>{t.climate.sourceCardTitle}</strong>
                  <DataModeBadge mode={climate.data_mode} synthetic={climate.synthetic} t={t} />
                </div>
                {source && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {source.provider} · {source.dataset} · {source.observation_start} → {source.observation_end} ({source.time_standard}) ·{" "}
                    {t.climate.retrievedAtLabel}: {formatLocaleDateTime(source.retrieved_at, locale)}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm"
                  onClick={() => openSourceDrawer("nasa")}
                >
                  <BookOpenCheck size={14} aria-hidden="true" />
                  <span>{t.actions.viewSource}</span>
                </button>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm sf-btn-primary"
                  onClick={() => navigate("/rotation")}
                >
                  <span>{t.nav.rotation}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
