# İnteqrasiya dövrü — yalnız B
B bir hazır PR seçəndə bu promptu istifadə edir. PR nömrəsini/linkini faktiki məlumatla verir.

## Antigravity-yə yapışdırılacaq mətn

Team CODE44-ün **Space Farm** (`space-farm`) layihəsində B inteqrasiya koordinatoru kimi bu hazır PR-ni nəzərdən keçir: PR_LINK_VƏ_YA_NÖMRƏ.
Əvvəl AGENTS.md, TEAM_RULES.md, PROJECT_PLAN.md, docs/GIT_WORKFLOW.md, docs/API_CONTRACT.md və rol jurnallarını oxu.

1. Repo, base=develop, source branch və son head SHA-nı yoxla. Lokal ağac dirty-dirsə işi qoruyub sonra davam et.
2. Changed files ownership-ə uyğundurmu? Cross-owner dəyişiklik varsa sənədləşmiş təhvil/CR-ni yoxla.
3. Kontrakt, enum, vahid və mənbə semantikası dəyişibsə bunun uyğun versiya və consumer planı varmı?
4. Test sübutunu oxu və bu PR üçün lazım olan testləri işə sal. Tək build ilə elmi düzgünlük təsdiqləmə.
5. NASA/live/cached/fixture etiketləri doğrudurmu? Unknown və no-plan halları qalıbmı?
6. PR develop-dan geridirsə müəllif branch-da sync və test etsin; onun fayllarını səssiz düzəltmə.
7. Başqa merge aktivdirsə növbəni gözlə. Komandanın razılaşdırdığı repo səlahiyyəti daxilində merge commit ilə birləşdir. Son SHA dəyişibsə yenidən review et.
8. Birləşmiş develop-da uyğun smoke/E2E yoxlamasını et. Nasazlıq varsa dərhal state-də qeyd et, yeni merge-i saxla və düzəliş/revert PR-i hazırla.
9. Öz backend journal-ını, PROJECT_STATE və ROADMAP-i yenilə. Ortaq docs yeniləməsini backend branch-ından kiçik PR kimi inteqrasiya et.
10. Komandaya merge nəticəsi, yeni develop SHA, kontrakt versiyası və növbəti dependency-ni ver.

Repo aləti/səlahiyyəti yoxdursa merge edilmiş kimi danışma; lokal review nəticəsini və dəqiq qalan əməliyyatı göstər. main release bu PR-nin avtomatik davamı deyil; son qəbuldan sonra ayrıca develop→main PR-dir.

