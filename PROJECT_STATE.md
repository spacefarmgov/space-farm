# Canlı layihə vəziyyəti — Space Farm (Team CODE44)
Owner: B • Snapshot: 14.11.2026 • Saat qurşağı: Asia/Baku
Hədəf ictimai repo: https://github.com/spacefarmgov/space-farm
Son konsolidasiya: Backend (`services/api`), real NASA POWER Gəncə 2024 snapshot-ı, `v0.1.0` OpenAPI + 6 sintetik fixture və frontend foundation skeleti (`apps/web`) qurulub, yoxlanıb və `develop`-a birləşdirilməyə hazırlanıb.
Kontrakt: 0.1.0 FROZEN — `contracts/openapi.json` və 6 sintetik fixture (`contracts/fixtures/`) generasiya edilib.

## Hazırda məlum olan (Faktiki vəziyyət)
- **Hazır və yoxlanılmış (Lokal Backend & Data):**
  - `services/api/`: FastAPI tətbiqi, `v0.1.0` Pydantic sxemaları, `/api/v1/{health,crops,climate/features,simulations}`, standart `ErrorEnvelope`, deterministik 3 illik rotasiya və skor mühərriki.
  - `services/api/app/data_adapters/` + `tools/data/fetch_power.py`: real NASA POWER Daily Point (`v2.10.3`, `AG`, `UTC`) sorğusu icra edildi; Gəncə (`40.68, 46.36`, `2024-01-01..2024-12-31`, `366/366` gün, `T2M` orta `10.58 C`, `PRECTOTCORR` `506.52 mm`, `query_hash=552e40e213b9f7b8`, `SHA-256: 22b70694bb786042a84df2371af88ddca8b0485858b8ce51e20d1cb99474bf44`) `data/raw/` və `data/processed/` altında saxlandı.
  - `data/catalog/`: 6 namizəd bitki (`crops.json`) və FAO Paper 56 / CROPWAT əsaslı qaydalar (`rules.json`, `source_supported` / `provisional`).
  - Test sübutu: `python -m unittest discover -s services/api/tests -t services/api -v` (`24/24` PASS) və `python -m unittest tests/e2e/verify_live_e2e.py -v` (`1/1` live NASA POWER E2E PASS).
- **Hazırlıq / Komanda tərəfindən davam etdirilən:**
  - `apps/web/`: Frontend komandası (Rol A) üçün `v0.1.0` TypeScript API tipləri (`src/api/types.ts`), abort-safe API client (`src/api/client.ts`) və minimal Vite foundation shell hazırdır; tam UI ekranları (`A-00`–`A-05`) komanda tərəfindən işlənir.
  - İctimai bulud deploy linki (`B-05`) və GitHub-a push (istifadəçi təsdiqindən sonra).
  - Komanda üzvlərinin fərdi GitHub username-lərinin `TEAM_RULES.md`-yə yazılması (`BL-01`).
  - Yerli aqronom ekspert yoxlaması (bütün bitki qaydaları `source_supported` / `provisional` olaraq saxlanır).
  - Rəsmi challenge yerli tədbir deadline və son resurs yoxlaması (`R-01`).

## İnteqrasiya vəziyyəti
| Hissə | Status | Sübut | Növbəti owner |
|---|---|---|---|
| Repo kimliyi, README, LICENSE, .env.example | READY | Kök fayllar, `infra/`, `infra/ci/github-actions-ci.yml` hazırdır | B |
| Foundation (`apps/web` skeleti + `contracts/`) | VERIFIED_LOCAL | `contracts/openapi.json` + 6 fixture + `apps/web/src/api/` | B |
| Real NASA data (`C-00`–`C-03`) | VERIFIED_LOCAL | `data/raw/552e40e213b9f7b8.json` + manifest + `9/9` data testi PASS | C |
| Engine/API (`B-02`–`B-04`) | VERIFIED_LOCAL | `15/15` API/engine/kontrakt testi PASS (`T09`–`T16`) | B |
| End-to-end backend (`T22`) | VERIFIED_LOCAL | `tests/e2e/verify_live_e2e.py` canlı NASA POWER cavabı ilə PASS | B |
| Frontend UI (`A-00`–`A-05`) | IN_PROGRESS | Komanda tərəfindən işlənir (foundation shell hazır) | A |
| Deploy/pitch (`B-05`, `R-01`–`R-03`) | TODO | İctimai deploy, GitHub push və 2 dəqiqəlik demo gözləyir | B + komanda |

## Bloklayıcılar
| ID | Məsələ | Həll edən | Status / Qeyd |
|---|---|---|---|
| BL-01 | A/B/C rol sahiblərinin fərdi GitHub username-ləri `TEAM_RULES.md`-də hələ yazılmayıb | Komanda/B | OPEN (repo `spacefarmgov/space-farm` yaradılıb) |
| BL-02 | FOUNDATION_READY | B | RESOLVED (2026-11-14: arxitektura, `services/api`, `contracts/`, `apps/web/` skeleti qurulub) |
| BL-03 | Real NASA POWER sorğusu | C | RESOLVED (2026-11-14: real Gəncə 2024 JSON + SHA-256 manifest yoxlanıb) |

## Növbəti üç addım
1. İstifadəçi təsdiqindən sonra `feat/backend-core` işlərini GitHub-a (`spacefarmgov/space-farm`) push etmək və `develop`-a birləşdirmək.
2. Rol A: `apps/web/src/api/` müqaviləsi üzərində UI komponentlərini (`A-01`–`A-05`) tamamlamaq.
3. Rol B: İctimai deploy (`B-05`) və rəsmi challenge yoxlamasını (`R-01`, `R-03`) bitirmək.
