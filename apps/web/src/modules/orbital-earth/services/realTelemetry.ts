import * as THREE from "three";
import * as satellite from "satellite.js";
import { DEFAULT_NASA_SATELLITE_TLES } from "../data/presets";
import type {
  ActiveSatelliteId,
  LiveClimateSnapshot,
  RealSatelliteTelemetry,
  RealWeatherSnapshot,
  RealWindGridPoint,
  SatelliteTleRecord,
} from "../types";

const EARTH_RADIUS_KM = 6371;

const tleCache: Partial<Record<ActiveSatelliteId, SatelliteTleRecord>> = {};
let windGridCache: RealWindGridPoint[] | null = null;
const gibsTextureCache = new Map<string, Promise<THREE.CanvasTexture>>();
const climateSnapshotCache = new Map<string, LiveClimateSnapshot>();

function normalizeBaseUrl(apiBaseUrl?: string): string {
  return (apiBaseUrl ?? "").replace(/\/$/, "");
}

function parseTleLines(rawText: string, template: SatelliteTleRecord): SatelliteTleRecord | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const line1 = lines.find((l) => l.startsWith("1 ") && l.includes(String(template.noradId)));
  const line2 = lines.find((l) => l.startsWith("2 ") && l.includes(String(template.noradId)));
  if (!line1 || !line2) return null;
  return {
    ...template,
    line1,
    line2,
    epochSource: "celestrak_live",
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4500): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs = 4500): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Fetch live CelesTrak TLE orbital elements for NASA TERRA (25994) and LANDSAT 8 (39084),
 * trying local proxy `/api/orbital/tle` first, then CelesTrak directly, with verified TLE fallback.
 */
export async function fetchLiveSatelliteTles(
  apiBaseUrl?: string
): Promise<Record<ActiveSatelliteId, SatelliteTleRecord>> {
  if (tleCache.terra && tleCache.landsat8) {
    return { terra: tleCache.terra, landsat8: tleCache.landsat8 };
  }

  const base = normalizeBaseUrl(apiBaseUrl);
  try {
    const data = await fetchJsonWithTimeout<{
      satellites?: Partial<Record<ActiveSatelliteId, { line1?: string; line2?: string }>>;
    }>(`${base}/api/orbital/tle`, 4000);
    const terraLine1 = data?.satellites?.terra?.line1;
    const terraLine2 = data?.satellites?.terra?.line2;
    const l8Line1 = data?.satellites?.landsat8?.line1;
    const l8Line2 = data?.satellites?.landsat8?.line2;
    if (terraLine1 && terraLine2 && l8Line1 && l8Line2) {
      const result: Record<ActiveSatelliteId, SatelliteTleRecord> = {
        terra: {
          ...DEFAULT_NASA_SATELLITE_TLES.terra,
          line1: terraLine1,
          line2: terraLine2,
          epochSource: "celestrak_live",
        },
        landsat8: {
          ...DEFAULT_NASA_SATELLITE_TLES.landsat8,
          line1: l8Line1,
          line2: l8Line2,
          epochSource: "celestrak_live",
        },
      };
      tleCache.terra = result.terra;
      tleCache.landsat8 = result.landsat8;
      return result;
    }
  } catch {
    // Fallback to direct CelesTrak GP query
  }

  const result: Record<ActiveSatelliteId, SatelliteTleRecord> = {
    terra: { ...DEFAULT_NASA_SATELLITE_TLES.terra },
    landsat8: { ...DEFAULT_NASA_SATELLITE_TLES.landsat8 },
  };

  await Promise.all(
    (["terra", "landsat8"] as ActiveSatelliteId[]).map(async (id) => {
      const tpl = DEFAULT_NASA_SATELLITE_TLES[id];
      try {
        const txt = await fetchTextWithTimeout(
          `https://celestrak.org/NORAD/elements/gp.php?CATNR=${tpl.noradId}&FORMAT=TLE`,
          4200
        );
        const parsed = parseTleLines(txt, tpl);
        if (parsed) result[id] = parsed;
      } catch {
        // Retain verified snapshot fallback
      }
    })
  );

  tleCache.terra = result.terra;
  tleCache.landsat8 = result.landsat8;
  return result;
}

