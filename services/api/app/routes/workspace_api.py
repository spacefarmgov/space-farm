"""Authenticated workspace routes: real SQLite accounts, detailed profile/parcels, and SpaceFarm AI."""

from __future__ import annotations

import logging
import secrets
from datetime import date
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, Response, status
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
    is_smtp_configured,
    normalize_e164_phone,
    send_auth_otp_email,
    send_email_notification,
    send_password_reset_code_email,
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
from app.storage.sqlite_store import SpaceFarmStore, VAULT_COOKIE_NAME

logger = logging.getLogger("space_farm.workspace_api")

router = APIRouter(prefix="/api/v1", tags=["workspace"])


def _get_store() -> SpaceFarmStore:
    return SpaceFarmStore(get_settings())


def _set_vault_cookie(
    request: Request,
    response: Response,
    store: SpaceFarmStore,
    user_id: str,
) -> None:
    existing = request.cookies.get(VAULT_COOKIE_NAME)
    token = store.export_vault_cookie(user_id, existing_cookie=existing)
    if not token:
        return
    settings = get_settings()
    is_https = (
        settings.is_vercel
        or request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto", "").lower() == "https"
    )
    response.set_cookie(
        key=VAULT_COOKIE_NAME,
        value=token,
        max_age=86400 * 30,
        path="/",
        httponly=True,
        samesite="lax",
        secure=is_https,
    )


def _require_user_id(
    request: Request,
    authorization: str | None = Header(default=None),
    store: SpaceFarmStore = Depends(_get_store),
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required.",
        )
    token = authorization.split(" ", 1)[1].strip()
    claims = store.verify_token_claims(token)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        )
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(
            vault_cookie,
            target_email=str(claims.get("email") or "").strip() or None,
        )
    user_id = store.ensure_session_user(claims)
    if not user_id:
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


class DemoLoginPayload(_StrictBody):
    region: str = Field(default="Ganja-Dashkasan", min_length=1, max_length=120)


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


class OtpVerifyPayload(_StrictBody):
    email: str = Field(min_length=5, max_length=180)
    code: str = Field(min_length=4, max_length=4)
    otp_token: str | None = Field(default=None, max_length=2048)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        clean = value.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("Please provide a valid email address.")
        return clean

    @field_validator("code")
    @classmethod
    def _validate_code(cls, value: str) -> str:
        clean = value.strip()
        if not clean.isdigit() or len(clean) != 4:
            raise ValueError("Verification code must be exactly 4 digits.")
        return clean


class ResetPasswordPayload(_StrictBody):
    email: str = Field(min_length=5, max_length=180)
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6, max_length=128)
    reset_token: str | None = Field(default=None, max_length=2048)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        clean = value.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("Please provide a valid email address.")
        return clean

    @field_validator("code")
    @classmethod
    def _validate_code(cls, value: str) -> str:
        clean = value.strip()
        if not clean.isdigit() or len(clean) != 6:
            raise ValueError("Recovery code must be exactly 6 digits.")
        return clean


class GoogleAuthPayload(_StrictBody):
    credential: str | None = Field(default=None, min_length=20, max_length=4096)
    access_token: str | None = Field(default=None, min_length=20, max_length=4096)
    region: str = Field(default="Ganja-Dashkasan", max_length=120)


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


def _map_code_verification_error(reason: str) -> HTTPException:
    if reason == "expired":
        return HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Verification code has expired. Request a new code.",
        )
    if reason == "too_many_attempts":
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Request a new verification code.",
        )
    if reason == "email_exists":
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid verification code.",
    )


async def _verify_google_identity(
    *,
    credential: str | None,
    access_token: str | None,
    expected_client_id: str,
) -> dict[str, Any]:
    if not credential and not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential or access_token is required.",
        )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if credential:
                resp = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": credential},
                )
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired Google ID token.",
                    )
                info = resp.json()
                if str(info.get("aud") or "").strip() != expected_client_id:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google token audience mismatch.",
                    )
            else:
                info_resp = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"access_token": access_token},
                )
                if info_resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired Google access token.",
                    )
                token_meta = info_resp.json()
                if str(token_meta.get("aud") or "").strip() != expected_client_id:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google access token audience mismatch.",
                    )
                user_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if user_resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Could not load verified Google profile.",
                    )
                info = user_resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to reach Google OAuth verification service: {exc}",
        ) from exc

    verified_raw = str(info.get("email_verified", "")).lower()
    email = str(info.get("email") or "").strip().lower()
    sub = str(info.get("sub") or "").strip()
    if verified_raw not in {"true", "1"} or not email or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified.",
        )
    return {
        "sub": sub,
        "email": email,
        "name": str(info.get("name") or info.get("given_name") or email.split("@")[0]).strip(),
        "picture": str(info.get("picture") or "").strip() or None,
    }


