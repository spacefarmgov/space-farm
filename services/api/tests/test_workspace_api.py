"""Workspace tests for SQLite Auth, Profile, Farm Parcels, and SpaceFarm AI Advisor."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import Settings, get_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.routes.workspace_api import _get_store  # noqa: E402
from app.storage.sqlite_store import SpaceFarmStore  # noqa: E402


class WorkspaceApiTests(unittest.TestCase):
    _ISOLATED_ENV_OVERRIDES: dict[str, str] = {
        "DATA_MODE": "cached",
        "APP_ENV": "test",
        "SMTP_HOST": "",
        "SMTP_USER": "",
        "SMTP_PASSWORD": "",
        "GOOGLE_CLIENT_ID": "",
    }

    def setUp(self) -> None:
        self._saved_env = {k: os.environ.get(k) for k in self._ISOLATED_ENV_OVERRIDES}
        for key, value in self._ISOLATED_ENV_OVERRIDES.items():
            os.environ[key] = value
        get_settings.cache_clear()

        self._tmp = tempfile.TemporaryDirectory()
        store_settings = Settings(data_dir=self._tmp.name)
        self.store = SpaceFarmStore(store_settings)

        app = create_app()
        app.dependency_overrides[_get_store] = lambda: self.store
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self._tmp.cleanup()
        for key, prev in self._saved_env.items():
            if prev is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = prev
        get_settings.cache_clear()

    def _register_sample(self, email: str = "ayla@agronomy.az", region: str = "Ganja-Dashkasan") -> tuple[str, dict, list[dict]]:
        resp = self.client.post(
            "/api/v1/auth/register",
            json={
                "name": "Ayla Huseynova",
                "email": email,
                "password": "securepassword1",
                "region": region,
            },
        )
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()
        return data["token"], data["user"], data["parcels"]

    def test_register_login_and_duplicate_conflict(self) -> None:
        token, user, parcels = self._register_sample()
        self.assertTrue(token)
        self.assertEqual(user["email"], "ayla@agronomy.az")
        self.assertEqual(user["username"], "@ayla")
        self.assertEqual(len(parcels), 1)
        self.assertTrue(parcels[0]["is_primary"])

        # Duplicate email rejected
        dup = self.client.post(
            "/api/v1/auth/register",
            json={
                "name": "Ayla Duplicate",
                "email": "ayla@agronomy.az",
                "password": "securepassword2",
                "region": "Aran",
            },
        )
        self.assertEqual(dup.status_code, 409)

        # Wrong password rejected
        bad_login = self.client.post(
            "/api/v1/auth/login",
            json={"email": "ayla@agronomy.az", "password": "wrongpassword"},
        )
        self.assertEqual(bad_login.status_code, 401)

        # Valid login succeeds
        ok_login = self.client.post(
            "/api/v1/auth/login",
            json={"email": "ayla@agronomy.az", "password": "securepassword1"},
        )
        self.assertEqual(ok_login.status_code, 200)
        self.assertEqual(ok_login.json()["user"]["name"], "Ayla Huseynova")

    def test_profile_update_and_parcel_crud(self) -> None:
        token, _, initial_parcels = self._register_sample()
        headers = {"Authorization": f"Bearer {token}"}

        # Update profile details
        upd = self.client.put(
            "/api/v1/profile",
            headers=headers,
            json={
                "name": "Ayla K. Huseynova",
                "username": "@ayla_agro",
                "phone_code": "AZ +994",
                "phone": "50 444 22 11",
                "active_since": "2021-04-10",
                "role_type": "agronomist",
                "irrigation_pref": "hybrid",
                "bio": "3-illik quraqlığa davamlı növbəli əkin və peyk iqlim monitorinqi.",
            },
        )
        self.assertEqual(upd.status_code, 200, upd.text)
        updated_user = upd.json()["user"]
        self.assertEqual(updated_user["name"], "Ayla K. Huseynova")
        self.assertEqual(updated_user["role_type"], "agronomist")
        self.assertEqual(updated_user["irrigation_pref"], "hybrid")

        # Create second parcel and promote to primary
        add_p = self.client.post(
            "/api/v1/parcels",
            headers=headers,
            json={
                "label": "Barda Experimental 18ha",
                "region_id": "aran-barda",
                "latitude": 40.38,
                "longitude": 47.12,
                "area_ha": 18.0,
                "irrigation_type": "irrigated",
                "irrigation_budget_mm": 420.0,
                "soil_ph": 7.3,
                "soil_texture": "loam",
                "prior_crop_id": "wheat",
                "is_primary": True,
            },
        )
        self.assertEqual(add_p.status_code, 201, add_p.text)
        parcels = add_p.json()["parcels"]
        self.assertEqual(len(parcels), 2)
        self.assertEqual(parcels[0]["label"], "Barda Experimental 18ha")

        # Activate original parcel
        orig_id = initial_parcels[0]["id"]
        act = self.client.post(f"/api/v1/parcels/{orig_id}/activate", headers=headers)
        self.assertEqual(act.status_code, 200)
        self.assertEqual(act.json()["parcels"][0]["id"], orig_id)

        # Delete extra parcel cleanly
        extra_id = parcels[0]["id"]
        rem = self.client.delete(f"/api/v1/parcels/{extra_id}", headers=headers)
        self.assertEqual(rem.status_code, 200)
        self.assertEqual(len(rem.json()["parcels"]), 1)

        # Cannot delete last remaining parcel
        rem_last = self.client.delete(f"/api/v1/parcels/{orig_id}", headers=headers)
        self.assertEqual(rem_last.status_code, 400)

        # Update parcel soil pH & lab chemistry metrics and verify SQLite persistence
        upd_parcel = self.client.put(
            f"/api/v1/parcels/{orig_id}",
            headers=headers,
            json={
                "soil_ph": 6.9,
                "irrigation_type": "irrigated",
                "irrigation_budget_mm": 310.0,
                "lab_metrics": {
                    "organic_matter_pct": 2.8,
                    "nitrogen_mg_kg": 46.5,
                    "phosphorus_mg_kg": 31.0,
                    "potassium_mg_kg": 255.0,
                    "ec_ds_m": 0.58,
                    "lab_report_id": "LAB-AZ-TEST-2025",
                    "soil_source_type": "laboratory",
                },
            },
        )
        self.assertEqual(upd_parcel.status_code, 200, upd_parcel.text)
        updated_primary = upd_parcel.json()["parcels"][0]
        self.assertAlmostEqual(updated_primary["soil_ph"], 6.9)
        self.assertAlmostEqual(updated_primary["lab_metrics"]["nitrogen_mg_kg"], 46.5)
        self.assertEqual(updated_primary["lab_metrics"]["lab_report_id"], "LAB-AZ-TEST-2025")

    def test_ai_assist_az_and_en_persisted_history(self) -> None:
        token, _, _ = self._register_sample()
        headers = {"Authorization": f"Bearer {token}"}

        # Ask in Azerbaijani using cached Ganja-Dashkasan coordinates
        res_az = self.client.post(
            "/api/v1/ai/assist",
            headers=headers,
            json={
                "question": "Bu sahə üçün ən yaxşı 3 illik əkin dövriyyəsi və su balansı nədir?",
                "locale": "az",
            },
        )
        self.assertEqual(res_az.status_code, 200, res_az.text)
        body_az = res_az.json()
        self.assertIn("NASA LaRC POWER", body_az["answer"])
        self.assertTrue(len(body_az["metrics"]) >= 4)
        self.assertTrue(len(body_az["followups"]) >= 2)
        self.assertTrue(len(body_az["actions"]) >= 2)

        # Ask in English
        res_en = self.client.post(
            "/api/v1/ai/assist",
            headers=headers,
            json={
                "question": "Explain soil pH and water risk for this rotation.",
                "locale": "en",
            },
        )
        self.assertEqual(res_en.status_code, 200, res_en.text)
        self.assertIn("NASA LaRC POWER", res_en.json()["answer"])

        # History shows 4 persisted turns (2 user + 2 assistant)
        hist = self.client.get("/api/v1/ai/history", headers=headers)
        self.assertEqual(hist.status_code, 200)
        self.assertEqual(len(hist.json()["messages"]), 4)

        # Clear history works
        clr = self.client.delete("/api/v1/ai/history", headers=headers)
        self.assertEqual(clr.status_code, 200)
        self.assertEqual(
            len(self.client.get("/api/v1/ai/history", headers=headers).json()["messages"]),
            0,
        )

    def test_weather_risk_scan_cooldown_and_sms_email_dispatch(self) -> None:
        from unittest.mock import patch
        from app.services.notifier import normalize_e164_phone

        self.assertEqual(normalize_e164_phone("AZ +994", "050 444 22 11"), "+994504442211")
        self.assertEqual(normalize_e164_phone("TR +90", "5321112233"), "+905321112233")

        token, _, _ = self._register_sample(email="elvin@farmer.az")
        headers = {"Authorization": f"Bearer {token}"}

        # Set farmer phone number so SMS normalization targets +994507778899
        self.client.put(
            "/api/v1/profile",
            headers=headers,
            json={"phone_code": "AZ +994", "phone": "50 777 88 99"},
        )

        # Customize alert preferences
        pref_res = self.client.patch(
            "/api/v1/alerts/preferences",
            headers=headers,
            json={
                "sms_enabled": True,
                "email_enabled": True,
                "min_severity": "high",
                "custom_frost_c": 1.0,
                "custom_heat_c": 36.0,
            },
        )
        self.assertEqual(pref_res.status_code, 200)
        self.assertEqual(pref_res.json()["contacts"]["phone_e164"], "+994507778899")

        # Mock Open-Meteo 7-day forecast containing critical frost (-2.3°C) & severe heat/rain edge
        mock_forecast = {
            "source": "open-meteo",
            "current": {"temperature_2m": 3.0},
            "days": [
                {"date": "2026-11-15", "tmax_c": 11.0, "tmin_c": -2.3, "precip_mm": 0.0, "et0_mm": 2.4, "wind_kmh": 14.0},
                {"date": "2026-11-16", "tmax_c": 12.0, "tmin_c": -1.1, "precip_mm": 0.2, "et0_mm": 2.5, "wind_kmh": 11.0},
                {"date": "2026-11-17", "tmax_c": 14.0, "tmin_c": 1.5, "precip_mm": 0.0, "et0_mm": 2.8, "wind_kmh": 9.0},
                {"date": "2026-11-18", "tmax_c": 15.0, "tmin_c": 2.8, "precip_mm": 0.0, "et0_mm": 3.1, "wind_kmh": 8.0},
                {"date": "2026-11-19", "tmax_c": 16.0, "tmin_c": 3.2, "precip_mm": 0.0, "et0_mm": 3.2, "wind_kmh": 7.0},
                {"date": "2026-11-20", "tmax_c": 16.0, "tmin_c": 4.0, "precip_mm": 0.0, "et0_mm": 3.4, "wind_kmh": 10.0},
                {"date": "2026-11-21", "tmax_c": 15.0, "tmin_c": 3.8, "precip_mm": 0.0, "et0_mm": 3.0, "wind_kmh": 12.0},
            ],
        }

        async def _fake_forecast(lat: float, lon: float) -> dict:
            return mock_forecast

        with patch("app.engine.risk_analyzer.fetch_live_forecast_7d", side_effect=_fake_forecast):
            scan1 = self.client.post("/api/v1/alerts/scan", headers=headers)
            self.assertEqual(scan1.status_code, 200, scan1.text)
            body1 = scan1.json()
            self.assertEqual(body1["scan_summary"]["scanned_parcels"], 1)
            self.assertGreaterEqual(body1["scan_summary"]["new_alerts"], 1)
            self.assertEqual(body1["snapshots"][0]["frost_risk"], "critical")
            self.assertEqual(body1["alerts"][0]["severity"], "critical")

            # Critical risk automatically prepares both Email & SMS dispatches in SQLite
            channels = {d["channel"]: d for d in body1["dispatches"]}
            self.assertIn("email", channels)
            self.assertIn("sms", channels)
            self.assertEqual(channels["email"]["recipient"], "elvin@farmer.az")
            self.assertEqual(channels["sms"]["recipient"], "+994507778899")

            # Second immediate scan should respect cooldown and NOT duplicate alerts/dispatches
            scan2 = self.client.post("/api/v1/alerts/scan", headers=headers)
            self.assertEqual(scan2.status_code, 200)
            self.assertEqual(scan2.json()["scan_summary"]["new_alerts"], 0)
            self.assertEqual(scan2.json()["scan_summary"]["new_dispatches"], 0)

        # Acknowledge alert status update works
        alert_id = body1["alerts"][0]["id"]
        ack = self.client.post(
            f"/api/v1/alerts/{alert_id}/status",
            headers=headers,
            json={"status": "acknowledged"},
        )
        self.assertEqual(ack.status_code, 200)
        self.assertEqual(ack.json()["alert"]["status"], "acknowledged")

        # Verify channel verification endpoint logs both channels
        ver = self.client.post("/api/v1/alerts/verify-dispatch", headers=headers)
        self.assertEqual(ver.status_code, 200, ver.text)
        self.assertEqual(len(ver.json()["triggered"]), 2)

    def test_orbital_tle_and_wind_grid_endpoints(self) -> None:
        class _DummyResp:
            def __init__(self, status_code: int, text: str = "", json_data=None):
                self.status_code = status_code
                self.text = text
                self._json = json_data

            def json(self):
                return self._json

        class _DummyAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def get(self, url: str, **kwargs):
                if "celestrak.org" in url:
                    return _DummyResp(
                        200,
                        text=(
                            "TERRA\n"
                            "1 25994U 99068A   26318.26383354  .00000353  00000+0  80719-4 0  9994\n"
                            "2 25994  97.9264   1.7139 0003548 108.2320 317.4647 14.61197239431525\n"
                        ),
                    )
                if "open-meteo.com" in url:
                    if "/v1/elevation" in url:
                        return _DummyResp(200, json_data={"elevation": [412.5]})
                    items = []
                    for lat in (-60, -40, -20, 0, 20, 40, 60):
                        for lon in (-165, -135, -105, -75, -45, -15, 15, 45, 75, 105, 135, 165):
                            items.append(
                                {
                                    "latitude": lat,
                                    "longitude": lon,
                                    "current": {
                                        "temperature_2m": 15.0,
                                        "wind_speed_10m": 5.0,
                                        "wind_direction_10m": 240.0,
                                    },
                                }
                            )
                    return _DummyResp(200, json_data=items)
                return _DummyResp(404)

        with patch("app.routes.orbital.httpx.AsyncClient", _DummyAsyncClient):
            tle_res = self.client.get("/api/orbital/tle")
            self.assertEqual(tle_res.status_code, 200, tle_res.text)
            tle_data = tle_res.json()
            self.assertIn("terra", tle_data["satellites"])
            self.assertIn("landsat8", tle_data["satellites"])
            self.assertTrue(tle_data["satellites"]["terra"]["line1"].startswith("1 "))

            wind_res = self.client.get("/api/orbital/wind-grid")
            self.assertEqual(wind_res.status_code, 200, wind_res.text)
            wind_data = wind_res.json()
            self.assertEqual(len(wind_data["points"]), 84)
            self.assertIn("uMs", wind_data["points"][0])

            elev_res = self.client.get("/api/orbital/elevation", params={"latitude": 40.68, "longitude": 46.36})
            self.assertEqual(elev_res.status_code, 200, elev_res.text)
            elev_data = elev_res.json()
            self.assertEqual(elev_data["elevation_m"], 412.5)
            self.assertEqual(elev_data["source"], "srtm_copernicus_dem_90m")

    def test_forgot_password_records_reset_and_dispatch(self) -> None:
        token, _, _ = self._register_sample(email="reset-user@farmer.az")
        headers = {"Authorization": f"Bearer {token}"}

        reset_res = self.client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "reset-user@farmer.az"},
        )
        self.assertEqual(reset_res.status_code, 200, reset_res.text)
        body = reset_res.json()
        self.assertTrue(body["ok"])
        self.assertIn("delivery_status", body)

        overview = self.client.get("/api/v1/alerts/overview", headers=headers)
        self.assertEqual(overview.status_code, 200)
        dispatches = overview.json()["dispatches"]
        self.assertTrue(
            any(d["subject"] == "SpaceFarm Password Reset Code" and d["recipient"] == "reset-user@farmer.az" for d in dispatches)
        )

        # Non-existent email returns uniform ok=True without account enumeration leak
        unknown_res = self.client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nobody-here@farmer.az"},
        )
        self.assertEqual(unknown_res.status_code, 200)
        self.assertTrue(unknown_res.json()["ok"])

    def test_registration_4digit_otp_flow(self) -> None:
        # Unconfigured SMTP honestly reports 503 instead of bypassing OTP
        unconf = self.client.post(
            "/api/v1/auth/register/request-otp",
            json={
                "name": "Nigar Alizada",
                "email": "nigar@farmer.az",
                "password": "strongpassword1",
                "region": "Quba",
            },
        )
        self.assertEqual(unconf.status_code, 503)

        sent_payloads: list[tuple[str, str, str]] = []

        def _fake_smtp(settings, recipient, subject, body):
            sent_payloads.append((recipient, subject, body))

        old_env = {
            "SMTP_HOST": os.environ.get("SMTP_HOST"),
            "SMTP_USER": os.environ.get("SMTP_USER"),
            "SMTP_PASSWORD": os.environ.get("SMTP_PASSWORD"),
        }
        try:
            os.environ["SMTP_HOST"] = "smtp.gmail.com"
            os.environ["SMTP_USER"] = "alerts@spacefarm.az"
            os.environ["SMTP_PASSWORD"] = "app-password-secret"
            get_settings.cache_clear()

            with patch("app.services.notifier._send_smtp_sync", side_effect=_fake_smtp):
                req_res = self.client.post(
                    "/api/v1/auth/register/request-otp",
                    json={
                        "name": "Nigar Alizada",
                        "email": "nigar@farmer.az",
                        "password": "strongpassword1",
                        "region": "Quba",
                    },
                )
            self.assertEqual(req_res.status_code, 200, req_res.text)
            self.assertEqual(len(sent_payloads), 1)
            subject = sent_payloads[0][1]
            import re
            match = re.search(r"\b(\d{4})\b", subject)
            self.assertIsNotNone(match, subject)
            otp_code = match.group(1)

            # Wrong OTP rejected cleanly
            bad_code = "0000" if otp_code != "0000" else "9999"
            bad_res = self.client.post(
                "/api/v1/auth/register/verify-otp",
                json={"email": "nigar@farmer.az", "code": bad_code},
            )
            self.assertEqual(bad_res.status_code, 400)

            # Correct 4-digit OTP creates user + primary Quba parcel + JWT
            ok_res = self.client.post(
                "/api/v1/auth/register/verify-otp",
                json={"email": "nigar@farmer.az", "code": otp_code},
            )
            self.assertEqual(ok_res.status_code, 201, ok_res.text)
            session = ok_res.json()
            self.assertTrue(session["token"])
            self.assertEqual(session["user"]["email"], "nigar@farmer.az")
            self.assertEqual(session["parcels"][0]["region_id"], "quba-khachmaz")
        finally:
            for k, v in old_env.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
            get_settings.cache_clear()

    def test_password_reset_6digit_code_flow(self) -> None:
        self._register_sample(email="forgot-flow@farmer.az", region="Ganja-Dashkasan")
        sent_payloads: list[tuple[str, str, str]] = []

        def _fake_smtp(settings, recipient, subject, body):
            sent_payloads.append((recipient, subject, body))

        with patch.dict(
            os.environ,
            {
                "SMTP_HOST": "smtp.gmail.com",
                "SMTP_USER": "alerts@spacefarm.az",
                "SMTP_PASSWORD": "app-password-secret",
            },
            clear=False,
        ):
            get_settings.cache_clear()
            try:
                with patch("app.services.notifier._send_smtp_sync", side_effect=_fake_smtp):
                    res = self.client.post(
                        "/api/v1/auth/forgot-password",
                        json={"email": "forgot-flow@farmer.az"},
                    )
                self.assertEqual(res.status_code, 200, res.text)
                self.assertTrue(res.json()["code_dispatched"])
                self.assertEqual(len(sent_payloads), 1)
                import re
                match = re.search(r"\b(\d{6})\b", sent_payloads[0][1])
                self.assertIsNotNone(match, sent_payloads[0][1])
                reset_code = match.group(1)

                # Wrong 6-digit recovery code rejected
                bad = self.client.post(
                    "/api/v1/auth/reset-password",
                    json={"email": "forgot-flow@farmer.az", "code": "000001" if reset_code != "000001" else "000002", "new_password": "newpassword123"},
                )
                self.assertEqual(bad.status_code, 400)

                # Valid recovery code resets password
                good = self.client.post(
                    "/api/v1/auth/reset-password",
                    json={"email": "forgot-flow@farmer.az", "code": reset_code, "new_password": "newpassword123"},
                )
                self.assertEqual(good.status_code, 200, good.text)
                self.assertTrue(good.json()["ok"])

                # Old password fails, new password succeeds
                old_login = self.client.post(
                    "/api/v1/auth/login",
                    json={"email": "forgot-flow@farmer.az", "password": "securepassword1"},
                )
                self.assertEqual(old_login.status_code, 401)

                new_login = self.client.post(
                    "/api/v1/auth/login",
                    json={"email": "forgot-flow@farmer.az", "password": "newpassword123"},
                )
                self.assertEqual(new_login.status_code, 200, new_login.text)
                self.assertTrue(new_login.json()["token"])
            finally:
                get_settings.cache_clear()

    def test_google_oauth_verification(self) -> None:
        # Unconfigured GOOGLE_CLIENT_ID reports 503 honestly
        unconf = self.client.post(
            "/api/v1/auth/google",
            json={"credential": "x" * 30},
        )
        self.assertEqual(unconf.status_code, 503)

        class _DummyResp:
            def __init__(self, status_code: int, json_data: dict):
                self.status_code = status_code
                self._json = json_data

            def json(self):
                return self._json

        class _DummyGoogleClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def get(self, url: str, params=None, **kwargs):
                tok = (params or {}).get("id_token")
                if tok == "valid-google-id-token-123456":
                    return _DummyResp(
                        200,
                        {
                            "aud": "12345-test.apps.googleusercontent.com",
                            "sub": "google-sub-998877",
                            "email": "elchin@gmail.com",
                            "email_verified": "true",
                            "name": "Elchin Mammadov",
                        },
                    )
                if tok == "wrong-aud-id-token-123456":
                    return _DummyResp(
                        200,
                        {
                            "aud": "evil-client.apps.googleusercontent.com",
                            "sub": "google-sub-111",
                            "email": "evil@gmail.com",
                            "email_verified": "true",
                        },
                    )
                return _DummyResp(400, {"error_description": "Invalid Value"})

        old_gid = os.environ.get("GOOGLE_CLIENT_ID")
        try:
            os.environ["GOOGLE_CLIENT_ID"] = "12345-test.apps.googleusercontent.com"
            get_settings.cache_clear()

            prov = self.client.get("/api/v1/auth/providers")
            self.assertEqual(prov.status_code, 200)
            self.assertTrue(prov.json()["google_enabled"])
            self.assertEqual(prov.json()["google_client_id"], "12345-test.apps.googleusercontent.com")

            with patch("app.routes.workspace_api.httpx.AsyncClient", _DummyGoogleClient):
                wrong_aud = self.client.post(
                    "/api/v1/auth/google",
                    json={"credential": "wrong-aud-id-token-123456"},
                )
                self.assertEqual(wrong_aud.status_code, 401)

                ok_res = self.client.post(
                    "/api/v1/auth/google",
                    json={"credential": "valid-google-id-token-123456", "region": "Astara"},
                )
                self.assertEqual(ok_res.status_code, 200, ok_res.text)
                body = ok_res.json()
                self.assertTrue(body["token"])
                self.assertEqual(body["user"]["email"], "elchin@gmail.com")
                self.assertEqual(body["parcels"][0]["region_id"], "astara")
        finally:
            if old_gid is None:
                os.environ.pop("GOOGLE_CLIENT_ID", None)
            else:
                os.environ["GOOGLE_CLIENT_ID"] = old_gid
            get_settings.cache_clear()

    def test_orbital_districts_and_registration_seed(self) -> None:
        dist_res = self.client.get("/api/orbital/districts")
        self.assertEqual(dist_res.status_code, 200, dist_res.text)
        dist_body = dist_res.json()
        self.assertEqual(dist_body["count"], 67)
        self.assertEqual(len(dist_body["districts"]), 67)
        self.assertIn("ganja-dashkasan", dist_body["primary_region_ids"])

        astara_entry = next((d for d in dist_body["districts"] if d["id"] == "astara"), None)
        self.assertIsNotNone(astara_entry)

        token, user, reg_parcels = self._register_sample(email="astara-farmer@farmer.az", region="Astara")
        self.assertEqual(user["region"], "Astara")
        self.assertGreaterEqual(len(reg_parcels), 1)
        self.assertAlmostEqual(float(reg_parcels[0]["latitude"]), 38.456, places=3)
        self.assertAlmostEqual(float(reg_parcels[0]["longitude"]), 48.875, places=3)

        headers = {"Authorization": f"Bearer {token}"}
        prof_res = self.client.get("/api/v1/profile", headers=headers)
        self.assertEqual(prof_res.status_code, 200, prof_res.text)
        parcels = prof_res.json()["parcels"]
        self.assertGreaterEqual(len(parcels), 1)
        self.assertAlmostEqual(float(parcels[0]["latitude"]), 38.456, places=3)
        self.assertAlmostEqual(float(parcels[0]["longitude"]), 48.875, places=3)
        self.assertEqual(parcels[0]["region_id"], "astara")

    def test_vercel_serverless_runtime_paths_and_entrypoint(self) -> None:
        from app.config import Settings

        with patch.dict(
            os.environ,
            {"VERCEL": "1", "VERCEL_URL": "space-farm.vercel.app"},
            clear=False,
        ):
            cfg = Settings()
            self.assertTrue(cfg.is_vercel)
            self.assertEqual(cfg.runtime_data_dir_path.name, "spacefarm-data")
            self.assertEqual(cfg.cache_dir_path.name, "cache")
            self.assertIn("https://space-farm.vercel.app", cfg.cors_origin_list)

        repo_root = Path(__file__).resolve().parents[3]
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        from api.index import app as vercel_app

        self.assertEqual(vercel_app.title, "Space Farm API")

    def test_gmail_app_password_spaces_normalized_before_smtp_login(self) -> None:
        from app.config import Settings
        from app.services.notifier import _send_smtp_sync, is_smtp_configured

        captured: list[tuple[str, str]] = []

        class _FakeSMTP:
            def __init__(self, host: str, port: int, timeout: int = 15) -> None:
                self.host = host
                self.port = port

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def ehlo(self):
                return None

            def starttls(self):
                return None

            def login(self, user: str, password: str):
                captured.append((user, password))

            def send_message(self, msg):
                return None

        with patch.dict(
            os.environ,
            {
                "SMTP_HOST": "smtp.gmail.com",
                "SMTP_PORT": "587",
                "SMTP_USE_TLS": "true",
                "SMTP_USER": "space.farm.gov@gmail.com",
                "SMTP_PASSWORD": "abcd efgh ijkl mnop",
            },
            clear=False,
        ):
            cfg = Settings()
            self.assertTrue(is_smtp_configured(cfg))
            with patch("app.services.notifier.smtplib.SMTP", _FakeSMTP):
                _send_smtp_sync(cfg, "farmer@example.com", "OTP", "Code: 123456")

        self.assertEqual(captured, [("space.farm.gov@gmail.com", "abcdefghijklmnop")])

    def test_v2_token_rehydrates_user_and_primary_parcel_across_containers(self) -> None:
        with patch.dict(
            os.environ,
            {"SPACEFARM_AUTH_SECRET": "shared-vercel-test-secret-abcdef123456"},
            clear=False,
        ):
            reg = self.client.post(
                "/api/v1/auth/register",
                json={
                    "name": "Emin Rahimov",
                    "email": "coldstart@farmer.az",
                    "password": "strongpassword1",
                    "region": "Quba",
                },
            )
            self.assertEqual(reg.status_code, 201, reg.text)
            reg_body = reg.json()
            token = reg_body["token"]
            user_id = reg_body["user"]["id"]
            parcel_id = reg_body["parcels"][0]["id"]
            self.assertTrue(token.startswith("v2."))

            with tempfile.TemporaryDirectory() as cold_dir:
                cold_store = SpaceFarmStore(Settings(data_dir=cold_dir))
                self.assertEqual(cold_store.get_user_bundle(user_id), (None, []))

                cold_app = create_app()
                cold_app.dependency_overrides[_get_store] = lambda: cold_store
                with TestClient(cold_app) as cold_client:
                    headers = {"Authorization": f"Bearer {token}"}

                    prof = cold_client.get("/api/v1/profile", headers=headers)
                    self.assertEqual(prof.status_code, 200, prof.text)
                    prof_body = prof.json()
                    self.assertEqual(prof_body["user"]["id"], user_id)
                    self.assertEqual(prof_body["user"]["email"], "coldstart@farmer.az")
                    self.assertEqual(prof_body["parcels"][0]["id"], parcel_id)

                    upd = cold_client.put(
                        f"/api/v1/parcels/{parcel_id}",
                        headers=headers,
                        json={"soil_ph": 7.2, "irrigation_type": "irrigated", "irrigation_budget_mm": 350.0},
                    )
                    self.assertEqual(upd.status_code, 200, upd.text)
                    self.assertAlmostEqual(upd.json()["parcels"][0]["soil_ph"], 7.2)

                    alerts = cold_client.get("/api/v1/alerts/overview", headers=headers)
                    self.assertEqual(alerts.status_code, 200, alerts.text)