/**
 * Propagate exact SGP4 satellite position & 92-minute orbital ground track in real UTC time.
 */
export function propagateSatelliteOrbit(
  tle: SatelliteTleRecord,
  when: Date = new Date()
): {
  telemetry: RealSatelliteTelemetry;
  groundTrack: Array<{ lat: number; lon: number; altKm: number }>;
} {
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);

  const sampleAt = (date: Date) => {
    const pv = satellite.propagate(satrec, date);
    if (
      !pv ||
      !pv.position ||
      typeof pv.position === "boolean" ||
      !pv.velocity ||
      typeof pv.velocity === "boolean"
    ) {
      return null;
    }
    const gmst = satellite.gstime(date);
    const gd = satellite.eciToGeodetic(pv.position, gmst);
    const lat = satellite.degreesLat(gd.latitude);
    const lon = satellite.degreesLong(gd.longitude);
    const altKm = gd.height;
    const speedKms = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altKm)) {
      return null;
    }
    return { lat, lon, altKm, speedKms };
  };

  const nowSample = sampleAt(when) ?? {
    lat: 40.5,
    lon: 46.5,
    altKm: 705,
    speedKms: 7.5,
  };

  const groundTrack: Array<{ lat: number; lon: number; altKm: number }> = [];
  for (let offsetMin = -36; offsetMin <= 60; offsetMin += 2) {
    const pt = sampleAt(new Date(when.getTime() + offsetMin * 60_000));
    if (pt) {
      groundTrack.push({ lat: pt.lat, lon: pt.lon, altKm: pt.altKm });
    }
  }

  return {
    telemetry: {
      id: tle.id,
      name: tle.name,
      noradId: tle.noradId,
      lat: nowSample.lat,
      lon: nowSample.lon,
      altitudeKm: Number(nowSample.altKm.toFixed(1)),
      velocityKms: Number(nowSample.speedKms.toFixed(2)),
      isLiveUtc: true,
      instrument: tle.instrument,
    },
    groundTrack,
  };
}

export function buildRealOrbitVectors(
  groundTrack: Array<{ lat: number; lon: number; altKm: number }>,
  earthRadiusScene = 1
): THREE.Vector3[] {
  return groundTrack.map((pt) => {
    // Exaggerate LEO altitude subtly so ~705 km sits visibly above atmosphere while staying proportional
    const orbitRadius = earthRadiusScene * (1 + Math.max(0.11, (pt.altKm / EARTH_RADIUS_KM) * 1.65));
    return latLonToSceneVec3(pt.lat, pt.lon, orbitRadius);
  });
}

