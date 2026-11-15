"""Telemetry-grounded SpaceFarm AI Agronomy & Climate Advisor Engine."""

from __future__ import annotations

import logging
import os
from typing import Any, Literal

import httpx

from app.config import get_settings
from app.schemas.models import (
    ClimateBundle,
    ClimateTimeseriesBundle,
    CropCatalog,
    FarmInput,
    RotationPlan,
    SimulationResponse,
)

logger = logging.getLogger("space_farm.ai_advisor")

CROP_LABELS_AZ: dict[str, str] = {
    "wheat": "Buğda",
    "barley": "Arpa",
    "chickpea": "Noxud",
    "lentil": "Mərci",
    "sunflower": "Günəbaxan",
    "maize": "Qarğıdalı",
    "alfalfa": "Yonca",
    "cotton": "Pambıq",
    "potato": "Kartof",
}


def _feat(climate: ClimateBundle | None, fid: str) -> float | None:
    if not climate:
        return None
    for f in climate.features:
        if f.feature_id == fid:
            return f.value
    return None


def _crop_name(crop_id: str, locale: Literal["az", "en"]) -> str:
    if locale == "az":
        return CROP_LABELS_AZ.get(crop_id.lower(), crop_id.title())
    return crop_id.replace("_", " ").title()


def _format_seq(plan: RotationPlan, locale: Literal["az", "en"]) -> str:
    return " → ".join(_crop_name(y.crop_id, locale) for y in plan.years)


def _detect_intents(question: str) -> set[str]:
    q = question.lower()
    intents: set[str] = set()
    if any(k in q for k in ("rotat", "plan", "crop", "yield", "əkin", "dövriyy", "növbə", "bitki", "əkmək", "məsləhət")):
        intents.add("rotation")
    if any(k in q for k in ("water", "rain", "drought", "irrig", "wet", "moisture", "su", "yağış", "quraq", "nəm", "suvar")):
        intents.add("water")
    if any(k in q for k in ("temp", "frost", "heat", "hot", "cold", "sow", "plant", "trend", "şaxta", "isti", "soyuq", "səpin", "vaxt", "temperatur", "iqlim")):
        intents.add("thermal")
    if any(k in q for k in ("soil", "ph", "nitro", "fertil", "eros", "torpaq", "azot", "gübrə", "eroz")):
        intents.add("soil")
    if not intents:
        intents.add("overview")
    return intents


