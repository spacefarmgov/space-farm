"""Deterministic 3-year crop rotation planner orchestrating constraints, scoring, and provenance."""

from __future__ import annotations

import itertools
import uuid
from datetime import datetime, timezone

from app.config import CONTRACT_VERSION, MODEL_VERSION
from app.engine.constraints import (
    compute_effective_water_supply,
    evaluate_sequence_constraints,
    summarize_rejections,
)
from app.engine.scoring import (
    compute_agronomic_indicators_and_notes,
    resolve_effective_weights,
    score_feasible_sequence,
)
from app.schemas.models import (
    ClimateBundle,
    CropCatalog,
    CropInfo,
    InputSummary,
    PlanExplanation,
    RotationPlan,
    RotationYear,
    SimulationRequest,
    SimulationResponse,
    SimulationStatus,
    UncertaintyLevel,
)

_UNCERTAINTY_RANK: dict[UncertaintyLevel, int] = {
    "low": 0,
    "medium": 1,
    "high": 2,
}


def _find_feature_value(climate: ClimateBundle, feature_id: str) -> float | None:
    for feat in climate.features:
        if feat.feature_id == feature_id:
            return feat.value
    return None


def _determine_uncertainty(
    *,
    request: SimulationRequest,
    climate: ClimateBundle,
    has_unknown_constraint: bool,
) -> UncertaintyLevel:
    if (
        has_unknown_constraint
        or request.farm.soil.ph is None
        or request.farm.soil.source_type == "unknown"
        or climate.quality != "complete"
    ):
        return "high"
    # Provisional FAO rules without local agronomist calibration -> medium (never over-claim low)
    return "medium"


def _build_evaluated_plan(
    seq: tuple[CropInfo, CropInfo, CropInfo],
    *,
    request: SimulationRequest,
    climate: ClimateBundle,
    raw_precip_mm: float,
    mean_temp_c: float | None,
    effective_water_mm: float,
    irrigation_unknown: bool,
    irrigation_note: str,
    crop_map: dict[str, CropInfo],
    weights,
    climate_source_id: str,
    scenario_label: str,
    eval_res=None,
) -> RotationPlan:
    """Evaluate constraints, score, agronomic indicators, benefits, and risks for any 3-year sequence."""
    if eval_res is None:
        eval_res = evaluate_sequence_constraints(
            seq,
            request=request,
            effective_water_mm=effective_water_mm,
            irrigation_unknown=irrigation_unknown,
            irrigation_note=irrigation_note,
            crop_map=crop_map,
        )

    score, score_components = score_feasible_sequence(
        seq,
        request=request,
        effective_water_mm=effective_water_mm,
        weights=weights,
        climate_source_id=climate_source_id,
    )
    uncertainty = _determine_uncertainty(
        request=request,
        climate=climate,
        has_unknown_constraint=eval_res.has_unknown,
    )
    indicators, benefits, risk_factors = compute_agronomic_indicators_and_notes(
        seq,
        request=request,
        effective_water_mm=effective_water_mm,
        climate=climate,
        failed_rules=eval_res.failed_rules,
    )
    crop_ids = (seq[0].crop_id, seq[1].crop_id, seq[2].crop_id)
    plan_id = f"plan-{crop_ids[0]}-{crop_ids[1]}-{crop_ids[2]}"

    years = [
        RotationYear(
            year_index=idx,  # type: ignore[arg-type]
            crop_id=c.crop_id,
            crop_name=c.name,
            family=c.family,
            planting_window=c.season_windows.planting_window,
            harvest_window=c.season_windows.harvest_window,
        )
        for idx, c in enumerate(seq, start=1)
    ]

    temp_note = f"{mean_temp_c:.2f} C mean temp, " if mean_temp_c is not None else ""
    surf_wet = _find_feature_value(climate, "mean_surface_soil_wetness")
    root_wet = _find_feature_value(climate, "mean_root_zone_soil_wetness")
    solar_mj = _find_feature_value(climate, "mean_solar_irradiance_mj_m2_day")

    extra_parts: list[str] = []
    water_feature_ids = ["mean_temperature", "total_precipitation_mm"]
    if surf_wet is not None:
        extra_parts.append(f"surface soil wetness {surf_wet:.2f}")
        water_feature_ids.append("mean_surface_soil_wetness")
    if root_wet is not None:
        extra_parts.append(f"root-zone wetness {root_wet:.2f}")
        water_feature_ids.append("mean_root_zone_soil_wetness")
    if solar_mj is not None:
        extra_parts.append(f"solar irradiance {solar_mj:.2f} MJ/m^2/day")
        water_feature_ids.append("mean_solar_irradiance_mj_m2_day")
    hydro_solar_note = f" Observed NASA {', '.join(extra_parts)}." if extra_parts else ""

    explanations = [
        PlanExplanation(
            code="CLIMATE_WATER_ALIGNMENT",
            text=(
                f"Sequence {' -> '.join(c.name for c in seq)} aligns with {temp_note}"
                f"{effective_water_mm:.1f} mm seasonal water supply (raw NASA precip {raw_precip_mm:.2f} mm)."
                f"{hydro_solar_note}"
            ),
            feature_ids=water_feature_ids,
            rule_ids=["RULE_WATER_SUPPLY_MATCH", "RULE_SOFT_WATER_FIT"],
            source_ids=[climate_source_id, "catalog:crops-0.1.0"],
        ),
        PlanExplanation(
            code="ROTATION_SOIL_SYNERGY",
            text=(
                f"Alternates {len({c.family for c in seq})} botanical families "
                f"({', '.join(c.family for c in seq)}); nitrogen score {indicators.nitrogen_fixation_score:.2f}, "
                f"erosion protection {indicators.erosion_protection_score:.2f} ({indicators.bare_soil_gap_months_3yr}/36 mo bare-soil gap)."
            ),
            feature_ids=[],
            rule_ids=["RULE_NO_CONSECUTIVE_SENSITIVE_FAMILY", "RULE_SOFT_SOIL_DIVERSITY_AND_NITROGEN"],
            source_ids=["catalog:crops-0.1.0"],
        ),
    ]

    return RotationPlan(
        plan_id=plan_id,
        years=years,
        score=score,
        score_components=score_components,  # type: ignore[arg-type]
        explanations=explanations,
        constraints_checked=eval_res.checks,
        uncertainty=uncertainty,
        scenario_label=scenario_label,  # type: ignore[arg-type]
        indicators=indicators,
        benefits=benefits,
        risk_factors=risk_factors,
        feasible=eval_res.feasible,
        failed_rules=[f"{rid}: {msg}" for rid, msg in eval_res.failed_rules],
    )


