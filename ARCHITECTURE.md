# Architecture

## 1. Overview

Chess Lesson Study Board is a framework-free chess teaching platform served as static files. The repository combines an interactive single-page application, browser Stockfish, Lichess tablebase requests, static lesson sites, an optional AI-help panel, and optional local Python helpers.

There is no bundler and no application build step. Production assets are the committed HTML, CSS, JavaScript, WASM, fonts, images, and data files themselves.

The major subsystems are:

1. **Interactive Study SPA**
   - `index.html`
   - `app.js`
   - `styles.css`

2. **Supporting SPA modules**
   - `pgn.mjs`
   - `puzzle-api.mjs`
   - `lesson-position-builder.mjs`
   - `text-normalization.mjs`

3. **AI chess-help UI**
   - `ai-help-chat.mjs`
   - `ai-help-chat.css`
   - `ai-help-config.mjs`
   - `ai-help-icon.mjs`

4. **Static lesson sites**
   - Pawn-level lessons
   - Bishop-level lessons
   - Numbered endgame lessons
   - Shared static-board and teacher-board helpers

5. **Vendored browser dependencies and data**
   - `vendor/chess.js`
   - `vendor/stockfish/`
   - `vendor/xlsx.full.min.js`
   - `assets/openings.tsv`
   - MPChess SVG pieces

6. **Optional local services**
   - `local_server.py`
   - `scanner_server.py`
   - `scanner_predict.py`

---

## 2. Repository map

```text
chess-study/
├── index.html
├── app.js
├── styles.css
├── pgn.mjs
├── puzzle-api.mjs
├── lesson-position-builder.mjs
├── text-normalization.mjs
│
├── ai-help-chat.mjs
├── ai-help-chat.css
├── ai-help-config.mjs
├── ai-help-icon.mjs
│
├── assets/
│   ├── openings.tsv
│   ├── social-preview.png
│   └── pieces/
│       ├── app_icon.png
│       └── mpchess/
│
├── vendor/
│   ├── chess.js
│   ├── stockfish/
│   └── xlsx.full.min.js
│
├── lessons/
│   ├── index.html
│   ├── pawn-index.html
│   ├── bishop-index.html
│   ├── pawn-*.html
│   ├── pawn-m*-lesson-*.html
│   ├── bishop-m*-lesson-*.html
│   ├── 01-*.html ... 07-*.html
│   ├── pawn-teacher-board.js
│   ├── pawn-teacher-board.css
│   ├── endgame-lesson.js
│   └── endgame-lesson.css
│
├── local_server.py
├── scanner_server.py
├── scanner_predict.py
├── start-local.ps1
│
├── tools/
├── Endgame/
├── mpchess-pieces/
└── optimization-review/
```

The lesson inventory changes more frequently than the SPA architecture. The important boundary is that lesson pages are static documents, while the SPA is the interactive chess runtime.

---

## 3. Module graph

```text
index.html
├── styles.css
└── app.js
    ├── vendor/chess.js
    ├── pgn.mjs
    ├── puzzle-api.mjs
    ├── lesson-position-builder.mjs
    └── text-normalization.mjs

ai-help-chat.mjs
├── ai-help-config.mjs
├── ai-help-icon.mjs
└── ai-help-chat.css
```

### Responsibilities

| Module | Responsibility |
|---|---|
| `index.html` | Static shell, board containers, tabs, panels, modals, hidden file inputs, early theme/embed detection, cache-versioned assets |
| `app.js` | Global state, rendering, event handling, board interaction, lesson trees, Play, Puzzle, Stockfish, tablebase, persistence, embed protocol |
| `styles.css` | Theme tokens, responsive layout, board and panel styling, clocks, drag previews, active-tab rules |
| `pgn.mjs` | Lesson-tree to PGN conversion, PGN parsing, comments, variations, multi-game splitting |
| `puzzle-api.mjs` | Random puzzle generation and verification with a dedicated Stockfish worker and optional tablebase checks |
| `lesson-position-builder.mjs` | CSV/XLSX import, field normalization, position-set CRUD, persistence, and builder UI |
| `text-normalization.mjs` | Unicode repair, punctuation normalization, and editable-text cleanup |
| `ai-help-chat.mjs` | Dyno Bot launcher and panel, context collection, endpoint storage, transcript state, request lifecycle |
| `ai-help-chat.css` | Floating panel layout, themes, responsive hiding, Focus-mode placement |
| `vendor/chess.js` | Legal moves, FEN, PGN, game termination, attack queries |
| `vendor/stockfish/` | Browser Stockfish JavaScript and WASM variants |

