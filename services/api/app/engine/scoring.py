"""Deterministic multi-objective normalization, effective weight calculation, and scoring."""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.models import (
    ClimateBundle,
    CropInfo,
    EffectiveWeights,
    PlanAgronomicIndicators,
    PreferenceWeights,
    ScoreComponent,
    SimulationRequest,
    UnavailableObjective,
)


@dataclass(frozen=True)
class WeightResolution:
    weights_effective: EffectiveWeights
    unavailable_objectives: list[UnavailableObjective]
    has_active_objectives: bool


def resolve_effective_weights(preferences: PreferenceWeights) -> WeightResolution:
    """Exclude unavailable objectives (income in MVP) and renormalize active weights safely."""
    unavailable = [
        UnavailableObjective(
            objective="income",
            reason="No verified regional crop price, cost, or gross-margin dataset is available in MVP v0.1.0; AZN/profit metrics are withheld.",
        )
    ]

    known_sum = preferences.water + preferences.soil
    if known_sum <= 1e-9:
        # T15: only unavailable objective weighted -> zero effective weights, trigger needs_data (no div-by-zero)
        return WeightResolution(
            weights_effective=EffectiveWeights(water=0.0, soil=0.0, income=0.0),
            unavailable_objectives=unavailable,
            has_active_objectives=False,
        )

    w_water = round(preferences.water / known_sum, 6)
    w_soil = round(1.0 - w_water, 6)
    return WeightResolution(
        weights_effective=EffectiveWeights(water=w_water, soil=w_soil, income=0.0),
        unavailable_objectives=unavailable,
        has_active_objectives=True,
    )


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _water_band_fit(effective_water_mm: float, crop: CropInfo) -> float:
    band = crop.water_band_mm
    if band is None:
        return 0.5
    opt_min = band.optimal_min_mm if band.optimal_min_mm is not None else band.min_mm
    opt_max = band.optimal_max_mm if band.optimal_max_mm is not None else band.max_mm
    hard_max = band.max_mm * 1.4

    if opt_min <= effective_water_mm <= opt_max:
        return 1.0
    if effective_water_mm < opt_min:
        span = max(1.0, opt_min - band.min_mm)
        return _clamp01(0.55 + 0.45 * ((effective_water_mm - band.min_mm) / span))
    # Above optimal maximum up to hard waterlogging guard
    span = max(1.0, hard_max - opt_max)
    return _clamp01(1.0 - 0.55 * ((effective_water_mm - opt_max) / span))


def _ph_fit(ph: float | None, crop: CropInfo) -> float:
    if ph is None or crop.soil_ph_range is None:
        return 0.65  # dampened neutral placeholder when unknown
    pr = crop.soil_ph_range
    opt_min = pr.optimal_min_ph if pr.optimal_min_ph is not None else pr.min_ph
    opt_max = pr.optimal_max_ph if pr.optimal_max_ph is not None else pr.max_ph
    if opt_min <= ph <= opt_max:
        return 1.0
    if ph < opt_min:
        span = max(0.1, opt_min - pr.min_ph)
        return _clamp01(0.5 + 0.5 * ((ph - pr.min_ph) / span))
    span = max(0.1, pr.max_ph - opt_max)
    return _clamp01(0.5 + 0.5 * ((pr.max_ph - ph) / span))


