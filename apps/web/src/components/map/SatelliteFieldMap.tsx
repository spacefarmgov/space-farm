import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { NASA_GIBS_LAYER_MAP, type GibsLayerId } from "../../data/gibsLayers";
import {
  VERIFIED_AZ_REGIONS,
  getMerra2CellBounds,
  type VerifiedRegionPreset,
} from "../../data/regions";
import { AZ_DISTRICTS } from "../../data/azDistricts";
import {
  buildParcelAroundPoint,
  computeGeodesicAreaHa,
  computePolygonCentroid,
  splitLongestPolygonEdge,
  type LatLonTuple,
} from "../../utils/polygonMetrics";

interface SatelliteFieldMapProps {
  latitude: number;
  longitude: number;
  selectedRegion: VerifiedRegionPreset | null;
  locale?: "az" | "en";
  boundaryPolygon?: LatLonTuple[] | null;
  areaHa?: number;
  showIllustrativeBoundary?: boolean;
  interactiveClick?: boolean;
  zoom?: number;
  height?: number | string;
  earthObsOverlay?: GibsLayerId;
  overlayOpacity?: number;
  onPickCoordinate?: (lat: number, lon: number) => void;
  onSelectRegion?: (regionId: string) => void;
  onChangePolygon?: (
    polygon: LatLonTuple[] | null,
    areaHa?: number,
    centroid?: LatLonTuple,
  ) => void;
}