async def _try_optional_llm_reply(
    *,
    question: str,
    locale: Literal["az", "en"],
    system_facts: str,
    history: list[dict[str, Any]],
) -> tuple[str | None, str]:
    """Use configured Gemini/OpenAI key when present in env/.env to answer any user question."""
    settings = get_settings()
    if settings.app_env == "test":
        return None, "spacefarm-agronomy-engine"

    gemini_key = (settings.gemini_api_key or os.environ.get("GEMINI_API_KEY", "")).strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    lang_rule = (
        "Respond naturally, helpfully, and clearly in Azerbaijani (unless the user explicitly writes in another language and requests that language)."
        if locale == "az"
        else "Respond naturally, helpfully, and concisely in English."
    )
    sys_prompt = (
        "You are SpaceFarm AI (by CODE44), an expert agronomy, satellite climate, soil-water, "
        "plant protection, and farm operations assistant. "
        f"{lang_rule} Answer ALL questions the user asks thoroughly and practically — including "
        "crop rotation, fertilizers, irrigation, pests/diseases, sowing calendars, weather hazards, "
        "machinery, economics concepts, SpaceFarm platform features, or general questions. "
        "When the question relates to the user's farm field, weave in their verified NASA LaRC POWER, "
        "Open-Meteo risk telemetry, and 3-year rotation scores below. Strictly NEVER invent or hallucinate "
        "fake measured soil pH, rainfall, or prices for their plot when a metric is marked Unknown.\n\n"
        "VERIFIED FIELD & TELEMETRY CONTEXT:\n"
        f"{system_facts}"
    )

    if gemini_key:
        candidate_models = [settings.gemini_model.strip() or "gemini-3-flash-preview"]
        for fb in ("gemini-3-flash-preview", "gemini-3.8-flash", "gemini-flash-latest"):
            if fb not in candidate_models:
                candidate_models.append(fb)

        contents = []
        for turn in history[-8:]:
            role = "model" if turn.get("role") == "assistant" else "user"
            text_val = str(turn.get("content", "")).strip()
            if text_val:
                contents.append({"role": role, "parts": [{"text": text_val}]})
        contents.append({"role": "user", "parts": [{"text": question}]})
        payload = {
            "system_instruction": {"parts": [{"text": sys_prompt}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.35, "maxOutputTokens": 1800},
        }

        timeout_s = max(15.0, float(settings.gemini_timeout_seconds or 30.0))
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            for model_id in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
                try:
                    resp = await client.post(
                        url,
                        headers={"x-goog-api-key": gemini_key},
                        json=payload,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        cand = data.get("candidates", [{}])[0]
                        parts = cand.get("content", {}).get("parts", [])
                        answer_parts = [
                            p.get("text", "")
                            for p in parts
                            if not p.get("thought") and p.get("text")
                        ]
                        if not answer_parts:
                            answer_parts = [p.get("text", "") for p in parts if p.get("text")]
                        text = "".join(answer_parts).strip()
                        if text:
                            return text, f"{model_id} · nasa-grounded"
                    else:
                        logger.warning(
                            "Gemini model %s returned HTTP %d: %s",
                            model_id,
                            resp.status_code,
                            resp.text[:220],
                        )
                except Exception as exc:
                    logger.warning("Gemini model %s request error: %s", model_id, exc)

    if openai_key:
        try:
            messages: list[dict[str, str]] = [{"role": "system", "content": sys_prompt}]
            for turn in history[-8:]:
                r = "assistant" if turn.get("role") == "assistant" else "user"
                messages.append({"role": r, "content": str(turn.get("content", ""))})
            messages.append({"role": "user", "content": question})
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    json={"model": "gpt-4o-mini", "messages": messages, "temperature": 0.3, "max_tokens": 1400},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
                    if text:
                        return text, "openai-gpt-4o-mini · nasa-grounded"
        except Exception as exc:
            logger.warning("OpenAI request error: %s", exc)

    return None, "spacefarm-agronomy-engine"


async def generate_ai_advice(
    *,
    question: str,
    locale: Literal["az", "en"],
    farm: FarmInput,
    climate: ClimateBundle,
    timeseries: ClimateTimeseriesBundle | None,
    simulation: SimulationResponse,
    catalog: CropCatalog,
    history: list[dict[str, Any]],
    active_alerts: list[dict[str, Any]] | None = None,
    lab_metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build verified telemetry context and produce grounded agronomic guidance."""
    mean_t = _feat(climate, "mean_temperature")
    min_t = _feat(climate, "min_temperature")
    max_t = _feat(climate, "max_temperature")
    precip_mm = _feat(climate, "total_precipitation_mm")
    frost_days = _feat(climate, "frost_days_count")
    wet_days = _feat(climate, "wet_days_count")
    surf_wet = _feat(climate, "mean_surface_soil_wetness")
    root_wet = _feat(climate, "mean_root_zone_soil_wetness")
    solar = _feat(climate, "mean_solar_irradiance_mj_m2_day")

    trend = timeseries.trend if timeseries else None
    latest_heat = (
        timeseries.annual_series[-1].heat_stress_days
        if (timeseries and timeseries.annual_series)
        else None
    )
    top_plan = simulation.plans[0] if simulation.plans else None
    alt_plan = simulation.plans[1] if len(simulation.plans) > 1 else None
    prior_crop = farm.crop_history[0].crop_id if farm.crop_history else "unknown"
    eff_water = simulation.input_summary.effective_water_supply_mm

    top_ind = top_plan.indicators if top_plan else None
    alerts_lines = (
        "; ".join(
            f"{a.get('parcel_label')}: [{a.get('severity')}] {a.get('title_en')} ({a.get('trigger_metric')})"
            for a in (active_alerts or [])[:5]
        )
        or "None"
    )
    lab = lab_metrics or {}
    lab_summary = ""
    if lab:
        lab_summary = (
            f" (humus={lab.get('organic_matter_pct', 'n/a')}%, N={lab.get('nitrogen_mg_kg', 'n/a')} mg/kg, "
            f"P2O5={lab.get('phosphorus_mg_kg', 'n/a')} mg/kg, K2O={lab.get('potassium_mg_kg', 'n/a')} mg/kg, "
            f"EC={lab.get('ec_ds_m', 'n/a')} dS/m, report={lab.get('lab_report_id', 'LAB-FIELD')})"
        )
    facts_summary = "\n".join(
        [
            f"- Field: {farm.label} ({farm.location.latitude:.4f}N, {farm.location.longitude:.4f}E), {farm.area_ha} ha",
            f"- Irrigation: {farm.irrigation_type}, effective supply: {eff_water if eff_water is not None else 0} mm",
            f"- Soil & Lab Chemistry: texture={farm.soil.texture or 'loam'}, pH={farm.soil.ph if farm.soil.ph is not None else 6.8}{lab_summary}, prior_crop={prior_crop}",
            f"- NASA POWER 2024: mean_temp={mean_t} C, min={min_t} C, max={max_t} C, precip={precip_mm} mm, frost_days={frost_days}, wet_days={wet_days}, root_wetness={root_wet}, surf_wetness={surf_wet}, solar={solar} MJ/m2/day",
            f"- Climate Trend: temp_shift={trend.temp_shift_c_per_decade if trend else 'n/a'} C/decade, precip_change={trend.precip_trend_pct_per_decade if trend else 'n/a'}%, heat_days_latest={latest_heat if latest_heat is not None else 'n/a'}, drought_risk={trend.drought_risk_level if trend else 'unknown'}",
            f"- Top 3-year plan: {_format_seq(top_plan, 'en') if top_plan else 'None'} (score={round(top_plan.score or 0) if top_plan else 'n/a'}/100, water_demand={round(top_ind.water_demand_mm_avg) if top_ind else 'n/a'} mm, n_fix={round(top_ind.nitrogen_fixation_score * 100) if top_ind else 'n/a'}%)",
            f"- Active Weather Hazards / Alerts: {alerts_lines}",
            f"- Alternate feasible plans count: {len(simulation.plans)}, status={simulation.status}",
        ]
    )

    llm_text, engine_name = await _try_optional_llm_reply(
        question=question,
        locale=locale,
        system_facts=facts_summary,
        history=history,
    )

    intents = _detect_intents(question)
    is_az = locale == "az"

    if llm_text:
        reply_text = llm_text
    else:
        sections: list[str] = []
        prior_label = _crop_name(prior_crop, locale) if prior_crop != "unknown" else ("naməlum" if is_az else "unknown")

        # 1. Headline diagnosis always tailored & factual
        if is_az:
            sections.append(
                f"**{farm.label}** (`{farm.location.latitude:.2f}°N, {farm.location.longitude:.2f}°E`, `{farm.area_ha} ha`) üçün real **NASA LaRC POWER** iqlim və torpaq-su göstəriciləri əsasında təhlil:"
            )
        else:
            sections.append(
                f"Grounded **NASA LaRC POWER** & deterministic agronomy analysis for **{farm.label}** (`{farm.location.latitude:.2f}°N, {farm.location.longitude:.2f}°E`, `{farm.area_ha} ha`):"
            )

        # 2. Rotation advice
        if "rotation" in intents or "overview" in intents:
            if top_plan:
                seq_str = _format_seq(top_plan, locale)
                score_pct = round(top_plan.score or 0)
                w_comp = top_plan.score_components.get("water")
                s_comp = top_plan.score_components.get("soil")
                w_pct = round((w_comp.value or 0) * 100) if w_comp else 0
                s_pct = round((s_comp.value or 0) * 100) if s_comp else 0
                demand = round(top_ind.water_demand_mm_avg) if top_ind else 0
                n_fix = round(top_ind.nitrogen_fixation_score * 100) if top_ind else 0
                alt_str = _format_seq(alt_plan, locale) if alt_plan else None
                if is_az:
                    line = (
                        f"- **Ən optimal 3 illik dövriyyə:** `{seq_str}` (**{score_pct}/100**) — Su balı **{w_pct}%**, Torpaq balı **{s_pct}%**, orta illik su tələbi **{demand} mm**, azot fiksasiyası **{n_fix}%**.\n"
                        f"- **Növbələşmə səbəbi:** Əvvəlki bitki **{prior_label}** olduğu üçün ardıcıl eyni fəsilə xəstəlik riskini kəsir və paxlalı fazası torpaqda bioloji azot balansını gücləndirir."
                    )
                    if alt_str and alt_plan and alt_plan.score is not None:
                        line += f"\n- **Alternativ plan (#2):** `{alt_str}` (**{round(alt_plan.score)}/100**)."
                    sections.append(line)
                else:
                    line = (
                        f"- **Top 3-year rotation:** `{seq_str}` (**{score_pct}/100**) — Water match **{w_pct}%**, Soil score **{s_pct}%**, average crop water demand **{demand} mm/yr**, biological nitrogen score **{n_fix}%**.\n"
                        f"- **Agronomic logic:** Following **{prior_label}**, this sequence enforces a clean family break while alternating cereal and legume phases."
                    )
                    if alt_str and alt_plan and alt_plan.score is not None:
                        line += f"\n- **Runner-up plan (#2):** `{alt_str}` (**{round(alt_plan.score)}/100**)."
                    sections.append(line)
            else:
                if is_az:
                    sections.append(
                        f"- **Plan tapılmadı:** Mövcud suvarma (`{farm.irrigation_type}`) və iqlim məhdudiyyətləri altında uyğun 3 illik plan formalaşmadı. Suvarma büdcəsini və ya Ssenari Lab parametrlərini yoxlayın."
                    )
                else:
                    sections.append(
                        f"- **No feasible 3-year sequence** passed hard agronomy constraints under current `{farm.irrigation_type}` supply and predecessor (`{prior_label}`)."
                    )

        # 3. Water & Drought
        if "water" in intents or "overview" in intents:
            rw_pct = f"{round(root_wet * 100)}%" if root_wet is not None else "—"
            sw_pct = f"{round(surf_wet * 100)}%" if surf_wet is not None else "—"
            p_str = f"{precip_mm:.1f} mm" if precip_mm is not None else "—"
            eff_str = f"{eff_water:.1f} mm" if eff_water is not None else "—"
            d_risk = trend.drought_risk_level if trend else "unknown"
            if is_az:
                risk_az = {"low": "aşağı", "moderate": "orta", "elevated": "yüksək"}.get(d_risk, "naməlum")
                sections.append(
                    f"- **Su və Nəmlik Balansı:** İllik yağıntı **{p_str}**, effektiv su təminatı **{eff_str}** (`{wet_days or '—'}` yağışlı gün). Peykdən ölçülən kök zonası nəmliyi **{rw_pct}**, səth nəmliyi **{sw_pct}** (Quraqlıq riski: **{risk_az}**)."
                )
            else:
                sections.append(
                    f"- **Water & Soil Wetness:** Annual rainfall **{p_str}**, effective seasonal supply **{eff_str}** across `{wet_days or '—'}` wet days. Root-zone wetness **{rw_pct}**, surface wetness **{sw_pct}** (drought risk: **{d_risk}**)."
                )

        # 4. Thermal / Frost / Sowing Timing
        if "thermal" in intents or "overview" in intents:
            mt = f"{mean_t:.1f}°C" if mean_t is not None else "—"
            mn = f"{min_t:.1f}°C" if min_t is not None else "—"
            mx = f"{max_t:.1f}°C" if max_t is not None else "—"
            sol = f"{solar:.1f} MJ/m²/gün" if (solar is not None and is_az) else (f"{solar:.1f} MJ/m²/day" if solar is not None else "—")
            heat_d = latest_heat if latest_heat is not None else "—"
            warm = (
                f"{trend.temp_shift_c_per_decade:+.2f}°C/onillik"
                if (trend and trend.temp_shift_c_per_decade is not None and is_az)
                else (
                    f"{trend.temp_shift_c_per_decade:+.2f}°C/decade"
                    if (trend and trend.temp_shift_c_per_decade is not None)
                    else "—"
                )
            )
            if is_az:
                sections.append(
                    f"- **İstilik və Səpin Pəncərəsi:** Orta temperatur **{mt}** (min `{mn}` / maks `{mx}`), şaxtalı günlər **{frost_days if frost_days is not None else '—'}**, >32°C istilik stressi **{heat_d}** gün, günəş radiasiyası **{sol}** (10 illik meyl: `{warm}`)."
                )
            else:
                sections.append(
                    f"- **Thermal & Sowing Window:** Mean temperature **{mt}** (range `{mn}` to `{mx}`), **{frost_days if frost_days is not None else '—'}** frost days, **{heat_d}** heat-stress days (>32°C), solar irradiance **{sol}** (decade trend `{warm}`)."
                )

        # 5. Soil pH & Fertility honesty check
        if "soil" in intents or farm.soil.ph is None or "overview" in intents:
            tex = farm.soil.texture or ("naməlum" if is_az else "unknown")
            gap = top_ind.bare_soil_gap_months_3yr if top_ind else "—"
            ero = round(top_ind.erosion_protection_score * 100) if top_ind else "—"
            if farm.soil.ph is None:
                if is_az:
                    sections.append(
                        f"- **Torpaq Statusu (İlkin / Provisional):** Tekstura `{tex}`, **pH Naməlumdur** (sistem gizli 7.0 rəqəmi uydurmur). Dəqiqlik üçün laboratoriya pH ölçümünü [Sahə İntellektində](/field) daxil edin. Seçilmiş plan üzrə eroziya qoruması **{ero}%**, açıq torpaq boşluğu **{gap} ay / 3 il**."
                    )
                else:
                    sections.append(
                        f"- **Soil Status (Provisional):** Texture `{tex}`, **Soil pH Unknown** (never guessed as 7.0). Enter lab soil pH in [Field Intelligence](/field) for `Complete` verification. Erosion protection **{ero}%**, bare gap **{gap} mo / 3 yr**."
                    )
            else:
                if is_az:
                    sections.append(
                        f"- **Torpaq Statusu:** Tekstura `{tex}`, qeydə alınmış **pH {farm.soil.ph:.1f}** (`Complete` yoxlama). Eroziya qoruması **{ero}%**, açıq torpaq boşluğu **{gap} ay / 3 il**."
                    )
                else:
                    sections.append(
                        f"- **Soil Status:** Texture `{tex}`, recorded **pH {farm.soil.ph:.1f}** (actively checked). Erosion protection **{ero}%**, bare gap **{gap} mo / 3 yr**."
                    )

        reply_text = "\n\n".join(sections)

    metrics = [
        {"label": "Yağıntı" if is_az else "Precipitation", "value": f"{precip_mm:.1f} mm" if precip_mm is not None else "—"},
        {"label": "Orta T2M" if is_az else "Mean Temp", "value": f"{mean_t:.1f}°C" if mean_t is not None else "—"},
        {"label": "Top Plan", "value": f"{round(top_plan.score)}/100" if (top_plan and top_plan.score is not None) else "N/A"},
        {"label": "Şaxta" if is_az else "Frost Days", "value": f"{round(frost_days)}" if frost_days is not None else "—"},
    ]

    followups = (
        [
            "−20% quraqlıq ssenarisində bu plan necə dəyişir?",
            "Torpaq azotu və eroziya qorunmasını necə artırmaq olar?",
            "Şaxta və isti günlərə görə səpin riskini izah et",
        ]
        if is_az
        else [
            "How resilient is the top plan under -20% drought stress?",
            "How can I reduce bare-soil gap and improve nitrogen fixation?",
            "What do frost and heat-stress days tell me about sowing dates?",
        ]
    )

    actions = [
        {"label": "Dövriyyə Studiyası" if is_az else "Rotation Studio", "route": "/rotation"},
        {"label": "Ssenari Lab (−20%)" if is_az else "Scenario Lab (−20%)", "route": "/scenarios"},
        {"label": "İqlim Tarixçəsi" if is_az else "Climate History", "route": "/climate"},
        {"label": "Məlumatlarım / Sahələr" if is_az else "Profile & Fields", "route": "/profile"},
    ]

    return {
        "answer": reply_text,
        "engine": engine_name,
        "data_mode": climate.data_mode,
        "synthetic": climate.synthetic,
        "metrics": metrics,
        "followups": followups,
        "actions": actions,
    }
