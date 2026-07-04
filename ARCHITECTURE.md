# Architecture

## Overview

A browser-based chess study and analysis single-page application. No framework —
the app is pure ES modules with direct DOM manipulation. A single global state
object drives rendering across six tabs.

---

## Directory Layout

```
chess-study/
├── index.html                  Entry point — page shell, SVG overlays, modals
├── app.js                      Main application (~11,340 lines)
├── styles.css                  All styles (~4,430 lines)
├── pgn.mjs                     PGN import/export with tree conversion
├── puzzle-api.mjs              Endgame puzzle generation (Stockfish worker)
├── guided-review.mjs           CSV/XLSX lesson-row review controller
├── text-normalization.mjs      Unicode repair and punctuation normalization
├── local_server.py             Python HTTP server with COOP/COEP headers
├── scanner_server.py           Chessboard image recognition HTTP server
├── scanner_predict.py          Image-to-FEN prediction logic
├── start-local.ps1             Windows deployment script
├── assets/
│   ├── pieces/mpchess/         SVG piece images (wK.svg, bQ.svg, …)
│   ├── openings.tsv            Opening book TSV (ECO, name, PGN, UCI, EPD)
│   ├── Inter/                  Inter variable font (body text)
│   ├── Manrope/                Manrope variable font (headings)
│   └── social-preview.png      Open Graph / Twitter card image
├── vendor/
│   ├── chess.js                Chess.js (PGN parser, move validation, FEN)
│   ├── stockfish/              Stockfish browser bundles
│   │   ├── stockfish-18.js + .wasm          Full multi-threaded
│   │   ├── stockfish-18-single.js + .wasm   Full single-threaded
│   │   ├── stockfish-18-lite.js + .wasm     Lite multi-threaded
│   │   └── stockfish-18-lite-single.js + .wasm  Lite single-threaded
│   └── xlsx.full.min.js        XLSX parsing for Guided Review
└── tools/
    ├── test-puzzle-api.mjs     Puzzle API unit tests
    ├── fetch_openings.js       Opening book data fetcher
    └── generate_openings.mjs   Opening book generator
```

---

## Module Architecture

```
index.html
    │
    ├── styles.css              CSS custom properties, layout, theme
    │
    └── app.js ◄── entry point
            │
            ├── vendor/chess.js             Chess logic (FEN, PGN, moves)
            ├── pgn.mjs                     Lesson tree ↔ PGN text
            ├── puzzle-api.mjs              Puzzle generation (Stockfish worker)
            ├── guided-review.mjs           CSV/XLSX review controller
            └── text-normalization.mjs      Unicode cleanup
```

### Module Responsibilities

| Module | Role |
|---|---|
| `app.js` | UI rendering, event handling, state management, Stockfish/tablebase integration, board interaction, annotation system, lesson tree management, Play-vs-Engine mode, puzzle session management |
| `pgn.mjs` | `buildPgnFromLessonTree()` — converts the internal lesson tree to PGN text; `parsePgnToLessonTree()` — parses PGN text back into the lesson tree; `splitPgnGames()` — splits multi-game PGNs; `extractPgnHeaders()` — extracts PGN metadata |
| `puzzle-api.mjs` | Random endgame puzzle generation with Stockfish evaluation, candidate classification (mate/win/draw), optional Syzygy tablebase verification, prefetch caching |
| `guided-review.mjs` | CSV/XLSX row parsing, field alias normalization (title, fen, difficulty, goalType, lessonText, mode, etc.), review progress persistence and restoration |
| `text-normalization.mjs` | Multi-pass Unicode repair (mojibake, smart quotes, dashes, ellipsis) and whitespace normalization |
| `chess.js` (vendor) | FEN parsing/validation, move execution, check/checkmate/stalemate detection, PGN parsing (Peggy-generated parser), board state queries |

---

## State Management

A single global `state` object (`app.js:649`) owns all application state. Every
rendering function reads from `state`; every event handler writes to `state`
then calls `renderAll()` or a targeted render function.

### State Sub-Objects

| Path | Purpose |
|---|---|
| `state.setup` | Board editor: piece placement, FEN input, palette state |
| `state.analysis` | Lesson tree: game instance, node graph, current position, legal moves, pending promotion |
| `state.engine` | Stockfish worker: connection, search state, PV lines, eval |
| `state.tablebase` | Tablebase probe: cache, current result, abort controller |
| `state.practice` | Practice session: active mode, progress, feedback |
| `state.play` | Play-vs-Engine: time controls, clocks, skill level, session ID |
| `state.puzzle` | Puzzle system: queue, history, stats, premium, generation status |
| `state.annotations` | Drawing state: arrows, circled/starred/painted squares, gesture tracking |
| `state.lessonBook` | Multi-lesson management: active ID, lesson array |
| `state.openingBook` | Opening reference: TSV rows, UCI/EPD indexes |
| `state.guidedReview` | Guided Review active flag |

