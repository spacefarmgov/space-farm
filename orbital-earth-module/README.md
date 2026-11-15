# SpaceFarm Orbital Earth Module (`CODE44`)

Standalone interactive 3D Earth + Satellite POV + Zoomed Esri Satellite Map module ready for integration into the main SpaceFarm frontend & data pipeline.

## Included Files (`src/`)
- `src/index.ts` — Barrel exports (`OrbitalEarthModule`, `EarthSatelliteCanvas`, `SatelliteFieldMap`, `ORBITAL_PRESETS`, telemetry helpers, types)
- `src/OrbitalEarthModule.tsx` — Main orchestrator (Orbit / Satellite POV / Atmospheric Hyper-Dive / Zoomed Esri Map, `EN <-> AZ`, `TERRA` / `LANDSAT 8`)
- `src/components/EarthSatelliteCanvas.tsx` — Three.js 3D Earth (`NASA 5K + 500M HD` GIBS, `Normal Optical`, `Real Thermal IR`, `Live Wind Streams`, `Real Crop NDVI`), `SGP4 Beacon` telemetry node, and 2-mode `Satellite POV` (`Steady Target` with smooth inertial gimbal pan + `Live SGP4 Pass`)
- `src/components/SatelliteFieldMap.tsx` — Zoomed Esri World Imagery Leaflet map with full-viewport animated wind streamlines and compact/expandable telemetry card
- `src/services/realTelemetry.ts` — Real CelesTrak SGP4 orbit propagation, NASA GIBS tile stitching (including 500m `z=5` regional patch), Open-Meteo 84-point wind/temp grid, and NASA POWER climate fetch
- `src/data/presets.ts` — Verified agricultural presets (`Ganja`, `Aran`, `Quba`, `Sheki`, `Konya`)
- `src/types.ts` — Shared TypeScript interfaces
- `src/styles/orbital-module.css` — Dark cosmic + purple (`#a855f7`) SpaceFarm styling (responsive desktop + mobile)

## Required Dependencies
```bash
npm install three satellite.js leaflet
npm install -D @types/three @types/leaflet
```
Also import `leaflet/dist/leaflet.css` and `orbital-earth-module/src/styles/orbital-module.css`.
