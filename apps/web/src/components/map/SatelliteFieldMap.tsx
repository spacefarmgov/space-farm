import { useEffect, useRef } from "react";
import L from "leaflet";
import { NASA_GIBS_LAYER_MAP, type GibsLayerId } from "../../data/gibsLayers";
import {
  VERIFIED_AZ_REGIONS,
  getMerra2CellBounds,
  type VerifiedRegionPreset,
} from "../../data/regions";

interface SatelliteFieldMapProps {
  latitude: number;
  longitude: number;
  selectedRegion: VerifiedRegionPreset | null;
  showIllustrativeBoundary?: boolean;
  interactiveClick?: boolean;
  zoom?: number;
  height?: number | string;
  earthObsOverlay?: GibsLayerId;
  overlayOpacity?: number;
  onPickCoordinate?: (lat: number, lon: number) => void;
  onSelectRegion?: (regionId: string) => void;
}

export function SatelliteFieldMap({
  latitude,
  longitude,
  selectedRegion,
  showIllustrativeBoundary = true,
  interactiveClick = true,
  zoom = 13,
  height = "100%",
  earthObsOverlay = "none",
  overlayOpacity = 0.72,
  onPickCoordinate,
  onSelectRegion,
}: SatelliteFieldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);

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
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const eoSpec =
      earthObsOverlay && earthObsOverlay !== "none"
        ? NASA_GIBS_LAYER_MAP[earthObsOverlay]
        : null;
    const targetZoom = eoSpec
      ? Math.min(zoom, eoSpec.recommendedZoom)
      : selectedRegion?.hasBoundary
        ? Math.max(map.getZoom(), 14)
        : zoom;
    if (prefersReduced) {
      map.setView([latitude, longitude], targetZoom, { animate: false });
    } else {
      map.flyTo([latitude, longitude], targetZoom, { duration: 0.7 });
    }
  }, [latitude, longitude, selectedRegion, zoom, earthObsOverlay]);

  // Update vector layers cleanly on coordinate or preset changes
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

    // 2. Mapped parcel boundary for primary regional plot
    if (showIllustrativeBoundary && selectedRegion?.illustrativePolygon) {
      L.polygon(selectedRegion.illustrativePolygon, {
        color: "#a78bfa",
        weight: 2.5,
        fillColor: "#8b5cf6",
        fillOpacity: 0.28,
      })
        .bindTooltip("Ganja–Dashkasan mapped parcel (28.4 ha)")
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
          onSelectRegion(region.id);
        });
      }
      marker.addTo(group);
    }

    // 4. Custom selected point pin
    const matchesPreset = VERIFIED_AZ_REGIONS.some(
      (r) =>
        Math.abs(r.latitude - latitude) < 0.01 &&
        Math.abs(r.longitude - longitude) < 0.01,
    );
    if (!matchesPreset) {
      L.circleMarker([latitude, longitude], {
        radius: 9,
        color: "#f6f5fb",
        weight: 2,
        fillColor: "#a78bfa",
        fillOpacity: 0.9,
      })
        .bindTooltip(`Custom point (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)
        .addTo(group);
    }
  }, [latitude, longitude, selectedRegion, showIllustrativeBoundary, onSelectRegion]);

  return (
    <div className="sf-map-box" style={{ height, width: "100%" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: typeof height === "number" ? height : 420 }}
      />
    </div>
  );
}
