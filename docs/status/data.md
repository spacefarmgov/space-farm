# C — data canlı iş jurnalı (Space Farm • Team CODE44)
Owner: yalnız C • Branch: feat/data-api
Son yenilənmə: 14.11.2026 (Asia/Baku)
Kontrakt versiyası: 0.1.0 FROZEN

## Cari vəziyyət
Status: VERIFIED (`C-00..C-04` tamamlandı — NASA POWER client, normalizasiya pipeline-ı, exact-match cache, Azərbaycan üzrə 4 real 2024 regional snapshot, FAO-əsaslı 6 bitki kataloqu / 7 qayda və müstəqil data/kontrakt auditi tam təsdiqləndi)

## Son tamamlanan iş
- `services/api/app/data_adapters/`: `exceptions.py`, `nasa_power.py`, `pipeline.py`, `cache.py`, `catalog.py`, `provider.py`.
- `tools/data/fetch_power.py`: Azərbaycanın 4 əsas kənd təsərrüfatı zonası üzrə **real NASA POWER Daily Point (`v2.10.3`, `AG`, `UTC`, `2024-01-01..2024-12-31`, `366/366` gün)** snapshot-ları endirildi və manifestlərlə bağlandı:
  1. **Gəncə (Pilot sahə — `40.68, 46.36`)**: `query_hash=552e40e213b9f7b8`, `SHA-256=22b70694bb786042a84df2371af88ddca8b0485858b8ce51e20d1cb99474bf44`, `T2M=10.58 °C`, `PRECTOTCORR=506.52 mm`.
  2. **Aran / Bərdə-Yevlax (`40.38, 47.12`)**: `query_hash=a56184dd09acd946`, `SHA-256=512797f922453b9c8df53738d0d40e06ede038bab41707809da5b3338a4cf1f7`, `T2M=15.70 °C`, `PRECTOTCORR=457.50 mm`.
  3. **Quba-Xaçmaz (`41.36, 48.51`)**: `query_hash=f850af6ab056dbf6`, `SHA-256=a1d90215e046fefd30243a0d1d9a6ead6a3e7beef5ef7e99a6722cf9d0d06dff`, `T2M=15.04 °C`, `PRECTOTCORR=516.20 mm`.
  4. **Şəki-Zaqatala (`41.19, 47.17`)**: `query_hash=3f72f4396abc697d`, `SHA-256=76373e22397a21421e4f1e1c842652ff2c70392ab0b56b3bd2520056f392a9f3`, `T2M=15.65 °C`, `PRECTOTCORR=588.52 mm`.
- `tools/data/audit_data.py` (`C-04`): 4 real snapshot üzrə raw SHA-256, deterministik feature replay, 6 bitki kataloqu (`crops.json`), 7 aqronomik qayda (`rules.json`), OpenAPI sxemləri və 6 sintetik fixture auditi `PASS` etdi.
- `docs/DATA_RULES.md`: NASA Space Apps Challenge 2026 üçün rəsmi məlumat, metodologiya və atribusiya bəyannaməsi (`NASA-01..NASA-05`, `AGR-01`) əlavə olundu.

## Test sübutu
| Vaxt | Task | Əmr / addım | Nəticə | Sübut yolu |
|---|---|---|---|---|
| 2026-11-14 | C-00..C-04 | `python -m unittest discover -s services/api/tests/data -t services/api -v` | PASS (`10/10`, T01-T08, T23, C04) | `services/api/tests/data/test_power_adapter.py` |
| 2026-11-14 | C-04 | `python tools/data/audit_data.py` | PASS (`4/4` snapshot, `6` bitki, `7` qayda, `6` fixture) | `tools/data/audit_data.py` |
| 2026-11-14 | E2E / API | `python -m unittest discover -s services/api/tests -t services/api -v` | PASS (`25/25`) | `services/api/tests/` |
| 2026-11-14 | Live E2E | `python -m unittest tests/e2e/verify_live_e2e.py -v` | PASS (`1/1`, T22) | `tests/e2e/verify_live_e2e.py` |
