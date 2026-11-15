import { useState } from "react";
import { SpaceFarmLoader } from "./SpaceFarmLoader";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Flower2,
  Leaf,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sprout,
  Sun,
  Wheat,
} from "lucide-react";
import type { DataMode, SimulationStatus } from "../../api/types";
import type { ApiUiError } from "../../context/SpaceFarmContext";
import {
  getModeLabel,
  getSimulationStatusLabel,
  type TranslationDictionary,
} from "../../locales/translations";

export function DataModeBadge({
  mode,
  synthetic,
  t,
}: {
  mode: DataMode;
  synthetic: boolean;
  t: TranslationDictionary;
}) {
  const label = getModeLabel(mode, synthetic, t);
  let cls = "sf-badge sf-badge-violet";
  if (mode === "cached") cls = "sf-badge sf-badge-cyan";
  else if (mode === "live") cls = "sf-badge sf-badge-live";

  return (
    <span className={cls}>
      <Database size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

export function SimulationStatusBadge({
  status,
  t,
}: {
  status: SimulationStatus;
  t: TranslationDictionary;
}) {
  const label = getSimulationStatusLabel(status, t);
  let cls = "sf-badge sf-badge-violet";
  if (status === "completed") cls = "sf-badge sf-badge-success";
  else if (status === "provisional" || status === "needs_data") cls = "sf-badge sf-badge-warning";
  else if (status === "no_feasible_plan") cls = "sf-badge sf-badge-error";

  return <span className={cls}>{label}</span>;
}

export function ErrorPanel({
  error,
  t,
  onRetry,
}: {
  error: ApiUiError;
  t: TranslationDictionary;
  onRetry?: () => void;
}) {
  const title =
    error.kind === "unavailable_503"
      ? t.errors.serviceUnavailableTitle
      : error.kind === "validation"
        ? t.errors.validationTitle
        : error.kind === "network"
          ? t.errors.apiUnreachableTitle
          : t.errors.unexpectedTitle;

  return (
    <div
      className="sf-banner sf-banner-error"
      role="alert"
      aria-live="assertive"
      style={{ alignItems: "center" }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: "1 1 280px" }}>
        <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div>
          <strong style={{ display: "block" }}>{title}</strong>
          <span style={{ fontSize: 13, opacity: 0.94 }}>{error.message}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {error.retryable && onRetry && (
          <button type="button" className="sf-btn sf-btn-sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            {t.actions.retry}
          </button>
        )}
      </div>
    </div>
  );
}

export function StaleBanner({
  t,
  onRecalculate,
  loading,
}: {
  t: TranslationDictionary;
  onRecalculate?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="sf-banner sf-banner-warning" role="status" aria-live="polite">
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: "1 1 260px" }}>
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div>
          <strong style={{ display: "block" }}>{t.staleBanner.title}</strong>
          <span style={{ fontSize: 13 }}>{t.staleBanner.detail}</span>
        </div>
      </div>
      {onRecalculate && (
        <button
          type="button"
          className="sf-btn sf-btn-sm sf-btn-primary"
          onClick={onRecalculate}
          disabled={loading}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t.actions.recalculate}
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ height = 160 }: { height?: number }) {
  if (height >= 180) {
    return <SpaceFarmLoader variant="inline" height={height} />;
  }
  return <div className="sf-skeleton" style={{ height, width: "100%" }} aria-busy="true" />;
}

export function CropIcon({ cropId, size = 16 }: { cropId: string; size?: number }) {
  const id = cropId.toLowerCase();
  if (id === "wheat" || id === "barley") {
    return <Wheat size={size} aria-hidden="true" style={{ color: "var(--accent-soft)" }} />;
  }
  if (id === "chickpea" || id === "lentil" || id === "alfalfa") {
    return <Sprout size={size} aria-hidden="true" style={{ color: "var(--accent-cyan)" }} />;
  }
  if (id === "sunflower") {
    return <Sun size={size} aria-hidden="true" style={{ color: "var(--accent-soft)" }} />;
  }
  if (id === "corn" || id === "maize") {
    return <Leaf size={size} aria-hidden="true" style={{ color: "var(--accent-soft)" }} />;
  }
  if (id === "cotton") {
    return <Flower2 size={size} aria-hidden="true" style={{ color: "var(--accent-soft)" }} />;
  }
  return <Sparkles size={size} aria-hidden="true" style={{ color: "var(--accent-soft)" }} />;
}

export function CopyableValue({
  value,
  shortDisplay,
  copyLabel,
  copiedLabel,
  onCopySuccess,
  onCopyError,
}: {
  value: string;
  shortDisplay?: string;
  copyLabel: string;
  copiedLabel: string;
  onCopySuccess?: (msg: string) => void;
  onCopyError?: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!navigator.clipboard) {
      onCopyError?.("Clipboard API unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopySuccess?.(copiedLabel);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onCopyError?.("Copy permission blocked");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxWidth: "100%" }}>
      <code
        className="mono sf-wrap-anywhere"
        style={{
          fontSize: 12.5,
          background: "var(--bg-deep)",
          padding: "3px 8px",
          borderRadius: 6,
          border: "1px solid var(--border-default)",
        }}
        title={value}
      >
        {shortDisplay ?? value}
      </code>
      <button type="button" className="sf-btn sf-btn-sm" onClick={handleCopy} style={{ minHeight: 30 }}>
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        <span>{copied ? copiedLabel : copyLabel}</span>
      </button>
    </span>
  );
}
