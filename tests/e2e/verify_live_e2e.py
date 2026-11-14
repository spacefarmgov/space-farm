"""Live end-to-end verification test (T22): real NASA POWER API -> FastAPI -> scoring."""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
API_DIR = REPO_ROOT / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402


class LiveNasaPowerE2ETest(unittest.TestCase):
    def setUp(self) -> None:
        self._old_mode = os.environ.get("DATA_MODE")
        os.environ["DATA_MODE"] = "live"
        get_settings.cache_clear()
        self.client = TestClient(create_app())

    def tearDown(self) -> None:
        if self._old_mode is None:
            os.environ.pop("DATA_MODE", None)
        else:
            os.environ["DATA_MODE"] = self._old_mode
        get_settings.cache_clear()

    def test_t22_live_nasa_power_to_simulation_and_stress_replay(self) -> None:
        base_req = {
            "contract_version": "0.1.0",
            "farm": {
                "farm_id": "ganja-demo",
                "label": "Ganja demo field",
                "is_demo": True,
                "location": {"latitude": 40.68, "longitude": 46.36, "crs": "EPSG:4326"},
                "area_ha": 10.0,
                "irrigation_type": "rainfed",
                "irrigation_budget_mm_per_season": None,
                "soil": {"ph": 7.1, "texture": "loam", "source_type": "user_reported"},
                "crop_history": [],
            },
            "climate_period": {"start_date": "2024-01-01", "end_date": "2024-12-31"},
            "horizon_years": 3,
            "preferences": {"water": 0.5, "soil": 0.3, "income": 0.2},
            "scenario": {"kind": "baseline", "rainfall_multiplier": 1.0},
            "max_plans": 3,
        }
        r_base = self.client.post("/api/v1/simulations", json=base_req)
        self.assertEqual(r_base.status_code, 200, r_base.text)
        body = r_base.json()
        self.assertIn(body["data_mode"], {"live", "cached"})
        self.assertFalse(body["synthetic"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(len(body["plans"]), 3)
        self.assertEqual(len(body["climate"]["sources"][0]["payload_sha256"]), 64)

        # Replay with 0.9x rainfall stress
        stress_req = dict(base_req)
        stress_req["scenario"] = {"kind": "rainfall_stress", "rainfall_multiplier": 0.9}
        r_stress = self.client.post("/api/v1/simulations", json=stress_req)
        self.assertEqual(r_stress.status_code, 200, r_stress.text)
        stress_body = r_stress.json()
        self.assertEqual(stress_body["plans"][0]["scenario_label"], "hypothetical_rainfall_stress")


if __name__ == "__main__":
    unittest.main()
