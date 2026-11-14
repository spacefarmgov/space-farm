# Komanda qaydaları və iş bölgüsü — Space Farm (Team CODE44)
Owner: B • Hədəf repo: https://github.com/spacefarmgov/space-farm (public) • Qüvvəyə minmə: rollar təyin olunanda

## Rollar
| Rol | Ad / GitHub | Branch | Əsas məsuliyyət |
|---|---|---|---|
| A | DOLDURULACAQ | feat/frontend-ui | Dizayn, frontend, UX, responsive, API client |
| B | DOLDURULACAQ | feat/backend-core | Struktur, tətbiq API-si, engine, inteqrasiya, deploy, ortaq repo/sənədlər |
| C | DOLDURULACAQ | feat/data-api | NASA və digər xarici API-lər, data, cache, bitki qaydaları |

B merge koordinatorudur. Bu, B-nin bütün kodu yazması demək deyil. Hər kəs öz hissəsinin testinə cavabdehdir. B-nin backend PR-ini A kontrakt/axın, C data semantikası baxımından yoxlayır.
İctimai repoda yazma (`Write`) və inzibatçı (`Admin`) icazələri **yalnız** təsdiqlənmiş CODE44 komanda üzvlərinə verilir; hər kəsə yazma icazəsi açılmır.

## A: frontend + UI
Sahə və torpaq forması, prioritetlər, 3 illik plan kartları, stress idarəsi, izah/mənbə paneli, xəta halları, mobil görünüş.
A API endpoint və engine yazmır, NASA-ya brauzerdən ayrıca sorğu göndərmir. Öz API client-i kontraktı istehlak edir. UI dizaynında backend-in təmin etmədiyi rəqəm “real” göstərilmir.

## B: backend + struktur
Repo bootstrap, FastAPI routes/schemas, input validation, rotasiya və scoring, C provider-inin qoşulması, CORS, health, deploy/CI, müqavilə və ortaq sənədlər.
B data adapterini yenidən yazmır. Qayda məzmununu özündən uydurmur; C-yə konkret sahə/mənbə sorğusu verir.

## C: API + data
Xarici NASA API sorğuları, timeout/retry/cache, raw snapshot, manifest/hash, vahid/missing value yoxlaması, seasonal features, crop catalog və qayda mənbələri.
C tətbiqin HTTP routes/schemas fayllarını dəyişmir; belə ehtiyac varsa B-yə CR açır. C ayrıca backend yaratmır. Frontend komponentinə müdaxilə etmir.

## Fayl sahibliyi
Dəqiq yol matrisi PROJECT_PLAN.md-dədir. Scope xarici dəyişiklik ehtiyacını əvvəl öz jurnalında yaz, owner-ə çatdır. Owner işi öz branch-ında edir. Keçici təhvil yalnız B-nin DECISIONS.md-də yol, yeni owner, vaxt və geri təhvil şərti qeyd etməsindən sonra olur. Eyni yolun eyni vaxtda iki sahibi olmur.

## Antigravity üçün iş dövrü
1. AGENTS.md və öz rol promptunu oxu.
2. `git status --short` və `git branch --show-current` yoxla.
3. PROJECT_STATE.md, ROADMAP.md, öz jurnalın və yeni kontrakt versiyasını oxu.
4. Qısa tapşırıq planı ver və öz sahəndə işi icra et.
5. Uyğun testləri işə sal. İşləməyən yoxlamanı PASS yazma.
6. Öz status faylını yenilə; başqa rolun jurnalını dəyişmə.
7. Diff-i yoxla. Yalnız öz dəyişikliklərini stage et, Conventional Commits formatında mənalı commit yarat (`feat(web):`, `feat(api):`, `feat(data):`, `docs:`, `test:`, `chore:`).
8. Öz rol branch-ına (`feat/frontend-ui`, `feat/backend-core` və ya `feat/data-api`) push et və `base=develop` üçün PR hazırla. `main` və `develop` branch-larına birbaşa commit/push etmə; merge yalnız növbə ilə **Create a merge commit** üsulu ilə B tərəfindən aparılır.
9. Sessiya sonunda “nə hazırdır / nə test edildi / blocker / növbəti addım” qeyd et.

## İnteqrasiya ardıcıllığı
1. **B (`B-01`)** foundation skeletini və dondurulmuş `0.1.0` kontraktını `develop`-a birləşdirir (**`FOUNDATION_READY`**).
2. Paralel mərhələdə **A** dizayn (`A-00`) və sintetik fixture əsaslı UI (`A-01`–`A-03`), **C** real NASA POWER inteqrasiyası və bitki kataloqu (`C-00`–`C-03`), **B** isə mühərrik və HTTP route-lar (`B-02`) üzərində işləyir.
3. Merge ardıcıllığı: **C** (`data_adapters` + kataloq) → **B** (`engine` + `routes` real provider qoşulması, `B-03`/`B-04`) → **A** (real API qoşulması, `A-04`/`A-05`) → **B** (E2E/deploy və `develop → main` demo buraxılışı, `B-05`). Müstəqil hazır UI shell daha əvvəl merge oluna bilər.

## Dəyişməyən qaydalar
- Branch işləmək üçün izolyasiyadır; fayl sahibliyini əvəz etmir.
- Hamı öz branch-ında commit/push edə bilər. Növbə yalnız ortaq branch-a merge üçündür.
- Hamı birlikdə eyni PROJECT_STATE.md-ni redaktə etmir.
- “Build keçdi” demək real NASA data və aqronomik düzgünlük demək deyil.
- Gizli açar, token, .env, şəxsi təsərrüfat məlumatı və böyük dataset repoya getmir.
- .env.example yalnız açarsız nümunədir.
- Reponun formatını bütün fayllara tətbiq edən global formatter işə salma.
- Başqasının faylını silmə, köçürmə və dependency lock faylını özbaşına dəyişmə.
- force push, reset --hard, git clean -fd, branch tarixçəsini yenidən yazmaq gündəlik workflow-a daxil deyil.
- Tətbiqdə işləməyən düymə ya tamamlanır, ya açıq disabled səbəbi göstərilir.
- Mübahisəli scope qərarını B qeyd edir; mövcud işi qoruyaraq ən kiçik işlək həll seçilir.

## Status lüğəti
TODO → IN_PROGRESS → READY_FOR_REVIEW → MERGED → VERIFIED.
BLOCKED ayrıca statusdur, blocker və owner göstərilir.
“MERGED” develop-a daxil olub; “VERIFIED” birləşdirilmiş sistemdə qəbul yoxlanıb. Fərdi branch-da işləyən hissə bütün məhsul üçün DONE deyil.

## Canlı əlaqə
Hər 60–90 dəqiqədən bir 5 dəqiqəlik görüş: tamamlanan iş, yeni kontrakt ehtiyacı, inteqrasiya sırası.
Təcili blocker-i təkcə push edilməmiş faylda saxlamayın; komanda çatına və ya GitHub issue-ya özünüz bildirin. Bu sənəd mesaj göndərmir və Git lock yaratmır.

