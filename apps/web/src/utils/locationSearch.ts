import { AZ_DISTRICTS } from "../data/azDistricts";

export type ParsedLocationInput =
  | {
      kind: "coordinates";
      lat: number;
      lon: number;
      label?: string;
      source: "coords" | "dms" | "maps_url" | "geo_uri" | "osm_url";
    }
  | {
      kind: "short_url";
      url: string;
    }
  | {
      kind: "invalid";
      reason: "out_of_range" | "malformed_url";
    }
  | {
      kind: "place_query";
      query: string;
    };

export interface GlobalGeocodeResult {
  id: string;
  name: string;
  nameAz?: string | null;
  admin1?: string | null;
  admin1Az?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lat: number;
  lon: number;
  elevationM?: number | null;
  population?: number | null;
  presetId?: string | null;
  source: "az_district" | "open_meteo" | "google_maps_link";
}

export interface GlobalGeocodeResponse {
  query: string;
  kind: "results" | "resolved_link" | "empty";
  resolvedUrl?: string;
  sourceStatus?: "live" | "cached" | "local_only";
  results: GlobalGeocodeResult[];
}

function isValidLatLon(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function normalizeTextForParsing(raw: string): string {
  return raw
    .trim()
    .replace(/[\u00BA\u02DA]/g, "°")
    .replace(/[\u2032\u2019\u2018`]/g, "'")
    .replace(/[\u2033\u201C\u201D]/g, '"')
    .replace(/\uFF0C/g, ",");
}

export function foldSearchText(text: string): string {
  return text
    .replace(/[əƏ]/g, "e")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function formatLatLon(lat: number, lon: number, decimals = 4): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(decimals)}°${latDir}, ${Math.abs(lon).toFixed(decimals)}°${lonDir}`;
}

export function extractGoogleMapsPlaceName(urlStr: string): string | undefined {
  const match = urlStr.match(/\/maps\/(?:place|search)\/([^/@?#]+)/i);
  if (!match?.[1]) return undefined;
  try {
    const decoded = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
    if (!decoded || /^@-?\d/.test(decoded)) return undefined;
    // Ignore raw coordinate strings masquerading as place path
    if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(decoded)) return undefined;
    return decoded;
  } catch {
    return undefined;
  }
}

export function isShortMapsUrl(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  const match = trimmed.match(
    /^(?:https?:\/\/)?((?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/maps)\/[^\s]+)$/i
  );
  if (!match?.[1]) return null;
  return `https://${match[1]}`;
}

function tryParseLatLonPair(
  aRaw: string,
  bRaw: string,
  swapOrder = false
): { lat: number; lon: number; outOfRange?: boolean } | null {
  const a = Number(aRaw);
  const b = Number(bRaw);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const lat = swapOrder ? b : a;
  const lon = swapOrder ? a : b;
  if (!isValidLatLon(lat, lon)) {
    return { lat, lon, outOfRange: true };
  }
  return {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
  };
}

function parseDmsCoordinateToken(token: string): {
  value: number;
  axis: "lat" | "lon" | null;
} | null {
  const cleaned = token
    .trim()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
  if (!cleaned) return null;

  let hemi: string | null = null;
  let body = cleaned;

  const prefixHemi = body.match(/^([NSEW])\s+(.+)$/i);
  const suffixHemi = body.match(/^(.+?)\s*([NSEW])$/i);
  if (prefixHemi) {
    hemi = prefixHemi[1].toUpperCase();
    body = prefixHemi[2].trim();
  } else if (suffixHemi) {
    body = suffixHemi[1].trim();
    hemi = suffixHemi[2].toUpperCase();
  }

  let axis: "lat" | "lon" | null = null;
  if (hemi === "N" || hemi === "S") axis = "lat";
  if (hemi === "E" || hemi === "W") axis = "lon";

  // Must contain DMS delimiters (deg, min, sec) OR hemisphere with multiple segments
  const hasDmsMarks = /[°'"]/.test(body);
  const dmsMatch = body.match(
    /^([+-]?\d+(?:\.\d+)?)\s*(?:°|\s)\s*(\d+(?:\.\d+)?)?\s*(?:'|\s)?\s*(\d+(?:\.\d+)?)?\s*"?$/
  );
  if (!dmsMatch) return null;

  const hasMinutes = dmsMatch[2] !== undefined;
  const hasSeconds = dmsMatch[3] !== undefined;
  if (!hasDmsMarks && !hasMinutes) return null;

  const degSigned = Number(dmsMatch[1]);
  const mins = hasMinutes ? Number(dmsMatch[2]) : 0;
  const secs = hasSeconds ? Number(dmsMatch[3]) : 0;
  if (!Number.isFinite(degSigned) || !Number.isFinite(mins) || !Number.isFinite(secs)) {
    return null;
  }
  if (mins < 0 || mins >= 60 || secs < 0 || secs >= 60) return null;

  const sign = degSigned < 0 ? -1 : 1;
  let decimal = sign * (Math.abs(degSigned) + mins / 60 + secs / 3600);
  if (hemi === "S" || hemi === "W") {
    decimal = -Math.abs(decimal);
  } else if (hemi === "N" || hemi === "E") {
    decimal = Math.abs(decimal);
  }

  return { value: Number(decimal.toFixed(6)), axis };
}

function parseDmsPair(input: string): ParsedLocationInput | null {
  // Split two DMS tokens separated by comma, semicolon, or hemisphere boundary
  let parts: string[] = [];
  if (input.includes(",") || input.includes(";")) {
    parts = input
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    const hemiSplit = input.match(/^(.+?[NSEW])[\s]+(.+?[NSEW])$/i);
    if (hemiSplit) {
      parts = [hemiSplit[1].trim(), hemiSplit[2].trim()];
    } else {
      const degSplit = input.match(/^([+-]?\d+°[^°]+)\s+([+-]?\d+°.+)$/);
      if (degSplit) {
        parts = [degSplit[1].trim(), degSplit[2].trim()];
      }
    }
  }

  if (parts.length !== 2) return null;
  const first = parseDmsCoordinateToken(parts[0]);
  const second = parseDmsCoordinateToken(parts[1]);
  if (!first || !second) return null;

  let lat = first.value;
  let lon = second.value;
  if (first.axis === "lon" && second.axis === "lat") {
    lat = second.value;
    lon = first.value;
  } else if (
    (first.axis && first.axis === second.axis) ||
    !isValidLatLon(lat, lon)
  ) {
    return { kind: "invalid", reason: "out_of_range" };
  }

  return {
    kind: "coordinates",
    lat,
    lon,
    source: "dms",
  };
}

function parseDecimalPair(input: string): ParsedLocationInput | null {
  // Strip explicit "lat:" / "lon:" labels
  const stripped = input
    .replace(/\b(?:lat(?:itude)?|enlik)\s*[:=]\s*/gi, "")
    .replace(/\b(?:lon(?:g(?:itude)?)?|lng|uzunluq)\s*[:=]\s*/gi, "")
    .trim();

  const pairMatch = stripped.match(
    /^([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSnsEWew])?\s*[,;\s]+\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSnsEWew])?$/
  );
  if (!pairMatch) return null;

  // Avoid catching two integer words unless clearly decimal/signed/degree/hemisphere or separated by comma
  const hasDecimalOrSignOrMarker =
    /[.,°+-]|[NSEW]/i.test(stripped);
  if (!hasDecimalOrSignOrMarker) return null;

  const val1 = Number(pairMatch[1]);
  const h1 = pairMatch[2]?.toUpperCase() ?? null;
  const val2 = Number(pairMatch[3]);
  const h2 = pairMatch[4]?.toUpperCase() ?? null;

  if (!Number.isFinite(val1) || !Number.isFinite(val2)) return null;

  const applyHemi = (val: number, h: string | null) =>
    h === "S" || h === "W" ? -Math.abs(val) : h === "N" || h === "E" ? Math.abs(val) : val;

  let lat = applyHemi(val1, h1);
  let lon = applyHemi(val2, h2);

  if ((h1 === "E" || h1 === "W") && (h2 === "N" || h2 === "S")) {
    lat = applyHemi(val2, h2);
    lon = applyHemi(val1, h1);
  } else if (h1 && h2 && ((h1 === "N" || h1 === "S") === (h2 === "N" || h2 === "S"))) {
    return { kind: "invalid", reason: "out_of_range" };
  }

  if (!isValidLatLon(lat, lon)) {
    return { kind: "invalid", reason: "out_of_range" };
  }

  return {
    kind: "coordinates",
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    source: "coords",
  };
}

function parseMapOrGeoUrl(input: string): ParsedLocationInput | null {
  // Extract URL token if pasted alongside descriptive text
  const geoMatch = input.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[?;].*)?$/i);
  if (geoMatch) {
    const parsed = tryParseLatLonPair(geoMatch[1], geoMatch[2]);
    if (!parsed || parsed.outOfRange) {
      return { kind: "invalid", reason: "out_of_range" };
    }
    return {
      kind: "coordinates",
      lat: parsed.lat,
      lon: parsed.lon,
      source: "geo_uri",
    };
  }

  const urlMatch = input.match(/(https?:\/\/[^\s]+|(?:www\.)?(?:google\.com|maps\.google\.com|openstreetmap\.org|maps\.apple\.com|bing\.com|yandex\.[a-z.]+)\/[^\s]+)/i);
  if (!urlMatch?.[1]) return null;

  let rawUrl = urlMatch[1];
  if (!/^https?:\/\//i.test(rawUrl)) {
    rawUrl = `https://${rawUrl}`;
  }

  const shortUrl = isShortMapsUrl(rawUrl);
  if (shortUrl) {
    return { kind: "short_url", url: shortUrl };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { kind: "invalid", reason: "malformed_url" };
  }

  const fullUrl = parsedUrl.toString();
  const label = extractGoogleMapsPlaceName(fullUrl);
  const host = parsedUrl.hostname.toLowerCase();
  const isYandex = host.includes("yandex.");

  // 1. Google Maps exact pin (!3d<lat>!4d<lon>) — take the LAST match so pinned spot beats viewport center
  const pinMatches = Array.from(
    fullUrl.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)
  );
  if (pinMatches.length > 0) {
    const lastPin = pinMatches[pinMatches.length - 1];
    const coords = tryParseLatLonPair(lastPin[1], lastPin[2]);
    if (coords && !coords.outOfRange) {
      return {
        kind: "coordinates",
        lat: coords.lat,
        lon: coords.lon,
        label,
        source: "maps_url",
      };
    }
    if (coords?.outOfRange) {
      return { kind: "invalid", reason: "out_of_range" };
    }
  }

  // 2. OpenStreetMap hash (#map=zoom/lat/lon)
  const osmHash = parsedUrl.hash.match(
    /#map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/i
  );
  if (osmHash) {
    const coords = tryParseLatLonPair(osmHash[1], osmHash[2]);
    if (coords && !coords.outOfRange) {
      return {
        kind: "coordinates",
        lat: coords.lat,
        lon: coords.lon,
        source: "osm_url",
      };
    }
    return { kind: "invalid", reason: "out_of_range" };
  }

  // 3. Query params (q, query, ll, center, destination, sll, mlat/mlon, lat/lon, cp)
  const sp = parsedUrl.searchParams;
  const mlat = sp.get("mlat") ?? sp.get("lat");
  const mlon = sp.get("mlon") ?? sp.get("lon") ?? sp.get("lng");
  if (mlat && mlon) {
    const coords = tryParseLatLonPair(mlat, mlon);
    if (coords && !coords.outOfRange) {
      return {
        kind: "coordinates",
        lat: coords.lat,
        lon: coords.lon,
        label: label ?? (sp.get("q") || undefined),
        source: host.includes("openstreetmap") ? "osm_url" : "maps_url",
      };
    }
    if (coords?.outOfRange) {
      return { kind: "invalid", reason: "out_of_range" };
    }
  }

  const bingCp = sp.get("cp");
  if (bingCp) {
    const cpMatch = bingCp.match(/^(-?\d+(?:\.\d+)?)~(-?\d+(?:\.\d+)?)$/);
    if (cpMatch) {
      const coords = tryParseLatLonPair(cpMatch[1], cpMatch[2]);
      if (coords && !coords.outOfRange) {
        return {
          kind: "coordinates",
          lat: coords.lat,
          lon: coords.lon,
          source: "maps_url",
        };
      }
    }
  }

  for (const paramKey of ["q", "query", "destination", "ll", "center", "sll", "pt"]) {
    const val = sp.get(paramKey);
    if (!val) continue;
    const coordInParam = val.match(
      /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)(?:\s|$)/
    );
    if (coordInParam) {
      const swap = isYandex && (paramKey === "ll" || paramKey === "pt");
      const coords = tryParseLatLonPair(coordInParam[1], coordInParam[2], swap);
      if (coords && !coords.outOfRange) {
        return {
          kind: "coordinates",
          lat: coords.lat,
          lon: coords.lon,
          label,
          source: "maps_url",
        };
      }
      if (coords?.outOfRange) {
        return { kind: "invalid", reason: "out_of_range" };
      }
    }
  }

  // 4. Google Maps viewport @lat,lon fallback
  const atMatch = fullUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[,/]|$)/);
  if (atMatch) {
    const coords = tryParseLatLonPair(atMatch[1], atMatch[2]);
    if (coords && !coords.outOfRange) {
      return {
        kind: "coordinates",
        lat: coords.lat,
        lon: coords.lon,
        label,
        source: "maps_url",
      };
    }
    if (coords?.outOfRange) {
      return { kind: "invalid", reason: "out_of_range" };
    }
  }

  // 5. No numeric coords found in Maps URL -> fall back to extracted place name if present
  const qFallback = label ?? sp.get("q") ?? sp.get("query");
  if (qFallback && qFallback.trim().length >= 2) {
    return {
      kind: "place_query",
      query: qFallback.trim(),
    };
  }

  return { kind: "invalid", reason: "malformed_url" };
}

