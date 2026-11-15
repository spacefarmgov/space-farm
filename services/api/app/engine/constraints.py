"""Hard agronomic constraint evaluation (filters invalid sequences before scoring)."""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.models import (
    ConstraintCheckResult,
    CropInfo,
    RejectedSummaryItem,
    SimulationRequest,
)


@dataclass(frozen=True)
class SequenceConstraintEvaluation:
    feasible: bool
    checks: list[ConstraintCheckResult]
    failed_rules: list[tuple[str, str]]
    has_unknown: bool


def _last_historical_crop(request: SimulationRequest, crop_map: dict[str, CropInfo]) -> CropInfo | None:
    if not request.farm.crop_history:
        return None
    latest = max(request.farm.crop_history, key=lambda entry: entry.year)
    return crop_map.get(latest.crop_id)


def compute_effective_water_supply(
    request: SimulationRequest,
    raw_precipitation_mm: float,
) -> tuple[float, bool, str]:
    """Compute effective seasonal water supply (mm) without mutating raw NASA precipitation."""
    effective_precip = raw_precipitation_mm * request.scenario.rainfall_multiplier
    irr_type = request.farm.irrigation_type
    budget = request.farm.irrigation_budget_mm_per_season

    if irr_type == "rainfed":
        return round(effective_precip, 2), False, "rainfed_precipitation_only"
    if irr_type == "irrigated":
        if budget is None:
            return round(effective_precip, 2), True, "irrigated_without_specified_budget_mm"
        return round(effective_precip + budget, 2), False, "precipitation_plus_irrigation_budget"
    # irrigation_type == "unknown"
    return round(effective_precip, 2), True, "irrigation_type_unknown_rainfed_floor_used"


