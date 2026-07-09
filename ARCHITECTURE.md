# Architecture

## Overview

This repository is a **chess teaching platform** composed of three cooperating,
framework-free subsystems:

**2026-07-09 update:** the Pawn Level lesson site now also includes Module 4
(`lessons/pawn-m4-lesson-*.html`) and uses shared floating teacher-board assets
(`lessons/pawn-teacher-board.js` / `.css`) across the Pawn lessons. The SPA
annotation system now stores per-annotation colors (`green`, `orange`, `blue`)
instead of treating all markings as one theme-colored layer.

1. **Interactive Study SPA** (`index.html` + `app.js`) — a browser-based chess
   study and analysis single-page application (endgame study, practice, puzzles,
   Play-vs-Engine, board scanning, lesson tree). Pure ES modules with direct DOM
   manipulation; a single global `state` object drives rendering across six tabs.
2. **Pawn Level Lesson Site** (`lessons/pawn-*.html`, `lessons/pawn-m2-*.html`,
   `lessons/pawn-m3-*.html`, `lessons/pawn-m4-*.html`, `lessons/pawn-index.html`)
   — a beginner curriculum of static HTML lesson pages (no build step, no iframe
   to the SPA). The pages carry local lesson content and diagrams, plus shared
   lesson helpers. Four modules are published: Module 1 foundations, Module 2
   piece movement, Module 3 attack/check/stalemate, and Module 4 rook/queen
   checkmates and checkmate-vs-stalemate practice.
3. **Piece Asset Pipeline** (`mpchess-pieces/` → `assets/pieces/mpchess/*.svg`) — the
   `mpchess` chess font is authored in MetaPost/LuaLaTeX and exported to the 12
   Unicode-free SVG piece images used by both the SPA and the lesson pages.

There is **no framework and no build step** for the SPA or lessons; dependencies
are vendored. Lesson pages are plain HTML/CSS with inline SVG diagrams. The SPA is
embedded via `<iframe>` only by the older *numbered endgame* lessons
(`lessons/01-…07`), not by the Pawn Level pages.

---

## Directory Layout