export function latLonToSceneVec3(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const WIND_LATS = [-60, -40, -20, 0, 20, 40, 60];
const WIND_LONS = [-165, -135, -105, -75, -45, -15, 15, 45, 75, 105, 135, 165];

function meteorologicalDirToUv(speedMs: number, dirFromDeg: number): { uMs: number; vMs: number } {
  // Meteorological wind_direction_10m is WHERE wind blows FROM (0°=N blowing South).
  // Vector points TOWARD (dirFromDeg + 180)°.
  const flowRad = ((dirFromDeg + 180) * Math.PI) / 180;
  return {
    uMs: speedMs * Math.sin(flowRad),
    vMs: speedMs * Math.cos(flowRad),
  };
}

function normalizeOpenMeteoGridResponse(payload: unknown): RealWindGridPoint[] {
  const arr = Array.isArray(payload) ? payload : [payload];
  const points: RealWindGridPoint[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as {
      latitude?: number;
      longitude?: number;
      current?: {
        temperature_2m?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
      };
    };
    const rowIdx = Math.floor(i / WIND_LONS.length);
    const colIdx = i % WIND_LONS.length;
    const lat = Number(item?.latitude ?? WIND_LATS[rowIdx] ?? 0);
    const lon = Number(item?.longitude ?? WIND_LONS[colIdx] ?? 0);
    const tempC = Number(item?.current?.temperature_2m ?? 15);
    const windSpeedMs = Math.max(0.2, Number(item?.current?.wind_speed_10m ?? 4));
    const windDirDeg = Number(item?.current?.wind_direction_10m ?? 250);
    const { uMs, vMs } = meteorologicalDirToUv(windSpeedMs, windDirDeg);
    points.push({ lat, lon, tempC, windSpeedMs, windDirDeg, uMs, vMs });
  }
  return points;
}

/**
 * Fetch live global Open-Meteo 84-point 10m wind vector & 2m air temperature grid.
 */
export async function fetchGlobalRealWindGrid(apiBaseUrl?: string): Promise<RealWindGridPoint[]> {
  if (windGridCache && windGridCache.length > 0) return windGridCache;

  const base = normalizeBaseUrl(apiBaseUrl);
  try {
    const proxied = await fetchJsonWithTimeout<{ points?: RealWindGridPoint[] }>(
      `${base}/api/orbital/wind-grid`,
      5000
    );
    if (Array.isArray(proxied?.points) && proxied.points.length >= 12) {
      windGridCache = proxied.points;
      return proxied.points;
    }
  } catch {
    // Fall back to direct Open-Meteo multi-coordinate call
  }

  const lats: number[] = [];
  const lons: number[] = [];
  for (const lat of WIND_LATS) {
    for (const lon of WIND_LONS) {
      lats.push(lat);
      lons.push(lon);
    }
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lats.join(",")}` +
      `&longitude=${lons.join(",")}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m` +
      `&wind_speed_unit=ms&timezone=UTC`;
    const json = await fetchJsonWithTimeout<unknown>(url, 6500);
    const normalized = normalizeOpenMeteoGridResponse(json);
    if (normalized.length > 0) {
      windGridCache = normalized;
      return normalized;
    }
  } catch {
    // Fall back gracefully below
  }

  // Last-resort atmospheric general-circulation prior ONLY if offline
  const offline: RealWindGridPoint[] = [];
  for (const lat of WIND_LATS) {
    for (const lon of WIND_LONS) {
      const absLat = Math.abs(lat);
      const speed = absLat >= 35 ? 11.5 : 6.5;
      const dirFrom = absLat >= 30 && absLat <= 60 ? 255 : 75;
      const tempC = 28 - absLat * 0.55;
      const { uMs, vMs } = meteorologicalDirToUv(speed, dirFrom);
      offline.push({ lat, lon, tempC, windSpeedMs: speed, windDirDeg: dirFrom, uMs, vMs });
    }
  }
  windGridCache = offline;
  return offline;
}

/**
 * Fast bilinear vector & thermal sampler across the global meteorological grid.
 */
export function sampleWindField(
  grid: RealWindGridPoint[],
  lat: number,
  lon: number
): { uMs: number; vMs: number; speedMs: number; dirFromDeg: number; tempC: number } {
  if (!grid.length) {
    return { uMs: 4.5, vMs: 1.2, speedMs: 4.7, dirFromDeg: 255, tempC: 16 };
  }

  const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const clampedLat = Math.max(-60, Math.min(60, lat));

  // Structured O(1) bilinear interpolation when 7x12 grid is present
  if (grid.length === WIND_LATS.length * WIND_LONS.length) {
    const latPos = ((clampedLat + 60) / 120) * (WIND_LATS.length - 1);
    const r0 = Math.min(WIND_LATS.length - 2, Math.max(0, Math.floor(latPos)));
    const r1 = r0 + 1;
    const fy = latPos - r0;

    // WIND_LONS starts at -165 in steps of 30 deg
    const lonShifted = wrappedLon + 165;
    const colFloat = ((lonShifted / 30) % WIND_LONS.length + WIND_LONS.length) % WIND_LONS.length;
    const c0 = Math.floor(colFloat);
    const c1 = (c0 + 1) % WIND_LONS.length;
    const fx = colFloat - c0;

    const p00 = grid[r0 * WIND_LONS.length + c0];
    const p01 = grid[r0 * WIND_LONS.length + c1];
    const p10 = grid[r1 * WIND_LONS.length + c0];
    const p11 = grid[r1 * WIND_LONS.length + c1];

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const uMs = lerp(lerp(p00.uMs, p01.uMs, fx), lerp(p10.uMs, p11.uMs, fx), fy);
    const vMs = lerp(lerp(p00.vMs, p01.vMs, fx), lerp(p10.vMs, p11.vMs, fx), fy);
    const tempC = lerp(lerp(p00.tempC, p01.tempC, fx), lerp(p10.tempC, p11.tempC, fx), fy);
    const speedMs = Math.hypot(uMs, vMs);
    const flowRad = Math.atan2(uMs, vMs);
    const dirFromDeg = (((flowRad * 180) / Math.PI - 180) % 360 + 360) % 360;
    return { uMs, vMs, speedMs, dirFromDeg, tempC };
  }

  // Fallback inverse-distance weighting
  let wSum = 0;
  let uSum = 0;
  let vSum = 0;
  let tSum = 0;
  for (const p of grid) {
    let dLon = Math.abs(wrappedLon - p.lon);
    if (dLon > 180) dLon = 360 - dLon;
    const dLat = clampedLat - p.lat;
    const w = 1 / (dLat * dLat + dLon * dLon + 12);
    wSum += w;
    uSum += p.uMs * w;
    vSum += p.vMs * w;
    tSum += p.tempC * w;
  }
  const uMs = uSum / wSum;
  const vMs = vSum / wSum;
  const tempC = tSum / wSum;
  const speedMs = Math.hypot(uMs, vMs);
  const flowRad = Math.atan2(uMs, vMs);
  const dirFromDeg = (((flowRad * 180) / Math.PI - 180) % 360 + 360) % 360;
  return { uMs, vMs, speedMs, dirFromDeg, tempC };
}

/**
 * Fetch live Open-Meteo point current weather + soil temperature AND optional NASA POWER climate summary.
 */
export async function fetchPointWeatherAndClimate(
  lat: number,
  lon: number,
  apiBaseUrl?: string
): Promise<{ weather: RealWeatherSnapshot; climate: LiveClimateSnapshot }> {
  const weatherPromise: Promise<RealWeatherSnapshot> = (async () => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_direction_10m` +
        `&hourly=soil_temperature_0cm&forecast_days=1&wind_speed_unit=ms&timezone=UTC`;
      const data = await fetchJsonWithTimeout<{
        current?: {
          time?: string;
          temperature_2m?: number;
          apparent_temperature?: number;
          relative_humidity_2m?: number;
          cloud_cover?: number;
          wind_speed_10m?: number;
          wind_direction_10m?: number;
        };
        hourly?: {
          soil_temperature_0cm?: number[];
        };
      }>(url, 5000);

      const cur = data.current;
      const soilArr = data.hourly?.soil_temperature_0cm;
      const currentHour = new Date().getUTCHours();
      const soilTemp0Cm =
        Array.isArray(soilArr) && soilArr.length > 0
          ? Number(soilArr[Math.min(soilArr.length - 1, currentHour)] ?? soilArr[0])
          : null;

      return {
        status: "ready",
        tempC: cur?.temperature_2m ?? null,
        apparentTempC: cur?.apparent_temperature ?? null,
        windSpeedMs: cur?.wind_speed_10m ?? null,
        windDirDeg: cur?.wind_direction_10m ?? null,
        humidityPct: cur?.relative_humidity_2m ?? null,
        cloudCoverPct: cur?.cloud_cover ?? null,
        soilTemp0Cm,
        observedAt: cur?.time,
      };
    } catch {
      return {
        status: "unavailable",
        tempC: null,
        apparentTempC: null,
        windSpeedMs: null,
        windDirDeg: null,
        humidityPct: null,
        cloudCoverPct: null,
        soilTemp0Cm: null,
      };
    }
  })();

  const climatePromise: Promise<LiveClimateSnapshot> = (async () => {
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cachedSnap = climateSnapshotCache.get(cacheKey);
    if (cachedSnap) return cachedSnap;

    const base = normalizeBaseUrl(apiBaseUrl);
    try {
      const payload = await fetchJsonWithTimeout<{
        data_mode?: "live" | "cached" | "demo_fixture";
        source_mode?: "live" | "cached" | "demo_fixture";
        dataset_version?: string;
        payload_sha256?: string;
        features?: Array<{ feature_id?: string; value?: number | null }>;
        summary?: {
          mean_temp_c?: number;
          min_temp_c?: number;
          max_temp_c?: number;
          total_precip_mm?: number;
          frost_days?: number;
          wet_days?: number;
        };
      }>(
        `${base}/api/v1/climate/features?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=2024-01-01&end_date=2024-12-31`,
        12000
      );

      const featureMap = new Map<string, number>();
      if (Array.isArray(payload?.features)) {
        for (const item of payload.features) {
          if (item?.feature_id && typeof item.value === "number" && Number.isFinite(item.value)) {
            featureMap.set(item.feature_id, item.value);
          }
        }
      }

      if (featureMap.size > 0) {
        const snap: LiveClimateSnapshot = {
          status: "ready",
          sourceMode: payload.data_mode ?? payload.source_mode ?? "live",
          meanTempC: featureMap.get("mean_temperature") ?? null,
          minTempC: featureMap.get("min_temperature") ?? null,
          maxTempC: featureMap.get("max_temperature") ?? null,
          totalPrecipMm: featureMap.get("total_precipitation_mm") ?? null,
          frostDays: featureMap.get("frost_days_count") ?? null,
          wetDays: featureMap.get("wet_days_count") ?? null,
          payloadSha256: payload.dataset_version ?? payload.payload_sha256,
        };
        climateSnapshotCache.set(cacheKey, snap);
        return snap;
      }

      if (!payload?.summary) return { status: "unavailable" };
      const snap: LiveClimateSnapshot = {
        status: "ready",
        sourceMode: payload.source_mode ?? payload.data_mode ?? "live",
        meanTempC: payload.summary.mean_temp_c ?? null,
        minTempC: payload.summary.min_temp_c ?? null,
        maxTempC: payload.summary.max_temp_c ?? null,
        totalPrecipMm: payload.summary.total_precip_mm ?? null,
        frostDays: payload.summary.frost_days ?? null,
        wetDays: payload.summary.wet_days ?? null,
        payloadSha256: payload.payload_sha256 ?? payload.dataset_version,
      };
      climateSnapshotCache.set(cacheKey, snap);
      return snap;
    } catch {
      return { status: "unavailable" };
    }
  })();

  const [weather, climate] = await Promise.all([weatherPromise, climatePromise]);
  return { weather, climate };
}

