# Qərar jurnalı
Owner: B • Yeni qərarlar əvvəlkin silmədən əlavə edilir

| ID | Tarix | Qərar | Səbəb | Status |
|---|---|---|---|---|
| ADR-001 | 2026-11-14 | A frontend, B backend/inteqrasiya, C xarici API/data | Paralel iş və aydın fayl sahibliyi | ACCEPTED |
| ADR-002 | 2026-11-14 | main + develop + üç rol branch-ı | Sabit demo və paralel iş | ACCEPTED |
| ADR-003 | 2026-11-14 | Hər rol öz jurnalını, B ortaq state-i yeniləyir | Ortaq MD konfliktini azaltmaq | ACCEPTED |
| ADR-004 | 2026-11-14 | React/Vite/TS + FastAPI, JSON snapshot | Sadə, deterministik və test edilə bilən MVP | ACCEPTED |
| ADR-005 | 2026-11-14 | Dizayn seçimi production UI-dən əvvəl | A-nın UI işi üçün aydın əsas | ACCEPTED |
| ADR-006 | 2026-11-14 | İlk mərhələdə POWER, SMAP/HLS sonrakı | MVP scope sərhədi | ACCEPTED |
| ADR-007 | 2026-11-14 | Gəlir data-sı yoxdursa unavailable + effektiv çəkilər | Saxta maliyyə nəticəsi verməmək | ACCEPTED |
| ADR-008 | 2026-11-14 | Uzunömürlü rol branch-ları üçün merge commit | Geri sync və ancestry-ni qorumaq | ACCEPTED |
| ADR-009 | 2026-11-14 | Layihə kimliyini **Space Farm** (`space-farm`), komanda adını **CODE44** kimi vahidləşdirmək; tarixi PDF istinadlarını `docs/SOURCES.md`-də qorumaq | GitHub və NASA Space Apps Challenge təqdimatında aydınlıq | ACCEPTED |
| ADR-010 | 2026-11-14 | Kod və sənədlər üçün **MIT License**, NASA Open Data/POWER şərtlərini ayrı izah etmək, `.gitignore` və `.env.example` əlavə etmək | İctimai repo uyğunluğu və gizli açar təhlükəsizliyi | ACCEPTED |
| ADR-011 | 2026-11-14 | GitHub Actions CI şablonunu `infra/ci/github-actions-ci.yml` yolunda saxlamaq | Aktiv `gh` OAuth tokenində `workflow` scope-u olmadan `.github/workflows/` push-u GitHub tərəfindən bloklanır; şablon qorunub | ACCEPTED |

## Yeni qərar şablonu
- ID / vaxt / qərar sahibi:
- Problem:
- Seçilən yol:
- Nəzən keçirilən alternativ:
- Hansı fayl/endpoint/rola təsir edir:
- Keçid planı:
- Sübut və test:
- Status: PROPOSED / ACCEPTED / SUPERSEDED.
- Əvəz etdiyi qərar ID-si:

Dizayn tokenlərinin detalları A-nın DESIGN_BRIEF.md faylında saxlanır. Scope/kontrakt dəyişməsi bu jurnala daxil olur.