def evaluate_sequence_constraints(
    sequence: tuple[CropInfo, CropInfo, CropInfo],
    *,
    request: SimulationRequest,
    effective_water_mm: float,
    irrigation_unknown: bool,
    irrigation_note: str,
    crop_map: dict[str, CropInfo],
) -> SequenceConstraintEvaluation:
    """Evaluate all hard constraints for a candidate 3-year sequence."""
    checks: list[ConstraintCheckResult] = []
    failed_rules: list[tuple[str, str]] = []
    has_unknown = False

    prev_hist = _last_historical_crop(request, crop_map)

    # 1. RULE_NO_CONSECUTIVE_SAME_CROP
    same_crop_violation: str | None = None
    if prev_hist is not None and prev_hist.crop_id == sequence[0].crop_id:
        same_crop_violation = (
            f"Year 1 ({sequence[0].crop_id}) repeats prior recorded crop ({prev_hist.crop_id})."
        )
    elif sequence[0].crop_id == sequence[1].crop_id:
        same_crop_violation = f"Year 1 and Year 2 repeat {sequence[0].crop_id} consecutively."
    elif sequence[1].crop_id == sequence[2].crop_id:
        same_crop_violation = f"Year 2 and Year 3 repeat {sequence[1].crop_id} consecutively."

    if same_crop_violation:
        failed_rules.append(("RULE_NO_CONSECUTIVE_SAME_CROP", same_crop_violation))
    else:
        checks.append(
            ConstraintCheckResult(
                rule_id="RULE_NO_CONSECUTIVE_SAME_CROP",
                result="pass",
                reason="No consecutive identical crop across prior history and years 1-3.",
            )
        )

    # 2. RULE_NO_CONSECUTIVE_SENSITIVE_FAMILY (Fabaceae / Asteraceae) & disallowed_predecessor_crops
    family_or_predecessor_violation: str | None = None
    pairs: list[tuple[str, CropInfo, CropInfo]] = []
    if prev_hist is not None:
        pairs.append(("prior->Y1", prev_hist, sequence[0]))
    pairs.append(("Y1->Y2", sequence[0], sequence[1]))
    pairs.append(("Y2->Y3", sequence[1], sequence[2]))

    for label, prev_c, curr_c in pairs:
        if prev_c.crop_id in curr_c.predecessor_rules.disallowed_predecessor_crops:
            family_or_predecessor_violation = (
                f"{label}: {curr_c.crop_id} disallows predecessor {prev_c.crop_id} per catalog predecessor_rules."
            )
            break
        if (
            prev_c.family == curr_c.family
            and (
                curr_c.predecessor_rules.avoid_consecutive_same_family
                or prev_c.predecessor_rules.avoid_consecutive_same_family
            )
        ):
            family_or_predecessor_violation = (
                f"{label}: consecutive {curr_c.family} crops ({prev_c.crop_id} -> {curr_c.crop_id}) "
                "violate sensitive-family break constraint."
            )
            break

    if family_or_predecessor_violation:
        failed_rules.append(("RULE_NO_CONSECUTIVE_SENSITIVE_FAMILY", family_or_predecessor_violation))
    else:
        checks.append(
            ConstraintCheckResult(
                rule_id="RULE_NO_CONSECUTIVE_SENSITIVE_FAMILY",
                result="pass",
                reason="Sensitive families (Fabaceae/Asteraceae) have at least a 1-year break.",
            )
        )

    # 3. RULE_WATER_SUPPLY_MATCH
    water_failures: list[str] = []
    for idx, crop in enumerate(sequence, start=1):
        band = crop.water_band_mm
        if band is None:
            continue
        if effective_water_mm < band.min_mm:
            water_failures.append(
                f"Year {idx} {crop.crop_id} requires >={band.min_mm:.0f} mm (available {effective_water_mm:.1f} mm)"
            )
        elif effective_water_mm > band.max_mm * 1.4:
            water_failures.append(
                f"Year {idx} {crop.crop_id} excess moisture guard <={band.max_mm * 1.4:.0f} mm (available {effective_water_mm:.1f} mm)"
            )

    if water_failures:
        failed_rules.append(("RULE_WATER_SUPPLY_MATCH", "; ".join(water_failures)))
    elif irrigation_unknown:
        has_unknown = True
        checks.append(
            ConstraintCheckResult(
                rule_id="RULE_WATER_SUPPLY_MATCH",
                result="unknown",
                reason=(
                    f"Meets crop minimum water bounds using rainfall floor ({effective_water_mm:.1f} mm), "
                    f"but irrigation volume is unverified ({irrigation_note})."
                ),
            )
        )
    else:
        checks.append(
            ConstraintCheckResult(
                rule_id="RULE_WATER_SUPPLY_MATCH",
                result="pass",
                reason=f"Effective seasonal water supply ({effective_water_mm:.1f} mm) satisfies all 3 crop water bands.",
            )
        )

    # 4. RULE_SOIL_PH_RANGE (unknown pH stays unknown, never defaulted to 7.0)
    ph = request.farm.soil.ph
    if ph is None:
        has_unknown = True
        checks.append(
            ConstraintCheckResult(
                rule_id="RULE_SOIL_PH_RANGE",
                result="unknown",
                reason="Soil pH is unknown; crop pH tolerance could not be verified (no default pH=7.0 assumed).",
            )
        )
    else:
        ph_failures: list[str] = []
        for idx, crop in enumerate(sequence, start=1):
            ph_range = crop.soil_ph_range
            if ph_range is None:
                continue
            if not (ph_range.min_ph <= ph <= ph_range.max_ph):
                ph_failures.append(
                    f"Year {idx} {crop.crop_id} tolerates pH {ph_range.min_ph}-{ph_range.max_ph} (soil pH={ph:.2f})"
                )
        if ph_failures:
            failed_rules.append(("RULE_SOIL_PH_RANGE", "; ".join(ph_failures)))
        else:
            checks.append(
                ConstraintCheckResult(
                    rule_id="RULE_SOIL_PH_RANGE",
                    result="pass",
                    reason=f"Measured/reported soil pH ({ph:.2f}) falls within all 3 crop pH bands.",
                )
            )

    return SequenceConstraintEvaluation(
        feasible=len(failed_rules) == 0,
        checks=checks,
        failed_rules=failed_rules,
        has_unknown=has_unknown,
    )


def summarize_rejections(rejection_records: list[tuple[str, str]]) -> list[RejectedSummaryItem]:
    """Aggregate hard constraint failure counts and deterministic sample reasons."""
    counts: dict[str, int] = {}
    sample_reason: dict[str, str] = {}
    for rule_id, reason in rejection_records:
        counts[rule_id] = counts.get(rule_id, 0) + 1
        if rule_id not in sample_reason:
            sample_reason[rule_id] = reason

    items = [
        RejectedSummaryItem(rule_id=rule_id, count=count, reason=sample_reason[rule_id])
        for rule_id, count in counts.items()
    ]
    items.sort(key=lambda item: (-item.count, item.rule_id))
    return items
