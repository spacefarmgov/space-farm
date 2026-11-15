"""Real orbital TLE & global Open-Meteo wind-grid proxy routes with TTL caching and graceful fallbacks."""

from __future__ import annotations

import asyncio
import math
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Query

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
