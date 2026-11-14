# B — backend canlı iş jurnalı (Space Farm • Team CODE44)
Owner: yalnız B • Branch: feat/backend-core
Son yenilənmə: 14.11.2026 (Asia/Baku)
Baza develop SHA: f5fd23d3e68f8981435f1deda9777bc4c66693f8
Kontrakt versiyası: 0.1.0 FROZEN

## Cari vəziyyət
Status: VERIFIED_LOCAL (Lokal backend, engine, kontrakt və E2E testləri hazırdır; GitHub push istifadəçinin təsdiqini gözləyir)
Cari task: B-05 (deploy & frontend inteqrasiya hazırlığı)

## Son tamamlanan iş
- `services/api/`: `pyproject.toml`, `config.py`, `schemas/models.py` (`v0.1.0`), `engine/` (`constraints.py`, `scoring.py`, `planner.py`), `routes/api.py`, `main.py` (`ErrorEnvelope` handler-ləri və CORS).
- `contracts/`: `openapi.json` və 6 sintetik fixture (`tools/contracts/generate_contracts.py` ilə generasiya olunub).
- `apps/web/`: Frontend komandasının qoşulması üçün minimal `v0.1.0` TypeScript/Vite foundation skeleti (`src/api/types.ts`, `src/api/client.ts`).
- `infra/` & `infra/ci/github-actions-ci.yml`: Dockerfile və CI şablonu (`.github/workflows/` altında aktivləşdirmə `workflow` icazəli token tələb edir).

## Test sübutu
| Vaxt | Task | Əmr / addım | Nəticə | Sübut yolu |
|---|---|---|---|---|
| 2026-11-14 | B-01..B-04 | `python -m unittest discover -s services/api/tests -t services/api -v` | PASS (`24/24`) | `services/api/tests/` |
| 2026-11-14 | T22 | `python -m unittest tests/e2e/verify_live_e2e.py -v` | PASS (`1/1`) | `tests/e2e/verify_live_e2e.py` |

## Bloklayıcı və asılılıqlar
| ID | Lazım olan | Owner | Mən bu vaxt nə edə bilərəm? | Status |
|---|---|---|---|---|
| BL-01 | Üzvlərin GitHub username-ləri (`TEAM_RULES.md`) | Komanda/B | Lokal kod tamamlanıb | OPEN |
| — | Frontend tam UI (`A-01`–`A-05`) | A | `apps/web/src/api/` müqaviləsi hazırdır | IN_PROGRESS |

## Növbəti addım
İstifadəçi təsdiqindən sonra GitHub-a push etmək, frontend komandasının UI işini qoşmaq və ictimai deploy (`B-05`) qurmaq.
