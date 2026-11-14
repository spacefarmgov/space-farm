# Layihənin məğzi — Space Farm
Owner: B • İstinad: ilkin tədqiqat PDF-i (`CODE44_AgroRotation_AI (1).pdf`, s. 3, 6, 22–33, 46–69) • Status: başlanğıc məhsul sərhədi

## Nə qururuq?
**Space Farm** — fermerin sahə məlumatı, torpaq girişi, NASA tarixi iqlim məlumatı və prioritetləri əsasında 3 illik əkin dövriyyəsi alternativlərini müqayisə edən izahlı qərar dəstəyi prototipi.

Komanda: **CODE44**. Şüar: **From Space Data to Smarter Farms**.
Yarış uyğunluğu: **NASA Space Apps Challenge 2026 — "Field Shift: Adapting Farms with NASA Data"**.
“Digital Farm Twin” məhsul yanaşmasıdır; fiziki sahədə kalibrasiya edilmiş rəqəmsal əkiz yaratdığımız iddiası deyil.

## Bir demo hekayəsi
Gəncə ətrafında **demo kimi işarələnmiş** sahə seçilir. İstifadəçi bildiyi torpaq məlumatını və əvvəlki bitkini daxil edir; bilmədiyini unknown saxlayır. Su, torpaq və gəlir prioritetlərini seçir. Sistem:
1. Tarixi iqlim məlumatını əldə edir və mənbəni göstərir.
2. Mənbələndirilmiş qaydalarla mümkün 3 illik ardıcıllıqları yaradır.
3. Ən çox 3 fərqli mümkün planı səbəbləri ilə müqayisə edir.
4. Yağıntı stress ssenarisində planları yenidən qiymətləndirir.
5. Hansı məlumatın NASA-dan, hansının istifadəçidən və hansının komanda hesablamasından gəldiyini ayırır.

Üçdən az mümkün plan varsa onları göstəririk; kart sayını doldurmaq üçün plan uydurmuruq. Sıfır plan olduqda səbəb və dəyişdirilə bilən girişlər görünür.

## MVP daxilində
- Bir pilot region, koordinat girişi və əvvəlcədən hazırlanmış demo sahə.
- 5–6 namizəd bitki: buğda, arpa, noxud, mərci, günəbaxan, qarğıdalı. Regiona uyğunluq hələ təsdiqlənməlidir.
- NASA POWER gündəlik temperatur və yoxlanmış yağıntı parametri.
- Bir illik tarixi demo seriyası; PDF-dəki 2024 başlanğıc seçimidir, real sorğu ilə yoxlanmalıdır.
- pH/tekstura kimi torpaq girişləri, mənbə növü və unknown davranışı.
- Qayda əsaslı generator, izahlı skor, prioritet dəyişməsi.
- Baza və hipotetik yağıntı azalması ssenarisi.
- Mənbələr paneli, cache nişanı, loading/error/empty vəziyyətləri.
- İki dəqiqəlik təqdimat və təkrarlana bilən demo.

## MVP-dən kənar
Auth, ödəniş, marketplace, IoT, çoxfermerli idarəetmə, ağır ML təlimi, chatbot, avtomatik aqronom, tam xəstəlik modeli, SMAP/HLS/SoilGrids inteqrasiyası, mürəkkəb poliqon redaktoru.
Sonrakı imkanlar ROADMAP.md-də saxlanır. Əlavə modul yalnız əsas demo qəbuldan keçəndə açılır.

## Sübut və naməlumluq
- NASA məlumatı tarixi girişdir; nəticə skoru komanda alqoritminindir.
- POWER hüceyrəsi konkret sahənin torpaq laboratoriyası deyil.
- Hipotetik stress gələcək hava proqnozu deyil.
- Gəlir mənbəsi yoxdursa gəlir metrikası unavailable olur; saxta AZN və faiz göstərilmir.
- Qayda ekspert tərəfindən yoxlanmayıbsa “provisional” göstərilir.
- Uydurma NASA tərəfdaşlığı, təsdiqi, məhsuldarlıq və su qənaəti vədi istifadə olunmur.

## Əsas uğur
Yeni istifadəçi sahə → torpaq → prioritet → plan → stress → mənbə axınını bitirə bilir. Ən az bir real NASA seriyasının hesablamaya necə təsir etdiyi göstərilir. İnternet kəsiləndə eyni sorğuya uyğun əvvəlcədən endirilmiş real snapshot ilə demo davam edir.

## PDF ilə bu planın fərqi
PDF uzunmüddətli tədqiqat xəritəsidir. Burada üç nəfərlik icra üçün scope daraldılıb, rol və fayl sahibliyi əlavə edilib, təqvim əvəzinə nisbi iş saatları seçilib. PDF-dəki yarış tarixləri, brendinq tələbləri və keçmiş repo haqqında qeydlər cari rəsmi təsdiq sayılmır. Onlar bu paket hazırlanarkən ayrıca yoxlanmayıb.

