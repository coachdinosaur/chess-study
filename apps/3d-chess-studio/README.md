# CD Digital 3D Chess Position Studio

A completely client-side 3D chess position editor and local two-player board.
It runs as static HTML, CSS, and JavaScript. No application server, database,
worker, sign-in, Stockfish engine, or runtime API is required.

Setup mode builds arbitrary FEN positions. Play mode hides the editing panels
and uses `chess.js` in the browser for legal human-versus-human moves. The king,
queen, rook, knight, and pawn use the previously approved local Staunton 3D
models. Only the bishop is custom geometry, with a clean open diagonal mitre
and no inserted strip or accent object. The setup palette uses the main Study
Board's exact MPChess artwork.

## Prerequisites

- Node.js `>=22.13.0`

## Local development

```bash
npm install
npm run dev
```

Create and preview the exact production files:

```bash
npm run build
npm run preview
```

The static site is written to `dist/`.

## Deploying below a URL path

Set `VITE_BASE_PATH` while building. CD Digital publishes this app at `/3d/`:

```bash
VITE_BASE_PATH=/3d/ npm run build
```

Every generated JavaScript, stylesheet, favicon, 3D-model, and piece-art URL
uses that base path. The `coachdinosaur/chess-study` Pages workflow builds this
project and publishes `dist/` as `https://cddigital.top/3d/`.
