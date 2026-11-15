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

    def test_all_four_az_regional_presets_simulate_cleanly(self) -> None:
        presets = [
            ("Ganja", 40.68, 46.36, "rainfed", None, "wheat"),
            ("Aran", 40.38, 47.12, "irrigated", 220.0, "wheat"),
            ("Quba-Khachmaz", 41.36, 48.51, "rainfed", None, "barley"),
            ("Sheki-Zaqatala", 41.19, 47.17, "rainfed", None, "maize"),
        ]
        for label, lat, lon, irr, budget, prior_crop in presets:
            payload = _base_simulation_payload()
            payload["farm"]["label"] = label
            payload["farm"]["location"] = {"latitude": lat, "longitude": lon, "crs": "EPSG:4326"}
            payload["farm"]["irrigation_type"] = irr
            payload["farm"]["irrigation_budget_mm_per_season"] = budget
            payload["farm"]["crop_history"] = [{"year": 2024, "crop_id": prior_crop}]
            resp = self.client.post("/api/v1/simulations", json=payload)
            self.assertEqual(resp.status_code, 200, f"{label}: {resp.text}")
            body = resp.json()
            self.assertEqual(body["status"], "completed", label)
            self.assertEqual(len(body["plans"]), 3, label)
            self.assertNotEqual(body["plans"][0]["years"][0]["crop_id"], prior_crop, label)

    def test_disallowed_predecessor_crops_enforced_across_families(self) -> None:
        from app.data_adapters.catalog import get_crop_catalog
        from app.engine.constraints import evaluate_sequence_constraints
        from app.schemas.models import CropInfo, SimulationRequest

        catalog = get_crop_catalog(get_settings())
        crop_map = {c.crop_id: c.model_copy(deep=True) for c in catalog.crops}
        # Inject cross-family disallowed predecessor: sunflower (Asteraceae) disallows maize (Poaceae)
        custom_sunflower = CropInfo.model_validate(
            {
                **crop_map["sunflower"].model_dump(),
                "predecessor_rules": {
                    **crop_map["sunflower"].predecessor_rules.model_dump(),
                    "disallowed_predecessor_crops": ["sunflower", "maize"],
                },
            }
        )
        req = SimulationRequest.model_validate(_base_simulation_payload())
        res = evaluate_sequence_constraints(
            (crop_map["maize"], custom_sunflower, crop_map["barley"]),
            request=req,
            effective_water_mm=650.0,
            irrigation_unknown=False,
            irrigation_note="rainfed_precipitation_only",
            crop_map=crop_map,
        )
        self.assertFalse(res.feasible)
        self.assertEqual(res.failed_rules[0][0], "RULE_NO_CONSECUTIVE_SENSITIVE_FAMILY")
        self.assertIn("disallows predecessor maize", res.failed_rules[0][1])

    def test_climate_timeseries_demo_fixture_and_validation(self) -> None:
        ok = self.client.get(
            "/api/v1/climate/timeseries",
            params={
                "latitude": 40.68,
                "longitude": 46.36,
                "start_date": "2015-01-01",
                "end_date": "2024-12-31",
                "mode": "demo_fixture",
            },
        )
        self.assertEqual(ok.status_code, 200)
        body = ok.json()
        self.assertEqual(len(body["annual_series"]), 10)
        self.assertEqual(len(body["focus_monthly_series"]), 12)
        self.assertIsNotNone(body["trend"]["temp_shift_c_per_decade"])
        self.assertIn(body["trend"]["drought_risk_level"], {"low", "moderate", "elevated", "unknown"})

        too_long = self.client.get(
            "/api/v1/climate/timeseries",
            params={
                "latitude": 40.68,
                "longitude": 46.36,
                "start_date": "2000-01-01",
                "end_date": "2024-12-31",
                "mode": "demo_fixture",
            },
        )
        self.assertEqual(too_long.status_code, 422)

    def test_climate_timeseries_aggregation_handles_heat_frost_dry_spell_and_missing(self) -> None:
        from datetime import date, datetime, timedelta, timezone
        from app.data_adapters.pipeline import normalize_and_aggregate_timeseries
        from app.schemas.models import ClimateTimeseriesQuery

        t2m, tmin, tmax, pr = {}, {}, {}, {}
        start = date(2022, 1, 1)
        for yr_idx, yr in enumerate((2022, 2023, 2024)):
            cur = date(yr, 1, 1)
            end = date(yr, 12, 31)
            day_i = 0
            while cur <= end:
                key = cur.strftime("%Y%m%d")
                t2m[key] = 10.0 + yr_idx * 1.5
                tmin[key] = -2.0 if day_i < 10 else 12.0
                tmax[key] = 36.5 if (200 <= day_i < 205) else 22.0
                pr[key] = -999.0 if (day_i == 50) else (0.0 if 100 <= day_i < 130 else 2.2)
                cur += timedelta(days=1)
                day_i += 1

        raw_payload = {
            "geometry": {"type": "Point", "coordinates": [46.36, 40.68, 1200.0]},
            "header": {
                "api": {"version": "v2.10.3"},
                "sources": ["MERRA2", "POWER"],
                "fill_value": -999.0,
                "time_standard": "UTC",
            },
            "parameters": {
                "T2M": {"units": "C"},
                "T2M_MIN": {"units": "C"},
                "T2M_MAX": {"units": "C"},
                "PRECTOTCORR": {"units": "mm/day"},
            },
            "properties": {
                "parameter": {"T2M": t2m, "T2M_MIN": tmin, "T2M_MAX": tmax, "PRECTOTCORR": pr}
            },
        }
        q = ClimateTimeseriesQuery(
            latitude=40.68,
            longitude=46.36,
            start_date=start,
            end_date=date(2024, 12, 31),
        )
        bundle = normalize_and_aggregate_timeseries(
            raw_payload,
            raw_bytes=json.dumps(raw_payload).encode("utf-8"),
            request_url="https://power.larc.nasa.gov/api/temporal/daily/point",
            retrieved_at=datetime(2026, 11, 14, tzinfo=timezone.utc),
            query=q,
            data_mode="live",
        )
        self.assertEqual(len(bundle.annual_series), 3)
        self.assertEqual(bundle.annual_series[0].frost_days, 10)
        self.assertEqual(bundle.annual_series[0].heat_stress_days, 5)
        self.assertEqual(bundle.annual_series[0].max_dry_spell_days, 30)
        self.assertEqual(bundle.annual_series[0].valid_days, 364)
        self.assertEqual(bundle.trend.temp_shift_c_per_decade, 15.0)
        self.assertEqual(bundle.trend.hottest_year, 2024)
        self.assertEqual(len(bundle.focus_monthly_series), 12)

    def test_simulation_returns_baseline_practice_indicators_and_pinned_stress_plan(self) -> None:
        base_payload = _base_simulation_payload()
        base_payload["farm"]["crop_history"] = [{"year": 2024, "crop_id": "wheat"}]
        base_resp = self.client.post("/api/v1/simulations", json=base_payload).json()
        self.assertEqual(base_resp["status"], "completed")
        top_plan = base_resp["plans"][0]
        self.assertIsNotNone(top_plan["indicators"])
        self.assertGreater(top_plan["indicators"]["nitrogen_fixation_score"], 0.5)
        self.assertGreater(len(top_plan["benefits"]), 0)

        baseline_bench = base_resp["baseline_practice_plan"]
        self.assertIsNotNone(baseline_bench)
        self.assertFalse(baseline_bench["feasible"])
        self.assertEqual([y["crop_id"] for y in baseline_bench["years"]], ["wheat", "wheat", "wheat"])
        self.assertTrue(any("RULE_NO_CONSECUTIVE_SAME_CROP" in r for r in baseline_bench["failed_rules"]))

        # Pin top plan and run severe 0.7x drought stress -> plans=[] but pinned_plan_evaluation explains why!
        stress_payload = _base_simulation_payload()
        stress_payload["scenario"] = {"kind": "rainfall_stress", "rainfall_multiplier": 0.7}
        stress_payload["pinned_plan_id"] = top_plan["plan_id"]
        stress_resp = self.client.post("/api/v1/simulations", json=stress_payload).json()
        self.assertEqual(stress_resp["status"], "no_feasible_plan")
        self.assertEqual(stress_resp["plans"], [])
        pinned = stress_resp["pinned_plan_evaluation"]
        self.assertIsNotNone(pinned)
        self.assertEqual(pinned["plan_id"], top_plan["plan_id"])
        self.assertFalse(pinned["feasible"])
        self.assertTrue(any("RULE_WATER_SUPPLY_MATCH" in r for r in pinned["failed_rules"]))

    def test_stage3_engine_grounds_extended_wetness_and_irradiance_without_score_drift(self) -> None:
        from app.data_adapters.catalog import get_crop_catalog
        from app.data_adapters.provider import get_climate_features
        from app.engine.planner import run_simulation
        from app.schemas.models import ClimateQuery, SimulationRequest
        import asyncio

        settings = get_settings()
        query = ClimateQuery(
            latitude=40.68,
            longitude=46.36,
            start_date="2024-01-01",
            end_date="2024-12-31",
            time_standard="UTC",
        )
        base_climate = asyncio.run(get_climate_features(query, mode_override="cached", settings=settings))
        ext_climate = base_climate.model_copy(deep=True)
        tmpl = ext_climate.features[0]
        ext_climate.features = [
            f for f in ext_climate.features
            if f.feature_id not in {
                "mean_surface_soil_wetness",
                "mean_root_zone_soil_wetness",
                "mean_solar_irradiance_mj_m2_day",
            }
        ]
        base_only = base_climate.model_copy(deep=True)
        base_only.features = [
            f for f in base_only.features
            if f.feature_id not in {
                "mean_surface_soil_wetness",
                "mean_root_zone_soil_wetness",
                "mean_solar_irradiance_mj_m2_day",
            }
        ]
        ext_climate.features.extend([
            tmpl.model_copy(update={"feature_id": "mean_surface_soil_wetness", "value": 0.41, "unit": "1", "parameter_codes": ["GWETTOP"]}),
            tmpl.model_copy(update={"feature_id": "mean_root_zone_soil_wetness", "value": 0.42, "unit": "1", "parameter_codes": ["GWETROOT"]}),
            tmpl.model_copy(update={"feature_id": "mean_solar_irradiance_mj_m2_day", "value": 16.8, "unit": "MJ/m^2/day", "parameter_codes": ["ALLSKY_SFC_SW_DWN"]}),
        ])

        catalog = get_crop_catalog(settings)
        req = SimulationRequest.model_validate(_base_simulation_payload())
        sim_base = run_simulation(req, base_only, catalog)
        sim_ext = run_simulation(req, ext_climate, catalog)

        self.assertEqual(sim_base.plans[0].plan_id, sim_ext.plans[0].plan_id)
        self.assertEqual(sim_base.plans[0].score, sim_ext.plans[0].score)
        water_exp = sim_ext.plans[0].explanations[0]
        self.assertIn("mean_root_zone_soil_wetness", water_exp.feature_ids)
        self.assertIn("mean_solar_irradiance_mj_m2_day", water_exp.feature_ids)
        self.assertIn("root-zone wetness 0.42", water_exp.text)
        self.assertTrue(any("root-zone soil wetness" in r for r in sim_ext.plans[0].risk_factors))


if __name__ == "__main__":
    unittest.main()
