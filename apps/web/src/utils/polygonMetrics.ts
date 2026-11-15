export type LatLonTuple = [number, number];

/**
 * Create a draggable starter 4-corner parcel polygon centered around (lat, lon).
 */
export function buildParcelAroundPoint(
  lat: number,
  lon: number,
  deltaDeg = 0.0042,
): LatLonTuple[] {
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLon = deltaDeg / cosLat;
  return [
    [Number((lat + deltaDeg * 0.72).toFixed(5)), Number((lon - dLon * 0.85).toFixed(5))],
    [Number((lat + deltaDeg * 0.95).toFixed(5)), Number((lon + dLon * 0.65).toFixed(5))],
    [Number((lat - deltaDeg * 0.55).toFixed(5)), Number((lon + dLon * 0.95).toFixed(5))],
    [Number((lat - deltaDeg * 0.88).toFixed(5)), Number((lon - dLon * 0.62).toFixed(5))],
  ];
}

/**
 * Compute geodesic spherical-excess area in hectares (minimum 0.1 ha for >= 3 vertices).
 */
export function computeGeodesicAreaHa(latlngs: ReadonlyArray<LatLonTuple>): number {
  if (latlngs.length < 3) return 0;
  const earthRadiusM = 6378137;
  let areaRad = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % latlngs.length];
    const lat1 = (p1[0] * Math.PI) / 180;
    const lon1 = (p1[1] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lon2 = (p2[1] * Math.PI) / 180;
    areaRad += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  const areaM2 = Math.abs((areaRad * earthRadiusM * earthRadiusM) / 2);
  return Math.max(0.1, Number((areaM2 / 10000).toFixed(1)));
}

/**
 * Compute polygon centroid [lat, lon] (4 decimal precision) for parcel coordinates.
 */
export function computePolygonCentroid(latlngs: ReadonlyArray<LatLonTuple>): LatLonTuple | null {
  if (latlngs.length < 3) return null;
  let sumLat = 0;
  let sumLon = 0;
  for (const [lat, lon] of latlngs) {
    sumLat += lat;
    sumLon += lon;
  }
  return [
    Number((sumLat / latlngs.length).toFixed(4)),
    Number((sumLon / latlngs.length).toFixed(4)),
  ];
}

/**
 * Insert a new corner vertex at the midpoint of the longest polygon edge.
 */
export function splitLongestPolygonEdge(latlngs: ReadonlyArray<LatLonTuple>): LatLonTuple[] {
  if (latlngs.length < 3) return [...latlngs];
  let bestIdx = 0;
  let bestDistSq = -1;
  for (let i = 0; i < latlngs.length; i++) {
    const a = latlngs[i];
    const b = latlngs[(i + 1) % latlngs.length];
    const cosLat = Math.max(0.2, Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180));
    const dLat = b[0] - a[0];
    const dLon = (b[1] - a[1]) * cosLat;
    const dSq = dLat * dLat + dLon * dLon;
    if (dSq > bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  const a = latlngs[bestIdx];
  const b = latlngs[(bestIdx + 1) % latlngs.length];
  const midpoint: LatLonTuple = [
    Number(((a[0] + b[0]) / 2).toFixed(5)),
    Number(((a[1] + b[1]) / 2).toFixed(5)),
  ];
  const next = [...latlngs];
  next.splice(bestIdx + 1, 0, midpoint);
  return next;
}