There is no immutable state library or proxy — state is mutated directly. The
initialization sequence (`app.js:11327`) sets up all defaults, hydrates persisted
state from localStorage, then calls `renderAll()`.

---

## Initialization Sequence

```javascript
initializeColorTheme();          // Read persisted theme → set <html data-theme>
initializeDefaultSetup();        // Set up standard starting position
hydrateDraft();                  // Restore lesson draft from localStorage
hydratePuzzleState();            // Restore puzzle queue, history, stats, premium
window.__endgamePuzzlePremium = …; // Expose key generator to console
syncAnalysisGameFromTree();      // Sync Chess.js with lesson tree
initializeGuidedReviewController(); // Restore guided review if active
bindEvents();                    // Register all document/board event listeners
loadOpeningBook();               // Fetch and index assets/openings.tsv
renderAll();                     // Full initial render
```

---

## Rendering

Rendering is imperative DOM manipulation — there is no virtual DOM.

### Render Flow

```
user interaction → event handler → mutate state → renderAll()
                                                    │
                              ┌──────────────────────┼──────────────────────┐
                              ▼                      ▼                      ▼
                         renderBoard()         renderTabs()          renderPanels()
                              │                      │
                              ▼                      ▼
                    buildBoardMarkup()     renderSetupPanel() (if active)
                    renderAnnotationOverlay()  renderAnalysisPanel() (if active)
                    renderCapturedPieces()      renderPlayPanel() (if active)
                    syncBoardSize()             renderPuzzlePanel() (if active)
```

### Targeted Rendering

Most handlers call `renderAll()` for simplicity. High-frequency operations
(mouse move during drag, clock ticks) use targeted updates to avoid full re-renders.

### Board Rendering

The board is an 8×8 `<div>` grid inside `#boardGrid`. Each square is:

```html
<div class="board-square light|dark is-setup|is-playable"
     data-square="e2" data-file="e" data-rank="2">
  <div class="board-piece-shell">
    <img class="board-piece" src="./assets/pieces/mpchess/wP.svg" alt="">
  </div>
  <!-- annotation overlays: paint, circle, star -->
</div>
```

Piece images are SVG files from `assets/pieces/mpchess/`. The annotation SVG
overlay (`#boardAnnotationOverlay`) sits on top of the board grid and renders
arrows as `<line>` + `<polygon>` elements. Square-level annotations (paint,
circle, star) are rendered as HTML inside the square div.

---

## Event Handling

Delegated document-level listeners catch most user actions:

| Event | Handler | Purpose |
|---|---|---|
| `click` | `handleDocumentClick` | Tab switching, button clicks, menu toggles, modal interactions, board clicks for move/select |
| `input` | `handleDocumentInput` | Text fields (FEN, title, note, comment) |
| `change` | `handleDocumentChange` | Select dropdowns, checkboxes |
| `paste` | `handleDocumentPaste` | Auto-apply pasted FEN |
| `keydown` | `handleDocumentKeydown` | Arrow keys (tree navigation), Escape (close modals), Enter (premium activation) |
| `mousemove` | `handleDocumentMouseMove` | Annotation gesture drawing, drag hover |
| `mouseup` | `handleDocumentMouseUp` | Commit annotation gesture |
| `contextmenu` | `handleDocumentContextMenu` | Suppress default browser menu |

Board-specific listeners on `dom.boardGrid` handle `mousedown`, `click`,
`contextmenu`, `dragstart`, `dragover`, `drop`, `dragleave`, and `dragend`
for piece movement and drag-and-drop from the palette.

---

## Tab System

Six tabs controlled by `state.activeTab` and `data-active-tab` on the root
element:

| Tab | Panel | Purpose |
|---|---|---|
| `setup` | `dom.setupPanel` | Position builder |
| `analysis` | `dom.analysisPanel` | Engine analysis, lesson tree, annotations |
| `play` | `dom.playPanel` | Play vs Stockfish |
| `puzzle` | `dom.puzzlePanel` | Endgame puzzles |
| `study` | — | Collapses tools panel, focuses the board |
| `lessons` | — | Guided Review / lesson management |

