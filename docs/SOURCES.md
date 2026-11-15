# Mənbələr və yoxlama sərhədi — Space Farm (Team CODE44)
Yenilənmə: 14.11.2026

## İstifadəçinin tarixi tədqiqat sənədi
`CODE44_AgroRotation_AI (1)(1).pdf` (128 səhifə; lokal arxivdə `CODE44_AgroRotation_AI (1).pdf` / `CODE44_AgroRotation_AI.pdf`).
İstifadə edilən əsas hissələr: s.3/6 məhsul və scope; s.22–33 UX/POWER; s.46–59 qaydalar, engine, stress, provenance; s.62–73 arxitektura/API/frontend; s.110–124 icra və qəbul.
Qeyd: Həmin tarixi tədqiqat sənədində layihə ilkin olaraq *AgroRotation Intelligence* işçi adı ilə qeyd olunmuşdur; ictimai GitHub və Space Apps təqdimatı üçün layihə adı **Space Farm** (`space-farm`) kimi vahidləşdirilmişdir. PDF-nin özü “real API sorğusu icra etmədiyini” bildirir. Bu paket də real data yükləndiyini iddia etmir.

## Yoxlanmış texniki və yarış sənədləri
1. NASA Space Apps Challenge 2026 — *Field Shift: Adapting Farms with NASA Data*: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/
2. NASA POWER Daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
3. NASA POWER API Overview & Parameters: https://power.larc.nasa.gov/docs/services/api/ • https://power.larc.nasa.gov/parameters/
4. NASA Earth Science Open Data Policy & Attribution: NASA ESDS/EOSDIS açıq məlumat siyasəti (EOSDIS üçün CC0; POWER üçün açıq istifadə / CC BY 4.0 istinad tələbləri; NASA tərəfdaşlığı/təsdiqi iddiası olmadan).
5. Google Antigravity Rules: https://antigravity.google/docs/rules/ • https://antigravity.google/docs/ide/rules
6. Git merge: https://git-scm.com/docs/git-merge

Antigravity rəsmi sənədində workspace named rule faylları üçün `.agents/rules/` və `trigger: always_on` göstərilir. Paket qısa giriş qaydasını həmin formatda verir. Müxtəlif IDE versiyasında aktivləşməni yoxlayın; rol promptları AGENTS.md-ni ayrıca oxutdurur.
Git sənədi merge və abort davranışını izah edir; merge-dən əvvəl təmiz working tree qaydası buna görə verilir.
NASA Daily sənədi point request və zaman standartını əsaslandırır; rəsmi default LST-dir, bu layihə UTC-ni açıq seçir.

## Bu paketdə hələ təsdiq edilməyənlər / açıq qalanlar
- Yarışın son local event deadline vaxtı və təşkilatçının əlavə AI/branding qaydaları (`R-01`).
- Konkret NASA POWER sorğusunun uğuru və yağıntı parametrinin seçilmiş tarix/region üzrə canlı cavabı (`C-00`/`C-01`).
- `spacefarmgov/space-farm` reposunda tətbiq kodunun (`apps/web`, `services/api`) yazılması və deploy linki.
- Aqronomik hədlər, fermer qazancı, sahə validasiyası (`AGR-01` hələ `NOT_VERIFIED`).
B/C bunları öz tapşırıqlarında ayrıca sübutla bağlayır.

## Komanda qərarı olanlar
Branch adları, owner matrisi, stack default-u, kontrakt v0.1, coverage həddi, retry büdcəsi və nisbi sprint saatları bu paket üçün hazırlanmış mühəndislik qərarlarıdır; NASA/Git/Google tərəfindən tələb olunan layihə arxitekturası deyil.

