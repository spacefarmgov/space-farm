"""Application configuration for the Space Farm API service."""

from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
SERVICE_ROOT = Path(__file__).resolve().parents[1]

CONTRACT_VERSION = "0.1.0"
MODEL_VERSION = "rotation-engine-0.1.0"
PIPELINE_VERSION = "power-pipeline-0.1.0"


def _resolve_repo_path(raw_path: str | Path) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (REPO_ROOT / path).resolve()


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables and root .env."""

    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "staging", "production"] = Field(
        default="development",
        alias="APP_ENV",
    )
    api_host: str = Field(default="127.0.0.1", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        alias="CORS_ORIGINS",
    )

    data_mode: Literal["live", "cached", "demo_fixture"] = Field(
        default="live",
        alias="DATA_MODE",
    )

    nasa_power_base_url: str = Field(
        default="https://power.larc.nasa.gov/api/temporal/daily/point",
        alias="NASA_POWER_BASE_URL",
    )
    nasa_power_community: str = Field(default="AG", alias="NASA_POWER_COMMUNITY")
    nasa_power_time_standard: str = Field(default="UTC", alias="NASA_POWER_TIME_STANDARD")
    nasa_power_timeout_seconds: float = Field(default=10.0, alias="NASA_POWER_TIMEOUT_SECONDS")
    nasa_power_max_retries: int = Field(default=2, alias="NASA_POWER_MAX_RETRIES")
    nasa_power_retry_budget_seconds: float = Field(
        default=15.0,
        alias="NASA_POWER_RETRY_BUDGET_SECONDS",
    )

    data_dir: str = Field(default="./data", alias="DATA_DIR")
    data_cache_dir: str = Field(default="./data/cache", alias="DATA_CACHE_DIR")
    contracts_dir: str = Field(default="./contracts", alias="CONTRACTS_DIR")

    # Gemini AI integration
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-3-flash-preview", alias="GEMINI_MODEL")
    gemini_timeout_seconds: float = Field(default=30.0, alias="GEMINI_TIMEOUT_SECONDS")

    # Background weather risk worker & cooldown
    risk_worker_enabled: bool = Field(default=True, alias="RISK_WORKER_ENABLED")
    risk_scan_interval_seconds: int = Field(default=900, alias="RISK_SCAN_INTERVAL_SECONDS")
    risk_alert_cooldown_hours: int = Field(default=12, alias="RISK_ALERT_COOLDOWN_HOURS")

    # Outbound Email / SMTP configuration
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="alerts@spacefarm.az", alias="SMTP_FROM_EMAIL")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")

    # Google Identity Services / OAuth & Email OTP
    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    otp_ttl_seconds: int = Field(default=600, ge=60, le=3600, alias="OTP_TTL_SECONDS")

    # Outbound SMS configuration (twilio | webhook | outbox)
    sms_provider: Literal["twilio", "webhook", "outbox"] = Field(
        default="outbox",
        alias="SMS_PROVIDER",
    )
    twilio_account_sid: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    twilio_from_number: str = Field(default="", alias="TWILIO_FROM_NUMBER")
    sms_webhook_url: str = Field(default="", alias="SMS_WEBHOOK_URL")
    sms_webhook_token: str = Field(default="", alias="SMS_WEBHOOK_TOKEN")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_cors(cls, v: object) -> str:
        return str(v or "").strip()

    @property
    def is_vercel(self) -> bool:
        return bool(os.getenv("VERCEL"))

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        vercel_url = os.getenv("VERCEL_URL", "").strip()
        if vercel_url:
            vercel_origin = vercel_url if vercel_url.startswith("http") else f"https://{vercel_url}"
            if vercel_origin not in origins:
                origins.append(vercel_origin)
        return origins or ["http://localhost:5173"]

    @property
    def data_root_path(self) -> Path:
        return _resolve_repo_path(self.data_dir)

    @property
    def runtime_data_dir_path(self) -> Path:
        """Writable runtime directory for SQLite and auth secrets (uses /tmp on read-only serverless hosts)."""
        primary = self.data_root_path
        if self.is_vercel or (primary.exists() and not os.access(primary, os.W_OK)):
            return Path(tempfile.gettempdir()) / "spacefarm-data"
        return primary

    @property
    def raw_data_dir(self) -> Path:
        return self.data_root_path / "raw"

    @property
    def processed_data_dir(self) -> Path:
        return self.data_root_path / "processed"

    @property
    def catalog_dir(self) -> Path:
        return self.data_root_path / "catalog"

    @property
    def cache_dir_path(self) -> Path:
        if self.is_vercel and self.data_cache_dir == "./data/cache":
            return self.runtime_data_dir_path / "cache"
        return _resolve_repo_path(self.data_cache_dir)

    @property
    def contracts_dir_path(self) -> Path:
        return _resolve_repo_path(self.contracts_dir)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached runtime settings (call get_settings.cache_clear() in tests)."""
    return Settings()


def ensure_runtime_dirs(settings: Settings | None = None) -> None:
    """Ensure dynamic cache directory exists without mutating committed catalog files."""
    cfg = settings or get_settings()
    os.makedirs(cfg.cache_dir_path, exist_ok=True)
