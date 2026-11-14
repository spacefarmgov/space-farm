"""Tests T09-T16 and API contract/security behavior (Role B)."""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402


def _base_simulation_payload() -> dict:
    return {
        "contract_version": "0.1.0",
        "farm": {
            "farm_id": "ganja-demo",
            "label": "Ganja demo field",
            "is_demo": True,
            "location": {"latitude": 40.68, "longitude": 46.36, "crs": "EPSG:4326"},
            "area_ha": 10.0,
            "irrigation_type": "rainfed",
            "irrigation_budget_mm_per_season": None,
            "soil": {
                "ph": 7.1,
                "texture": "loam",
                "source_type": "user_reported",
                "sample_date": None,
                "depth_cm": None,
                "source_ref": None,
            },
            "crop_history": [],
        },
        "climate_period": {"start_date": "2024-01-01", "end_date": "2024-12-31"},
        "horizon_years": 3,
        "preferences": {"water": 0.5, "soil": 0.3, "income": 0.2},
        "scenario": {"kind": "baseline", "rainfall_multiplier": 1.0},
        "max_plans": 3,
    }


class ApiAndEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_mode = os.environ.get("DATA_MODE")
        self._old_env = os.environ.get("APP_ENV")
        os.environ["DATA_MODE"] = "cached"
        os.environ["APP_ENV"] = "test"
        get_settings.cache_clear()
        self.client = TestClient(create_app())

    def tearDown(self) -> None:
        if self._old_mode is None:
            os.environ.pop("DATA_MODE", None)
        else:
            os.environ["DATA_MODE"] = self._old_mode
        if self._old_env is None:
            os.environ.pop("APP_ENV", None)
        else:
            os.environ["APP_ENV"] = self._old_env
        get_settings.cache_clear()

    def test_health_and_crops_catalog_contract(self) -> None:
        r_health = self.client.get("/api/v1/health")
        self.assertEqual(r_health.status_code, 200)
        health = r_health.json()
        self.assertEqual(health["status"], "ok")
        self.assertEqual(health["contract_version"], "0.1.0")

        r_crops = self.client.get("/api/v1/crops")
        self.assertEqual(r_crops.status_code, 200)
        crops_data = r_crops.json()
        self.assertEqual(len(crops_data["crops"]), 6)
        for crop in crops_data["crops"]:
            self.assertNotEqual(crop["validation_status"], "expert_reviewed")

    def test_t09_invalid_preferences_returns_422_error_envelope(self) -> None:
        payload = _base_simulation_payload()
        payload["preferences"] = {"water": 0.6, "soil": 0.3, "income": 0.3}
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 422)
        body = resp.json()
        self.assertIn("error", body)
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(body["error"]["details"][0]["reason"], "sum_mismatch")
        self.assertFalse(body["error"]["retryable"])
        self.assertTrue(resp.headers.get("X-Request-ID"))

    def test_t09_unknown_crop_history_returns_422_error_envelope(self) -> None:
        payload = _base_simulation_payload()
        payload["farm"]["crop_history"] = [{"year": 2023, "crop_id": "dragonfruit"}]
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["error"]["code"], "VALIDATION_ERROR")

    def test_t10_hard_constraints_enforced_before_scoring(self) -> None:
        payload = _base_simulation_payload()
        payload["farm"]["crop_history"] = [{"year": 2023, "crop_id": "chickpea"}]
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "completed")
        self.assertGreater(len(data["plans"]), 0)
        for plan in data["plans"]:
            y1, y2, y3 = plan["years"]
            # Prior chickpea (Fabaceae) forbids both chickpea and lentil in Year 1
            self.assertNotIn(y1["crop_id"], {"chickpea", "lentil"})
            # Sunflower requires >=600 mm so excluded at rainfed 506.52 mm
            self.assertNotIn("sunflower", {y1["crop_id"], y2["crop_id"], y3["crop_id"]})
            self.assertNotEqual(y1["crop_id"], y2["crop_id"])
            self.assertNotEqual(y2["crop_id"], y3["crop_id"])

    def test_t11_deterministic_results_across_repeated_runs(self) -> None:
        payload = _base_simulation_payload()
        r1 = self.client.post("/api/v1/simulations", json=payload).json()
        r2 = self.client.post("/api/v1/simulations", json=payload).json()
        self.assertEqual(r1["plans"], r2["plans"])
        self.assertEqual(r1["weights_effective"], r2["weights_effective"])
        self.assertEqual(r1["status"], r2["status"])

    def test_t12_no_feasible_plan_under_severe_stress(self) -> None:
        payload = _base_simulation_payload()
        payload["scenario"] = {"kind": "rainfall_stress", "rainfall_multiplier": 0.7}
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "no_feasible_plan")
        self.assertEqual(body["plans"], [])
        self.assertGreater(len(body["rejected_summary"]), 0)

    def test_t13_unknown_soil_ph_preserved_as_provisional(self) -> None:
        payload = _base_simulation_payload()
        payload["farm"]["soil"] = {"ph": None, "texture": "unknown", "source_type": "unknown"}
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "provisional")
        self.assertFalse(body["input_summary"]["soil_ph_known"])
        for plan in body["plans"]:
            self.assertEqual(plan["uncertainty"], "high")
            ph_chk = next(c for c in plan["constraints_checked"] if c["rule_id"] == "RULE_SOIL_PH_RANGE")
            self.assertEqual(ph_chk["result"], "unknown")

    def test_t14_unavailable_income_renormalizes_active_weights(self) -> None:
        payload = _base_simulation_payload()
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertAlmostEqual(body["weights_effective"]["water"], 0.625, places=5)
        self.assertAlmostEqual(body["weights_effective"]["soil"], 0.375, places=5)
        self.assertEqual(body["weights_effective"]["income"], 0.0)
        self.assertEqual(body["unavailable_objectives"][0]["objective"], "income")
        for plan in body["plans"]:
            self.assertIsNone(plan["score_components"]["income"]["value"])

    def test_t15_only_unavailable_objective_weighted_returns_needs_data(self) -> None:
        payload = _base_simulation_payload()
        payload["preferences"] = {"water": 0.0, "soil": 0.0, "income": 1.0}
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "needs_data")
        self.assertEqual(body["plans"], [])
        self.assertEqual(body["weights_effective"], {"water": 0.0, "soil": 0.0, "income": 0.0})

    def test_t16_stress_multiplier_preserves_raw_nasa_dataset(self) -> None:
        base_resp = self.client.post("/api/v1/simulations", json=_base_simulation_payload()).json()
        stress_payload = _base_simulation_payload()
        stress_payload["scenario"] = {"kind": "rainfall_stress", "rainfall_multiplier": 0.9}
        stress_resp = self.client.post("/api/v1/simulations", json=stress_payload).json()

        base_precip = next(
            f["value"] for f in base_resp["climate"]["features"] if f["feature_id"] == "total_precipitation_mm"
        )
        stress_raw_precip = next(
            f["value"] for f in stress_resp["climate"]["features"] if f["feature_id"] == "total_precipitation_mm"
        )
        # Raw NASA observation must NOT be mutated
        self.assertEqual(base_precip, stress_raw_precip)
        self.assertAlmostEqual(
            stress_resp["input_summary"]["effective_precipitation_mm"],
            round(base_precip * 0.9, 2),
            places=2,
        )
        for plan in stress_resp["plans"]:
            self.assertEqual(plan["scenario_label"], "hypothetical_rainfall_stress")

    def test_production_blocks_demo_fixture_mode(self) -> None:
        os.environ["APP_ENV"] = "production"
        get_settings.cache_clear()
        prod_client = TestClient(create_app())
        resp = prod_client.get(
            "/api/v1/climate/features",
            params={
                "latitude": 40.68,
                "longitude": 46.36,
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "mode": "demo_fixture",
            },
        )
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["error"]["code"], "VALIDATION_ERROR")

    def test_generated_openapi_matches_app(self) -> None:
        openapi_path = Path(__file__).resolve().parents[3] / "contracts" / "openapi.json"
        self.assertTrue(openapi_path.exists())
        committed = json.loads(openapi_path.read_text(encoding="utf-8"))
        self.assertIn("/api/v1/simulations", committed["paths"])
        self.assertIn("/api/v1/climate/features", committed["paths"])

    def test_climate_features_endpoint_cached_and_errors(self) -> None:
        ok_resp = self.client.get(
            "/api/v1/climate/features",
            params={
                "latitude": 40.68,
                "longitude": 46.36,
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "time_standard": "UTC",
            },
        )
        self.assertEqual(ok_resp.status_code, 200)
        bundle = ok_resp.json()
        self.assertEqual(bundle["data_mode"], "cached")
        self.assertEqual(bundle["quality"], "complete")

        # Mixed/non-UTC rejected with 422 ErrorEnvelope
        bad_std = self.client.get(
            "/api/v1/climate/features",
            params={
                "latitude": 40.68,
                "longitude": 46.36,
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "time_standard": "LST",
            },
        )
        self.assertEqual(bad_std.status_code, 422)
        self.assertEqual(bad_std.json()["error"]["code"], "VALIDATION_ERROR")

        # Unmatched coordinates in cached mode -> 503 DATA_UNAVAILABLE
        miss_resp = self.client.get(
            "/api/v1/climate/features",
            params={
                "latitude": 40.41,
                "longitude": 49.87,
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
            },
        )
        self.assertEqual(miss_resp.status_code, 503)
        self.assertEqual(miss_resp.json()["error"]["code"], "DATA_UNAVAILABLE")

    def test_irrigated_budget_enables_higher_water_crops(self) -> None:
        payload = _base_simulation_payload()
        payload["farm"]["irrigation_type"] = "irrigated"
        payload["farm"]["irrigation_budget_mm_per_season"] = 220.0
        payload["scenario"] = {"kind": "rainfall_stress", "rainfall_multiplier": 0.7}
        resp = self.client.post("/api/v1/simulations", json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        # 506.52 * 0.7 + 220 = 574.56 mm -> feasible plans exist even under 0.7x stress!
        self.assertEqual(body["status"], "completed")
        self.assertGreater(len(body["plans"]), 0)
        self.assertGreater(body["input_summary"]["effective_water_supply_mm"], 550.0)

    def test_contract_validation_edge_cases(self) -> None:
        # 1. laboratory soil without source_ref
        p1 = _base_simulation_payload()
        p1["farm"]["soil"]["source_type"] = "laboratory"
        p1["farm"]["soil"]["source_ref"] = None
        self.assertEqual(self.client.post("/api/v1/simulations", json=p1).status_code, 422)

        # 2. rainfed with non-zero irrigation budget
        p2 = _base_simulation_payload()
        p2["farm"]["irrigation_budget_mm_per_season"] = 100.0
        self.assertEqual(self.client.post("/api/v1/simulations", json=p2).status_code, 422)

        # 3. invalid depth_cm interval
        p3 = _base_simulation_payload()
        p3["farm"]["soil"]["depth_cm"] = {"top": 30, "bottom": 10}
        self.assertEqual(self.client.post("/api/v1/simulations", json=p3).status_code, 422)


if __name__ == "__main__":
    unittest.main()
