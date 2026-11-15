"""Authenticated workspace routes: real SQLite accounts, detailed profile/parcels, and SpaceFarm AI."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import get_settings
from app.data_adapters.provider import (
    get_climate_features,
    get_climate_timeseries,
    get_crop_catalog,
)
from app.engine.ai_advisor import generate_ai_advice
from app.engine.planner import run_simulation
from app.engine.risk_analyzer import scan_user_parcels
from app.services.notifier import (
    dispatch_alert_notifications,
    normalize_e164_phone,
    send_email_notification,
)
from app.workers.risk_monitor import risk_worker
from app.schemas.models import (
    ClimateQuery,
    ClimateTimeseriesQuery,
    CropHistoryEntry,
    DatePeriod,
    FarmInput,
    GeoPoint,
    PreferenceWeights,
    ScenarioInput,
    SimulationRequest,
    SoilInput,
)
from app.storage.sqlite_store import SpaceFarmStore

logger = logging.getLogger("space_farm.workspace_api")

router = APIRouter(prefix="/api/v1", tags=["workspace"])


def _get_store() -> SpaceFarmStore:
    return SpaceFarmStore(get_settings())


def _require_user_id(
    authorization: str | None = Header(default=None),
    store: SpaceFarmStore = Depends(_get_store),
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required.",
        )
    token = authorization.split(" ", 1)[1].strip()
    user_id = store.verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        )
    profile, _ = store.get_user_bundle(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists.",
        )
    return user_id


class _StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RegisterPayload(_StrictBody):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=6, max_length=128)
    region: str = Field(default="Ganja-Dashkasan", max_length=120)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        clean = value.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("Please provide a valid email address.")
        return clean


class LoginPayload(_StrictBody):
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ForgotPasswordPayload(_StrictBody):
    email: str = Field(min_length=5, max_length=180)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        clean = value.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("Please provide a valid email address.")
        return clean


class ProfilePatchPayload(_StrictBody):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: str | None = Field(default=None, min_length=5, max_length=180)
    region: str | None = Field(default=None, min_length=2, max_length=120)
    username: str | None = Field(default=None, max_length=60)
    phone_code: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=40)
    active_since: str | None = Field(default=None, max_length=30)
    role_type: Literal["farmer", "agronomist", "cooperative", "researcher"] | None = None
    irrigation_pref: Literal["irrigated", "rainfed", "hybrid"] | None = None
    bio: str | None = Field(default=None, max_length=1200)
    avatar_data_url: str | None = Field(default=None, max_length=1_500_000)

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        clean = value.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("Please provide a valid email address.")
        return clean

    @field_validator("avatar_data_url")
    @classmethod
    def _check_avatar(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not value.startswith("data:image/"):
            raise ValueError("Avatar image must be a valid image data URL.")
        return value


class LabMetricsPayload(_StrictBody):
    organic_matter_pct: float | None = Field(default=None, ge=0.0, le=30.0)
    nitrogen_mg_kg: float | None = Field(default=None, ge=0.0, le=1000.0)
    phosphorus_mg_kg: float | None = Field(default=None, ge=0.0, le=1000.0)
    potassium_mg_kg: float | None = Field(default=None, ge=0.0, le=2500.0)
    ec_ds_m: float | None = Field(default=None, ge=0.0, le=30.0)
    moisture_capacity_pct: float | None = Field(default=None, ge=0.0, le=100.0)
    depth_top_cm: float | None = Field(default=None, ge=0.0, le=200.0)
    depth_bottom_cm: float | None = Field(default=None, ge=0.0, le=200.0)
    sample_date: str | None = Field(default=None, max_length=32)
    lab_report_id: str | None = Field(default=None, max_length=80)
    soil_source_type: Literal["laboratory", "extension_service", "field_probe", "user_reported"] | None = None


class ParcelCreatePayload(_StrictBody):
    label: str = Field(min_length=2, max_length=160)
    region_id: str = Field(default="custom", max_length=80)
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    area_ha: float = Field(default=25.0, gt=0.0, le=100000.0)
    irrigation_type: Literal["rainfed", "irrigated", "unknown"] = "irrigated"
    irrigation_budget_mm: float | None = Field(default=240.0, ge=0.0, le=5000.0)
    soil_ph: float | None = Field(default=6.8, ge=0.0, le=14.0)
    soil_texture: Literal["unknown", "sand", "loam", "clay", "other"] = "loam"
    prior_crop_id: str = Field(default="wheat", min_length=1, max_length=60)
    lab_metrics: LabMetricsPayload | None = None
    is_primary: bool = True


class ParcelUpdatePayload(_StrictBody):
    label: str | None = Field(default=None, min_length=2, max_length=160)
    region_id: str | None = Field(default=None, max_length=80)
    latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    longitude: float | None = Field(default=None, ge=-180.0, le=180.0)
    area_ha: float | None = Field(default=None, gt=0.0, le=100000.0)
    irrigation_type: Literal["rainfed", "irrigated"] | None = None
    irrigation_budget_mm: float | None = Field(default=None, ge=0.0, le=5000.0)
    soil_ph: float | None = Field(default=None, ge=0.0, le=14.0)
    soil_texture: Literal["sand", "loam", "clay", "other"] | None = None
    prior_crop_id: str | None = Field(default=None, min_length=1, max_length=60)
    lab_metrics: LabMetricsPayload | None = None


class AiAssistPayload(_StrictBody):
    question: str = Field(min_length=1, max_length=2000)
    locale: Literal["az", "en"] = "az"
    farm: FarmInput | None = None
    start_date: date = date(2024, 1, 1)
    end_date: date = date(2024, 12, 31)
    preferences: PreferenceWeights = Field(
        default_factory=lambda: PreferenceWeights(water=0.55, soil=0.45, income=0.0)
    )
    scenario: ScenarioInput = Field(default_factory=ScenarioInput)


class NotificationPreferencesPayload(_StrictBody):
    sms_enabled: bool | None = None
    email_enabled: bool | None = None
    min_severity: Literal["critical", "high", "moderate"] | None = None
    custom_frost_c: float | None = Field(default=None, ge=-15.0, le=15.0)
    custom_heat_c: float | None = Field(default=None, ge=20.0, le=55.0)


class AlertStatusPayload(_StrictBody):
    status: Literal["active", "acknowledged", "resolved"]


def _farm_from_primary_parcel(parcels: list[dict[str, Any]], region: str) -> FarmInput:
    p = parcels[0] if parcels else None
    if p is None:
        return FarmInput(
            farm_id="spacefarm-primary",
            label=f"{region} Field",
            is_demo=False,
            location=GeoPoint(latitude=40.68, longitude=46.36),
            area_ha=28.4,
            irrigation_type="irrigated",
            irrigation_budget_mm_per_season=240.0,
            soil=SoilInput(ph=6.8, texture="loam", source_type="laboratory", source_ref="LAB-AZ-GD-2025"),
            crop_history=[CropHistoryEntry(year=2024, crop_id="wheat")],
        )
    soil_ph = p["soil_ph"] if p["soil_ph"] is not None else 6.8
    lab = p.get("lab_metrics") or {}
    return FarmInput(
        farm_id=str(p["id"]),
        label=str(p["label"]),
        is_demo=False,
        location=GeoPoint(latitude=float(p["latitude"]), longitude=float(p["longitude"])),
        area_ha=float(p["area_ha"]),
        irrigation_type=p["irrigation_type"] if p["irrigation_type"] != "unknown" else "irrigated",
        irrigation_budget_mm_per_season=p["irrigation_budget_mm"],
        soil=SoilInput(
            ph=soil_ph,
            texture=p["soil_texture"] if p["soil_texture"] != "unknown" else "loam",
            source_type="laboratory" if lab.get("soil_source_type") == "laboratory" else "user_reported",
            source_ref=str(lab.get("lab_report_id") or "LAB-AZ-FIELD"),
        ),
        crop_history=[CropHistoryEntry(year=2024, crop_id=str(p["prior_crop_id"] or "wheat"))],
    )


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_account(
    payload: RegisterPayload,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    if store.email_exists(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    token, user, parcels = store.register_user(
        name=payload.name,
        email=payload.email,
        password=payload.password,
        region=payload.region,
    )
    return {"token": token, "user": user, "parcels": parcels}


@router.post("/auth/login")
def login_account(
    payload: LoginPayload,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    res = store.authenticate_user(payload.email, payload.password)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    token, user, parcels = res
    return {"token": token, "user": user, "parcels": parcels}


@router.post("/auth/forgot-password")
async def request_password_reset(
    payload: ForgotPasswordPayload,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    settings = get_settings()
    reset_rec = store.create_password_reset_request(payload.email)
    delivery_status = "processed_no_leak"
    if reset_rec is not None:
        email_res = await send_email_notification(
            settings,
            reset_rec["email"],
            "SpaceFarm Password Reset Verification",
            (
                f"Hello {reset_rec['name']},\n\n"
                f"A password reset request was recorded for your SpaceFarm account "
                f"(request ID: {reset_rec['request_id']}).\n"
                "Please verify via your configured SpaceFarm administrator or mail relay.\n"
            ),
        )
        delivery_status = str(email_res.get("status") or "queued_awaiting_credentials")
        store.update_password_reset_status(reset_rec["request_id"], delivery_status)
        store.record_dispatch(
            user_id=reset_rec["user_id"],
            alert_id=None,
            channel="email",
            recipient=reset_rec["email"],
            subject="SpaceFarm Password Reset Request",
            body=f"Password reset request {reset_rec['request_id']}",
            provider=str(email_res.get("provider") or "local_outbox_unconfigured"),
            status=delivery_status,
            error_detail=email_res.get("error_detail"),
        )
    return {
        "ok": True,
        "delivery_status": delivery_status,
        "smtp_configured": bool(settings.smtp_host.strip()),
    }


@router.get("/profile")
def get_profile(
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    user, parcels = store.get_user_bundle(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return {"user": user, "parcels": parcels}


@router.put("/profile")
def update_profile(
    payload: ProfilePatchPayload,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    patch = payload.model_dump(exclude_unset=True)
    if "email" in patch and patch["email"]:
        current_user, _ = store.get_user_bundle(user_id)
        if current_user and patch["email"] != current_user["email"] and store.email_exists(patch["email"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already registered to another account.",
            )
    user, parcels = store.update_user_profile(user_id, patch)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return {"user": user, "parcels": parcels}


@router.post("/parcels", status_code=status.HTTP_201_CREATED)
def create_parcel(
    payload: ParcelCreatePayload,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    parcels = store.create_parcel(user_id, payload.model_dump())
    return {"parcels": parcels}


@router.put("/parcels/{parcel_id}")
def update_parcel_details(
    parcel_id: str,
    payload: ParcelUpdatePayload,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    parcels = store.update_parcel(user_id, parcel_id, payload.model_dump(exclude_unset=True))
    return {"parcels": parcels}


@router.post("/parcels/{parcel_id}/activate")
def activate_parcel(
    parcel_id: str,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    parcels = store.set_primary_parcel(user_id, parcel_id)
    return {"parcels": parcels}


@router.delete("/parcels/{parcel_id}")
def remove_parcel(
    parcel_id: str,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    _, current = store.get_user_bundle(user_id)
    if len(current) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one active farm parcel must remain on the account.",
        )
    parcels = store.delete_parcel(user_id, parcel_id)
    if parcels and not any(p["is_primary"] for p in parcels):
        parcels = store.set_primary_parcel(user_id, str(parcels[0]["id"]))
    return {"parcels": parcels}


@router.get("/ai/history")
def get_ai_history(
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    return {"messages": store.list_ai_messages(user_id)}


@router.delete("/ai/history")
def delete_ai_history(
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, bool]:
    store.clear_ai_messages(user_id)
    return {"ok": True}


@router.post("/ai/assist")
async def assist_field(
    payload: AiAssistPayload,
    request: Request,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    settings = get_settings()
    user, parcels = store.get_user_bundle(user_id)
    farm = payload.farm or _farm_from_primary_parcel(parcels, (user or {}).get("region", "Ganja-Dashkasan"))

    climate_query = ClimateQuery(
        latitude=farm.location.latitude,
        longitude=farm.location.longitude,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    climate = await get_climate_features(climate_query, settings=settings)

    timeseries = None
    try:
        ts_start = date(max(1981, payload.end_date.year - 9), 1, 1)
        ts_query = ClimateTimeseriesQuery(
            latitude=farm.location.latitude,
            longitude=farm.location.longitude,
            start_date=ts_start,
            end_date=payload.end_date,
        )
        timeseries = await get_climate_timeseries(ts_query, settings=settings)
    except Exception as exc:
        logger.debug("Optional multi-year timeseries lookup skipped for AI context: %s", exc)

    catalog = get_crop_catalog(settings=settings)
    sim_request = SimulationRequest(
        farm=farm,
        climate_period=DatePeriod(start_date=payload.start_date, end_date=payload.end_date),
        preferences=payload.preferences,
        scenario=payload.scenario,
    )
    req_id = getattr(request.state, "request_id", None)
    simulation = run_simulation(sim_request, climate, catalog, request_id=req_id)

    history = store.list_ai_messages(user_id, limit=16)
    active_alerts = store.list_weather_alerts(user_id, status_filter="active", limit=5)
    primary_lab = (parcels[0].get("lab_metrics") if parcels else None) or {}
    advice = await generate_ai_advice(
        question=payload.question.strip(),
        locale=payload.locale,
        farm=farm,
        climate=climate,
        timeseries=timeseries,
        simulation=simulation,
        catalog=catalog,
        history=history,
        active_alerts=active_alerts,
        lab_metrics=primary_lab,
    )

    user_msg = store.append_ai_message(user_id, role="user", content=payload.question.strip())
    assistant_msg = store.append_ai_message(
        user_id,
        role="assistant",
        content=advice["answer"],
        meta={
            "engine": advice["engine"],
            "data_mode": advice["data_mode"],
            "synthetic": advice["synthetic"],
            "metrics": advice["metrics"],
            "followups": advice["followups"],
            "actions": advice["actions"],
            "field_label": farm.label,
        },
    )

    return {
        "user_message": user_msg,
        "assistant_message": assistant_msg,
        **advice,
    }


def _alerts_overview_payload(
    *,
    store: SpaceFarmStore,
    user: dict[str, Any],
    settings: Any,
) -> dict[str, Any]:
    uid = str(user["id"])
    prefs = store.get_notification_preferences(uid)
    phone_e164 = normalize_e164_phone(user.get("phone_code"), user.get("phone"))
    return {
        "snapshots": store.list_parcel_risk_snapshots(uid),
        "alerts": store.list_weather_alerts(uid, status_filter="all", limit=60),
        "dispatches": store.list_notification_dispatches(uid, limit=50),
        "preferences": prefs,
        "worker": risk_worker.status_dict(),
        "contacts": {
            "email": user.get("email") or "",
            "phone_e164": phone_e164,
            "smtp_configured": bool(settings.smtp_host.strip()),
            "sms_configured": bool(
                (settings.twilio_account_sid.strip() and settings.twilio_auth_token.strip() and settings.twilio_from_number.strip())
                or settings.sms_webhook_url.strip()
            ),
        },
    }


@router.get("/alerts/overview")
async def get_alerts_overview(
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    settings = get_settings()
    user, parcels = store.get_user_bundle(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    existing_snapshots = store.list_parcel_risk_snapshots(user_id)
    if not existing_snapshots and parcels and settings.app_env != "test":
        await scan_user_parcels(store=store, settings=settings, user=user, parcels=parcels)

    return _alerts_overview_payload(store=store, user=user, settings=settings)


@router.post("/alerts/scan")
async def scan_user_alerts(
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    settings = get_settings()
    user, parcels = store.get_user_bundle(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    scan_result = await scan_user_parcels(
        store=store,
        settings=settings,
        user=user,
        parcels=parcels,
    )
    overview = _alerts_overview_payload(store=store, user=user, settings=settings)
    return {
        **overview,
        "scan_summary": {
            "scanned_parcels": len(scan_result["snapshots"]),
            "new_alerts": len(scan_result["new_alerts"]),
            "new_dispatches": len(scan_result["new_dispatches"]),
        },
    }


@router.patch("/alerts/preferences")
def update_alert_preferences(
    payload: NotificationPreferencesPayload,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    settings = get_settings()
    user, _ = store.get_user_bundle(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    patch = payload.model_dump(exclude_unset=True)
    store.save_notification_preferences(user_id, patch)
    return _alerts_overview_payload(store=store, user=user, settings=settings)


@router.post("/alerts/{alert_id}/status")
def set_alert_status(
    alert_id: str,
    payload: AlertStatusPayload,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    updated = store.update_weather_alert_status(user_id, alert_id, payload.status)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")
    return {"alert": updated}


@router.post("/alerts/verify-dispatch")
async def verify_notification_dispatch(
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    settings = get_settings()
    user, parcels = store.get_user_bundle(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    primary = parcels[0] if parcels else {
        "id": "spacefarm-primary",
        "label": f"{user.get('region', 'Azerbaijan')} Plot",
        "latitude": 40.68,
        "longitude": 46.36,
    }
    prefs = store.get_notification_preferences(user_id)
    synthetic_probe_alert = {
        "id": None,
        "parcel_id": primary["id"],
        "parcel_label": primary["label"],
        "latitude": float(primary["latitude"]),
        "longitude": float(primary["longitude"]),
        "risk_type": "channel_check",
        "severity": "critical",
        "title_az": "SMS və Email Kanal Doğrulaması",
        "message_az": (
            "SpaceFarm erkən xəbərdarlıq bildiriş kanalı aktivdir. "
            "Sahə koordinatlarında kritik şaxta, quraqlıq və ya istilik aşkarlandıqda bu kanallarla dərhal bildiriş göndəriləcək."
        ),
        "trigger_metric": "Kanal yoxlaması (Critical Pipeline)",
    }
    dispatches = await dispatch_alert_notifications(
        store=store,
        settings=settings,
        user=user,
        alert_record=synthetic_probe_alert,
        prefs=prefs,
        force=True,
    )
    overview = _alerts_overview_payload(store=store, user=user, settings=settings)
    return {
        **overview,
        "triggered": dispatches,
    }
