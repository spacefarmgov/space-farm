# A — frontend canlı iş jurnalı (Space Farm • Team CODE44)
Owner: yalnız A • Branch: feat/data-api & feat/frontend-ui
Son yenilənmə: 14.11.2026 (Asia/Baku)
Baza develop SHA: 8cadb6d9d59cdca4c6969cfeb1eb6cc8e25f44e7
Kontrakt versiyası: 0.1.0 FROZEN

## Cari vəziyyət
Status: VERIFIED (`A-00`–`A-05` tam interaktiv 7 ekranlı **SPACEFARM / ORBITAL AGRICULTURE** UI tətbiqi tamamlandı)
Cari task: `A-05` (Tamamlandı)

## Son tamamlanan iş
- `apps/web/src/data/orbitalData.ts`: Azərbaycanın 4 doğrulanmış real NASA POWER regionu (`Gəncə`, `Aran / Bərdə-Yevlax`, `Quba-Xaçmaz`, `Şəki-Zaqatala`), 2024-cü il üzrə xam NASA POWER JSON-dan çıxarılmış 12 aylıq `T2M` / `T2M_MIN` / `T2M_MAX` / `PRECTOTCORR` seriyaları, bitki vizual nişanları və ikidilli (`EN` / `AZ`) NASA Space Apps atribusiya mətni.
- `apps/web/src/styles/orbital.css`: Təsdiqlənmiş **SPACEFARM / ORBITAL AGRICULTURE (`by CODE44`)** konsept dizayn sistemi — kosmik tünd fon, Yer üfüqü parıltısı, bənövşəyi neon şüşə (`glassmorphism`) kartlar, üst naviqasiya barı və sol 7-ikonlu vertikal dok.
- `apps/web/src/App.tsx`: Bütün 7 interaktiv ekran (`01. Home — From Orbit to Earth`, `02. Orbital Explorer`, `03. Field Intelligence`, `04. Climate History`, `05. Rotation Studio`, `06. Scenario Lab`, `07. Sources & Explanations`) + `7-Screen Concept Board` rejimi, `AbortController` race-condition qorunması (`T18`), dürüst `unknown` torpaq `pH` (`T13`), `income` əlçatmazlığı zamanı avtomatik çəki normallaşdırılması (`T14`), `needs_data` (`T15`), `no_feasible_plan` (`T12`) və xam NASA datasını dəyişdirməyən quraqlıq stressi müqayisəsi (`T16`).

## Test sübutu
| Vaxt | Task | Əmr / addım | Nəticə | Sübut yolu |
|---|---|---|---|---|
| 2026-11-14 | A-00..A-05 | `apps/web` TypeScript & Vite build + canlı `/api/v1/{health,crops,climate/features,simulations}` inteqrasiyası | PASS | `apps/web/src/App.tsx`, `apps/web/src/data/orbitalData.ts`, `apps/web/src/styles/orbital.css` |
