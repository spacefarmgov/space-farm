"""Coordinate-driven agricultural weather risk & hazard evaluation engine."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

import httpx

from app.config import Settings
from app.data_adapters.provider import get_climate_features
from app.schemas.models import ClimateQuery
from app.services.notifier import SEVERITY_RANK, dispatch_alert_notifications

logger = logging.getLogger("space_farm.risk_analyzer")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _max_severity(levels: list[str]) -> str:
    if not levels:
        return "low"
    return max(levels, key=lambda s: SEVERITY_RANK.get(s, 0))


async def fetch_live_forecast_7d(latitude: float, longitude: float) -> dict[str, Any]:
    """Fetch 7-day daily + current meteorology from Open-Meteo for exact field coordinates."""
    params = {
        "latitude": round(float(latitude), 4),
        "longitude": round(float(longitude), 4),
        "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,wind_speed_10m_max",
        "forecast_days": 7,
        "timezone": "UTC",
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        payload = resp.json()

    daily_raw = payload.get("daily") or {}
    times = daily_raw.get("time") or []
    tmax_list = daily_raw.get("temperature_2m_max") or []
    tmin_list = daily_raw.get("temperature_2m_min") or []
    precip_list = daily_raw.get("precipitation_sum") or []
    et0_list = daily_raw.get("et0_fao_evapotranspiration") or []
    wind_list = daily_raw.get("wind_speed_10m_max") or []

    days: list[dict[str, Any]] = []
    for i, day_iso in enumerate(times):
        days.append(
            {
                "date": day_iso,
                "tmax_c": tmax_list[i] if i < len(tmax_list) else None,
                "tmin_c": tmin_list[i] if i < len(tmin_list) else None,
                "precip_mm": precip_list[i] if i < len(precip_list) else 0.0,
                "et0_mm": et0_list[i] if i < len(et0_list) else 0.0,
                "wind_kmh": wind_list[i] if i < len(wind_list) else None,
            }
        )

    return {
        "source": "open-meteo",
        "current": payload.get("current") or {},
        "days": days,
    }


def evaluate_parcel_hazards(
    *,
    parcel: dict[str, Any],
    forecast: dict[str, Any],
    nasa_root_wetness: float | None,
    prefs: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Compute frost, drought, heat, and heavy-rain hazards from forecast + NASA soil wetness."""
    days = forecast.get("days") or []
    tmins = [float(d["tmin_c"]) for d in days if d.get("tmin_c") is not None]
    tmaxs = [float(d["tmax_c"]) for d in days if d.get("tmax_c") is not None]
    precips = [float(d.get("precip_mm") or 0.0) for d in days]
    et0s = [float(d.get("et0_mm") or 0.0) for d in days]

    min_temp = min(tmins) if tmins else None
    max_temp = max(tmaxs) if tmaxs else None
    precip_7d = round(sum(precips), 1)
    et0_7d = round(sum(et0s), 1)
    max_daily_precip = max(precips) if precips else 0.0
    water_balance = round(precip_7d - et0_7d, 1)

    dry_streak = 0
    max_dry_streak = 0
    for p in precips:
        if p < 1.0:
            dry_streak += 1
            max_dry_streak = max(max_dry_streak, dry_streak)
        else:
            dry_streak = 0

    frost_thresh = float(prefs.get("custom_frost_c", 1.0))
    heat_thresh = float(prefs.get("custom_heat_c", 36.0))
    irr_type = str(parcel.get("irrigation_type") or "unknown").lower()

    alerts_to_emit: list[dict[str, Any]] = []
    lat = float(parcel["latitude"])
    lon = float(parcel["longitude"])
    label = str(parcel["label"])

    # 1. Frost hazard
    frost_risk = "low"
    if min_temp is not None:
        if min_temp <= min(0.0, frost_thresh - 1.0):
            frost_risk = "critical"
        elif min_temp <= frost_thresh:
            frost_risk = "high"
        elif min_temp <= frost_thresh + 2.5:
            frost_risk = "moderate"

        if frost_risk in ("critical", "high", "moderate"):
            alerts_to_emit.append(
                {
                    "parcel_id": parcel["id"],
                    "parcel_label": label,
                    "latitude": lat,
                    "longitude": lon,
                    "risk_type": "frost",
                    "severity": frost_risk,
                    "title_az": "Şaxta Riski" if frost_risk != "critical" else "Kritik Şaxta Xəbərdarlığı",
                    "title_en": "Frost Risk Alert" if frost_risk != "critical" else "Critical Frost Warning",
                    "message_az": (
                        f"Növbəti 7 gündə minimum temperaturun {min_temp:.1f}°C-yə enəcəyi proqnozlaşdırılır "
                        f"(hədd: ≤ {frost_thresh:.1f}°C). Həssas cücərtiləri örtün, tüstüləmə və ya axşam suvarması ilə şaxtaya qarşı qoruma tətbiq edin."
                    ),
                    "message_en": (
                        f"7-day minimum temperature is forecast to drop to {min_temp:.1f}°C "
                        f"(threshold ≤ {frost_thresh:.1f}°C). Protect tender shoots, delay spraying, or apply pre-frost thermal irrigation."
                    ),
                    "trigger_metric": f"Tmin {min_temp:.1f}°C (7d)",
                    "metrics": {
                        "min_temp_c": round(min_temp, 1),
                        "threshold_c": round(frost_thresh, 1),
                        "nasa_root_wetness": nasa_root_wetness,
                    },
                }
            )

    # 2. Extreme heat stress
    heat_risk = "low"
    if max_temp is not None:
        if max_temp >= max(38.0, heat_thresh + 2.0):
            heat_risk = "critical"
        elif max_temp >= heat_thresh:
            heat_risk = "high"
        elif max_temp >= heat_thresh - 3.5:
            heat_risk = "moderate"

        if heat_risk in ("critical", "high", "moderate"):
            alerts_to_emit.append(
                {
                    "parcel_id": parcel["id"],
                    "parcel_label": label,
                    "latitude": lat,
                    "longitude": lon,
                    "risk_type": "heat",
                    "severity": heat_risk,
                    "title_az": "Həddindən Artıq İstilik Stressi" if heat_risk != "critical" else "Kritik İstilik Dalğası",
                    "title_en": "Heat Stress Advisory" if heat_risk != "critical" else "Critical Extreme Heat Alert",
                    "message_az": (
                        f"Sahədə maksimal temperatur {max_temp:.1f}°C-yə çata bilər (hədd: ≥ {heat_thresh:.1f}°C). "
                        f"Suvarmanı sübh tezdən və ya axşam saatlarına keçirin, yarpaq yanmasının qarşısını almaq üçün gündüz çiləmədən çəkinin."
                    ),
                    "message_en": (
                        f"Forecast maximum reaches {max_temp:.1f}°C (threshold ≥ {heat_thresh:.1f}°C). "
                        f"Shift irrigation to dawn/evening hours and inspect pollination stages for heat stress."
                    ),
                    "trigger_metric": f"Tmax {max_temp:.1f}°C (7d)",
                    "metrics": {
                        "max_temp_c": round(max_temp, 1),
                        "threshold_c": round(heat_thresh, 1),
                    },
                }
            )

    # 3. Drought & Moisture Deficit
    drought_risk = "low"
    low_wetness = nasa_root_wetness is not None and nasa_root_wetness < 0.44
    rainfed_factor = irr_type == "rainfed"
    if (
        (water_balance <= -30.0 and (max_dry_streak >= 6 or low_wetness or rainfed_factor))
        or (precip_7d < 2.0 and max_temp is not None and max_temp >= 32.0 and max_dry_streak >= 6)
    ):
        drought_risk = "critical"
    elif water_balance <= -20.0 or (max_dry_streak >= 5 and (low_wetness or rainfed_factor)):
        drought_risk = "high"
    elif water_balance <= -10.0 and max_dry_streak >= 4:
        drought_risk = "moderate"

    if drought_risk in ("critical", "high", "moderate"):
        wet_str = f"{round(nasa_root_wetness * 100)}%" if nasa_root_wetness is not None else "n/a"
        alerts_to_emit.append(
            {
                "parcel_id": parcel["id"],
                "parcel_label": label,
                "latitude": lat,
                "longitude": lon,
                "risk_type": "drought",
                "severity": drought_risk,
                "title_az": "Quraqlıq və Rütubət Çatışmazlığı" if drought_risk != "critical" else "Kritik Quraqlıq Riski",
                "title_en": "Drought & Moisture Deficit" if drought_risk != "critical" else "Critical Drought Risk",
                "message_az": (
                    f"7 günlük yağıntı ({precip_7d:.1f} mm) ET0 buxarlanmasını ({et0_7d:.1f} mm) ödəmir (su balansı {water_balance:+.1f} mm, "
                    f"ardıcıl quru günlər: {max_dry_streak}, NASA kök nəmliyi: {wet_str}). Torpaq nəmliyini qorumaq üçün suvarma cədvəlini sıxlaşdırın."
                ),
                "message_en": (
                    f"7-day rainfall ({precip_7d:.1f} mm) trails ET0 ({et0_7d:.1f} mm), balance {water_balance:+.1f} mm "
                    f"across {max_dry_streak} consecutive dry days (NASA root wetness {wet_str}). Prioritize moisture conservation or scheduled irrigation."
                ),
                "trigger_metric": f"Balans {water_balance:+.1f} mm · {max_dry_streak} quru gün",
                "metrics": {
                    "precip_7d_mm": precip_7d,
                    "et0_7d_mm": et0_7d,
                    "water_balance_mm": water_balance,
                    "dry_streak_days": max_dry_streak,
                    "nasa_root_wetness": nasa_root_wetness,
                },
            }
        )

    # 4. Heavy Rain / Waterlogging
    rain_risk = "low"
    if max_daily_precip >= 45.0 or precip_7d >= 90.0:
        rain_risk = "critical"
    elif max_daily_precip >= 25.0 or precip_7d >= 55.0:
        rain_risk = "high"
    elif max_daily_precip >= 15.0 or precip_7d >= 35.0:
        rain_risk = "moderate"

    if rain_risk in ("critical", "high", "moderate"):
        alerts_to_emit.append(
            {
                "parcel_id": parcel["id"],
                "parcel_label": label,
                "latitude": lat,
                "longitude": lon,
                "risk_type": "heavy_rain",
                "severity": rain_risk,
                "title_az": "Güclü Yağıntı və Subasma Riski" if rain_risk != "critical" else "Kritik Leysan / Subasma Xəbərdarlığı",
                "title_en": "Heavy Rain Advisory" if rain_risk != "critical" else "Critical Heavy Rain & Waterlogging Alert",
                "message_az": (
                    f"Bir gündə {max_daily_precip:.1f} mm (7 gündə {precip_7d:.1f} mm) güclü yağıntı gözlənilir. "
                    f"Drenaj kanallarını təmizləyin, gübrələmə və texnika işlərini yağıntıdan sonraya planlayın."
                ),
                "message_en": (
                    f"Up to {max_daily_precip:.1f} mm/day ({precip_7d:.1f} mm / 7d) precipitation forecast. "
                    f"Clear drainage channels and hold field machinery / soluble fertilizer applications."
                ),
                "trigger_metric": f"Pik {max_daily_precip:.1f} mm/gün ({precip_7d:.1f} mm/7g)",
                "metrics": {
                    "max_daily_precip_mm": round(max_daily_precip, 1),
                    "precip_7d_mm": precip_7d,
                },
            }
        )

    overall = _max_severity([frost_risk, heat_risk, drought_risk, rain_risk])
    if overall == "low":
        summary_az = (
            f"Stabil hava: Tmin {min_temp:.1f}°C / Tmax {max_temp:.1f}°C, 7g yağıntı {precip_7d:.1f} mm."
            if (min_temp is not None and max_temp is not None)
            else "Sahə üzrə kəskin hava riski aşkarlanmadı."
        )
        summary_en = (
            f"Stable 7-day outlook: Tmin {min_temp:.1f}°C / Tmax {max_temp:.1f}°C, 7d rain {precip_7d:.1f} mm."
            if (min_temp is not None and max_temp is not None)
            else "No severe meteorological hazards detected."
        )
    else:
        summary_az = " · ".join(a["title_az"] for a in alerts_to_emit)
        summary_en = " · ".join(a["title_en"] for a in alerts_to_emit)

    snapshot = {
        "parcel_id": parcel["id"],
        "parcel_label": label,
        "latitude": lat,
        "longitude": lon,
        "overall_severity": overall,
        "frost_risk": frost_risk,
        "drought_risk": drought_risk,
        "heat_risk": heat_risk,
        "rain_risk": rain_risk,
        "forecast_tmin_c": round(min_temp, 1) if min_temp is not None else None,
        "forecast_tmax_c": round(max_temp, 1) if max_temp is not None else None,
        "forecast_precip_7d_mm": precip_7d,
        "forecast_et0_7d_mm": et0_7d,
        "water_balance_mm": water_balance,
        "nasa_root_wetness": nasa_root_wetness,
        "summary_az": summary_az,
        "summary_en": summary_en,
        "daily_forecast": days,
        "last_scanned_at": _now_iso(),
    }
    return snapshot, alerts_to_emit


