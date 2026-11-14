# Dizayn seçimi — A istifadə edir
Məqsəd əvvəl şəkillərlə görünüş seçmək, sonra frontend yazmaqdır.
Bu mərhələdə kod yazmaq məcburi deyil. Şəkil yaratma vasitəsi yoxdursa aşağıdakı promptları istifadə etdiyiniz image generator-a ayrıca verin.

## Antigravity üçün dizayn tapşırığı

Sən Team CODE44-ün **Space Farm** layihəsinin A — UI/frontend məsulunun dizayn köməkçisisən. Əvvəl PROJECT_BRIEF.md, docs/DESIGN_BRIEF.md, docs/API_CONTRACT.md və TEAM_RULES.md-ni oxu.

Hələ production frontend yazma. Eyni məhsul ekranının üç müqayisə edilə bilən vizual konseptini hazırla. Eyni ölçü, eyni komponentlər və eyni məlumat iyerarxiyası saxlanılsın. Konseptlər yalnız rəng, tipografiya, sıxlıq və vizual xarakter üzrə fərqlənsin. Bu, bəzək landing page-i deyil, fermerin üçillik rotasiyanı müqayisə etdiyi tətbiqdir.

İlk olaraq aşağıdakı 3 image promptunu istifadə et. Şəkil vasitən yoxdursa promptları olduğu kimi təqdim et; olmayan şəkli yaradılmış sayma.
Şəkilləri təqdim etdikdən sonra komandanın seçimini al. Bir variant seçilənə qədər production UI-yə keçmə. Bu müddətdə müqaviləni oxuya və komponent siyahısını hazırlaya bilərsən.
Seçilmiş dizaynı docs/DESIGN_BRIEF.md-də qeyd et, faylları docs/design/ altında saxla, yalnız öz jurnalını yenilə.

## Variant 1 — aydın aqrar interfeys
```text
Create one high-fidelity desktop product UI concept, 1440x1000 canvas, for "Space Farm" by Team CODE44. An explainable crop rotation decision-support tool for a clearly labeled Ganja demo field. Use a warm white background, deep forest green primary color, restrained sage accents, readable dark typography, soft borders, precise alignment and generous spacing.

Show the same functional composition: compact left navigation with Field, Rotation Plans, Scenarios, Sources; a top bar with product name and "Demo concept"; a compact field summary and small illustrative field map; three equally sized cards comparing three-year crop sequences with Year 1, Year 2, Year 3; a side panel with Water, Soil, Income priority sliders; a clearly labeled hypothetical rainfall stress control; and an expandable data provenance panel showing placeholders for dataset, time range and source.

Make the three-year rotation the focal point. Use neutral placeholder bars and short readable labels. Display "Illustrative data" clearly. Do not invent yield, profit, water-savings percentages, verified weather readings or NASA endorsement. No NASA insignia. No sci-fi holograms. This is a visual layout reference, not a data chart or functional screenshot.
```

## Variant 2 — tünd analitik interfeys
```text
Create one high-fidelity desktop product UI concept, 1440x1000 canvas, for "Space Farm" by Team CODE44. An explainable crop rotation decision-support tool for a clearly labeled Ganja demo field. Use a deep navy background, accessible off-white type, restrained teal highlights, muted slate cards, crisp borders and a calm scientific visual hierarchy. Avoid neon overload.

Show exactly this composition: compact left navigation with Field, Rotation Plans, Scenarios, Sources; a top bar with product name and "Demo concept"; a compact field summary and small illustrative field map; three equally sized cards comparing three-year crop sequences with Year 1, Year 2, Year 3; a side panel with Water, Soil, Income priority sliders; a clearly labeled hypothetical rainfall stress control; and an expandable data provenance panel showing placeholders for dataset, time range and source.

Make the three-year rotation the focal point. Use neutral placeholder bars and short readable labels. Display "Illustrative data" clearly. Do not invent yield, profit, water-savings percentages, verified weather readings or NASA endorsement. No NASA insignia. No sci-fi holograms. This is a visual layout reference, not a data chart or functional screenshot.
```

## Variant 3 — sadə fermer interfeysi
```text
Create one high-fidelity desktop product UI concept, 1440x1000 canvas, for "Space Farm" by Team CODE44. An explainable crop rotation decision-support tool for a clearly labeled Ganja demo field. Use a light cream background, olive green primary actions, restrained earthy amber accents, large readable typography, spacious cards, friendly minimal icons and plain-language labels.

Show exactly this composition: compact left navigation with Field, Rotation Plans, Scenarios, Sources; a top bar with product name and "Demo concept"; a compact field summary and small illustrative field map; three equally sized cards comparing three-year crop sequences with Year 1, Year 2, Year 3; a side panel with Water, Soil, Income priority sliders; a clearly labeled hypothetical rainfall stress control; and an expandable data provenance panel showing placeholders for dataset, time range and source.

Make the three-year rotation the focal point. Use neutral placeholder bars and short readable labels. Display "Illustrative data" clearly. Do not invent yield, profit, water-savings percentages, verified weather readings or NASA endorsement. No NASA insignia. No sci-fi holograms. This is a visual layout reference, not a data chart or functional screenshot.
```

## Seçimdən sonra
A design tokens, komponentlər və 360px mobile adaptasiyasını yazır. Şəkildəki dəqiq mətn/rəqəm və xəritə həqiqət kimi köçürülmür. Əsas prioritet: rotasiyanı oxumaq, səbəbi anlamaq, müqayisəni tamamlamaq.