```
chess-study/
├── index.html                  SPA entry point — page shell, SVG overlays, modals
├── app.js                      Main application (~11,340 lines)
├── styles.css                  All SPA styles (~4,430 lines)
├── pgn.mjs                     PGN import/export with tree conversion
├── puzzle-api.mjs              Endgame puzzle generation (Stockfish worker)
├── guided-review.mjs           CSV/XLSX lesson-row review controller
├── text-normalization.mjs      Unicode repair and punctuation normalization
├── lessons/                    Published lesson pages (static HTML)
│   ├── pawn-index.html         Pawn Level curriculum table of contents
│   ├── pawn-01-…-pawn-11-…      Pawn Level MODULE 1 lessons (self-contained HTML)
│   ├── pawn-m2-lesson-01-…      Pawn Level MODULE 2 lessons (self-contained HTML)
│   │   └── … -lesson-13-…
│   ├── pawn-m3-lesson-01-…      Pawn Level MODULE 3 lessons (self-contained HTML)
│   │   └── … -lesson-12-…
│   ├── index.html               (legacy) Endgame lesson index / landing page
│   ├── endgame-lesson.css       Shared lesson page styles (~1,116 lines)
│   ├── endgame-lesson.js        Vanilla FEN→board renderer for endgame pages
│   ├── 01-king-pawn-rule-of-square.html
│   ├── 02-pawn-on-the-6th-rank.html
│   ├── 03-knights-pawn-and-key-squares.html
│   ├── 04-distant-opposition-rooks-pawn-imprisoning.html
│   ├── 05-rook-pawn-rule-rook-vs-bishop-knight.html
│   ├── 06-separated-knight-corner-trap-kamsky-bacrot.html
│   └── 07-basic-test-positions.html
├── lesson_source/              Authored SOURCE manuscripts for Pawn Module 1
├── lesson_source2/             Authored SOURCE manuscripts for Pawn Module 2
│   ├── pawn-m1-2-lesson-01-how-to-move-the-king.html
│   ├── pawn-m1-2-lesson-02-how-to-capture-with-the-king.html
│   ├── pawn-m1-2-lesson-03-how-to-move-the-knight.html
│   ├── pawn-m1-2-lesson-04-how-to-capture-with-the-knight.html
│   ├── pawn-m1-2-lesson-05-how-to-move-the-pawn.html
│   ├── pawn-m1-2-lesson-06-pawn-capture.html
│   ├── pawn-m1-2-lesson-07-pawn-promotion.html
│   ├── pawn-m1-2-lesson-08-activity-practice-moving-the-king-knight-and-pawn.html
│   ├── pawn-m1-2-lesson-09-how-to-move-the-rook.html
│   ├── pawn-m1-2-lesson-10-how-to-capture-with-the-rook.html
│   ├── pawn-m1-2-lesson-11-how-to-move-the-bishop.html
│   ├── pawn-m1-2-lesson-12-how-to-move-the-queen.html
│   └── pawn-m1-2-lesson-13-activity-practice-moving-the-rook-bishop-and-queen.html
├── lesson_source/              Authored SOURCE manuscripts for Pawn Module 1
│   ├── introducing_game_of_chess_lesson.html
│   ├── basic-chess-rules-following-introducing-format.html
│   ├── capturing-a-piece-following-introducing-format.html
│   ├── chess-terms-following-introducing-format.html
│   ├── chessboard-lesson-following-introducing-format.html
│   ├── lesson-3-files-ranks-diagonals-improved-following-introducing-format.html
│   ├── pawn-lesson-4-scorekeeping-algebraic-notation-following-introducing-format.html
│   ├── pawn-lesson-5-algebraic-notation-examples-following-introducing-format.html
│   ├── piece-values-following-introducing-format.html
│   ├── setting-up-chessboard-following-introducing-format.html
│   └── the-chessmen-following-introducing-format.html
├── lesson_source3/             Authored SOURCE manuscripts for Pawn Module 3
│   ├── pawn-level-module-3-how-to-win-a-chess-game-formatted.html
│   ├── pawn-level-module-3-lesson-2-attack-formatted.html
│   ├── pawn-level-module-3-lesson-3-check-formatted.html
│   ├── pawn-level-module-3-lesson-4-illegal-move-formatted.html
│   ├── pawn-level-module-3-lesson-5-escaping-a-check-formatted.html
│   ├── pawn-level-module-3-lesson-6-how-do-you-win-a-chess-game-formatted.html
│   ├── pawn-level-module-3-lesson-7-stalemate-formatted.html
│   ├── pawn-level-module-3-lesson-8-activity-check-the-king-formatted.html
│   ├── pawn-level-module-3-lesson-9-activity-capture-the-checker-formatted.html
│   ├── pawn-level-module-3-lesson-10-activity-block-the-check-formatted.html
│   ├── pawn-level-module-3-lesson-11-activity-is-this-a-checkmate-formatted.html
│   └── pawn-level-module-3-lesson-12-activity-is-this-a-stalemate-formatted.html
├── local_server.py             Python HTTP server with COOP/COEP headers
├── scanner_server.py           Chessboard image recognition HTTP server
├── scanner_predict.py          Image-to-FEN prediction logic
├── start-local.ps1             Windows deployment script
├── assets/
│   ├── pieces/mpchess/         SVG piece images (wK.svg, bQ.svg, …) — 12 files
│   ├── openings.tsv            Opening book TSV (ECO, name, PGN, UCI, EPD)
│   ├── Inter/                  Inter variable font (body text)
│   ├── Manrope/                Manrope variable font (headings)
│   └── social-preview.png      Open Graph / Twitter card image
├── mpchess-pieces/             Piece font SOURCE (MetaPost + LuaLaTeX)
│   ├── metapost/               MetaPost sources for each glyph
│   ├── lualatex/               LuaLaTeX build scripts
│   ├── svg/                    Exported SVG glyphs
│   └── mpchess font.*          Compiled font binaries (ttf/otf/eot/svg)
├── vendor/
│   ├── chess.js                Chess.js (PGN parser, move validation, FEN)
│   ├── stockfish/              Stockfish browser bundles (4 variants)
│   └── xlsx.full.min.js        XLSX parsing for Guided Review
└── tools/
    ├── test-puzzle-api.mjs     Puzzle API unit tests
    ├── fetch_openings.js       Opening book data fetcher
    └── generate_openings.mjs   Opening book generator
```

