"""Deterministic multi-objective normalization, effective weight calculation, and scoring."""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.models import (
    CropInfo,
    EffectiveWeights,
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
