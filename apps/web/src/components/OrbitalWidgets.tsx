import { useEffect, useRef, useState } from "react";
import {
  AZERBAIJAN_REGIONS,
  type Language,
  type RegionPreset,
} from "../data/orbitalData";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

interface GlobeProps {
  selectedRegion: RegionPreset;
  latitude: number;
  longitude: number;
  annualPrecipMm: number;
  meanTempC: number;
  sha256: string;
  onSelectRegion: (reg: RegionPreset) => void;
}

export function InteractiveOrbitalGlobe({
  selectedRegion,
  latitude,
  longitude,
  annualPrecipMm,
  meanTempC,
  sha256,
  onSelectRegion,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [autoSpin, setAutoSpin] = useState<boolean>(true);
  const rotRef = useRef<{ yaw: number; pitch: number; dragging: boolean; lastX: number; lastY: number }>({
    yaw: -0.78, // Centered on Caucasus / Azerbaijan (~47°E)
    pitch: 0.42, // ~40°N tilt
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let tick = 0;

    // Simplified continent polygons (lat, lon) for 3D projection
    const landmassRings: Array<Array<[number, number]>> = [
      // Eurasia
      [
        [36, -9], [43, -9], [48, -4], [54, 8], [60, 10], [68, 20], [70, 60],
        [66, 140], [52, 140], [35, 120], [22, 114], [10, 104], [22, 88],
        [8, 77], [25, 66], [13, 45], [30, 32], [36, 36], [41, 28], [45, 14],
      ],
      // Africa
      [
        [35, -6], [37, 10], [32, 32], [12, 51], [-2, 41], [-26, 33],
        [-34, 18], [-16, 12], [4, 9], [5, -8], [15, -17], [28, -13],
      ],
      // North America
      [
        [70, -160], [72, -95], [52, -56], [42, -70], [25, -80],
        [18, -96], [8, -78], [20, -105], [34, -120], [58, -136],
      ],
    ];

    const project3D = (
      latDeg: number,
      lonDeg: number,
      radius: number,
      cx: number,
      cy: number
    ): { x: number; y: number; z: number } => {
      const lat = (latDeg * Math.PI) / 180;
      const lon = (lonDeg * Math.PI) / 180 + rotRef.current.yaw;
      const pitch = rotRef.current.pitch;

      const x0 = Math.cos(lat) * Math.sin(lon);
      const y0 = Math.sin(lat);
      const z0 = Math.cos(lat) * Math.cos(lon);

      const y1 = y0 * Math.cos(pitch) - z0 * Math.sin(pitch);
      const z1 = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);

      return {
        x: cx + x0 * radius,
        y: cy - y1 * radius,
        z: z1,
      };
    };

    const render = () => {
      tick += 0.014;
      if (autoSpin && !rotRef.current.dragging) {
        rotRef.current.yaw += 0.0022;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.52;
      const cy = h * 0.52;
      const R = Math.min(w, h) * 0.37;

      ctx.clearRect(0, 0, w, h);

      // Outer atmospheric corona
      const halo = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.32);
      halo.addColorStop(0, "rgba(124, 58, 237, 0.38)");
      halo.addColorStop(0.5, "rgba(56, 189, 248, 0.16)");
      halo.addColorStop(1, "rgba(5, 6, 15, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.32, 0, Math.PI * 2);
      ctx.fill();

      // Earth sphere core
      const globeGrad = ctx.createRadialGradient(
        cx - R * 0.28,
        cy - R * 0.28,
        R * 0.1,
        cx,
        cy,
        R
      );
      globeGrad.addColorStop(0, "#172554");
      globeGrad.addColorStop(0.55, "#0b132b");
      globeGrad.addColorStop(0.9, "#1e1b4b");
      globeGrad.addColorStop(1, "#3b0764");
      ctx.fillStyle = globeGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Latitude & Longitude Graticules
      ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
      ctx.lineWidth = 1;
      for (let lon = -180; lon < 180; lon += 20) {
        ctx.beginPath();
        let started = false;
        for (let lat = -80; lat <= 80; lat += 6) {
          const p = project3D(lat, lon, R, cx, cy);
          if (p.z > 0) {
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

      for (let lat = -60; lat <= 60; lat += 20) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const p = project3D(lat, lon, R, cx, cy);
          if (p.z > 0) {
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

      // Draw Continents
      for (const ring of landmassRings) {
        ctx.beginPath();
        let visibleCount = 0;
        ring.forEach(([lat, lon], idx) => {
          const p = project3D(lat, lon, R, cx, cy);
          if (p.z > 0) {
            visibleCount++;
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        });
        if (visibleCount > 3) {
          ctx.closePath();
          ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
          ctx.strokeStyle = "rgba(56, 189, 248, 0.42)";
          ctx.lineWidth = 1.3;
          ctx.fill();
          ctx.stroke();
        }
      }

      // Glowing Rim
      ctx.strokeStyle = "rgba(168, 85, 247, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Target Beacons on Azerbaijan / Active Coordinate
      const targetPt = project3D(latitude, longitude, R, cx, cy);
      if (targetPt.z > -0.1) {
        const pulse = 10 + Math.sin(tick * 4) * 5;
        ctx.fillStyle = "rgba(168, 85, 247, 0.35)";
        ctx.beginPath();
        ctx.arc(targetPt.x, targetPt.y, pulse * 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(targetPt.x, targetPt.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Orbiting NASA Satellites (MERRA-2 / MODIS / Landsat)
      const satAngle = tick * 0.9;
      const satX = cx + Math.cos(satAngle) * (R * 1.24);
      const satY = cy + Math.sin(satAngle) * (R * 0.56) - 18;

      // Orbital path ellipse
      ctx.save();
      ctx.translate(cx, cy - 18);
      ctx.rotate(-0.26);
      ctx.strokeStyle = "rgba(192, 132, 252, 0.45)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.26, R * 0.56, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Laser Telemetry Beam from Satellite to Active Field
      if (targetPt.z > 0) {
        const beamGrad = ctx.createLinearGradient(satX, satY, targetPt.x, targetPt.y);
        beamGrad.addColorStop(0, "rgba(56, 189, 248, 0.95)");
        beamGrad.addColorStop(1, "rgba(168, 85, 247, 0.85)");
        ctx.strokeStyle = beamGrad;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(satX, satY);
        ctx.lineTo(targetPt.x, targetPt.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Satellite Body
      ctx.save();
      ctx.translate(satX, satY);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-22, -5, 14, 10);
      ctx.fillRect(8, -5, 14, 10);
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(-6, -8, 12, 16);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-6, -8, 12, 16);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [autoSpin, latitude, longitude]);

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <canvas
        ref={canvasRef}
        width={520}
        height={410}
        style={{
          width: "100%",
          maxWidth: 520,
          height: "auto",
          cursor: "grab",
          borderRadius: 18,
        }}
        onMouseDown={(e) => {
          rotRef.current.dragging = true;
          rotRef.current.lastX = e.clientX;
          rotRef.current.lastY = e.clientY;
        }}
        onMouseMove={(e) => {
          if (!rotRef.current.dragging) return;
          const dx = e.clientX - rotRef.current.lastX;
          const dy = e.clientY - rotRef.current.lastY;
          rotRef.current.lastX = e.clientX;
          rotRef.current.lastY = e.clientY;
          rotRef.current.yaw += dx * 0.008;
          rotRef.current.pitch = Math.max(-1.1, Math.min(1.1, rotRef.current.pitch + dy * 0.008));
        }}
        onMouseUp={() => {
          rotRef.current.dragging = false;
        }}
        onMouseLeave={() => {
          rotRef.current.dragging = false;
        }}
      />

      {/* Interactive Globe Controls Overlay */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginTop: "-0.5rem",
          padding: "0.65rem 0.9rem",
          borderRadius: 12,
          background: "rgba(9, 11, 26, 0.88)",
          border: "1px solid rgba(168, 85, 247, 0.45)",
        }}
      >
        <div style={{ fontSize: "0.76rem" }}>
          <div style={{ color: "#c084fc", fontWeight: 800 }}>
            🛰 ORBITAL LOCK: {selectedRegion.nameEn.toUpperCase()}
          </div>
          <div style={{ color: "var(--text-secondary)" }}>
            {latitude.toFixed(3)}°N, {longitude.toFixed(3)}°E • {annualPrecipMm.toFixed(1)} mm •{" "}
            {meanTempC.toFixed(1)}°C • <code style={{ color: "#6ee7b7" }}>{sha256.slice(0, 12)}…</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn-orbital-secondary"
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.73rem" }}
            onClick={() => {
              rotRef.current.yaw = -0.78;
              rotRef.current.pitch = 0.42;
            }}
          >
            🎯 Focus Caucasus
          </button>
          <button
            type="button"
            className="btn-orbital-secondary"
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.73rem" }}
            onClick={() => setAutoSpin((s) => !s)}
          >
            {autoSpin ? "⏸ Pause Orbit" : "▶ Spin Globe"}
          </button>
        </div>
      </div>

      {/* Quick Sector Selector Pills under Globe */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.6rem", width: "100%" }}>
        {AZERBAIJAN_REGIONS.slice(0, 4).map((reg) => (
          <button
            key={reg.id}
            type="button"
            onClick={() => {
              rotRef.current.yaw = -0.78;
              rotRef.current.pitch = 0.42;
              onSelectRegion(reg);
            }}
            style={{
              flex: 1,
              minWidth: 105,
              padding: "0.38rem 0.55rem",
              borderRadius: 9,
              border:
                reg.id === selectedRegion.id
                  ? "1px solid #38bdf8"
                  : "1px solid rgba(148, 163, 184, 0.2)",
              background:
                reg.id === selectedRegion.id
                  ? "rgba(56, 189, 248, 0.18)"
                  : "rgba(15, 23, 42, 0.7)",
              color: "#fff",
              fontSize: "0.73rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📍 {reg.nameEn.split("—")[0].trim()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 02. Real Interactive Leaflet Satellite Explorer Map
// ---------------------------------------------------------------------------

interface ExplorerMapProps {
  lang: Language;
  selectedRegion: RegionPreset;
  latitude: number;
  longitude: number;
  mapLayer: "satellite" | "climate" | "fields";
  onSelectRegion: (reg: RegionPreset) => void;
  onPickCoordinate: (lat: number, lon: number) => void;
}

export function ExplorerLeafletMap({
  lang,
  selectedRegion,
  latitude,
  longitude,
  mapLayer,
  onSelectRegion,
  onPickCoordinate,
}: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetMarkerRef = useRef<any>(null);

  useEffect(() => {
    const L = window.L;
    if (!L || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 7,
      zoomControl: true,
    });
    mapRef.current = map;

    const satLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri World Imagery • NASA POWER MERRA-2",
      }
    );
    satLayer.addTo(map);
    baseLayerRef.current = satLayer;

    // Labels overlay
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      opacity: 0.88,
    }).addTo(map);

    // Click anywhere on Earth to analyze that coordinate!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("click", (e: any) => {
      const clickedLat = Number(e.latlng.lat.toFixed(4));
      const clickedLon = Number(e.latlng.lng.toFixed(4));
      onPickCoordinate(clickedLat, clickedLon);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch map tile layer when user toggles Satellite / Climate / Fields
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }

    const tileUrl =
      mapLayer === "climate"
        ? "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

    const nextLayer = L.tileLayer(tileUrl, {
      maxZoom: 18,
      attribution: "Esri World Imagery • NASA POWER",
    });
    nextLayer.addTo(map);
    nextLayer.bringToBack();
    baseLayerRef.current = nextLayer;
  }, [mapLayer]);

  // Render region markers & active target beacon
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
    }

    const layerGroup = L.layerGroup().addTo(map);
    targetMarkerRef.current = layerGroup;

    // Region preset pins
    AZERBAIJAN_REGIONS.forEach((reg) => {
      const isSel = reg.id === selectedRegion.id;
      const icon = L.divIcon({
        className: `orbital-region-marker ${isSel ? "selected" : ""}`,
        html: "🛰",
        iconSize: [26, 26],
      });
      const marker = L.marker([reg.latitude, reg.longitude], { icon }).addTo(layerGroup);
      marker.bindTooltip(
        `${lang === "az" ? reg.nameAz : reg.nameEn} (${reg.annualPrecipMm.toFixed(0)} mm)`,
        {
          permanent: isSel,
          direction: "top",
          className: "orbital-map-tooltip",
          offset: [0, -12],
        }
      );
      marker.on("click", () => {
        onSelectRegion(reg);
        map.flyTo([reg.latitude, reg.longitude], 10, { duration: 1.1 });
      });

      // Climate circle overlay in Climate mode
      if (mapLayer === "climate") {
        L.circle([reg.latitude, reg.longitude], {
          radius: 26000,
          color: reg.annualPrecipMm > 510 ? "#38bdf8" : "#a855f7",
          fillColor: reg.annualPrecipMm > 510 ? "#38bdf8" : "#a855f7",
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(layerGroup);
      }
    });

    // Active custom coordinate pulsing reticle
    L.circleMarker([latitude, longitude], {
      radius: 14,
      color: "#38bdf8",
      weight: 2,
      fillColor: "#a855f7",
      fillOpacity: 0.35,
    }).addTo(layerGroup);
  }, [latitude, longitude, selectedRegion, lang, mapLayer, onSelectRegion]);

  // Smooth flyTo when coordinates change significantly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([latitude, longitude], map.getZoom() < 8 ? 8 : map.getZoom(), {
      duration: 0.85,
    });
  }, [selectedRegion.id, latitude, longitude]);

  return <div ref={containerRef} className="orbital-leaflet-container" />;
}

// ---------------------------------------------------------------------------
// 03. Real High-Zoom Satellite Field Parcel Polygon Editor
// ---------------------------------------------------------------------------

interface FieldParcelMapProps {
  centerLat: number;
  centerLon: number;
  parcelCoords: Array<[number, number]>;
  drawingMode: boolean;
  onChangeParcelCoords: (next: Array<[number, number]>) => void;
}

export function FieldParcelLeafletMap({
  centerLat,
  centerLon,
  parcelCoords,
  drawingMode,
  onChangeParcelCoords,
}: FieldParcelMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlayRef = useRef<any>(null);

  useEffect(() => {
    const L = window.L;
    if (!L || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLon],
      zoom: 15,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Esri World Imagery • Drag vertices or click to draw parcel",
      }
    ).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      opacity: 0.85,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center map when region changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([centerLat, centerLon], 15);
  }, [centerLat, centerLon]);

  // Handle click-to-add-vertex when drawingMode is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMapClick = (e: any) => {
      if (!drawingMode) return;
      const nextPt: [number, number] = [
        Number(e.latlng.lat.toFixed(6)),
        Number(e.latlng.lng.toFixed(6)),
      ];
      onChangeParcelCoords([...parcelCoords, nextPt]);
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [drawingMode, parcelCoords, onChangeParcelCoords]);

  // Render glowing polygon and draggable corner vertex handles
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    if (overlayRef.current) {
      overlayRef.current.remove();
    }

    const group = L.layerGroup().addTo(map);
    overlayRef.current = group;

    if (parcelCoords.length >= 3) {
      L.polygon(parcelCoords, {
        color: "#c084fc",
        weight: 3,
        fillColor: "#a855f7",
        fillOpacity: 0.32,
      }).addTo(group);
    } else if (parcelCoords.length === 2) {
      L.polyline(parcelCoords, {
        color: "#38bdf8",
        weight: 3,
        dashArray: "5 5",
      }).addTo(group);
    }

    // Draggable vertex handles
    parcelCoords.forEach((pt, idx) => {
      const handleIcon = L.divIcon({
        className: "orbital-vertex-handle",
        iconSize: [14, 14],
      });
      const marker = L.marker(pt, {
        icon: handleIcon,
        draggable: true,
      }).addTo(group);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marker.on("dragend", (ev: any) => {
        const pos = ev.target.getLatLng();
        const updated = parcelCoords.map((item, i) =>
          i === idx
            ? ([Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))] as [number, number])
            : item
        );
        onChangeParcelCoords(updated);
      });
    });
  }, [parcelCoords, onChangeParcelCoords]);

  return <div ref={containerRef} className="orbital-leaflet-container" style={{ height: 420 }} />;
}