/**
 * Synchronously parse pasted coordinates, DMS strings, geo URIs, OSM links,
 * or Google Maps URLs into exact WGS-84 lat/lon, short-link requests, or place queries.
 */
export function parseCoordinateOrMapLink(rawInput: string): ParsedLocationInput {
  const normalized = normalizeTextForParsing(rawInput);
  if (!normalized) {
    return { kind: "place_query", query: "" };
  }

  const shortUrl = isShortMapsUrl(normalized);
  if (shortUrl) {
    return { kind: "short_url", url: shortUrl };
  }

  const mapParsed = parseMapOrGeoUrl(normalized);
  if (mapParsed) {
    return mapParsed;
  }

  const dmsParsed = parseDmsPair(normalized);
  if (dmsParsed) {
    return dmsParsed;
  }

  const decParsed = parseDecimalPair(normalized);
  if (decParsed) {
    return decParsed;
  }

  return { kind: "place_query", query: normalized };
}

function matchFieldTier(qFold: string, candidate: string): number | null {
  if (!candidate) return null;
  if (candidate === qFold) return 0;
  if (candidate.startsWith(qFold)) return 1;
  if (
    candidate.includes(` ${qFold}`) ||
    candidate.includes(`-${qFold}`) ||
    candidate.includes(`/${qFold}`)
  ) {
    return 2;
  }
  return null;
}

