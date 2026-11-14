# Space Farm — Komanda İcra Bələdçisi (CODE44)
## Üç kompüter, üç rol, bir ictimai GitHub deposu (`space-farm`)
Yenilənmə: 14.11.2026 • Dil: AZ • Paket: 1.1

**Bu sənəd komanda üzvləri üçün icra təlimatıdır.** Hazırkı mərhələdə repozitoriyada arxitektura, kontrakt, data qaydaları, test matrisi və iş axını mövcuddur; tətbiq kodu (`apps/web/`, `services/api/`) bootstrap (`B-01`) mərhələsində yaradılacaq.

---

### İlk 30–60 dəqiqə
1. Üç nəfəri təyin edin: **A — frontend/UI**, **B — backend/struktur və inteqrasiya**, **C — xarici API/data**. Adları və GitHub username-lərini `TEAM_RULES.md`-də **B** qeyd etsin.
2. Repo kökü `https://github.com/spacefarmgov/space-farm` ünvanındadır. `AGENTS.md`, `README.md`, `LICENSE`, `.gitignore` və `.env.example` repo kökündə olmalıdır.
3. İlkin tədqiqat dosyesini (`CODE44_AgroRotation_AI (1).pdf`) kontekst kimi istifadə edin; gündəlik icra üçün bu MD faylları əsas götürülür.
4. **Yalnız B** `prompts/00_BOOTSTRAP.md` mətnini öz Antigravity sessiyasına versin. Paralel olaraq **A** `prompts/01_DESIGN_EXPLORATION.md` ilə 3 dizayn variantını hazırlasın; **C** NASA POWER API parametrlərini canlı yoxlasın.
5. Komanda bir dizaynı seçsin. A seçimi `docs/DESIGN_BRIEF.md`-də qeyd etsin. Bu anadək production UI kodu yazılmır; B/C müqavilə və mənbə işi görür.
6. B ilkin skelet və `0.1.0` kontraktını `develop`-a merge edib **`FOUNDATION_READY`** elan etsin. Hamı həmin commitdən öz rol branch-ını yaratsın/sinxronlaşdırsın.
7. Sonra **A → `prompts/02_FRONTEND_START.md`**, **B → `prompts/03_BACKEND_START.md`**, **C → `prompts/04_DATA_START.md`**. Hər kəs yalnız öz promptunu istifadə edir.
8. Hər iş dövrünün sonunda yalnız öz `docs/status/` jurnalınızı yeniləyin. Commit/push paralel ola bilər; `develop` və `main`-ə merge növbə ilə, **B** vasitəsilə olur.
9. İlk işlək bütöv axını mümkün qədər erkən birləşdirin; son saata qədər üç ayrı yarım layihə saxlamayın.

---

### Fayllar nə üçündür?
| Fayl | Vəzifəsi | Owner / Yeniləyən |
|---|---|---|
| `README.md` | Beynəlxalq münsiflər üçün ingilis dilli əsas təqdimat | B |
| `LICENSE` | Proqram kodu və sənədlər üçün MIT Lisenziyası | B |
| `.gitignore` | `.env`, cache, böyük raw fayllar və build qalıqlarını gizlədir | B |
| `.env.example` | Açarsız mühit dəyişənləri şablonu | B |
| `PROJECT_BRIEF.md` | Space Farm-ın məğzi, MVP sərhədi və məhsul vədi | B (komanda qərarı ilə) |
| `PROJECT_PLAN.md` | Arxitektura, qovluq/fayl sahibliyi matrisi və inteqrasiya planı | B |
| `PROJECT_STATE.md` | Hazırkı ortaq vəziyyət, bloklayıcılar, növbəti addımlar | B (hər inteqrasiya dövründə) |
| `ROADMAP.md` | Mərhələlər, tapşırıq ID-ləri, asılılıqlar və qəbul | B |
| `TEAM_RULES.md` | Fayl sahibliyi, rol sərhədi, branch/commit/PR qaydaları | B |
| `AGENTS.md` | Hər Antigravity sessiyasının oxumalı olduğu qısa təlimat | B |
| `docs/TEAM_PLAYBOOK.md` | Bu fayl — komandanın azərbaycanca başlanğıc bələdçisi | B |
| `docs/API_CONTRACT.md` | Frontend ↔ backend ↔ data arasında `v0.1.0` müqaviləsi | B (A/C rəy verir) |
| `docs/DATA_RULES.md` | Real NASA data, keş, keyfiyyət, aqronomik sübut və lisenziya qeydi | C |
| `docs/DESIGN_BRIEF.md` | Görünüş, ekranlar, seçilən dizayn və tokenlər | A |
| `docs/GIT_WORKFLOW.md` | Git əmrləri, PR, növbəli merge və konflikt həlli | B |
| `docs/ACCEPTANCE_TESTS.md` | Demo və texniki qəbul meyarları (`T01`–`T24`) | B (sübut hər rolun jurnalında) |
| `docs/DECISIONS.md` | Komanda qərarlarının (ADR) tarixçəsi | B |
| `docs/SOURCES.md` | İstinadlar, tarixi dosye qeydi və rəsmi NASA/Space Apps mənbələri | B |
| `docs/status/frontend.md` | A-nın canlı iş yaddaşı | A |
| `docs/status/backend.md` | B-nin canlı iş yaddaşı | B |
| `docs/status/data.md` | C-nin canlı iş yaddaşı | C |
| `prompts/` | Bootstrap, dizayn, 3 rol, davam və merge promptları | B |
| `.agents/rules/00-code44.md` | Antigravity üçün qısa workspace qaydası | B |
| `.github/pull_request_template.md` | Pull Request yoxlama şablonu | B |

---

### Gündəlik qayda
**Oxu → öz branch-ını yoxla → kiçik tapşırığı bitir → test et → öz jurnalını yenilə → commit → push → PR → növbəli merge → `develop`-dan yenilən.**

Üç rol öz jurnallarını (`docs/status/*.md`) hər işdə dəyişir; **B** onları inteqrasiya dövründə `PROJECT_STATE.md` və `ROADMAP.md`-də birləşdirir. Git real vaxt ortaq redaktor deyil: başqa kompüterdəki dəyişiklik yalnız `push`/`fetch`/`merge`-dən sonra görünür.

### İstifadə qaydası
Müvafiq `prompts/*.md` faylını açıb prompt hissəsinin tam mətnini Antigravity-yə yapışdırın. Agentdən ilk cavabında öz rolunu (`A`/`B`/`C`), branch-ını, kontrakt versiyasını və icazəli fayl yollarını sadalamasını tələb edin.

Əlavə istinadlar: [Git təlimatı](GIT_WORKFLOW.md) • [Layihə məğzi](../PROJECT_BRIEF.md) • [Komanda qaydaları](../TEAM_RULES.md) • [Əsas README](../README.md)
