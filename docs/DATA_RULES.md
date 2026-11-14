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
| NASA-02 | Demo raw JSON (Gəncə 2024) | 2026-11-14 | `data/raw/552e40e213b9f7b8.json` + `data/processed/552e40e213b9f7b8.manifest.json` (`366/366` gün, SHA-256 `22b70694bb786042a84df2371af88ddca8b0485858b8ce51e20d1cb99474bf44`) | VERIFIED |
| AGR-01 | Məhsul kataloqu və qaydalar | 2026-11-14 | `data/catalog/crops.json` & `data/catalog/rules.json` (FAO Paper 56 / CROPWAT əsaslı; lokal ekspert rəyi yoxdur) | PROVISIONAL_SOURCE_SUPPORTED |

Mənbə təsdiqi və istifadə olunan real nəticələr hər PR-də `docs/status/data.md`-də yazılır.

