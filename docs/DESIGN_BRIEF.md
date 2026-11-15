# SpaceFarm Frontend Design Brief (`docs/DESIGN_BRIEF.md`)

**Owner:** Role A (Frontend/UI)  
**Brand & Team:** **SpaceFarm** · Team **CODE44** · *"From Space Data to Smarter Farms"*  
**Contract Target:** Frozen `v0.1.0` API & TypeScript Schemas (`contracts/`, `apps/web/src/api/types.ts`)  
**Aesthetic Direction:** **Black – Electric-Violet Cosmic Decision Interface** (7-route multi-page architecture)

---

## 1. Visual System & Design Tokens

Implemented in `apps/web/src/styles/tokens.css` and `apps/web/src/styles/app.css`:

- **Palette**:
  - Cosmic Obsidian Canvas: `#05050B` (`--bg-base`), `#090914` (`--bg-deep`)
  - Elevated Panels: `#10101C` (`--surface-1`), `#171727` (`--surface-2`), `#202035` (`--surface-3`), translucent map overlay `rgba(16, 16, 28, 0.9)` (`--surface-overlay`)
  - Borders & Accents: `#2B2B43` (`--border-default`), `#A78BFA` (`--border-active`), `#8B5CF6` (`--accent-primary`), `#C4B5FD` (`--accent-soft`), `#67E8F9` (`--accent-cyan`)
  - Semantic Statuses (strictly paired with icons/text): Error `#FDA4AF`, Warning `#FDE68A`, Success `#86EFAC`
- **Typography**: `Space Grotesk` (headings/display), `Inter` (UI & body, full Azerbaijani `Ə, ı, İ, ş, ç, ğ, ö, ü` support), and `JetBrains Mono` with `.tabular` (`tabular-nums`) for coordinates, climate metrics, weights, and SHA-256 hashes.
- **Navigation Shell (`AppShell.tsx`)**:
  - Home (`/`): 64px transparent topbar (`Overview / Explore / Plan / Sources`, `EN | AZ` switcher, `Explore your field` CTA).
  - Inner Pages: 64px utility topbar (`SpaceFarm by CODE44`, live field breadcrumb, `EN | AZ`, Methodology modal trigger, local status pill) paired with a 72px left vertical icon rail (`Home`, `Explore`, `Field`, `Climate`, `Rotation`, `Scenarios`, `Sources`) with hover/focus tooltips and mobile accessible slide-out drawer (`<= 767px`).

---

## 2. Seven Dedicated Routes & Workflow Continuity

All routes share centralized state (`SpaceFarmContext.tsx`) preserving field draft, coordinates, priorities, climate bundle, baseline/stress runs, selected plan, stale status (`Inputs changed — recalculate`), and `AbortController` + monotonic sequence race guards across navigation and browser back/forward:

1. `/` (`HomePage.tsx`): From Orbit to Earth hero illustration (`/assets/hero-earth-orbit.jpg`), immediate readable headline *"A new perspective on farming."*, `Explore your field` & `View demo` (loads Ganja demo), 3-card workflow overview, sample reasoning card, and verified footer.
2. `/explore` (`OrbitalExplorerPage.tsx`): Interactive 3D orthographic globe (`OrbitalGlobeCanvas.tsx`) with drag-to-orbit, `+`/`-`/wheel zoom, `Reset view`, `Focus Ganja demo`, inverse spherical WGS84 click picking, verified 4-region AZ snapshot selector (`Ganja`, `Aran`, `Quba-Khachmaz`, `Sheki-Zaqatala`), keyboard lat/lon fallback form, `2D Satellite Map` switch, honest layer toggle (`Climate` clearly notes *"No spatial raster layer available"*), and 2024 snapshot period badge.
3. `/field` (`FieldIntelligencePage.tsx`): 68/32 desktop split (`SatelliteFieldMap.tsx` + soil/irrigation/history panel). Marks `soil.ph` explicitly as `Unknown` (`null`) when unchecked without ever defaulting to `7.0`, validates conditional `laboratory`/`modeled` source reference rules, and links `"Edit location"` back to `/explore` (no fake polygon backend).
4. `/climate` (`ClimateHistoryPage.tsx`): Real 2024 NASA POWER period metrics, calibrated temperature span & precipitation SVG views, optional `"Show illustrative seasonal curve"` opt-in clearly badged `Illustrative data`, full accessible `<table className="sf-table">` toggle, and copyable SHA-256 provenance summary.
5. `/rotation` (`RotationStudioPage.tsx`): Priority sliders (`Water`, `Soil`, `Income` marked `Data needed`), stale banner when draft diverges from last simulation, adaptive 0/1/2/3 plan grid (`Highest-ranked for these inputs`), constraint validation breakdown, `no_feasible_plan` / `needs_data` / `provisional` states.
6. `/scenarios` (`ScenarioLabPage.tsx`): Panoramic dark terrain backdrop (`/assets/scenario-panorama.jpg` labeled decorative), `Hypothetical scenario` pill, discrete contract multiplier (`0%`, `-10%`, `-20%`, `-30%`), `Baseline` vs `Rainfall stress` comparison matched by `plan_id`/crop sequence, explicit warning if ranking is unchanged or a plan becomes infeasible, and 4-part accordion details.
7. `/sources` (`SourcesExplanationsPage.tsx`): Selected rotation summary, real Unknown inputs checklist, clickable `Inputs -> Rules -> Comparison` flow chain, shared `ProvenanceCards` component (also reused in `SourceDrawer`), real simulation JSON export (`Download result JSON`), and accessible Methodology modal.

---

## 3. Asset Provenance & Scientific Boundaries

- `/assets/hero-earth-orbit.jpg`: AI-generated cinematic Earth-from-orbit hero illustration staged cleanly in `apps/web/public/assets/` solely as decorative cosmic context for `/` hero; contains no logos, telemetry labels, or geographic measurements.
- `/assets/scenario-panorama.jpg`: AI-generated dark mountain & irrigated patchwork farmland backdrop staged cleanly in `apps/web/public/assets/` for `/scenarios`; accompanied by explicit caption stating it is not the active parcel's orthophoto.
- Map Tiles: Esri World Imagery & CARTO Dark Only Labels via Leaflet with persistent provider attribution (`Tiles © Esri`, `© OpenStreetMap © CARTO`) and true metric `L.control.scale`. Zero fabricated NDVI/SMAP rasters, AZN income numbers, or daily climate series.