def score_feasible_sequence(
    sequence: tuple[CropInfo, CropInfo, CropInfo],
    *,
    request: SimulationRequest,
    effective_water_mm: float,
    weights: EffectiveWeights,
    climate_source_id: str,
) -> tuple[float, dict[str, ScoreComponent]]:
    """Compute normalized [0, 1] objective components and deterministic [0, 100] score."""
    # 1. Water component [0, 1]
    fit_scores = [_water_band_fit(effective_water_mm, c) for c in sequence]
    eff_hints = [c.objective_inputs.water_efficiency_hint or 0.5 for c in sequence]

    avg_fit = sum(fit_scores) / 3.0
    avg_eff = sum(eff_hints) / 3.0
    stress_factor = request.scenario.rainfall_multiplier
    # Under rainfall stress or lower supply, intrinsic crop water efficiency carries greater weight
    eff_weight = 0.45 if stress_factor < 1.0 else 0.35
    water_value = round(_clamp01((1.0 - eff_weight) * avg_fit + eff_weight * avg_eff), 4)

    water_reason = (
        f"Mean water-band alignment {avg_fit:.2f} and crop water-efficiency {avg_eff:.2f} "
        f"under {effective_water_mm:.1f} mm seasonal supply"
        + (f" ({stress_factor:.1f}x rainfall stress)." if stress_factor < 1.0 else ".")
    )

    # 2. Soil component [0, 1]
    unique_families = len({c.family for c in sequence})
    diversity_score = unique_families / 3.0

    # Nitrogen & break synergy across Y1->Y2 and Y2->Y3
    synergy_points = 0.0
    for idx in range(2):
        prev_c = sequence[idx]
        next_c = sequence[idx + 1]
        if (
            prev_c.predecessor_rules.nitrogen_contribution == "fixes_nitrogen"
            and next_c.predecessor_rules.nitrogen_contribution in {"heavy_feeder", "neutral"}
        ):
            synergy_points += 0.5
        elif prev_c.family != next_c.family:
            synergy_points += 0.25
    synergy_score = _clamp01(synergy_points)

    avg_soil_contrib = sum(c.objective_inputs.soil_health_contribution or 0.5 for c in sequence) / 3.0
    avg_ph_fit = sum(_ph_fit(request.farm.soil.ph, c) for c in sequence) / 3.0

    raw_soil = 0.30 * diversity_score + 0.30 * synergy_score + 0.25 * avg_soil_contrib + 0.15 * avg_ph_fit
    if request.farm.soil.ph is None:
        # Apply honest certainty penalty when pH is unknown
        raw_soil *= 0.85
    soil_value = round(_clamp01(raw_soil), 4)

    soil_source_ref = "user_input:soil" if request.farm.soil.ph is not None else "user_input:soil_unknown"
    soil_reason = (
        f"{unique_families} distinct plant families, legume-cereal synergy {synergy_score:.2f}, "
        + (
            f"soil pH {request.farm.soil.ph:.2f} fit {avg_ph_fit:.2f}."
            if request.farm.soil.ph is not None
            else "soil pH unknown (certainty dampened, no default pH=7.0)."
        )
    )

    components: dict[str, ScoreComponent] = {
        "water": ScoreComponent(
            value=water_value,
            reason=water_reason,
            source_ids=[climate_source_id, "catalog:crops-0.1.0"],
            rule_ids=["RULE_SOFT_WATER_FIT"],
        ),
        "soil": ScoreComponent(
            value=soil_value,
            reason=soil_reason,
            source_ids=[soil_source_ref, "catalog:crops-0.1.0"],
            rule_ids=["RULE_SOFT_SOIL_DIVERSITY_AND_NITROGEN"],
        ),
        "income": ScoreComponent(
            value=None,
            reason="Unavailable in MVP v0.1.0: no verified regional price/cost dataset.",
            source_ids=["catalog:crops-0.1.0"],
            rule_ids=["RULE_INCOME_UNAVAILABLE_MVP"],
        ),
    }

    total_score = round(100.0 * (weights.water * water_value + weights.soil * soil_value), 2)
    return total_score, components


def _estimate_crop_cover_months(crop: CropInfo) -> int:
    """Estimate active vegetative ground-cover months per year from FAO phenology windows."""
    plant_txt = (crop.season_windows.planting_window or "").lower()
    cycle_min = crop.season_windows.cycle_days_min or 120
    cycle_max = crop.season_windows.cycle_days_max or 160
    avg_cycle_months = max(3, min(10, round(((cycle_min + cycle_max) / 2.0) / 30.0)))
    if "winter" in plant_txt or "oct" in plant_txt or "nov" in plant_txt:
        # Winter or dual-season cereals/pulses provide extended overwinter vegetative cover
        return min(10, max(avg_cycle_months, 7))
    return avg_cycle_months


def _find_climate_num(climate: ClimateBundle | None, feature_id: str) -> float | None:
    if climate is None:
        return None
    for feat in climate.features:
        if feat.feature_id == feature_id:
            return feat.value
    return None


