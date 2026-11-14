# Yol xəritəsi — Space Farm (Team CODE44)
Owner: B • Vaxt: işə başladığınız andan nisbi saat • Rəsmi deadline ayrıca yoxlanır
Saatlar komanda planıdır, yarışın vaxtı deyil.

## Mərhələlər
| Mərhələ | Təxmini pəncərə | Çıxış qapısı |
|---|---|---|
| M0 — Məğz, dizayn, skelet | 0–1 saat | Bir dizayn + FOUNDATION_READY + v0.1 kontrakt |
| M1 — Üç paralel modul | 1–5 saat | UI fixture axını, real data snapshot, engine/API ayrı-ayrı işləyir |
| M2 — İlk bütöv demo | 5–8 saat | Real data → engine → UI |
| M3 — Etibarlılıq | 8–12 saat | Stress, cache, unknown, səhv/no-plan və mobil yoxlanıb |
| M4 — Təqdimat | Qalan vaxt | Deploy, iki dəqiqəlik demo, mənbə və təqdimat linkləri |

## Tapşırıq lövhəsi
| ID | Owner | İş | Asılılıq | Qəbul meyarı | Status |
|---|---|---|---|---|---|
| B-00 | B | Repo/rollar/struktur | — | `space-farm` public repo, branch-lar (`main`, `develop`, `feat/*`), LICENSE/README/`.env.example` hazır; A/B/C username-lər yazılmalıdır | IN_PROGRESS |
| B-01 | B | Kontrakt + skelet + fixtures | B-00 | `contracts/openapi.json`, 6 fixture, health işləyir, `apps/web/` foundation shell `develop`-dadır (`PR #1`) | VERIFIED |
| A-00 | A | 3 dizayn variantı | — | Eyni ekran/komponent, komandanın bir seçimi | IN_PROGRESS |
| A-01 | A | UI shell və dizayn sistemi | A-00, B-01 | Foundation shell qurulub; tam dizayn sistemi işlənir | IN_PROGRESS |
| A-02 | A | Formlar və prioritetlər | A-01 | Validation, unknown, çəkilər, fixture axını | TODO |
| A-03 | A | Plan/mənbə/stress panelləri | A-02 | 0–3 plan, izah və bütün UI vəziyyətləri | TODO |
| A-04 | A | Real API qoşulması | B-03, A-03 | `apps/web/src/api/` client & `FRONTEND_INTEGRATION.md` hazırdır; UI inteqrasiyası gözləyir | TODO |
| C-00 | C | POWER parametrlərinin yoxlanması | — | Rəsmi API (`v2.10.3`) + `T2M`/`PRECTOTCORR` canlı yoxlandı | VERIFIED |
| C-01 | C | Real JSON və manifest | C-00, B-01 | `data/raw/552e40e213b9f7b8.json` + SHA-256 manifest (`366` gün) | VERIFIED |
| C-02 | C | Normalizasiya, cache, provider | C-01 | Missing/429/422/timeout/cache/outage testləri (`9/9` PASS) | VERIFIED |
| C-03 | C | Crop catalog və qaydalar | B-01 | 6 bitki, hər qaydada FAO mənbə/status (`crops.json`, `rules.json`) | VERIFIED |
| B-02 | B | Generator, constraints, scoring | B-01; C-03 | Deterministic nəticə, sıfır plan izahı | VERIFIED |
| B-03 | B | HTTP routes və data qoşulması | B-02, C-02, C-03 | Müqavilə testləri və real input (`15/15` test PASS) | VERIFIED |
| B-04 | B | Hipotetik stress və replay | B-03 | Baza dəyişmir; `0.9/0.8/0.7` stress yoxlanıb (`T16` PASS) | VERIFIED |
| A-05 | A | Mobil/a11y və error polish | A-04, B-04 | 360px, keyboard, loading/error/cache | TODO |
| C-04 | C | Mənbə və data audit | C-02, C-03 | `tools/data/audit_data.py` (SHA-256, replay, catalog, fixtures) + `T22` PASS | VERIFIED |
| B-05 | B | E2E/CI/deploy | A-05, C-04, B-04 | Backend E2E, `Dockerfile.api`, `docker-compose.yml`, CI şablonu və `scripts/` hazırdır; UI inteqrasiyasından sonra cloud deploy qalır | IN_PROGRESS |
| R-01 | B | Rəsmi challenge/submission yoxlaması | — | 2026 *Field Shift* challenge məqsədi və NASA data uyğunluğu təsdiqlənib; lokal tədbir saat qurşağı finalda təsdiqlənəcək | IN_PROGRESS |
| R-02 | A | İki dəqiqəlik demo ssenarisi | B-05 | İki sınaq keçidi, real davranışa uyğun mətn | TODO |
| R-03 | B | Son buraxılış | R-01, R-02 | Mənbə, link, test, AI disclosure və `develop → main` release | TODO |
