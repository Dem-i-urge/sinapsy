# Ассеты «Стены Дворника» — промпты Nano Banana Pro · v0.1 · 17.11.2026

Мир: **двор до рассвета**. Глухая кирпичная стена (брандмауэр) во дворе, фонарь, Дворник с метлой; техника — многокрасочная линогравюра. Краски — сажа, мел, фонарный янтарь и рассветная полоса в цветах Призмы (слива → маджента → оранжевый → янтарь): те же цвета, что у кирпичей кладки.

Образец подачи — «Лунный альманах» Фамильяра: цветная панорама-шапка во всю ширину с заголовком поверх, цветные медальоны на чёрном, орнамент-разделитель перед разделами, плитка-фактура фоном. Отличие от «Недели вперёд»: там белая тушь тонкой линией, здесь цветная краска толстым резом.

Каждый промпт ≤ 1000 знаков (поле молча режется на 1000). Порядок генерации важен: шапка — первой, она служит референсом (Image 1) остальным листам.

## Файлы

| Сырой файл (как сохранить) | Промпт | Формат | Что из него выйдет в `art/` |
|---|---|---|---|
| `stena-1-hero.png` | 1 | 21:9, 2K | `hero.jpg` 1600×640 — шапка, без режима наложения |
| `stena-2-plaster.png` | 2 | 1:1, 2K | `plaster.jpg` плитка 512×512 — фон страницы |
| `stena-3-medals.png` | 3 | 3:2, 2K | шесть медальонов 256×256: `m-first` `m-days` `m-far` `m-top` `m-props` `m-passport` |
| `stena-4-sheet.png` | 4 | 16:9, 2K | `m-dvornik.jpg` 256×256, `seal.jpg` 320×320, `divider.jpg` 1200×≈140 |

Обработка (делает ассистент): обрезка по содержимому, чёрное дочернено до #000, JPEG q80–82; фактура сведена тоном к фону страницы и сшита в плитку. Всё, что на чёрном (медальоны, печать, разделитель), кладётся режимом `screen`.

Референсы: Image 1 для промптов 3 и 4 — готовая шапка `stena-1-hero.png`; Image 2 для промпта 4 — печать Диспетчерской `dispatcher/utrenniy-list/art/seal.jpg`.

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

## Где что встанет на странице

- `hero.jpg` — шапка-панорама, заголовок «Стена Дворника» и строка прогона — поверх, в тёмном левом нижнем углу.
- `plaster.jpg` — фон страницы плиткой; кирпичи кладки остаются нарисованными кодом, в цветах Призмы.
- `divider.jpg` — перед каждым разделом.
- `m-*.jpg` — медальон у заголовка раздела.
- `m-dvornik.jpg` — в карточке задачи у строки «почему здесь» и на пустой стене («Стена пока не сложена»).
- `seal.jpg` — подвал, печать Диспетчерской.
