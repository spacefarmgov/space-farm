import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  CloudRain,
  Flame,
  Mail,
  MapPin,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  Snowflake,
  Sprout,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import {
  SpaceFarmApiError,
  fetchAlertsOverview,
  scanAlertsNow,
  setWeatherAlertStatus,
  updateAlertPreferences,
  verifyAlertDispatchChannels,
  type AlertsOverviewResponse,
  type RiskSeverity,
} from "../api/extendedClient";
import { formatLocaleDateTime, formatLocaleNumber } from "../locales/translations";

function maxSeverity(list: RiskSeverity[]): RiskSeverity {
  const rank: Record<RiskSeverity, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
  return list.reduce<RiskSeverity>((acc, cur) => (rank[cur] > rank[acc] ? cur : acc), "low");
}

function severityClass(sev: RiskSeverity): string {
  switch (sev) {
    case "critical":
      return "sf-sev-critical";
    case "high":
      return "sf-sev-high";
    case "moderate":
      return "sf-sev-moderate";
    default:
      return "sf-sev-low";
  }
}

export function RiskAlertsPage() {
  const { authToken, locale, t, showToast } = useSpaceFarm();
  const navigate = useNavigate();
  const ap = t.alertsPage;

  const [overview, setOverview] = useState<AlertsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"open" | "all">("open");

  // Form state for preferences
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [minSeverity, setMinSeverity] = useState<"critical" | "high" | "moderate">("high");
  const [frostThresh, setFrostThresh] = useState("1.0");
  const [heatThresh, setHeatThresh] = useState("36.0");

  const syncPrefsForm = useCallback((data: AlertsOverviewResponse) => {
    setSmsEnabled(data.preferences.sms_enabled);
    setEmailEnabled(data.preferences.email_enabled);
    setMinSeverity(data.preferences.min_severity);
    setFrostThresh(String(data.preferences.custom_frost_c));
    setHeatThresh(String(data.preferences.custom_heat_c));
  }, []);

  const handleAlertsError = useCallback(
    (err: unknown) => {
      if (err instanceof SpaceFarmApiError && err.status === 401) {
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : t.errors.unexpectedBody);
    },
    [t.errors.unexpectedBody],
  );

  const loadOverview = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAlertsOverview(authToken);
      setOverview(data);
      syncPrefsForm(data);
    } catch (err) {
      handleAlertsError(err);
    } finally {
      setLoading(false);
    }
  }, [authToken, handleAlertsError, syncPrefsForm]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function handleScanNow() {
    if (!authToken || scanning) return;
    setScanning(true);
    setErrorMsg(null);
    try {
      const data = await scanAlertsNow(authToken);
      setOverview(data);
      syncPrefsForm(data);
      showToast(ap.scanDoneToast);
    } catch (err) {
      handleAlertsError(err);
    } finally {
      setScanning(false);
    }
  }

  async function handleVerifyChannels() {
    if (!authToken || verifying) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const data = await verifyAlertDispatchChannels(authToken);
      setOverview(data);
      showToast(ap.dispatchDoneToast);
    } catch (err) {
      handleAlertsError(err);
    } finally {
      setVerifying(false);
    }
  }

  async function handleSavePrefs(e: FormEvent) {
    e.preventDefault();
    if (!authToken || savingPrefs) return;
    setSavingPrefs(true);
    setErrorMsg(null);
    try {
      const parsedFrost = Number(frostThresh);
      const parsedHeat = Number(heatThresh);
      const data = await updateAlertPreferences(authToken, {
        sms_enabled: smsEnabled,
        email_enabled: emailEnabled,
        min_severity: minSeverity,
        custom_frost_c: Number.isFinite(parsedFrost) ? parsedFrost : 1.0,
        custom_heat_c: Number.isFinite(parsedHeat) ? parsedHeat : 36.0,
      });
      setOverview(data);
      syncPrefsForm(data);
      showToast(ap.prefsSavedToast);
    } catch (err) {
      handleAlertsError(err);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleAlertAction(alertId: string, status: "acknowledged" | "resolved") {
    if (!authToken) return;
    try {
      const res = await setWeatherAlertStatus(authToken, alertId, status);
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              alerts: prev.alerts.map((a) => (a.id === alertId ? res.alert : a)),
            }
          : prev,
      );
    } catch (err) {
      handleAlertsError(err);
    }
  }

  const snapshots = overview?.snapshots ?? [];
  const allAlerts = overview?.alerts ?? [];
  const dispatches = overview?.dispatches ?? [];
  const worker = overview?.worker;
  const contacts = overview?.contacts;

  const visibleAlerts =
    filterMode === "open"
      ? allAlerts.filter((a) => a.status !== "resolved")
      : allAlerts;

  const frostWorst = maxSeverity(snapshots.map((s) => s.frost_risk));
  const droughtWorst = maxSeverity(snapshots.map((s) => s.drought_risk));
  const heatWorst = maxSeverity(snapshots.map((s) => s.heat_risk));
  const rainWorst = maxSeverity(snapshots.map((s) => s.rain_risk));

  const minTmin = snapshots
    .map((s) => s.forecast_tmin_c)
    .filter((v): v is number => v !== null);
  const maxTmax = snapshots
    .map((s) => s.forecast_tmax_c)
    .filter((v): v is number => v !== null);
  const minBalance = snapshots
    .map((s) => s.water_balance_mm)
    .filter((v): v is number => v !== null);
  const maxPrecip7d = snapshots
    .map((s) => s.forecast_precip_7d_mm)
    .filter((v): v is number => v !== null);

  return (
    <AppShell>
      <div className="sf-container sf-section" style={{ paddingTop: 26, paddingBottom: 56 }}>
        {/* Header + Worker Telemetry Toolbar */}
        <div className="sf-alerts-head">
          <div>
            <span className="sf-eyebrow">{ap.eyebrow}</span>
            <h1>{ap.title}</h1>
            <p className="sf-subtitle">{ap.subtitle}</p>
          </div>

          <div className="sf-alerts-toolbar">
            {worker && (
              <div className="sf-worker-pill" title={`${ap.workerInterval}: ${Math.round(worker.interval_seconds / 60)} min`}>
                <span className={`sf-worker-dot ${worker.running ? "is-on" : ""}`} />
                <div>
                  <strong>{ap.workerActive}</strong>
                  <small className="mono">
                    {ap.workerLastRun}:{" "}
                    {worker.last_run_at
                      ? formatLocaleDateTime(worker.last_run_at, locale)
                      : ap.workerNever}
                  </small>
                </div>
              </div>
            )}

            <button
              type="button"
              className="sf-btn sf-btn-primary"
              disabled={scanning || loading}
              onClick={() => void handleScanNow()}
            >
              <RefreshCw size={15} className={scanning ? "sf-spin" : ""} aria-hidden="true" />
              <span>{scanning ? ap.scanningBtn : ap.scanBtn}</span>
            </button>

            <button
              type="button"
              className="sf-btn"
              disabled={verifying || loading}
              onClick={() => void handleVerifyChannels()}
            >
              <Send size={15} aria-hidden="true" />
              <span>{verifying ? ap.verifyingBtn : ap.verifyBtn}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="sf-banner sf-banner-error" role="alert">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 4 Weather Hazard KPI Cards */}
        <div className="sf-alerts-kpi-grid">
          <div className={`sf-panel sf-alert-kpi ${severityClass(frostWorst)}`}>
            <div className="sf-alert-kpi-top">
              <span className="sf-alert-kpi-icon">
                <Snowflake size={18} aria-hidden="true" />
              </span>
              <span className={`sf-sev-pill ${severityClass(frostWorst)}`}>
                {ap.severity[frostWorst]}
              </span>
            </div>
            <h3>{ap.hazards.frost}</h3>
            <strong className="mono">
              {minTmin.length > 0
                ? `Tmin ${formatLocaleNumber(Math.min(...minTmin), locale, 1)} °C`
                : "—"}
            </strong>
          </div>

          <div className={`sf-panel sf-alert-kpi ${severityClass(droughtWorst)}`}>
            <div className="sf-alert-kpi-top">
              <span className="sf-alert-kpi-icon">
                <Sprout size={18} aria-hidden="true" />
              </span>
              <span className={`sf-sev-pill ${severityClass(droughtWorst)}`}>
                {ap.severity[droughtWorst]}
              </span>
            </div>
            <h3>{ap.hazards.drought}</h3>
            <strong className="mono">
              {minBalance.length > 0
                ? `${ap.balancePrefix} ${Math.min(...minBalance) > 0 ? "+" : ""}${formatLocaleNumber(Math.min(...minBalance), locale, 1)} mm`
                : "—"}
            </strong>
          </div>

          <div className={`sf-panel sf-alert-kpi ${severityClass(heatWorst)}`}>
            <div className="sf-alert-kpi-top">
              <span className="sf-alert-kpi-icon">
                <Flame size={18} aria-hidden="true" />
              </span>
              <span className={`sf-sev-pill ${severityClass(heatWorst)}`}>
                {ap.severity[heatWorst]}
              </span>
            </div>
            <h3>{ap.hazards.heat}</h3>
            <strong className="mono">
              {maxTmax.length > 0
                ? `Tmax ${formatLocaleNumber(Math.max(...maxTmax), locale, 1)} °C`
                : "—"}
            </strong>
          </div>

          <div className={`sf-panel sf-alert-kpi ${severityClass(rainWorst)}`}>
            <div className="sf-alert-kpi-top">
              <span className="sf-alert-kpi-icon">
                <CloudRain size={18} aria-hidden="true" />
              </span>
              <span className={`sf-sev-pill ${severityClass(rainWorst)}`}>
                {ap.severity[rainWorst]}
              </span>
            </div>
            <h3>{ap.hazards.heavy_rain}</h3>
            <strong className="mono">
              {maxPrecip7d.length > 0
                ? `${formatLocaleNumber(Math.max(...maxPrecip7d), locale, 1)} mm / 7d`
                : "—"}
            </strong>
          </div>
        </div>

        {/* Main 2-Column Split: Parcels Status + SMS/Email Integration Settings */}
        <div className="sf-alerts-main-grid">
          <section className="sf-panel">
            <div className="sf-alerts-section-head">
              <div>
                <h2>{ap.parcelSectionTitle}</h2>
                <p>{ap.parcelSectionNote}</p>
              </div>
              <Activity size={18} style={{ color: "var(--accent-cyan)" }} aria-hidden="true" />
            </div>

            {loading && snapshots.length === 0 ? (
              <p style={{ color: "var(--text-muted)", marginTop: 14 }}>{ap.scanningBtn}</p>
            ) : (
              <div className="sf-parcel-risk-list">
                {snapshots.map((snap) => (
                  <article
                    key={snap.parcel_id}
                    className={`sf-parcel-risk-card ${severityClass(snap.overall_severity)}`}
                  >
                    <div className="sf-parcel-risk-head">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong>{snap.parcel_label}</strong>
                          {snap.is_primary && (
                            <span className="sf-badge sf-badge-cyan">{t.badges.primaryPlot}</span>
                          )}
                        </div>
                        <small className="mono">
                          <MapPin size={12} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 4 }} />
                          {snap.latitude.toFixed(4)}°N, {snap.longitude.toFixed(4)}°E
                          {snap.area_ha ? ` · ${snap.area_ha} ha` : ""}
                        </small>
                      </div>

                      <span className={`sf-sev-pill ${severityClass(snap.overall_severity)}`}>
                        {ap.severity[snap.overall_severity]}
                      </span>
                    </div>

                    <p className="sf-parcel-risk-summary">
                      {locale === "az" ? snap.summary_az : snap.summary_en}
                    </p>

                    <div className="sf-hazard-mini-row">
                      <span className={`sf-hazard-tag ${severityClass(snap.frost_risk)}`}>
                        <Snowflake size={12} aria-hidden="true" />
                        <span>{ap.hazards.frost}: {ap.severity[snap.frost_risk]}</span>
                      </span>
                      <span className={`sf-hazard-tag ${severityClass(snap.drought_risk)}`}>
                        <Sprout size={12} aria-hidden="true" />
                        <span>{ap.hazards.drought}: {ap.severity[snap.drought_risk]}</span>
                      </span>
                      <span className={`sf-hazard-tag ${severityClass(snap.heat_risk)}`}>
                        <Flame size={12} aria-hidden="true" />
                        <span>{ap.hazards.heat}: {ap.severity[snap.heat_risk]}</span>
                      </span>
                      <span className={`sf-hazard-tag ${severityClass(snap.rain_risk)}`}>
                        <CloudRain size={12} aria-hidden="true" />
                        <span>{ap.hazards.heavy_rain}: {ap.severity[snap.rain_risk]}</span>
                      </span>
                    </div>

                    {snap.daily_forecast && snap.daily_forecast.length > 0 && (
                      <div className="sf-daily-strip" aria-label="7-day coordinate forecast">
                        {snap.daily_forecast.map((d) => (
                          <div key={d.date} className="sf-daily-cell">
                            <span className="mono">{d.date.slice(5)}</span>
                            <strong className="mono">
                              {d.tmin_c !== null ? `${Math.round(d.tmin_c)}°` : "—"} /{" "}
                              {d.tmax_c !== null ? `${Math.round(d.tmax_c)}°` : "—"}
                            </strong>
                            <small className="mono">
                              {d.precip_mm !== null ? `${d.precip_mm.toFixed(1)}mm` : "0mm"}
                            </small>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* SMS & Email Notification Rules & Database Routing */}
          <aside className="sf-panel sf-alerts-prefs-card">
            <div className="sf-alerts-section-head">
              <div>
                <h2>{ap.channelsTitle}</h2>
                <p>{ap.channelsSubtitle}</p>
              </div>
              <BellRing size={18} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
            </div>

            <div className="sf-contact-status-list">
              <div className="sf-contact-box">
                <Smartphone size={16} aria-hidden="true" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span>{ap.smsLabel}</span>
                  <strong className="mono">
                    {contacts?.phone_e164 || "—"}
                  </strong>
                  <small>
                    {contacts?.sms_configured ? ap.providerReady : ap.providerOutbox}
                  </small>
                </div>
              </div>

              {!contacts?.phone_e164 && (
                <div className="sf-banner sf-banner-warning" style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 12.5 }}>
                    <p style={{ margin: "0 0 8px" }}>{ap.phoneMissingHint}</p>
                    <button
                      type="button"
                      className="sf-btn sf-btn-sm"
                      onClick={() => navigate("/profile")}
                    >
                      {ap.goProfileBtn}
                    </button>
                  </div>
                </div>
              )}

              <div className="sf-contact-box">
                <Mail size={16} aria-hidden="true" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span>{ap.emailLabel}</span>
                  <strong className="mono" style={{ wordBreak: "break-all" }}>
                    {contacts?.email || "—"}
                  </strong>
                  <small>
                    {contacts?.smtp_configured ? ap.providerReady : ap.providerOutbox}
                  </small>
                </div>
              </div>
            </div>

            <form className="sf-alerts-prefs-form" onSubmit={handleSavePrefs}>
              <label className="sf-switch-row">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                />
                <span>{ap.smsLabel}</span>
              </label>

              <label className="sf-switch-row">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                />
                <span>{ap.emailLabel}</span>
              </label>

              <label className="sf-prof-field">
                <span className="sf-prof-label">{ap.minSeverityLabel}</span>
                <select
                  className="sf-prof-input"
                  value={minSeverity}
                  onChange={(e) =>
                    setMinSeverity(e.target.value as "critical" | "high" | "moderate")
                  }
                >
                  <option value="critical">{ap.severity.critical}</option>
                  <option value="high">{ap.severity.high}</option>
                  <option value="moderate">{ap.severity.moderate}</option>
                </select>
              </label>

              <div className="sf-alerts-thresh-grid">
                <label className="sf-prof-field">
                  <span className="sf-prof-label">{ap.frostThresholdLabel}</span>
                  <input
                    type="number"
                    step="0.5"
                    className="sf-prof-input"
                    value={frostThresh}
                    onChange={(e) => setFrostThresh(e.target.value)}
                  />
                </label>

                <label className="sf-prof-field">
                  <span className="sf-prof-label">{ap.heatThresholdLabel}</span>
                  <input
                    type="number"
                    step="0.5"
                    className="sf-prof-input"
                    value={heatThresh}
                    onChange={(e) => setHeatThresh(e.target.value)}
                  />
                </label>
              </div>

              <button type="submit" className="sf-btn sf-btn-primary" disabled={savingPrefs}>
                <Check size={15} aria-hidden="true" />
                <span>{ap.savePrefsBtn}</span>
              </button>
            </form>
          </aside>
        </div>

        {/* Active Weather Alerts Feed */}
        <section className="sf-panel">
          <div className="sf-alerts-section-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShieldAlert size={19} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
              <h2 style={{ margin: 0 }}>{ap.feedSectionTitle}</h2>
            </div>

            <div className="sf-filter-pills">
              <button
                type="button"
                className={`sf-btn sf-btn-sm ${filterMode === "open" ? "sf-btn-primary" : ""}`}
                onClick={() => setFilterMode("open")}
              >
                {ap.filterActive}
              </button>
              <button
                type="button"
                className={`sf-btn sf-btn-sm ${filterMode === "all" ? "sf-btn-primary" : ""}`}
                onClick={() => setFilterMode("all")}
              >
                {ap.filterAll}
              </button>
            </div>
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="sf-alerts-empty">
              <CheckCircle2 size={28} style={{ color: "var(--status-success)" }} aria-hidden="true" />
              <h3>{ap.emptyAlertsTitle}</h3>
              <p>{ap.emptyAlertsBody}</p>
            </div>
          ) : (
            <div className="sf-alert-feed-list">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`sf-alert-feed-item ${severityClass(alert.severity)}`}
                >
                  <div className="sf-alert-feed-body">
                    <div className="sf-alert-feed-meta">
                      <span className={`sf-sev-pill ${severityClass(alert.severity)}`}>
                        {ap.severity[alert.severity]}
                      </span>
                      <strong>{locale === "az" ? alert.title_az : alert.title_en}</strong>
                      <span className="sf-badge">{alert.parcel_label}</span>
                      <span className="mono sf-alert-metric-badge">{alert.trigger_metric}</span>
                    </div>

                    <p>{locale === "az" ? alert.message_az : alert.message_en}</p>

                    <div className="sf-alert-feed-foot">
                      <span className="mono">{formatLocaleDateTime(alert.created_at, locale)}</span>
                      <span>·</span>
                      <span>
                        {alert.status === "resolved"
                          ? ap.statusResolved
                          : alert.status === "acknowledged"
                            ? ap.statusAcknowledged
                            : ap.statusActive}
                      </span>
                    </div>
                  </div>

                  <div className="sf-alert-feed-actions">
                    {alert.status === "active" && (
                      <button
                        type="button"
                        className="sf-btn sf-btn-sm"
                        onClick={() => void handleAlertAction(alert.id, "acknowledged")}
                      >
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>{ap.acknowledgeBtn}</span>
                      </button>
                    )}
                    {alert.status !== "resolved" && (
                      <button
                        type="button"
                        className="sf-btn sf-btn-sm sf-btn-primary"
                        onClick={() => void handleAlertAction(alert.id, "resolved")}
                      >
                        <Check size={14} aria-hidden="true" />
                        <span>{ap.resolveBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Outbound SMS & Email Audit Log */}
        <section className="sf-panel">
          <div className="sf-alerts-section-head">
            <h2 style={{ margin: 0 }}>{ap.dispatchLogTitle}</h2>
          </div>

          {dispatches.length === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: "12px 0 0" }}>{ap.dispatchEmpty}</p>
          ) : (
            <div className="sf-dispatch-table-wrap">
              <table className="sf-dispatch-table">
                <thead>
                  <tr>
                    <th>{ap.colChannel}</th>
                    <th>{ap.colRecipient}</th>
                    <th>{ap.colProvider}</th>
                    <th>{ap.colStatus}</th>
                    <th>{ap.colTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((dsp) => (
                    <tr key={dsp.id}>
                      <td>
                        <span className="sf-badge">
                          {dsp.channel === "sms" ? (
                            <Smartphone size={12} aria-hidden="true" />
                          ) : (
                            <Mail size={12} aria-hidden="true" />
                          )}
                          <span>{dsp.channel.toUpperCase()}</span>
                        </span>
                      </td>
                      <td className="mono">{dsp.recipient}</td>
                      <td className="mono">{dsp.provider}</td>
                      <td>
                        <span
                          className={`sf-badge ${
                            dsp.status === "sent"
                              ? "sf-badge-cyan"
                              : dsp.status === "failed"
                                ? "sf-sev-critical"
                                : ""
                          }`}
                          title={dsp.error_detail || undefined}
                        >
                          {dsp.status}
                        </span>
                      </td>
                      <td className="mono">{formatLocaleDateTime(dsp.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
