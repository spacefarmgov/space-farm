# Dizayn brief-i və seçim — Space Farm (Team CODE44)
Owner: A • Seçilmiş variant: HƏLƏ YOXDUR
Seçənlər / tarix: —
Seçilmiş şəkil yolu: —
Qərarın səbəbi: —

## Məqsəd
Sadəcə gözəl dashboard deyil: istifadəçi hansı 3 illik planı niyə müqayisə etdiyini anlamalıdır. Əsas obyekt rotasiya cədvəlidir; xəritə yardımçı kontekstdir.

## Dizayn mərhələsi
A eyni ekran və məlumat strukturu ilə üç şəkil variantı hazırlayır:
1. Açıq fon, tünd yaşıl, sakit aqrar qərar aləti.
2. Tünd göy/teal, məlumat yönümlü analitik ekran.
3. Açıq krem/olive, fermer üçün sadə və oxunaqlı interfeys.
Bütün variantlarda eyni 1440×1000 desktop baxışı, eyni kart sayı və eyni axın olsun. Müqayisə rəng, iyerarxiya və istifadə rahatlığına görə edilir.
Komanda birini seçir. Sonra A rəng, type scale, spacing, radius, komponent və mobile davranışını yazır.
Şəkildəki mətnlər/rəqəmlər təsvir üçündür; tətbiqin real məlumatı deyil.

## Əsas ekranlar
| Ekran | Məcburi komponent |
|---|---|
| Sahə və giriş | Demo field etiketi, koordinat, torpaq unknown seçimi, əvvəlki bitki |
| Plan müqayisəsi | 1/2/3 il, ən çox 3 plan, skorun izahı, prioritetlər |
| Stress və mənbələr | Baza/stress fərqi, hipotetik etiketi, source drawer |

Desktop: rahat iki/üç sütun; mobile: tək sütun, tab və ya ardıcıl plan kartları.
Faydalı əsas düymə: “Planları müqayisə et”. Form təqdim ediləndə loading və cancel/retry davranışı aydın olsun.

## Hər ekranın vəziyyətləri
Loading, empty, ready, partial_data, cached, needs_data, no_feasible_plan, API error.
Sıfır plan olduqda boş ağ ekran yoxdur; səbəb və girişə qayıdış var.
Gəlir məlumatı yoxdursa unavailable izahı; 0 AZN və saxta qazanc chart-ı yoxdur.
Qrafik rəngdən başqa yazı/legend ilə də izah olunur. Klaviatura fokusları görünür.

## Görünüş sərhədləri
- **Space Farm** layihə adı və **CODE44** komanda kimliyi; təsdiqlənməmiş NASA logo/tərəfdaşlıq lockup-u yoxdur.
- Foto və xəritə screenshot-u data sübutu kimi göstərilmir.
- “+40% profit”, “98% accurate”, saxta sensor/live metrics yoxdur.
- Bütün mock rəqəmlər “Demo data” kimi işarələnir.
- 360px enində əsas horizontal overflow yoxdur; cədvəl lazımdırsa əlçatan scroll göstərilir.
- Dizayn backend-in real response-una uyğunlaşdırılır; şəkli təqlid etmək üçün data uydurulmur.
- Beynəlxalq Space Apps münsifləri üçün əsas demo interfeysi və pitch ingilis dilində (EN) aydın olmalıdır; yerli AZ dəstəyi əlavə/ikidilli seçim kimi saxlanıla bilər. Çoxdilli sistem MVP üçün məcburi deyil.

## Seçim cədvəli
| Variant | Oxunaqlılıq /5 | Rotasiya aydınlığı /5 | Mobilə uyğunluq /5 | İcra sürəti /5 |
|---|---:|---:|---:|---:|
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |

## Təsdiqlənən dizayn tokenləri
Color palette: —
Font və sizes: —
Spacing: —
Radius/shadow: —
Component list: —
Mobil adaptasiya: —
İlkin dizayn dəyişməsi lazım olarsa A səbəbi yazır; hər sessiyada tam redesign edilmir.

