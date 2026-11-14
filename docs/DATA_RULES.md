# Data və elmi dürüstlük qaydaları — Space Farm (Team CODE44)
Owner: C • Başlanğıcda real sorğu və dataset bu paketdə yoxdur

## Mənbə prioriteti
MVP bir NASA POWER inteqrasiyası ilə başlayır. C əvvəl rəsmi sənədi və parametr lüğətini oxuyur, sonra bir real request yoxlayır. PDF-də yazılan parametr adı avtomatik işlək sayılmır.

Rəsmi başlanğıc ünvanları:
- https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- https://power.larc.nasa.gov/parameters/
- https://power.larc.nasa.gov/docs/services/api/

Daily Point, AG community, JSON və açıq seçilmiş UTC istifadə ediləcək. Rəsmi Daily sənədi LST default olduğunu bildirir; buna görə time-standard açıq verilir.
Namizəd parametrlər T2M/T2M_MIN/T2M_MAX və **canlı yoxlanacaq yağıntı kodudur**. Bu paket konkret yağıntı kodunu endirilmiş kimi təqdim etmir.

## Real sorğu qəbul sübutu
1. Demo koordinatı və 2024-01-01/2024-12-31 tarixi seçimini qeyd et.
2. Dəqiq sorğu URL-sini və cavab statusunu yaz.
3. Raw JSON-u dəyişməz saxla, SHA-256 hesabla.
4. fetched_at, upstream metadata, parametrlər, vahidlər, zaman standartı və məkan qətnaməsini manifestə yaz.
5. Xəta JSON-u 200 olsa belə “dataset” kimi qəbul etmə; gözlənən tarix açarları və parametrləri yoxla.
6. Real sorğu uğursuzdursa səbəbi göstər; fixture-i NASA məlumatı adlandırma.

## Fayl quruluşu
- `data/raw/<query_hash>.json` — kiçik, təsdiqlənmiş real demo snapshot.
- `data/processed/<query_hash>.json` — çıxarılmış feature-lər.
- `data/processed/<query_hash>.manifest.json` — mənşə və replay.
- `data/catalog/crops.json` — bitki kataloqu.
- `data/catalog/rules.json` — mənbəli/provisional qaydalar.
- `tools/data/` — yükləmə və replay vasitələri.
Böyük datasetlər Git-ə daxil edilmir. Kiçik bir demo snapshot üçün ölçü/redistribution/attribution yoxlanır. Dinamik runtime cache ignored qovluqda saxlanır.

## Manifest minimumu
dataset_id, provider, source_url, request_url, query, retrieved_at,
observation_period, parameters, units, time_standard, spatial_resolution,
raw_file, payload_sha256, pipeline_version, valid_day_counts, missing_day_counts,
quality_flags, redistribution_notes.
Mənbədə versiya yoxdursa uydurulmur; raw hash + tarixlə lokal dataset_version qurulur.

## Məlumat təmizləmə
- Missing sentinel-i metadata və sənədə görə tanı; bütün mənfi dəyərləri silmə. Mənfi temperatur düzgündür.
- Missing yağış 0 yağış deyil.
- Yağıntı vahidini yoxla; günlük rate-dən accumulation-a çevrilmə açıq və testli olsun.
- Tarixləri sort et, dublikat/gap/out-of-range günləri aşkar et.
- Leap year expected_days hesabına daxil edilir.
- Eyni aqreqatda UTC/LST qarışdırılmır.
- Hər feature öz intervalını və coverage_ratio-nu daşıyır.
- İlk mühəndislik siyasəti: coverage 1=complete; 0.95–1 arası partial; <0.95 insufficient. Bu hədd elmi universal qayda deyil, C tərəfindən sənədləşən MVP keyfiyyət seçimidir.
- Natamam yağıntı cəmini tam mövsüm ölçüsü kimi adlandırma; imputation yoxdursa natamam qeyd et.
- Kritik feature insufficient-dirsə sıralamanı blokla və ya needs_data qaytarılmasını B ilə bağla.

## Cache və fallback
Cache açarı: provider, endpoint, dəqiq normallaşdırılmış koordinatlar, tarixlər, sıralanmış parametrlər, community, time_standard və pipeline version.
Grid cell üzrə birləşdirmə yalnız həmin parametrin grid mapping-i təsdiqlənəndə tətbiq edilir. Əks halda yaxın koordinatı başqa sorğu əvəzinə səssiz istifadə etmə.
Timeout və 429/keçici 5xx üçün bounded retry/backoff; 422 üçün təkrar yox. İlkin komanda default-u: 2 əlavə cəhd, ümumi gözləmə büdcəsi 15 saniyə; ölçüyə görə tənzimlənir.
Retry-After varsa büdcəyə uyğun hörmət et; limitsiz sleep yoxdur.
Uyğun real cache varsa cached qaytar, ilkin retrieved_at və age göstər. Sorğu başqa tarix/məkandırsa Gəncə snapshot-ını onun cavabı kimi vermə. İstifadəçiyə açıq demo sahəsinə keçmə seçimi verilə bilər.
Uyğun cache yoxdursa DataUnavailable; saxta fallback yoxdur.