interface ScoredAzDistrict {
  score: number;
  item: GlobalGeocodeResult;
}

function scoreLocalAzDistricts(query: string, limit = 5): ScoredAzDistrict[] {
  const qFold = foldSearchText(query);
  if (qFold.length < 2) return [];

  const scored: ScoredAzDistrict[] = [];
  for (const d of AZ_DISTRICTS) {
    const nameCandidates = [
      foldSearchText(d.nameEn),
      foldSearchText(d.nameAz),
      foldSearchText(d.id),
    ];
    const regionCandidates = [
      foldSearchText(d.economicRegionEn),
      foldSearchText(d.economicRegionAz),
    ];

    let best = 99;
    for (const c of nameCandidates) {
      const tier = matchFieldTier(qFold, c);
      if (tier !== null) best = Math.min(best, tier);
    }

    // Region matches rank below city/district hits; mid-word substrings are never matched.
    if (best > 2) {
      for (const c of regionCandidates) {
        const tier = matchFieldTier(qFold, c);
        if (tier !== null) best = Math.min(best, 4 + tier);
      }
    }

    if (best < 99) {
      scored.push({
        score: best,
        item: {
          id: `az:${d.id}`,
          name: d.nameEn,
          nameAz: d.nameAz,
          admin1: d.economicRegionEn,
          admin1Az: d.economicRegionAz,
          country: "Azerbaijan",
          countryCode: "AZ",
          lat: d.lat,
          lon: d.lon,
          elevationM: d.elevationM,
          presetId: d.id,
          source: "az_district",
        },
      });
    }
  }

  scored.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit);
}

