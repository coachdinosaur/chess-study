# Articles editorial image prompts

Five coordinated feature images for the Articles section, to be produced by an
external image model. All five must read as **one visual family** — same
illustrator, same lighting logic, same palette.

## How to use this file

For each image, combine the **shared style block** + the **subject prompt** +
the **negative prompt**. If the tool supports a persistent style/system field,
put the shared style block there once and reuse it for all five.

## Shared style block (prepend to every prompt)

```text
Editorial magazine illustration for a serious chess journal. Flat painterly
gouache style with a subtle paper-grain texture: geometric simplification,
layered muted shapes, soft hard-edged light, low-key cinematic mood with a
single subdued warm light source. Deep charcoal near-black atmosphere with
muted forest green and deep emerald mid-tones, restrained mint-green accents,
subdued warm ivory highlights, and occasional desaturated amber. Quiet,
intelligent, restrained mood — premium editorial art, not a poster. No text,
no letters, no numbers, no notation, no logos, no flags, no watermarks.
16:9 landscape composition with generous negative space.
```

## Negative prompt (use for all five)

```text
text, letters, numbers, words, typography, logos, watermarks, national flags,
political symbols, propaganda poster, photorealistic faces, identifiable real
people, neon colors, purple, lavender, glowing effects, lens flare, cartoon
style, anime, 3D render, clay render, stock photo, cluttered composition,
cheesy chess fantasy, giant floating chess pieces, glassmorphism
```

## Output specs

- **Master:** 16:9 landscape, WebP. The generator delivered 1024 × 576 for the
  hub hero (~24 KB) — the markup uses `width="1024" height="576"`. If later
  images arrive at 1600 × 900, update the width/height attributes on that
  page's `<img>` to match.
- **Status:** all five delivered (1024 × 576 WebP) and wired into the pages.
- **Filenames** (save into `articles/img/`):
  - `articles-hero-world-chess-training.webp` — Articles hub hero
  - `article-part-1-soviet-blueprint.webp` — Part 1
  - `article-part-2-state-programs.webp` — Part 2
  - `article-part-3-chess-ecosystems.webp` — Part 3
  - `article-part-4-winning-formula.webp` — Part 4
- The pages reference these exact paths; the markup hides the figure cleanly
  until each file exists, so partial delivery is safe.

Optional downscale for mobile (not required — masters are light enough):

```powershell
# Example with ImageMagick, run from articles/img/
magick article-part-1-soviet-blueprint.webp -resize 800x450 article-part-1-soviet-blueprint-800.webp
```

---

## 1. Articles hub hero — `articles-hero-world-chess-training.webp`

Page: `/articles/` — visual identity for the whole series.

```text
A wide editorial still-life: a single wooden chessboard in the left
foreground with mid-game pieces, beside it an open analysis notebook covered
in abstract unreadable diagrams (no letters or numbers), stacked chess books,
and a pair of reading glasses. Behind, a softly receding layered backdrop
suggests many distant study rooms and academies as dim geometric silhouettes
at different depths — a sense of many places where the game is taught. A
subtle abstract globe arc or scattered location points floats far in the
background, very faint. One quiet mint-green rim light traces the pieces.
Mood: many training cultures, one discipline.
```

## 2. Part 1 — `article-part-1-soviet-blueprint.webp`

Page: `/articles/chess-training-top-countries/part-1-soviet-blueprint/`

```text
A mid-20th-century chess study hall rendered as an archival-feeling
editorial illustration: rows of wooden desks in a high quiet room, each with
a small chessboard mid-analysis, students leaning over positions with
notebooks open, one standing instructor figure at a demonstration
demonstration board on the wall (abstract position marks only, no letters).
Tall windows throw long muted light shafts across the floor. Institutional,
disciplined, archival mood — like a memory of a serious school rather than a
photograph. Figures are simplified and faceless. No symbols, no posters, no
political imagery.
```

## 3. Part 2 — `article-part-2-state-programs.webp`

Page: `/articles/chess-training-top-countries/part-2-state-programs/`

```text
A modern national chess academy interior: a bright but still dark-toned
training hall with several organized tables, young players in pairs
analyzing games, a coach walking between boards, a large abstract
demonstration board and a schedule grid (no readable text) on the far wall.
Multiple rooms or floors suggested through layered geometric depth —
pipeline architecture made visible. Clean, structured, contemporary
institutional mood; diverse simplified figures, no national costumes, no
flags. Orderly repetition of boards reads as a system.
```

## 4. Part 3 — `article-part-3-chess-ecosystems.webp`

Page: `/articles/chess-training-top-countries/part-3-ecosystems/`

```text
A decentralized chess ecosystem shown as connected vignettes within one
composition: in the foreground a kitchen-table scene — a parent figure and a
child studying a chessboard by lamplight; around it, softer surrounding
layers suggest a school classroom, a private coaching desk with two people
and a laptop showing an abstract position diagram, a small club hall with
tournament boards, and a patron's quiet office with chess books. All zones
share one light and palette and blend without hard borders — many different
hands building one pipeline. Organic, warm, less institutional than the
other images.
```

## 5. Part 4 — `article-part-4-winning-formula.webp`

Page: `/articles/chess-training-top-countries/part-4-winning-formula/`

```text
The closing image of the series — a symbolic, almost emblematic composition:
a single chessboard seen slightly from above at center, around it the
essential tools of the method arranged like a quiet mandala — an open
annotated notebook (abstract marks only), a chess clock, a pencil, stacked
study books, and a small path of pieces suggesting progression from a lone
pawn toward a crowned piece. Circular, resolved composition; the most
minimal of the five images. A calm mint-green accent light settles on the
central board. Mood: the distilled formula, everything in its place.
```
