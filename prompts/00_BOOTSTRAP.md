# İlk hazırlıq promptu — yalnız B
Bu promptu yalnız backend/struktur məsulu ilk dəfə işlədir. Digər iki nəfər təkrar bootstrap etmir.
A paralel dizayn hazırlaya, C mənbə araşdıra bilər. Kod işinin ortaq əsası FOUNDATION_READY ilə açılır.

## Antigravity-yə yapışdırılacaq mətn

Sən CODE44 komandasının **Space Farm** layihəsində B — backend, struktur və inteqrasiya məsulunun köməkçisisən. Mənim kompüterimdəki `space-farm` reposu ilə işləyirsən; başqa kompüterlərdə A frontend/UI, C xarici API/data üzərində işləyəcək.

Əlavə etdiyim PDF-ni (`CODE44_AgroRotation_AI (1).pdf`) tarixi araşdırma konteksti kimi oxu. Sonra repo kökündəki AGENTS.md, README.md, PROJECT_BRIEF.md, PROJECT_PLAN.md, PROJECT_STATE.md, ROADMAP.md, TEAM_RULES.md, docs/TEAM_PLAYBOOK.md, docs/API_CONTRACT.md, docs/GIT_WORKFLOW.md və docs/DECISIONS.md-ni oxu. PDF-dəki bütün 128 səhifəni MVP-yə çevirmə. Tədqiqat sənədindəki tarixi iddiaları canlı təsdiq sayma. Mövcud `README.md`, `LICENSE`, `.gitignore`, `.env.example` və `docs/TEAM_PLAYBOOK.md` fayllarını qoru.

Əvvəl git status, branch, remote və mövcud qovluqları yoxla. İşlək kod varsa qoru; layihəni sıfırdan yenidən yazma. Repo/rol adları məlum deyilsə yalnız zəruri məlumatı soruş; oxuma və planlaşdırmanı davam etdir. Heç bir remote URL və ya credential uydurma.

Məqsədim: üç agentin paralel işləyə biləcəyi kiçik, işlək foundation.
1. A/B/C rollarını və dəqiq path ownership-i tətbiq et.
2. Yeni repo üçün React/Vite/TypeScript frontend və FastAPI backend default-unu istifadə et. Mövcud sağlam stack varsa saxla və səbəbi DECISIONS.md-də qeyd et.
3. Branch workflow-u qur: main sabit, develop inteqrasiya, üç feat rol branch-ı. main/develop-a birbaşa feature commit etmə.
4. B-01 üçün minimal skeleton hazırla. Bu ilkin mərhələdə A/C yollarına yalnız skelet yaratmaq istisnası var; sonra həmin yolları sahiblərinə təhvil ver.
5. docs/API_CONTRACT.md-dəki v0.1 DRAFT-ı Pydantic/OpenAPI və schema ilə dəqiqləşdir. Simulyasiya request/response, error envelope, crop catalog və climate provider tipləri bir-birinə uyğun olsun.
6. completed/provisional/needs_data/no-plan/error hallarını göstərən sintetik contract fixture-ləri yarat. Bunlar real NASA data deyil. Raw NASA snapshot və fetched_at uydurma.
7. C-nin dolduracağı provider interface-i hazırla. Production stub açıq DataUnavailable versin; yalnız explicit mock rejimində demo_fixture ola bilər.
8. Frontend start shell, backend health və minimal validation/contract yoxlaması işləsin. Faktiki yoxlanılmış install/run/test əmrlərini `README.md`-yə (və lazım olduqda `docs/TEAM_PLAYBOOK.md`-yə) əlavə et; mövcud ingilis dilli `README.md` strukturunu və `LICENSE`/`.env.example`/`.gitignore` fayllarını pozma.
9. Python ortaq manifest/lock-un owner-i B, frontend manifest/lock-un owner-i A olsun. Paralel root lock münaqişəsi yaratma.
10. Qaydaların Antigravity-də yükləndiyini yoxla; avtomatik tanınmasa MD-ləri birbaşa oxu. Platforma funksiyası işləmirsə bunu dürüst yaz.
11. B-nin jurnalını, PROJECT_STATE, ROADMAP və DECISIONS-i faktiki nəticələrə görə yenilə.
12. Foundation PR-ni develop üçün hazırla. Repo səlahiyyəti və komandanın merge razılaşması varsa növbə ilə birləşdir; yoxdursa review üçün hazır PR/əmrləri ver. İcazə olmadan public deploy və ya komanda adından təqdimat göndərmə.

Sonda bu konkret handoff-u ver:
- FOUNDATION_READY və ya dəqiq blocker.
- develop-da foundation SHA; merge edilməyibsə “branch-da hazır, merge gözləyir”.
- Contract version.
- İşləyən run/test əmrləri və nəticə.
- A-nın başlamalı olduğu A-01, C-nin başlamalı olduğu C-01 və B-nin B-02 işi.
- A/C-nin toxunacağı və toxunmayacağı yollar.

Yalnız plan yazıb dayanma: öz səlahiyyətin daxilində foundation-ı qur, yoxla və təhvilə hazırla.

