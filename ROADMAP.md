# Yol xəritəsi — Space Farm (Team CODE44)
Owner: B • Vaxt: işə başladığınız andan nisbi saat • Rəsmi deadline ayrıca yoxlanır
Başlanğıcda bütün tətbiq/kod icra tapşırıqları TODO-dur (yalnız sənədləşmə, README, LICENSE, `.gitignore`, `.env.example` hazırlanıb). Saatlar komanda planıdır, yarışın vaxtı deyil.

## Mərhələlər
| Mərhələ | Təxmini pəncərə | Çıxış qapısı |
|---|---|---|
| M0 — Məğz, dizayn, skelet | 0–1 saat | Bir dizayn + FOUNDATION_READY + v0.1 kontrakt |
| M1 — Üç paralel modul | 1–5 saat | UI fixture axını, real data snapshot, engine/API ayrı-ayrı işləyir |
| M2 — İlk bütöv demo | 5–8 saat | Real data → engine → UI |
| M3 — Etibarlılıq | 8–12 saat | Stress, cache, unknown, səhv/no-plan və mobil yoxlanıb |
| M4 — Təqdimat | Qalan vaxt | Deploy, iki dəqiqəlik demo, mənbə və təqdimat linkləri |

Əlinizdə az vaxt varsa M0/M2/M4 saxlanır, dekorativ və əlavə modullar çıxarılır. İlk inteqrasiyanı son saata saxlamayın.

## Tapşırıq lövhəsi
| ID | Owner | İş | Asılılıq | Qəbul meyarı | Status |
|---|---|---|---|---|---|
| B-00 | B | Repo/rollar/struktur | — | `space-farm` public repo, LICENSE/README/`.env.example` hazır; A/B/C istifadəçi adları və branch qoruması yazılıb | IN_PROGRESS |
| B-01 | B | Kontrakt + skelet + fixtures | B-00 | A/C oxuyub; schema fixtures-i yoxlayır; health işləyir | TODO |
| A-00 | A | 3 dizayn variantı | — | Eyni ekran/komponent, komandanın bir seçimi | TODO |
| A-01 | A | UI shell və dizayn sistemi | A-00, B-01 | Desktop/mobil shell, bir stil | TODO |
| A-02 | A | Formlar və prioritetlər | A-01 | Validation, unknown, çəkilər, fixture axını | TODO |
| A-03 | A | Plan/mənbə/stress panelləri | A-02 | 0–3 plan, izah və bütün UI vəziyyətləri | TODO |
| A-04 | A | Real API qoşulması | B-03, A-03 | Request/response kontrakta uyğundur | TODO |
| C-00 | C | POWER parametrlərinin yoxlanması | — | Rəsmi link + sorğu planı | TODO |
| C-01 | C | Real JSON və manifest | C-00, B-01 | Sorğu URL-si, fetched_at, hash, vahidlər | TODO |
| C-02 | C | Normalizasiya, cache, provider | C-01 | Missing/429/timeout/cache testləri | TODO |
| C-03 | C | Crop catalog və qaydalar | B-01 | 5–6 bitki, hər qaydada mənbə/etibar | TODO |
| B-02 | B | Generator, constraints, scoring | B-01; C-03 yekun qəbul üçün | Deterministic nəticə, sıfır plan izahı | TODO |
| B-03 | B | HTTP routes və data qoşulması | B-02, C-02, C-03 | Müqavilə testləri və real input | TODO |
| B-04 | B | Hipotetik stress və replay | B-03 | Baza dəyişmir; versiya/input qeyd olunur | TODO |
| A-05 | A | Mobil/a11y və error polish | A-04, B-04 | 360px, keyboard, loading/error/cache | TODO |
| C-04 | C | Mənbə və data audit | C-02, C-03 | Eyni snapshot-dan feature yenidən alınır | TODO |
| B-05 | B | E2E/CI/deploy | A-05, C-04, B-04 | Əsas axın linkdən işləyir | TODO |
| R-01 | B | Rəsmi challenge/submission yoxlaması | — | *Field Shift* challenge URL-si, yerli tədbir deadline vaxt qurşağı və AI/data qaydaları yoxlanıb | TODO |
| R-02 | A | İki dəqiqəlik demo ssenarisi | B-05 | İki sınaq keçidi, real davranışa uyğun mətn | TODO |
| R-03 | B | Son buraxılış | R-01, R-02 | Mənbə, link, test, AI disclosure yoxlanıb | TODO |

## Qapılar
### FOUNDATION_READY
Kontrakt və skelet develop-dadır; rolların branch-ları həmin əsasa bağlıdır.
### REAL_DATA_READY
Ən az bir həqiqi NASA cavabı və hash/manifest var; bu paket bunu qabaqcadan hazır hesab etmir.
### E2E_READY
UI nəticəsi həqiqi data pipeline-dan gəlir; hansı feature-in hansı skora təsiri izlənir.
### DEMO_READY
Əsas qəbul testləri keçib, real snapshot fallback yoxlanıb, nəticə dürüst etiketlənib.

## Sonrakı mərhələ
V1: polygon, SoilGrids, əlavə region və dil, saxlanılan sahə tarixçəsi.
V2: SMAP/HLS, aqronom paneli, sahə validasiyası, daha güclü ssenari modeli.
Bunlar işlək imkan kimi göstərilmir.

## Yeniləmə
Hər rol statusu öz jurnalına yazır. B konsolidasiya zamanı bu cədvəli dəyişir və sübutu PROJECT_STATE.md-də əlaqələndirir.
Tamamlanma faizini təxmin etməyin; konkret qəbul meyarı və yoxlanmış status istifadə edin.

