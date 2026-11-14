# Git və inteqrasiya təlimatı — Space Farm (Team CODE44)
Owner: B • Əmrlər Git Bash / PowerShell / CMD-də işlədilə bilər
Hədəf ictimai GitHub deposu: `https://github.com/spacefarmgov/space-farm.git` (`space-farm`).

## 1. Branch modeli
| Branch | Məna | Kim dəyişir? |
|---|---|---|
| main | Demo üçün sabit ictimai buraxılış | B, `develop → main` PR ilə |
| develop | İnteqrasiya olunan iş | B, rol PR-lərini növbə ilə merge edərək |
| feat/frontend-ui | A-nın UI işi | Yalnız A |
| feat/backend-core | B-nin backend işi | Yalnız B |
| feat/data-api | C-nin data işi | Yalnız C |

Bu modeldə rol branch-ları uzunömürlüdür. **Create a merge commit** üsulu istifadə olunur; squash/rebase seçilmir. Bu, `develop`-ı rol branch-larına geri birləşdirərkən eyni dəyişikliklərin tarixçəsini qoruyur.
`main` və `develop` üçün repo ayarlarında PR review, status check və force-push qadağası qurun. İctimai repoda yazma/admin icazəsini yalnız təsdiqlənmiş CODE44 komanda üzvlərinə verin (`CODEOWNERS` və MD faylı təkbaşına branch protection deyil).

## 2. İlk hazırlıq — yalnız B
Repo hələ boşdursa və ya lokaldan başlanırsa:
```bash
git clone https://github.com/spacefarmgov/space-farm.git
cd space-farm
git status
```
Hazırlıq fayllarını repo kökündə yoxlayın. Yalnız tam yeni boş repo üçün:
```bash
git switch -c main
git add README.md LICENSE .gitignore .env.example AGENTS.md PROJECT_BRIEF.md PROJECT_PLAN.md PROJECT_STATE.md ROADMAP.md TEAM_RULES.md docs prompts .agents .github
git diff --cached --stat
git commit -m "docs: add CODE44 Space Farm collaboration plan"
git push -u origin main
git switch -c develop
git push -u origin develop
git switch -c feat/backend-core
git push -u origin feat/backend-core
```
Əgər `main` artıq varsa `git switch -c main` ETMƏYİN; `git switch main` və `git pull --ff-only origin main` istifadə edin. `develop`/rol branch-ı varsa da yeni yaratmaq əvəzinə mövcuduna keçin. Mövcud kod bazasına bu ilkin əmrlər kor-koranə tətbiq edilmir.

B bootstrap-ı öz branch-ında hazırlayıb PR açır: `base=develop`, `compare=feat/backend-core`. Komanda ilkin müqaviləni yoxlayır; merge commit ilə birləşir. B `FOUNDATION_READY` commitini paylaşır.

## 3. A və C-nin başlanğıcı
Hər biri öz kompüterində:
```bash
git clone https://github.com/spacefarmgov/space-farm.git
cd space-farm
git fetch origin
git switch -c feat/frontend-ui origin/develop
git push -u origin feat/frontend-ui
```
Yuxarıdakı A üçündür. C `feat/frontend-ui` yerinə `feat/data-api` yazır. Mövcud remote branch varsa:
```bash
git switch --track origin/feat/frontend-ui
```
Eyni branch-ı iki nəfər istifadə etmir. Repo kökü Antigravity-də workspace kimi açılır.

## 4. Hər iş dövrünün başlanğıcı
```bash
git branch --show-current
git status --short
git fetch origin
```
Working tree təmizdirsə öz rol branch-ında:
```bash
git merge origin/develop
```
Working tree dirty-dirsə əvvəl öz işinizi mənalı commitlə qoruyun; başqasının tanımadığınız dəyişikliklərini stage etməyin. Uncommitted dəyişikliklə merge etməyin.

