# CD Digital 3D Chess Position Studio

A client-side 3D chess position editor, local two-player board, and AI bot battle arena built with React 19, Three.js, and `chess.js`. It runs entirely in the browser with no backend server, database, sign-in, or external runtime API required.

## Features

- **Setup Mode**:
  - Interactive piece palette featuring the main Study Board's MPChess 2D artwork.
  - Arbitrary FEN position construction with full validation.
  - Board presets (**Empty**, **Start**), side-to-move toggling, castling rights, and en passant square editing.
  - Smooth 180° camera flip orbit and one-click FEN clipboard copy.
- **Play Mode**:
  - **Local 2-Player**: Play head-to-head human-versus-human games with legal move validation.
  - **Play vs Computer (Bot)**: Challenge the computer across three calibrated difficulty tiers:
    - *Casual* (~1000 Elo): Tactical evaluation with intentional beginner jitter and inaccuracies.
    - *Club* (~1600 Elo): Minimax search (depth 2) with Piece-Square Tables (PST) and MVV-LVA move ordering.
    - *Master* (~2300 Elo): Authentic Master-strength Stockfish 18 Lite WebAssembly (WASM) engine with `UCI_LimitStrength` set to 2300 Elo (Skill Level 16).
  - **Non-blocking Web Worker**: AI move calculation runs in dedicated background Web Workers (`bot.worker.ts` and `stockfish-master.ts`), ensuring 60 FPS rendering and smooth animations without canvas freezing.
- **Game Controls & Life Cycle**:
  - Move history notation panel with SAN moves, move-by-move position review, PGN export, and zero layout shifting.
  - Resign button with a 2-step inline confirmation modal and Game Over banner overlays (Checkmate, Stalemate, Resignation, Draw).
  - Web Audio synthesizer with sound effects for moves, captures, castling, check, and game over.
  - Board themes (Tournament Wood, Classic Walnut, Midnight Obsidian, Modern Clean) with synchronized lighting axes and piece materials.
  - Camera presets (Perspective, Top-Down, 45° Angle, Reset) with orbit controls and responsive zoom.
- **3D Piece Geometry**:
  - Authentic Staunton models (`staunton.glb`) for King, Queen, Rook, Knight, and Pawn.
  - Custom procedural Bishop with prominent elongated tournament head and clean open diagonal mitre.

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
