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
        self._custom_settings = settings is not None
        self.settings = settings or get_settings()
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event | None = None
        self.running = False
        self.last_run_at: str | None = None
        self.last_error: str | None = None
        self.runs_completed = 0
        self.total_alerts_created = 0
        self.total_dispatches_created = 0

    def status_dict(self) -> dict[str, Any]:
        active = self.settings if self._custom_settings else get_settings()
        return {
            "enabled": bool(active.risk_worker_enabled and active.app_env != "test" and not active.is_vercel),
            "running": self.running,
            "interval_seconds": active.risk_scan_interval_seconds,
            "cooldown_hours": active.risk_alert_cooldown_hours,
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
        stop_event = self._stop_event or asyncio.Event()
        # Short initial delay so uvicorn startup settles before scanning coordinates
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=4.0)
            return
        except asyncio.TimeoutError:
            pass

        while not stop_event.is_set():
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
                await asyncio.wait_for(stop_event.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue

    def start(self) -> None:
        active = self.settings if self._custom_settings else get_settings()
        if (
            not active.risk_worker_enabled
            or active.app_env == "test"
            or active.is_vercel
        ):
            return
        self.settings = active
        if self._task and not self._task.done():
            return
        self._stop_event = asyncio.Event()
        self.running = True
        self._task = asyncio.create_task(self._loop(), name="spacefarm-risk-monitor")

    async def stop(self) -> None:
        self.running = False
        task = self._task
        stop_event = self._stop_event
        self._task = None
        self._stop_event = None
        if task is None:
            return
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None
        if task.get_loop() is not running_loop:
            return
        if stop_event is not None:
            stop_event.set()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


risk_worker = RiskMonitorWorker()
