# Opening Book

Opening Book is a fully static version of Catalan Atelier. It keeps all 16
Markdown-authored chapters, clickable variations, page navigation, the
interactive chessboard, board flipping, keyboard move navigation, and
browser-local Stockfish analysis. It has no application server or cloud
runtime.

It also serves the **Opening Courses hub**: opening `/openings/` without a
chapter fragment renders `OpeningHubView` — a course picker linking this
Catalan course and the Sicilian Defense course at `/openings-sicilian/`.
Chapter routes use `#/chapters/<id>` fragments as before.

The source lives in `apps/opening-book/` inside `coachdinosaur/chess-study`.
The GitHub Pages workflow tests and builds it, then publishes the generated
files at:

```text
https://cddigital.top/openings/
```

**Shared-asset contract:** the Sicilian app (`apps/opening-book-sicilian`)
deliberately ships no pieces or engine — it loads
`/openings/assets/pieces/mpchess/*.svg` and
`/openings/stockfish/stockfish-18-lite-single.js` from this app's published
output. Keep the `public/` layout for those paths stable; renaming them breaks
the sibling course.

## Run locally

Install dependencies once:

```powershell
npm install
```

Start the development version:

```powershell
npm run dev
```

Open `http://localhost:3000/openings/`.

Build the standalone static site:

```powershell
npm run build
```

The deployable files are written to `dist/`. They can be hosted by any ordinary
static web server under `/openings/`. Chapter navigation uses URL fragments,
and generated redirect pages preserve direct chapter links without requiring
server-side route configuration.

To preview the exact built output:

```powershell
npm run preview
```

## Chapter authoring

Lessons remain in `app/content/chapters/chapter-N-catalan.md`. The existing
chapter workflow is available through:

```powershell
npm run chapters:status
npm run chapters:check
```

Pagination uses `## Page N` boundaries with two conventions: chapters 1–8
keep the continuous source-book page numbers, while chapters 9–16 restart at
`## Page 1`. The strict `chapters:audit` check requires a first boundary of
`## Page 1`, so it applies cleanly only to chapters 9–16 — that is intended.

For correcting content errors (moves that don't link, wrong diagrams, dead
branches), follow the diagnostic method in
`apps/opening-book-sicilian/AUTHORING.md` §6 — the resolver architecture and
anchor conventions are shared. A per-page replay trace is available:

```powershell
node --import tsx scripts/chapter-trace.ts `
  --markdown app/content/chapters/chapter-1-catalan.md --page 7
```

Note for Windows checkouts: `chapters:check` compares the generated catalog
byte-for-byte, so with `core.autocrlf=true` it can report "Chapter catalog is
stale" when only CRLF/LF line endings differ. Run `npm run chapters:sync` and
`git diff --ignore-cr-at-eol` to confirm whether the drift is real.