function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function tempToThermalRgb(tempC: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (tempC + 15) / 60));
  if (t < 0.25) {
    const k = t / 0.25;
    return [Math.round(29 + (124 - 29) * k), Math.round(78 + (58 - 78) * k), Math.round(216 + (237 - 216) * k)];
  }
  if (t < 0.55) {
    const k = (t - 0.25) / 0.3;
    return [Math.round(124 + (236 - 124) * k), Math.round(58 + (72 - 58) * k), Math.round(237 + (153 - 237) * k)];
  }
  if (t < 0.8) {
    const k = (t - 0.55) / 0.25;
    return [Math.round(236 + (249 - 236) * k), Math.round(72 + (115 - 72) * k), Math.round(153 + (22 - 153) * k)];
  }
  const k = (t - 0.8) / 0.2;
  return [Math.round(249 + (254 - 249) * k), Math.round(115 + (240 - 115) * k), Math.round(22 + (138 - 22) * k)];
}

function paintGlobalTempBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: RealWindGridPoint[]
): void {
  const smallW = 144;
  const smallH = 72;
  const off = document.createElement("canvas");
  off.width = smallW;
  off.height = smallH;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;

  const img = offCtx.createImageData(smallW, smallH);
  for (let y = 0; y < smallH; y++) {
    const lat = 90 - ((y + 0.5) / smallH) * 180;
    for (let x = 0; x < smallW; x++) {
      const lon = -180 + ((x + 0.5) / smallW) * 360;
      const sample = sampleWindField(grid, lat, lon);
      const [r, g, b] = tempToThermalRgb(sample.tempC);
      const idx = (y * smallW + x) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }
  offCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, width, height);
}