export function searchLocalAzDistricts(query: string, limit = 5): GlobalGeocodeResult[] {
  return scoreLocalAzDistricts(query, limit).map((entry) => entry.item);
}

export function mergeGeocodeResults(
  localScored: ScoredAzDistrict[],
  omHits: GlobalGeocodeResult[],
  limit = 8
): GlobalGeocodeResult[] {
  const azExact = localScored.filter((entry) => entry.score === 0).map((e) => e.item);
  const azPrefix = localScored
    .filter((entry) => entry.score >= 1 && entry.score <= 2)
    .map((e) => e.item);
  const azRegion = localScored.filter((entry) => entry.score >= 4).map((e) => e.item);

  const merged: GlobalGeocodeResult[] = [];
  const appendUnique = (items: GlobalGeocodeResult[]) => {
    for (const hit of items) {
      if (merged.length >= limit) return;
      const duplicate = merged.some(
        (m) => Math.hypot(m.lat - hit.lat, m.lon - hit.lon) < 0.08
      );
      if (!duplicate) merged.push(hit);
    }
  };

  appendUnique(azExact);
  appendUnique(omHits);
  appendUnique(azPrefix);
  appendUnique(azRegion);
  return merged.slice(0, limit);
}

interface RawGeocodeApiResponse {
  query?: string;
  kind?: "results" | "resolved_link" | "empty";
  resolved_url?: string;
  source_status?: "live" | "cached" | "local_only";
  results?: Array<{
    id: string;
    name: string;
    name_az?: string | null;
    admin1?: string | null;
    admin1_az?: string | null;
    country?: string | null;
    country_code?: string | null;
    lat: number;
    lon: number;
    elevation_m?: number | null;
    population?: number | null;
    preset_id?: string | null;
    source: "az_district" | "open_meteo" | "google_maps_link";
  }>;
}

