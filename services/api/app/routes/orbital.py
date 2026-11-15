"""Real orbital TLE & global Open-Meteo wind-grid proxy routes with TTL caching and graceful fallbacks."""

from __future__ import annotations

import asyncio
import math
import re
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, unquote_plus, urljoin, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/orbital", tags=["orbital-telemetry"])

WIND_LATS: tuple[int, ...] = (-60, -40, -20, 0, 20, 40, 60)
WIND_LONS: tuple[int, ...] = (-165, -135, -105, -75, -45, -15, 15, 45, 75, 105, 135, 165)

VERIFIED_TLE_SNAPSHOTS: dict[str, dict[str, Any]] = {
    "terra": {
        "norad_id": 25994,
        "name": "NASA TERRA (EOS AM-1)",
        "line1": "1 25994U 99068A   26318.26383354  .00000353  00000+0  80719-4 0  9994",
        "line2": "2 25994  97.9264   1.7139 0003548 108.2320 317.4647 14.61197239431525",
    },
    "landsat8": {
        "norad_id": 39084,
        "name": "NASA / USGS LANDSAT 8",
        "line1": "1 39084U 13008A   26318.27434811  .00000312  00000+0  79395-4 0  9998",
        "line2": "2 39084  98.2147  26.4936 0001223  90.5627 269.5712 14.57111824719759",
    },
}

_TLE_CACHE: dict[str, Any] = {"expires_at": 0.0, "payload": None}
_WIND_CACHE: dict[str, Any] = {"expires_at": 0.0, "payload": None}
_ELEV_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def _meteorological_dir_to_uv(speed_ms: float, dir_from_deg: float) -> tuple[float, float]:
    """Convert meteorological wind-from angle to eastward (u) and northward (v) components."""
    flow_rad = math.radians(dir_from_deg + 180.0)
    return speed_ms * math.sin(flow_rad), speed_ms * math.cos(flow_rad)


def _fallback_wind_grid() -> list[dict[str, float]]:
    """Build deterministic 84-point circulation prior when Open-Meteo is unreachable."""
    points: list[dict[str, float]] = []
    for lat in WIND_LATS:
        for lon in WIND_LONS:
            abs_lat = abs(lat)
            speed = 11.5 if abs_lat >= 35 else 6.5
            dir_from = 255.0 if 30 <= abs_lat <= 60 else 75.0
            temp_c = 28.0 - abs_lat * 0.55
            u_ms, v_ms = _meteorological_dir_to_uv(speed, dir_from)
            points.append(
                {
                    "lat": float(lat),
                    "lon": float(lon),
                    "tempC": round(temp_c, 2),
                    "windSpeedMs": round(speed, 2),
                    "windDirDeg": round(dir_from, 1),
                    "uMs": round(u_ms, 3),
                    "vMs": round(v_ms, 3),
                }
            )
    return points


def _parse_tle_text(raw: str) -> tuple[str, str] | None:
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    line1 = next((ln for ln in lines if ln.startswith("1 ")), None)
    line2 = next((ln for ln in lines if ln.startswith("2 ")), None)
    if line1 and line2 and len(line1) >= 60 and len(line2) >= 60:
        return line1, line2
    return None