---

## 4. Global state

The SPA uses one mutable global `state` object. There is no reducer, proxy store, immutable state library, component framework, or virtual DOM.

Rendering functions read from `state`. Event handlers mutate it and then call either `renderAll()` or a targeted renderer.

### Important state areas

| State path | Purpose |
|---|---|
| `state.setup` | Setup pieces, FEN input, palette, active color, castling, en passant |
| `state.analysis` | `Chess` instance, lesson-tree graph, current node, legal moves, selection, promotion |
| `state.engine` | Main Stockfish worker, readiness, bundle metadata, search state, PV lines, evaluation |
| `state.tablebase` | Active request, normalized result, cache, abort controller |
| `state.practice` | Practice mode, accepted line/branch, progress, feedback, hint/reveal state |
| `state.play` | Active game, side, Elo, time control, clocks, explicit clock owner, engine session IDs |
| `state.puzzle` | Queue, history, active puzzle, preferences, statistics, generation status |
| `state.annotations` | Painted/circled/starred squares, arrows, colors, gesture state |
| `state.lessonBook` | Multiple lessons and selected lesson |
| `state.openingBook` | TSV rows and UCI/EPD indexes |
| `state.lessonPositionBuilder` | Builder activation and controller state |
| `state.setupDrag` | Setup/palette HTML drag state |
| `state.boardMoveDrag` | Touch/pen legal-move pointer drag state |
| `state.boardDragHoverSquare` | Current setup or legal-move hover square |

### Mutation pattern

```text
user input
  → handler validates context
  → mutate state
  → targeted render or renderAll()
  → schedulePersist() when the lesson changed
```

Direct mutation keeps dependencies low, but transition ordering matters. The clock, engine-message, promotion, and drag paths therefore use explicit session and ownership fields rather than inferring everything from the DOM.

---

## 5. Initialization

The main startup sequence is:

```javascript
initializeColorTheme();
initializeDefaultSetup();
applyEmbedDeepLink();

if (!state.embedMode) {
  hydrateDraft();
}

hydratePuzzleState();
window.__endgamePuzzlePremium = Object.freeze({
  generateKey: generatePremiumKey,
});

syncAnalysisGameFromTree();
initializeLessonPositionBuilder();
bindEvents();
bindEmbedMessageListener();
loadOpeningBook();
renderAll();

if (state.lessonPositionBuilder.active) {
  lessonPositionBuilder?.open();
}
```

`index.html` performs two early operations before `app.js` loads:

- reads `color-theme-v1` and applies `data-theme`
- detects `embed`, `boardOnly`, and setup-panel query parameters

This prevents a light-theme flash and reduces incorrect initial rendering inside lesson iframes.

---

## 6. Rendering

Rendering uses direct DOM updates.

### Full render

```text
renderAll()
├── renderBoard()
│   ├── buildBoardMarkup()
│   ├── renderAnnotationOverlay()
│   ├── renderCapturedPieces()
│   └── syncBoardSize()
├── renderHeaderMeta()
├── renderTabs()
├── renderNotationPanel()
├── render active tool panel
└── synchronize menus, controls, status and visibility
```

### Targeted rendering

High-frequency paths avoid rebuilding the full interface:

- clock ticks update clock text and active classes
- pointer dragging updates a floating piece and one hover square
- annotation movement refreshes the overlay or changed squares
- viewport changes update board-size CSS variables
- engine messages update analysis output

### Active-tab CSS contract

`renderTabs()` mirrors the selected tab to `data-active-tab` on the document root. CSS uses this for mode-specific behavior.