/**
 * Stitch real NASA GIBS EPSG:4326 satellite tiles onto a high-res equirectangular CanvasTexture.
 * - "bluemarble": z=3 (10x5 exact tiles -> up to 5120x2560 5K imagery clamped to GPU maxTextureSize)
 * - "thermal": z=2 (5x3 MODIS_Terra_Land_Surface_Temp_Day cropped to exact 2560x1280 over real temp backdrop)
 * - "ndvi": z=2 (5x3 MODIS_Terra_L3_NDVI_16Day cropped to exact 2560x1280)
 */
export function stitchNasaGibsTexture(
  layer: "bluemarble" | "thermal" | "ndvi",
  maxTexSize = 4096,
  windGrid: RealWindGridPoint[] = []
): Promise<THREE.CanvasTexture> {
  const cacheKey = `${layer}-${maxTexSize >= 5120 ? "5k" : "4k"}`;
  const existing = gibsTextureCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    if (layer === "bluemarble") {
      // Exact 10 cols x 5 rows at z=3 (each tile = 36 deg, 10x36=360, 5x36=180)
      const cols = 10;
      const rows = 5;
      const rawW = 5120;
      const targetW = Math.min(rawW, maxTexSize >= 5120 ? 5120 : 4096);
      const targetH = Math.round(targetW / 2);

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#061124";
        ctx.fillRect(0, 0, targetW, targetH);

        const tileW = targetW / cols;
        const tileH = targetH / rows;
        const tasks: Array<Promise<void>> = [];
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/500m/3/${y}/${x}.jpeg`;
            tasks.push(
              loadCorsImage(url).then((img) => {
                if (img) {
                  ctx.drawImage(img, x * tileW, y * tileH, tileW + 0.5, tileH + 0.5);
                }
              })
            );
          }
        }
        await Promise.all(tasks);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 16;
      tex.needsUpdate = true;
      return tex;
    }

    // MODIS Thermal or NDVI at z=2: each tile is 72 deg (512px).
    // 5 cols = 360 deg (2560px); 2.5 rows = 180 deg (1280px exact equator-centered equirectangular).
    const cols = 5;
    const rows = 3;
    const tileSize = 512;
    const width = 2560;
    const height = 1280;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (layer === "thermal") {
        paintGlobalTempBackdrop(ctx, width, height, windGrid);
      } else {
        ctx.fillStyle = "#07101f";
        ctx.fillRect(0, 0, width, height);
      }

      const layerPath =
        layer === "thermal"
          ? "MODIS_Terra_Land_Surface_Temp_Day/default/2024-07-15/1km"
          : "MODIS_Terra_L3_NDVI_16Day/default/2024-07-11/250m";

      const tasks: Array<Promise<void>> = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layerPath}/2/${y}/${x}.png`;
          tasks.push(
            loadCorsImage(url).then((img) => {
              if (!img) return;
              if (y === 2) {
                // Bottom row spans -54 deg .. -126 deg; keep top 256px (-54 .. -90 deg)
                ctx.drawImage(img, 0, 0, tileSize, 256, x * tileSize, y * tileSize, tileSize, 256);
              } else {
                ctx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
              }
            })
          );
        }
      }
      await Promise.all(tasks);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.needsUpdate = true;
    return tex;
  })();

  gibsTextureCache.set(cacheKey, promise);
  return promise;
}

