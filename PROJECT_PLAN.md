# Ümumi icra planı — Space Farm (Team CODE44)
Owner: B • v1.1 • Arxitektura seçimi: bu paket üçün təklif edilən default

## 1. Texnologiya seçimi
Mövcud işlək repo yoxdursa:
- Frontend: React + TypeScript + Vite. Bir frontend tətbiqi.
- Backend: Python + FastAPI + Pydantic. Bir backend prosesi.
- Data: həmin backend daxilində Python adapter modulu; ayrıca üçüncü server yoxdur.
- Saxlama: MVP-də versiyalı JSON snapshot və katalog; daimi hesab sisteminə ehtiyac yoxdur.
- Python üçün 3.11 və ya 3.12 komanda üzrə eyni minor; Node üçün seçilən alətlərin dəstəklədiyi eyni LTS.
- Paket versiyaları bootstrap zamanı yoxlanır və lock fayllarına bağlanır. Bu sənəd “latest” versiya təyin etmir.

Mövcud layihənin sağlam stack-i varsa B onu yoxlayıb DECISIONS.md-də saxlayır. Təkcə bu təlimata görə işlək kod bazası yenidən yazılmır.

## 2. Məlumat axını
Frontend HTTP sorğusu → B-nin route/validation qatı → C-nin data provider-i → B-nin qərar mühərriki → frontend nəticə və mənbələr.
C üçüncü tərəf API-ləri idarə edir. **Tətbiqin HTTP API-si B-yə aiddir.** Bu sərhəd iki nəfərin eyni API faylını yazmasının qarşısını alır.

## 3. Hədəf qovluqlar və sahiblər
Aşağıdakı kod yolları bootstrap zamanı yaradılacaq; bu paketdə tətbiq kodu yoxdur.

| Yol | Owner | Məzmun |
|---|---|---|
| apps/web/ | A | Bütün UI, local API client, frontend test, package.json və lock |
| services/api/app/routes/ | B | HTTP endpointlər |
| services/api/app/schemas/ | B | Ortaq Pydantic DTO-lar |
| services/api/app/engine/ | B | Filtr, generator, scoring, izah |
| services/api/app/main.py, config, `__init__.py` | B | App start, CORS, env/config yükləmə, router qoşulması |
| services/api/app/data_adapters/ | C | POWER client, cache, feature pipeline, crop provider |
| services/api/tests/data/ | C | Data testləri |
| services/api/tests/ — data/ istisna | B | Engine, route, contract testləri |
| services/api/pyproject.toml və Python lock | B | Ortaq Python asılılıqları |
| data/raw/, data/processed/, data/catalog/ | C | Kiçik təsdiqlənmiş real snapshot, manifest, bitki qaydaları |
| tools/data/ | C | Downloader və data yoxlama CLI-si |
| contracts/ | B | OpenAPI, JSON schema və sintetik contract fixtures |
| tests/e2e/, infra/ və kök konfiqurasiyalar | B | İnteqrasiya, deploy, CI, `LICENSE`, `.gitignore`, `.env.example` |
| docs/design/, docs/DESIGN_BRIEF.md | A | Dizayn şəkilləri və seçimin təsviri |
| docs/DATA_RULES.md | C | Data semantikası, lisenziya qeydi və source register |
| docs/status/frontend.md | A | A yaddaşı |
| docs/status/backend.md | B | B yaddaşı |
| docs/status/data.md | C | C yaddaşı |
| Digər kök MD, docs (`TEAM_PLAYBOOK`, `SOURCES`, `DECISIONS`, `ACCEPTANCE_TESTS`, `GIT_WORKFLOW`), prompts, .github, .agents | B | Ortaq koordinasiya |

Ən spesifik yol qalibdir: `services/api/app/data_adapters/` C-yə aiddir, üst qovluğun B-də olması bunu dəyişmir. Siyahıda olmayan yol B-yə sorğu kimi göndərilir.

