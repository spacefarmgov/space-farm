# Frontend Status Journal (`docs/status/frontend.md`)

**Owner:** Role A (Frontend / UI)  
**Branch:** `feat/frontend-ui`  
**Contract Version Targeted:** `v0.1.0` (frozen, unmodified)  

---

## Current Milestone Summary

Upgraded the SpaceFarm frontend in `apps/web/` into a full **7-route black–electric-violet cosmic web application** matching the SpaceFarm Master Design Prompt and approved visual reference:

- **Dependencies & Routing**: Added `react-router-dom@^6.28.0` with lazy route code splitting across `/`, `/explore`, `/field`, `/climate`, `/rotation`, `/scenarios`, and `/sources`.
- **Visual System & Bilingual Copy**: Implemented Obsidian Black (`#05050B`) and Electric Violet (`#8B5CF6` / `#C4B5FD`) tokens (`tokens.css`, `app.css`), `Space Grotesk` + `Inter` + `JetBrains Mono` typography, and complete `EN | AZ` switcher (`locales/translations.ts`) supporting full Azerbaijani glyphs (`Ə, ı, İ, ş, ç, ğ, ö, ü`).
- **4 Verified 2024 Azerbaijan Snapshots**: Integrated `Ganja demo` (`40.68, 46.36`), `Aran / Barda-Yevlakh` (`40.38, 47.12`), `Quba-Khachmaz` (`41.36, 48.51`), and `Sheki-Zaqatala` (`41.19, 47.17`) alongside MERRA-2 `0.5° × 0.625°` bounding box calculation and honest explicit Preview Mode (`demo_fixture`) without silent fallback on API failure.
- **Role Scope Respected**: Zero changes to `services/api/`, `contracts/`, `data/`, `PROJECT_STATE.md`, `ROADMAP.md`, or frozen `apps/web/src/api/types.ts` & `client.ts`.

---

## Backend / Data Change Requests (`CR-A-###`)

These capabilities were explicitly excluded from frontend fabrication per honesty rules and are logged as formal Change Requests for Role B (Backend) & Role C (Data):

1. **`CR-A-001` — Daily / Monthly Climate Time-Series Endpoint (`GET /api/v1/climate/series`)**:
   - **Need**: `/climate` currently receives 6 annual aggregate features (`mean/min/max_temperature`, `total_precipitation_mm`, `frost_days_count`, `wet_days_count`). Daily or monthly aggregated arrays with missing-day gap markers would replace the opt-in illustrative curve toggle with real NASA POWER temporal series.
2. **`CR-A-002` — Multi-Year Historical Snapshot Range (`2010–2024`)**:
   - **Need**: Current snapshot store provides 2024 (`366` days). Multi-year cached history or date-window selector support would unlock multi-year comparison on `/climate` and `/explore`.
3. **`CR-A-003` — Spatial Climate Grid Overlay / Tile Endpoint**:
   - **Need**: `/explore` `Climate` layer currently displays an honest *"No spatial raster layer available"* notice instead of faking a heatmap. A raster tile or gridded summary endpoint from B/C would enable genuine spatial climate visualization.
4. **`CR-A-004` — GeoJSON Parcel Boundary Persistence (`farm.boundary`)**:
   - **Need**: Contract `v0.1.0` supports point `EPSG:4326` coordinates and scalar `area_ha`. Adding optional GeoJSON polygon geometry would enable a real `"Edit boundary"` vertex tool on `/field`.
5. **`CR-A-005` — Server-Side SPA Rewrite & Static Hosting Config + Export Report Endpoint**:
   - **Need (Deploy / Backend)**: Production hosting must serve `index.html` fallback for deep links (`/explore`, `/field`, `/climate`, `/rotation`, `/scenarios`, `/sources`) on direct page refresh, and an optional verified PDF report generator endpoint if report export beyond `Download result JSON` is desired.

---

## Handoff Note for Role B Consolidation

- Production assets added strictly under `apps/web/public/assets/`: `hero-earth-orbit.jpg` and `scenario-panorama.jpg`.
- Verification results (run after final source edits):
  - `npm run build` (`tsc -b && vite build` in `apps/web`): **PASS** (`0` TypeScript/Vite errors; built in `7.47s`; code-split `index` chunk `84.12 kB` gzipped).
  - End-to-end Playwright Chromium verification (`qa_verify_7pages.py` against live FastAPI `uvicorn` + Vite `5173`): **PASS** (`0` console errors, `0` page errors, `0` HTTP 5xx).
  - Verified all 7 routes (`/`, `/explore`, `/field`, `/climate`, `/rotation`, `/scenarios`, `/sources`), browser back/forward/refresh, `EN | AZ` switcher (`Ə, ı, İ, ş, ç, ğ, ö, ü`), `prefers-reduced-motion: reduce`, mobile drawer Escape/close behavior, and zero horizontal overflow (`scrollWidth === innerWidth`) across `1440×900`, `1024×768`, `768×1024`, and `360×800`.
  - Captured desktop (`1440×900`), mobile (`360×800`), AZ locale screenshots, and combined 7-screen showcase board in `docs/design/screenshots/`.
- Ready for review on `feat/frontend-ui` (no push or public deploy executed).