@router.get("/tle", summary="Fetch live CelesTrak SGP4 TLEs for NASA TERRA and LANDSAT 8")
async def get_orbital_tle() -> dict[str, Any]:
    now_ts = time.monotonic()
    if _TLE_CACHE["payload"] is not None and now_ts < _TLE_CACHE["expires_at"]:
        return _TLE_CACHE["payload"]

    satellites = {k: dict(v) for k, v in VERIFIED_TLE_SNAPSHOTS.items()}
    live_count = 0

    async with httpx.AsyncClient(timeout=4.5) as client:
        async def _fetch_one(key: str, norad_id: int) -> None:
            nonlocal live_count
            try:
                resp = await client.get(
                    f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad_id}&FORMAT=TLE"
                )
                if resp.status_code == 200:
                    parsed = _parse_tle_text(resp.text)
                    if parsed:
                        satellites[key]["line1"] = parsed[0]
                        satellites[key]["line2"] = parsed[1]
                        live_count += 1
            except Exception:
                pass

        await asyncio.gather(
            _fetch_one("terra", 25994),
            _fetch_one("landsat8", 39084),
        )

    payload = {
        "satellites": satellites,
        "source": "celestrak_live" if live_count > 0 else "celestrak_verified_snapshot",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    ttl = 6 * 3600 if live_count > 0 else 10 * 60
    _TLE_CACHE["payload"] = payload
    _TLE_CACHE["expires_at"] = now_ts + ttl
    return payload


@router.get("/wind-grid", summary="Fetch live Open-Meteo global 84-point 10m wind & air temperature grid")
async def get_orbital_wind_grid() -> dict[str, Any]:
    now_ts = time.monotonic()
    if _WIND_CACHE["payload"] is not None and now_ts < _WIND_CACHE["expires_at"]:
        return _WIND_CACHE["payload"]

    lats: list[str] = []
    lons: list[str] = []
    for lat in WIND_LATS:
        for lon in WIND_LONS:
            lats.append(str(lat))
            lons.append(str(lon))

    points: list[dict[str, float]] = []
    source = "circulation_fallback"

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={','.join(lats)}"
        f"&longitude={','.join(lons)}"
        "&current=temperature_2m,wind_speed_10m,wind_direction_10m"
        "&wind_speed_unit=ms&timezone=UTC"
    )
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                raw = resp.json()
                items = raw if isinstance(raw, list) else [raw]
                if len(items) == len(WIND_LATS) * len(WIND_LONS):
                    for idx, item in enumerate(items):
                        r_idx = idx // len(WIND_LONS)
                        c_idx = idx % len(WIND_LONS)
                        cur = item.get("current") or {}
                        lat_v = float(item.get("latitude", WIND_LATS[r_idx]))
                        lon_v = float(item.get("longitude", WIND_LONS[c_idx]))
                        temp_c = float(cur.get("temperature_2m", 15.0))
                        speed = max(0.2, float(cur.get("wind_speed_10m", 4.0)))
                        dir_from = float(cur.get("wind_direction_10m", 250.0))
                        u_ms, v_ms = _meteorological_dir_to_uv(speed, dir_from)
                        points.append(
                            {
                                "lat": lat_v,
                                "lon": lon_v,
                                "tempC": round(temp_c, 2),
                                "windSpeedMs": round(speed, 2),
                                "windDirDeg": round(dir_from, 1),
                                "uMs": round(u_ms, 3),
                                "vMs": round(v_ms, 3),
                            }
                        )
                    source = "open_meteo_live"
    except Exception:
        points = []

    if len(points) != len(WIND_LATS) * len(WIND_LONS):
        points = _fallback_wind_grid()
        source = "circulation_fallback"

    payload = {
        "points": points,
        "source": source,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    ttl = 20 * 60 if source == "open_meteo_live" else 5 * 60
    _WIND_CACHE["payload"] = payload
    _WIND_CACHE["expires_at"] = now_ts + ttl
    return payload


@router.get("/elevation", summary="Fetch 90m SRTM/Copernicus terrain elevation (m a.s.l.) for coordinates")
async def get_orbital_elevation(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
) -> dict[str, Any]:
    lat_r = round(float(latitude), 4)
    lon_r = round(float(longitude), 4)
    key = f"{lat_r:.4f}:{lon_r:.4f}"
    now_ts = time.monotonic()
    cached = _ELEV_CACHE.get(key)
    if cached is not None and now_ts < cached[0]:
        return cached[1]

    elevation_m: float | None = None
    source = "terrain_unavailable"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/elevation",
                params={"latitude": lat_r, "longitude": lon_r},
            )
            if resp.status_code == 200:
                body = resp.json()
                elev_list = body.get("elevation") if isinstance(body, dict) else None
                if isinstance(elev_list, list) and len(elev_list) > 0 and elev_list[0] is not None:
                    elevation_m = round(float(elev_list[0]), 1)
                    source = "srtm_copernicus_dem_90m"
    except Exception:
        elevation_m = None

    payload = {
        "latitude": lat_r,
        "longitude": lon_r,
        "elevation_m": elevation_m,
        "dataset": "SRTM / Copernicus 90m DEM",
        "source": source,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    _ELEV_CACHE[key] = (now_ts + (24 * 3600 if elevation_m is not None else 5 * 60), payload)
    return payload


from app.data_adapters.az_districts import AZ_DISTRICTS, PRIMARY_REGION_IDS


@router.get("/districts", summary="Return all 67 verified Azerbaijan agricultural districts with NASA POWER 2024 & SRTM telemetry")
async def get_orbital_districts() -> dict[str, Any]:
    return {
        "primary_region_ids": list(PRIMARY_REGION_IDS),
        "count": len(AZ_DISTRICTS),
        "districts": list(AZ_DISTRICTS),
    }


_GEOCODE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_GEOCODE_TTL_SECONDS = 900.0
_GEOCODE_MAX_CACHE = 256
_ALLOWED_GOOGLE_REDIRECT_HOSTS = {
    "maps.app.goo.gl",
    "goo.gl",
    "g.co",
    "www.google.com",
    "maps.google.com",
    "google.com",
    "consent.google.com",
}


def _fold_search_text(text: str) -> str:
    folded = (
        text.replace("ə", "e")
        .replace("Ə", "e")
        .replace("ı", "i")
        .replace("İ", "i")
        .replace("ş", "s")
        .replace("Ş", "s")
        .replace("ç", "c")
        .replace("Ç", "c")
        .replace("ğ", "g")
        .replace("Ğ", "g")
        .replace("ö", "o")
        .replace("Ö", "o")
        .replace("ü", "u")
        .replace("Ü", "u")
    )
    decomposed = unicodedata.normalize("NFKD", folded)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", stripped).strip().lower()


def _valid_lat_lon(lat: float, lon: float) -> bool:
    return math.isfinite(lat) and math.isfinite(lon) and -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0


def _extract_place_label_from_maps_url(url_str: str) -> str | None:
    match = re.search(r"/maps/(?:place|search)/([^/@?#]+)", url_str, flags=re.IGNORECASE)
    if not match:
        return None
    label = unquote_plus(match.group(1)).strip()
    if not label or re.match(r"^@-?\d", label):
        return None
    if re.match(r"^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$", label):
        return None
    return label


def _parse_coords_from_map_url(url_str: str) -> tuple[float, float, str | None] | None:
    label = _extract_place_label_from_maps_url(url_str)
    parsed = urlparse(url_str)
    host = parsed.netloc.lower()
    is_yandex = "yandex." in host

    pin_matches = re.findall(r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)", url_str)
    if pin_matches:
        lat_s, lon_s = pin_matches[-1]
        lat, lon = float(lat_s), float(lon_s)
        if _valid_lat_lon(lat, lon):
            return round(lat, 6), round(lon, 6), label

    if parsed.fragment:
        osm_match = re.search(r"map=\d+(?:\.\d+)?/(-?\d+(?:\.\d+)?)/(-?\d+(?:\.\d+)?)", parsed.fragment)
        if osm_match:
            lat, lon = float(osm_match.group(1)), float(osm_match.group(2))
            if _valid_lat_lon(lat, lon):
                return round(lat, 6), round(lon, 6), label

    qs = parse_qs(parsed.query)
    if "mlat" in qs and "mlon" in qs:
        try:
            lat, lon = float(qs["mlat"][0]), float(qs["mlon"][0])
            if _valid_lat_lon(lat, lon):
                return round(lat, 6), round(lon, 6), label
        except ValueError:
            pass

    for key in ("q", "query", "destination", "ll", "center", "sll", "pt"):
        vals = qs.get(key)
        if not vals:
            continue
        m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)(?:\s|$)", vals[0])
        if m:
            a, b = float(m.group(1)), float(m.group(2))
            lat, lon = (b, a) if (is_yandex and key in {"ll", "pt"}) else (a, b)
            if _valid_lat_lon(lat, lon):
                return round(lat, 6), round(lon, 6), label

    at_match = re.search(r"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[,/]|$)", url_str)
    if at_match:
        lat, lon = float(at_match.group(1)), float(at_match.group(2))
        if _valid_lat_lon(lat, lon):
            return round(lat, 6), round(lon, 6), label

    return None