For example, the lesson-title input remains in state but is hidden in Play and Puzzle:

```css
html[data-active-tab="play"] .lesson-title-input,
html[data-active-tab="puzzle"] .lesson-title-input {
  display: none;
}
```

---

## 7. Tabs and transitions

| Tab | Constant | Purpose |
|---|---|---|
| Study | `TAB_STUDY` | Board and notation with tools collapsed |
| Setup | `TAB_SETUP` | Position construction and validation |
| Analysis | `TAB_ANALYSIS` | Engine/tablebase analysis, annotations, practice |
| Play | `TAB_PLAY` | Play vs Stockfish |
| Puzzle | `TAB_PUZZLE` | Puzzle queue and puzzle sessions |
| Lessons | `TAB_LESSONS` | Lesson Position Builder |

Important transitions:

- Leaving an active Play game stops it.
- Leaving Puzzle cancels active generation.
- Entering Setup during a puzzle copies the live puzzle position into setup state.
- Entering Lessons opens the builder controller.
- Leaving Lessons closes the builder.
- Play and Puzzle hide the lesson-title input through the active-tab CSS contract.

---

## 8. Board model and rendering

The board is an 8×8 CSS grid inside `#boardGrid`.

A typical occupied square is rendered as:

```html
<div class="board-square light is-playable"
     data-square="e4"
     data-piece="P">
  <div class="board-piece-shell is-draggable"
       data-square="e4"
       data-piece="P"
       draggable="true">
    <img class="board-piece"
         src="./assets/pieces/mpchess/wP.svg"
         alt="">
  </div>
</div>
```

`buildBoardMarkup()` derives:

- displayed pieces
- selected square
- legal targets and legal captures
- draggable legal source squares
- setup/playable classes
- drag-hover class
- coordinates
- square annotations

Arrows and the last-move arrow use SVG overlays. Painted squares, circles, and stars are square-level HTML overlays.

### Responsive sizing

`syncBoardSize()` calculates `--board-size` from:

- available workspace width
- viewport height
- control-pane width
- captured-row height
- frame padding
- evaluation rail and turn-marker offsets
- Focus-mode limits

Desktop and landscape layouts balance width and height. Mobile portrait uses nearly the full viewport width and reserves only the space needed by the visible evaluation rail.

---

## 9. Board input systems

The app has separate but cooperating interaction systems.

### 9.1 Click/tap move selection

`handleBoardClick()` and the analysis-square handlers provide:

1. select a legal source
2. calculate legal moves
3. highlight destinations
4. submit the selected move
5. open promotion selection when necessary

This remains available on touch devices even after pointer dragging was added.

### 9.2 Desktop legal-move dragging

Native HTML drag events handle mouse dragging:

```text
handleBoardDragStart()
  → verify source has a legal move
  → store source="move" payload
  → create drag image

handleBoardDragOver()
  → allow drop only on a legal destination
  → update legal hover square

handleBoardDrop()
  → submitDraggedBoardMove(from, to)
  → use normal move/promotion path
```

During Play or Puzzle, `currentBoardDragMoves()` exposes moves only when it is the human side's turn.

### 9.3 Touch and pen dragging

Pointer events provide mobile drag behavior because native HTML drag-and-drop is unreliable on touchscreens.

```text
pointerdown on draggable piece
  → create state.boardMoveDrag
  → capture pointer

pointermove after movement threshold
  → show floating piece preview
  → identify square from client coordinates
  → highlight only legal target

pointerup
  → suppress synthetic follow-up click
  → remove preview and hover
  → submit legal move or preserve tap behavior
```

`pointercancel` and window blur always clear the transient state.

### 9.4 Setup dragging

Setup uses a separate `state.setupDrag` flow for:

- palette-to-board copies
- board-to-board setup moves
- deletion by dragging a setup piece outside the board

Setup mode never submits a legal game move.

### 9.5 Annotation gestures

Annotation mode intercepts board gestures before normal move handling. Right-button gestures can paint, circle, star, or draw arrows with color modifiers.

