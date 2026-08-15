# Third-party assets

## MPChess piece artwork

- Assets: `public/pieces/mpchess/*.svg`
- Project: mpchess-pieces
- Creator: Maxime Chupin
- License: GNU General Public License v3 or later
- License copy: `public/pieces/mpchess/LICENSE.txt`

These are the same piece images already used by the main CD Digital Study
Board. They are used only in the setup palette; the 3D scene does not extrude
or alter the SVG files.

## Smooth chess pieces

- Asset: `public/models/staunton.glb`
- Original title: Chess
- Creator: pjhanzlik
- Source: https://opengameart.org/content/chess
- License: CC0 1.0 Universal

The approved model supplies the king, queen, rook, knight, and pawn. The bishop
is original procedural geometry so its diagonal mitre can remain a clean open
cut without an inserted object.

## Stockfish 18 Lite WebAssembly engine

- Assets: `public/stockfish/stockfish-18-lite-single.js`, `public/stockfish/stockfish-18-lite-single.wasm`
- Project: Stockfish Chess Engine
- Creator: Stockfish developers and contributors
- Source: https://github.com/official-stockfish/Stockfish
- License: GNU General Public License v3 or later

This is a browser-compatible single-threaded WebAssembly build of Stockfish 18 Lite.
It is executed in a dedicated Web Worker to power the Master-level bot in Play mode
with calibrated ~2300 Elo strength (`UCI_LimitStrength`).
