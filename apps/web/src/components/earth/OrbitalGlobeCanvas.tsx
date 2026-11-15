import { useEffect, useRef, useState } from "react";
import { Compass, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import {
  VERIFIED_AZ_REGIONS,
  getMerra2CellBounds,
  type VerifiedRegionPreset,
} from "../../data/regions";

export type ExplorerLayer = "satellite" | "climate" | "fields";

interface OrbitalGlobeCanvasProps {
  latitude: number;
  longitude: number;
  activeLayer: ExplorerLayer;
  selectedRegion: VerifiedRegionPreset | null;
  onSelectCoordinates: (lat: number, lon: number) => void;
  onSelectRegion: (regionId: string) => void;
  onResetView: () => void;
  onFocusPrimary: () => void;
  labels: {
    zoomIn: string;
    zoomOut: string;
    resetView: string;
    focusPrimary: string;
    controlsHint: string;
  };
}

/**
 * Simplified real-world coastline polygons [lon, lat] including accurate Caucasus,
 * Anatolia, Iranian plateau, Caspian Sea, Black Sea, Europe, Africa & Asia contours.
 */
const LAND_POLYGONS: Array<Array<[number, number]>> = [
  // Eurasia + Caucasus + Mediterranean + India + SE Asia simplified real coastline
  [
    [-9.5, 37.0], [-9.0, 43.0], [-2.0, 43.5], [1.5, 49.0], [8.5, 54.0],
    [5.0, 61.0], [18.0, 69.5], [32.0, 69.5], [60.0, 70.0], [95.0, 76.0],
    [135.0, 71.0], [170.0, 66.0], [160.0, 56.0], [142.0, 53.0], [135.0, 44.0],
    [128.0, 35.5], [122.0, 39.0], [121.0, 31.0], [114.0, 22.0], [108.0, 16.0],
    [104.0, 2.0], [98.0, 10.0], [91.0, 22.0], [80.0, 13.0], [77.5, 8.0],
    [72.0, 20.0], [67.0, 24.5], [57.0, 25.5], [56.0, 27.0], [49.0, 29.8],
    [51.0, 25.0], [59.5, 22.5], [53.0, 16.5], [44.0, 12.6], [35.0, 28.0],
    [34.5, 31.5], [36.0, 36.8], [27.0, 36.8], [26.2, 40.5], [29.0, 41.2],
    [27.8, 43.0], [31.0, 46.2], [36.5, 45.2], [40.0, 43.4], [41.6, 41.6],
    [35.0, 42.0], [26.0, 40.0], [22.5, 38.0], [16.0, 38.0], [12.5, 44.0],
    [5.0, 43.3], [-5.5, 36.0], [-9.5, 37.0],
  ],
  // Africa
  [
    [-17.5, 15.0], [-6.0, 35.8], [10.5, 37.0], [25.0, 31.5], [32.6, 31.2],
    [43.0, 12.0], [51.2, 11.8], [41.0, -2.0], [40.0, -14.0], [28.0, -33.0],
    [18.4, -34.4], [12.0, -16.0], [9.5, 4.0], [-8.0, 4.5], [-17.5, 15.0],
  ],
  // Caspian Sea water cutout polygon
  // Rendered separately as deep navy basin on globe
];

const INLAND_SEAS: Array<Array<[number, number]>> = [
  // Caspian Sea accurate contour (Azerbaijan coast on the west ~48.5–50.5E)
  [
    [47.0, 45.6], [49.2, 46.6], [53.2, 45.2], [53.0, 42.2], [54.0, 39.8],
    [53.8, 36.9], [49.2, 37.4], [48.8, 38.8], [49.5, 40.0], [50.5, 40.4],
    [48.5, 42.0], [47.5, 43.8], [47.0, 45.6],
  ],
  // Black Sea contour (southwestern boundary of Caucasus)
  [
    [27.8, 42.0], [28.8, 45.2], [33.5, 45.8], [37.8, 45.0], [41.6, 41.6],
    [36.5, 41.3], [31.5, 41.3], [27.8, 42.0],
  ],
];

// Subtle regional highlight ring around Caucasus / Azerbaijan for geographical orientation
const CAUCASUS_HIGHLIGHT: Array<[number, number]> = [
  [44.7, 39.7],
  [45.0, 41.2],
  [46.4, 41.8],
  [48.6, 41.8],
  [50.4, 40.4],
  [49.4, 39.3],
  [48.8, 38.4],
  [46.5, 38.9],
  [44.7, 39.7],
];

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function projectOrtho(
  lon: number,
  lat: number,
  centerLon: number,
  centerLat: number,
  radius: number,
  cx: number,
  cy: number,
) {
  const lambda = lon * DEG2RAD;
  const phi = lat * DEG2RAD;
  const lambda0 = centerLon * DEG2RAD;
  const phi0 = centerLat * DEG2RAD;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);
  const dLambda = lambda - lambda0;

  const cosC = sinPhi0 * sinPhi + cosPhi0 * cosPhi * Math.cos(dLambda);
  const x = cx + radius * cosPhi * Math.sin(dLambda);
  const y = cy - radius * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * Math.cos(dLambda));

  return { x, y, visible: cosC >= 0, cosC };
}

