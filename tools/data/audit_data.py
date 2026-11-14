"""Independent data, provenance, catalog, and contract audit tool (C-04)."""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_DIR = REPO_ROOT / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import get_settings  # noqa: E402
from app.data_adapters.catalog import get_crop_catalog  # noqa: E402
from app.data_adapters.pipeline import normalize_and_aggregate_power  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.models import (  # noqa: E402
    ClimateBundle,
    ClimateQuery,
    ErrorEnvelope,
    SimulationResponse,
)


def audit_snapshots(repo_root: Path) -> None:
    manifests = sorted((repo_root / "data" / "processed").glob("*.manifest.json"))
    assert manifests, "No snapshot manifests found in data/processed/"
    for m_path in manifests:
        qhash = m_path.name.replace(".manifest.json", "")
        raw_path = repo_root / "data" / "raw" / f"{qhash}.json"
        proc_path = repo_root / "data" / "processed" / f"{qhash}.json"
        assert raw_path.exists(), f"Missing raw snapshot for {qhash}"
        assert proc_path.exists(), f"Missing processed snapshot for {qhash}"

        manifest = json.loads(m_path.read_text(encoding="utf-8"))
        raw_bytes = raw_path.read_bytes()
        actual_sha = hashlib.sha256(raw_bytes).hexdigest()
        assert manifest["payload_sha256"] == actual_sha, f"SHA-256 mismatch for {qhash}"

        raw_payload = json.loads(raw_bytes.decode("utf-8"))
        stored_bundle = ClimateBundle.model_validate_json(proc_path.read_text(encoding="utf-8"))
        q = ClimateQuery.model_validate(
            {
                "latitude": manifest["query"]["latitude"],
                "longitude": manifest["query"]["longitude"],
                "start_date": manifest["query"]["start_date"],
                "end_date": manifest["query"]["end_date"],
                "time_standard": manifest["query"]["time_standard"],
            }
        )
        replayed = normalize_and_aggregate_power(
            raw_payload,
            raw_bytes=raw_bytes,
            request_url=manifest["request_url"],
            retrieved_at=datetime.fromisoformat(str(manifest["retrieved_at"]).replace("Z", "+00:00")),
            query=q,
            data_mode="cached",
        )
        assert replayed.features == stored_bundle.features, f"Non-deterministic replay for {qhash}"
        assert replayed.dataset_version == stored_bundle.dataset_version
        print(f"[PASS] Snapshot {qhash}: SHA-256 & deterministic feature replay verified.")


def audit_catalog() -> None:
    settings = get_settings()
    catalog = get_crop_catalog(settings)
    assert len(catalog.crops) == 6, f"Expected 6 candidate crops, got {len(catalog.crops)}"
    for crop in catalog.crops:
        assert crop.validation_status != "expert_reviewed", (
            f"Crop {crop.crop_id} falsely marked expert_reviewed"
        )
        assert crop.references, f"Crop {crop.crop_id} missing agronomic references"
        assert not crop.objective_inputs.income_model_available, (
            f"Crop {crop.crop_id} unexpectedly claims income_model_available=True"
        )
    for rule in catalog.rules:
        assert rule.validation_status != "expert_reviewed", (
            f"Rule {rule.rule_id} falsely marked expert_reviewed"
        )
        assert rule.source_url.startswith("https://"), f"Rule {rule.rule_id} missing valid source_url"
    print(f"[PASS] Catalog {catalog.catalog_version} ({len(catalog.crops)} crops, {len(catalog.rules)} rules) verified.")


def audit_contracts(repo_root: Path) -> None:
    openapi_path = repo_root / "contracts" / "openapi.json"
    assert openapi_path.exists(), "Missing contracts/openapi.json"
    committed = json.loads(openapi_path.read_text(encoding="utf-8"))
    live = app.openapi()
    assert committed["paths"] == live["paths"], "contracts/openapi.json paths out of sync with FastAPI app"

    fixtures_dir = repo_root / "contracts" / "fixtures"
    fixture_files = sorted(fixtures_dir.glob("*.json"))
    assert len(fixture_files) == 6, f"Expected 6 contract fixtures, got {len(fixture_files)}"
    for fpath in fixture_files:
        data = json.loads(fpath.read_text(encoding="utf-8"))
        assert data.get("synthetic") is True, f"Fixture {fpath.name} must declare synthetic=True"
        if fpath.name == "validation_error.json":
            ErrorEnvelope.model_validate({"error": data["error"]})
        else:
            sim = SimulationResponse.model_validate(data)
            assert sim.data_mode == "demo_fixture", f"Fixture {fpath.name} must use data_mode=demo_fixture"
    print(f"[PASS] OpenAPI & {len(fixture_files)} synthetic contract fixtures verified.")


def main() -> int:
    audit_snapshots(REPO_ROOT)
    audit_catalog()
    audit_contracts(REPO_ROOT)
    print("ALL DATA & CONTRACT AUDITS PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
