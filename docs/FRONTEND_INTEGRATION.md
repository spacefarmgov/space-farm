# Frontend Integration Guide — Space Farm (Role A Handover)

**Contract version:** `0.1.0` (`FROZEN`)  
**OpenAPI:** `contracts/openapi.json`  
**Synthetic fixtures:** `contracts/fixtures/*.json`  
**Typed TypeScript client:** `apps/web/src/api/types.ts` & `apps/web/src/api/client.ts`

---

## 1. Local Development Setup
1. Start backend (`http://127.0.0.1:8000`):
   ```bash
   ./scripts/run_api.ps1
   # or: uvicorn app.main:app --app-dir services/api --host 127.0.0.1 --port 8000 --reload
   ```
2. Start frontend (`http://127.0.0.1:5173`, `/api` is automatically proxied to `:8000` via `apps/web/vite.config.ts`):
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

---

## 2. Available API Endpoints

| Endpoint | Client helper | Purpose |
|---|---|---|
| `GET /api/v1/health` | `getHealth(signal)` | Backend health, contract/model/rules/catalog versions, default `data_mode` |
| `GET /api/v1/crops` | `getCrops(signal)` | Candidate 6 crops (`wheat`, `barley`, `chickpea`, `lentil`, `sunflower`, `maize`), water/pH bands, FAO references, `validation_status` |
| `GET /api/v1/climate/features` | `getClimateFeatures(params, signal)` | NASA POWER period aggregates (`mean_temperature`, `total_precipitation_mm`, etc.) + `SourceRecord` provenance & `coverage_ratio` |
| `POST /api/v1/simulations` | `runSimulation(payload, signal)` | Evaluates 3-year rotations, returns `0..3` plans, `score_components`, `weights_effective`, `constraints_checked`, `rejected_summary`, `warnings`, `limitations` |

---

## 3. Required UI State Mapping (`T17`–`T21`)
- **Race-condition guard (`T18`):** Always pass an `AbortController().signal` to `runSimulation()` and abort the previous request when priorities or stress multipliers change.
- **`status` badges:**
  - `completed`: Render `plans` (`1..3` cards) and show `limitations` note (`source_supported`/awaiting local calibration).
  - `provisional`: Render `plans` with explicit **Provisional / High Uncertainty** warning (e.g., `soil.ph === null` or `irrigation_type === "unknown"` — never show default `pH 7.0`).
  - `no_feasible_plan`: Render `0` plan cards (never fabricate plans!) + display `rejected_summary` reasons + action to edit inputs/irrigation/stress.
  - `needs_data`: Render explanation (e.g., only unavailable `income` weighted, or climate coverage `<95%`).
- **`data_mode` badges (`T21`):**
  - `live`: Live NASA POWER observation (show `sources[0].retrieved_at`, `payload_sha256`, `source_url`).
  - `cached`: Exact-matching verified offline snapshot (preserve original `retrieved_at`).
  - `demo_fixture`: Only when explicitly viewing synthetic fixtures (`synthetic: true` — label clearly **Demo data**).
- **Unavailable `income` (`T14`):** Display `score_components.income.value === null` as **Unavailable in MVP** (never show `0 AZN` or fake `%`) and render `weights_effective` alongside `weights_requested`.
- **Errors (`T19`):** Catch `SpaceFarmApiError` and display `err.envelope.error.message` + `details` + retry button (when `retryable === true`).

---

## 4. Sample `POST /api/v1/simulations` Request (Ganja Demo)
```json
{
  "contract_version": "0.1.0",
  "farm": {
    "farm_id": "ganja-demo",
    "label": "Ganja demo field",
    "is_demo": true,
    "location": { "latitude": 40.68, "longitude": 46.36, "crs": "EPSG:4326" },
    "area_ha": 10,
    "irrigation_type": "rainfed",
    "irrigation_budget_mm_per_season": null,
    "soil": {
      "ph": null,
      "texture": "unknown",
      "source_type": "unknown",
      "sample_date": null,
      "depth_cm": null,
      "source_ref": null
    },
    "crop_history": []
  },
  "climate_period": { "start_date": "2024-01-01", "end_date": "2024-12-31" },
  "horizon_years": 3,
  "preferences": { "water": 0.5, "soil": 0.3, "income": 0.2 },
  "scenario": { "kind": "baseline", "rainfall_multiplier": 1.0 },
  "max_plans": 3
}
```
- Change `scenario` to `{"kind": "rainfall_stress", "rainfall_multiplier": 0.9}` (feasible shift) or `0.7` (`no_feasible_plan` under pure rainfed).

---

## 5. Verified 2024 Azerbaijan Regional Snapshots (`cached` & `live` Ready)

All four 2024 (`2024-01-01` .. `2024-12-31`, `366/366` days, `AG`, `UTC`) coordinates below have committed, SHA-256-audited NASA POWER snapshots in `data/raw/` & `data/processed/`, so Role A can test and switch across them seamlessly in both `cached` and `live` modes (never falling back across mismatched coordinates):

| Region | Coordinates (`lat, lon`) | `query_hash` | 2024 Precip (`PRECTOTCORR`) | 2024 Mean `T2M` | `cached` & `live` Status |
|---|---|---|---|---|---|
| **Ganja (Pilot Demo)** | `40.68, 46.36` | `552e40e213b9f7b8` | `506.52 mm` | `10.58 °C` | Ready (`cached` + `live`) |
| **Aran / Barda-Yevlakh** | `40.38, 47.12` | `a56184dd09acd946` | `457.50 mm` | `15.70 °C` | Ready (`cached` + `live`) |
| **Quba-Khachmaz** | `41.36, 48.51` | `f850af6ab056dbf6` | `516.20 mm` | `15.04 °C` | Ready (`cached` + `live`) |
| **Sheki-Zaqatala** | `41.19, 47.17` | `3f72f4396abc697d` | `588.52 mm` | `15.65 °C` | Ready (`cached` + `live`) |