## Bitki qaydaları
PDF-dəki 6 bitki başlanğıc namizəddir. Hər qayda üçün:
rule_id, crop_ids/families, condition, severity, threshold/unit,
region, season/depth applicability, source_url, checked_at, validation_status.
Mənbəsiz pH, mm su tələbi, xəstəlik faizi, AZN gəliri uydurulmur.
Eyni ailənin təkrarı universal “həmişə qadağadır” kimi yazılmır; konkret mənbə və tətbiq sahəsinə görə hard/warning seçilir.
Ekspert yoxlaması olmayıbsa expert_reviewed yazma.
C elmi məzmunu verir, B kodda filtr/skor edir.

## Stress və tarix
Rainfall multiplier 0.9/0.8/0.7 komandanın hipotetik həssaslıq sınağıdır.
Raw NASA seriyası dəyişdirilmir. Transformasiya ayrıca scenario input və method version ilə replay olunur.
Bir illik tarixçədən “iqlim norması” və ya statistik anomaliya çıxarılmır; uzun istinad dövrü yoxdursa belə terminlər deaktivdir.

## Lisenziya və NASA Məlumatlarının İstifadə Şərtləri
- **Kod vs. Data ayrımı:** Space Farm-ın proqram kodu və sənədləri kök `LICENSE` faylında **MIT License** altında yayımlanır, lakin NASA məlumatları bu MIT lisenziyasına daxil deyil.
- **NASA Earth Science / POWER şərtləri:** NASA EOSDIS/ESDS açıq məlumat siyasətinə əsasən məlumatlar açıq istifadəyə verilir (EOSDIS üçün ümumən **CC0**, POWER üçün açıq istifadə / **CC BY 4.0** və istinad qaydaları). Hər mənbə kartında və manifestdə NASA LaRC POWER layihəsi, parametr kodları, sorğu URL-si və `retrieved_at` tarixi göstərilir.
- **Təsdiq qadağası:** NASA məlumatından istifadə NASA-nın rəsmi təsdiqi və ya tərəfdaşlığı kimi təqdim edilmir; rəsmi NASA loqoları icazəsiz istifadə olunmur.

## Canlı mənbə reyestri
| ID | Mənbə | Yoxlama vaxtı | Sorğu/sübut | Status |
|---|---|---|---|---|
| NASA-01 | POWER Daily sənədi & API (`v2.10.3`) | 2026-11-14 | `https://power.larc.nasa.gov/api/temporal/daily/point` (`T2M`, `T2M_MIN`, `T2M_MAX`, `PRECTOTCORR`, `AG`, `UTC`) | VERIFIED |
| NASA-02 | Gəncə 2024 Pilot Snapshot (`40.68° N, 46.36° E`) | 2026-11-14 | `data/raw/552e40e213b9f7b8.json` + `data/processed/552e40e213b9f7b8.manifest.json` (`366/366` gün, `506.52 mm`, `10.58 °C`, SHA-256 `22b70694bb786042a84df2371af88ddca8b0485858b8ce51e20d1cb99474bf44`) | VERIFIED |
| NASA-03 | Aran / Bərdə-Yevlax 2024 Snapshot (`40.38° N, 47.12° E`) | 2026-11-14 | `data/raw/a56184dd09acd946.json` + `data/processed/a56184dd09acd946.manifest.json` (`366/366` gün, `457.50 mm`, `15.70 °C`, SHA-256 `512797f922453b9c8df53738d0d40e06ede038bab41707809da5b3338a4cf1f7`) | VERIFIED |
| NASA-04 | Quba-Xaçmaz 2024 Snapshot (`41.36° N, 48.51° E`) | 2026-11-14 | `data/raw/f850af6ab056dbf6.json` + `data/processed/f850af6ab056dbf6.manifest.json` (`366/366` gün, `516.20 mm`, `15.04 °C`, SHA-256 `a1d90215e046fefd30243a0d1d9a6ead6a3e7beef5ef7e99a6722cf9d0d06dff`) | VERIFIED |
| NASA-05 | Şəki-Zaqatala 2024 Snapshot (`41.19° N, 47.17° E`) | 2026-11-14 | `data/raw/3f72f4396abc697d.json` + `data/processed/3f72f4396abc697d.manifest.json` (`366/366` gün, `588.52 mm`, `15.65 °C`, SHA-256 `76373e22397a21421e4f1e1c842652ff2c70392ab0b56b3bd2520056f392a9f3`) | VERIFIED |
| AGR-01 | Məhsul kataloqu və qaydalar (`crops-0.1.0`, `agronomy-rules-0.1.0`) | 2026-11-14 | `data/catalog/crops.json` (`6` bitki) & `data/catalog/rules.json` (`7` qayda; FAO Paper 56 / CROPWAT əsaslı; lokal ekspert rəyi yoxdur) | PROVISIONAL_SOURCE_SUPPORTED |

