import React, { useEffect, useRef, useState } from "react";
import { buildParcelAroundPoint, computeGeodesicAreaHa, SATELLITE_FILTERS } from "../data/presets";
import { sampleWindField } from "../services/realTelemetry";
import type {
  LiveClimateSnapshot,
  RealWeatherSnapshot,
  RealWindGridPoint,
  SatelliteFilterMode,
} from "../types";

export interface SatelliteFieldMapProps {
  selectedLat: number;
  selectedLon: number;
  locationLabel: string;
  polygon: Array<[number, number]>;
  areaHa: number;
  filterMode: SatelliteFilterMode;
  weather: RealWeatherSnapshot;
  climate: LiveClimateSnapshot;
  windGrid: RealWindGridPoint[];
  language: "en" | "az";
  isVisible: boolean;
  onReturnToGlobe: () => void;
  onSelectLocation: (lat: number, lon: number) => void;
  onPolygonChange: (polygon: Array<[number, number]>, areaHa: number) => void;
  onFilterChange: (mode: SatelliteFilterMode) => void;
  onProceed?: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L?: any;
  }
}

function compassLabel(deg: number | null | undefined, lang: "en" | "az"): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return "—";
  const dirsEn = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dirsAz = ["Şm", "Şm-Şq", "Şq", "C-Şq", "C", "C-Qb", "Qb", "Şm-Qb"];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return `${Math.round(deg)}° (${lang === "az" ? dirsAz[idx] : dirsEn[idx]})`;
}