---

## 10. Lesson tree

Each recorded position is a node:

```javascript
{
  id: 'root' | 'n1' | 'n2',
  parentId: null | 'root' | 'n1',
  from: null | 'e2',
  to: null | 'e4',
  promotion: null | 'q',
  san: null | 'e4',
  fen: '...',
  children: ['n2', 'n7'],
  selectedChildId: 'n2',
  comment: '...'
}
```

Important operations include:

- jumping to a node
- reconstructing the selected root-to-node path
- following `selectedChildId` for the displayed continuation
- adding a variation without flattening existing branches
- validating loaded trees for reachability, legality, FEN consistency, cycles, and parent/child integrity

`pgn.mjs` converts this structure to and from PGN variations and comments.

---

## 11. Engine architecture

### 11.1 Main Stockfish worker

The SPA probes installed browser bundles in strength/compatibility order:

1. full multi-threaded
2. full single-threaded
3. lite multi-threaded
4. lite single-threaded

Multi-threaded workers require cross-origin isolation. Compatible single-threaded variants are important for GitHub Pages and mobile/coarse-pointer devices.

The worker lifecycle is:

```text
resolve candidate
  → new Worker(workerPath)
  → send "uci"
  → send "isready"
  → await "readyok"
  → configure options
  → send position/search command
  → parse info and bestmove messages
```

The main worker is shared by Analysis and Play, with session IDs preventing stale `bestmove` messages from applying to a newer game.

### 11.2 Puzzle-generation worker

`puzzle-api.mjs` owns a separate worker. Puzzle generation and verification therefore do not replace or corrupt active analysis/play state.

### 11.3 UCI transport

Communication uses raw UCI strings through `Worker.postMessage()` and `onmessage`. Parsing extracts:

- depth
- score type/value
- MultiPV index
- principal variation
- node count and NPS
- best move

---

## 12. Play vs Stockfish

Play reuses the normal `state.analysis.game` and move-submission paths, while adding engine settings, clock state, result handling, and worker-session guards.

### Start sequence

```text
startPlayGame()
  → stop previous game/clock/search state
  → build selected starting position
  → assign human side
  → initialize time and increment
  → render loading state
  → await ensureStockfishReady()
  → mark gameReady
  → start first active clock
  → request engine move when engine moves first
```

Human input is disabled until `gameReady` is true.

### Clock invariants

The clock system uses an explicit owner:

```javascript
state.play.activeClock // 'w' | 'b' | null
```

It does not infer the owner from `game.turn()` during move-processing transitions.

`performance.now()` provides monotonic timestamps. The interval refreshes the display frequently, but time deduction is based on measured elapsed time rather than subtracting a fixed interval amount.

Move settlement order is:

```text
settle mover's elapsed time
  → if remaining <= 0, flag and reject move
  → apply legal move
  → add increment
  → render resulting position
  → start opponent clock
```

This prevents increment from reviving a player who already reached zero and avoids charging one side for the other side's rendering or beginner-move selection work.

The display shows tenths below ten seconds.

### Engine search and watchdog

Play requests a bounded engine search based on remaining time, increment, and the selected thinking-speed cap. An 8-second watchdog retries a stalled request once, then ends the attempt with a visible message.

---

## 13. Tablebase integration

Eligible endgames use the public Lichess tablebase before Stockfish.

Eligibility requires:

- valid FEN
- no castling rights
- at most seven total pieces
- at most four pieces per side

Flow:

```text
Analyze requested
  → eligible?
    → yes: abort active engine search
           fetch tablebase result
           normalize result and moves
           build bounded SAN continuation
           cache by FEN
           render through existing eval/PV UI
           fall back to Stockfish on failure
    → no: start Stockfish analysis
```

The request cache is in-memory for the browser session.

---

## 14. Puzzle system

The Puzzle tab combines queue management with generated or built-in endgame positions.

### Generation

```text
generate batch
  → puzzle-api builds random candidate
  → legality gates
  → Stockfish classification
  → deeper verification
  → optional tablebase verification
  → add validated, deduplicated puzzle to queue
  → persist queue
```

