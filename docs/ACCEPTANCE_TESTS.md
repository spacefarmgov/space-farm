# Qəbul və demo yoxlamaları — Space Farm (Team CODE44)
Owner: B • Başlanğıc: bütün yoxlamalar NOT_RUN
Bu siyahı test planıdır, keçmiş test nəticəsi deyil. Hər rol öz test sübutunu öz jurnalında saxlayır.

## Məcburi testlər
| ID | Owner | Sınaq | Gözlənən nəticə |
|---|---|---|---|
| T01 | C | Həqiqi POWER response | Raw + URL + retrieved_at + SHA-256 |
| T02 | C | Mənfi temperatur | Düzgün temperatur saxlanır |
| T03 | C | Missing rainfall | 0-a çevrilmir, quality flag |
| T04 | C | Yanlış upstream query/422 | Mənasız retry yoxdur |
| T05 | C | 429 və timeout | Limitli retry, uyğun cache və ya DataUnavailable |
| T06 | C | Başqa koordinat/tarix | Yanlış snapshot verilmir |
| T07 | C | 2024 coverage | Leap day sayılır, gap aşkarlanır |
| T08 | C | Vahid və UTC/LST | Aqreqat semantikası doğru, qarışıq standart rədd |
| T09 | B | Preferences cəmi səhv | 422, standard envelope |
| T10 | B | Sərt constraint pozulur | Yüksək skorla belə çıxışa girmir |
| T11 | B | Eyni input/versiyalar | Eyni planlar/skorlar; runtime ID fərqli ola bilər |
| T12 | B | Heç plan mümkün deyil | 200 + no_feasible_plan + səbəblər |
| T13 | B | pH unknown | Gizli default yoxdur, provisional/needs_data |
| T14 | B | Gəlir unavailable | null, effektiv çəkilər, xəbərdarlıq |
| T15 | B | Yalnız unavailable məqsədə çəki | needs_data; division-by-zero yoxdur |
| T16 | B | Stress multiplier | Raw dataset dəyişmir; ssenari izahlı |
| T17 | A | Forma → nəticə | 0–3 plan, hərəsində 3 il |
| T18 | A | Prioritet/stress dəyişir | Yeni API request; köhnə response yeni seçimi əvəz etmir |
| T19 | A | API gecikir/xəta | Loading, retry, açıq error |
| T20 | A | 360px və klaviatura | Əsas axın oxunur, fokus görünür |
| T21 | A | Mənbə paneli | Dataset/tarix/vahid/keş etiketi və işlək link |
| T22 | B+A | İnteqrasiya real data | NASA feature → score explanation → UI izi |
| T23 | B+C | Upstream internet kəsilir | Uyğun real snapshot-la cached demo |
| T24 | B | Public demo/repo | Tələb olunan linklər ayrıca brauzer sessiyasında açılır |

T18-də nəticə/rank hər girişdə mütləq dəyişməyə bilər; əsas meyar yenidən hesablama və səbəbdir. Sıralamanı vizual təsir üçün saxta dəyişdirməyin.
T23 bütöv brauzer offline/PWA zəmanəti deyil; frontend/backend işləyərkən xarici NASA əlaqəsinin kəsilməsidir.

## Sübut formatı
Task ID; commit/PR; test əmri; input; expected; actual; PASS/FAIL/NOT_RUN; vaxt; log/screenshot/manifest yolu.
CI quraşdırılmayıbsa “CI keçdi” yazılmır. Manual yoxlama manual kimi qeyd edilir.

## İki dəqiqəlik demo
0–20s: problemin konkret nümunəsi və demo sahə.
20–45s: torpaq unknown və fermer prioritetləri.
45–80s: üçillik alternativlər, bir sərt constraint və izah.
80–105s: hipotetik yağıntı ssenarisi, dəyişən/skoru dəyişməyən səbəb.
105–120s: real NASA mənbəsi, qeyri-müəyyənlik, növbəti validasiya addımı.

## Buraxılışı saxlayan hallar
Saxta real data etiketi; NASA səhvi zamanı gizli fixture fallback; qadağan planın təhlükəsiz göstərilməsi; əsas axının çökməsi; gizli token; qırıq əsas demo link.
Dekorativ animasiya, export/PDF və əlavə xəritə qatı əsas demo uğursuzluğunu kompensasiya etmir.

