# Canlı layihə vəziyyəti — Space Farm (Team CODE44)
Owner: B • Snapshot: 14.11.2026 • Saat qurşağı: Asia/Baku
Hədəf ictimai repo: https://github.com/spacefarmgov/space-farm
Son konsolidasiya: Backend, 4 Azərbaycan regionu üzrə real NASA POWER data snapshot-ları + C-04 auditi (`PR #3`), deterministik mühərrik, `v0.1.0` OpenAPI + 6 fixture, `infra/`, `scripts/`, `docs/FRONTEND_INTEGRATION.md` və frontend foundation skeleti `develop`-a birləşdirilib. **Yalnız Frontend UI (`apps/web`) və final deploy/təqdimat qalır.**
Kontrakt: 0.1.0 FROZEN — `contracts/openapi.json` və 6 sintetik fixture (`contracts/fixtures/`) generasiya və audit edilib.

## Hazırda məlum olan (Faktiki vəziyyət)
- **Tamamlanmış və `develop`-a birləşdirilmiş (Backend, Data, Kontrakt, Infra):**
  - `services/api/`: FastAPI tətbiqi (`requirements.txt` + `pyproject.toml`), `v0.1.0` Pydantic sxemaları, `/api/v1/{health,crops,climate/features,simulations}`, standart `ErrorEnvelope`, deterministik 3 illik rotasiya və skor mühərriki.
  - `services/api/app/data_adapters/` + `tools/data/fetch_power.py` + `tools/data/audit_data.py` + `docs/DATA_RULES.md`: real NASA POWER Daily Point (`v2.10.3`, `AG`, `UTC`) sorğuları ilə Azərbaycanın 4 kənd təsərrüfatı regionu üzrə 2024 (`2024-01-01..2024-12-31`, `366/366` gün) snapshot-ları `cached` və `live` rejimdə hazırdır və müstəqil SHA-256 auditi ilə təsdiqlənib:
    1. **Gəncə (`40.68, 46.36`)** — `query_hash=552e40e213b9f7b8` (`506.52 mm`, `10.58 °C`, `SHA-256: 22b70694bb786042a84df2371af88ddca8b0485858b8ce51e20d1cb99474bf44`)
    2. **Aran / Bərdə-Yevlax (`40.38, 47.12`)** — `query_hash=a56184dd09acd946` (`457.50 mm`, `15.70 °C`, `SHA-256: 512797f922453b9c8df53738d0d40e06ede038bab41707809da5b3338a4cf1f7`)
    3. **Quba-Xaçmaz (`41.36, 48.51`)** — `query_hash=f850af6ab056dbf6` (`516.20 mm`, `15.04 °C`, `SHA-256: a1d90215e046fefd30243a0d1d9a6ead6a3e7beef5ef7e99a6722cf9d0d06dff`)
    4. **Şəki-Zaqatala (`41.19, 47.17`)** — `query_hash=3f72f4396abc697d` (`588.52 mm`, `15.65 °C`, `SHA-256: 76373e22397a21421e4f1e1c842652ff2c70392ab0b56b3bd2520056f392a9f3`)
  - `data/catalog/`: 6 namizəd bitki (`crops.json`) və FAO Paper 56 / CROPWAT əsaslı 7 qayda (`rules.json`, `source_supported` / `provisional`).
  - `infra/` & `scripts/`: `Dockerfile.api`, `docker-compose.yml`, `infra/ci/github-actions-ci.yml`, `infra/README.md`, `scripts/run_api.ps1`, `scripts/test_all.ps1`.
  - `apps/web/`: Frontend komandası (Rol A) üçün `v0.1.0` TypeScript tipləri (`src/api/types.ts`), abort-safe API client (`src/api/client.ts`), Vite proxy (`vite.config.ts`) və [docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md) hazırdır (`tsc -b && vite build` PASS).
  - Test sübutu: `tools/data/audit_data.py` (`4/4` snapshot, `6` bitki, `7` qayda, `6` fixture PASS), `python -m unittest discover -s services/api/tests -t services/api -v` (`25/25` PASS) və `python -m unittest tests/e2e/verify_live_e2e.py -v` (`1/1` live NASA POWER E2E PASS).