### Session

```text
startPuzzleSession(puzzle)
  → load puzzle FEN
  → assign solver and defending side
  → reuse Play move/engine machinery
  → keep clock disabled
  → evaluate objective after moves
  → update history and statistics
```

Objectives include checkmate, material gain, and holding a draw.

All queue/history/CSV ingestion paths run legality filtering before persistence.

---

## 15. Practice mode

Practice uses the lesson tree rather than generated engine moves.

- **Selected line** follows the displayed selected-child path.
- **Branch drill** accepts any recorded child from the current node.
- Future notation is hidden.
- Wrong moves do not alter the saved lesson tree.
- Hint and reveal operate on expected recorded moves.
- Engine output is hidden while practice is active.

Click, tap, desktop drag, and pointer drag all feed the same practice move submission path.

---

## 16. AI chess-help subsystem

`ai-help-chat.mjs` mounts a floating Dyno Bot interface unless the page is embedded or board-only.

### Context payload

The panel collects visible, bounded context:

```javascript
{
  lessonTitle,
  fen,
  setupFen,
  opening,
  activeTab,
  positionLabel,
  sideToMove,
  notation
}
```

Notation is whitespace-normalized and capped before transmission.

### Endpoint resolution

The endpoint is resolved from:

1. `AI_HELP_ENDPOINT` in `ai-help-config.mjs`
2. browser-local `chess-study-ai-endpoint-v1`

A base Worker URL is normalized to end in `/chat`.

### Request lifecycle

- Keep at most 12 history messages.
- Send JSON with messages and chess context.
- Abort after 45 seconds.
- Render pending, success, and failure states in the transcript.
- Allow clearing the local transcript.

### Visibility and placement

- Hidden for `embed` and `boardOnly` modes.
- Hidden at phone widths and short coarse-pointer landscape sizes.
- Normally fixed to the lower-right.
- In Focus mode, `.page-shell.is-focus-mode ~ .ai-help-chat` moves the launcher and panel to the lower-left.

The lower-right is reserved for `.focus-mode-brand`, so the AI control no longer covers the app watermark.

---

## 17. Focus mode

`setFocusMode()` toggles the `is-focus-mode` class on `.page-shell`.

Focus mode:

- hides the control pane
- centers and enlarges the board within viewport limits
- exposes a small Analyze/Exit control group
- displays `.focus-mode-brand` at the lower-right
- causes the AI Help UI to use the lower-left
- exits through Escape or the Exit control

Embed mode enters Focus mode automatically but hides the normal brand and AI Help UI.

---

## 18. Embed and teacher-board protocol

Query parameters include:

```text
?embed=1
?fen=<encoded FEN>
?boardOnly=1
?setupPanel=open
```

The message listener accepts commands such as:

| Message | Effect |
|---|---|
| `loadFen` | Validate and load a FEN, optionally with marked squares |
| `setOrientation` | Set White/Black orientation |
| `setAnnotations` | Replace embedded painted-square marks |
| `teacherBoardPing` | Same-origin readiness handshake |
| `teacherBoardAction` / `boardOnlyAction` | Enter/exit setup, choose a piece, clear, flip, reset, annotate |

Same-origin checks protect request/response operations that include request IDs.

---

## 19. Persistence

### localStorage keys

| Key | Content |
|---|---|
| `setup-analysis-draft-v1` | Lesson book, setup, tree, comments, annotations, note, preferences |
| `color-theme-v1` | Light/dark theme |
| `endgame-puzzle-prefs-v1` | Puzzle objective, difficulty, Elo, reply speed |
| `endgame-puzzle-premium-v1` | Puzzle activation key |
| `endgame-puzzle-free-v1` | Daily free-use accounting |
| `endgame-puzzle-queue-v1` | Puzzle queue |
| `endgame-puzzle-history-v1` | Puzzle history and results |
| `chess-study-ai-endpoint-v1` | User-supplied AI endpoint |
| `lesson-position-builder-v1:*` | Builder state per saved position set |