def _is_allowlisted_short_maps_url(raw_url: str) -> str | None:
    candidate = raw_url.strip()
    if re.match(r"^(?:maps\.app\.goo\.gl|goo\.gl/maps|g\.co/maps)/", candidate, flags=re.IGNORECASE):
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme.lower() not in {"http", "https"}:
        return None
    host = parsed.netloc.lower()
    if host == "maps.app.goo.gl":
        return parsed._replace(scheme="https").geturl()
    if host in {"goo.gl", "g.co"} and parsed.path.startswith("/maps"):
        return parsed._replace(scheme="https").geturl()
    return None


async def _resolve_short_maps_url(short_url: str) -> tuple[str, tuple[float, float, str | None] | None]:
    current_url = short_url
    async with httpx.AsyncClient(
        timeout=5.0,
        follow_redirects=False,
        headers={"User-Agent": "SpaceFarm-OrbitalGeocoder/1.0"},
    ) as client:
        for _ in range(5):
            parsed = urlparse(current_url)
            if parsed.scheme.lower() != "https" or parsed.netloc.lower() not in _ALLOWED_GOOGLE_REDIRECT_HOSTS:
                raise HTTPException(
                    status_code=400,
                    detail="Redirect target is outside the allowlisted Google Maps domains.",
                )

            if parsed.netloc.lower() == "consent.google.com":
                qs = parse_qs(parsed.query)
                cont = qs.get("continue", [None])[0]
                if cont and cont.startswith("https://"):
                    current_url = cont
                    coords = _parse_coords_from_map_url(current_url)
                    if coords:
                        return current_url, coords
                    continue

            resp = await client.get(current_url)
            if resp.is_redirect and "location" in resp.headers:
                next_url = urljoin(current_url, resp.headers["location"])
                next_parsed = urlparse(next_url)
                if next_parsed.scheme.lower() == "http" and next_parsed.netloc.lower() in _ALLOWED_GOOGLE_REDIRECT_HOSTS:
                    next_url = next_parsed._replace(scheme="https").geturl()
                current_url = next_url
                coords = _parse_coords_from_map_url(current_url)
                if coords:
                    return current_url, coords
                continue

            coords = _parse_coords_from_map_url(current_url)
            if coords:
                return current_url, coords

            # Inspect only bounded snippet of final Google Maps HTML for embedded coords
            if resp.status_code == 200 and parsed.netloc.lower() in {"www.google.com", "maps.google.com", "google.com"}:
                snippet = resp.text[:65536]
                coords = _parse_coords_from_map_url(snippet)
                if coords:
                    return current_url, coords
            break

    return current_url, _parse_coords_from_map_url(current_url)


