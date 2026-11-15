import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSpaceFarm } from "../../context/SpaceFarmContext";
import "../../styles/loader.css";

export type SpaceFarmLoaderVariant = "boot" | "route" | "inline";

interface SpaceFarmLoaderProps {
  variant?: SpaceFarmLoaderVariant;
  statusText?: string;
  progress?: number;
  exiting?: boolean;
  height?: number;
}

/**
 * Multi-axis SpaceFarm orbital telemetry dial with concentric azimuth ticks,
 * inclined elliptical satellite trajectory, counter-rotating arcs, HUD corner
 * brackets, and an active LIDAR/NDVI laser scan across the SpaceFarm core.
 */
export function SpaceFarmOrbitalDial({ compact = false }: { compact?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const gradVioletId = `sf-grad-violet-${uid}`;
  const gradCyanId = `sf-grad-cyan-${uid}`;
  const orbitShadowId = `sf-sat-glow-${uid}`;

  return (
    <div className={`sf-loader-hud ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <div className="sf-loader-hud-glow" />
      <span className="sf-hud-bracket tl" />
      <span className="sf-hud-bracket tr" />
      <span className="sf-hud-bracket bl" />
      <span className="sf-hud-bracket br" />

      <svg className="sf-orbital-svg" viewBox="0 0 220 220" fill="none">
        <defs>
          <linearGradient id={gradVioletId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id={gradCyanId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
          </linearGradient>
          <filter id={orbitShadowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Azimuth Degree Dial */}
        <g className="sf-ring-azimuth">
          <circle
            cx="110"
            cy="110"
            r="98"
            stroke="rgba(167, 139, 250, 0.24)"
            strokeWidth="1.2"
            strokeDasharray="2 7"
          />
          <circle cx="110" cy="12" r="2.2" fill="#a78bfa" />
          <circle cx="208" cy="110" r="2.2" fill="#22d3ee" />
          <circle cx="110" cy="208" r="1.8" fill="rgba(167, 139, 250, 0.5)" />
          <circle cx="12" cy="110" r="1.8" fill="rgba(34, 211, 238, 0.5)" />
        </g>

        {/* Static Tilted Orbital Plane Track */}
        <ellipse
          cx="110"
          cy="110"
          rx="84"
          ry="44"
          transform="rotate(-24 110 110)"
          stroke="rgba(167, 139, 250, 0.18)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Active Orbiting Satellite Node + Counter-Node */}
        <g className="sf-ring-orbit-group">
          <circle
            cx="110"
            cy="110"
            r="84"
            stroke={`url(#${gradCyanId})`}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="88 440"
          />
          <circle
            cx="110"
            cy="26"
            r="4.2"
            fill="#67e8f9"
            filter={`url(#${orbitShadowId})`}
          />
          <circle cx="110" cy="26" r="1.8" fill="#ffffff" />
        </g>

        {/* Counter-Rotating Violet Telemetry Arc */}
        <g className="sf-ring-counter">
          <circle
            cx="110"
            cy="110"
            r="68"
            stroke={`url(#${gradVioletId})`}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="110 320"
          />
          <circle
            cx="110"
            cy="110"
            r="68"
            stroke="rgba(34, 211, 238, 0.45)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="34 396"
            strokeDashoffset="-190"
          />
        </g>

        {/* Radar Lock Ping */}
        <circle
          className="sf-ring-radar-pulse"
          cx="110"
          cy="110"
          r="54"
          stroke="rgba(167, 139, 250, 0.36)"
          strokeWidth="1.2"
        />
      </svg>

      {/* Core Emblem & Active NDVI Scan Beam */}
      <div className="sf-loader-core">
        <img src="/assets/spacefarm-mark.svg" alt="" width={46} height={46} />
        <div className="sf-loader-scan-beam" />
      </div>
    </div>
  );
}

/**
 * Reusable SpaceFarm Loader supporting cold-boot splash, lazy route fallback,
 * and inline section telemetry loading states.
 */
export function SpaceFarmLoader({
  variant = "route",
  statusText,
  progress,
  exiting = false,
  height = 200,
}: SpaceFarmLoaderProps) {
  const { t, draft } = useSpaceFarm();
  const activeStatus =
    statusText ??
    (variant === "inline" ? t.loader.fieldSync : t.loader.routeLoading);

  const coordReadout = `${draft.latitude.toFixed(2)}°N · ${draft.longitude.toFixed(2)}°E`;

  if (variant === "inline") {
    return (
      <div
        className="sf-inline-loader-card"
        style={{ minHeight: height }}
        role="status"
        aria-live="polite"
        aria-label={activeStatus}
      >
        <div className="sf-inline-loader-row">
          <svg className="sf-inline-ring" viewBox="0 0 44 44" fill="none" aria-hidden="true">
            <circle
              cx="22"
              cy="22"
              r="18"
              stroke="rgba(167, 139, 250, 0.25)"
              strokeWidth="2"
              strokeDasharray="3 4"
            />
            <g className="sf-ring-orbit-group" style={{ transformOrigin: "22px 22px" }}>
              <circle
                cx="22"
                cy="22"
                r="18"
                stroke="#8b5cf6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="34 86"
              />
              <circle cx="22" cy="4" r="2.6" fill="#22d3ee" />
            </g>
            <g className="sf-ring-counter" style={{ transformOrigin: "22px 22px" }}>
              <circle
                cx="22"
                cy="22"
                r="11"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="18 54"
              />
            </g>
          </svg>
          <div className="sf-inline-loader-text">
            <strong>{t.brand} · {t.loader.badge}</strong>
            <span>{activeStatus}</span>
          </div>
        </div>
      </div>
    );
  }

  const isBoot = variant === "boot";
  const pct = typeof progress === "number" ? Math.min(100, Math.max(0, Math.round(progress))) : null;

  return (
    <div
      className={isBoot ? `sf-loader-overlay ${exiting ? "is-exiting" : ""}` : "sf-loader-route-shell"}
      role="status"
      aria-live="polite"
      aria-label={activeStatus}
      data-testid={isBoot ? "spacefarm-boot-loader" : "spacefarm-route-loader"}
    >
      <div className="sf-loader-grid" aria-hidden="true" />
      <div className="sf-loader-stars" aria-hidden="true" />

      <div className="sf-loader-stage">
        <SpaceFarmOrbitalDial compact={!isBoot} />

        <div className="sf-loader-pill">
          <span className="sf-loader-pill-dot" aria-hidden="true" />
          <span>{t.loader.badge}</span>
        </div>

        <h2 className="sf-loader-brand">
          Space<span>Farm</span>
        </h2>

        <p className="sf-loader-status-line">{activeStatus}</p>

        <div className="sf-loader-progress-wrap">
          <div className="sf-loader-track" aria-hidden="true">
            <div
              className={`sf-loader-fill ${pct === null ? "is-indeterminate" : ""}`}
              style={pct !== null ? { width: `${pct}%` } : undefined}
            />
          </div>
          <div className="sf-loader-meta">
            <span>{coordReadout}</span>
            <span>{pct !== null ? `${pct}%` : "SYNC"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen orbital telemetry curtain displayed briefly on cold page load /
 * browser reload and dismissed smoothly once the interface is ready.
 */
export function SpaceFarmBootCurtain() {
  const { t } = useSpaceFarm();
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const activeDuration = prefersReduced ? 320 : 1300;
    const holdAtFull = prefersReduced ? 80 : 180;
    const fadeDuration = 380;

    let rafId = 0;
    let holdTimer: number | undefined;
    let unmountTimer: number | undefined;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / activeDuration);
      // Smooth ease-out cubic fill from 6% to 100%
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(6 + Math.round(eased * 94));

      if (ratio < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        holdTimer = window.setTimeout(() => {
          setExiting(true);
          unmountTimer = window.setTimeout(() => {
            setVisible(false);
          }, fadeDuration);
        }, holdAtFull);
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      if (holdTimer) window.clearTimeout(holdTimer);
      if (unmountTimer) window.clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) return null;

  const statusText =
    progress < 42
      ? t.loader.orbitalLink
      : progress < 92
        ? t.loader.syncingEO
        : t.loader.telemetryReady;

  return (
    <SpaceFarmLoader
      variant="boot"
      progress={progress}
      statusText={statusText}
      exiting={exiting}
    />
  );
}

/**
 * Lightweight 2.5px photon laser bar at top of viewport on client-side route navigation.
 */
export function SpaceFarmRouteBar() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);
  const [sweepKey, setSweepKey] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setActive(true);
    setSweepKey((prev) => prev + 1);
    const timer = window.setTimeout(() => {
      setActive(false);
    }, 460);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!active) return null;

  return (
    <div key={sweepKey} className="sf-route-laser" aria-hidden="true">
      <div className="sf-route-laser-beam" />
    </div>
  );
}
