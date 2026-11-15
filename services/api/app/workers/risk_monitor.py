"""Background cron/worker that monitors all farmers' parcels for weather hazards."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.config import Settings, get_settings
from app.engine.risk_analyzer import scan_user_parcels
from app.storage.sqlite_store import SpaceFarmStore

logger = logging.getLogger("space_farm.risk_worker")


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class RiskMonitorWorker:
    """Periodic background scheduler analyzing field coordinates & dispatching critical alerts."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()
        self.running = False
        self.last_run_at: str | None = None
        self.last_error: str | None = None
        self.runs_completed = 0
        self.total_alerts_created = 0
        self.total_dispatches_created = 0

    def status_dict(self) -> dict[str, Any]:
        return {
            "enabled": bool(self.settings.risk_worker_enabled and not self.settings.app_env == "test"),
            "running": self.running,
            "interval_seconds": self.settings.risk_scan_interval_seconds,
            "cooldown_hours": self.settings.risk_alert_cooldown_hours,
            "last_run_at": self.last_run_at,
            "last_error": self.last_error,
            "runs_completed": self.runs_completed,
            "total_alerts_created": self.total_alerts_created,
            "total_dispatches_created": self.total_dispatches_created,
        }

    async def run_single_pass(self) -> dict[str, int]:
        store = SpaceFarmStore(self.settings)
        users_bundles = store.list_all_monitored_users_with_parcels()
        scanned_parcels = 0
        alerts_created = 0
        dispatches_created = 0

        for entry in users_bundles:
            parcels = entry["parcels"]
            if not parcels:
                continue
            try:
                res = await scan_user_parcels(
                    store=store,
                    settings=self.settings,
                    user=entry["user"],
                    parcels=parcels,
                    prefs=entry["prefs"],
                )
                scanned_parcels += len(res["snapshots"])
                alerts_created += len(res["new_alerts"])
                dispatches_created += len(res["new_dispatches"])
            except Exception as exc:
                logger.warning("Risk scan error for user %s: %s", entry["user"].get("id"), exc)

        self.last_run_at = _now_iso()
        self.runs_completed += 1
        self.total_alerts_created += alerts_created
        self.total_dispatches_created += dispatches_created
        self.last_error = None
        return {
            "scanned_parcels": scanned_parcels,
            "alerts_created": alerts_created,
            "dispatches_created": dispatches_created,
        }

    async def _loop(self) -> None:
        # Short initial delay so uvicorn startup settles before scanning coordinates
        try:
            await asyncio.wait_for(self._stop_event.wait(), timeout=4.0)
            return
        except asyncio.TimeoutError:
            pass

        while not self._stop_event.is_set():
            try:
                summary = await self.run_single_pass()
                logger.info(
                    "Background risk cron pass #%d finished: parcels=%d alerts=%d dispatches=%d",
                    self.runs_completed,
                    summary["scanned_parcels"],
                    summary["alerts_created"],
                    summary["dispatches_created"],
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.last_error = str(exc)
                logger.exception("Unhandled error inside background risk cron worker")

            interval = max(30, int(self.settings.risk_scan_interval_seconds))
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue

    def start(self) -> None:
        if not self.settings.risk_worker_enabled or self.settings.app_env == "test":
            return
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self.running = True
        self._task = asyncio.create_task(self._loop(), name="spacefarm-risk-monitor")

    async def stop(self) -> None:
        self.running = False
        self._stop_event.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None


risk_worker = RiskMonitorWorker()