`renderTabs()` toggles `.hidden` and `.is-active` on panel elements and
updates `data-active-tab` on the root element, which CSS uses to show/hide
panels and the tab-chip `.is-active` class.

**Tab switch side effects** (`set-tab` handler, `app.js:8458`):
- Switching away from Play while a game is active stops the game (with reason
  `'Game abandoned by switching tabs.'`)
- Switching to Setup while a puzzle session is active saves the puzzle position
  into `state.setupFen`/`state.setup.pieces` so the Setup board shows the
  puzzle position (captured before `stopPlayGame` terminates the session).
- Switching away from Puzzle while generation is in progress cancels it.
- Switching to Lessons opens Guided Review; switching away closes it.

---

## Engine Architecture

### Stockfish Detection

`ENGINE_BUNDLE_CANDIDATES` (`app.js:46`) defines four possible Stockfish
bundles. `resolveStockfishBundleCandidate()` (`app.js:5418`) tests which files
exist on disk and selects the strongest usable bundle, preferring single-threaded
variants on mobile (coarse-pointer devices).

### Worker Lifecycle

```
createStockfishWorker()
  → new Worker(bundle.workerPath)
  → store bundle metadata in state.engine
  → set up onmessage / onerror handlers

ensureStockfishReady()
  → if not ready: postMessage('uci'), postMessage('isready')
  → wait for 'readyok' or timeout (15s)

startEngineSearch(worker, fen, options)
  → postMessage('ucinewgame')
  → postMessage('setoption name MultiPV value 3')
  → postMessage('setoption name Skill Level value 20')
  → postMessage('position fen ...')
  → postMessage('go depth N') or 'go infinite'

handleWorkerMessage(event)
  → parse 'info' lines → update state.engine (PV lines, depth, eval, nps)
  → parse 'bestmove' → complete search, queue next if continuation

terminateEngineWorker()
  → remove listeners, worker.terminate(), nullify references
```

### Puzzle Engine

The puzzle system creates a separate Stockfish worker via `createEndgamePuzzleApi()`
from `puzzle-api.mjs`. This worker is isolated from the analysis/play engine so
puzzle generation never interferes with active analysis.

### Communication Protocol

All engine communication uses raw UCI text over `postMessage`/`onmessage`.
There is no UCI-to-JSON wrapper. `parseInfoLine()` (`app.js:5324`) regex-parses
`info` lines for score, depth, MultiPV, PV, and node count fields.

---

## Tablebase Integration

### Eligibility Check

`tablebaseEligibilityForFen(fen)` (`app.js:1267`):
- Valid FEN
- No castling rights
- ≤7 total pieces
- ≤4 pieces per side

### Probe Flow

```
toggleAnalysis()
  → isTablebaseEligibleFen(fen)?
    ─YES─→ startTablebaseAnalysisForFen(fen)
             → abort any running engine search
             → fetch('https://tablebase.lichess.ovh/standard?fen=...')
             → normalize payload → hydrate move lines (bounded follow-up probes)
             → display result in eval badge, eval bar, status grid, move lines
             → cache in state.tablebase.cache (Map keyed by FEN)
             → on failure: fallback to Stockfish
    ─NO──→ startStockfishAnalysisForCurrentPosition()
```

The follow-up probe budget (`TABLEBASE_LINE_MAX_REQUESTS` = 80, `TABLEBASE_LINE_MAX_PLIES` = 80)
limits sequential API calls when building SAN continuation lines.

---

## Lesson Tree

### Node Structure

Each position in the lesson tree is a node:

```javascript
{
  id: 'root' | 'n1' | '…',
  parentId: null | string,
  from: null | 'e2',
  to: null | 'e4',
  promotion: null | 'q',
  san: null | 'e4',
  fen: 'rnbqkbnr/pppppppp/8/8/…',
  children: ['n1', 'n3', …],
  selectedChildId: 'n1',
  comment: 'Annotation text'
}
```

### Navigation

- `jumpToAnalysisNode(nodeId)` — sets `currentNodeId`, updates `selectedChildId`
  along the path, syncs Chess.js
- `getAnalysisPathIds(nodeId)` — walks parent pointers to root
- `buildDisplayedLineNodeIds(startNodeId)` — follows `selectedChildId` chain
- Arrow keys (← →) move through the tree (`handleDocumentKeydown`)

### Persistence

The tree is serialized as part of the lesson JSON (`.lesson.json` or
`.lesson-book.json`). `validateAndNormalizeLessonNodes()` (`app.js:3639`)
validates reachability, move legality, FEN consistency, parent/child link
integrity, and cycle freedom on load.

