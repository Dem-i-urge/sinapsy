# Ассеты «Стены Дворника» — промпты Nano Banana Pro · v0.2 · 18.11.2026

Мир: **двор до рассвета**. Глухая кирпичная стена (брандмауэр) во дворе, фонарь, Дворник с метлой; техника — многокрасочная линогравюра. Краски — сажа, мел, фонарный янтарь и рассветная полоса в цветах Призмы (слива → маджента → оранжевый → янтарь): те же цвета, что у кирпичей кладки.

Образец подачи — «Лунный альманах» Фамильяра: цветная панорама-шапка во всю ширину с заголовком поверх, цветные медальоны на чёрном, орнамент-разделитель перед разделами, плитка-фактура фоном. Отличие от «Недели вперёд»: там белая тушь тонкой линией, здесь цветная краска толстым резом.

Поле промпта молча режется на 1000 знаков. Порядок генерации важен: шапка — первой, она служит референсом (Image 1) остальным листам.

## Файлы

Сгенерировано 18.11.2026, сырьё — `Downloads\Стена дворника` (в репозитории не хранится). В `art/` лежит обработанное:

| Файл в `art/` | Промпт | Размер | Как кладётся |
|---|---|---|---|
| `hero.jpg` | 1 (21:9) | 1600×645 | шапка, фон блока, без режима наложения; бумажное поле оттиска срезано |
| `plaster.jpg` | 2 (1:1) | плитка 512×512 | фон страницы; сшита в бесшовную, тон сведён к `#151112` |
| `m-first` `m-days` `m-top` `m-far` `m-props` `m-passport` `.jpg` | 3 (3:2) | 256×256 | медальон у заголовка раздела, `screen` |
| `m-dvornik.jpg` | 4 (16:9) | 320×320 | карточка задачи («почему здесь») и пустая стена, `screen` |
| `seal.jpg` | 4 | 320×320 | подвал, печать Диспетчерской, `screen` |
| `divider.jpg` | 4 | 1200×168 | разделитель перед каждым разделом, `screen` |

Обработка: обрезка по содержимому, всё темнее порога дочернено до `#000`, JPEG q82–84. Лист медальонов модель разложила в своём порядке (колокол, мастерок, созвездие / крыши, записка, ключи) — имена файлов даны по смыслу, не по номеру в промпте.

Референсы: Image 1 для промптов 3 и 4 — готовая шапка; Image 2 для промпта 4 — печать Диспетчерской `dispatcher/utrenniy-list/art/seal.jpg`. Каждый промпт ≤ 1000 знаков.

## 1. Шапка — двор до рассвета (без референса, 21:9)

```
Multi-colour reduction linocut print, hand-carved: bold chunky shapes, visible gouge marks, slightly uneven ink. Wide panorama of an old city courtyard an hour before dawn, late autumn. Across the whole width stands a tall blind brick firewall, carved brick by brick in running bond; a few single bricks are inked amber, orange, magenta and purple. Right of centre a street lantern throws a warm amber cone of light; under it a calm elderly janitor in a quilted jacket, apron and flat cap sweeps fallen leaves with a long birch broom, side view, small in the frame. Above the roofline a narrow band of dawn sky fades from deep plum through magenta and orange to amber; chimneys, a bare tree, a cat asleep on a ledge. The lower left quarter is dark plain cobblestones, empty. Palette only: warm soot black #151112, chalk white, amber #F7B82B, orange #E7761E, magenta #D2206B, plum #7A3581. No text, letters, digits or signs anywhere. Landscape 21:9, 2K.
```

## 2. Фактура — закопчённая штукатурка (без референса, 1:1)

```
Seamless tileable square texture: old soot-darkened lime plaster of a courtyard wall at night, warm near-black close to #151112, printed as a linocut: fine carved grain, faint trowel sweeps, tiny chips and specks only slightly lighter than the ground. One even tone across the whole square so the edges join without a seam; very low contrast. It holds no bricks, no cracks, no drawing, no objects and no text. Square, 2K.
```

## 3. Медальоны разделов 3×2 (Image 1 — шапка, 3:2)

Порядок слева направо, сверху вниз: «Сначала» (колокол) · «Три недели по дням» (мастерок и кирпич) · «Дальше: недели и месяцы» (крыши вдаль) · «Верхние точки по баллу» (созвездие-граф) · «Предложения прогона» (записка на двери) · «Паспорт данных» (связка ключей).

```
Linocut print in the style, carving and inks of Image 1: bold chunky shapes, visible gouge marks. Inks: chalk white and amber #F7B82B, rare magenta #D2206B accents. Subject: six round medallions of equal size in a 3x2 grid with equal black gaps. Each is a thick carved ring holding one small scene: 1) a brass hand bell ringing, short sound strokes; 2) a mason's trowel laying one brick on a short course of bricks; 3) rooftops and chimneys receding into the distance under a thin crescent moon; 4) seven stars joined by lines into a constellation above a roof; 5) a folded paper note pinned to a wooden door; 6) a ring of old keys hanging on a nail. No text, letters or digits anywhere. Background: flat pure black #000000 edge to edge, outside and between the rings; no paper, frame or shadow. Landscape 3:2, 2K.
```

## 4. Дворник, печать, разделитель (Image 1 — шапка, Image 2 — печать Диспетчерской, 16:9)

```
Linocut print in the style, carving and inks of Image 1: bold chunky shapes, visible gouge marks. Inks: chalk white and amber #F7B82B. Subject: three separate items, far apart. Top left: a round medallion in a thick carved ring: head-and-shoulders portrait of the same janitor as in Image 1, flat cap, calm face, birch broom over his shoulder. Top right: the seal from Image 2 recut as a linocut: lattice radio tower, radio-wave arcs, rising sun at its foot, ring of dots. Bottom, full width: a long horizontal ornament: a birch broom lying on its side at the centre, swirls of swept leaves curling symmetrically towards both ends and thinning to points. No text, letters or digits anywhere. Background: flat pure black #000000 edge to edge, no paper, frame or shadow. Landscape 16:9, 2K.
```