def _resolve_pinned_sequence(
    pinned_plan_id: str | None, crop_map: dict[str, CropInfo]
) -> tuple[CropInfo, CropInfo, CropInfo] | None:
    if not pinned_plan_id or not pinned_plan_id.startswith("plan-"):
        return None
    parts = pinned_plan_id[len("plan-"):].split("-")
    if len(parts) != 3 or any(p not in crop_map for p in parts):
        return None
    return (crop_map[parts[0]], crop_map[parts[1]], crop_map[parts[2]])


def _evaluate_reference_plans(
    *,
    request: SimulationRequest,
    climate: ClimateBundle,
    raw_precip_mm: float,
    mean_temp_c: float | None,
    effective_water_mm: float,
    irrigation_unknown: bool,
    irrigation_note: str,
    crop_map: dict[str, CropInfo],
    weights,
    climate_source_id: str,
    scenario_label: str,
) -> tuple[RotationPlan | None, RotationPlan | None]:
    # 1. Existing/continuous monoculture baseline practice benchmark
    anchor_id = (
        max(request.farm.crop_history, key=lambda e: e.year).crop_id
        if request.farm.crop_history
        else "wheat"
    )
    anchor_crop = crop_map.get(anchor_id) or next(iter(crop_map.values()), None)
    baseline_practice: RotationPlan | None = None
    if anchor_crop is not None:
        baseline_practice = _build_evaluated_plan(
            (anchor_crop, anchor_crop, anchor_crop),
            request=request,
            climate=climate,
            raw_precip_mm=raw_precip_mm,
            mean_temp_c=mean_temp_c,
            effective_water_mm=effective_water_mm,
            irrigation_unknown=irrigation_unknown,
            irrigation_note=irrigation_note,
            crop_map=crop_map,
            weights=weights,
            climate_source_id=climate_source_id,
            scenario_label=scenario_label,
        )

    # 2. Optional pinned plan evaluation (for Scenario Lab comparison when plan drops below top-3)
    pinned_eval: RotationPlan | None = None
    pinned_seq = _resolve_pinned_sequence(request.pinned_plan_id, crop_map)
    if pinned_seq is not None:
        pinned_eval = _build_evaluated_plan(
            pinned_seq,
            request=request,
            climate=climate,
            raw_precip_mm=raw_precip_mm,
            mean_temp_c=mean_temp_c,
            effective_water_mm=effective_water_mm,
            irrigation_unknown=irrigation_unknown,
            irrigation_note=irrigation_note,
            crop_map=crop_map,
            weights=weights,
            climate_source_id=climate_source_id,
            scenario_label=scenario_label,
        )

    return baseline_practice, pinned_eval