function screenToLatLon(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
  centerLon: number,
  centerLat: number,
): { lat: number; lon: number } | null {
  const x = (px - cx) / radius;
  const y = (cy - py) / radius;
  const rho = Math.hypot(x, y);
  if (rho > 1) return null;

  const phi0 = centerLat * DEG2RAD;
  const lambda0 = centerLon * DEG2RAD;
  if (rho < 1e-6) {
    return { lat: Number(centerLat.toFixed(4)), lon: Number(centerLon.toFixed(4)) };
  }

  const c = Math.asin(Math.min(1, rho));
  const cosC = Math.cos(c);
  const sinC = Math.sin(c);

  const phi = Math.asin(cosC * Math.sin(phi0) + (y * sinC * Math.cos(phi0)) / rho);
  const lambda =
    lambda0 +
    Math.atan2(
      x * sinC,
      rho * Math.cos(phi0) * cosC - y * Math.sin(phi0) * sinC,
    );

  let lonDeg = (lambda * RAD2DEG) % 360;
  if (lonDeg > 180) lonDeg -= 360;
  if (lonDeg < -180) lonDeg += 360;

  return {
    lat: Number((phi * RAD2DEG).toFixed(4)),
    lon: Number(lonDeg.toFixed(4)),
  };
}

export function OrbitalGlobeCanvas({
  latitude,
  longitude,
  activeLayer,
  selectedRegion,
  onSelectCoordinates,
  onSelectRegion,
  onResetView,
  onFocusPrimary,
  labels,
}: OrbitalGlobeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [viewCenter, setViewCenter] = useState({ lat: latitude, lon: longitude });
  const [zoom, setZoom] = useState(1.82);
  const [hoverInfo, setHoverInfo] = useState<{ lat: number; lon: number } | null>(null);

  const dragRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startLon: number;
    startLat: number;
  }>({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    startLon: longitude,
    startLat: latitude,
  });

  const animTargetRef = useRef<{ lat: number; lon: number; zoom: number } | null>(null);
  const isVisibleRef = useRef(true);
  const currentViewRef = useRef({ lat: latitude, lon: longitude, zoom: 1.82 });
  currentViewRef.current = { lat: viewCenter.lat, lon: viewCenter.lon, zoom };

  // Smooth camera transition when selected lat/lon updates externally
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setViewCenter({ lat: latitude, lon: longitude });
      return;
    }
    animTargetRef.current = { lat: latitude, lon: longitude, zoom: currentViewRef.current.zoom };
  }, [latitude, longitude]);

  // Intersection & visibility observer to avoid burning CPU when offscreen
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries) => {
      isVisibleRef.current = Boolean(entries[0]?.isIntersecting);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Camera animation + render loop
  useEffect(() => {
    let rafId = 0;

    const renderFrame = () => {
      const canvas = canvasRef.current;
      const box = containerRef.current;
      if (canvas && box && isVisibleRef.current && !document.hidden) {
        const rect = box.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(320, Math.floor(rect.width));
        const h = Math.max(360, Math.floor(rect.height));

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }

        // Smooth camera interpolation toward target
        const tgt = animTargetRef.current;
        if (tgt && !dragRef.current.dragging) {
          const dLat = tgt.lat - currentViewRef.current.lat;
          const dLon = tgt.lon - currentViewRef.current.lon;
          const dZ = tgt.zoom - currentViewRef.current.zoom;
          if (Math.hypot(dLat, dLon, dZ) < 0.05) {
            animTargetRef.current = null;
          } else {
            setViewCenter((prev) => ({
              lat: prev.lat + dLat * 0.16,
              lon: prev.lon + dLon * 0.16,
            }));
            if (Math.abs(dZ) > 0.02) {
              setZoom((z) => z + dZ * 0.16);
            }
          }
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          drawGlobe(ctx, w, h, currentViewRef.current.lon, currentViewRef.current.lat, currentViewRef.current.zoom);
          ctx.restore();
        }
      }
      rafId = window.requestAnimationFrame(renderFrame);
    };

    const drawGlobe = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      cLon: number,
      cLat: number,
      zFactor: number,
    ) => {
      ctx.clearRect(0, 0, w, h);

      // Tasteful sparse cosmos starfield (deterministic PRNG positions, calm luminance)
      for (let s = 0; s < 42; s++) {
        const sx = ((s * 197 + 31) % 997) / 997 * w;
        const sy = ((s * 313 + 73) % 991) / 991 * h;
        const sr = s % 5 === 0 ? 1.5 : 0.9;
        ctx.fillStyle = s % 3 === 0 ? "rgba(196, 181, 253, 0.35)" : "rgba(246, 245, 251, 0.24)";
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      const baseR = Math.min(w, h) * 0.37;
      const radius = baseR * zFactor;
      const cx = w * 0.52;
      const cy = h * 0.5;

      // Subtle atmospheric violet halo behind Earth limb
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.78, cx, cy, radius * 1.18);
      halo.addColorStop(0, "rgba(139, 92, 246, 0.24)");
      halo.addColorStop(0.55, "rgba(103, 232, 249, 0.08)");
      halo.addColorStop(1, "rgba(5, 5, 11, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
      ctx.fill();

      // Earth ocean sphere gradient
      const oceanGrad = ctx.createRadialGradient(
        cx - radius * 0.28,
        cy - radius * 0.28,
        radius * 0.08,
        cx,
        cy,
        radius,
      );
      oceanGrad.addColorStop(0, "#1c2544");
      oceanGrad.addColorStop(0.55, "#0d1328");
      oceanGrad.addColorStop(1, "#060814");

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = oceanGrad;
      ctx.fill();
      ctx.clip();

      // Graticule grid (every 15°)
      ctx.strokeStyle = "rgba(167, 139, 250, 0.14)";
      ctx.lineWidth = 0.85;
      for (let lat = -75; lat <= 75; lat += 15) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = projectOrtho(lon, lat, cLon, cLat, radius, cx, cy);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      for (let lon = -180; lon < 180; lon += 15) {
        ctx.beginPath();
        let started = false;
        for (let lat = -85; lat <= 85; lat += 4) {
          const p = projectOrtho(lon, lat, cLon, cLat, radius, cx, cy);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // Draw continental landmass polygons
      for (const poly of LAND_POLYGONS) {
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < poly.length; i++) {
          const [lon, lat] = poly[i];
          const p = projectOrtho(lon, lat, cLon, cLat, radius, cx, cy);
          if (!any) {
            ctx.moveTo(p.x, p.y);
            any = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.closePath();
        ctx.fillStyle =
          activeLayer === "satellite"
            ? "rgba(44, 58, 78, 0.72)"
            : "rgba(32, 34, 62, 0.78)";
        ctx.fill();
        ctx.strokeStyle = "rgba(196, 181, 253, 0.34)";
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      // Draw inland seas (Caspian Sea & Black Sea) over Eurasia
      for (const sea of INLAND_SEAS) {
        ctx.beginPath();
        let visibleCount = 0;
        sea.forEach(([lon, lat], idx) => {
          const p = projectOrtho(lon, lat, cLon, cLat, radius, cx, cy);
          if (p.visible) visibleCount++;
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        if (visibleCount > 1) {
          ctx.closePath();
          ctx.fillStyle = "#0a1428";
          ctx.fill();
          ctx.strokeStyle = "rgba(103, 232, 249, 0.32)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Caucasus regional silhouette highlight
      ctx.beginPath();
      let cVis = 0;
      CAUCASUS_HIGHLIGHT.forEach(([lon, lat], idx) => {
        const p = projectOrtho(lon, lat, cLon, cLat, radius, cx, cy);
        if (p.visible) cVis++;
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (cVis > 2) {
        ctx.closePath();
        ctx.fillStyle = "rgba(139, 92, 246, 0.22)";
        ctx.fill();
        ctx.strokeStyle = "rgba(196, 181, 253, 0.78)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // MERRA-2 0.5° × 0.625° Grid Cell for active coordinates
      const cell = getMerra2CellBounds(latitude, longitude);
      const cellPts: Array<[number, number]> = [
        [cell.west, cell.south],
        [cell.east, cell.south],
        [cell.east, cell.north],
        [cell.west, cell.north],
      ];
      ctx.beginPath();
      let cellVis = false;
      cellPts.forEach(([lon, lat], idx) => {
        const p = projectOrtho(lon, lat, cLon, cLat, radius, cx, cy);
        if (p.visible) cellVis = true;
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (cellVis) {
        ctx.closePath();
        ctx.fillStyle = "rgba(103, 232, 249, 0.14)";
        ctx.fill();
        ctx.strokeStyle = "rgba(103, 232, 249, 0.85)";
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Mapped parcel outline for primary Ganja–Dashkasan plot when layer === 'fields'
      if (activeLayer === "fields" && selectedRegion?.illustrativePolygon) {
        ctx.beginPath();
        selectedRegion.illustrativePolygon.forEach(([lat, lon], idx) => {
          const p = projectOrtho(lon, lat, cLon, cLat, radius, cx, cy);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(167, 139, 250, 0.35)";
        ctx.fill();
        ctx.strokeStyle = "#f6f5fb";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Verified 4 Azerbaijan snapshot markers
      for (const reg of VERIFIED_AZ_REGIONS) {
        const p = projectOrtho(reg.longitude, reg.latitude, cLon, cLat, radius, cx, cy);
        if (!p.visible) continue;
        const isActive =
          Math.abs(reg.latitude - latitude) < 0.03 &&
          Math.abs(reg.longitude - longitude) < 0.03;

        ctx.beginPath();
        ctx.arc(p.x, p.y, isActive ? 11 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isActive
          ? "rgba(139, 92, 246, 0.34)"
          : "rgba(103, 232, 249, 0.18)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, isActive ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = reg.hasBoundary ? "#a78bfa" : "#67e8f9";
        ctx.fill();
        ctx.strokeStyle = "#f6f5fb";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw crisp dark pill label ONLY for the active marker so labels never overlap
        if (isActive) {
          ctx.font = "600 12px Inter, sans-serif";
          const txt = reg.nameEn;
          const tw = ctx.measureText(txt).width;
          const bx = p.x + 12;
          const by = p.y - 11;
          ctx.fillStyle = "rgba(10, 10, 22, 0.88)";
          ctx.fillRect(bx - 4, by - 2, tw + 12, 22);
          ctx.strokeStyle = "rgba(167, 139, 250, 0.7)";
          ctx.lineWidth = 1;
          ctx.strokeRect(bx - 4, by - 2, tw + 12, 22);
          ctx.fillStyle = "#f6f5fb";
          ctx.fillText(txt, bx + 2, p.y + 4);
        }
      }

      // Custom active coordinate crosshair if not matching a preset
      const matchesPreset = VERIFIED_AZ_REGIONS.some(
        (r) =>
          Math.abs(r.latitude - latitude) < 0.03 &&
          Math.abs(r.longitude - longitude) < 0.03,
      );
      if (!matchesPreset) {
        const p = projectOrtho(longitude, latitude, cLon, cLat, radius, cx, cy);
        if (p.visible) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
          ctx.strokeStyle = "#a78bfa";
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#c4b5fd";
          ctx.fill();
        }
      }

      ctx.restore();

      // Atmospheric electric-violet rim ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(167, 139, 250, 0.58)";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [latitude, longitude, activeLayer, selectedRegion]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    animTargetRef.current = null;
    dragRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startLon: viewCenter.lon,
      startLat: viewCenter.lat,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const baseR = Math.min(rect.width, rect.height) * 0.37;
    const radius = baseR * zoom;
    const cx = rect.width * 0.52;
    const cy = rect.height * 0.5;

    if (dragRef.current.dragging) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true;
      }
      const degPerPx = 60 / Math.max(120, radius);
      const nextLon = Math.max(-180, Math.min(180, dragRef.current.startLon - dx * degPerPx));
      const nextLat = Math.max(-75, Math.min(75, dragRef.current.startLat + dy * degPerPx));
      setViewCenter({ lat: nextLat, lon: nextLon });
    } else {
      const coord = screenToLatLon(
        e.clientX - rect.left,
        e.clientY - rect.top,
        cx,
        cy,
        radius,
        viewCenter.lon,
        viewCenter.lat,
      );
      setHoverInfo(coord);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.dragging) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.dragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (!wasMoved && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const baseR = Math.min(rect.width, rect.height) * 0.37;
      const radius = baseR * zoom;
      const cx = rect.width * 0.52;
      const cy = rect.height * 0.5;

      // Check proximity to verified snapshots first
      for (const reg of VERIFIED_AZ_REGIONS) {
        const p = projectOrtho(
          reg.longitude,
          reg.latitude,
          viewCenter.lon,
          viewCenter.lat,
          radius,
          cx,
          cy,
        );
        if (
          p.visible &&
          Math.hypot(e.clientX - rect.left - p.x, e.clientY - rect.top - p.y) < 16
        ) {
          onSelectRegion(reg.id);
          return;
        }
      }

      const picked = screenToLatLon(
        e.clientX - rect.left,
        e.clientY - rect.top,
        cx,
        cy,
        radius,
        viewCenter.lon,
        viewCenter.lat,
      );
      if (picked) {
        onSelectCoordinates(picked.lat, picked.lon);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom((z) => Math.max(0.85, Math.min(5.5, Number((z + step).toFixed(2)))));
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: 520 }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setHoverInfo(null)}
        onWheel={handleWheel}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 520,
          display: "block",
          cursor: dragRef.current.dragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        role="img"
        aria-label={`Interactive Earth globe centered at ${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`}
      />

      {/* Right-bottom globe controls */}
      <div
        style={{
          position: "absolute",
          right: 18,
          bottom: 18,
          zIndex: 420,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        {hoverInfo && (
          <div className="sf-badge sf-badge-violet mono" style={{ background: "var(--surface-overlay)" }}>
            {hoverInfo.lat.toFixed(2)}°N, {hoverInfo.lon.toFixed(2)}°E
          </div>
        )}
        <div
          className="sf-panel-glass"
          style={{ padding: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}
        >
          <button
            type="button"
            className="sf-btn sf-btn-sm"
            onClick={() => setZoom((z) => Math.min(5.5, Number((z + 0.35).toFixed(2))))}
            aria-label={labels.zoomIn}
            title={labels.zoomIn}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sf-btn sf-btn-sm"
            onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.35).toFixed(2))))}
            aria-label={labels.zoomOut}
            title={labels.zoomOut}
          >
            <Minus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sf-btn sf-btn-sm"
            onClick={() => {
              setZoom(1.4);
              onResetView();
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>{labels.resetView}</span>
          </button>
          <button
            type="button"
            className="sf-btn sf-btn-sm sf-btn-primary"
            onClick={() => {
              setZoom(2.6);
              onFocusPrimary();
            }}
          >
            <Compass size={14} aria-hidden="true" />
            <span>{labels.focusPrimary}</span>
          </button>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", background: "rgba(5,5,11,0.72)", padding: "2px 8px", borderRadius: 6 }}>
          <Maximize2 size={10} style={{ marginRight: 5, verticalAlign: "middle" }} aria-hidden="true" />
          {labels.controlsHint}
        </span>
      </div>
    </div>
  );
}