@router.get("/auth/providers")
def get_auth_providers() -> dict[str, Any]:
    settings = get_settings()
    client_id = settings.google_client_id.strip()
    return {
        "google_enabled": bool(client_id),
        "google_client_id": client_id,
        "smtp_configured": is_smtp_configured(settings),
    }


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_account(
    payload: RegisterPayload,
    request: Request,
    response: Response,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(vault_cookie, target_email=payload.email)
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
    _set_vault_cookie(request, response, store, str(user["id"]))
    return {"token": token, "user": user, "parcels": parcels}


@router.post("/auth/demo", status_code=status.HTTP_201_CREATED)
def demo_judge_access(
    request: Request,
    response: Response,
    payload: DemoLoginPayload | None = Body(default=None),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    """Provision an isolated one-click Judge / Demo workspace session without SMTP friction."""
    region = payload.region.strip() if payload and payload.region.strip() else "Ganja-Dashkasan"
    demo_email = f"judge-{secrets.token_hex(4)}@demo.spacefarm.org"
    demo_password = secrets.token_urlsafe(24)
    token, user, parcels = store.register_user(
        name="NASA Judge Demo",
        email=demo_email,
        password=demo_password,
        region=region,
    )
    _set_vault_cookie(request, response, store, str(user["id"]))
    return {"token": token, "user": user, "parcels": parcels}


@router.post("/auth/register/request-otp")
async def request_registration_otp(
    payload: RegisterPayload,
    request: Request,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(vault_cookie, target_email=payload.email)
    if store.email_exists(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    settings = get_settings()
    if not is_smtp_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email OTP delivery is not configured yet (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env).",
        )
    otp_code, otp_token = store.create_registration_otp_bundle(
        name=payload.name,
        email=payload.email,
        password=payload.password,
        region=payload.region,
        ttl_seconds=settings.otp_ttl_seconds,
    )
    email_res = await send_auth_otp_email(settings, payload.email, payload.name, otp_code)
    if email_res.get("status") != "sent":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not deliver 4-digit OTP email: {email_res.get('error_detail') or email_res.get('status')}",
        )
    return {
        "ok": True,
        "email": payload.email,
        "expires_in_seconds": settings.otp_ttl_seconds,
        "delivery_status": "sent",
        "otp_token": otp_token,
    }


@router.post("/auth/register/verify-otp", status_code=status.HTTP_201_CREATED)
def verify_registration_otp(
    payload: OtpVerifyPayload,
    request: Request,
    response: Response,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(vault_cookie, target_email=payload.email)
    outcome, token, user, parcels = store.verify_registration_otp(
        email=payload.email,
        code=payload.code,
        otp_token=payload.otp_token,
    )
    if outcome != "ok" or token is None or user is None:
        raise _map_code_verification_error(outcome)
    _set_vault_cookie(request, response, store, str(user["id"]))
    return {"token": token, "user": user, "parcels": parcels}


@router.post("/auth/google")
async def google_login(
    payload: GoogleAuthPayload,
    request: Request,
    response: Response,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    settings = get_settings()
    client_id = settings.google_client_id.strip()
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth SSO is not configured yet (set GOOGLE_CLIENT_ID in .env).",
        )
    identity = await _verify_google_identity(
        credential=payload.credential,
        access_token=payload.access_token,
        expected_client_id=client_id,
    )
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(vault_cookie, target_email=identity["email"])
    token, user, parcels = store.authenticate_or_register_google(
        google_sub=identity["sub"],
        email=identity["email"],
        name=identity["name"],
        region=payload.region,
        avatar_url=identity["picture"],
    )
    _set_vault_cookie(request, response, store, str(user["id"]))
    return {"token": token, "user": user, "parcels": parcels}


@router.post("/auth/login")
def login_account(
    payload: LoginPayload,
    request: Request,
    response: Response,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(vault_cookie, target_email=payload.email)
    res = store.authenticate_user(payload.email, payload.password)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    token, user, parcels = res
    _set_vault_cookie(request, response, store, str(user["id"]))
    return {"token": token, "user": user, "parcels": parcels}


@router.post("/auth/forgot-password")
async def request_password_reset(
    payload: ForgotPasswordPayload,
    request: Request,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(vault_cookie, target_email=payload.email)
    settings = get_settings()
    reset_code_rec = store.create_password_reset_code(payload.email, ttl_seconds=900)
    smtp_ready = is_smtp_configured(settings)
    delivery_status = "processed_no_leak"
    if reset_code_rec is not None:
        email_res = await send_password_reset_code_email(
            settings,
            reset_code_rec["email"],
            reset_code_rec["name"],
            reset_code_rec["code"],
        )
        delivery_status = str(email_res.get("status") or "queued_awaiting_credentials")
        store.record_dispatch(
            user_id=reset_code_rec["user_id"],
            alert_id=None,
            channel="email",
            recipient=reset_code_rec["email"],
            subject="SpaceFarm Password Reset Code",
            body="6-digit password reset code requested",
            provider=str(email_res.get("provider") or "local_outbox_unconfigured"),
            status=delivery_status,
            error_detail=email_res.get("error_detail"),
        )
    return {
        "ok": True,
        "delivery_status": delivery_status,
        "smtp_configured": smtp_ready,
        "code_dispatched": smtp_ready and delivery_status == "sent",
        "reset_token": (
            str(reset_code_rec.get("reset_token") or "")
            if (reset_code_rec is not None and smtp_ready and delivery_status == "sent")
            else ""
        ),
    }


@router.post("/auth/reset-password")
def reset_password_with_code(
    payload: ResetPasswordPayload,
    request: Request,
    response: Response,
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    vault_cookie = request.cookies.get(VAULT_COOKIE_NAME)
    if vault_cookie:
        store.restore_from_vault_cookie(vault_cookie, target_email=payload.email)
    outcome = store.verify_and_reset_password(
        email=payload.email,
        code=payload.code,
        new_password=payload.new_password,
        reset_token=payload.reset_token,
    )
    if outcome != "ok":
        raise _map_code_verification_error(outcome)
    uid = store.get_user_id_by_email(payload.email)
    if uid:
        _set_vault_cookie(request, response, store, uid)
    return {"ok": True}


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
    request: Request,
    response: Response,
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
    _set_vault_cookie(request, response, store, user_id)
    return {"user": user, "parcels": parcels}


@router.post("/parcels", status_code=status.HTTP_201_CREATED)
def create_parcel(
    payload: ParcelCreatePayload,
    request: Request,
    response: Response,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    parcels = store.create_parcel(user_id, payload.model_dump())
    _set_vault_cookie(request, response, store, user_id)
    return {"parcels": parcels}


@router.put("/parcels/{parcel_id}")
def update_parcel_details(
    parcel_id: str,
    payload: ParcelUpdatePayload,
    request: Request,
    response: Response,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    parcels = store.update_parcel(user_id, parcel_id, payload.model_dump(exclude_unset=True))
    _set_vault_cookie(request, response, store, user_id)
    return {"parcels": parcels}


@router.post("/parcels/{parcel_id}/activate")
def activate_parcel(
    parcel_id: str,
    request: Request,
    response: Response,
    user_id: str = Depends(_require_user_id),
    store: SpaceFarmStore = Depends(_get_store),
) -> dict[str, Any]:
    parcels = store.set_primary_parcel(user_id, parcel_id)
    _set_vault_cookie(request, response, store, user_id)
    return {"parcels": parcels}


@router.delete("/parcels/{parcel_id}")
def remove_parcel(
    parcel_id: str,
    request: Request,
    response: Response,
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
    _set_vault_cookie(request, response, store, user_id)
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
            "smtp_configured": is_smtp_configured(settings),
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
