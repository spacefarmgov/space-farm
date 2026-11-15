import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Cloud, Minus, Plus, RotateCcw } from "lucide-react";
import { useSpaceFarm } from "../../context/SpaceFarmContext";
import { mountEarth, type EarthDrawState, type EarthEngineHandle } from "./earthEngine";

const INITIAL_LATITUDE = 24;
const INITIAL_LONGITUDE = 46;
const INITIAL_ZOOM = 1.04;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.6;

/**
 * Interactive Three.js 3D Earth (with automatic Canvas 2D spherical fallback)
 * mounted on the right showcase side of the SpaceFarm hero section.
 * Rotation runs infinitely without play/pause interruptions.
 */
export function HeroEarth3D() {
  const { t } = useSpaceFarm();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const planetRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EarthEngineHandle | null>(null);

  const reducedMotionRef = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  const stateRef = useRef<EarthDrawState>({
    latitude: INITIAL_LATITUDE,
    longitude: INITIAL_LONGITUDE,
    zoom: INITIAL_ZOOM,
    rotate: !reducedMotionRef.current,
    clouds: true,
    cloudOffset: 0,
  });

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pinchDistRef = useRef<number>(0);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rendererKind, setRendererKind] = useState<"webgl" | "canvas" | "">("");
  const [cloudsVisible, setCloudsVisible] = useState(true);
  const [zoomPct, setZoomPct] = useState(Math.round(INITIAL_ZOOM * 100));

  function syncUiAndDraw() {
    const cur = stateRef.current;
    setCloudsVisible(cur.clouds);
    setZoomPct(Math.round(cur.zoom * 100));
    engineRef.current?.draw(cur);
  }

  function applyZoom(delta: number) {
    stateRef.current.zoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Number((stateRef.current.zoom + delta).toFixed(2))),
    );
    syncUiAndDraw();
  }

  function handleReset() {
    stateRef.current = {
      latitude: INITIAL_LATITUDE,
      longitude: INITIAL_LONGITUDE,
      zoom: INITIAL_ZOOM,
      rotate: !reducedMotionRef.current,
      clouds: true,
      cloudOffset: 0,
    };
    syncUiAndDraw();
  }

  function handleToggleClouds() {
    stateRef.current.clouds = !stateRef.current.clouds;
    syncUiAndDraw();
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    const el = planetRef.current;
    if (!el) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic event environments without active pointer capture
    }
    lastPointRef.current = { x: e.clientX, y: e.clientY };

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      applyZoom((dist - pinchDistRef.current) * 0.003);
      pinchDistRef.current = dist;
    } else if (lastPointRef.current) {
      const dx = e.clientX - lastPointRef.current.x;
      const dy = e.clientY - lastPointRef.current.y;
      stateRef.current.longitude -= (dx * 0.24) / stateRef.current.zoom;
      stateRef.current.latitude = Math.max(
        -85,
        Math.min(85, stateRef.current.latitude + (dy * 0.24) / stateRef.current.zoom),
      );
      engineRef.current?.draw(stateRef.current);
    }

    lastPointRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerEnd(e: PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size > 0) {
      lastPointRef.current = Array.from(pointersRef.current.values())[0];
    } else {
      lastPointRef.current = null;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keyMap: Record<string, [number, number]> = {
      ArrowLeft: [0, -5],
      ArrowRight: [0, 5],
      ArrowUp: [5, 0],
      ArrowDown: [-5, 0],
    };
    const delta = keyMap[e.key];
    if (delta) {
      e.preventDefault();
      stateRef.current.latitude = Math.max(
        -85,
        Math.min(85, stateRef.current.latitude + delta[0]),
      );
      stateRef.current.longitude += delta[1];
      syncUiAndDraw();
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      applyZoom(0.1);
    } else if (e.key === "-") {
      e.preventDefault();
      applyZoom(-0.1);
    }
  }

  useEffect(() => {
    const container = planetRef.current;
    const stageEl = stageRef.current;
    if (!container || !stageEl) return;

    let cancelled = false;
    let rafId = 0;
    let lastTime = performance.now();
    let inViewport = true;
    let tabVisible = !document.hidden;

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        inViewport = entries[0]?.isIntersecting ?? true;
        lastTime = performance.now();
      },
      { threshold: 0.05 },
    );
    visibilityObserver.observe(stageEl);

    const handleVisibilityChange = () => {
      tabVisible = !document.hidden;
      lastTime = performance.now();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (cancelled || !tabVisible || !inViewport) return;

      const engine = engineRef.current;
      if (!engine) return;

      const minStepMs = engine.software ? 85 : 16;
      if (now - lastTime < minStepMs) return;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const cur = stateRef.current;
      if (cur.rotate && pointersRef.current.size === 0) {
        cur.longitude += dt * 3.0;
        cur.cloudOffset += dt * 0.85;
        engine.draw(cur);
      }
    };

    mountEarth(container)
      .then((engine) => {
        if (cancelled) {
          engine.dispose();
          return;
        }
        engineRef.current = engine;
        setRendererKind(engine.software ? "canvas" : "webgl");
        engine.draw(stateRef.current);
        setReady(true);
        rafId = window.requestAnimationFrame(tick);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to initialize SpaceFarm 3D Earth", err);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className="sf-hero-earth-stage"
      data-testid="hero-earth-3d"
      data-renderer={rendererKind || "pending"}
    >
      <div
        ref={planetRef}
        className="sf-hero-earth-planet"
        role="img"
        tabIndex={0}
        aria-label={t.earth3d.ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onKeyDown={handleKeyDown}
      />

      <img
        className="sf-hero-satellite"
        src="/assets/hero-satellite.png"
        alt=""
        width={720}
        height={389}
        decoding="async"
        aria-hidden="true"
      />

      {!ready && !failed && (
        <div className="sf-hero-earth-loading" aria-hidden="true">
          <span className="sf-hero-earth-spinner" />
          <span>{t.earth3d.loading}</span>
        </div>
      )}

      {failed && (
        <div className="sf-hero-earth-loading" role="status">
          <span>{t.earth3d.errorText}</span>
        </div>
      )}

      <div className="sf-hero-earth-hud" aria-label={t.earth3d.liveBadge}>
        <span className="sf-hero-earth-badge">
          <i aria-hidden="true" />
          <span>{t.earth3d.liveBadge}</span>
        </span>

        <div className="sf-hero-earth-controls">
          <button
            type="button"
            onClick={handleToggleClouds}
            aria-pressed={cloudsVisible}
            title={t.earth3d.clouds}
            aria-label={t.earth3d.clouds}
          >
            <Cloud size={13} aria-hidden="true" />
            <span className="sf-hero-earth-btn-label">{t.earth3d.clouds}</span>
          </button>

          <span className="sf-hero-earth-divider" aria-hidden="true" />

          <button
            type="button"
            onClick={() => applyZoom(-0.1)}
            disabled={zoomPct <= Math.round(MIN_ZOOM * 100)}
            title={t.earth3d.zoomOut}
            aria-label={t.earth3d.zoomOut}
          >
            <Minus size={13} aria-hidden="true" />
          </button>

          <output className="sf-hero-earth-zoom" aria-live="off">
            {zoomPct}%
          </output>

          <button
            type="button"
            onClick={() => applyZoom(0.1)}
            disabled={zoomPct >= Math.round(MAX_ZOOM * 100)}
            title={t.earth3d.zoomIn}
            aria-label={t.earth3d.zoomIn}
          >
            <Plus size={13} aria-hidden="true" />
          </button>

          <span className="sf-hero-earth-divider" aria-hidden="true" />

          <button
            type="button"
            onClick={handleReset}
            title={t.earth3d.reset}
            aria-label={t.earth3d.reset}
          >
            <RotateCcw size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