### PGN Conversion

`pgn.mjs` converts between the internal tree structure and PGN text:
- `buildPgnFromLessonTree()` — tree → PGN with variations and comments
- `parsePgnToLessonTree()` — PGN → tree with variations and comments

---

## Puzzle System

### Architecture

```
app.js                          puzzle-api.mjs
─────────                       ──────────────
ensurePuzzleApi()               createEndgamePuzzleApi()
  └─ createEndgamePuzzleApi({     └─ owns a dedicated Stockfish Worker
       resolveWorkerPath            └─ generatePuzzle()
     })                                ├─ buildCandidate()       ← random placement
                                       ├─ evaluateFen()         ← Stockfish eval
                                       ├─ classifyCandidate()   ← match objective
                                       ├─ verifyCandidate()     ← deeper search + optional tablebase
                                       └─ makePuzzle()          ← build puzzle object
```

### Default Puzzles

20 built-in puzzles (`DEFAULT_ENDGAME_PUZZLES`, `app.js:95`) serve as the
initial queue. Each is a static object with FEN, objective, best move, and
evaluation metadata. All were verified against the Syzygy tablebase.

### Puzzle Flow

```
generatePuzzleBatch(count)          ← user clicks "Generate 5 More"
  → puzzleApi.generatePuzzle()      ← Stockfish generates + verifies
  → addPuzzleToQueue(puzzle)        ← validates FEN, deduplicates
  → persistPuzzleState()            ← save to localStorage

startPuzzleSession(puzzle)
  → set up board from puzzle FEN
  → reuse Play-vs-Engine machinery (defending side = Stockfish)
  → stop clock (puzzles are untimed)

finishPuzzleSession(reason)         ← checkmate / draw / resign / timeout
  → evaluatePuzzleOutcome()
  → update solvedCount/failedCount/streak
  → show result modal

**Puzzle → Setup tab sync:** When the user switches from Puzzle to Setup while a
puzzle session is active, the `set-tab` handler captures `state.analysis.currentFen`
before `stopPlayGame`/`finishPuzzleSession` clears the session flag, then copies it
into `state.setupFen`/`state.setup.pieces` so the Setup tab board reflects the puzzle
position. This allows the user to explore or modify the puzzle position on the Setup
board after the puzzle session ends.
```

### Win Objective Checking

`checkPuzzleMaterialObjective()` (`app.js:10761`) compares current material
balance against the puzzle's `startBalance`. If the solver has gained ≥3 pawns
of material (`PUZZLE_WIN_MATERIAL_GAIN`), the puzzle is solved.

### Draw Objective Checking

`evaluatePuzzleOutcome()` (`app.js:10840`) detects:
- Legal draw (stalemate, insufficient material, threefold, 50-move)
- Solver falling below a losing threshold (`DRAW_OBJECTIVE_LOSING_THRESHOLD_CP` = -300)

### Legality Gate

`isPuzzleFenIllegal()` (`app.js:10336`) rejects any FEN where the side to move
is checking the opponent's king. This runs on all puzzle ingestion paths:
queue/history hydration, CSV import, `addPuzzleToQueue`, and `addPuzzleToHistory`.

---

## Setup Board Validation

### `sanitizeSetupState()` (`app.js:4320`)

Validates and normalizes the setup position:
1. Enforces one king per side
2. No pawns on the first or eighth rank
3. Castling rights match king/rook positions
4. Builds canonical FEN

### `isIllegalSetupPosition()` (`app.js:3441`)

Checks both directions:
- Solver king is not in check by the opponent
- Solver is not checking the opponent's king

Uses `Chess.isAttacked()` on both kings explicitly, not `game.isCheck()`
(which depends on `game.turn()`).

---

## Persistence

### localStorage Keys

| Key | Content |
|---|---|
| `setup-analysis-draft-v1` | Full lesson state (title, FEN, tree, annotations, note, practice mode, active tab) |
| `color-theme-v1` | `'light'` or `'dark'` |
| `endgame-puzzle-prefs-v1` | Objective/difficulty/skill/thinkingSpeed preferences |
| `endgame-puzzle-premium-v1` | Premium activation key |
| `endgame-puzzle-free-v1` | Daily free puzzle usage tracking |
| `endgame-puzzle-queue-v1` | Puzzle queue array |
| `endgame-puzzle-history-v1` | Puzzle history array (max 300) |
| `guided-lesson-row-review-v1:*` | Guided Review progress per session |

### Draft Save

`persistDraft()` (`app.js:3927`) serializes the full lesson state to
`setup-analysis-draft-v1` on `beforeunload` and on significant state changes
via a debounced `state.persistTimer`.