## 4. FOUNDATION_READY şərtləri
B ilkin mərhələdə:
1. Repo və PDF-ni yoxlayır; mövcud faylları qorumalıdır.
2. Yuxarıdakı qovluqları və hər rol üçün minimal işlək skeleti hazırlayır.
3. `docs/API_CONTRACT.md`-dən OpenAPI/schema və sintetik response fixture-ləri yaradır; A/C ilə nəzərdən keçirir.
4. A üçün bir start ekranı; B üçün health route; C üçün provider interface/stub yaradır.
5. Stub “real NASA data” qaytarmır; açıq unavailable və ya yalnız mock rejimində demo_fixture qaytarır.
6. README.md-də (və lazım olduqda `docs/TEAM_PLAYBOOK.md`-də) faktiki yoxlanılmış install/run/test əmrlərini yazır; işlətmədiyi əmri PASS saymır. `.env.example` faylından əsl açarsız istifadə qaydasını qoruyur.
7. Kontraktı `0.1.0` kimi dondurur və skeleti develop-a merge edir.
8. PROJECT_STATE.md-də foundation commitini və hazır olan hissələri qeyd edir.

İlk bootstrap istisnasında B başqa rolların minimal skeletini yarada bilər. FOUNDATION_READY-dən sonra həmin yolları sahiblərinə təhvil verir. Bu istisna davamlı müdaxilə icazəsi deyil.

## 5. İlk inteqrasiya
- A kontrakt fixture-ləri ilə interfeysi backend gözləmədən qurur; “Demo data” nişanı məcburidir.
- C real sorğu, normalizasiya və provider return tipini hazırlayır.
- B əvvəl fixture provider ilə mühərrik və HTTP-ni qurur, sonra C provider-ini qoşur.
- İnteqrasiyada C → B → A ardıcıllığı asılılıq olduqda seçilir. B-nin baza kontrakt PR-i hamısından əvvəl gəlir.
- İnteqrasiya olunan UI-də default real API olur; süni fixture-ə səssiz keçid yoxdur.

## 6. Qərar mühərriki
B-nin işi:
- C-nin versiyalı bitki qaydalarını oxumaq.
- 6 bitki/3 il üçün kiçik kombinasiyalar dəsti yaratmaq; bir ilin bir əsas bitkisi MVP sadələşdirməsidir.
- Sərt məhdudiyyətləri əvvəl tətbiq etmək; yüksək skor qadağanı ləğv etmir.
- Yumşaq göstəriciləri eyni [0,1] istiqamətinə normallaşdırmaq.
- Aktiv ölçülər üçün çəkili skor; çatışmayan ölçülərə görə effektiv çəkiləri ayrıca göstərmək.
- Bərabər nəticə üçün deterministic tie-break: risk göstəricisi varsa aşağı risk, sonra crop_id ardıcıllığının leksikoqrafik sırası.
- Ən çox 3 fərqli plan və hər biri üçün qayda/feature əsaslı izah vermək.
- Qeyri-müəyyən məlumatı uyğundur kimi qəbul etməmək; provisional/needs_data statusunu saxlamaq.
- Eyni input + dataset + qayda/model versiyası üçün eyni plan/skor; təsadüfi simulyasiya yoxdur.

C qaydaların elmi məzmununu və mənbəsini hazırlayır; B onların icrasını yazır. Frontend hesablamanı təkrar yazmır.

## 7. Gündəlik yaddaşın yenilənməsi
Hər mənalı tapşırıq və sessiya sonunda hər rol öz status faylında task ID, dəyişiklik, test, blocker, asılılıq və növbəti addımı qeyd edir.
B hər inteqrasiya dövründən sonra merged jurnalları oxuyur, PROJECT_STATE.md/ROADMAP.md-ni yeniləyir. Faylda son konsolidasiya tarixi, develop commit-i və hələ merge olunmamış işlər ayrıdır.
Ortaq plan yalnız scope/arxitektura dəyişəndə dəyişir; hər kiçik CSS düzəlişində yenidən yazılmır.

## 8. Müqavilə dəyişməsi
Təklif sahibi öz jurnalında `CR-ROL-001` açır: köhnə/yeni schema, səbəb, təsir, nümunə.
B A/C ilə təsiri yoxlayır, yeni versiyanı yazır və kontrakt PR-ni əvvəl merge edir. İstehlakçılar sonra yenilənir. Sahə adını səssiz dəyişmək qadağandır.

## 9. Çıxış hədəfi
İşlək frontend/backend linkləri, repo, real data manifesti, test sübutu, iki dəqiqəlik demo. Host seçimi B tərəfindən real hesab imkanına görə edilir. Hosting provayderi, domen və icra edilmiş deploy bu paketdə fərz olunmur.