## NASA Space Apps Challenge 2026 — Rəsmi Məlumat, Metodologiya və Atribusiya Bəyannaməsi (Judge & Submission Reference)

### 1. Rəsmi NASA Atribusiya Mətni (Submission Form üçün hazır)
- **English (Official NASA Space Apps Submission Form):**
  > *"Meteorological and agroclimatic daily time-series parameters (`T2M`, `T2M_MIN`, `T2M_MAX`, `PRECTOTCORR`) were obtained from the NASA Langley Research Center (LaRC) Prediction Of Worldwide Energy Resources (POWER) Project (`API v2.10.3`, Agroclimatology `AG` Community, `UTC` time standard), funded through the NASA Earth Science/Applied Science Program and derived from NASA GMAO MERRA-2 reanalysis (`0.5° × 0.625°` spatial resolution) and GEWEX SRB/FLASHFlux datasets."*
- **Azərbaycanca (Təqdimat və Münsiflər üçün):**
  > *"Space Farm layihəsində istifadə olunan gündəlik aqroiqlim göstəriciləri (`T2M`, `T2M_MIN`, `T2M_MAX`, `PRECTOTCORR`) NASA Langley Tədqiqat Mərkəzinin (LaRC) POWER (Prediction Of Worldwide Energy Resources) layihəsindən (`API v2.10.3`, `AG` icması, `UTC` zaman standartı) əldə edilmişdir. Məlumatlar NASA GMAO MERRA-2 (`0.5° × 0.625°` məkan qətnaməsi) peyk/reanaliz məhsullarına əsaslanır."*

### 2. İstifadə Olunan NASA POWER Parametrləri və Aqronomik Törəmə Göstəricilər
| Kod / Feature ID | Rəsmi NASA / Törəmə Adı | Vahid | İstifadə Məqsədi |
|---|---|---|---|
| `T2M` → `mean_temperature` | Temperature at 2 Meters (Daily Mean) | `°C` | Mövsümi orta temperatur uyğunluğu (`RULE_TEMP_OPTIMAL_WINDOW`, `soft_penalty`) |
| `T2M_MIN` → `min_temperature`, `frost_days_count` | Temperature at 2 Meters Minimum | `°C`, `day` | Şaxta həssaslığı və `T2M_MIN < 0°C` günlərinin sayı (`RULE_FROST_SENSITIVITY`, `soft_penalty`) |
| `T2M_MAX` → `max_temperature`, `heat_stress_days_count` | Temperature at 2 Meters Maximum | `°C`, `day` | İsti stressi və `T2M_MAX > 35°C` günlərinin sayı (`RULE_HEAT_STRESS_DAYS`, `soft_penalty`) |
| `PRECTOTCORR` → `total_precipitation_mm`, `wet_days_count` | Precipitation Corrected (MERRA-2) | `mm/day` → `mm` | Mövsümi ümumi yağıntı cəmi və `≥ 1.0 mm` yağıntılı günlərin sayı (`RULE_WATER_SUPPLY_MATCH`, `hard_constraint` / `soft_penalty`) |

### 3. Azərbaycan üzrə Doğrulanmış 4 Real NASA POWER Snapshot-ın Müqayisəsi (`2024-01-01` .. `2024-12-31`, `366/366` gün)
| Region | Koordinat (`lat, lon`) | MERRA-2 Hüceyrə Hündürlüyü | Orta `T2M` | Min `T2M_MIN` | Max `T2M_MAX` | İllik `PRECTOTCORR` | Şaxtalı / Yağışlı Gün | Query Hash |
|---|---|---|---|---|---|---|---|---|
| **Gəncə (Pilot sahə)** | `40.68° N, 46.36° E` | `1313.31 m` | `10.58 °C` | `-10.99 °C` | `32.09 °C` | `506.52 mm` | `98` / `108` gün | `552e40e213b9f7b8` |
| **Aran (Bərdə-Yevlax)** | `40.38° N, 47.12° E` | `407.41 m` | `15.70 °C` | `-6.35 °C` | `38.92 °C` | `457.50 mm` | `34` / `95` gün | `a56184dd09acd946` |
| **Quba-Xaçmaz** | `41.36° N, 48.51° E` | `149.23 m` | `15.04 °C` | `-3.66 °C` | `39.27 °C` | `516.20 mm` | `34` / `101` gün | `f850af6ab056dbf6` |
| **Şəki-Zaqatala** | `41.19° N, 47.17° E` | `312.57 m` | `15.65 °C` | `-4.08 °C` | `37.17 °C` | `588.52 mm` | `28` / `111` gün | `3f72f4396abc697d` |

Mənbə təsdiqi və istifadə olunan real nəticələr hər PR-də `docs/status/data.md`-də yazılır.

