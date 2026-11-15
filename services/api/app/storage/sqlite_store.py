"""Persistent SQLite storage for real accounts, detailed farm profiles, parcels, and AI logs."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from app.config import Settings, get_settings

VAULT_COOKIE_NAME = "sf_account_vault"
_SCHEMA_INIT_LOCK = threading.Lock()
_INITIALIZED_DB_PATHS: set[str] = set()

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
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def _resolve_region_seed(region_text: str | None) -> tuple[str, str, float, float, float, str]:
    raw = (region_text or "").strip().lower()
    if "aran" in raw or "barda" in raw or "bərdə" in raw:
        return REGION_DEFAULTS["aran-barda"]
    if "quba" in raw or "guba" in raw or "khachmaz" in raw or "xaçmaz" in raw:
        return REGION_DEFAULTS["quba-khachmaz"]
    if "shaki" in raw or "şəki" in raw or "zagatala" in raw or "zaqatala" in raw:
        return REGION_DEFAULTS["shaki-zagatala"]
    if raw and not ("ganja" in raw or "gəncə" in raw or "dashkasan" in raw or "daşkəsən" in raw):
        from app.data_adapters.az_districts import find_az_district

        district = find_az_district(region_text)
        if district is not None:
            return (
                district["id"],
                f"{district['name_az']} Sahə 01",
                float(district["latitude"]),
                float(district["longitude"]),
                42.0,
                str(district["irrigation_type"]),
            )
    return REGION_DEFAULTS["ganja-dashkasan"]


class SpaceFarmStore:
    """Thread-safe per-call SQLite repository rooted under `settings.data_root_path`."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.data_root = self.settings.runtime_data_dir_path
        self.db_path = self.data_root / "spacefarm.db"
        self.secret_path = self.data_root / ".auth_secret"
        os.makedirs(self.data_root, exist_ok=True)
        resolved_key = str(self.db_path.resolve())
        with _SCHEMA_INIT_LOCK:
            if resolved_key not in _INITIALIZED_DB_PATHS or not self.db_path.exists():
                self._init_schema()
                _INITIALIZED_DB_PATHS.add(resolved_key)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA busy_timeout = 10000;")
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
            try:
                conn.execute("PRAGMA journal_mode = WAL;")
            except sqlite3.OperationalError:
                pass
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

                CREATE TABLE IF NOT EXISTS registration_otp_codes (
                    email TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    region TEXT NOT NULL,
                    otp_hash TEXT NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    expires_at INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS password_reset_codes (
                    email TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    code_hash TEXT NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    expires_at INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            user_cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
            if "google_sub" not in user_cols:
                conn.execute(
                    "ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT NULL"
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

    def create_token(
        self,
        user_id: str,
        ttl_seconds: int = 86400 * 14,
        *,
        profile: dict[str, Any] | None = None,
        parcels: list[dict[str, Any]] | None = None,
    ) -> str:
        exp = int(time.time()) + ttl_seconds
        if profile is None and parcels is None:
            loaded_profile, loaded_parcels = self.get_user_bundle(user_id)
            profile = loaded_profile
            parcels = loaded_parcels
        primary_pid = str(parcels[0]["id"]) if parcels else ""
        claims: dict[str, Any] = {
            "v": 2,
            "sub": user_id,
            "exp": exp,
            "email": str((profile or {}).get("email") or ""),
            "name": str((profile or {}).get("name") or ""),
            "region": str((profile or {}).get("region") or "Ganja-Dashkasan"),
            "pid": primary_pid,
        }
        raw = json.dumps(claims, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
        sig = hmac.new(self._signing_secret(), encoded.encode("ascii"), hashlib.sha256).hexdigest()
        return f"v2.{encoded}.{sig}"

    def verify_token_claims(self, token: str) -> dict[str, Any] | None:
        clean = token.strip()
        if not clean:
            return None
        try:
            if clean.startswith("v2."):
                _, encoded, sig = clean.split(".", 2)
                expected = hmac.new(
                    self._signing_secret(), encoded.encode("ascii"), hashlib.sha256
                ).hexdigest()
                if not hmac.compare_digest(sig, expected):
                    return None
                padded = encoded + ("=" * ((-len(encoded)) % 4))
                claims = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
                if not isinstance(claims, dict):
                    return None
                if int(claims.get("exp", 0)) < int(time.time()):
                    return None
                sub = str(claims.get("sub") or "").strip()
                if not sub:
                    return None
                return claims

            user_id, exp_str, sig = clean.split(":", 2)
            payload = f"{user_id}:{exp_str}"
            expected = hmac.new(
                self._signing_secret(), payload.encode("utf-8"), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(sig, expected):
                return None
            if int(exp_str) < int(time.time()):
                return None
            return {"v": 1, "sub": user_id, "exp": int(exp_str)}
        except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
            return None

    def verify_token(self, token: str) -> str | None:
        claims = self.verify_token_claims(token)
        return str(claims["sub"]) if claims else None

    def _sign_compact_payload(self, prefix: str, payload: dict[str, Any]) -> str:
        raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
        signing_input = f"{prefix}.{encoded}".encode("ascii")
        sig = hmac.new(self._signing_secret(), signing_input, hashlib.sha256).hexdigest()
        return f"{prefix}.{encoded}.{sig}"

    def _verify_compact_payload(self, token: str | None, expected_prefix: str) -> dict[str, Any] | None:
        clean = (token or "").strip()
        if not clean or not clean.startswith(f"{expected_prefix}."):
            return None
        try:
            prefix, encoded, sig = clean.split(".", 2)
            if prefix != expected_prefix:
                return None
            signing_input = f"{prefix}.{encoded}".encode("ascii")
            expected = hmac.new(self._signing_secret(), signing_input, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, expected):
                return None
            padded = encoded + ("=" * ((-len(encoded)) % 4))
            decoded = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
            parsed = json.loads(decoded)
            return parsed if isinstance(parsed, dict) else None
        except (ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
            return None

    def export_vault_cookie(
        self,
        user_id: str,
        existing_cookie: str | None = None,
    ) -> str | None:
        """Build a signed compact cookie holding up to 3 accounts (scrypt hashes only) for serverless persistence."""
        with self._connect() as conn:
            urow = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not urow:
                return None
            prow = conn.execute(
                "SELECT * FROM farm_parcels WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC LIMIT 1",
                (user_id,),
            ).fetchone()

        prior_records: list[dict[str, Any]] = []
        parsed_prior = self._verify_compact_payload(existing_cookie, "sfv1")
        if parsed_prior and isinstance(parsed_prior.get("a"), list):
            for item in parsed_prior["a"]:
                if isinstance(item, dict) and item.get("email") and item.get("id"):
                    prior_records.append(item)

        clean_email = str(urow["email"]).strip().lower()
        matching_prior = next(
            (r for r in prior_records if r.get("email") == clean_email or r.get("id") == urow["id"]),
            None,
        )
        pw_hash = str(urow["password_hash"] or "")
        if pw_hash.startswith("session-rehydrated$") and matching_prior:
            prior_pw = str(matching_prior.get("pw_hash") or "")
            if prior_pw.startswith("scrypt$"):
                pw_hash = prior_pw

        avatar_val = urow["avatar_data_url"]
        clean_avatar = (
            avatar_val
            if isinstance(avatar_val, str) and avatar_val.startswith("https://") and len(avatar_val) <= 250
            else None
        )
        entry: dict[str, Any] = {
            "id": str(urow["id"]),
            "name": str(urow["name"])[:120],
            "email": clean_email,
            "pw_hash": pw_hash,
            "region": str(urow["region"] or "Ganja-Dashkasan")[:120],
            "username": str(urow["username"] or "")[:60],
            "phone_code": str(urow["phone_code"] or "AZ +994")[:20],
            "phone": str(urow["phone"] or "")[:40],
            "active_since": str(urow["active_since"] or "")[:30],
            "role_type": str(urow["role_type"] or "farmer")[:30],
            "irrigation_pref": str(urow["irrigation_pref"] or "irrigated")[:30],
            "bio": str(urow["bio"] or "")[:180],
            "avatar_url": clean_avatar,
            "google_sub": str(urow["google_sub"]) if urow["google_sub"] else None,
            "created_at": str(urow["created_at"] or _now_iso()),
            "updated_at": str(urow["updated_at"] or _now_iso()),
        }
        if prow is not None:
            try:
                lab_dict = json.loads(prow["lab_metrics_json"] or "{}")
                if not isinstance(lab_dict, dict):
                    lab_dict = {}
            except json.JSONDecodeError:
                lab_dict = {}
            entry["p"] = {
                "id": str(prow["id"]),
                "label": str(prow["label"])[:120],
                "region_id": str(prow["region_id"])[:80],
                "lat": float(prow["latitude"]),
                "lon": float(prow["longitude"]),
                "area_ha": float(prow["area_ha"]),
                "irrig": str(prow["irrigation_type"]),
                "budget": prow["irrigation_budget_mm"],
                "ph": prow["soil_ph"],
                "tex": str(prow["soil_texture"]),
                "crop": str(prow["prior_crop_id"]),
                "lab": lab_dict,
            }

        records = [entry] + [
            r
            for r in prior_records
            if str(r.get("email") or "").lower() != clean_email and r.get("id") != entry["id"]
        ][:2]

        token = self._sign_compact_payload("sfv1", {"v": 1, "a": records})
        while len(token) > 3600 and len(records) > 1:
            records.pop()
            token = self._sign_compact_payload("sfv1", {"v": 1, "a": records})
        if len(token) > 3600 and "p" in records[0] and isinstance(records[0]["p"], dict):
            records[0]["p"].pop("lab", None)
            token = self._sign_compact_payload("sfv1", {"v": 1, "a": records})
        return token

    def restore_from_vault_cookie(
        self,
        cookie_value: str | None,
        *,
        target_email: str | None = None,
    ) -> bool:
        """Restore signed vault accounts into local SQLite when hitting a cold serverless container."""
        parsed = self._verify_compact_payload(cookie_value, "sfv1")
        if not parsed or not isinstance(parsed.get("a"), list):
            return False

        clean_target = target_email.strip().lower() if target_email else None
        candidates = [
            r
            for r in parsed["a"]
            if isinstance(r, dict)
            and isinstance(r.get("id"), str)
            and isinstance(r.get("email"), str)
            and isinstance(r.get("pw_hash"), str)
        ]
        if clean_target:
            candidates = [r for r in candidates if r["email"].strip().lower() == clean_target]
        if not candidates:
            return False

        restored_any = False
        with self._connect() as conn:
            for entry in candidates:
                uid = entry["id"].strip()
                email = entry["email"].strip().lower()
                pw_hash = entry["pw_hash"].strip()
                if not uid or not email or not pw_hash:
                    continue
                vault_updated = str(entry.get("updated_at") or _now_iso())
                existing = conn.execute(
                    "SELECT id, password_hash, updated_at FROM users WHERE id = ? OR email = ? LIMIT 1",
                    (uid, email),
                ).fetchone()
                if existing is None:
                    try:
                        conn.execute(
                            """
                            INSERT INTO users (
                                id, name, email, password_hash, region, username, phone_code,
                                phone, active_since, role_type, irrigation_pref, bio,
                                avatar_data_url, google_sub, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                uid,
                                str(entry.get("name") or email.split("@")[0])[:120],
                                email,
                                pw_hash,
                                str(entry.get("region") or "Ganja-Dashkasan")[:120],
                                str(entry.get("username") or "")[:60],
                                str(entry.get("phone_code") or "AZ +994")[:20],
                                str(entry.get("phone") or "")[:40],
                                str(entry.get("active_since") or vault_updated[:10])[:30],
                                str(entry.get("role_type") or "farmer")[:30],
                                str(entry.get("irrigation_pref") or "irrigated")[:30],
                                str(entry.get("bio") or "")[:1200],
                                entry.get("avatar_url"),
                                entry.get("google_sub"),
                                str(entry.get("created_at") or vault_updated),
                                vault_updated,
                            ),
                        )
                    except sqlite3.IntegrityError:
                        continue
                    self._upsert_parcel_from_vault(conn, uid, entry, vault_updated)
                    restored_any = True
                else:
                    existing_pw = str(existing["password_hash"] or "")
                    existing_updated = str(existing["updated_at"] or "")
                    needs_pw_upgrade = existing_pw.startswith("session-rehydrated$") and pw_hash.startswith("scrypt$")
                    is_newer_vault = vault_updated > existing_updated
                    if needs_pw_upgrade or is_newer_vault:
                        next_pw = pw_hash if pw_hash.startswith("scrypt$") else existing_pw
                        conn.execute(
                            """
                            UPDATE users
                            SET name = ?, region = ?, username = ?, phone_code = ?, phone = ?,
                                role_type = ?, irrigation_pref = ?, bio = ?, google_sub = ?,
                                password_hash = ?, updated_at = ?
                            WHERE id = ?
                            """,
                            (
                                str(entry.get("name") or email.split("@")[0])[:120],
                                str(entry.get("region") or "Ganja-Dashkasan")[:120],
                                str(entry.get("username") or "")[:60],
                                str(entry.get("phone_code") or "AZ +994")[:20],
                                str(entry.get("phone") or "")[:40],
                                str(entry.get("role_type") or "farmer")[:30],
                                str(entry.get("irrigation_pref") or "irrigated")[:30],
                                str(entry.get("bio") or "")[:1200],
                                entry.get("google_sub"),
                                next_pw,
                                vault_updated,
                                str(existing["id"]),
                            ),
                        )
                        self._upsert_parcel_from_vault(conn, str(existing["id"]), entry, vault_updated)
                        restored_any = True
        return restored_any

    def _upsert_parcel_from_vault(
        self,
        conn: sqlite3.Connection,
        user_id: str,
        entry: dict[str, Any],
        now_iso: str,
    ) -> None:
        p = entry.get("p")
        if not isinstance(p, dict) or not p.get("id"):
            existing_count = conn.execute(
                "SELECT COUNT(*) AS cnt FROM farm_parcels WHERE user_id = ?", (user_id,)
            ).fetchone()["cnt"]
            if existing_count > 0:
                return
            reg_id, parcel_label, lat, lon, area_ha, crop_id = _resolve_region_seed(
                str(entry.get("region") or "Ganja-Dashkasan")
            )
            lab_seed = _default_lab_profile(reg_id)
            conn.execute(
                """
                INSERT OR IGNORE INTO farm_parcels (
                    id, user_id, label, region_id, latitude, longitude, area_ha,
                    irrigation_type, irrigation_budget_mm, soil_ph, soil_texture,
                    prior_crop_id, lab_metrics_json, is_primary, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    f"pcl-{uuid.uuid4().hex[:10]}",
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
                    now_iso,
                ),
            )
            return

        reg_id = str(p.get("region_id") or "custom")[:80]
        lab_seed = _default_lab_profile(reg_id)
        lab_dict = p.get("lab") if isinstance(p.get("lab"), dict) else lab_seed["lab_metrics"]
        conn.execute(
            """
            INSERT INTO farm_parcels (
                id, user_id, label, region_id, latitude, longitude, area_ha,
                irrigation_type, irrigation_budget_mm, soil_ph, soil_texture,
                prior_crop_id, lab_metrics_json, is_primary, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                region_id = excluded.region_id,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                area_ha = excluded.area_ha,
                irrigation_type = excluded.irrigation_type,
                irrigation_budget_mm = excluded.irrigation_budget_mm,
                soil_ph = excluded.soil_ph,
                soil_texture = excluded.soil_texture,
                prior_crop_id = excluded.prior_crop_id,
                lab_metrics_json = excluded.lab_metrics_json,
                is_primary = 1
            """,
            (
                str(p["id"]),
                user_id,
                str(p.get("label") or "Primary Plot")[:160],
                reg_id,
                float(p.get("lat", 40.68)),
                float(p.get("lon", 46.36)),
                float(p.get("area_ha", 25.0)),
                str(p.get("irrig") or lab_seed["irrigation_type"]),
                p.get("budget", lab_seed["irrigation_budget_mm"]),
                p.get("ph", lab_seed["soil_ph"]),
                str(p.get("tex") or lab_seed["soil_texture"]),
                str(p.get("crop") or "wheat"),
                json.dumps(lab_dict),
                now_iso,
            ),
        )
        conn.execute(
            "UPDATE farm_parcels SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE user_id = ?",
            (str(p["id"]), user_id),
        )

    def ensure_session_user(self, claims: dict[str, Any]) -> str | None:
        """Verify user row exists in local SQLite, rehydrating signed v2 claims across cold serverless containers."""
        user_id = str(claims.get("sub") or "").strip()
        if not user_id:
            return None
        profile, _ = self.get_user_bundle(user_id)
        if profile is not None:
            return user_id
        if claims.get("v") != 2:
            return None
        email = str(claims.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return None
        name = str(claims.get("name") or email.split("@")[0]).strip()
        region = str(claims.get("region") or "Ganja-Dashkasan").strip()
        pid = str(claims.get("pid") or "").strip() or None
        with self._connect() as conn:
            existing_by_email = conn.execute(
                "SELECT id FROM users WHERE email = ?", (email,)
            ).fetchone()
            if existing_by_email is not None:
                return str(existing_by_email["id"])
            return self._insert_user_with_parcel(
                conn,
                name=name,
                email=email,
                pw_hash=f"session-rehydrated${secrets.token_hex(16)}",
                region=region,
                explicit_user_id=user_id,
                explicit_parcel_id=pid,
            )

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

    def _insert_user_with_parcel(
        self,
        conn: sqlite3.Connection,
        *,
        name: str,
        email: str,
        pw_hash: str,
        region: str,
        google_sub: str | None = None,
        avatar_data_url: str | None = None,
        explicit_user_id: str | None = None,
        explicit_parcel_id: str | None = None,
    ) -> str:
        clean_email = email.strip().lower()
        clean_name = name.strip() or "SpaceFarm User"
        clean_region = region.strip() or "Ganja-Dashkasan"
        handle_base = "".join(
            ch for ch in clean_email.split("@")[0].lower() if ch.isalnum() or ch in {"_", "."}
        )
        username = f"@{handle_base[:24]}" if handle_base else "@farmer"
        now = _now_iso()
        today_str = now[:10]
        user_id = explicit_user_id or f"usr-{uuid.uuid4().hex[:12]}"

        reg_id, parcel_label, lat, lon, area_ha, crop_id = _resolve_region_seed(clean_region)
        lab_seed = _default_lab_profile(reg_id)
        parcel_id = explicit_parcel_id or f"pcl-{uuid.uuid4().hex[:10]}"

        conn.execute(
            """
            INSERT INTO users (
                id, name, email, password_hash, region, username, phone_code,
                phone, active_since, role_type, irrigation_pref, bio,
                avatar_data_url, google_sub, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'AZ +994', '', ?, 'farmer', 'irrigated', '', ?, ?, ?, ?)
            """,
            (
                user_id,
                clean_name,
                clean_email,
                pw_hash,
                clean_region,
                username,
                today_str,
                avatar_data_url,
                google_sub,
                now,
                now,
            ),
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
        return user_id

    def register_user(
        self,
        *,
        name: str,
        email: str,
        password: str,
        region: str = "Ganja-Dashkasan",
    ) -> tuple[str, dict[str, Any], list[dict[str, Any]]]:
        pw_hash = self.hash_password(password)
        with self._connect() as conn:
            user_id = self._insert_user_with_parcel(
                conn,
                name=name,
                email=email,
                pw_hash=pw_hash,
                region=region,
            )

        profile, parcels = self.get_user_bundle(user_id)
        if profile is None:
            raise RuntimeError("Failed to read created user")
        return self.create_token(user_id), profile, parcels

    @staticmethod
    def _hash_otp_code(email: str, code: str) -> str:
        return hashlib.sha256(f"{email.strip().lower()}:{code.strip()}".encode("utf-8")).hexdigest()

    def create_registration_otp_bundle(
        self,
        *,
        name: str,
        email: str,
        password: str,
        region: str = "Ganja-Dashkasan",
        ttl_seconds: int = 600,
    ) -> tuple[str, str]:
        clean_email = email.strip().lower()
        clean_name = name.strip()
        clean_region = region.strip() or "Ganja-Dashkasan"
        pw_hash = self.hash_password(password)
        otp_code = f"{secrets.randbelow(10000):04d}"
        otp_hash = self._hash_otp_code(clean_email, otp_code)
        expires_at = int(time.time()) + ttl_seconds
        now = _now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO registration_otp_codes (
                    email, name, password_hash, region, otp_hash, attempts, expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    name = excluded.name,
                    password_hash = excluded.password_hash,
                    region = excluded.region,
                    otp_hash = excluded.otp_hash,
                    attempts = 0,
                    expires_at = excluded.expires_at,
                    created_at = excluded.created_at
                """,
                (clean_email, clean_name, pw_hash, clean_region, otp_hash, expires_at, now),
            )
        otp_token = self._sign_compact_payload(
            "sfotp1",
            {
                "e": clean_email,
                "n": clean_name,
                "p": pw_hash,
                "r": clean_region,
                "h": otp_hash,
                "exp": expires_at,
            },
        )
        return otp_code, otp_token

    def create_registration_otp(
        self,
        *,
        name: str,
        email: str,
        password: str,
        region: str = "Ganja-Dashkasan",
        ttl_seconds: int = 600,
    ) -> str:
        otp_code, _ = self.create_registration_otp_bundle(
            name=name,
            email=email,
            password=password,
            region=region,
            ttl_seconds=ttl_seconds,
        )
        return otp_code

    def verify_registration_otp(
        self,
        *,
        email: str,
        code: str,
        otp_token: str | None = None,
    ) -> tuple[str, str | None, dict[str, Any] | None, list[dict[str, Any]]]:
        clean_email = email.strip().lower()
        clean_code = code.strip()
        now_ts = int(time.time())
        expected_hash = self._hash_otp_code(clean_email, clean_code)
        with self._connect() as conn:
            if conn.execute("SELECT 1 FROM users WHERE email = ?", (clean_email,)).fetchone():
                return "email_exists", None, None, []
            row = conn.execute(
                "SELECT * FROM registration_otp_codes WHERE email = ?",
                (clean_email,),
            ).fetchone()
            if row is not None:
                if int(row["expires_at"]) < now_ts:
                    conn.execute("DELETE FROM registration_otp_codes WHERE email = ?", (clean_email,))
                    return "expired", None, None, []
                if int(row["attempts"]) >= 5:
                    return "too_many_attempts", None, None, []
                if not hmac.compare_digest(row["otp_hash"], expected_hash):
                    conn.execute(
                        "UPDATE registration_otp_codes SET attempts = attempts + 1 WHERE email = ?",
                        (clean_email,),
                    )
                    return "invalid_code", None, None, []
                user_id = self._insert_user_with_parcel(
                    conn,
                    name=row["name"],
                    email=clean_email,
                    pw_hash=row["password_hash"],
                    region=row["region"],
                )
                conn.execute("DELETE FROM registration_otp_codes WHERE email = ?", (clean_email,))
            else:
                claims = self._verify_compact_payload(otp_token, "sfotp1")
                if not claims or str(claims.get("e") or "").strip().lower() != clean_email:
                    return "not_found", None, None, []
                if int(claims.get("exp") or 0) < now_ts:
                    return "expired", None, None, []
                if not hmac.compare_digest(str(claims.get("h") or ""), expected_hash):
                    conn.execute(
                        """
                        INSERT INTO registration_otp_codes (
                            email, name, password_hash, region, otp_hash, attempts, expires_at, created_at
                        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                        ON CONFLICT(email) DO UPDATE SET attempts = attempts + 1
                        """,
                        (
                            clean_email,
                            str(claims.get("n") or clean_email.split("@")[0]),
                            str(claims.get("p") or ""),
                            str(claims.get("r") or "Ganja-Dashkasan"),
                            str(claims.get("h") or ""),
                            int(claims.get("exp") or now_ts),
                            _now_iso(),
                        ),
                    )
                    return "invalid_code", None, None, []
                user_id = self._insert_user_with_parcel(
                    conn,
                    name=str(claims.get("n") or clean_email.split("@")[0]),
                    email=clean_email,
                    pw_hash=str(claims.get("p") or ""),
                    region=str(claims.get("r") or "Ganja-Dashkasan"),
                )

        profile, parcels = self.get_user_bundle(user_id)
        if profile is None:
            raise RuntimeError("Failed to read verified user")
        return "ok", self.create_token(user_id, profile=profile, parcels=parcels), profile, parcels

    def authenticate_or_register_google(
        self,
        *,
        google_sub: str,
        email: str,
        name: str,
        region: str = "Ganja-Dashkasan",
        avatar_url: str | None = None,
    ) -> tuple[str, dict[str, Any], list[dict[str, Any]]]:
        clean_email = email.strip().lower()
        clean_sub = google_sub.strip()
        clean_avatar = avatar_url if (avatar_url and avatar_url.startswith("https://")) else None
        now = _now_iso()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, avatar_data_url FROM users WHERE google_sub = ? OR email = ? ORDER BY CASE WHEN google_sub = ? THEN 0 ELSE 1 END LIMIT 1",
                (clean_sub, clean_email, clean_sub),
            ).fetchone()
            if row is not None:
                user_id = str(row["id"])
                conn.execute(
                    "UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ?",
                    (clean_sub, now, user_id),
                )
            else:
                random_pw = self.hash_password(secrets.token_urlsafe(32))
                user_id = self._insert_user_with_parcel(
                    conn,
                    name=name or clean_email.split("@")[0],
                    email=clean_email,
                    pw_hash=random_pw,
                    region=region,
                    google_sub=clean_sub,
                    avatar_data_url=clean_avatar,
                )

        profile, parcels = self.get_user_bundle(user_id)
        if profile is None:
            raise RuntimeError("Failed to read Google-authenticated user")
        return self.create_token(user_id), profile, parcels

    def get_user_id_by_email(self, email: str) -> str | None:
        clean_email = email.strip().lower()
        with self._connect() as conn:
            row = conn.execute("SELECT id FROM users WHERE email = ?", (clean_email,)).fetchone()
            return str(row["id"]) if row is not None else None

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
            conn.execute("UPDATE users SET updated_at = ? WHERE id = ?", (now, user_id))
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
                conn.execute("UPDATE users SET updated_at = ? WHERE id = ?", (_now_iso(), user_id))
        _, parcels = self.get_user_bundle(user_id)
        return parcels

    def set_primary_parcel(self, user_id: str, parcel_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            conn.execute("UPDATE farm_parcels SET is_primary = 0 WHERE user_id = ?", (user_id,))
            conn.execute(
                "UPDATE farm_parcels SET is_primary = 1 WHERE user_id = ? AND id = ?",
                (user_id, parcel_id),
            )
            conn.execute("UPDATE users SET updated_at = ? WHERE id = ?", (_now_iso(), user_id))
        _, parcels = self.get_user_bundle(user_id)
        return parcels

    def delete_parcel(self, user_id: str, parcel_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM farm_parcels WHERE user_id = ? AND id = ?",
                (user_id, parcel_id),
            )
            conn.execute("UPDATE users SET updated_at = ? WHERE id = ?", (_now_iso(), user_id))
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

    def create_password_reset_code(
        self, email: str, ttl_seconds: int = 900
    ) -> dict[str, Any] | None:
        clean_email = email.strip().lower()
        now_ts = int(time.time())
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, name, email FROM users WHERE email = ?",
                (clean_email,),
            ).fetchone()
            if not row:
                return None
            code = f"{secrets.randbelow(1_000_000):06d}"
            code_hash = self._hash_otp_code(clean_email, code)
            expires_at = now_ts + ttl_seconds
            now = _now_iso()
            conn.execute(
                """
                INSERT INTO password_reset_codes (
                    email, user_id, code_hash, attempts, expires_at, created_at
                ) VALUES (?, ?, ?, 0, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    user_id = excluded.user_id,
                    code_hash = excluded.code_hash,
                    attempts = 0,
                    expires_at = excluded.expires_at,
                    created_at = excluded.created_at
                """,
                (clean_email, row["id"], code_hash, expires_at, now),
            )
        reset_token = self._sign_compact_payload(
            "sfrst1",
            {
                "u": row["id"],
                "e": row["email"],
                "h": code_hash,
                "exp": expires_at,
            },
        )
        return {
            "user_id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "code": code,
            "reset_token": reset_token,
            "expires_at": expires_at,
            "created_at": now,
        }

    def verify_and_reset_password(
        self, *, email: str, code: str, new_password: str, reset_token: str | None = None
    ) -> str:
        clean_email = email.strip().lower()
        clean_code = code.strip()
        now_ts = int(time.time())
        expected_hash = self._hash_otp_code(clean_email, clean_code)
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM password_reset_codes WHERE email = ?",
                (clean_email,),
            ).fetchone()
            if row is not None:
                if int(row["expires_at"]) < now_ts:
                    conn.execute("DELETE FROM password_reset_codes WHERE email = ?", (clean_email,))
                    return "expired"
                if int(row["attempts"]) >= 5:
                    return "too_many_attempts"
                if not hmac.compare_digest(row["code_hash"], expected_hash):
                    conn.execute(
                        "UPDATE password_reset_codes SET attempts = attempts + 1 WHERE email = ?",
                        (clean_email,),
                    )
                    return "invalid_code"
                pw_hash = self.hash_password(new_password)
                conn.execute(
                    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                    (pw_hash, _now_iso(), row["user_id"]),
                )
                conn.execute("DELETE FROM password_reset_codes WHERE email = ?", (clean_email,))
                return "ok"

            claims = self._verify_compact_payload(reset_token, "sfrst1")
            if not claims or str(claims.get("e") or "").strip().lower() != clean_email:
                return "not_found"
            if int(claims.get("exp") or 0) < now_ts:
                return "expired"
            user_row = conn.execute(
                "SELECT id FROM users WHERE email = ? OR id = ? LIMIT 1",
                (clean_email, str(claims.get("u") or "")),
            ).fetchone()
            if user_row is None:
                return "not_found"
            user_id = str(user_row["id"])
            if not hmac.compare_digest(str(claims.get("h") or ""), expected_hash):
                conn.execute(
                    """
                    INSERT INTO password_reset_codes (
                        email, user_id, code_hash, attempts, expires_at, created_at
                    ) VALUES (?, ?, ?, 1, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET attempts = attempts + 1
                    """,
                    (
                        clean_email,
                        user_id,
                        str(claims.get("h") or ""),
                        int(claims.get("exp") or now_ts),
                        _now_iso(),
                    ),
                )
                return "invalid_code"
            pw_hash = self.hash_password(new_password)
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (pw_hash, _now_iso(), user_id),
            )
            return "ok"
