# C — data canlı iş jurnalı (Space Farm • Team CODE44)
Owner: yalnız C • Branch: feat/backend-core (initial local integration)
Son yenilənmə: 14.11.2026 (Asia/Baku)
Kontrakt versiyası: 0.1.0 FROZEN

## Cari vəziyyət
Status: VERIFIED_LOCAL (NASA POWER client, pipeline, cache, Gəncə 2024 snapshot və FAO-əsaslı bitki kataloqu hazırdır)

## Son tamamlanan iş
- `services/api/app/data_adapters/`: `exceptions.py`, `nasa_power.py`, `pipeline.py`, `cache.py`, `catalog.py`, `provider.py`.
- `tools/data/fetch_power.py`: Gəncə (`40.68, 46.36`, `2024-01-01..2024-12-31`, `AG`, `UTC`) real snapshot-ı endirildi (`366/366` gün, `T2M` orta `10.58 C`, `PRECTOTCORR` `506.52 mm`, `query_hash=552e40e213b9f7b8`, `SHA-256: 22b70694bb786042a84df2371af88ddca8b0485858b8ce51e20d1cb99474bf44`).
- `data/catalog/`: `crops.json` (6 bitki) və `rules.json` (`source_supported` / `provisional`, FAO Paper 56 / CROPWAT istinadlı).

## Test sübutu
| Vaxt | Task | Əmr / addım | Nəticə | Sübut yolu |
|---|---|---|---|---|
| 2026-11-14 | C-00..C-03 | `python -m unittest discover -s services/api/tests/data -t services/api -v` | PASS (`9/9`, T01-T08 & T23) | `services/api/tests/data/test_power_adapter.py` |
