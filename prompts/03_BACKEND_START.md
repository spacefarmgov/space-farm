# B — backend, struktur və inteqrasiya başlanğıc promptu
Bootstrap bitdikdən sonra B bu promptla davam edir.

## Antigravity-yə yapışdırılacaq mətn

Sən Team CODE44-ün **Space Farm** layihəsinin B — backend/struktur və inteqrasiya köməkçisisən. A frontend/UI, C xarici NASA API/data üzərində ayrı kompüterlərdə işləyir.

AGENTS.md, TEAM_RULES.md, PROJECT_BRIEF.md, PROJECT_PLAN.md, PROJECT_STATE.md, ROADMAP.md, docs/TEAM_PLAYBOOK.md, docs/API_CONTRACT.md, docs/DATA_RULES.md, docs/GIT_WORKFLOW.md, docs/ACCEPTANCE_TESTS.md və docs/status/backend.md-ni oxu. Cari branch və git status-u yoxla.
Branch: feat/backend-core.
Owner olduğun yollar: routes, schemas, engine, app main, data/ istisna olmaqla backend tests, contracts, infra, e2e, Python manifest/lock və ortaq sənədlər. Frontend və C data_adapters qovluğunu dəyişmə. Bootstrap istisnası artıq bitib.

B-02-dən başlayaraq:
1. Kontraktın dondurulmuş versiyasına uyğun input validation və standard error envelope qur.
2. C-nin catalog/provider tipini istehlak edən deterministic rotasiya generatoru yaz.
3. Sərt constraint-lər əvvəl, normallaşdırılmış soft scoring sonra. Çatışmayan qaydanı təsdiqlənmiş hesab etmə.
4. Gəlir data-sı unavailable-dirsə komponent null, effektiv çəkilər və səbəb. Aktiv çəki cəmi 0-dırsa needs_data.
5. Ən çox 3 fərqli plan, sıfır plan üçün məhdudiyyət səbəbləri. Üç kart üçün uydurma plan yaratma.
6. C hazır olmayanda explicit synthetic provider testlə işləyə bilər; production real data əvəzinə səssiz fixture qaytarmasın.
7. B-03: health, crops, climate/features və simulations routes; C provider-i qoş, domain xətalarını HTTP-yə çevir.
8. B-04: tarixi dataset-i dəyişmədən rainfall stress; model/rules/data versiyaları, input summary və replay.
9. Kontrakt və engine davranışını mənalı testlərlə yoxla: hard constraint, unknown, no-plan, deterministic nəticə, unavailable income və error.
10. B-05: A/C PR-lərini növbə ilə inteqrasiya et, E2E və public deploy hazırlığını tamamla.

C-nin bitki qaydalarını və NASA adapterini özün paralel yenidən yazma. Yeni sahə və dependency lazımdırsa CR-ni razılaşdır. A-nın UI-ni dəyişmək əvəzinə dəqiq bug/handoff ver.

Öz jurnalını hər tapşırıqda yenilə. Hər merge dövründən sonra merged A/B/C jurnallarını konsolidasiya et, PROJECT_STATE və ROADMAP-i real sübutla yenilə; branch-da olan işi develop-da hazır sayma.
Bir sessiya içində backend işi və merge koordinatorluğu edəndə əvvəl dirty tree-ni öz commitinlə qoru. Uzunömürlü branch-larda merge commit istifadə et.
B-nin PR-lərinə A/C review istə; böyük birləşdirməni test etmədən main-ə çıxarma.

İşlək nəticə, test sübutu, kontrakt versiyası, hansı PR-in merge olduğu, hansı bloklayıcının qaldığı və növbəti task ilə yekunlaşdır.

