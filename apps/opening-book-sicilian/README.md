# Sicilian Defense Opening Book

Sicilian Defense Opening Book is a fully static React/Vite opening course. It
currently contains Chapter 1, **Rare Options**, Chapter 2, **2.g3 and
2.d3**, and Chapter 3, **2.b3**, with PDF-authored page boundaries, clickable
variations, page navigation, an interactive chessboard, board flipping,
keyboard move navigation, and browser-local Stockfish analysis.

Chapter 1's authoritative source is the committed PDF:

```text
apps/01_Rare_Options.pdf
```

Chapter 2's authoritative PDF, `02_2g3_and_2d3.pdf`, and Chapter 3's
authoritative source, `03_2b3_pages_01-17.md`, are intentionally kept outside
the repository. They are authoring sources only and must not be copied into the
app, committed to Git, or included in a deployment.

The app manuscript is maintained in:

```text
apps/opening-book-sicilian/app/content/chapters/chapter-N-sicilian.md
```

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

Use the chapter workflow commands after editing:

```powershell
npm run chapters:status
npm run chapters:sync
npm run chapters:check
npm run chapters:audit -- --chapter 1 --markdown app/content/chapters/chapter-1-sicilian.md --expected-first-page 7 --expected-pages 17
npm run chapters:audit -- --chapter 2 --markdown app/content/chapters/chapter-2-sicilian.md --expected-first-page 24 --expected-pages 15 --expected-diagrams 47
npm run chapters:audit -- --chapter 3 --markdown app/content/chapters/chapter-3-sicilian.md --expected-first-page 39 --expected-pages 17 --expected-diagrams 50 --strict-moves
```
