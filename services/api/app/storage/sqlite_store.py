"""Persistent SQLite storage for real accounts, detailed farm profiles, parcels, and AI logs."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from app.config import Settings, get_settings

REGION_DEFAULTS: dict[str, tuple[str, str, float, float, float, str]] = {
    "ganja-dashkasan": ("ganja-dashkasan", "Ganja–Dashkasan Plot", 40.68, 46.36, 28.4, "wheat"),
    "aran-barda": ("aran-barda", "Aran (Barda–Yevlakh) Plot", 40.38, 47.12, 35.0, "wheat"),
    "quba-khachmaz": ("quba-khachmaz", "Quba–Khachmaz Plot", 41.36, 48.51, 18.0, "maize"),
    "shaki-zagatala": ("shaki-zagatala", "Shaki–Zagatala Plot", 41.19, 47.17, 24.0, "sunflower"),
}

REGION_LAB_DEFAULTS: dict[str, dict[str, Any]] = {
    "ganja-dashkasan": {
        "irrigation_type": "irrigated",
        "irrigation_budget_mm": 240.0,
        "soil_ph": 6.8,
        "soil_texture": "loam",
        "lab_metrics": {
            "organic_matter_pct": 2.4,
            "nitrogen_mg_kg": 42.0,
            "phosphorus_mg_kg": 28.5,
            "potassium_mg_kg": 245.0,
            "ec_ds_m": 0.62,
            "moisture_capacity_pct": 31.0,
            "depth_top_cm": 0,
            "depth_bottom_cm": 30,
            "sample_date": "2025-03-14",
            "lab_report_id": "LAB-AZ-GD-2025",
            "soil_source_type": "laboratory",
        },
    },
    "aran-barda": {
        "irrigation_type": "irrigated",
        "irrigation_budget_mm": 420.0,
        "soil_texture": "loam",
        "soil_ph": 7.3,
        "lab_metrics": {
            "organic_matter_pct": 1.9,
            "nitrogen_mg_kg": 36.0,
            "phosphorus_mg_kg": 24.0,
            "potassium_mg_kg": 268.0,
            "ec_ds_m": 1.15,
            "moisture_capacity_pct": 28.5,
            "depth_top_cm": 0,
            "depth_bottom_cm": 30,
            "sample_date": "2025-03-18",
            "lab_report_id": "LAB-AZ-BR-2025",
            "soil_source_type": "laboratory",
        },
    },
    "quba-khachmaz": {
        "irrigation_type": "irrigated",
        "irrigation_budget_mm": 260.0,
        "soil_ph": 6.4,
        "soil_texture": "clay",
        "lab_metrics": {
            "organic_matter_pct": 3.1,
            "nitrogen_mg_kg": 48.0,
            "phosphorus_mg_kg": 31.0,
            "potassium_mg_kg": 230.0,
            "ec_ds_m": 0.48,
            "moisture_capacity_pct": 34.5,
            "depth_top_cm": 0,
            "depth_bottom_cm": 30,
            "sample_date": "2025-03-21",
            "lab_report_id": "LAB-AZ-QK-2025",
            "soil_source_type": "laboratory",
        },
    },
    "shaki-zagatala": {
        "irrigation_type": "rainfed",
        "irrigation_budget_mm": None,
        "soil_ph": 6.7,
        "soil_texture": "loam",
        "lab_metrics": {
            "organic_matter_pct": 2.9,
            "nitrogen_mg_kg": 45.0,
            "phosphorus_mg_kg": 29.0,
            "potassium_mg_kg": 224.0,
            "ec_ds_m": 0.52,
            "moisture_capacity_pct": 32.0,
            "depth_top_cm": 0,
            "depth_bottom_cm": 30,
            "sample_date": "2025-03-25",
            "lab_report_id": "LAB-AZ-SZ-2025",
            "soil_source_type": "laboratory",
        },
    },
}


def _default_lab_profile(region_id: str | None) -> dict[str, Any]:
    key = (region_id or "ganja-dashkasan").strip().lower()
    template = REGION_LAB_DEFAULTS.get(key) or REGION_LAB_DEFAULTS["ganja-dashkasan"]
    return {
        "irrigation_type": template["irrigation_type"],
        "irrigation_budget_mm": template["irrigation_budget_mm"],
        "soil_ph": template["soil_ph"],
        "soil_texture": template["soil_texture"],
        "lab_metrics": dict(template["lab_metrics"]),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _resolve_region_seed(region_text: str | None) -> tuple[str, str, float, float, float, str]:
    raw = (region_text or "").strip().lower()
    if "aran" in raw or "barda" in raw or "bərdə" in raw:
        return REGION_DEFAULTS["aran-barda"]
    if "quba" in raw or "guba" in raw or "khachmaz" in raw or "xaçmaz" in raw:
        return REGION_DEFAULTS["quba-khachmaz"]
    if "shaki" in raw or "şəki" in raw or "zagatala" in raw or "zaqatala" in raw:
        return REGION_DEFAULTS["shaki-zagatala"]
    return REGION_DEFAULTS["ganja-dashkasan"]


class SpaceFarmStore:
    """Thread-safe per-call SQLite repository rooted under `settings.data_root_path`."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.data_root = self.settings.data_root_path
        self.db_path = self.data_root / "spacefarm.db"
        self.secret_path = self.data_root / ".auth_secret"
        os.makedirs(self.data_root, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA foreign_keys = ON;")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    region TEXT NOT NULL DEFAULT 'Ganja-Dashkasan',
                    username TEXT NOT NULL DEFAULT '',
                    phone_code TEXT NOT NULL DEFAULT 'AZ +994',
                    phone TEXT NOT NULL DEFAULT '',
                    active_since TEXT NOT NULL DEFAULT '2024-01-01',
                    role_type TEXT NOT NULL DEFAULT 'farmer',
                    irrigation_pref TEXT NOT NULL DEFAULT 'irrigated',
                    bio TEXT NOT NULL DEFAULT '',
                    avatar_data_url TEXT DEFAULT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS farm_parcels (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    label TEXT NOT NULL,
                    region_id TEXT NOT NULL DEFAULT 'custom',
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    area_ha REAL NOT NULL DEFAULT 25.0,
                    irrigation_type TEXT NOT NULL DEFAULT 'irrigated',
                    irrigation_budget_mm REAL DEFAULT 240.0,
                    soil_ph REAL DEFAULT 6.8,
                    soil_texture TEXT NOT NULL DEFAULT 'loam',
                    prior_crop_id TEXT NOT NULL DEFAULT 'wheat',
                    lab_metrics_json TEXT NOT NULL DEFAULT '{}',
                    is_primary INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ai_messages (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    meta_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS parcel_risk_snapshots (
                    parcel_id TEXT PRIMARY KEY REFERENCES farm_parcels(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    parcel_label TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    overall_severity TEXT NOT NULL DEFAULT 'low',
                    frost_risk TEXT NOT NULL DEFAULT 'low',
                    drought_risk TEXT NOT NULL DEFAULT 'low',
                    heat_risk TEXT NOT NULL DEFAULT 'low',
                    rain_risk TEXT NOT NULL DEFAULT 'low',
                    forecast_tmin_c REAL DEFAULT NULL,
                    forecast_tmax_c REAL DEFAULT NULL,
                    forecast_precip_7d_mm REAL DEFAULT NULL,
                    forecast_et0_7d_mm REAL DEFAULT NULL,
                    water_balance_mm REAL DEFAULT NULL,
                    nasa_root_wetness REAL DEFAULT NULL,
                    summary_az TEXT NOT NULL DEFAULT '',
                    summary_en TEXT NOT NULL DEFAULT '',
                    daily_forecast_json TEXT NOT NULL DEFAULT '[]',
                    last_scanned_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS weather_alerts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    parcel_id TEXT NOT NULL REFERENCES farm_parcels(id) ON DELETE CASCADE,
                    parcel_label TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    risk_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    title_az TEXT NOT NULL,
                    title_en TEXT NOT NULL,
                    message_az TEXT NOT NULL,
                    message_en TEXT NOT NULL,
                    trigger_metric TEXT NOT NULL,
                    metrics_json TEXT NOT NULL DEFAULT '{}',
                    source TEXT NOT NULL DEFAULT 'open-meteo+nasa-power',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS notification_preferences (
                    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    sms_enabled INTEGER NOT NULL DEFAULT 1,
                    email_enabled INTEGER NOT NULL DEFAULT 1,
                    min_severity TEXT NOT NULL DEFAULT 'high',
                    custom_frost_c REAL NOT NULL DEFAULT 1.0,
                    custom_heat_c REAL NOT NULL DEFAULT 36.0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS notification_dispatches (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    alert_id TEXT DEFAULT NULL,
                    channel TEXT NOT NULL,
                    recipient TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    body TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    status TEXT NOT NULL,
                    error_detail TEXT DEFAULT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS password_reset_requests (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    email TEXT NOT NULL,
                    token_hash TEXT NOT NULL,
                    delivery_status TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            cols = {r["name"] for r in conn.execute("PRAGMA table_info(farm_parcels)").fetchall()}
            if "lab_metrics_json" not in cols:
                conn.execute(
                    "ALTER TABLE farm_parcels ADD COLUMN lab_metrics_json TEXT NOT NULL DEFAULT '{}'"
                )
            # Upgrade legacy parcels seeded with NULL/unknown so all saved fields have baseline Lab chemistry
            legacy_rows = conn.execute(
                "SELECT id, region_id, irrigation_type, irrigation_budget_mm, soil_ph, soil_texture, lab_metrics_json FROM farm_parcels"
            ).fetchall()
            for r in legacy_rows:
                profile = _default_lab_profile(r["region_id"])
                needs_chem_upgrade = r["soil_ph"] is None or r["irrigation_type"] == "unknown"
                raw_json = (r["lab_metrics_json"] or "{}").strip()
                needs_lab_json = raw_json in ("", "{}")
                if needs_chem_upgrade or needs_lab_json:
                    next_irrig = profile["irrigation_type"] if r["irrigation_type"] == "unknown" else r["irrigation_type"]
                    next_budget = (
                        profile["irrigation_budget_mm"]
                        if r["irrigation_budget_mm"] is None and next_irrig == "irrigated"
                        else r["irrigation_budget_mm"]
                    )
                    next_ph = profile["soil_ph"] if r["soil_ph"] is None else r["soil_ph"]
                    next_tex = profile["soil_texture"] if r["soil_texture"] in ("unknown", "", None) else r["soil_texture"]
                    next_lab_json = json.dumps(profile["lab_metrics"]) if needs_lab_json else raw_json
                    conn.execute(
                        """
                        UPDATE farm_parcels
                        SET irrigation_type = ?, irrigation_budget_mm = ?, soil_ph = ?,
                            soil_texture = ?, lab_metrics_json = ?
                        WHERE id = ?
                        """,
                        (next_irrig, next_budget, next_ph, next_tex, next_lab_json, r["id"]),
                    )

    def _signing_secret(self) -> bytes:
        env_secret = os.environ.get("SPACEFARM_AUTH_SECRET", "").strip()
        if env_secret:
            return env_secret.encode("utf-8")
        if self.secret_path.exists():
            return self.secret_path.read_bytes().strip()
        token = secrets.token_hex(32).encode("utf-8")
        self.secret_path.write_bytes(token)
        return token

    @staticmethod
    def hash_password(password: str) -> str:
        salt = secrets.token_bytes(16)
        derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1)
        return f"scrypt${salt.hex()}${derived.hex()}"

    @staticmethod
    def verify_password(password: str, stored_hash: str) -> bool:
        try:
            scheme, salt_hex, hash_hex = stored_hash.split("$", 2)
            if scheme != "scrypt":
                return False
            salt = bytes.fromhex(salt_hex)
            expected = bytes.fromhex(hash_hex)
            derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1)
            return hmac.compare_digest(derived, expected)
        except (ValueError, TypeError):
            return False

    def create_token(self, user_id: str, ttl_seconds: int = 86400 * 14) -> str:
        exp = int(time.time()) + ttl_seconds
        payload = f"{user_id}:{exp}"
        sig = hmac.new(self._signing_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{payload}:{sig}"

    def verify_token(self, token: str) -> str | None:
        try:
            user_id, exp_str, sig = token.strip().split(":", 2)
            payload = f"{user_id}:{exp_str}"
            expected = hmac.new(
                self._signing_secret(), payload.encode("utf-8"), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(sig, expected):
                return None
            if int(exp_str) < int(time.time()):
                return None
            return user_id
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _row_to_profile(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "region": row["region"],
            "username": row["username"],
            "phone_code": row["phone_code"],
            "phone": row["phone"],
            "active_since": row["active_since"],
            "role_type": row["role_type"],
            "irrigation_pref": row["irrigation_pref"],
            "bio": row["bio"],
            "avatar_data_url": row["avatar_data_url"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    @staticmethod
    def _row_to_parcel(row: sqlite3.Row) -> dict[str, Any]:
        defaults = _default_lab_profile(row["region_id"])
        raw_metrics: dict[str, Any] = {}
        if "lab_metrics_json" in row.keys():
            try:
                parsed = json.loads(row["lab_metrics_json"] or "{}")
                if isinstance(parsed, dict):
                    raw_metrics = parsed
            except json.JSONDecodeError:
                raw_metrics = {}
        merged_lab = {**defaults["lab_metrics"], **raw_metrics}
        soil_ph = row["soil_ph"] if row["soil_ph"] is not None else defaults["soil_ph"]
        irrig = row["irrigation_type"] if row["irrigation_type"] != "unknown" else defaults["irrigation_type"]
        budget = row["irrigation_budget_mm"]
        if budget is None and irrig == "irrigated":
            budget = defaults["irrigation_budget_mm"]
        return {
            "id": row["id"],
            "label": row["label"],
            "region_id": row["region_id"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "area_ha": row["area_ha"],
            "irrigation_type": irrig,
            "irrigation_budget_mm": budget,
            "soil_ph": soil_ph,
            "soil_texture": row["soil_texture"] if row["soil_texture"] != "unknown" else defaults["soil_texture"],
            "prior_crop_id": row["prior_crop_id"],
            "lab_metrics": merged_lab,
            "is_primary": bool(row["is_primary"]),
            "created_at": row["created_at"],
        }

    def register_user(
        self,
        *,
        name: str,
        email: str,
        password: str,
        region: str = "Ganja-Dashkasan",
    ) -> tuple[str, dict[str, Any], list[dict[str, Any]]]:
        clean_email = email.strip().lower()
        clean_name = name.strip()
        clean_region = region.strip() or "Ganja-Dashkasan"
        handle_base = "".join(ch for ch in clean_email.split("@")[0].lower() if ch.isalnum() or ch in {"_", "."})
        username = f"@{handle_base[:24]}" if handle_base else "@farmer"
        now = _now_iso()
        today_str = now[:10]
        user_id = f"usr-{uuid.uuid4().hex[:12]}"
        pw_hash = self.hash_password(password)

        reg_id, parcel_label, lat, lon, area_ha, crop_id = _resolve_region_seed(clean_region)
        lab_seed = _default_lab_profile(reg_id)
        parcel_id = f"pcl-{uuid.uuid4().hex[:10]}"

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO users (
                    id, name, email, password_hash, region, username, phone_code,
                    phone, active_since, role_type, irrigation_pref, bio,
                    avatar_data_url, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'AZ +994', '', ?, 'farmer', 'irrigated', '', NULL, ?, ?)
                """,
                (user_id, clean_name, clean_email, pw_hash, clean_region, username, today_str, now, now),
            )
            conn.execute(
                """
                INSERT INTO farm_parcels (
                    id, user_id, label, region_id, latitude, longitude, area_ha,
                    irrigation_type, irrigation_budget_mm, soil_ph, soil_texture,
                    prior_crop_id, lab_metrics_json, is_primary, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    parcel_id,
                    user_id,
                    parcel_label,
                    reg_id,
                    lat,
                    lon,
                    area_ha,
                    lab_seed["irrigation_type"],
                    lab_seed["irrigation_budget_mm"],
                    lab_seed["soil_ph"],
                    lab_seed["soil_texture"],
                    crop_id,
                    json.dumps(lab_seed["lab_metrics"]),
                    now,
                ),
            )

        profile, parcels = self.get_user_bundle(user_id)
        if profile is None:
            raise RuntimeError("Failed to read created user")
        return self.create_token(user_id), profile, parcels

    def email_exists(self, email: str) -> bool:
        clean_email = email.strip().lower()
        with self._connect() as conn:
            row = conn.execute("SELECT 1 FROM users WHERE email = ?", (clean_email,)).fetchone()
            return row is not None

    def authenticate_user(
        self, email: str, password: str
    ) -> tuple[str, dict[str, Any], list[dict[str, Any]]] | None:
        clean_email = email.strip().lower()
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (clean_email,)).fetchone()
        if not row or not self.verify_password(password, row["password_hash"]):
            return None
        profile, parcels = self.get_user_bundle(row["id"])
        if not profile:
            return None
        return self.create_token(row["id"]), profile, parcels

    def get_user_bundle(self, user_id: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        with self._connect() as conn:
            user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not user_row:
                return None, []
            parcel_rows = conn.execute(
                "SELECT * FROM farm_parcels WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC",
                (user_id,),
            ).fetchall()
        return self._row_to_profile(user_row), [self._row_to_parcel(r) for r in parcel_rows]

    def update_user_profile(
        self, user_id: str, patch: dict[str, Any]
    ) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        allowed = (
            "name",
            "email",
            "region",
            "username",
            "phone_code",
            "phone",
            "active_since",
            "role_type",
            "irrigation_pref",
            "bio",
            "avatar_data_url",
        )
        updates: list[str] = []
        values: list[Any] = []
        for key in allowed:
            if key in patch:
                val = patch[key]
                if key == "email" and isinstance(val, str):
                    val = val.strip().lower()
                updates.append(f"{key} = ?")
                values.append(val)
        if updates:
            updates.append("updated_at = ?")
            values.append(_now_iso())
            values.append(user_id)
            with self._connect() as conn:
                conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", values)
        return self.get_user_bundle(user_id)

    def create_parcel(self, user_id: str, data: dict[str, Any]) -> list[dict[str, Any]]:
        parcel_id = f"pcl-{uuid.uuid4().hex[:10]}"
        now = _now_iso()
        is_primary = 1 if data.get("is_primary") else 0
        region_id = str(data.get("region_id", "custom")).strip()[:80]
        lab_seed = _default_lab_profile(region_id)
        irrig = str(data.get("irrigation_type") or lab_seed["irrigation_type"])
        if irrig == "unknown":
            irrig = lab_seed["irrigation_type"]
        budget = data.get("irrigation_budget_mm")
        if budget is None and irrig == "irrigated":
            budget = lab_seed["irrigation_budget_mm"]
        soil_ph = data.get("soil_ph") if data.get("soil_ph") is not None else lab_seed["soil_ph"]
        soil_tex = str(data.get("soil_texture") or lab_seed["soil_texture"])
        if soil_tex == "unknown":
            soil_tex = lab_seed["soil_texture"]
        lab_metrics = {
            **lab_seed["lab_metrics"],
            **(data.get("lab_metrics") or {}),
        }
        with self._connect() as conn:
            if is_primary:
                conn.execute("UPDATE farm_parcels SET is_primary = 0 WHERE user_id = ?", (user_id,))
            conn.execute(
                """
                INSERT INTO farm_parcels (
                    id, user_id, label, region_id, latitude, longitude, area_ha,
                    irrigation_type, irrigation_budget_mm, soil_ph, soil_texture,
                    prior_crop_id, lab_metrics_json, is_primary, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    parcel_id,
                    user_id,
                    str(data.get("label", "Custom Parcel")).strip()[:160],
                    region_id,
                    float(data["latitude"]),
                    float(data["longitude"]),
                    float(data.get("area_ha", 25.0)),
                    irrig,
                    budget,
                    soil_ph,
                    soil_tex,
                    str(data.get("prior_crop_id", "wheat")),
                    json.dumps(lab_metrics),
                    is_primary,
                    now,
                ),
            )
        _, parcels = self.get_user_bundle(user_id)
        return parcels

    def update_parcel(
        self, user_id: str, parcel_id: str, data: dict[str, Any]
    ) -> list[dict[str, Any]]:
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT * FROM farm_parcels WHERE user_id = ? AND id = ?",
                (user_id, parcel_id),
            ).fetchone()
            if not existing:
                _, parcels = self.get_user_bundle(user_id)
                return parcels
            scalar_fields = (
                "label",
                "region_id",
                "latitude",
                "longitude",
                "area_ha",
                "irrigation_type",
                "irrigation_budget_mm",
                "soil_ph",
                "soil_texture",
                "prior_crop_id",
            )
            updates: list[str] = []
            values: list[Any] = []
            for key in scalar_fields:
                if key in data and data[key] is not None:
                    updates.append(f"{key} = ?")
                    val = data[key]
                    if key == "label":
                        val = str(val).strip()[:160]
                    elif key == "region_id":
                        val = str(val).strip()[:80]
                    values.append(val)
            if "irrigation_budget_mm" in data and data["irrigation_budget_mm"] is None and data.get("irrigation_type") == "rainfed":
                updates.append("irrigation_budget_mm = NULL")
            if isinstance(data.get("lab_metrics"), dict):
                try:
                    prev_lab = json.loads(existing["lab_metrics_json"] or "{}")
                    if not isinstance(prev_lab, dict):
                        prev_lab = {}
                except json.JSONDecodeError:
                    prev_lab = {}
                cleaned_lab = {k: v for k, v in data["lab_metrics"].items() if v is not None}
                merged_lab = {**prev_lab, **cleaned_lab}
                updates.append("lab_metrics_json = ?")
                values.append(json.dumps(merged_lab))
            if updates:
                values.extend([user_id, parcel_id])
                conn.execute(
                    f"UPDATE farm_parcels SET {', '.join(updates)} WHERE user_id = ? AND id = ?",
                    values,
                )
        _, parcels = self.get_user_bundle(user_id)
        return parcels

    def set_primary_parcel(self, user_id: str, parcel_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            conn.execute("UPDATE farm_parcels SET is_primary = 0 WHERE user_id = ?", (user_id,))
            conn.execute(
                "UPDATE farm_parcels SET is_primary = 1 WHERE user_id = ? AND id = ?",
                (user_id, parcel_id),
            )
        _, parcels = self.get_user_bundle(user_id)
        return parcels

    def delete_parcel(self, user_id: str, parcel_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM farm_parcels WHERE user_id = ? AND id = ?",
                (user_id, parcel_id),
            )
        _, parcels = self.get_user_bundle(user_id)
        return parcels

    def list_ai_messages(self, user_id: str, limit: int = 40) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, role, content, meta_json, created_at
                FROM ai_messages
                WHERE user_id = ?
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            try:
                meta = json.loads(r["meta_json"] or "{}")
            except json.JSONDecodeError:
                meta = {}
            out.append(
                {
                    "id": r["id"],
                    "role": r["role"],
                    "content": r["content"],
                    "meta": meta,
                    "created_at": r["created_at"],
                }
            )
        return out

    def append_ai_message(
        self,
        user_id: str,
        *,
        role: str,
        content: str,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        msg_id = f"ai-{uuid.uuid4().hex[:12]}"
        now = _now_iso()
        meta_json = json.dumps(meta or {}, ensure_ascii=False)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO ai_messages (id, user_id, role, content, meta_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (msg_id, user_id, role, content, meta_json, now),
            )
        return {
            "id": msg_id,
            "role": role,
            "content": content,
            "meta": meta or {},
            "created_at": now,
        }

    def clear_ai_messages(self, user_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM ai_messages WHERE user_id = ?", (user_id,))

    # ------------------------------------------------------------------
    # Weather risk monitoring, alert lifecycle, & notification outbox
    # ------------------------------------------------------------------

    def get_notification_preferences(self, user_id: str) -> dict[str, Any]:
        now = _now_iso()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM notification_preferences WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            if row is None:
                conn.execute(
                    """
                    INSERT INTO notification_preferences (
                        user_id, sms_enabled, email_enabled, min_severity,
                        custom_frost_c, custom_heat_c, updated_at
                    ) VALUES (?, 1, 1, 'high', 1.0, 36.0, ?)
                    """,
                    (user_id, now),
                )
                return {
                    "sms_enabled": True,
                    "email_enabled": True,
                    "min_severity": "high",
                    "custom_frost_c": 1.0,
                    "custom_heat_c": 36.0,
                    "updated_at": now,
                }
        return {
            "sms_enabled": bool(row["sms_enabled"]),
            "email_enabled": bool(row["email_enabled"]),
            "min_severity": str(row["min_severity"]),
            "custom_frost_c": float(row["custom_frost_c"]),
            "custom_heat_c": float(row["custom_heat_c"]),
            "updated_at": str(row["updated_at"]),
        }

    def save_notification_preferences(
        self, user_id: str, patch: dict[str, Any]
    ) -> dict[str, Any]:
        current = self.get_notification_preferences(user_id)
        merged = {
            "sms_enabled": bool(patch.get("sms_enabled", current["sms_enabled"])),
            "email_enabled": bool(patch.get("email_enabled", current["email_enabled"])),
            "min_severity": str(patch.get("min_severity", current["min_severity"])),
            "custom_frost_c": float(patch.get("custom_frost_c", current["custom_frost_c"])),
            "custom_heat_c": float(patch.get("custom_heat_c", current["custom_heat_c"])),
            "updated_at": _now_iso(),
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO notification_preferences (
                    user_id, sms_enabled, email_enabled, min_severity,
                    custom_frost_c, custom_heat_c, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    sms_enabled = excluded.sms_enabled,
                    email_enabled = excluded.email_enabled,
                    min_severity = excluded.min_severity,
                    custom_frost_c = excluded.custom_frost_c,
                    custom_heat_c = excluded.custom_heat_c,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id,
                    1 if merged["sms_enabled"] else 0,
                    1 if merged["email_enabled"] else 0,
                    merged["min_severity"],
                    merged["custom_frost_c"],
                    merged["custom_heat_c"],
                    merged["updated_at"],
                ),
            )
        return merged

    def list_all_monitored_users_with_parcels(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            user_rows = conn.execute("SELECT * FROM users ORDER BY created_at ASC").fetchall()
            parcel_rows = conn.execute(
                "SELECT * FROM farm_parcels ORDER BY is_primary DESC, created_at ASC"
            ).fetchall()
        parcels_by_user: dict[str, list[dict[str, Any]]] = {}
        for prow in parcel_rows:
            uid = str(prow["user_id"])
            parcels_by_user.setdefault(uid, []).append(self._row_to_parcel(prow))

        monitored: list[dict[str, Any]] = []
        for urow in user_rows:
            profile = self._row_to_profile(urow)
            uid = profile["id"]
            monitored.append(
                {
                    "user": profile,
                    "parcels": parcels_by_user.get(uid, []),
                    "prefs": self.get_notification_preferences(uid),
                }
            )
        return monitored

    def upsert_parcel_risk_snapshot(
        self, user_id: str, snapshot: dict[str, Any]
    ) -> dict[str, Any]:
        daily_json = json.dumps(snapshot.get("daily_forecast") or [], ensure_ascii=False)
        scanned_at = str(snapshot.get("last_scanned_at") or _now_iso())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO parcel_risk_snapshots (
                    parcel_id, user_id, parcel_label, latitude, longitude,
                    overall_severity, frost_risk, drought_risk, heat_risk, rain_risk,
                    forecast_tmin_c, forecast_tmax_c, forecast_precip_7d_mm,
                    forecast_et0_7d_mm, water_balance_mm, nasa_root_wetness,
                    summary_az, summary_en, daily_forecast_json, last_scanned_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(parcel_id) DO UPDATE SET
                    user_id = excluded.user_id,
                    parcel_label = excluded.parcel_label,
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    overall_severity = excluded.overall_severity,
                    frost_risk = excluded.frost_risk,
                    drought_risk = excluded.drought_risk,
                    heat_risk = excluded.heat_risk,
                    rain_risk = excluded.rain_risk,
                    forecast_tmin_c = excluded.forecast_tmin_c,
                    forecast_tmax_c = excluded.forecast_tmax_c,
                    forecast_precip_7d_mm = excluded.forecast_precip_7d_mm,
                    forecast_et0_7d_mm = excluded.forecast_et0_7d_mm,
                    water_balance_mm = excluded.water_balance_mm,
                    nasa_root_wetness = excluded.nasa_root_wetness,
                    summary_az = excluded.summary_az,
                    summary_en = excluded.summary_en,
                    daily_forecast_json = excluded.daily_forecast_json,
                    last_scanned_at = excluded.last_scanned_at
                """,
                (
                    snapshot["parcel_id"],
                    user_id,
                    snapshot["parcel_label"],
                    float(snapshot["latitude"]),
                    float(snapshot["longitude"]),
                    snapshot["overall_severity"],
                    snapshot["frost_risk"],
                    snapshot["drought_risk"],
                    snapshot["heat_risk"],
                    snapshot["rain_risk"],
                    snapshot.get("forecast_tmin_c"),
                    snapshot.get("forecast_tmax_c"),
                    snapshot.get("forecast_precip_7d_mm"),
                    snapshot.get("forecast_et0_7d_mm"),
                    snapshot.get("water_balance_mm"),
                    snapshot.get("nasa_root_wetness"),
                    snapshot.get("summary_az", ""),
                    snapshot.get("summary_en", ""),
                    daily_json,
                    scanned_at,
                ),
            )
        return {**snapshot, "last_scanned_at": scanned_at}

    def list_parcel_risk_snapshots(self, user_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT s.*, p.is_primary, p.area_ha, p.irrigation_type, p.prior_crop_id
                FROM parcel_risk_snapshots s
                JOIN farm_parcels p ON p.id = s.parcel_id
                WHERE s.user_id = ?
                ORDER BY p.is_primary DESC, s.last_scanned_at DESC
                """,
                (user_id,),
            ).fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            try:
                daily = json.loads(r["daily_forecast_json"] or "[]")
            except json.JSONDecodeError:
                daily = []
            out.append(
                {
                    "parcel_id": r["parcel_id"],
                    "parcel_label": r["parcel_label"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "is_primary": bool(r["is_primary"]),
                    "area_ha": r["area_ha"],
                    "irrigation_type": r["irrigation_type"],
                    "prior_crop_id": r["prior_crop_id"],
                    "overall_severity": r["overall_severity"],
                    "frost_risk": r["frost_risk"],
                    "drought_risk": r["drought_risk"],
                    "heat_risk": r["heat_risk"],
                    "rain_risk": r["rain_risk"],
                    "forecast_tmin_c": r["forecast_tmin_c"],
                    "forecast_tmax_c": r["forecast_tmax_c"],
                    "forecast_precip_7d_mm": r["forecast_precip_7d_mm"],
                    "forecast_et0_7d_mm": r["forecast_et0_7d_mm"],
                    "water_balance_mm": r["water_balance_mm"],
                    "nasa_root_wetness": r["nasa_root_wetness"],
                    "summary_az": r["summary_az"],
                    "summary_en": r["summary_en"],
                    "daily_forecast": daily,
                    "last_scanned_at": r["last_scanned_at"],
                }
            )
        return out

    def has_recent_similar_alert(
        self,
        *,
        user_id: str,
        parcel_id: str,
        risk_type: str,
        severity: str,
        cooldown_hours: int,
    ) -> bool:
        cutoff = (
            datetime.now(timezone.utc) - timedelta(hours=max(1, cooldown_hours))
        ).replace(microsecond=0).isoformat()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT 1 FROM weather_alerts
                WHERE user_id = ?
                  AND parcel_id = ?
                  AND risk_type = ?
                  AND severity = ?
                  AND status != 'resolved'
                  AND created_at >= ?
                LIMIT 1
                """,
                (user_id, parcel_id, risk_type, severity, cutoff),
            ).fetchone()
        return row is not None

    def create_weather_alert(self, user_id: str, alert: dict[str, Any]) -> dict[str, Any]:
        alert_id = f"alt-{uuid.uuid4().hex[:12]}"
        now = _now_iso()
        metrics_json = json.dumps(alert.get("metrics") or {}, ensure_ascii=False)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO weather_alerts (
                    id, user_id, parcel_id, parcel_label, latitude, longitude,
                    risk_type, severity, status, title_az, title_en,
                    message_az, message_en, trigger_metric, metrics_json,
                    source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    alert_id,
                    user_id,
                    alert["parcel_id"],
                    alert["parcel_label"],
                    float(alert["latitude"]),
                    float(alert["longitude"]),
                    alert["risk_type"],
                    alert["severity"],
                    alert["title_az"],
                    alert["title_en"],
                    alert["message_az"],
                    alert["message_en"],
                    alert["trigger_metric"],
                    metrics_json,
                    alert.get("source", "open-meteo+nasa-power"),
                    now,
                    now,
                ),
            )
        return {
            "id": alert_id,
            "user_id": user_id,
            "parcel_id": alert["parcel_id"],
            "parcel_label": alert["parcel_label"],
            "latitude": float(alert["latitude"]),
            "longitude": float(alert["longitude"]),
            "risk_type": alert["risk_type"],
            "severity": alert["severity"],
            "status": "active",
            "title_az": alert["title_az"],
            "title_en": alert["title_en"],
            "message_az": alert["message_az"],
            "message_en": alert["message_en"],
            "trigger_metric": alert["trigger_metric"],
            "metrics": alert.get("metrics") or {},
            "source": alert.get("source", "open-meteo+nasa-power"),
            "created_at": now,
            "updated_at": now,
        }

    def list_weather_alerts(
        self, user_id: str, *, status_filter: str | None = None, limit: int = 60
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM weather_alerts WHERE user_id = ?"
        params: list[Any] = [user_id]
        if status_filter and status_filter != "all":
            query += " AND status = ?"
            params.append(status_filter)
        query += (
            " ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC,"
            " CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END ASC,"
            " created_at DESC LIMIT ?"
        )
        params.append(limit)
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            try:
                metrics = json.loads(r["metrics_json"] or "{}")
            except json.JSONDecodeError:
                metrics = {}
            out.append(
                {
                    "id": r["id"],
                    "parcel_id": r["parcel_id"],
                    "parcel_label": r["parcel_label"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "risk_type": r["risk_type"],
                    "severity": r["severity"],
                    "status": r["status"],
                    "title_az": r["title_az"],
                    "title_en": r["title_en"],
                    "message_az": r["message_az"],
                    "message_en": r["message_en"],
                    "trigger_metric": r["trigger_metric"],
                    "metrics": metrics,
                    "source": r["source"],
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"],
                }
            )
        return out

    def update_weather_alert_status(
        self, user_id: str, alert_id: str, new_status: str
    ) -> dict[str, Any] | None:
        now = _now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE weather_alerts
                SET status = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (new_status, now, alert_id, user_id),
            )
            r = conn.execute(
                "SELECT * FROM weather_alerts WHERE id = ? AND user_id = ?",
                (alert_id, user_id),
            ).fetchone()
        if r is None:
            return None
        try:
            metrics = json.loads(r["metrics_json"] or "{}")
        except json.JSONDecodeError:
            metrics = {}
        return {
            "id": r["id"],
            "parcel_id": r["parcel_id"],
            "parcel_label": r["parcel_label"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "risk_type": r["risk_type"],
            "severity": r["severity"],
            "status": r["status"],
            "title_az": r["title_az"],
            "title_en": r["title_en"],
            "message_az": r["message_az"],
            "message_en": r["message_en"],
            "trigger_metric": r["trigger_metric"],
            "metrics": metrics,
            "source": r["source"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }

    def record_dispatch(
        self,
        *,
        user_id: str,
        alert_id: str | None,
        channel: str,
        recipient: str,
        subject: str,
        body: str,
        provider: str,
        status: str,
        error_detail: str | None = None,
    ) -> dict[str, Any]:
        dispatch_id = f"dsp-{uuid.uuid4().hex[:12]}"
        now = _now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO notification_dispatches (
                    id, user_id, alert_id, channel, recipient,
                    subject, body, provider, status, error_detail, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    dispatch_id,
                    user_id,
                    alert_id,
                    channel,
                    recipient,
                    subject,
                    body,
                    provider,
                    status,
                    error_detail,
                    now,
                ),
            )
        return {
            "id": dispatch_id,
            "alert_id": alert_id,
            "channel": channel,
            "recipient": recipient,
            "subject": subject,
            "body": body,
            "provider": provider,
            "status": status,
            "error_detail": error_detail,
            "created_at": now,
        }

    def list_notification_dispatches(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM notification_dispatches
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        return [
            {
                "id": r["id"],
                "alert_id": r["alert_id"],
                "channel": r["channel"],
                "recipient": r["recipient"],
                "subject": r["subject"],
                "body": r["body"],
                "provider": r["provider"],
                "status": r["status"],
                "error_detail": r["error_detail"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]

    def create_password_reset_request(self, email: str, ttl_seconds: int = 1800) -> dict[str, Any] | None:
        clean_email = email.strip().lower()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, name, email FROM users WHERE email = ?",
                (clean_email,),
            ).fetchone()
            if not row:
                return None
            raw_token = secrets.token_urlsafe(24)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            req_id = f"pwr-{uuid.uuid4().hex[:12]}"
            expires_at = int(time.time()) + ttl_seconds
            now = _now_iso()
            conn.execute(
                """
                INSERT INTO password_reset_requests (
                    id, user_id, email, token_hash, delivery_status, expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (req_id, row["id"], row["email"], token_hash, "pending_dispatch", expires_at, now),
            )
        return {
            "request_id": req_id,
            "user_id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "expires_at": expires_at,
            "created_at": now,
        }

    def update_password_reset_status(self, request_id: str, delivery_status: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE password_reset_requests SET delivery_status = ? WHERE id = ?",
                (delivery_status, request_id),
            )
