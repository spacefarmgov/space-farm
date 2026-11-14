# API və data provider müqaviləsi — Space Farm (Team CODE44)
Owner: B • contract_version: 0.1.0 • Status: DRAFT → B-01 zamanı FROZEN
Bu, komandanın ilkin müqaviləsidir. Kod, OpenAPI və sintetik fixture-lər bootstrap zamanı B tərəfindən bu sənəddən hazırlanır. Sonra maşınla yoxlanan `contracts/openapi.json` və modellər bu sənədlə birlikdə saxlanır. Ziddiyyət varsa səssiz seçim deyil, B-yə CR verilir.

## Ümumi qaydalar
- URL prefix: `/api/v1`; JSON sahələri snake_case.
- JSON tarixləri `YYYY-MM-DD`, faktiki anlar ISO 8601 UTC (`Z`).
- Koordinat: latitude/longitude, EPSG:4326. Array GeoJSON işlənərsə sıra longitude, latitude olur.
- Bütün numeric dəyərlər finite olmalıdır; NaN/Infinity qəbul olunmur.
- Çatışmayan ölçü null və reason ilə verilir; 0 naməlumun əvəzi deyil.
- İcra zamanı yaradılan UUID/request_id elmi hesablamanın deterministic hissəsi deyil.
- Açarsız lokal base URL nümunəsi: `http://localhost:8000`. Deploy URL-ni B müəyyən edir.
- Giriş tarixləri real datasetin mövcudluğu ilə yoxlanır. Bir tarixi il gələcək hava proqnozu sayılmır.

## Endpointlər
| Method və yol | Owner | Input | Output |
|---|---|---|---|
| GET /api/v1/health | B | — | status, contract_version, model_version |
| GET /api/v1/crops | B; data C-dən | — | catalog_version, crops |
| GET /api/v1/climate/features | B; provider C-dən | latitude, longitude, start_date, end_date | ClimateBundle |
| POST /api/v1/simulations | B | SimulationRequest | SimulationResponse |

A ilkin `GET climate/features` ilə mənbə panelini aça bilər; POST backend-də eyni data query-ni yenidən istifadə edir. Frontend climate skorunu özü hesablamır. Ayrı stress endpoint yoxdur: eyni POST dəyişdirilmiş scenario ilə təkrarlanır.

## SimulationRequest
Aşağıdakı giriş **sintetik demo sahədir**, real fermer məlumatı deyil.
```json
{
  "contract_version": "0.1.0",
  "farm": {
    "farm_id": "ganja-demo",
    "label": "Ganja demo field",
    "is_demo": true,
    "location": {"latitude": 40.68, "longitude": 46.36, "crs": "EPSG:4326"},
    "area_ha": 10,
    "irrigation_type": "rainfed",
    "irrigation_budget_mm_per_season": null,
    "soil": {
      "ph": null,
      "texture": "unknown",
      "source_type": "unknown",
      "sample_date": null,
      "depth_cm": null,
      "source_ref": null
    },
    "crop_history": []
  },
  "climate_period": {"start_date": "2024-01-01", "end_date": "2024-12-31"},
  "horizon_years": 3,
  "preferences": {"water": 0.5, "soil": 0.3, "income": 0.2},
  "scenario": {"kind": "baseline", "rainfall_multiplier": 1.0},
  "max_plans": 3
}
```

## Validation
| Sahə | Qayda |
|---|---|
| latitude / longitude | [-90,90] / [-180,180] |
| area_ha | >0; MVP limiti B-01-də testlə təyin edilir |
| horizon_years | Yalnız 3 |
| max_plans | 1–3 tam ədəd |
| irrigation_type | rainfed / irrigated / unknown |
| irrigation_budget_mm_per_season | null və ya ≥0; hektara görə total həcm deyil |
| soil.ph | null və ya 0–14; bu texniki hədddir, bitki uyğunluğu deyil |
| soil.texture | unknown / sand / loam / clay / other |
| soil.source_type | laboratory / user_reported / modeled / unknown |
| depth_cm | null və ya {top:number,bottom:number}; 0≤top<bottom |
| source_ref | null və ya qaynaq/təhlil identifikatoru; modeled/laboratory üçün boş olmamalıdır |
| crop_history | {year:int,crop_id:string} siyahısı; catalog ID-ləri |
| preferences | Hər biri [0,1], cəm 1±0.000001, hamısı 0 ola bilməz |
| scenario.kind | baseline / rainfall_stress |
| rainfall_multiplier | baseline üçün 1; rainfall_stress üçün 0.7/0.8/0.9 |
| climate_period | start≤end; v0.1 üçün bir təqvim ili daxilində; çoxillik sonrakı CR |
| unknown soil | null saxlanır; ph=7 kimi gizli default yoxdur |

