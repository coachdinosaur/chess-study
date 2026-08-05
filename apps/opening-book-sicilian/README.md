# Opening Book

Opening Book is a fully static version of Catalan Atelier. It keeps all 16
Markdown-authored chapters, clickable variations, page navigation, the
interactive chessboard, board flipping, keyboard move navigation, and
browser-local Stockfish analysis. It has no application server or cloud
runtime.

The source lives in `apps/opening-book/` inside `coachdinosaur/chess-study`.
The GitHub Pages workflow tests and builds it, then publishes the generated
files at:

```text
https://cddigital.top/openings/
```

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