- **Qalan işlər (Əsasən Frontend + Final Deploy/Pitch):**
  - `apps/web/`: Frontend komandası tərəfindən tam UI dizaynı və ekranların qurulması (`A-00`–`A-05`, `feat/frontend-ui` branch-ında).
  - İctimai bulud deploy linki (`B-05`) — frontend tamamlandıqdan sonra.
  - Komanda üzvlərinin fərdi GitHub username-lərinin `TEAM_RULES.md`-yə yazılması (`BL-01`).
  - Rəsmi challenge yerli tədbir saat qurşağı / final submission yoxlaması və 2 dəqiqəlik pitch (`R-02`, `R-03`).

## İnteqrasiya vəziyyəti
| Hissə | Status | Sübut | Növbəti owner |
|---|---|---|---|
| Repo kimliyi, README, LICENSE, .env.example, branch-lar | READY | `main`, `develop`, `feat/backend-core`, `feat/frontend-ui`, `feat/data-api` | B |
| Foundation (`apps/web` skeleti + `contracts/` + inteqrasiya bələdçisi) | VERIFIED | `PR #1` (`d4eea8c`), `contracts/openapi.json` + 6 fixture + `audit_data.py` PASS | B |
| Real NASA data & audit (`C-00`–`C-04`) | VERIFIED | 4 real 2024 AZ regional snapshot (`552e40e213b9f7b8`, `a56184dd09acd946`, `f850af6ab056dbf6`, `3f72f4396abc697d`) + `audit_data.py` (`4/4`) + `10/10` data testi PASS | C |
| Engine/API (`B-02`–`B-04`) | VERIFIED | `15/15` API/engine/kontrakt testi PASS (`T09`–`T16`) + canlı `uvicorn` check | B |
| End-to-end backend (`T22`) | VERIFIED | `tests/e2e/verify_live_e2e.py` canlı NASA POWER cavabı ilə PASS | B |
| Frontend UI (`A-00`–`A-05`) | IN_PROGRESS | Komanda tərəfindən işlənir (`feat/frontend-ui` branch-ı `develop` ilə sinxronlaşdırılıb) | A |
| Deploy/pitch (`B-05` deploy, `R-02`–`R-03`) | TODO | Frontend inteqrasiyasından sonra ictimai deploy və `develop → main` release | B + komanda |

## Bloklayıcılar
| ID | Məsələ | Həll edən | Status / Qeyd |
|---|---|---|---|
| BL-01 | A/B/C rol sahiblərinin fərdi GitHub username-ləri `TEAM_RULES.md`-də hələ yazılmayıb | Komanda/B | OPEN (repo `spacefarmgov/space-farm` hazırdır) |
| BL-02 | FOUNDATION_READY | B | RESOLVED (2026-11-14: `PR #1` `d4eea8c` ilə `develop`-a merge edilib) |
| BL-03 | Real NASA POWER sorğusu | C | RESOLVED (2026-11-14: `PR #3` `f510025` ilə 4 real AZ 2024 snapshot + SHA-256 manifest + `audit_data.py`) |

## Son inteqrasiya
- **PR #3 (`feat/data-api → develop`):** 2026-11-14 • Head SHA: `f510025acaf1b8e4038203c0fe06eb0d9c553a59` • Kontrakt: `0.1.0 FROZEN` • Nəticə: PASS (`audit_data.py` 4/4 + `25/25` unit/contract + `1/1` live E2E) • Gəncə, Aran, Quba-Xaçmaz və Şəki-Zaqatala 2024 snapshot-ları `develop`-a birləşdirildi və `feat/frontend-ui` ilə sinxronlaşdırıldı.
- **PR #2 (`feat/backend-core → develop`):** 2026-11-14 • Merge SHA: `8cadb6d` • Data audit script, docker/runner skriptləri və `FRONTEND_INTEGRATION.md`.
- **PR #1 (`feat/backend-core → develop`):** 2026-11-14 • Merge SHA: `d4eea8c4e322d264abe5d0a271a8b91569fc8356` • Kontrakt: `0.1.0 FROZEN` • Nəticə: PASS (`24/24` unit/contract + `1/1` live E2E + `vite build`).

## Növbəti üç addım
1. Rol A: `feat/frontend-ui` branch-ında UI komponentlərini (`A-00`–`A-05`) [docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md) əsasında tamamlamaq.
2. Frontend hazır olduqda B + A: canlı frontend ↔ backend tam E2E (`T17`–`T22`) testlərini keçirmək.
3. Rol B: İctimai bulud deploy-unu (`B-05`) qaldırmaq və `develop → main` final demo buraxılışını (`R-03`) tamamlamaq.