function mapRawResults(raw: RawGeocodeApiResponse): GlobalGeocodeResponse {
  return {
    query: raw.query ?? "",
    kind: raw.kind ?? (raw.results?.length ? "results" : "empty"),
    resolvedUrl: raw.resolved_url,
    sourceStatus: raw.source_status ?? "live",
    results: (raw.results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      nameAz: r.name_az ?? null,
      admin1: r.admin1 ?? null,
      admin1Az: r.admin1_az ?? null,
      country: r.country ?? null,
      countryCode: r.country_code ?? null,
      lat: Number(r.lat),
      lon: Number(r.lon),
      elevationM: r.elevation_m ?? null,
      population: r.population ?? null,
      presetId: r.preset_id ?? null,
      source: r.source,
    })),
  };
}

/**
 * Search global cities/regions or resolve shortened Google Maps share URLs
 * via SpaceFarm backend `/api/orbital/geocode`, with direct Open-Meteo + local AZ fallback.
 */
export async function searchGlobalLocations(
  query: string,
  apiBaseUrl?: string,
  signal?: AbortSignal
): Promise<GlobalGeocodeResponse> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { query: trimmed, kind: "empty", results: [] };
  }

  const base = (apiBaseUrl ?? "").replace(/\/$/, "");
  try {
    const res = await fetch(
      `${base}/api/orbital/geocode?q=${encodeURIComponent(trimmed)}`,
      { signal }
    );
    if (res.ok) {
      const payload = (await res.json()) as RawGeocodeApiResponse;
      return mapRawResults(payload);
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw err;
    }
  }

  // Direct client-side fallback when backend proxy is unavailable (except short Google Maps URLs)
  if (isShortMapsUrl(trimmed)) {
    return { query: trimmed, kind: "empty", sourceStatus: "local_only", results: [] };
  }

  const localScored = scoreLocalAzDistricts(trimmed, 5);
  const localHits = localScored.map((entry) => entry.item).slice(0, 4);
  try {
    const omRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=6&language=en&format=json`,
      { signal }
    );
    if (omRes.ok) {
      const omData = (await omRes.json()) as {
        results?: Array<{
          id: number;
          name: string;
          admin1?: string;
          country?: string;
          country_code?: string;
          latitude: number;
          longitude: number;
          elevation?: number;
          population?: number;
        }>;
      };
      const omHits: GlobalGeocodeResult[] = (omData.results ?? []).map((item) => ({
        id: `om:${item.id}`,
        name: item.name,
        admin1: item.admin1 ?? null,
        country: item.country ?? null,
        countryCode: item.country_code ?? null,
        lat: Number(item.latitude),
        lon: Number(item.longitude),
        elevationM: typeof item.elevation === "number" ? item.elevation : null,
        population: typeof item.population === "number" ? item.population : null,
        presetId: null,
        source: "open_meteo",
      }));

      const merged = mergeGeocodeResults(localScored, omHits, 8);
      return {
        query: trimmed,
        kind: merged.length ? "results" : "empty",
        sourceStatus: "live",
        results: merged,
      };
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw err;
    }
  }

  return {
    query: trimmed,
    kind: localHits.length ? "results" : "empty",
    sourceStatus: "local_only",
    results: localHits,
  };
}