export const SatelliteFieldMap: React.FC<SatelliteFieldMapProps> = ({
  selectedLat,
  selectedLon,
  locationLabel,
  polygon,
  areaHa,
  filterMode,
  weather,
  climate,
  windGrid,
  language,
  isVisible,
  onReturnToGlobe,
  onSelectLocation,
  onPolygonChange,
  onFilterChange,
  onProceed,
}) => {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const windCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thermal?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ndvi?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polygonLayer?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vertexMarkers: any[];
  }>({ vertexMarkers: [] });

  const [editVertices, setEditVertices] = useState(false);
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  const propsRef = useRef({
    selectedLat,
    selectedLon,
    polygon,
    filterMode,
    weather,
    windGrid,
    editVertices,
    onSelectLocation,
    onPolygonChange,
  });
  propsRef.current = {
    selectedLat,
    selectedLon,
    polygon,
    filterMode,
    weather,
    windGrid,
    editVertices,
    onSelectLocation,
    onPolygonChange,
  };

  // Initialize Leaflet Map once (even behind the curtain during dive for zero-pop tile preloading)
  useEffect(() => {
    const container = mapElRef.current;
    const L = window.L;
    if (!container || !L || mapRef.current) return;

    const map = L.map(container, {
      center: [selectedLat, selectedLon],
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Primary ultra-sharp Esri World Imagery optical satellite tiles
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        maxNativeZoom: 17,
        attribution: "Esri World Imagery • NASA GIBS",
      }
    ).addTo(map);

    // Subtle regional labels layer so Azerbaijan settlements / valleys are identifiable
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        maxNativeZoom: 16,
        opacity: 0.65,
      }
    ).addTo(map);

    // Real NASA MODIS Terra Land Surface Temp overlay
    const thermalLayer = L.tileLayer(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2024-07-15/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png",
      {
        maxZoom: 18,
        maxNativeZoom: 7,
        opacity: 0.52,
      }
    );

    // Real NASA MODIS Terra 16-Day Crop NDVI overlay
    const ndviLayer = L.tileLayer(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_16Day/default/2024-07-11/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
      {
        maxZoom: 18,
        maxNativeZoom: 9,
        opacity: 0.58,
      }
    );

    const polygonLayer = L.polygon(polygon, {
      color: "#c084fc",
      weight: 2.2,
      fillColor: "#7c3aed",
      fillOpacity: 0.24,
      dashArray: "6 4",
    }).addTo(map);

    map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
      if (propsRef.current.editVertices) return;
      const newLat = Number(e.latlng.lat.toFixed(5));
      const newLon = Number(e.latlng.lng.toFixed(5));
      propsRef.current.onSelectLocation(newLat, newLon);
    });

    layersRef.current = {
      thermal: thermalLayer,
      ndvi: ndviLayer,
      polygonLayer,
      vertexMarkers: [],
    };
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-center and flush Leaflet container size whenever map becomes visible after Dive
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([selectedLat, selectedLon], 14, { animate: isVisible });
    if (isVisible) {
      window.setTimeout(() => {
        map.invalidateSize({ animate: false });
      }, 60);
    }
  }, [selectedLat, selectedLon, isVisible]);

  // Sync MODIS Thermal / NDVI Leaflet tile overlays with active filter
  useEffect(() => {
    const map = mapRef.current;
    const { thermal, ndvi } = layersRef.current;
    if (!map || !thermal || !ndvi) return;

    if (filterMode === "thermal") {
      if (!map.hasLayer(thermal)) thermal.addTo(map);
    } else if (map.hasLayer(thermal)) {
      map.removeLayer(thermal);
    }

    if (filterMode === "ndvi") {
      if (!map.hasLayer(ndvi)) ndvi.addTo(map);
    } else if (map.hasLayer(ndvi)) {
      map.removeLayer(ndvi);
    }
  }, [filterMode]);

  // Update field polygon & draggable corner vertex handles
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    const { polygonLayer, vertexMarkers } = layersRef.current;
    if (!map || !L || !polygonLayer) return;

    polygonLayer.setLatLngs(polygon);

    // Clear old vertex handles
    vertexMarkers.forEach((m) => m.remove());
    layersRef.current.vertexMarkers = [];

    if (editVertices) {
      const nextMarkers = polygon.map((pt, idx) => {
        const icon = L.divIcon({
          className: "sf-vertex-handle",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker(pt, { icon, draggable: true }).addTo(map);
        marker.on("drag", () => {
          const ll = marker.getLatLng();
          const updated: Array<[number, number]> = polygon.map((p, i) =>
            i === idx ? [Number(ll.lat.toFixed(5)), Number(ll.lng.toFixed(5))] : p
          );
          polygonLayer.setLatLngs(updated);
        });
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          const updated: Array<[number, number]> = polygon.map((p, i) =>
            i === idx ? [Number(ll.lat.toFixed(5)), Number(ll.lng.toFixed(5))] : p
          );
          propsRef.current.onPolygonChange(updated, computeGeodesicAreaHa(updated));
        });
        return marker;
      });
      layersRef.current.vertexMarkers = nextMarkers;
    }
  }, [polygon, editVertices]);

  // Live Real Meteorological Wind Flow Overlay on Map Canvas (when filterMode === "wind")
  useEffect(() => {
    const canvas = windCanvasRef.current;
    if (!canvas || filterMode !== "wind" || !isVisible) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let isMapMoving = false;

    interface MapParticle {
      x: number;
      y: number;
      age: number;
      maxAge: number;
      trail: Array<{ x: number; y: number }>;
    }

    const COUNT = 155;
    const TRAIL_LEN = 10;
    let particles: MapParticle[] = [];

    const seedParticles = (w: number, h: number) => {
      const safeW = Math.max(100, w);
      const safeH = Math.max(100, h);
      particles = Array.from({ length: COUNT }, () => {
        const x = Math.random() * safeW;
        const y = Math.random() * safeH;
        return {
          x,
          y,
          age: Math.random() * 80,
          maxAge: 65 + Math.random() * 65,
          trail: [{ x, y }],
        };
      });
    };

    const syncSize = () => {
      const host = canvas.parentElement;
      const nextW = Math.max(320, host?.clientWidth || canvas.clientWidth || window.innerWidth || 800);
      const nextH = Math.max(320, host?.clientHeight || canvas.clientHeight || window.innerHeight || 500);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      seedParticles(canvas.width, canvas.height);
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas.parentElement || canvas);

    const map = mapRef.current;
    const handleMoveStart = () => {
      isMapMoving = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    const handleMoveEnd = () => {
      isMapMoving = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      seedParticles(canvas.width, canvas.height);
    };

    if (map) {
      map.on("movestart zoomstart", handleMoveStart);
      map.on("moveend zoomend", handleMoveEnd);
    }

    const frame = () => {
      animId = requestAnimationFrame(frame);
      const w = canvas.width;
      const h = canvas.height;
      // Full clean clear per frame eliminates destination-in GPU compositing ghosting & pan streaks
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      if (isMapMoving || w < 10 || h < 10) return;

      // Resolve real point wind or grid bilinear wind
      const wCur = propsRef.current.weather;
      let uMs = 3.5;
      let vMs = 1.2;
      if (wCur.status === "ready" && wCur.windSpeedMs !== null && wCur.windDirDeg !== null) {
        const flowRad = ((wCur.windDirDeg + 180) * Math.PI) / 180;
        uMs = wCur.windSpeedMs * Math.sin(flowRad);
        vMs = wCur.windSpeedMs * Math.cos(flowRad);
      } else if (propsRef.current.windGrid.length > 0) {
        const g = sampleWindField(
          propsRef.current.windGrid,
          propsRef.current.selectedLat,
          propsRef.current.selectedLon
        );
        uMs = g.uMs;
        vMs = g.vMs;
      }

      const speed = Math.hypot(uMs, vMs);
      const stepPx = 1.45 + Math.min(3.4, speed * 0.24);
      const vx = (uMs / Math.max(0.5, speed)) * stepPx;
      const vy = (-vMs / Math.max(0.5, speed)) * stepPx;
      const highWind = speed > 10;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const p of particles) {
        p.age += 1;
        if (p.age > p.maxAge || p.x < -16 || p.x > w + 16 || p.y < -16 || p.y > h + 16) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.age = 0;
          p.trail = [{ x: p.x, y: p.y }];
          continue;
        }
        p.x += vx;
        p.y += vy;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > TRAIL_LEN) p.trail.shift();

        const len = p.trail.length;
        if (len < 2) continue;

        for (let i = 1; i < len; i++) {
          const frac = i / (len - 1);
          const alpha = frac * frac * 0.82;
          ctx.strokeStyle = highWind
            ? `rgba(216, 180, 254, ${alpha.toFixed(2)})`
            : `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
          ctx.lineWidth = 0.8 + frac * 1.3;
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.stroke();
        }
      }
    };

    animId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      if (map) {
        map.off("movestart zoomstart", handleMoveStart);
        map.off("moveend zoomend", handleMoveEnd);
      }
    };
  }, [filterMode, isVisible]);

  const activeFilterMeta = SATELLITE_FILTERS.find((f) => f.id === filterMode) ?? SATELLITE_FILTERS[0];
  const isAz = language === "az";

  return (
    <section
      className={`sf-map-stage ${isVisible ? "is-visible" : "is-preloading"}`}
      aria-hidden={!isVisible}
    >
      <div className="sf-map-canvas" ref={mapElRef} />
      <canvas
        ref={windCanvasRef}
        className={`sf-map-wind-canvas ${filterMode === "wind" ? "is-active" : ""}`}
      />

      {/* Top Navigation & Filter Bar on Full-Screen Satellite Field Map */}
      <header className="sf-map-topbar">
        <div className="sf-map-topbar-left">
          <button
            type="button"
            className="sf-btn-return-orbit"
            onClick={onReturnToGlobe}
          >
            <span aria-hidden="true">↑</span>
            {isAz ? "3D Orbitə Qayıt" : "Return to 3D Orbit"}
          </button>

          <div className="sf-map-location-badge">
            <span className="sf-live-dot" />
            <strong>{locationLabel}</strong>
            <span className="sf-mono-dim">
              {selectedLat.toFixed(4)}°N, {selectedLon.toFixed(4)}°E
            </span>
          </div>
        </div>

        <div className="sf-map-filter-strip" role="group" aria-label="Satellite spectral layers">
          {SATELLITE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`sf-filter-pill ${filterMode === f.id ? "is-active" : ""}`}
              onClick={() => onFilterChange(f.id)}
            >
              {isAz ? f.labelAz : f.labelEn}
            </button>
          ))}
        </div>
      </header>

      {/* Bottom Floating Field & Real Environmental Intelligence Card (compact by default) */}
      <aside className={`sf-map-intel-card ${telemetryOpen ? "" : "is-collapsed"}`}>
        {!telemetryOpen ? (
          <div className="sf-map-compact-bar">
            <span className="sf-chip-purple">{activeFilterMeta.shortTag}</span>
            <span className="sf-compact-metrics">
              {areaHa.toFixed(1)} ha •{" "}
              {weather.tempC !== null ? `${weather.tempC.toFixed(1)}°C` : "—"} •{" "}
              {weather.windSpeedMs !== null ? `${weather.windSpeedMs.toFixed(1)} m/s` : "—"}
              {climate.status === "ready" && climate.meanTempC !== null
                ? ` • NASA ${climate.meanTempC.toFixed(1)}°C`
                : ""}
            </span>
            <div className="sf-map-compact-actions">
              <button
                type="button"
                className={`sf-btn-compact ${editVertices ? "is-editing" : ""}`}
                onClick={() => setEditVertices((v) => !v)}
              >
                {editVertices ? (isAz ? "✓ Bitir" : "✓ Done") : isAz ? "✎ Sərhəd" : "✎ Edit"}
              </button>
              <button
                type="button"
                className="sf-btn-compact"
                onClick={() => setTelemetryOpen(true)}
                title={isAz ? "Ətraflı məlumat" : "Expand telemetry details"}
              >
                {isAz ? "Ətraflı ▴" : "Details ▴"}
              </button>
              {onProceed && (
                <button type="button" className="sf-btn-primary sf-btn-compact-cta" onClick={onProceed}>
                  {isAz ? "Davam →" : "Continue →"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="sf-map-intel-head">
            <div>
              <span className="sf-chip-purple">{activeFilterMeta.shortTag}</span>
              <h3>{isAz ? "Sahə və Real Atmosfer Analizi" : "Field & Real Environmental Telemetry"}</h3>
            </div>
            <button
              type="button"
              className="sf-icon-collapse"
              onClick={() => setTelemetryOpen(false)}
              title={isAz ? "Yığ" : "Collapse"}
            >
              —
            </button>
          </div>
        )}

        {telemetryOpen && (
          <div className="sf-map-intel-body">
            <div className="sf-metric-grid">
              <div className="sf-metric-box">
                <span className="sf-metric-label">{isAz ? "Sahə ölçüsü" : "Parcel Area"}</span>
                <span className="sf-metric-val">{areaHa.toFixed(1)} ha</span>
              </div>
              <div className="sf-metric-box">
                <span className="sf-metric-label">{isAz ? "Hava Temp." : "Air Temp"}</span>
                <span className="sf-metric-val">
                  {weather.tempC !== null ? `${weather.tempC.toFixed(1)}°C` : "—"}
                </span>
              </div>
              <div className="sf-metric-box">
                <span className="sf-metric-label">{isAz ? "Torpaq 0cm" : "Soil 0cm"}</span>
                <span className="sf-metric-val">
                  {weather.soilTemp0Cm !== null ? `${weather.soilTemp0Cm.toFixed(1)}°C` : "—"}
                </span>
              </div>
              <div className="sf-metric-box">
                <span className="sf-metric-label">{isAz ? "10m Külək" : "10m Wind"}</span>
                <span className="sf-metric-val">
                  {weather.windSpeedMs !== null
                    ? `${weather.windSpeedMs.toFixed(1)} m/s • ${compassLabel(weather.windDirDeg, language)}`
                    : "—"}
                </span>
              </div>
            </div>

            {climate.status === "ready" && (
              <div className="sf-climate-row">
                <span>NASA POWER (2024):</span>
                <strong>
                  {climate.meanTempC?.toFixed(1)}°C {isAz ? "orta" : "avg"} •{" "}
                  {climate.totalPrecipMm?.toFixed(0)} mm/yr • {climate.frostDays} {isAz ? "şaxtalı gün" : "frost d"}
                </strong>
              </div>
            )}

            <p className="sf-source-note">{activeFilterMeta.sourceAttribution}</p>

            <div className="sf-map-actions-row">
              <button
                type="button"
                className={`sf-btn-secondary ${editVertices ? "is-editing" : ""}`}
                onClick={() => setEditVertices((v) => !v)}
              >
                {editVertices
                  ? isAz
                    ? "✓ Redaktəni Bitir"
                    : "✓ Finish Editing"
                  : isAz
                  ? "✎ Sərhəd Künclərini Düzəlt"
                  : "✎ Edit Parcel Corners"}
              </button>

              <button
                type="button"
                className="sf-btn-secondary"
                onClick={() => {
                  const freshPoly = buildParcelAroundPoint(selectedLat, selectedLon);
                  onPolygonChange(freshPoly, computeGeodesicAreaHa(freshPoly));
                }}
              >
                {isAz ? "↺ Sıfırla" : "↺ Reset Parcel"}
              </button>

              {onProceed && (
                <button type="button" className="sf-btn-primary" onClick={onProceed}>
                  {isAz ? "Növbəti Mərhələ →" : "Continue →"}
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </section>
  );
};