def compute_agronomic_indicators_and_notes(
    sequence: tuple[CropInfo, CropInfo, CropInfo],
    *,
    request: SimulationRequest,
    effective_water_mm: float,
    climate: ClimateBundle | None,
    failed_rules: list[tuple[str, str]],
) -> tuple[PlanAgronomicIndicators, list[str], list[str]]:
    """Derive transparent nitrogen, erosion cover gap, climate resilience, benefits & risks."""
    # 1. Average water demand (mid-optimal band)
    demands: list[float] = []
    min_req_bounds: list[float] = []
    for c in sequence:
        band = c.water_band_mm
        if band is None:
            continue
        opt_min = band.optimal_min_mm if band.optimal_min_mm is not None else band.min_mm
        opt_max = band.optimal_max_mm if band.optimal_max_mm is not None else band.max_mm
        demands.append((opt_min + opt_max) / 2.0)
        min_req_bounds.append(band.min_mm)
    water_demand_avg = round(sum(demands) / len(demands), 1) if demands else 0.0

    # 2. Nitrogen fixation potential [0, 1]
    legume_count = sum(1 for c in sequence if c.predecessor_rules.nitrogen_contribution == "fixes_nitrogen")
    legume_to_feeder = sum(
        1
        for i in range(2)
        if sequence[i].predecessor_rules.nitrogen_contribution == "fixes_nitrogen"
        and sequence[i + 1].predecessor_rules.nitrogen_contribution in {"heavy_feeder", "neutral"}
    )
    n_score = round(_clamp01(0.45 * min(1.0, legume_count / 2.0) + 0.55 * min(1.0, legume_to_feeder / 2.0)), 3)

    # 3. Erosion protection & bare-soil cover gap (0..36 months)
    cover_months_total = sum(_estimate_crop_cover_months(c) for c in sequence)
    bare_soil_gap = max(0, min(36, 36 - cover_months_total))
    cover_ratio = _clamp01(cover_months_total / 26.0)
    family_div = len({c.family for c in sequence}) / 3.0
    erosion_score = round(_clamp01(0.70 * cover_ratio + 0.30 * family_div), 3)

    # 4. Climate resilience score [0, 1]
    min_margin = (
        min(effective_water_mm - m for m in min_req_bounds) if min_req_bounds else 0.0
    )
    water_buffer = _clamp01(0.5 + min_margin / 250.0)
    avg_eff = sum(c.objective_inputs.water_efficiency_hint or 0.5 for c in sequence) / 3.0
    frost_days = _find_climate_num(climate, "frost_days_count")
    max_temp_c = _find_climate_num(climate, "max_temperature")
    surf_wet = _find_climate_num(climate, "mean_surface_soil_wetness")
    root_wet = _find_climate_num(climate, "mean_root_zone_soil_wetness")
    solar_mj = _find_climate_num(climate, "mean_solar_irradiance_mj_m2_day")

    thermal_penalty = 0.0
    if max_temp_c is not None and max_temp_c >= 37.0 and any(c.crop_id in {"wheat", "maize"} for c in sequence):
        thermal_penalty += 0.08
    if frost_days is not None and frost_days >= 80.0 and not any(
        "oct" in (c.season_windows.planting_window or "").lower() for c in sequence
    ):
        thermal_penalty += 0.06
    climate_res = round(
        _clamp01(0.45 * avg_eff + 0.35 * water_buffer + 0.20 * family_div - thermal_penalty),
        3,
    )

    indicators = PlanAgronomicIndicators(
        water_demand_mm_avg=water_demand_avg,
        nitrogen_fixation_score=n_score,
        erosion_protection_score=erosion_score,
        bare_soil_gap_months_3yr=bare_soil_gap,
        climate_resilience_score=climate_res,
    )

    # Benefits & Risk factors (strictly grounded in rules & observed NASA features)
    benefits: list[str] = []
    if legume_count > 0:
        benefits.append(
            f"Includes {legume_count} nitrogen-fixing Fabaceae season(s), supporting soil N replenishment."
        )
    if len({c.family for c in sequence}) >= 2:
        benefits.append(
            f"Rotates {len({c.family for c in sequence})} botanical family group(s) to disrupt pest and pathogen carryover."
        )
    if cover_months_total >= 20:
        benefits.append(
            f"Maintains ~{cover_months_total}/36 months of estimated vegetative cover to limit topsoil erosion."
        )
    if not failed_rules and min_margin >= 40.0:
        benefits.append(
            f"Provides +{min_margin:.0f} mm water supply safety buffer above minimum crop requirements."
        )
    if root_wet is not None and root_wet >= 0.50:
        surf_note = f" (surface {surf_wet:.2f})" if surf_wet is not None else ""
        benefits.append(
            f"NASA POWER root-zone soil wetness averages {root_wet:.2f}{surf_note}, supporting spring establishment and legume nodulation."
        )

    risks: list[str] = []
    for rule_id, msg in failed_rules:
        risks.append(f"[{rule_id}] {msg}")
    if bare_soil_gap > 16:
        risks.append(
            f"Estimated {bare_soil_gap}/36 months with sparse/bare fallow soil cover; consider cover crops or stubble retention."
        )
    if request.farm.soil.ph is None:
        risks.append("Soil pH is unverified; tolerance bounds remain provisional until lab or field test.")
    if root_wet is not None and root_wet < 0.45:
        risks.append(
            f"NASA POWER root-zone soil wetness averages {root_wet:.2f}; subsurface moisture deficit favors stubble mulch or supplemental irrigation during sowing windows."
        )
    if solar_mj is not None and solar_mj >= 15.0 and max_temp_c is not None and max_temp_c >= 33.0:
        risks.append(
            f"High mean solar irradiance ({solar_mj:.1f} MJ/m^2/day) alongside {max_temp_c:.1f} C peak temperature increases mid-summer evapotranspiration stress."
        )
    if max_temp_c is not None and max_temp_c >= 36.0:
        risks.append(
            f"Observed peak heat reached {max_temp_c:.1f} C; high-summer flowering stages face heat-stress risk."
        )
    if frost_days is not None and frost_days >= 70.0:
        risks.append(
            f"Observed {int(round(frost_days))} frost days (<0 C); spring planting schedules require frost-free timing."
        )
    if request.scenario.kind == "rainfall_stress" and min_margin < 40.0 and not failed_rules:
        risks.append(
            f"Tight drought buffer (+{min_margin:.0f} mm above crop minimum under {request.scenario.rainfall_multiplier:.1f}x stress)."
        )

    return indicators, benefits, risks