## 5. İş bitəndə — A nümunəsi
```bash
git diff --stat
git diff
git add apps/web docs/DESIGN_BRIEF.md docs/status/frontend.md
git diff --cached --stat
git commit -m "feat(web): add rotation comparison flow"
git push origin feat/frontend-ui
```
Yeni `docs/design/` assetləri varsa onları ayrıca add edin.
B/C də yalnız öz mövcud yollarını add edir. `git add .` kor-koranə istifadə edilmir.
Test nəticəsini commitdən əvvəl jurnalınıza yazın. Öz commit hash-ını eyni commitin daxilinə yazmağa çalışmayın; “bu PR-dəki dəyişikliklər” deyin və ya əvvəlki sabit SHA-ya istinad edin.

## 6. Pull request
GitHub-da base=develop, compare=öz branch-ınız.
PR: task ID, dəyişən yollar, kontrakt versiyası, test əmri/nəticəsi, blocker, UI screenshot və ya data manifesti.
READY_FOR_REVIEW sözünü yazmaq testin yerini tutmur.
PR açıq ikən həmin branch-a əlavə push PR məzmununu dəyişir. B baxmağa başlayanda scope-u dondurun. B merge-dən əvvəl son SHA-nı yenidən yoxlayır.

## 7. Növbəli merge
Növbə GitHub issue/PR şərhlərində B tərəfindən idarə olunur; branch daxilində `LOCK.md` yaratmaq paylanmış kilid deyil.
1. B ən köhnə hazır/asılılığı açılmış PR-ni seçir və “reviewing” qeyd edir.
2. Müəllif develop-ı branch-a merge edib testləri yenidən işlədir, push edir.
3. B changed-files ownership, schema və son source SHA-nı yoxlayır.
4. Başqa rol uyğun sahə review-u edir; B-nin PR-ini A/C nəzərdən keçirir.
5. Checklər keçirsə **Create a merge commit** ilə develop-a merge olunur.
6. Eyni anda ikinci merge başlamır. B bütöv axının uyğun smoke yoxlamasını edir.
7. B ortaq state/roadmap yeniləməsini backend branch-ında hazırlayıb kiçik docs PR ilə develop-a birləşdirir; növbəti rol merge-i bundan sonra açılır.
8. Hamı `git fetch origin` və öz branch-ında `git merge origin/develop` edir.

Başlanğıc asılılıq sırası: B foundation → C data/provider/catalog → B engine inteqrasiyası → A real API qoşulması. Müstəqil hazır UI shell daha əvvəl merge oluna bilər. Sabit “həmişə A sonra B sonra C” məcburiyyəti yoxdur.

## 8. Konflikt olduqda
```bash
git status
git diff --name-only --diff-filter=U
```
- Həmin faylın owner-ini müəyyən edin.
- İki tərəfin dəyişiklik niyyətini oxuyun; bütün fayla “ours” və ya “theirs” vurmayın.
- Owner ilə düzgün məzmunu saxlayın, markerləri silin, test edin.
- Yalnız həll edilmiş yolları stage edin:
```bash
git add PATH_TO_RESOLVED_FILE
git commit
```
PATH_TO_RESOLVED_FILE yerinə real yolu yazın.
Merge-i təhlükəsiz dayandırmaq lazımdırsa, merge-dən əvvəl ağac təmiz olduğu halda:
```bash
git merge --abort
```
Bu da alınmırsa reset --hard istifadə etməyin; statusu və işi saxlayıb B-yə bildirin. Dirty tree ilə başlanmış merge-də abort hər şeyi bərpa etməyə bilər.

## 9. Səhv merge və release
Səhv merge develop-dadırsa B yeni düzəliş PR-i və ya tarixçəni qoruyan revert PR-i hazırlayır. Ortaq branch-ın tarixini zorla geri yazmır.
Demo üçün develop → main PR açılır, qəbul testləri yoxlanır, merge commit seçilir. Sonra rol branch-ları develop-dan yenilənir.
Deploy və main release komandanın faktiki icazə/səlahiyyətinə uyğun edilir; bu paket deploy etməyib.

## 10. Niyə növbə ilə push lazım deyil?
A/B/C ayrı branch-a push edəndə bir-birinin branch-ını əvəz etmir. Konflikt əsasən dəyişiklikləri birləşdirərkən çıxır. Ona görə **paralel kod/commit/push, növbəli review/merge** istifadə olunur. İstəsəniz push da növbəli ola bilər, amma bu özü konflikt həlli deyil.

Rəsmi istinad: https://git-scm.com/docs/git-merge