export function SatelliteFieldMap({
  latitude,
  longitude,
  selectedRegion,
  locale = "en",
  boundaryPolygon = null,
  areaHa,
  showIllustrativeBoundary = true,
  interactiveClick = true,
  zoom = 13,
  height = "100%",
  earthObsOverlay = "none",
  overlayOpacity = 0.72,
  onPickCoordinate,
  onSelectRegion,
  onChangePolygon,
}: SatelliteFieldMapProps) {
  const isAz = locale === "az";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);
  const editingBoundaryRef = useRef(false);
  const skipNextFlyRef = useRef(false);
  const [editingBoundary, setEditingBoundary] = useState(false);

  editingBoundaryRef.current = editingBoundary;

  const activePolygon: LatLonTuple[] | null =
    boundaryPolygon && boundaryPolygon.length >= 3
      ? boundaryPolygon
      : showIllustrativeBoundary && selectedRegion?.illustrativePolygon
        ? selectedRegion.illustrativePolygon.map(([lat, lon]) => [lat, lon] as LatLonTuple)
        : null;

  useEffect(() => {
    if (!activePolygon && editingBoundary) {
      setEditingBoundary(false);
    }
  }, [activePolygon, editingBoundary]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: [latitude, longitude],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Authentic Esri World Imagery basemap (no watermarked third-party tile layers)
    const imageryLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
      },
    );
    imageryLayer.addTo(map);

    L.control.scale({ metric: true, imperial: false }).addTo(map);

    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 80);

    const overlays = L.layerGroup().addTo(map);
    overlayGroupRef.current = overlays;
    mapRef.current = map;

    if (interactiveClick && onPickCoordinate) {
      map.on("click", (ev: L.LeafletMouseEvent) => {
        if (editingBoundaryRef.current) return;
        onPickCoordinate(
          Number(ev.latlng.lat.toFixed(4)),
          Number(ev.latlng.lng.toFixed(4)),
        );
      });
    }

    return () => {
      window.clearTimeout(invalidateTimer);
      gibsLayerRef.current = null;
      map.remove();
      mapRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

  // Attach/swap verified NASA GIBS WMTS Earth Observation layer cleanly without remounting map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (gibsLayerRef.current) {
      map.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }

    if (!earthObsOverlay || earthObsOverlay === "none") return;

    const spec = NASA_GIBS_LAYER_MAP[earthObsOverlay];
    const tileLayer = L.tileLayer(spec.tileUrl, {
      maxNativeZoom: spec.maxNativeZoom,
      maxZoom: 18,
      tileSize: 256,
      opacity: overlayOpacity,
      crossOrigin: "anonymous",
      attribution: `NASA EOSDIS GIBS (${spec.compositeDate})`,
    });
    tileLayer.setZIndex(5);
    tileLayer.addTo(map);
    gibsLayerRef.current = tileLayer;
  }, [earthObsOverlay]);

  // Smoothly update GIBS overlay opacity without re-fetching tiles
  useEffect(() => {
    if (gibsLayerRef.current) {
      gibsLayerRef.current.setOpacity(overlayOpacity);
    }
  }, [overlayOpacity]);

  // Re-center map cleanly when selected coordinates or EO zoom mode change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (skipNextFlyRef.current) {
      skipNextFlyRef.current = false;
      return;
    }
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const eoSpec =
      earthObsOverlay && earthObsOverlay !== "none"
        ? NASA_GIBS_LAYER_MAP[earthObsOverlay]
        : null;
    const targetZoom = eoSpec
      ? Math.min(zoom, eoSpec.recommendedZoom)
      : activePolygon
        ? Math.max(map.getZoom(), 14)
        : zoom;
    if (prefersReduced) {
      map.setView([latitude, longitude], targetZoom, { animate: false });
    } else {
      map.flyTo([latitude, longitude], targetZoom, { duration: 0.7 });
    }
  }, [latitude, longitude, selectedRegion, zoom, earthObsOverlay]);

  // Update vector layers & optional draggable corner handles
  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group) return;
    group.clearLayers();

    // 1. Real MERRA-2 0.5° × 0.625° footprint
    const cell = getMerra2CellBounds(latitude, longitude);
    L.rectangle(
      [
        [cell.south, cell.west],
        [cell.north, cell.east],
      ],
      {
        color: "#67e8f9",
        weight: 1.5,
        dashArray: "6 4",
        fillColor: "#67e8f9",
        fillOpacity: 0.06,
      },
    )
      .bindTooltip("MERRA-2 / NASA POWER 0.5° × 0.625° grid cell")
      .addTo(group);

    // 2. Mapped or user-drawn field boundary polygon
    let polygonLayer: L.Polygon | null = null;
    if (activePolygon && activePolygon.length >= 3) {
      const haDisplay =
        typeof areaHa === "number" && areaHa > 0
          ? areaHa.toFixed(1)
          : computeGeodesicAreaHa(activePolygon).toFixed(1);
      polygonLayer = L.polygon(activePolygon, {
        color: editingBoundary ? "#c084fc" : "#a78bfa",
        weight: editingBoundary ? 3 : 2.5,
        fillColor: "#8b5cf6",
        fillOpacity: editingBoundary ? 0.34 : 0.26,
      })
        .bindTooltip(
          isAz
            ? `Sahə sərhədi (${haDisplay} ha · ${activePolygon.length} künc)`
            : `Field parcel boundary (${haDisplay} ha · ${activePolygon.length} corners)`,
        )
        .addTo(group);
    }

    // 3. Verified 4 Azerbaijan snapshot markers
    for (const region of VERIFIED_AZ_REGIONS) {
      const isActive =
        Math.abs(region.latitude - latitude) < 0.01 &&
        Math.abs(region.longitude - longitude) < 0.01;

      const marker = L.circleMarker([region.latitude, region.longitude], {
        radius: isActive ? 8 : 6,
        color: "#f6f5fb",
        weight: 2,
        fillColor: region.hasBoundary ? "#8b5cf6" : "#67e8f9",
        fillOpacity: 0.95,
      }).bindTooltip(`${region.nameEn} (${region.latitude.toFixed(2)}, ${region.longitude.toFixed(2)})`);

      if (onSelectRegion) {
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          if (!editingBoundaryRef.current) {
            onSelectRegion(region.id);
          }
        });
      }
      marker.addTo(group);
    }

    // 3b. All 67 verified Azerbaijan districts (clickable NASA POWER + SRTM pins)
    for (const district of AZ_DISTRICTS) {
      const overlapsPrimary = VERIFIED_AZ_REGIONS.some(
        (r) =>
          Math.abs(r.latitude - district.lat) < 0.03 &&
          Math.abs(r.longitude - district.lon) < 0.03,
      );
      const isActive =
        Math.abs(district.lat - latitude) < 0.01 &&
        Math.abs(district.lon - longitude) < 0.01;
      if (overlapsPrimary && !isActive) continue;

      const dMarker = L.circleMarker([district.lat, district.lon], {
        radius: isActive ? 8 : 4,
        color: isActive ? "#f6f5fb" : "#0ea5e9",
        weight: isActive ? 2 : 1,
        fillColor: isActive ? "#34d399" : "#38bdf8",
        fillOpacity: isActive ? 0.95 : 0.72,
      }).bindTooltip(
        `${district.nameAz} · ${district.elevationM.toFixed(0)} m · ${district.annualRainMm.toFixed(0)} mm`,
      );

      if (onSelectRegion) {
        dMarker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          if (!editingBoundaryRef.current) {
            onSelectRegion(district.id);
          }
        });
      }
      dMarker.addTo(group);
    }

    // 4. Custom selected point pin (shown when not drawing over an active preset)
    const matchesPreset = VERIFIED_AZ_REGIONS.some(
      (r) =>
        Math.abs(r.latitude - latitude) < 0.01 &&
        Math.abs(r.longitude - longitude) < 0.01,
    ) || AZ_DISTRICTS.some(
      (d) =>
        Math.abs(d.lat - latitude) < 0.01 &&
        Math.abs(d.lon - longitude) < 0.01,
    );
    if (!matchesPreset) {
      L.circleMarker([latitude, longitude], {
        radius: 8,
        color: "#f6f5fb",
        weight: 2,
        fillColor: "#a78bfa",
        fillOpacity: 0.9,
      })
        .bindTooltip(`Custom point (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)
        .addTo(group);
    }

    // 5. Draggable corner handles when boundary editing is enabled
    if (editingBoundary && activePolygon && activePolygon.length >= 3 && onChangePolygon) {
      const icon = L.divIcon({
        className: "sf-vertex-handle",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      activePolygon.forEach((pt, idx) => {
        const handle = L.marker(pt, {
          icon,
          draggable: true,
          title: isAz
            ? "Sürüşdürün · Silmək üçün 2× klik (min 3 künc)"
            : "Drag corner · 2× click to remove (min 3)",
        });
        handle.on("drag", () => {
          if (!polygonLayer) return;
          const ll = handle.getLatLng();
          const preview = activePolygon.map((p, i) =>
            i === idx
              ? ([Number(ll.lat.toFixed(5)), Number(ll.lng.toFixed(5))] as LatLonTuple)
              : p,
          );
          polygonLayer.setLatLngs(preview);
        });
        handle.on("dragend", () => {
          const ll = handle.getLatLng();
          const updated = activePolygon.map((p, i) =>
            i === idx
              ? ([Number(ll.lat.toFixed(5)), Number(ll.lng.toFixed(5))] as LatLonTuple)
              : p,
          );
          skipNextFlyRef.current = true;
          onChangePolygon(
            updated,
            computeGeodesicAreaHa(updated),
            computePolygonCentroid(updated) ?? undefined,
          );
        });
        handle.on("dblclick", (e) => {
          L.DomEvent.stopPropagation(e);
          if (activePolygon.length <= 3) return;
          const trimmed = activePolygon.filter((_, i) => i !== idx);
          skipNextFlyRef.current = true;
          onChangePolygon(
            trimmed,
            computeGeodesicAreaHa(trimmed),
            computePolygonCentroid(trimmed) ?? undefined,
          );
        });
        handle.addTo(group);
      });
    }
  }, [
    latitude,
    longitude,
    selectedRegion,
    boundaryPolygon,
    areaHa,
    showIllustrativeBoundary,
    editingBoundary,
    isAz,
    onSelectRegion,
    onChangePolygon,
  ]);

  const handleToggleBoundaryEdit = () => {
    if (!onChangePolygon) return;
    if (editingBoundary) {
      setEditingBoundary(false);
      return;
    }
    if (!activePolygon || activePolygon.length < 3) {
      const starter = buildParcelAroundPoint(latitude, longitude, 0.0038);
      const nextHa = computeGeodesicAreaHa(starter);
      skipNextFlyRef.current = false;
      onChangePolygon(starter, nextHa);
      mapRef.current?.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 15), {
        animate: true,
      });
    }
    setEditingBoundary(true);
  };

  const handleAddCorner = () => {
    if (!onChangePolygon || !activePolygon || activePolygon.length < 3) return;
    const expanded = splitLongestPolygonEdge(activePolygon);
    skipNextFlyRef.current = true;
    onChangePolygon(
      expanded,
      computeGeodesicAreaHa(expanded),
      computePolygonCentroid(expanded) ?? undefined,
    );
  };

  const handleClearBoundary = () => {
    if (!onChangePolygon) return;
    setEditingBoundary(false);
    skipNextFlyRef.current = true;
    onChangePolygon(null);
  };

  const handleZoomAzerbaijan = () => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [
        [38.35, 44.75],
        [41.92, 50.65],
      ],
      { padding: [26, 26], maxZoom: 8, animate: true },
    );
  };

  const toolbarBtnStyle = (active = false): React.CSSProperties => ({
    background: active ? "rgba(124, 58, 237, 0.88)" : "rgba(10, 9, 24, 0.86)",
    borderColor: active ? "rgba(216, 180, 254, 0.85)" : "rgba(103, 232, 249, 0.45)",
    color: "#f5f3ff",
    backdropFilter: "blur(10px)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
  });

  return (
    <div className="sf-map-box" style={{ height, width: "100%", position: "relative" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: typeof height === "number" ? height : 420 }}
      />
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 500,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "flex-end",
          maxWidth: "calc(100% - 64px)",
        }}
      >
        {onChangePolygon && (
          <>
            <button
              type="button"
              className="sf-btn sf-btn-sm"
              onClick={handleToggleBoundaryEdit}
              style={toolbarBtnStyle(editingBoundary)}
              title={
                isAz
                  ? "Xəritədə tarla sərhədini çəkin və küncləri sürüşdürün"
                  : "Draw or reshape field parcel polygon vertices on satellite map"
              }
            >
              <span>
                {editingBoundary
                  ? isAz
                    ? "✓ Sərhədi Tamamla"
                    : "✓ Done Boundary"
                  : activePolygon
                    ? isAz
                      ? "✎ Sərhədi Düzəlt"
                      : "✎ Edit Boundary"
                    : isAz
                      ? "✎ Sərhəd Çək"
                      : "✎ Draw Boundary"}
              </span>
            </button>
            {editingBoundary && (
              <>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm"
                  onClick={handleAddCorner}
                  style={toolbarBtnStyle(false)}
                  title={isAz ? "Ən uzun tərəfə əlavə künc artır" : "Add vertex corner"}
                >
                  <span>{isAz ? "+ Künc" : "+ Corner"}</span>
                </button>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm"
                  onClick={handleClearBoundary}
                  style={toolbarBtnStyle(false)}
                  title={isAz ? "Xüsusi sərhədi sil" : "Clear custom boundary"}
                >
                  <span>{isAz ? "Sil" : "Clear"}</span>
                </button>
              </>
            )}
          </>
        )}
        <button
          type="button"
          className="sf-btn sf-btn-sm"
          onClick={handleZoomAzerbaijan}
          style={toolbarBtnStyle(false)}
          title={isAz ? "Bütün 67 Azərbaycan rayonunu göstər" : "Fit all 67 Azerbaijan districts"}
        >
          <span>{isAz ? "🇦🇿 67 Rayon Xəritəsi" : "🇦🇿 67 Districts Map"}</span>
        </button>
      </div>
    </div>
  );
}