def run_simulation(
    request: SimulationRequest,
    climate: ClimateBundle,
    catalog: CropCatalog,
    *,
    request_id: str | None = None,
) -> SimulationResponse:
    """Deterministically evaluate 3-year crop rotations against verified climate & soil inputs."""
    req_id = request_id or str(uuid.uuid4())
    sim_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)

    raw_precip_mm = _find_feature_value(climate, "total_precipitation_mm")
    mean_temp_c = _find_feature_value(climate, "mean_temperature")
    climate_source_id = climate.sources[0].id if climate.sources else "unknown_climate_source"

    effective_water_mm: float | None = None
    effective_precip_mm: float | None = None
    irrigation_unknown = request.farm.irrigation_type == "unknown" or (
        request.farm.irrigation_type == "irrigated"
        and request.farm.irrigation_budget_mm_per_season is None
    )
    irrigation_note = ""

    if raw_precip_mm is not None:
        effective_precip_mm = round(raw_precip_mm * request.scenario.rainfall_multiplier, 2)
        effective_water_mm, irrigation_unknown, irrigation_note = compute_effective_water_supply(
            request, raw_precip_mm
        )

    weight_res = resolve_effective_weights(request.preferences)

    warnings = list(climate.warnings)
    if request.preferences.income > 0.0:
        warnings.append(
            "Requested 'income' priority is unavailable in MVP v0.1.0 (no verified regional economic dataset); "
            f"effective weights normalized to water={weight_res.weights_effective.water:.3f}, "
            f"soil={weight_res.weights_effective.soil:.3f}."
        )
    if request.farm.soil.ph is None:
        warnings.append(
            "Soil pH is unknown; kept explicitly as unknown (never defaulted to pH 7.0). Plans are marked provisional with high uncertainty."
        )
    if irrigation_unknown:
        warnings.append(
            f"Irrigation supply could not be fully verified ({irrigation_note}); rainfall floor used and marked provisional."
        )
    if request.scenario.kind == "rainfall_stress":
        warnings.append(
            f"Precipitation scaling ({request.scenario.rainfall_multiplier:.1f}x) applied only in drought sensitivity mode; "
            "verified NASA POWER climate observations remain unaltered."
        )

    limitations = [
        "Agronomic water and pH bounds combine FAO crop parameters with your active parcel soil lab profile and regional baselines.",
        "NASA POWER Daily Point observations reflect a ~0.5x0.625 deg MERRA-2 grid cell rather than on-farm soil moisture probes or micro-climate stations.",
        "3-year rotation scoring uses historical period climate features as a baseline stress lens, not a 3-year seasonal weather forecast.",
    ]

    input_summary = InputSummary(
        farm_id=request.farm.farm_id,
        climate_period=request.climate_period,
        horizon_years=3,
        scenario=request.scenario,
        effective_precipitation_mm=effective_precip_mm,
        effective_water_supply_mm=effective_water_mm,
        soil_ph_known=request.farm.soil.ph is not None,
        irrigation_type=request.farm.irrigation_type,
    )

    # Guard: insufficient climate data or zero active objective weights (T15)
    if climate.quality == "insufficient" or raw_precip_mm is None or effective_water_mm is None:
        warnings.append(
            "Climate observation coverage is insufficient (<95%) or precipitation data is missing; cannot rank rotations safely."
        )
        return SimulationResponse(
            contract_version=CONTRACT_VERSION,
            request_id=req_id,
            simulation_id=sim_id,
            created_at=created_at,
            model_version=MODEL_VERSION,
            rules_version=catalog.rules_version,
            catalog_version=catalog.catalog_version,
            dataset_version=climate.dataset_version,
            status="needs_data",
            data_mode=climate.data_mode,
            input_summary=input_summary,
            weights_requested=request.preferences,
            weights_effective=weight_res.weights_effective,
            unavailable_objectives=weight_res.unavailable_objectives,
            plans=[],
            climate=climate,
            warnings=warnings,
            rejected_summary=[],
            limitations=limitations,
            synthetic=climate.synthetic,
        )

    if not weight_res.has_active_objectives:
        warnings.append(
            "All requested active weights belong to unavailable objectives (income=1.0); "
            "provide weight for water and/or soil to rank feasible plans."
        )
        return SimulationResponse(
            contract_version=CONTRACT_VERSION,
            request_id=req_id,
            simulation_id=sim_id,
            created_at=created_at,
            model_version=MODEL_VERSION,
            rules_version=catalog.rules_version,
            catalog_version=catalog.catalog_version,
            dataset_version=climate.dataset_version,
            status="needs_data",
            data_mode=climate.data_mode,
            input_summary=input_summary,
            weights_requested=request.preferences,
            weights_effective=weight_res.weights_effective,
            unavailable_objectives=weight_res.unavailable_objectives,
            plans=[],
            climate=climate,
            warnings=warnings,
            rejected_summary=[],
            limitations=limitations,
            synthetic=climate.synthetic,
        )

    # Deterministic crop ordering
    sorted_crops = sorted(catalog.crops, key=lambda c: c.crop_id)
    crop_map: dict[str, CropInfo] = {c.crop_id: c for c in sorted_crops}

    feasible_candidates: list[tuple[float, int, tuple[str, str, str], RotationPlan]] = []
    rejection_records: list[tuple[str, str]] = []

    scenario_label = (
        "baseline" if request.scenario.kind == "baseline" else "hypothetical_rainfall_stress"
    )

    for seq in itertools.product(sorted_crops, repeat=3):
        eval_res = evaluate_sequence_constraints(
            seq,
            request=request,
            effective_water_mm=effective_water_mm,
            irrigation_unknown=irrigation_unknown,
            irrigation_note=irrigation_note,
            crop_map=crop_map,
        )
        if not eval_res.feasible:
            rejection_records.extend(eval_res.failed_rules)
            continue

        plan = _build_evaluated_plan(
            seq,
            request=request,
            climate=climate,
            raw_precip_mm=raw_precip_mm,
            mean_temp_c=mean_temp_c,
            effective_water_mm=effective_water_mm,
            irrigation_unknown=irrigation_unknown,
            irrigation_note=irrigation_note,
            crop_map=crop_map,
            weights=weight_res.weights_effective,
            climate_source_id=climate_source_id,
            scenario_label=scenario_label,
            eval_res=eval_res,
        )
        crop_ids = (seq[0].crop_id, seq[1].crop_id, seq[2].crop_id)
        feasible_candidates.append(
            (plan.score or 0.0, _UNCERTAINTY_RANK[plan.uncertainty], crop_ids, plan)
        )

    rejected_summary = summarize_rejections(rejection_records)
    baseline_practice_plan, pinned_plan_evaluation = _evaluate_reference_plans(
        request=request,
        climate=climate,
        raw_precip_mm=raw_precip_mm,
        mean_temp_c=mean_temp_c,
        effective_water_mm=effective_water_mm,
        irrigation_unknown=irrigation_unknown,
        irrigation_note=irrigation_note,
        crop_map=crop_map,
        weights=weight_res.weights_effective,
        climate_source_id=climate_source_id,
        scenario_label=scenario_label,
    )

    if not feasible_candidates:
        warnings.append(
            "Zero candidate 3-year plans satisfied all hard agronomic constraints; adjust irrigation, soil inputs, or scenario stress."
        )
        return SimulationResponse(
            contract_version=CONTRACT_VERSION,
            request_id=req_id,
            simulation_id=sim_id,
            created_at=created_at,
            model_version=MODEL_VERSION,
            rules_version=catalog.rules_version,
            catalog_version=catalog.catalog_version,
            dataset_version=climate.dataset_version,
            status="no_feasible_plan",
            data_mode=climate.data_mode,
            input_summary=input_summary,
            weights_requested=request.preferences,
            weights_effective=weight_res.weights_effective,
            unavailable_objectives=weight_res.unavailable_objectives,
            plans=[],
            baseline_practice_plan=baseline_practice_plan,
            pinned_plan_evaluation=pinned_plan_evaluation,
            climate=climate,
            warnings=warnings,
            rejected_summary=rejected_summary,
            limitations=limitations,
            synthetic=climate.synthetic,
        )

    # Deterministic tie-break: highest score, lowest uncertainty rank, lexicographic crop_ids
    feasible_candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    selected_plans = [item[3] for item in feasible_candidates[: request.max_plans]]

    any_unknown = any(
        any(chk.result == "unknown" for chk in plan.constraints_checked)
        for plan in selected_plans
    )
    status: SimulationStatus = (
        "provisional" if (any_unknown or climate.quality == "partial") else "completed"
    )

    return SimulationResponse(
        contract_version=CONTRACT_VERSION,
        request_id=req_id,
        simulation_id=sim_id,
        created_at=created_at,
        model_version=MODEL_VERSION,
        rules_version=catalog.rules_version,
        catalog_version=catalog.catalog_version,
        dataset_version=climate.dataset_version,
        status=status,
        data_mode=climate.data_mode,
        input_summary=input_summary,
        weights_requested=request.preferences,
        weights_effective=weight_res.weights_effective,
        unavailable_objectives=weight_res.unavailable_objectives,
        plans=selected_plans,
        baseline_practice_plan=baseline_practice_plan,
        pinned_plan_evaluation=pinned_plan_evaluation,
        climate=climate,
        warnings=warnings,
        rejected_summary=rejected_summary,
        limitations=limitations,
        synthetic=climate.synthetic,
    )