Draft persistence is debounced during normal work and forced on `beforeunload` outside embed mode.

### Lesson files

- `.lesson.json` stores one lesson with app-specific state.
- `.lesson-book.json` stores multiple lessons.
- PGN is used for portable chess notation, variations, and comments.

Loaded lesson graphs are normalized and validated before becoming active state.

---

## 20. Opening book

`loadOpeningBook()` fetches `assets/openings.tsv` and creates:

- a UCI-prefix index
- an EPD-position index

Identification prefers the longest matching UCI move prefix, with EPD and PGN-header information as fallbacks or supplements.

---

## 21. Static lesson architecture

The static lesson files are intentionally independent of the SPA framework because there is no framework.

### Pawn and Bishop levels

These are primarily self-contained teaching pages using shared styles/scripts and static diagrams or teacher-board helpers.

### Numbered endgame lessons

The numbered endgame chapters use `endgame-lesson.js` for static FEN diagrams and can embed the SPA for interactive exploration.

Static pages are printable and can use paged-media styling without requiring the SPA runtime for the written lesson content.

---

## 22. Optional local services

### Cross-origin-isolated server

`local_server.py` serves the app with:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers allow compatible multi-threaded Stockfish bundles.

### Board scanner

`scanner_server.py` exposes:

```text
http://127.0.0.1:8765/predict-fen
```

The Setup panel submits a selected board image, receives a predicted FEN, validates it, and commits it to setup state.

The scanner is optional and not used by the GitHub Pages deployment.

---

## 23. Event bindings

`bindEvents()` registers delegated and board-specific handlers.

### Document/window events

| Event | Role |
|---|---|
| `click` | Actions, menus, tabs, modal controls |
| `input` | Title, FEN, notes, comments |
| `change` | Selects, checkboxes, file-driven settings |
| `paste` | FEN auto-application |
| `keydown` | Tree navigation, Escape handling, premium activation |
| `mousemove` / `mouseup` | Annotation gestures |
| `pointermove` / `pointerup` / `pointercancel` | Touch/pen legal-move dragging |
| `contextmenu` | Annotation and browser-menu suppression |
| `resize` / `visualViewport.resize` | Board resizing |
| `blur` | Cancel annotation and pointer-drag transient state |
| `beforeunload` | Persist state and dispose workers |

### Board events

| Event | Role |
|---|---|
| `mousedown` | Annotation/start-selection logic |
| `pointerdown` | Touch/pen drag candidate |
| `click` | Click/tap move selection |
| `dragstart` | Setup or legal desktop drag |
| `dragover` | Legal/setup destination validation |
| `drop` | Commit setup placement or legal move |
| `dragleave` | Clear hover state |
| `dragend` | Cleanup and setup off-board deletion |

---

## 24. Validation and testing

There is no compile step, so validation combines syntax checks, targeted tests, and browser testing.

```powershell
node --check app.js
node --check ai-help-chat.mjs
node tools/test-puzzle-api.mjs
git diff --check
```

Minimum manual matrix:

- desktop click-to-move
- desktop drag-to-move
- touch tap-to-move
- touch/pen pointer dragging
- promotion through click and drag paths
- Play as White and Black
- Bullet flag fall and increment boundaries
- engine-first starts
- puzzle objectives and history
- analysis/tablebase fallback
- annotation gestures
- Focus mode with AI Help closed and open
- mobile AI-help hiding
- embed and board-only message actions
- lesson JSON and PGN round trips

---

## 25. Architectural constraints

The current design deliberately favors zero-build deployability and direct debugging. That also creates constraints:

- `app.js` is a large orchestration module.
- State mutation is global and imperative.
- DOM structure and CSS selectors form part of the runtime contract.
- Cache-version strings must be updated when dynamically loaded assets change.
- Worker messages must be guarded against stale sessions.
- Clock ownership must remain explicit during transitions.
- Setup drag, legal-move drag, pointer drag, and annotation gestures must remain isolated from one another.

Future modularization should preserve those behavioral contracts before splitting code merely to produce a more fashionable folder tree.