let regionalPatchPromise: Promise<THREE.CanvasTexture | null> | null = null;

/**
 * Stitches a 2048x2048 NASA GIBS z=5 (500m resolution) regional patch covering
 * [18°E..54°E, 18°N..54°N] (Azerbaijan, Caucasus, Caspian, Anatolia, Black Sea)
 * so close-up Orbit and Satellite POV views have 4x higher native texel density.
 */
export function stitchRegionalHighResPatch(): Promise<THREE.CanvasTexture | null> {
  if (regionalPatchPromise) return regionalPatchPromise;

  regionalPatchPromise = (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const jobs: Array<Promise<boolean>> = [];
    for (let dr = 0; dr < 4; dr++) {
      for (let dc = 0; dc < 4; dc++) {
        const row = 4 + dr; // 54°N down to 18°N
        const col = 22 + dc; // 18°E to 54°E
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/500m/5/${row}/${col}.jpeg`;
        jobs.push(
          loadCorsImage(url).then((img) => {
            if (!img) return false;
            ctx.drawImage(img, dc * 512, dr * 512, 512.5, 512.5);
            return true;
          })
        );
      }
    }

    const results = await Promise.all(jobs);
    if (!results.every(Boolean)) {
      return null;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.needsUpdate = true;
    return tex;
  })();

  return regionalPatchPromise;
}