def _match_field_tier(q_fold: str, candidate: str) -> int | None:
    if not candidate:
        return None
    if candidate == q_fold:
        return 0
    if candidate.startswith(q_fold):
        return 1
    if f" {q_fold}" in candidate or f"-{q_fold}" in candidate or f"/{q_fold}" in candidate:
        return 2
    return None


def _score_az_districts(query: str, limit: int = 5) -> list[tuple[int, dict[str, Any]]]:
    q_fold = _fold_search_text(query)
    if len(q_fold) < 2:
        return []

    scored: list[tuple[int, dict[str, Any]]] = []
    for d in AZ_DISTRICTS:
        name_candidates = (
            _fold_search_text(d["name_en"]),
            _fold_search_text(d["name_az"]),
            _fold_search_text(d["id"]),
        )
        region_candidates = (
            _fold_search_text(d["economic_region_en"]),
            _fold_search_text(d["economic_region_az"]),
        )
        best = 99
        for candidate in name_candidates:
            tier = _match_field_tier(q_fold, candidate)
            if tier is not None:
                best = min(best, tier)

        # Economic region only acts as a fallback tier below direct city/district matches,
        # and mid-word substrings are never matched (e.g. "ankara" must not hit "lankaran-astara").
        if best > 2:
            for candidate in region_candidates:
                tier = _match_field_tier(q_fold, candidate)
                if tier is not None:
                    best = min(best, 4 + tier)

        if best < 99:
            scored.append(
                (
                    best,
                    {
                        "id": f"az:{d['id']}",
                        "name": d["name_en"],
                        "name_az": d["name_az"],
                        "admin1": d["economic_region_en"],
                        "admin1_az": d["economic_region_az"],
                        "country": "Azerbaijan",
                        "country_code": "AZ",
                        "lat": float(d["latitude"]),
                        "lon": float(d["longitude"]),
                        "elevation_m": float(d["elevation_m"]),
                        "population": None,
                        "preset_id": d["id"],
                        "source": "az_district",
                    },
                )
            )

    scored.sort(key=lambda pair: (pair[0], pair[1]["name"]))
    return scored[:limit]


def _match_az_districts(query: str, limit: int = 5) -> list[dict[str, Any]]:
    return [item for _, item in _score_az_districts(query, limit=limit)]


def _merge_geocode_hits(
    az_scored: list[tuple[int, dict[str, Any]]],
    om_hits: list[dict[str, Any]],
    limit: int = 8,
) -> list[dict[str, Any]]:
    az_exact = [item for score, item in az_scored if score == 0]
    az_prefix = [item for score, item in az_scored if 1 <= score <= 2]
    az_region = [item for score, item in az_scored if score >= 4]

    merged: list[dict[str, Any]] = []

    def _append_unique(items: list[dict[str, Any]]) -> None:
        for hit in items:
            if len(merged) >= limit:
                return
            if any(math.hypot(existing["lat"] - hit["lat"], existing["lon"] - hit["lon"]) < 0.08 for existing in merged):
                continue
            merged.append(hit)

    _append_unique(az_exact)
    _append_unique(om_hits)
    _append_unique(az_prefix)
    _append_unique(az_region)
    return merged[:limit]