async def _get_nasa_root_wetness(
    settings: Settings, latitude: float, longitude: float
) -> float | None:
    try:
        bundle = await get_climate_features(
            ClimateQuery(
                latitude=latitude,
                longitude=longitude,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
            ),
            settings=settings,
        )
        for feat in bundle.features:
            if feat.feature_id == "mean_root_zone_soil_wetness" and feat.value is not None:
                return round(float(feat.value), 3)
    except Exception as exc:
        logger.debug("Optional NASA root wetness baseline skipped for (%s,%s): %s", latitude, longitude, exc)
    return None


async def scan_user_parcels(
    *,
    store: Any,
    settings: Settings,
    user: dict[str, Any],
    parcels: list[dict[str, Any]],
    prefs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run live coordinate meteorological & hazard analysis for every parcel owned by `user`."""
    user_prefs = prefs or store.get_notification_preferences(user["id"])
    snapshots: list[dict[str, Any]] = []
    created_alerts: list[dict[str, Any]] = []
    triggered_dispatches: list[dict[str, Any]] = []

    for parcel in parcels:
        lat = float(parcel["latitude"])
        lon = float(parcel["longitude"])
        try:
            forecast = await fetch_live_forecast_7d(lat, lon)
        except Exception as exc:
            logger.warning("Open-Meteo forecast fetch failed for parcel %s (%s,%s): %s", parcel["id"], lat, lon, exc)
            continue

        nasa_root_wetness = await _get_nasa_root_wetness(settings, lat, lon)
        snapshot, candidate_alerts = evaluate_parcel_hazards(
            parcel=parcel,
            forecast=forecast,
            nasa_root_wetness=nasa_root_wetness,
            prefs=user_prefs,
        )
        saved_snapshot = store.upsert_parcel_risk_snapshot(user["id"], snapshot)
        snapshots.append(saved_snapshot)

        for cand in candidate_alerts:
            if store.has_recent_similar_alert(
                user_id=user["id"],
                parcel_id=parcel["id"],
                risk_type=cand["risk_type"],
                severity=cand["severity"],
                cooldown_hours=settings.risk_alert_cooldown_hours,
            ):
                continue
            alert_row = store.create_weather_alert(user["id"], cand)
            created_alerts.append(alert_row)
            dispatches = await dispatch_alert_notifications(
                store=store,
                settings=settings,
                user=user,
                alert_record=alert_row,
                prefs=user_prefs,
                force=False,
            )
            triggered_dispatches.extend(dispatches)

    return {
        "snapshots": snapshots,
        "new_alerts": created_alerts,
        "new_dispatches": triggered_dispatches,
    }
