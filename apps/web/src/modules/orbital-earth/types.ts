/** Standalone drop-in TypeScript types for SpaceFarm Orbital Earth & Satellite Module */

export type SatelliteFilterMode = "normal" | "thermal" | "wind" | "ndvi";

export type EarthCameraMode = "orbit" | "satellite";

export type SatellitePovStyle = "aperture" | "exterior";

export type ActiveSatelliteId = "terra" | "landsat8";

export type OrbitalStageMode = "globe" | "diving" | "map";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface OrbitalLocationPreset {
  id: string;
  nameEn: string;
  nameAz: string;
  regionLabel: string;
  country: string;
  lat: number;
  lon: number;
  defaultAreaHa: number;
  elevationM: number;
  climateZone: string;
  polygon: Array<[number, number]>;
}

export interface SatelliteTleRecord {
  id: ActiveSatelliteId;
  noradId: number;
  name: string;
  instrument: string;
  glbUrl: string;
  line1: string;
  line2: string;
  epochSource: "celestrak_live" | "celestrak_verified_snapshot";
}

export interface RealSatelliteTelemetry {
  id: ActiveSatelliteId;
  name: string;
  noradId: number;
  lat: number;
  lon: number;
  altitudeKm: number;
  velocityKms: number;
  isLiveUtc: boolean;
  instrument: string;
}

export interface RealWindGridPoint {
  lat: number;
  lon: number;
  tempC: number;
  windSpeedMs: number;
  windDirDeg: number;
  uMs: number;
  vMs: number;
}

export interface RealWeatherSnapshot {
  status: "idle" | "loading" | "ready" | "unavailable";
  tempC: number | null;
  apparentTempC: number | null;
  windSpeedMs: number | null;
  windDirDeg: number | null;
  humidityPct: number | null;
  cloudCoverPct: number | null;
  soilTemp0Cm: number | null;
  observedAt?: string;
}

export interface LiveClimateSnapshot {
  status: "idle" | "loading" | "ready" | "unavailable";
  sourceMode?: "live" | "cached" | "demo_fixture";
  meanTempC?: number | null;
  minTempC?: number | null;
  maxTempC?: number | null;
  totalPrecipMm?: number | null;
  frostDays?: number | null;
  wetDays?: number | null;
  payloadSha256?: string;
}

export interface SelectedOrbitalLocation {
  lat: number;
  lon: number;
  label: string;
  presetId: string | null;
  filterMode: SatelliteFilterMode;
  polygon: Array<[number, number]>;
  areaHa: number;
}

export interface OrbitalEarthModuleProps {
  /** Initial focused latitude (defaults to Ganja, Azerbaijan: 40.68) */
  initialLat?: number;
  /** Initial focused longitude (defaults to Ganja, Azerbaijan: 46.36) */
  initialLon?: number;
  /** Initial UI language */
  language?: "en" | "az";
  /** Optional SpaceFarm backend API base URL (e.g. "http://127.0.0.1:8000" or "") */
  apiBaseUrl?: string;
  /** Callback fired whenever the user selects a location on the 3D Earth or synced Map */
  onLocationSelect?: (selection: SelectedOrbitalLocation) => void;
  /** Alias callback fired whenever the user selects a region/parcel */
  onRegionSelected?: (selection: SelectedOrbitalLocation) => void;
  /** Optional callback to proceed to the next screen (e.g. Field Intelligence / Climate) */
  onConfirmProceed?: (selection: SelectedOrbitalLocation) => void;
  /** Optional callback when user switches EN/AZ language inside the module HUD */
  onLanguageChange?: (language: "en" | "az") => void;
  /** Optional callback when satellite filter changes */
  onFilterChange?: (filter: SatelliteFilterMode) => void;
}
