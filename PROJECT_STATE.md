# Canlı layihə vəziyyəti — Space Farm (Team CODE44)
Owner: B • Snapshot: 14.11.2026 • Saat qurşağı: Asia/Baku
Hədəf ictimai repo: https://github.com/spacefarmgov/space-farm
Son konsolidasiya: hazırlıq paketi vahid Space Farm kimliyinə uyğunlaşdırılıb (tətbiq kodu hələ yazılmayıb)
develop commit: lokal hazırlıq mərhələsi / B-01 gözləyir
Kontrakt: 0.1.0 DRAFT — B-01 bootstrap zamanı dondurulacaq

## Hazırda məlum olan (Faktiki vəziyyət)
- **Hazır olan (Sənədləşmə və İdarəetmə qatı):** Space Farm vahid kimliyi, ingilis dilli münsif `README.md`, `LICENSE` (MIT + ayrı NASA data şərtləri), `.gitignore`, `.env.example`, arxitektura planı, `v0.1.0 DRAFT` API müqaviləsi, data qaydaları, 24 qəbul testi matrisi, Git iş axını və rol promptları hazırdır.
- **Hazır olmayan (Tətbiq və Data):** Tətbiq kodu (`apps/web/`, `services/api/`), real NASA POWER JSON snapshot-ı, canlı demo və deploy hələ mövcud deyil.
- **Dizayn:** Hələ seçilməyib (`A-00` gözləyir).
- **Yarış uyğunluğu:** 2026 NASA Space Apps Challenge — *Field Shift: Adapting Farms with NASA Data* hədəf seçilib; son local event deadline və təşkilatçı elanları `R-01`-də yoxlanmalıdır.

## İnteqrasiya vəziyyəti
| Hissə | Status | Sübut | Növbəti owner |
|---|---|---|---|
| Repo kimliyi, README, LICENSE, .env.example | READY | Kök fayllar və sənədlər hazırlanıb | B |
| Foundation (`apps/web` + `services/api` skeleti) | TODO | — | B |
| Design selected (`A-00`) | TODO | — | A + komanda |
| Frontend (`A-01`–`A-05`) | TODO | — | A |
| Real NASA data (`C-00`–`C-04`) | TODO | — | C |
| Engine/API (`B-02`–`B-04`) | TODO | — | B |
| End-to-end demo (`B-05`) | TODO | — | B, A/C dəstəyi |
| Deploy/pitch (`R-01`–`R-03`) | TODO | — | B + komanda |

## Bloklayıcılar
| ID | Məsələ | Həll edən | Digərləri bu vaxt nə edə bilər? |
|---|---|---|---|
| BL-01 | A/B/C rol sahiblərinin adları və GitHub username-ləri `TEAM_RULES.md`-yə yazılmayıb (repo URL müəyyəndir: `spacefarmgov/space-farm`) | Komanda/B | Dizayn və PDF oxunuşu |
| BL-02 | FOUNDATION_READY yoxdur (`B-01` tətbiq skeleti hələ qurulmayıb) | B | A dizayn (`A-00`), C NASA POWER mənbə yoxlaması (`C-00`) |
| BL-03 | Real NASA POWER sorğusu hələ icra edilməyib (`NASA-02: NOT_FETCHED`) | C | Sintetik müqavilə fixture-ləri ilə development |

## Növbəti üç addım
1. B (`B-00` / `B-01`): `https://github.com/spacefarmgov/space-farm` reposunda branch-ları sinxronlaşdırmaq, rol sahiblərini yazmaq, bootstrap skeleti və `0.1.0` kontraktını dondurmaq.
2. A (`A-00`): müqayisə edilə bilən üç dizayn variantı hazırlamaq və komanda seçimini `docs/DESIGN_BRIEF.md`-də qeyd etmək.
3. C (`C-00` / `C-01`): NASA POWER Daily sənədini və yağıntı parametrini canlı yoxlayıb ilk real raw JSON + SHA-256 manifest sübutunu çıxarmaq.

## Son inteqrasiya
Hələ yoxdur. Gələcəkdə: tarix/saat, PR, source SHA, nəticə, test sübutu, kontrakt versiyası.

## Merge olunmamış işlər
Hələ yoxlanmayıb. Branch journal-da hazır yazılması develop-da hazır olması demək deyil.

## Yeniləmə qaydası
B hər merge dövründən sonra develop-da olan üç jurnalı oxuyur; yalnız yoxlanmış faktları birləşdirir.
Son konsolidasiya vaxtını və istinad commitini yazır. Köhnə bloklayıcını səbəbsiz silmir; həll tarixini qeyd edir.
Bu fayl avtomatik Git kilidi və ya real vaxt koordinasiya xidməti deyil.