Directory note: the published `lessons/` folder now also includes
`pawn-m4-lesson-01-...-10` and the shared `pawn-teacher-board.js` /
`pawn-teacher-board.css` files used by the Pawn lesson pages. The tree above is
kept as a broad map; the Pawn section below is the current source of truth for
module coverage and shared lesson helpers.

---

# Subsystem A — Interactive Study SPA

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
| `lessons/` (numbered) | Standalone endgame lesson pages. Each chapter HTML loads `endgame-lesson.css` and `endgame-lesson.js` for static board rendering, and embeds the interactive SPA via an `<iframe>` at the bottom (`index.html?embed=1`) for hands-on practice. No framework, no build step. |

### Lesson Pages (numbered endgame)

The `lessons/01-…07` directory contains 7 chapter HTML files plus a landing index.
Each chapter page:
1. Renders static chess diagrams using `endgame-lesson.js` (a lightweight
   vanilla-JS FEN→board renderer that mirrors the SPA's board markup).
2. Embeds the full interactive app via an iframe pointing at `index.html` with
   `?embed=1`, enabling the reader to explore positions live.
3. Shares `endgame-lesson.css` for layout, typography, and print/PDF output
   styles (the print stylesheet in that file is designed for
   [Paged.js](https://pagedjs.org/) paginated export).

Recent responsive CSS updates in `endgame-lesson.css` keep lesson diagrams from
collapsing on narrow screens: `.diagram` is capped with `width: min(100%, 760px)`
in the general responsive path, the nested `.board` uses a stable aspect ratio,
and the narrowest breakpoint lets diagrams bleed slightly wider than the content
column for edge-to-edge board readability.

---

## State Management (SPA)

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

## Initialization Sequence (SPA)

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

## Rendering (SPA)

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

In board-only focus mode, `.page-shell.is-board-only.is-focus-mode .board-column`
also constrains its max height to the board shell plus captured-piece rows. This
prevents the maximized board view from growing past the viewport when captured
rows are visible.

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

Current mobile portrait sizing hides the turn marker, so only the eval rail
reserves horizontal space. The active formula computes `mobileBoardSize` from
the viewport width minus `evalRailWidth`; temporary debug logging and the old
on-screen board-size badge were removed.

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

## Event Handling (SPA)

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

## Tab System (SPA)

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

## Embed Mode (SPA)

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

## Engine Architecture (SPA)

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

## Tablebase Integration (SPA)

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

## Lesson Tree (SPA)

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

## Puzzle System (SPA)

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

## Scan Board Feature (SPA)

The Setup panel includes a **Scan board** button (`data-action="scan-board"`,
`app.js:8604`) that opens a file picker (`.png`, `.jpg`, `.jpeg`). The selected
image is sent to `http://127.0.0.1:8765/predict-fen` (the local scanner helper
server, `scanner_server.py`). The response is parsed and applied as a FEN to the
setup board. Scan status is tracked in `state.scanStatus` / `state.scanStatusType`
(`app.js:668`) and rendered as success/danger/warning banners in the Setup panel.

---

## Setup Board Validation (SPA)

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

## Persistence (SPA)

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

## Theme System (SPA)

CSS custom properties define light and dark variants:

```css
:root { /* light theme variables */ }
[data-theme="dark"] { /* dark theme overrides */ }
```

The theme is set by an inline `<script>` in `index.html` before any rendering
(to prevent flash), read from `localStorage` (`color-theme-v1`), and toggled
via the three-dot menu. State is mirrored in `state.colorTheme`.

### Three-Dot Menu Navigation

The main lesson overflow menu (`#lessonActionsMenu`) groups file/lesson, view,
engine/PGN, and toggle actions. It also includes a top-level **Lesson index**
entry in the File & Lesson submenu (`data-action="open-lesson-index"`), which
navigates the SPA to `./lessons/index.html`. This is a normal menu action handled
by the central `handleDocumentClick()` action switch rather than a separate link
component.

---

## Opening Book (SPA)

`loadOpeningBook()` (`app.js:989`) fetches `assets/openings.tsv` and builds two
indexes:

- **`byUci`** (`Map<UCI prefix, row>`): longest-prefix match for move sequences
- **`byEpd`** (`Map<EPD, row>`): exact-position fallback

`identifyOpeningFromMoves()` (`app.js:1037`) queries both indexes and merges
PGN header data (ECO, Opening, Variation) when available. The result is displayed
in the lesson header via `syncOpeningInfoDisplay()`.

---

## Annotations (SPA)

### Data Model

```javascript
state.annotations = {
  enabled: false,
  paintedSquares: Map([['e2', 'green'], ['e4', 'orange']]),
  circledSquares: Map([['d5', 'blue']]),
  starredSquares: Map([['f3', 'blue']]),
  arrows: [{ from: 'e2', to: 'e4', color: 'green' }, ...],
  gesture: { active, button, mode, color, startSquare, lastSquare, dragged },
  suppressBoardClickUntil: 0,
  suppressContextMenu: false,
};
```

Current square annotations are `Map<Square, Color>` internally. `green` is the
default color, `ctrlKey` selects `orange`, and `shiftKey` selects `blue`.
Lesson payloads remain backward-compatible with legacy arrays of square strings;
non-green square marks serialize as `{ square, color }`, while arrows serialize
as `{ from, to, color }` and may omit `color` for default green.

### SVG Overlay

Annotations are rendered in two layers:

1. **Square-level** — HTML overlays inside each `.board-square` div
   (paint fills, circle outlines, star icons), generated by
   `annotationMarkupForSquare()` (`app.js:6503`)
2. **Arrow layer** — SVG `<line>` + `<polygon>` in `#boardAnnotationOverlay`,
   generated by `buildAnnotationArrowMarkup()` (`app.js:6540`)

Color is applied by adding `is-orange` or `is-blue` classes to the square overlay,
arrow stroke, and arrowhead elements. The unclassified/default path continues to
use the theme-driven green CSS variables (`--annotation-paint`,
`--annotation-ring`, `--annotation-star`, `--annotation-arrow`).

### Gesture Recognition

| Gesture | Annotation |
|---|---|
| Right-click + drag | Paints highlighted squares |
| Right-click release on same square | Toggles a circle |
| Alt + right-click + drag | Draws an arrow |
| Ctrl modifier | Orange annotation color |
| Shift modifier | Blue annotation color |
| Ctrl + Shift + right-click | Places a star (blue under the current modifier rule) |
| Left-click (annotation mode) | Clears all annotations |

---

## Guided Review (SPA)

`createGuidedReviewController()` from `guided-review.mjs` manages a separate
worksheet-review workflow:

- Accepts `.csv`, `.xlsx`, or `.xls` files
- Parses rows using flexible field aliases (e.g., `title`, `lesson_title`, `name`
  all map to the title field)
- Provides Analysis panel context (engine/tablebase) for each row's FEN
- Persists review progress per session in localStorage
- Reopens automatically on page load if a review was active

---

## Dependencies (SPA)

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

---

# Subsystem B — Pawn Level Lesson Site

A standalone beginner curriculum. Unlike the numbered endgame lessons, these
pages are static lesson documents: each `pawn-*.html` / `pawn-m2-*.html` /
`pawn-m3-*.html` / `pawn-m4-*.html` file carries its own lesson content,
lesson-local `<style>` block, and any inline SVG it needs, and does **not** embed
the SPA. They share the piece SVGs plus common lesson helper CSS/JS.

Current Pawn Level pages also load shared lesson helpers:
`endgame-lesson.css`, `endgame-lesson.js`, `pawn-teacher-board.css`, and
`pawn-teacher-board.js`. The teacher-board assets provide the floating board
overlay used across the lesson pages; cache-busted `?v=20260709-teacher-max1`
references indicate the maximize-capable version.

## Modules

| Module | Lessons | Topic |
|---|---|---|
| **Module 1** | `pawn-01` … `pawn-11` | Foundations: what chess is, the board, files/ranks/diagonals, notation, capturing, setup, rules, the chessmen, piece values |
| **Module 2** | `pawn-m2-lesson-01` … `pawn-m2-lesson-13` | How the pieces move: king, knight, pawn (move/capture/promotion), rook, bishop, queen, and practice activities |
| **Module 3** | `pawn-m3-lesson-01` … `pawn-m3-lesson-12` | How to win: attack, check, illegal moves, escaping check, stalemate, and hands-on check/stalemate/capture/block activities |
| **Module 4** | `pawn-m4-lesson-01` … `pawn-m4-lesson-10` | Rook and queen checkmates, double-rook mate, stalemate examples, and checkmate-or-stalemate practice |

## Page Shell (common to all Pawn Level pages)

Every Pawn Level lesson page shares the same structural shell:

- A sticky `.topbar` with the lesson title (brand), a **Back to Pawn Index** link,
  a **theme toggle** button, and a **Print / Save PDF** button.
- A hero section (title, lead paragraph, objective grid) followed by a two-column
  `.layout` with a sticky table-of-contents (`<aside class="toc">`) and the lesson
  `<main>` (numbered `.lesson-section` blocks).
- Inline `<script>` at the end of `<body>` that wires the theme toggle and a
  scroll-progress bar (`#progressBar`). Theme state is persisted to
  `localStorage` under `chess-lesson-theme` (some pages use `lesson-theme-v1`).

This shell is hand-authored per page (no templating engine), so visual/behavioral
changes must be applied to each file individually.

## Floating Teacher Board

Pawn lesson pages load `pawn-teacher-board.js` and `pawn-teacher-board.css` as a
shared floating board overlay. The script reads lesson-level attributes such as
`data-teacher-fen`, `data-piece-base`, and orientation hooks, then creates a
movable panel with setup and annotation tools. The panel can be closed,
minimized, or maximized:

- `is-minimized` hides the body/setup/tool regions while leaving the header.
- `is-maximized` expands the panel to the viewport with responsive insets and a
  stronger modal-style shadow.
- The `Max` header button toggles to `Restore`; closing or minimizing clears the
  maximized state.

## Lesson Source Pipeline

Authored manuscripts live in `lesson_source/` (Module 1), `lesson_source2/`
(Module 2), and `lesson_source3/` (Module 3). They are the working copies; the
**published** pages are the copies in `lessons/`. The naming transforms are:

| Source file | Published file |
|---|---|
| `lesson_source/introducing_game_of_chess_lesson.html` | `lessons/pawn-01-introducing-the-game-of-chess.html` |
| `lesson_source/*-following-introducing-format.html` | `lessons/pawn-02 … pawn-11` (per lesson) |
| `lesson_source2/pawn-m1-2-lesson-NN-*.html` | `lessons/pawn-m2-lesson-NN-*.html` (rename + s/Module 1-2/Module 2/) |
| `lesson_source3/pawn-level-module-3-*-formatted.html` | `lessons/pawn-m3-lesson-NN-*.html` |

Publication is a manual copy/edit step (there is no build script in `tools/` that
performs it). When updating lesson content, edit the source manuscript **and** the
published `lessons/` copy, or re-sync them, to avoid drift.

## Index Page

`lessons/pawn-index.html` is the Pawn Level table of contents. It lists all four
modules and links to every lesson. It reuses `endgame-lesson.css` for layout and
exposes `data-piece-base`, `data-app-path`, and `data-orientation` attributes on
`<html>` (the same hook contract the numbered endgame pages use), but it does not
itself embed the SPA.

---

# Subsystem B — Lesson Diagram & Asset Conventions

To keep the static lessons consistent and editable, the curriculum follows a set
of shared diagram conventions. These were standardized so that every Pawn Level
board diagram looks the same and every arrow/star renders reliably.

## Board rendering styles

Pawn Level lesson diagrams use **two** board styles:

1. **HTML/CSS coordinate board** — used where the lesson teaches board geometry
   (e.g. `pawn-03-files-ranks-diagonals.html`). An 8×8 CSS grid of `.square`
   elements with `.light`/`.dark` classes, file/rank coordinate labels around the
   edge, and `position: relative` squares so overlays can be absolutely centered.
   Highlighted files/ranks use `::before`/`::after` pseudo-element washes.
2. **Inline SVG board** — used for move/attack/capture diagrams (Module 1
   `pawn-04`–`pawn-10`, and all Module 2, Module 3, and Module 4 lessons). A hand-built
   `<svg>` with a `<rect>` background, a `<g>` of square `<rect>`s, optional
   highlight rects, `<image>` piece glyphs from `../assets/pieces/mpchess/`, and
   an arrow overlay.

Both styles orient the board with **rank 8 at the top, rank 1 at the bottom,
files a→h left→right** (White at the bottom).

## Star convention (coordinate boards)

Diagonal/marker stars on the HTML/CSS boards are plain `★` text glyphs
(`.star`, `.preview-star`) centered inside their square:

```css
.star {
  position: absolute;        /* square is position: relative */
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);   /* exact square-center */
  z-index: 3;
  font-size: clamp(1.15rem, 3.2vw, 2.1rem);
  line-height: 1;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.38));
  -webkit-text-stroke: 1.4px #fff;
  text-shadow: 0 0 10px rgba(0,0,0,.35);
}
```

Color variants: `.star.neutral` (white, dark stroke), `.star.red`
(`var(--red)`), `.star.blue` (`var(--blue)`), `.star.yellow` (`var(--yellow)`).
Absolute `translate(-50%,-50%)` centering (rather than grid `place-items:center`)
guarantees the glyph sits at the true square center regardless of font metrics,
so diagonal star rows form a clean line.

## Arrow convention (Module 3 is the source of truth)

All Module 1 chessboard arrows were aligned to the Module 3 arrow implementation.
A chessboard instructional arrow is:

- A `<marker>` defined in `<defs>`, one per color used:
  ```html
  <marker id="arrowhead" viewBox="0 0 14 14" markerWidth="14" markerHeight="14"
          refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
    <path d="M0,0 L14,7 L0,14 Z" fill="#16a34a"/>
  </marker>
  ```
  - `markerUnits="userSpaceOnUse"` keeps the head a **fixed 14px** (medium) size
    regardless of stroke width.
  - `refX="12"` places the tip near the line end; the path is a filled triangle.
- A line/path referencing it: `marker-end="url(#arrowhead)"`, with
  `stroke-linecap="round"` and **`stroke-width="5"`** (solid, or
  `stroke-dasharray:10 8` for the "attack" red variant).
- **Endpoint shortening:** arrows that point *to* an occupied square stop short of
  the piece so the arrowhead is not hidden underneath it; arrows that *start* from
  an occupied square begin at the piece's edge rather than its center.
- **Layering order** within each board SVG: board squares → highlights → piece
  images → arrow overlay → coordinate labels. Drawing the arrow *after* the pieces
  keeps the head visible on top.

Module 1 pages that contain board arrows and follow this convention:
`pawn-04`, `pawn-05`, `pawn-06`, `pawn-09`, `pawn-10`. The HTML/CSS coordinate
boards (e.g. `pawn-03`) have no move arrows.

## Q&A collapsible pattern

Every question-and-answer / review section across the Pawn Level lessons uses the
same semantic, collapsible markup:

```html
<details class="quiz">
  <summary>Question text here</summary>
  <p>Answer text here.</p>
</details>
```

with the canonical styling (identical in every lesson):

```css
details.quiz {
  border: 1px solid var(--line);
  background: rgba(255,255,255,.055);
  border-radius: 16px;
  padding: .9rem 1rem;
  margin-top: .75rem;
}
details.quiz summary { cursor: pointer; font-weight: 800; }
details.quiz p { color: var(--muted); margin-bottom: 0; }
```

The question stays visible in the collapsed state; the answer is revealed on
expand. Practice-card style blocks were converted to this pattern so all Q&A is
consistent.

---

# Subsystem C — Piece Asset Pipeline

## Source: `mpchess-pieces/`

The `mpchess` chess font is the single source of truth for piece artwork. It is
authored as vector glyphs:

- `mpchess-pieces/metapost/` — MetaPost source for each piece glyph.
- `mpchess-pieces/lualatex/` — LuaLaTeX build scripts that compile the font.
- `mpchess-pieces/svg/` — exported SVG glyphs.
- `mpchess-pieces/mpchess font.*` — compiled font binaries (ttf/otf/eot/svg).

A `LICENSE` sits alongside the font sources.

## Output: `assets/pieces/mpchess/`

The published, web-ready set is 12 SVG files, one per piece:

```
bB.svg bK.svg bN.svg bP.svg bQ.svg bR.svg
wB.svg wK.svg wN.svg wP.svg wQ.svg wR.svg
```

These are referenced by:
- the SPA board (`src="./assets/pieces/mpchess/wK.svg"`), and
- the lesson pages (`src="../assets/pieces/mpchess/wK.svg"`).

Because lessons consume the **same** SVGs as the SPA, piece artwork stays
consistent across the whole site, and a change to the piece set only needs to land
in `assets/pieces/mpchess/`.

---

## Cross-cutting: no-build philosophy

- The SPA has **no framework and no bundler**; `app.js`, `styles.css`, and the
  `vendor/*` modules are served as-is.
- Lesson pages are **static HTML** with inline `<style>`/`<script>` and inline SVG
  diagrams; no transpilation.
- All third-party code (chess.js, Stockfish, xlsx) is **vendored** under
  `vendor/`.
- Shared visual identity is achieved through **convention** (the CSS variables,
  board/star/arrow/Q&A rules above) rather than a shared component library, so
  each lesson file remains independently openable.

## Conventions checklist (for contributors)

When editing Pawn Level lessons, preserve:

- [ ] Board orientation: rank 8 top, rank 1 bottom, a–h left→right.
- [ ] Stars: absolute `translate(-50%,-50%)` centering; use `.neutral/.red/.blue/.yellow`.
- [ ] Arrows: `userSpaceOnUse` 14px filled-triangle marker; `stroke-width="5"`;
      endpoints shortened so heads are never hidden under pieces; arrows drawn
      after pieces.
- [ ] Q&A: `<details class="quiz">` with the canonical `.quiz` CSS.
- [ ] Page shell: topbar (back link, theme toggle, print), TOC, numbered sections.
- [ ] Piece glyphs: only `../assets/pieces/mpchess/*.svg`.
- [ ] Update both `lesson_source/` (or `lesson_source3/`) and `lessons/` when
      changing lesson content.