Frontend çəkiləri normallaşdıra bilər; backend yenə təsdiqləyir. Üçillik plan il indeksləri ilə göstərilir: 1,2,3. 2024 tarixi iqlimindən üç ilin dəqiq proqnozu çıxarılmır.

## ClimateBundle
B-01 aşağıdakı sahələri modelləşdirir:
- `contract_version`: string.
- `query`: latitude, longitude, start_date, end_date, time_standard.
- `data_mode`: live / cached / demo_fixture. Production public endpoint demo_fixture rejiminə özbaşına keçmir.
- `dataset_version`: C-nin content hash/manifest əsasında verdiyi identifikator.
- `features`: ClimateFeature list.
- `sources`: SourceRecord list.
- `quality`: complete / partial / insufficient.
- `warnings`: string list.

### ClimateFeature
| Sahə | Tip / məna |
|---|---|
| feature_id | Sabit string, məsələn mean_temperature |
| value | number və ya null |
| unit | C, mm, day və s.; sənədləşdirilmiş vahid |
| period_start / period_end | ISO tarix; faktiki aqreqasiya pəncərəsi |
| aggregation | mean / sum / count |
| source_ids | SourceRecord.id siyahısı |
| parameter_codes | İstifadə olunan real upstream kodları |
| coverage_ratio | 0–1; valid_days/expected_days |
| valid_days / expected_days | tam ədəd; leap year nəzərə alınır |
| quality_flags | string list |
| reason | null və ya çatışmazlığın qısa kodu |
| method_version | Hesablama qaydasının versiyası |

MVP minimum feature-lər: orta temperatur və period yağıntı cəmi; əkin pəncərələri təsdiqləndikdə seasonal xüsusiyyətlər. “Hot days” yalnız hədd və mənbəsi varsa. İllik göstərici mövsümi göstərici kimi adlandırılmır.

### SourceRecord
`id, provider, dataset, source_url, request_url, retrieved_at, observation_start,
observation_end, time_standard, parameter_codes, units, spatial_resolution,
payload_sha256, source_kind`.
`spatial_resolution` hər parametrə görə string xəritəsidir; metadata tapılmayıbsa “unknown”, uydurulmur.
`source_kind` upstream_dataset / user_input / agronomic_reference.
Gizli credential varsa request_url sanitizasiya edilir.
`retrieved_at` ilkin endirmə anıdır; cache oxunuşunda saxta “indi” edilmir.

## SimulationResponse
Bütün uğurlu hesablama cavabları:
- `contract_version, request_id, simulation_id, created_at`.
- `model_version, rules_version, catalog_version, dataset_version`.
- `status`: completed / provisional / needs_data / no_feasible_plan.
- `data_mode`: live / cached / demo_fixture; production demo_fixture qaytarmır.
- `input_summary`: farm_id, climate_period, horizon_years, scenario.
- `weights_requested` və `weights_effective`: water/soil/income obyektləri.
- `unavailable_objectives`: [{objective, reason}].
- `plans`: 0–3 RotationPlan.
- `climate`: ClimateBundle.
- `warnings`, `rejected_summary` və `limitations`.

### RotationPlan
`plan_id, years, score, score_components, explanations, constraints_checked,
uncertainty, scenario_label`.

- `years`: tam 3 element; hər biri {year_index:1|2|3, crop_id, crop_name, planting_window, harvest_window}. Məhsul təqvimi məlum deyilsə window null, izah görünür.
- `score`: [0,100] nisbi uyğunluq skoru və ya null. Faiz gəlir/məhsuldarlıq deyil.
- `score_components`: water/soil/income, hər biri {value:number|null, reason, source_ids, rule_ids}; value [0,1].
- `explanations`: [{code,text,feature_ids,rule_ids,source_ids}].
- `constraints_checked`: [{rule_id,result:"pass"|"unknown",reason}]. Fail olan plan çıxışa girmir.
- `uncertainty`: low / medium / high; heç biri ekspert sertifikatı deyil.
- `scenario_label`: baseline / hypothetical_rainfall_stress.

