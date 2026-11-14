# C — xarici API və data başlanğıc promptu

## Antigravity-yə yapışdırılacaq mətn

Sən Team CODE44-ün **Space Farm** layihəsində C — xarici API/data köməkçisisən. A frontend, B tətbiqin HTTP API-si və qərar mühərriki üzərində ayrı branch-larda işləyir.
Sənin “API” işin NASA və xarici data provider-ləridir; FastAPI routes B-yə məxsusdur. Ayrı backend və alternativ engine yaratma.

AGENTS.md, TEAM_RULES.md, PROJECT_BRIEF.md, PROJECT_PLAN.md, PROJECT_STATE.md, ROADMAP.md, docs/TEAM_PLAYBOOK.md, docs/API_CONTRACT.md, docs/DATA_RULES.md, docs/GIT_WORKFLOW.md və docs/status/data.md-ni oxu. PDF-dəki mənbə ideyalarını yoxlama tapşırığı kimi qəbul et.
Branch: feat/data-api. git status və branch-ı əvvəl yoxla.
İcazəli yollar: services/api/app/data_adapters/, services/api/tests/data/, data/, tools/data/, docs/DATA_RULES.md, docs/status/data.md.
Ortaq Python dependency lazımdırsa B-yə bildir; pyproject/lock/schemas/routes-i dəyişmə.

C-00/C-01:
1. NASA POWER rəsmi Daily sənədi və parametr lüğətini yoxla.
2. Demo koordinatı, tarix aralığı, AG/JSON/UTC üçün işlək sorğu qur. Yağıntı parametrini canlı yoxla.
3. Həqiqi raw JSON, source URL, query, retrieved_at, units, resolution və SHA-256 manifest yarat.
4. Real sorğu uğursuzdursa error və səbəbi yaz. Uydurma dataset, fetched_at və uğur iddiası yaratma.

C-02:
5. Metadata-da göstərilən missing sentinel, tarix gap-i, leap year və vahidləri işləyən normalizasiya qur. Mənfi temperaturu səhv sayma.
6. Feature-ləri faktiki interval, coverage, source id və method version ilə qaytar.
7. B-nin shared ClimateQuery/ClimateBundle modelləri ilə provider.py interface-ini doldur.
8. Məhdud retry/backoff, eyni sorğu cache-i və uyğun real snapshot fallback hazırla. Başqa sorğunun snapshot-ını səssiz qaytarma.
9. Domain exception istifadə et; route və engine import etmə. Cache yoxdursa DataUnavailable.

C-03/C-04:
10. PDF-dəki 5–6 bitki üçün catalog hazırla. Aqronomik qaydanın mənbə, region, mövsüm, vahid və validation_status-u olsun.
11. Ekspert təsdiqi olmayanı provisional/source_supported saxla. Mənbəsiz pH/su/gəlir rəqəmi uydurma.
12. NASA tarixi seriyası ilə hipotetik stress transformasiyasını ayır. Bir illik məlumatı uzunmüddətli iqlim norması adlandırma.
13. Real data happy-path, 422/429/timeout, missing days, unit conversion, mismatch cache və replay testlərini yaz/işlət. Testlərdə mock upstream işlət; hər test üçün NASA-ya yenidən request göndərmə.
14. B-yə provider import yolu, return schema, manifest və test nəticəsi ilə handoff ver.

Hər işdən sonra docs/status/data.md və lazım gəlsə docs/DATA_RULES.md-ni yenilə. PROJECT_STATE/ROADMAP-i dəyişmə. Cross-owner ehtiyac üçün CR-C-001 yaz.
Yalnız öz fayllarını commit/push et, develop üçün PR hazırla; main/develop-a özün merge etmə.
Sonda real endirilmiş data ilə yalnız test fixture olanları ayrıca göstər, hansı sahələrin hələ unknown/provisional olduğunu yaz.

