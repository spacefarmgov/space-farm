"""Versioned crop catalog and agronomic rules loader."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.config import Settings, get_settings
from app.data_adapters.exceptions import DataQualityError
from app.schemas.models import AgronomicRule, CropCatalog, CropInfo


@lru_cache(maxsize=4)
def _load_catalog_cached(crops_path_str: str, rules_path_str: str) -> CropCatalog:
    crops_path = Path(crops_path_str)
    rules_path = Path(rules_path_str)
    if not crops_path.exists() or not rules_path.exists():
        raise DataQualityError(
            "Crop catalog or rules JSON file is missing",
            reason="catalog_files_missing",
        )
    try:
        crops_data = json.loads(crops_path.read_text(encoding="utf-8"))
        rules_data = json.loads(rules_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DataQualityError(f"Failed to read catalog JSON: {exc}", reason="invalid_catalog_json") from exc

    crops = [CropInfo.model_validate(item) for item in crops_data.get("crops", [])]
    rules = [AgronomicRule.model_validate(item) for item in rules_data.get("rules", [])]

    return CropCatalog(
        catalog_version=str(crops_data["catalog_version"]),
        rules_version=str(rules_data.get("rules_version") or crops_data["rules_version"]),
        crops=crops,
        rules=rules,
    )


def get_crop_catalog(settings: Settings | None = None) -> CropCatalog:
    """Return validated versioned CropCatalog from data/catalog/."""
    cfg = settings or get_settings()
    crops_path = cfg.catalog_dir / "crops.json"
    rules_path = cfg.catalog_dir / "rules.json"
    return _load_catalog_cached(str(crops_path), str(rules_path))
