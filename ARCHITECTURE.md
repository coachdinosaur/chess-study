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
├── lessons/
│   ├── index.html              Lesson index / landing page (static HTML)
│   ├── endgame-lesson.css      Shared lesson page styles (~1,116 lines)
│   ├── endgame-lesson.js       Vanilla FEN→board renderer for lesson pages
│   ├── 01-king-pawn-rule-of-square.html
│   ├── 02-pawn-on-the-6th-rank.html
│   ├── 03-knights-pawn-and-key-squares.html
│   ├── 04-distant-opposition-rooks-pawn-imprisoning.html
│   ├── 05-rook-pawn-rule-rook-vs-bishop-knight.html
│   ├── 06-separated-knight-corner-trap-kamsky-bacrot.html
│   └── 07-basic-test-positions.html
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
| `lessons/` | Standalone endgame lesson pages. Each chapter HTML loads `endgame-lesson.css` and `endgame-lesson.js` for static board rendering. An iframe on each page embeds the interactive SPA (`app.js`) at the bottom for hands-on practice. No framework, no build step. |

### Lesson Pages

The `lessons/` directory contains 7 chapter HTML files plus a landing index.
Each chapter page:
1. Renders static chess diagrams using `endgame-lesson.js` (a lightweight
   vanilla-JS FEN→board renderer that mirrors the SPA's board markup).
2. Embeds the full interactive app via an iframe pointing at `index.html` with
   `?embed=1`, enabling the reader to explore positions live.
3. Shares `endgame-lesson.css` for layout, typography, and print/PDF output
   styles (the print stylesheet in that file is designed for
   [Paged.js](https://pagedjs.org/) paginated export).

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

### Focus Mode

When focus mode is active (`state.focusMode`, `app.js:2911`):

1. The page shell gets `class="is-focus-mode"`, which CSS uses to hide the control
   pane, lesson header, tabs, and board foot — only the board remains visible.
2. A floating **focus mode controls bar** (`#focusModeControls`, `index.html:382`)
   appears in the top-right with an Analyze button and an Exit (×) button.
3. A **brand watermark** (`#focusModeBrand`, `index.html:411`) shows the app icon
   in the bottom-right corner of the viewport.
4. Pressing Escape exits focus mode.
5. In `?embed=1` mode, focus mode is entered automatically on load.

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

### Responsive Board Sizing

`syncBoardSize()` (`app.js:6974`) computes `--board-size` (a pixel CSS custom
property) so the board-square grid, eval bar, turn marker, captured-piece rows,
and frame all scale proportionally.

**Desktop / tablet landscape:** The board fits within both the available column
width (workspace minus the control pane) and the viewport height (minus captured
rows, padding, and gaps).  Iterative refinement balances the board size against
the captured-row heights that depend on it.  The result is capped at 42 rem
(56 rem in Focus mode).

**Mobile portrait** (`(max-width: 760px) and (orientation: portrait)`):
The board spans nearly the full viewport width.  The sizing accounts for the
eval-bar sidebar (eval rail + turn-marker badge + gap) so that the board +
sidebar fits without horizontal overflow:

```javascript
// app.js — syncBoardSize() mobile portrait path
const evalRailWidth = cssLengthToPx(columnStyles.getPropertyValue('--eval-rail-track-width'), …);
const turnSize     = cssLengthToPx(columnStyles.getPropertyValue('--turn-marker-size'), …);
const turnGap      = cssLengthToPx(columnStyles.getPropertyValue('--turn-marker-gap'), …);
const sideOffset   = evalRailWidth + turnSize + turnGap;
const boardSize    = Math.floor(Math.max(0, vw - sideOffset * 2 - framePadding * 2 - 2));
```

The `sideOffset * 2` subtraction leaves equal gaps on the left (where the
sidebar sits) and the right (visual balance), centering the board.

### Mobile Engine Lines Slot

On mobile viewports, engine PV lines are rendered into a dedicated
`#mobileEngineLinesSlot` div (`index.html:137`) placed below the board in DOM
order. The slot is hidden via CSS on desktop and shown on mobile. The rendering
code (`app.js:7441, 7456`) populates both the desktop notation panel and this
mobile slot so engine output is always visible below the board on small screens.

**Mobile CSS** (`styles.css` media query) flattens the outer board enclosure:
- `.board-pane` uses `margin-inline: -0.55rem` to cancel page-shell padding
- `.board-column` sets `max-width: none; width: 100%`
- `.board-frame` drops its border, padding, background, and shadow
- `.captured-row` drops border, shadow, background; uses `var(--board-size)` width
- Eval rail, turn marker, board coordinates, and captured-cell sizing are all
  reduced for the smaller screen

---

## Custom Select Dropdowns

Settings panels (Play, Puzzle, Setup) use a custom select widget for choices like
time control, side, skill level, and objective. The widget consists of a trigger
button (`data-action="toggle-custom-select"`) and a popup menu. On toggle,
`app.js:8440` positions the menu upward or downward based on available viewport
space. Selecting an option (`data-action="select-custom-option"`, `app.js:8474`)
dispatches a synthetic `change` event on a hidden native `<select>` element so
existing `change` handlers can process the value. Click-outside detection closes
the menu.

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
| `resize` | `handleViewportResize` | Debounced board re-layout on viewport/visualViewport change |
| `blur` (window) | `cancelAnnotationGesture` | Cancel in-progress annotation on window blur |

Board-specific listeners on `dom.boardGrid` handle `mousedown`, `click`,
`contextmenu`, `dragstart`, `dragover`, `drop`, `dragleave`, and `dragend`
for piece movement and drag-and-drop from the palette.

### Action Handlers (data-action)

The `handleDocumentClick` switch (`app.js:8438`) dispatches ~70 named actions.
Major groups not detailed elsewhere in this document:

| Group | Actions | Purpose |
|---|---|---|
| **Lesson book** | `new-lesson`, `duplicate-lesson`, `delete-lesson`, `select-lesson`, `toggle-lesson-picker`, `toggle-lesson-book-actions`, `toggle-lesson-actions` | Multi-lesson CRUD and menu toggles |
| **File I/O** | `open-lesson`, `save-lesson`, `import-pgn`, `export-pgn`, `copy-fen`, `open-guided-review` | File import/export and clipboard |
| **Setup** | `reset-setup`, `clear-board`, `flip-board`, `toggle-piece-tool`, `set-palette-color`, `set-active-color`, `scan-board`, `apply-fen`, `reset-fen`, `toggle-advanced`, `toggle-castling`, `set-en-passant` | Position builder controls |
| **Practice** | `start-practice`, `restart-practice`, `stop-practice`, `set-practice-kind`, `practice-hint`, `practice-reveal` | Practice session lifecycle |
| **Puzzle** | `new-puzzle`, `generate-puzzle-batch`, `cancel-batch-generation`, `retry-puzzle`, `give-up-puzzle`, `skip-puzzle`, `puzzle-next`, `replay-previous-puzzle`, `restore-default-puzzles`, `clear-puzzle-history`, `save-puzzle-csv`, `load-puzzle-csv`, `open-premium-modal`, `activate-premium` | Puzzle queue, generation, CSV, premium |
| **View** | `toggle-tools`, `toggle-note`, `toggle-pgn-comments`, `toggle-pgn-comment-collapse`, `toggle-pv-lines`, `toggle-fullscreen`, `enter-focus-mode`, `exit-focus-mode`, `toggle-color-theme`, `toggle-last-move-arrow` | Panel and display toggles |
| **Play** | `start-play`, `stop-play`, `offer-draw`, `set-play-time`, `set-play-side`, `set-play-speed`, `set-play-start-position`, `set-play-skill` | Play-vs-Engine lifecycle and settings |
| **Navigation** | `navigate-start`, `navigate-back`, `navigate-forward`, `navigate-end`, `jump-node`, `reset-analysis` | Tree navigation |
| **PGN** | `browse-pgn-games`, `clear-pgn-games`, `load-pgn-game`, `dismiss-pgn-game-picker` | Multi-game PGN picker |

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

### Play Clock System

During an active Play-vs-Engine game, `startPlayClock()` (`app.js:9958`) starts a
100 ms interval timer. Each tick (`tickPlayClock()`, `app.js:9990`):
1. Decrements the active side's remaining time by 100 ms.
2. Formats both clocks via `formatTime()` (`app.js:10021`) as `M:SS.t`.
3. Highlights the active clock with `class="play-clock is-active"`.
4. Checks for flag fall (time ≤ 0) and ends the game if detected.

`stopPlayClock()` (`app.js:9967`) clears the interval when the game ends.

### Engine Stall Watchdog

When a Stockfish search is launched in Play mode, an 8-second stall timer is set.
If no `info` or `bestmove` message arrives within that window, the worker is
terminated and a new one is created for one automatic retry. If both attempts
fail, a "Stockfish stalled" message is shown in the Play panel.

---

## Embed Mode

The app supports embedding as an interactive board inside lesson pages and third-party
sites via the `?embed=1` query parameter.

### Detection

An inline `<script>` in `index.html` reads `?embed=1` or `?embed=true` from the URL
before app.js loads and sets `<html data-embed="1">`. `applyEmbedDeepLink()`
(`app.js:11342`) then sets `state.embedMode`, applies an optional `?fen=...` deep-link,
and enters Focus mode.

### PostMessage Protocol

A `window.addEventListener('message', …)` listener (`bindEmbedMessageListener()`,
`app.js:11364`) accepts:

| `data.type` | Payload | Effect |
|---|---|---|
| `loadFen` | `{ fen, mark?: string[] }` | Loads a FEN position; optionally paints highlighted squares |
| `setOrientation` | `{ orientation: 'white' \| 'black' }` | Flips the board |
| `setAnnotations` | `{ mark: string[] }` | Replaces painted-square annotations |

### Analysis Relay

When analysis results change, `postEmbedAnalysisMessage()` (`app.js:5356`) sends a
message to the parent frame with `{ visible, title, evalLabel, summary, pvHtml }`.
The parent lesson page can display the real-time evaluation inline.

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

### PGN Game Picker

When a PGN file containing multiple games is imported, the parser stores the game
list in `state.pendingPgnGames` (`app.js:815`). A container below the lesson header
shows the filename and game count with two buttons:

- **Browse Games** (`data-action="browse-pgn-games"`) — opens a modal
  (`#pgnGamePickerModal`) listing each game with headers; clicking "Load Game"
  selects one and rebuilds the lesson tree from it.
- **Clear** (`data-action="clear-pgn-games"`) — discards all pending games.

The game-picker modal also has a "Clear Imported PGN Games" button for batch cleanup.

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

### Puzzle Board Instruction Banner

During an active puzzle session, `renderPuzzleBoardInstruction()` (`app.js:11144`)
shows a contextual instruction banner (`#puzzleBoardInstruction`) above the board
foot. The text is generated by `puzzleObjectiveInstruction()` (`app.js:10615`) and
describes the solver's side, the objective, and the available mate distance or
material goal (e.g. "You play White. Checkmate Stockfish — mate in 2 is available.").

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

### Puzzle Key Checksum

`puzzleKeyChecksum()` (`app.js:10238`) validates premium activation keys (format
`CHESS-XXXX-XXXX-CC`). The checksum is a deterministic offline algorithm — no
server or network call is involved. The generator is exposed as
`window.__endgamePuzzlePremium.generateKey()`.

### Legality Gate

`isPuzzleFenIllegal()` (`app.js:10336`) rejects any FEN where the side to move
is checking the opponent's king. This runs on all puzzle ingestion paths:
queue/history hydration, CSV import, `addPuzzleToQueue`, and `addPuzzleToHistory`.

---

## Scan Board Feature

The Setup panel includes a **Scan board** button (`data-action="scan-board"`,
`app.js:8604`) that opens a file picker (`.png`, `.jpg`, `.jpeg`). The selected
image is sent to `http://127.0.0.1:8765/predict-fen` (the local scanner helper
server, `scanner_server.py`). The response is parsed and applied as a FEN to the
setup board. Scan status is tracked in `state.scanStatus` / `state.scanStatusType`
(`app.js:668`) and rendered as success/danger/warning banners in the Setup panel.

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

### Lesson File Status

After save/open/import operations, `syncLessonFileStatus()` (`app.js:2305`) updates
a transient status line (`#lessonFileStatus`, `index.html:300`) with a message
(e.g. "Lesson saved", "Lesson opened", "PGN imported"). The status auto-clears on
the next non-persistence action.

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

## Key Utility Functions (app.js)

| Function | Purpose |
|---|---|
| `escapeHtml(value)` (`app.js:895`) | XSS-safe HTML escaping for all dynamic text |
| `downloadTextFile(fileName, text, mimeType)` (`app.js:3974`) | Triggers a browser file download for lesson/CSV/PNG exports |
| `withPreservedScroll(container, fn)` (`app.js:11337`) | Wraps a DOM mutation so scroll position is restored after re-render |
| `scheduleBoardLayoutSync()` (`app.js:2883`) | Debounced (rAF) re-layout of board size on viewport resize; also handles `visualViewport` resize on mobile |

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