### Çatışmayan gəlir və unknown qaydası
Gəlir üçün yoxlanmış qiymət/xərc/gəlir modeli yoxdursa income component=null, həmin məqsəd unavailable olur.
Qalan məlum ölçülərin çəkiləri normallaşdırılır və warnings-də izah verilir.
Aktiv ölçülərin ilkin çəkilərinin cəmi 0-dırsa status=needs_data, plans=[]; bölmə-by-zero və özbaşına yeni üstünlük yoxdur.
Sərt məhdudiyyət üçün zəruri data unknown-dursa həmin yoxlama pass sayılmır. Tədqiqat variantı göstərilərsə status=provisional, uncertainty=high və açıq unknown izahı olur; təhlükəsiz plan kimi təqdim edilmir. Etibarlı sıralama mümkün deyilsə needs_data.
No-feasible nəticədə HTTP 200, plans=[], status=no_feasible_plan və məhdudiyyət səbəbləri.

## Səhv formatı
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "preferences must sum to 1",
    "details": [{"field": "preferences", "reason": "sum_mismatch"}],
    "retryable": false,
    "request_id": "generated-at-runtime"
  }
}
```
422: yanlış giriş. 503: lazım olan data yoxdur və uyğun real cache yoxdur. 500: daxili gözlənilməz xəta, gizli stacktrace göstərilmir.
Upstream 429 C tərəfindən limitli retry edilir; sonda uyğun cache və ya DataUnavailable. Public API rate-limit tətbiq olunarsa 429 və retry_after B-01-də ayrıca sənədləşdirilir.
FastAPI default validation error formatı da B-nin handler-i ilə yuxarıdakı envelope-a uyğunlaşdırılır.

## C → B Python interface
B-01 zamanı B shared modelləri yaradır; C bu modelləri import edir.
```python
async def get_climate_features(query: ClimateQuery) -> ClimateBundle: ...
def get_crop_catalog() -> CropCatalog: ...
```
Yer: `services/api/app/data_adapters/provider.py`.
- ClimateQuery: latitude, longitude, start_date, end_date, time_standard="UTC".
- CropCatalog: catalog_version, rules_version, crops.
- Hər crop: crop_id, name, family, season_windows, soil_ph_range, water_band_mm, predecessor_rules, objective_inputs, references, validation_status.
- Qayda hədləri nullable; null “təsdiqlənmiş uyğunluq” deyil.
- validation_status: source_supported / expert_reviewed / provisional.
- Provider domain xətaları: InvalidDataQuery, DataUnavailable, DataQualityError.
- B bu xətaları HTTP statuslarına çevirir; C provider-də HTTPException import etmir.
- Data adapter route/engine import etmir; route data adapteri import edə bilər.
- Dinamik cache lokalda, yoxlanmış kiçik demo snapshot repoda; eyni query açarı üzrə.
- C dependency ehtiyacını bildirir, B Python manifest/lock-u yeniləyir.

## B-01 fixture dəsti
B maşınla schema yoxlaması üçün sintetik `contracts/fixtures/` fayllarını yaradır:
completed, provisional_unknown_soil, needs_data, no_feasible_plan, cached_response, validation_error.
Fixture-lərdə data_mode=demo_fixture, saxta NASA fetched_at/source sübutu yoxdur. Cached_response yalnız cache UI vəziyyətini yoxlayan **sintetik testdir**, həqiqi endirmə deyil; fixture metadata-sında synthetic=true göstərilir.
Real snapshot-lar C-nin `data/` qovluğundadır, contract fixture ilə qarışdırılmır.

## Breaking change protokolu
Endpoint, enum, sahə adı/tip/vahid dəyişikliyi CR tələb edir. B müqavilə versiyasını artırır, dəyişiklik cədvəlini yazır, A/C istehlakını planlaşdırır. Hackathon ərzində mümkün olduqca yalnız geriyə uyğun optional əlavə seçilir.