### Draft Hydration

`hydrateDraft()` (`app.js:3885`) reads the saved draft, validates the lesson
tree, restores state, and migrates legacy single-lesson formats to the
multi-lesson book structure.

---

## Theme System

CSS custom properties define light and dark variants:

```css
:root { /* light theme variables */ }
[data-theme="dark"] { /* dark theme overrides */ }
```

The theme is set by an inline `<script>` in `index.html` before any rendering
(to prevent flash), read from `localStorage` (`color-theme-v1`), and toggled
via the three-dot menu. State is mirrored in `state.colorTheme`.

---

## Opening Book

`loadOpeningBook()` (`app.js:989`) fetches `assets/openings.tsv` and builds two
indexes:

- **`byUci`** (`Map<UCI prefix, row>`): longest-prefix match for move sequences
- **`byEpd`** (`Map<EPD, row>`): exact-position fallback

`identifyOpeningFromMoves()` (`app.js:1037`) queries both indexes and merges
PGN header data (ECO, Opening, Variation) when available. The result is displayed
in the lesson header via `syncOpeningInfoDisplay()`.

---

## Annotations

### Data Model

```javascript
state.annotations = {
  enabled: false,
  paintedSquares: Set(['e2', 'e4', …]),
  circledSquares: Set(['d5']),
  starredSquares: Set(['f3']),
  arrows: [{ from: 'e2', to: 'e4', color: 'green' }, …],
  gesture: { active, type, startSquare, currentUci, … },
  suppressBoardClickUntil: 0,
  suppressContextMenu: false,
};
```

### SVG Overlay

Annotations are rendered in two layers:

1. **Square-level** — HTML overlays inside each `.board-square` div
   (paint fills, circle outlines, star icons), generated by
   `annotationMarkupForSquare()` (`app.js:6503`)

2. **Arrow layer** — SVG `<line>` + `<polygon>` in `#boardAnnotationOverlay`,
   generated by `buildAnnotationArrowMarkup()` (`app.js:6540`)

### Gesture Recognition

| Gesture | Annotation |
|---|---|
| Right-click + drag | Paints a highlighted square |
| Alt + right-click + drag | Draws an arrow |
| Ctrl + right-click | Places a star |
| Left-click (annotation mode) | Clears all annotations |

---

## Guided Review

`createGuidedReviewController()` from `guided-review.mjs` manages a separate
worksheet-review workflow:

- Accepts `.csv`, `.xlsx`, or `.xls` files
- Parses rows using flexible field aliases (e.g., `title`, `lesson_title`, `name`
  all map to the title field)
- Provides Analysis panel context (engine/tablebase) for each row's FEN
- Persists review progress per session in localStorage
- Reopens automatically on page load if a review was active

---

## Dependencies

| Dependency | Integration |
|---|---|
| **chess.js** (vendor) | Bundled copy in `vendor/chess.js`. PGN parsing via Peggy-generated grammar. No npm. |
| **Stockfish** (vendor) | Pre-compiled browser bundles in `vendor/stockfish/`. Four variants selected at runtime by file-existence detection. |
| **xlsx** (vendor) | Bundled in `vendor/xlsx.full.min.js`. Loaded only when a `.xlsx` file is imported in Guided Review. |

No build step. No package manager. All dependencies are vendored and loaded
as ES modules or plain `<script>` tags.

---

## Key Constants (app.js)

| Constant | Value | Purpose |
|---|---|---|
| `ENGINE_MULTI_PV_COUNT` | 3 | Engine lines to show |
| `ENGINE_READY_TIMEOUT_MS` | 15000 | Worker startup timeout |
| `TABLEBASE_MAX_TOTAL_PIECES` | 7 | Max pieces for tablebase analysis |
| `TABLEBASE_FETCH_TIMEOUT_MS` | 30000 | Tablebase API timeout |
| `TABLEBASE_LINE_MAX_REQUESTS` | 80 | Max follow-up probes for PGN lines |
| `DEFAULT_ANALYSIS_TARGET_DEPTH` | 30 | Default Stockfish search depth |
| `PUZZLE_FREE_PER_DAY` | 3 | Free puzzles before premium |
| `PUZZLE_WIN_MATERIAL_GAIN` | 3 | Pawns of gain for win objective |
| `PUZZLE_HISTORY_MAX` | 300 | Max puzzle history entries |
| `DRAW_OBJECTIVE_LOSING_THRESHOLD_CP` | -300 | Eval below this = solver losing |
