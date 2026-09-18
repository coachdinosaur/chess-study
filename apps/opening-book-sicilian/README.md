# Sicilian Defense Opening Book

Sicilian Defense Opening Book ("Beating the Anti-Sicilian") is a fully static
React/Vite opening course. It currently contains **8 chapters** covering
source-book pages 7–155 with PDF-authored page boundaries, clickable
variations, page navigation, an interactive chessboard, board flipping,
keyboard move navigation, and browser-local Stockfish analysis.

| Chapter | Title | Source pages |
|---|---|---|
| 1 | Rare Options | 7–23 |
| 2 | 2.g3 and 2.d3 | 24–38 |
| 3 | 2.b3 | 39–55 |
| 4 | Wing Gambit | 56–76 |
| 5 | c3 Sicilian – Introduction | 77–95 |
| 6 | c3 Sicilian – Rare 5th Moves | 96–106 |
| 7 | c3 Sicilian – Various 7th Moves | 107–135 |
| 8 | c3 Sicilian – 7.Bc4 | 136–155 |

Chapter 1's authoritative source is the committed PDF:

```text
apps/01_Rare_Options.pdf
```

`apps/Chapter_1_Rare_Options.md`, sitting next to the PDF, is an unconverted
early draft of Chapter 1 kept as a source artifact. The app never loads it —
only files inside `app/content/chapters/` are bundled.

The authoritative sources for Chapters 2–8 (the source-book PDFs and extracted
page manuscripts) are intentionally kept outside the repository. They are
authoring sources only and must not be copied into the app, committed to Git,
or included in a deployment.

The app manuscript is maintained in:

```text
apps/opening-book-sicilian/app/content/chapters/chapter-N-sicilian.md
```

These chapter Markdown files are **application inputs, not documentation** —
the app parses them at build time (`import.meta.glob`), resolves every bold
move token into clickable board navigation, and splits pages on `## Page N`
boundaries. Edit them through the authoring rules in `AUTHORING.md` and the
chapter CLI below; never treat them as prose documents to reformat freely.

The DOCX file is a derivative copy generated from the Markdown and is not an
authority for content or page structure.

The GitHub Pages workflow tests and builds the app, then publishes the generated
files at:

```text
https://cddigital.top/openings-sicilian/
```

The Sicilian app reuses the chess-piece and Stockfish assets published by the
Catalan opening book under `/openings/`. This avoids shipping duplicate engine
and piece files.

## Run locally

Use Node.js 22.13 or newer. Install dependencies once:

```powershell
npm install
```

Because the Sicilian app shares assets with the Catalan app, run the Catalan
development server first:

```powershell
cd ..\opening-book
npm run dev
```

In a second terminal, start the Sicilian app:

```powershell
cd ..\opening-book-sicilian
npm run dev
```

Open:

```text
http://localhost:3001/openings-sicilian/
```

## Build and test

```powershell
npm test
```

The deployable files are written to `dist/`. To preview both opening books with
shared assets, first preview the Catalan build on port 4173, then preview this
app on port 4174.

## Chapter authoring

Chapter files follow the pattern `chapter-N-sicilian.md`. The PDF page numbers
must be preserved as contiguous `## Page N` boundaries in the Markdown.

For detailed authoring guidelines, move notation conventions, and diagram rules,
see [`AUTHORING.md`](AUTHORING.md).

Use the chapter workflow commands for managing and testing chapters:

```powershell
# Check catalog overview and next expected chapter/page
npm run chapters:status

# Scaffold a new chapter template with contiguous page numbers
node scripts/chapter-system.mjs new-chapter --title "c3 Sicilian – Main Line" --pages 5

# Append pages to an existing chapter
node scripts/chapter-system.mjs add-page 5 --count 2

# Sync and validate
npm run chapters:sync
npm run chapters:check

# Deep move and diagram audit
npm run chapters:audit -- --chapter 1 --markdown app/content/chapters/chapter-1-sicilian.md --expected-first-page 7 --expected-pages 17
npm run chapters:audit -- --chapter 2 --markdown app/content/chapters/chapter-2-sicilian.md --expected-first-page 24 --expected-pages 15 --expected-diagrams 47
npm run chapters:audit -- --chapter 3 --markdown app/content/chapters/chapter-3-sicilian.md --expected-first-page 39 --expected-pages 17 --expected-diagrams 50 --strict-moves
npm run chapters:audit -- --chapter 4 --markdown app/content/chapters/chapter-4-sicilian.md --expected-first-page 56 --expected-pages 21 --expected-diagrams 44
npm run chapters:audit -- --chapter 5 --markdown app/content/chapters/chapter-5-sicilian.md --expected-first-page 77 --expected-pages 19 --expected-diagrams 42
npm run chapters:audit -- --chapter 6 --markdown app/content/chapters/chapter-6-sicilian.md --expected-first-page 96 --expected-pages 11 --expected-diagrams 33
npm run chapters:audit -- --chapter 7 --markdown app/content/chapters/chapter-7-sicilian.md --expected-first-page 107 --expected-pages 29 --expected-diagrams 92
npm run chapters:audit -- --chapter 8 --markdown app/content/chapters/chapter-8-sicilian.md --expected-first-page 136 --expected-pages 20 --expected-diagrams 63
```

Unresolved tokens are reported as warnings classified by kind
(`prose-square`, `cross-reference`, `move-mention`) — they fail the run only
under `--strict-moves`. `sicilian-opening-book-ci.yml` runs the chapter audits
for chapters 1–3 (`--strict-moves` on chapter 3) on every push touching
either opening-book app.

## Load-time corrections

`app/lib/chapter-*-corrections.ts` modules normalize `chapter-1-sicilian.md`
as it loads (`chapter-markdown-loader.ts`): they inject the hidden FEN anchors
and page-boundary fixes derived from the authoritative PDF. Each correction is
idempotent — it detects already-corrected content and returns it unchanged —
and it throws when its expected source text is missing, so a corrupted chapter
fails loudly instead of silently losing anchors. Keep the canonical chapter
format when editing Chapter 1 so the markers keep matching.