async def _fetch_open_meteo_geocode(query: str, count: int = 6) -> tuple[list[dict[str, Any]], bool]:
    async def _call(name_q: str) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": name_q, "count": count, "language": "en", "format": "json"},
            )
            resp.raise_for_status()
            payload = resp.json()
            return list(payload.get("results") or [])

    try:
        raw_hits = await _call(query)
        if not raw_hits:
            folded = _fold_search_text(query)
            if folded and folded != query.strip().lower():
                raw_hits = await _call(folded)
    except Exception:
        return [], False

    mapped: list[dict[str, Any]] = []
    for item in raw_hits:
        lat = item.get("latitude")
        lon = item.get("longitude")
        if lat is None or lon is None:
            continue
        mapped.append(
            {
                "id": f"om:{item.get('id', f'{lat},{lon}')}",
                "name": item.get("name"),
                "name_az": None,
                "admin1": item.get("admin1"),
                "admin1_az": None,
                "country": item.get("country"),
                "country_code": item.get("country_code"),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_m": item.get("elevation"),
                "population": item.get("population"),
                "preset_id": None,
                "source": "open_meteo",
            }
        )
    return mapped, True


@router.get("/geocode", summary="Search global locations or resolve allowlisted Google Maps share links")
async def geocode_orbital_location(
    q: str = Query(..., min_length=2, max_length=500),
) -> dict[str, Any]:
    raw_query = q.strip()
    if len(raw_query) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters.")

    cache_key = raw_query.lower()
    now = time.time()
    cached = _GEOCODE_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _GEOCODE_TTL_SECONDS:
        return {**cached[1], "source_status": "cached"}

    short_maps_url = _is_allowlisted_short_maps_url(raw_query)
    if short_maps_url:
        try:
            final_url, coords = await _resolve_short_maps_url(short_maps_url)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not expand Google Maps link: {exc}",
            ) from exc

        if coords:
            lat, lon, label = coords
            payload = {
                "query": raw_query,
                "kind": "resolved_link",
                "resolved_url": final_url,
                "source_status": "live",
                "results": [
                    {
                        "id": f"link:{lat:.6f},{lon:.6f}",
                        "name": label or "Google Maps Pin",
                        "name_az": label or "Google Maps Nöqtəsi",
                        "admin1": None,
                        "admin1_az": None,
                        "country": None,
                        "country_code": None,
                        "lat": lat,
                        "lon": lon,
                        "elevation_m": None,
                        "population": None,
                        "preset_id": None,
                        "source": "google_maps_link",
                    }
                ],
            }
            if len(_GEOCODE_CACHE) >= _GEOCODE_MAX_CACHE:
                _GEOCODE_CACHE.clear()
            _GEOCODE_CACHE[cache_key] = (now, payload)
            return payload

        fallback_place = _extract_place_label_from_maps_url(final_url)
        if fallback_place:
            raw_query = fallback_place
        else:
            return {
                "query": raw_query,
                "kind": "empty",
                "resolved_url": final_url,
                "source_status": "live",
                "results": [],
            }

    # Block arbitrary non-allowlisted http(s) URLs unless coordinates can be parsed locally
    if re.match(r"^https?://", raw_query, flags=re.IGNORECASE):
        coords = _parse_coords_from_map_url(raw_query)
        if coords:
            lat, lon, label = coords
            return {
                "query": raw_query,
                "kind": "resolved_link",
                "resolved_url": raw_query,
                "source_status": "live",
                "results": [
                    {
                        "id": f"link:{lat:.6f},{lon:.6f}",
                        "name": label or "Map Coordinate Pin",
                        "name_az": label or "Xəritə Koordinatı",
                        "admin1": None,
                        "admin1_az": None,
                        "country": None,
                        "country_code": None,
                        "lat": lat,
                        "lon": lon,
                        "elevation_m": None,
                        "population": None,
                        "preset_id": None,
                        "source": "google_maps_link",
                    }
                ],
            }
        place_from_url = _extract_place_label_from_maps_url(raw_query)
        if place_from_url:
            raw_query = place_from_url
        else:
            raise HTTPException(
                status_code=400,
                detail="Only allowlisted Google Maps share links or map URLs with coordinates are accepted.",
            )

    az_scored = _score_az_districts(raw_query, limit=5)
    om_hits, om_ok = await _fetch_open_meteo_geocode(raw_query, count=6)
    merged = _merge_geocode_hits(az_scored, om_hits, limit=8)

    payload = {
        "query": raw_query,
        "kind": "results" if merged else "empty",
        "source_status": "live" if om_ok else "local_only",
        "results": merged[:8],
    }
    if len(_GEOCODE_CACHE) >= _GEOCODE_MAX_CACHE:
        _GEOCODE_CACHE.clear()
    _GEOCODE_CACHE[cache_key] = (now, payload)
    return payload

