# Architecture

## 1. Overview

Chess Lesson Study Board is a framework-free chess teaching platform served as static files. The repository combines an interactive single-page application, browser Stockfish, Lichess tablebase requests, separate legacy Endgame Puzzle and user-facing Position Study runtimes, coach-controlled student workspaces and puzzle assignments, static lesson sites with classroom presentation and a floating Teacher Board, a synchronized teacher/student Live Board, an optional AI-help panel, and optional local Python helpers.

There is no bundler and no application build step. Production assets are the committed HTML, CSS, JavaScript, WASM, fonts, images, and data files themselves.

The major subsystems are:

1. **Interactive Study SPA**
   - `index.html`
   - `app.js`
   - `styles.css`

2. **Supporting SPA modules**
   - `pgn.mjs`
   - `puzzle-api.mjs`
   - `lichess-position-training.mjs` and its core, data, engine, learning, interaction, and layout modules
   - `position-study-single-hint-patch.mjs` for the active one-use hint and explanation-suppression behavior
   - `assets/puzzles/lichess-position-training/manifest.json` plus 2,000 shard files
   - `lesson-position-builder.mjs`
   - `lesson-model.mjs`, `lesson-migrations.mjs`, and `lesson-position-adapter.mjs`
   - `lesson-position-interoperability-core.mjs`, `lesson-position-interoperability-export-guard.mjs`, and `lesson-position-interoperability.mjs`
   - `lesson-variation-tree.mjs`
   - `text-normalization.mjs`

3. **AI chess-help subsystem**
   - Browser UI: `ai-help-chat.mjs`, `ai-help-chat.css`, `ai-help-config.mjs`, `ai-help-icon.mjs`
   - Cloudflare Worker proxy: `worker/ai-help-worker.js`, `worker/wrangler.jsonc`
   - Gemini Interactions API, reached only from the Worker

4. **Static lesson sites**
   - Pawn, Advanced Pawn, and Bishop curricula
   - Numbered endgame lessons
   - Unified lesson header
   - Classroom presentation mode
   - Floating Teacher Board and embedded-board protocol

5. **Live Board collaboration**
   - `live-board.html` and Live Board interaction modules
   - Supabase-backed teacher/student rooms
   - Secure student links, move locking, prepared positions, and session messages

6. **Vendored browser dependencies and data**
   - `vendor/chess.js`
   - `vendor/stockfish/`
   - `vendor/xlsx.full.min.js`
   - `assets/openings.tsv`
   - MPChess SVG pieces

7. **Optional local services**
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
├── lichess-position-training.mjs
├── lichess-position-training-core.mjs
├── lichess-position-training-data.mjs
├── lichess-position-training-engine.mjs
├── lichess-position-training-learning.mjs
├── position-study-single-hint-patch.mjs
├── lichess-position-training-interactions.mjs
├── lichess-position-training-grid-layout.mjs
├── lichess-position-training-style-refresh.mjs
├── lesson-position-builder.mjs
├── lesson-model.mjs
├── lesson-migrations.mjs
├── lesson-position-adapter.mjs
├── lesson-position-interoperability-core.mjs
├── lesson-position-interoperability-export-guard.mjs
├── lesson-position-interoperability.mjs
├── lesson-variation-tree.mjs
├── text-normalization.mjs
│
├── live-board.html
├── live-board.css
├── live-board.js
├── live-board-realtime.js
├── live-board-messages-v2.js
├── live-board-room-bootstrap.js
├── live-board-drag.js
├── live-board-click-toggle.js
│
├── ai-help-chat.mjs
├── ai-help-chat.css
├── ai-help-config.mjs
├── ai-help-icon.mjs
│
├── worker/
│   ├── ai-help-worker.js
│   └── wrangler.jsonc
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
│   ├── lesson-header.css
│   ├── lesson-presentation.js
│   ├── lesson-presentation.css
│   ├── pawn-teacher-board.js
│   ├── pawn-teacher-board.css
│   ├── teacher-board-illegal-moves.mjs
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
    ├── lesson-model.mjs / lesson-migrations.mjs
    ├── lesson-position-adapter.mjs
    ├── lesson-position-interoperability-core.mjs
    ├── lesson-position-interoperability-export-guard.mjs
    ├── lesson-position-interoperability.mjs
    ├── lesson-variation-tree.mjs
    └── text-normalization.mjs

focus-analysis-popup.mjs
└── lichess-position-training.mjs
    ├── lichess-position-training-core.mjs
    ├── lichess-position-training-data.mjs
    │   └── assets/puzzles/lichess-position-training/manifest.json + shards
    ├── lichess-position-training-engine.mjs
    │   ├── public Lichess tablebase
    │   └── dedicated Stockfish evaluation worker
    └── lichess-position-training-learning.mjs

management/teacher.html
├── teacher-dashboard.mjs
│   └── coach-session-command.mjs
├── puzzle-assignment-dashboard.mjs
├── puzzle-assignment-lifecycle.mjs
└── student-workspace-dashboard.mjs
    └── teacher-owned Supabase rows and RLS

management/assignment.html
└── puzzle-assignment-student.mjs
    ├── per-assignment token access
    └── student-workspace token access

management/student-workspace.html
└── student-workspace.mjs
    └── permanent token-scoped workspace RPCs

ai-help-chat.mjs
├── ai-help-config.mjs
├── ai-help-icon.mjs
├── ai-help-chat.css
└── HTTPS POST /chat
    └── Cloudflare Worker (`worker/ai-help-worker.js`)
        └── Gemini Interactions API (`/v1beta/interactions`)

static lesson HTML
├── endgame-lesson.css / advanced-pawn-lesson.css
│   └── lesson-header.css
├── endgame-lesson.js
├── lesson-presentation.js
│   └── lesson-presentation.css
└── pawn-teacher-board.js
    ├── pawn-teacher-board.css
    └── embedded `index.html?embed=1&boardOnly=1`
        └── teacher-board-illegal-moves.mjs

live-board.html
├── live-board.js
├── live-board-click-toggle.js
├── live-board-drag.js
├── live-board-display-fixes.js
├── live-board-realtime.js
├── live-board-room-bootstrap.js
├── live-board-lesson-ux.js
└── live-board-messages-v2.js
    └── Supabase room state, realtime updates, and messages
```

### Responsibilities

| Module | Responsibility |
|---|---|
| `index.html` | Static shell, board containers, tabs, panels, modals, hidden file inputs, early theme/embed detection, cache-versioned assets |
| `app.js` | Global state, rendering, event handling, board interaction, lesson trees, Play, Puzzle, Stockfish, tablebase, persistence, embed protocol |
| `styles.css` | Theme tokens, responsive layout, board and panel styling, clocks, drag previews, active-tab rules |
| `pgn.mjs` | Lesson-tree to PGN conversion, PGN parsing, comments, variations, multi-game splitting |
| `puzzle-api.mjs` | Legacy endgame-puzzle generation and verification with a dedicated Stockfish worker and optional tablebase checks |
| `lichess-position-training.mjs` | Internal Position Study modal controller, board rendering, filters, objective flow, history, and library-count display |
| `lichess-position-training-core.mjs` | Applies the repair move, derives solver-relative objectives, classifies moves, and determines solved states |
| `lichess-position-training-data.mjs` | Loads the manifest and randomized shards, filters rating/themes, avoids recent repeats, and falls back to IndexedDB cache |
| `lichess-position-training-engine.mjs` | Resolves terminal states, tablebase positions, and Stockfish scores from the solver's perspective |
| `lichess-position-training-learning.mjs` | Adaptive rating, hint accounting, theme metrics, and Mistake Review scheduling |
| `position-study-single-hint-patch.mjs` | Active one-use source-piece hint, `Hint used` state, launcher copy, and suppression of generic success/mistake explanations |
| `management/js/teacher-dashboard.mjs` | Teacher-owned students, curriculum progress, coaching-session records, and Coach Session Command Center orchestration |
| `management/js/coach-session-command.mjs` | Pure lesson recommendation, elapsed-time, and sessionStorage validation helpers for an active coaching session |
| `management/js/puzzle-assignment-*.mjs` | Teacher assignment selection/lifecycle and token-scoped student assignment runtime |
| `management/js/student-workspace*.mjs` | Coach-only workspace editing, permanent-link generation, token-scoped student rendering, and assignment-link authorization |
| `lesson-position-builder.mjs` | CSV/XLSX import, field normalization, position-set CRUD, persistence, and builder UI |
| `lesson-model.mjs` / `lesson-migrations.mjs` | Versioned lesson contracts, normalization, stable IDs, compatibility detection, and non-destructive migration |
| `lesson-position-adapter.mjs` | Converts rich lesson roots or selected nodes to flat positions and converts position sets into lesson documents/books |
| `lesson-position-interoperability-core.mjs` / `lesson-position-interoperability.mjs` | Connect Position Sets to Study, Analysis, lesson-book persistence, optional spreadsheet metadata, and conversion actions |
| `lesson-position-interoperability-export-guard.mjs` | Preserves validation before metadata-aware CSV/XLSX export |
| `lesson-variation-tree.mjs` | Preferred-child lookup, first-child main-line insertion, non-promoting variation traversal, explicit promotion, and recursive variation-depth semantics |
| `text-normalization.mjs` | Unicode repair, punctuation normalization, and editable-text cleanup |
| `ai-help-chat.mjs` | Dyno Bot launcher and panel, bounded context collection, endpoint storage, transcript state, timeout and request lifecycle |
| `ai-help-chat.css` | Floating panel layout, themes, responsive hiding, Focus-mode placement |
| `ai-help-config.mjs` | Public Worker base URL used by the browser client; never contains the Gemini API key |
| `worker/ai-help-worker.js` | CORS enforcement, request validation, rate limiting, Gemini proxying, response normalization, `/chat` and `/health` routes |
| `worker/wrangler.jsonc` | Cloudflare Worker name, entry point, Gemini model, allowed origins, and rate-limit binding |
| `live-board.html` | Teacher/student room shell, board, FEN/lesson controls, move list, and messages |
| `live-board.js` | Live Board position state, legal moves, imported positions, undo/reset behavior |
| `live-board-realtime.js` | Room creation/joining, credentials, secure links, Supabase state synchronization |
| `live-board-messages-v2.js` | Credential-aware message initialization, realtime subscription, refresh/poll lifecycle |
| `lessons/lesson-header.css` | Shared sticky header contract for Pawn, Advanced Pawn, and Bishop lesson families |
| `lessons/lesson-presentation.js` / `.css` | Scene collection, reveal/reset/navigation, fullscreen, and click-pulse presentation UI |
| `lessons/pawn-teacher-board.js` / `.css` | Parent lesson overlay, setup tray, lesson CSV menu, and embedded-board commands |
| `lessons/teacher-board-illegal-moves.mjs` | Illegal/out-of-turn demonstrations and Teacher Board take-back history in board-only mode |
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
| Study | `TAB_STUDY` | Lesson review, explicit main-line selection, recursive variations, comments, and practice with tools collapsed |
| Setup | `TAB_SETUP` | Position construction and validation |
| Analysis | `TAB_ANALYSIS` | Engine/tablebase analysis, annotations, practice |
| Play | `TAB_PLAY` | Play vs Stockfish |
| Puzzle | `TAB_PUZZLE` | Legacy Endgame Puzzle controls plus the separately mounted Position Study launcher |
| Position Sets | `TAB_LESSONS` | CSV/XLSX Position Set Builder and rich-lesson conversion actions |

Important transitions:

- Leaving an active Play game stops it.
- Leaving Puzzle cancels active generation.
- Entering Setup during a puzzle copies the live puzzle position into setup state.
- Entering Position Sets (`TAB_LESSONS`) opens the builder controller.
- Leaving Position Sets closes the builder.
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

- jumping to a node without rewriting the saved preferred continuation;
- reconstructing the selected root-to-node path;
- following `selectedChildId` for forward navigation and selected-line practice;
- recording the first child of a position as its main line;
- adding later children as side variations without flattening or replacing existing branches;
- explicitly promoting a selected side move with **Make main line**;
- applying the same branch rule recursively inside variations and sub-variations;
- validating loaded trees for reachability, legality, FEN consistency, cycles, and parent/child integrity.

`lesson-variation-tree.mjs` owns preferred-continuation semantics. A valid `selectedChildId` is authoritative; otherwise the first valid child is the fallback. Ordinary Study/Analysis navigation does not mutate it. Explicit promotion updates only the selected move's immediate parent, so descendants and unrelated branch choices remain intact. Play mode keeps its separate active-game-line behavior.

`pgn.mjs` converts the tree to and from standards-compliant PGN. Comments use braces, variation sequences use parentheses, and recursive export suppresses the initial sibling scan inside a forced side line so a variation cannot rediscover its main-line sibling and recurse indefinitely.

See `LESSON_DATA_ARCHITECTURE.md`, `LESSON_POSITION_INTEROPERABILITY.md`, and `LESSON_VARIATIONS_AND_MAIN_LINES.md` for the versioned data contracts, Position Set bridge, and user-facing branch rules.

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

## 14. Puzzle systems

The Puzzle tab exposes two independent runtimes. The legacy endgame system remains owned by `app.js`; Position Study is mounted separately and does not reuse the endgame queue, objective rules, history, or statistics. The product UI uses **Position Study**, while existing source filenames, asset paths, storage keys, and IndexedDB names retain `lichess-position-training` for compatibility.

### 14.1 Legacy endgame puzzle system

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

```text
startPuzzleSession(puzzle)
  → load puzzle FEN
  → assign solver and defending side
  → reuse Play move/engine machinery
  → keep clock disabled
  → evaluate objective after moves
  → update endgame history and statistics
```

Objectives include checkmate, material gain, and holding a draw. All queue/history/CSV ingestion paths run legality filtering before persistence.

### 14.2 Position Study runtime

The installed production dataset is declared by `assets/puzzles/lichess-position-training/manifest.json`:

- 50,000 puzzles
- 2,000 sequential shards
- 25 puzzles per shard
- `exactLineRequired: false`
- `veryLong` excluded

Each record stores the source FEN, the first Lichess database move as `repairMove`, the reconstructed `startFen`, solver/mover colors, rating, popularity, themes, game URL, and opening tags. It does not store a mandatory solution or continuation.

```text
open trainer
  → fetch manifest without trusting browser cache
  → fall back to IndexedDB manifest cache when offline
  → shuffle shard indexes
  → fetch/cache one shard at a time
  → filter by fixed/adaptive rating and selected theme
  → apply repairMove and verify the reconstructed solver position
  → derive solver-relative objective
  → begin local learning attempt
```

After a legal student move:

```text
terminal checkmate/draw?
  → yes: return solver-relative result without starting Stockfish
  → no: tablebase eligible?
      → yes: normalize tablebase result to solver perspective
      → no: evaluate with dedicated Stockfish worker
  → classify whether the move preserves the required result
  → accept valid alternatives or reject objective-losing moves
  → continue with dynamic defence until solved or failed
```

The learning module keeps separate browser-local state under `lichess-position-training-learning-v1`. It tracks adaptive rating, hint use, theme attempts/solves/mistakes, and up to 120 review positions. The active Position Study patch permits one hint per position: it highlights only the source piece from the current engine candidate and reveals no destination square, notation, arrow, motif, or full move. After use, the button reads **Hint used** and remains disabled for that position, including after Reset. Generic generated success and mistake explanations are suppressed; the normal move/objective feedback remains. Two independent clean, hint-free review solves retire a position.

The general count, preferences, statistics, and history use separate localStorage keys. Shard payloads are cached in IndexedDB database `lichess-position-training-cache-v1`; successful network responses replace cached entries.

### 14.3 Teacher assignments

Approved teachers create assignments from frozen snapshots selected from the installed Lichess library. Publication generates private per-student bearer links; only SHA-256 token hashes are stored in Supabase. Assignment rows, snapshots, student progress, and attempts are protected by owner-scoped or token-scoped database policies.

Published puzzle snapshots do not change when the main library expands. Teachers can edit safe metadata, duplicate assignments with new links, archive/restore, or permanently delete with typed confirmation. Deletion cascades through snapshots, student links, attempts, and results.

See [LICHESS_POSITION_TRAINING.md](LICHESS_POSITION_TRAINING.md) for the full data and lifecycle reference.

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

AI Help is a two-tier feature. The static browser application collects bounded visible chess context, while a Cloudflare Worker protects the Gemini API key and performs the provider request.

```text
Browser at https://cddigital.top
  → ai-help-chat.mjs
  → HTTPS POST <Worker URL>/chat
  → Cloudflare Worker
  → Gemini Interactions API
  → normalized JSON { text }
  → Dyno Bot transcript
```

The browser must never call Gemini directly and must never contain `GEMINI_API_KEY`.

### 16.1 Browser client

`ai-help-chat.mjs` mounts the floating Dyno Bot interface unless the page is embedded or board-only. It collects a bounded snapshot containing the lesson title, FENs, opening, active tab, position label, side to move, and notation excerpt.

Notation and conversation history are capped before transmission. Requests abort after 45 seconds. The endpoint comes from `AI_HELP_ENDPOINT` in `ai-help-config.mjs`, with browser-local `chess-study-ai-endpoint-v1` retained as a testing fallback. A base Worker URL is normalized to end in `/chat`.

### 16.2 Cloudflare Worker

`worker/ai-help-worker.js` exposes:

| Route | Method | Purpose |
|---|---|---|
| `/chat` | `POST` | Validate, rate-limit, call Gemini, and return `{ text }` |
| `/health` | `GET` | Confirm Worker reachability from an allowed origin |
| `/chat` and `/health` | `OPTIONS` | CORS preflight handling |

The Worker:

- reads `GEMINI_API_KEY` from a Cloudflare secret;
- reads `GEMINI_MODEL` and `ALLOWED_ORIGINS` from Wrangler variables;
- accepts only exact allowed origins;
- limits request bytes, message count, message length, and context size;
- uses `https://generativelanguage.googleapis.com/v1beta/interactions`;
- removes an accidental `models/` prefix from a configured model ID;
- maps provider and network failures to bounded JSON errors.

Current production origins are `https://cddigital.top` and `https://www.cddigital.top`. The legacy GitHub Pages origin and localhost origins remain allowed.

### 16.3 CORS behavior

A missing production origin causes preflight to fail before browser JavaScript can read the Worker's JSON response. Firefox commonly reports this as:

```text
NetworkError when attempting to fetch resource.
```

When the production domain changes, update both `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` and the fallback origin list in `worker/ai-help-worker.js`, then redeploy.

### 16.4 Deployment boundary

The static site and Worker are separate deployments. Merging Worker code into GitHub does not update the running Cloudflare Worker.

```powershell
cd worker
npx wrangler login
npx wrangler deploy
```

The existing secret normally remains attached. Set it only when missing:

```powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Never commit the API key to configuration, JavaScript, Markdown, logs, or screenshots.

### 16.5 Validation and troubleshooting

After Worker changes:

1. Run `node --check worker/ai-help-worker.js`.
2. Verify the current production origins in `worker/wrangler.jsonc`.
3. Deploy the Worker.
4. Test `/health` from an allowed origin.
5. Send a short live AI Help request from `https://cddigital.top`.
6. Inspect browser Network details and Cloudflare logs on failure.

Failure categories:

- **Browser network/CORS error:** Worker URL, DNS/TLS, deployment, or origin allowlist.
- **HTTP 429/503:** rate limit, missing secret, provider outage, or temporary capacity.
- **HTTP 502:** provider rejected the model/request or returned unusable output.
- **Timeout:** the browser aborted after 45 seconds.

### 16.6 Visibility and placement

- Hidden in `embed` and `boardOnly` modes.
- Hidden at phone widths and short coarse-pointer landscape sizes.
- Normally fixed to the lower-right.
- In Focus mode, `.page-shell.is-focus-mode ~ .ai-help-chat` moves it to the lower-left.

The lower-right remains available for `.focus-mode-brand`.

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
| `teacherBoardAction` / `boardOnlyAction` | Enter/exit setup, choose a piece, load setup presets, set side to move, flip, reset, annotate |

Important Teacher Board actions include:

| Action | Payload / behavior |
|---|---|
| `enterTeacherSetup` / `exitTeacherSetup` | Switch the embedded board between setup placement and normal play |
| `selectTeacherPiece` | Arm a white/black piece or eraser; piece-palette color is independent of side to move |
| `emptyTeacherBoard` | Clear all pieces and preserve the requested `side` |
| `startTeacherBoard` | Load the standard 32-piece position with the requested `side` |
| `setSideToMove` | Rewrite the active-color FEN field without removing placed pieces |
| `lessonTeacherBoard` | Restore the embedded initial/page position |
| `loadFen` | Load Page or prepared-position FEN; request IDs receive `teacherBoardLoadResult` |
| `takeBack` | Restore Teacher Board history across legal and demonstration moves |

The parent wrapper keeps `setupColor` and `setupSideToMove` as separate state. **Page** resolves the lesson's `data-teacher-fen` from `<html>` or `<body>` and falls back to the normal starting position only when no lesson FEN exists. Successful Page or prepared-position loads resynchronize the side-to-move buttons from the loaded FEN.

`teacher-board-illegal-moves.mjs` installs before the main embedded-board message listener. It may reset its own history for setup actions, but it must not call `stopImmediatePropagation()` for Empty, Start, Page/lesson load, or side-to-move commands; otherwise the main board handler never performs the requested action. It still owns Teacher Board take-back/reset interception where required.

The wrapper dynamically imports `vendor/chess.js`, observes changes to the embedded board's `#currentFenCode`, and evaluates each settled FEN. A compact absolutely positioned `aria-live="assertive"` overlay reports checkmate with the winning side or stalemate as a draw without adding a layout row or resizing the board. The overlay clears automatically when take-back, reset, setup, or another position produces a non-terminal FEN.

Same-origin checks protect readiness and request/response operations that include request IDs.

---

## 19. Live Board collaboration

The Live Board is a separate page and state machine from the lesson Teacher Board.

### Room and credential lifecycle

```text
teacher opens live-board.html
  → live-board-realtime.js creates a Supabase room
  → teacher credentials are stored for the browser session
  → URL hash receives room, role, and access data
  → `live-board-session-ready` is dispatched
  → state and message modules initialize for that exact session key
  → teacher copies the generated student-only link
```

Students should open the generated link rather than manually reusing the teacher URL. Teacher and student access tokens are role-specific and must not be logged, documented, or exposed in screenshots.

`live-board-messages-v2.js` cannot assume credentials exist at `DOMContentLoaded`. It:

- reads room/role/access details from the current URL and teacher session storage;
- accepts details from `live-board-session-ready`;
- builds a stable room/role/token session key;
- prevents duplicate initialization;
- retries while credentials or Supabase are not ready;
- reacts to hash/history changes;
- cleans up timers and realtime subscriptions on unload.

### Interaction and synchronization

- `live-board.js` owns the board position, side to move, move list, FEN loading, lesson-position selection, undo, and reset.
- `live-board-click-toggle.js` and `live-board-drag.js` keep tap/click and drag input compatible across desktop and touch devices.
- `live-board-realtime.js` synchronizes room state and the teacher-controlled student lock.
- `live-board-lesson-ux.js` handles CSV/XLSX prepared-position import and loading feedback.
- `live-board-messages-v2.js` synchronizes short messages and Lichess links, using realtime updates with refresh/poll support.
- The teacher may move, load FENs, import prepared positions, undo/reset/flip, and lock student moves. A locked student board remains view-only while continuing to receive synchronized state.

The Live Board must be tested with two pages or browser contexts because a single-page test cannot validate role separation, secure-link state, or teacher/student synchronization.

---

## 20. Persistence

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

## 21. Opening book

`loadOpeningBook()` fetches `assets/openings.tsv` and creates:

- a UCI-prefix index
- an EPD-position index

Identification prefers the longest matching UCI move prefix, with EPD and PGN-header information as fallbacks or supplements.

---

## 22. Static lesson architecture

The static lesson files are intentionally independent of the SPA framework because there is no framework.

### Shared lesson header

Pawn and Bishop pages that load `endgame-lesson.css`, and Advanced Pawn pages that load `advanced-pawn-lesson.css`, import `lesson-header.css`. The shared stylesheet standardizes the sticky translucent header, brand icon/label/title, pill-shaped actions, responsive wrapping, focus styles, and print hiding. Header markup remains the shared `.index-header` / `.index-header-inner` / `.index-brand` / `.index-top-actions` contract.

### Classroom presentation

Supported lesson pages load `lesson-presentation.js`, which injects `lesson-presentation.css` and a **Present Lesson** action. Scene collection differs slightly for Bishop's mixed legacy/generated markup, but both paths:

- collect meaningful top-level sections and intentional direct position cards;
- reject hidden, duplicate, source-only, and coach-only material;
- expose Previous, Reveal, Reset, Next, and Exit controls;
- support keyboard navigation and best-effort native fullscreen;
- preserve same-origin embedded boards and show a projected click pulse for pointer-down events on the lesson or embedded board.

The Teacher Board overlay is deliberately excluded from presentation scenes and click-pulse capture.

### Teacher Board

`pawn-teacher-board.js` is shared by supported Pawn, Advanced Pawn, and Bishop lesson pages. It creates the floating overlay and its lesson/setup controls, while the embedded SPA owns board state and legal interaction. `pawn-teacher-board.css` styles the overlay; `teacher-board-illegal-moves.mjs` extends board-only mode with demonstrations and history.

### Numbered endgame lessons

The numbered endgame chapters use `endgame-lesson.js` for static FEN diagrams and can embed the SPA for interactive exploration.

Static pages are printable and can use paged-media styling without requiring the SPA runtime for the written lesson content.

---

## 23. Optional local services

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

## 24. Event bindings

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

## 25. Validation and testing

There is no compile step, so validation combines syntax checks, targeted tests, and browser testing.

```powershell
node --check app.js
node --check ai-help-chat.mjs
node --check lessons/pawn-teacher-board.js
node --check lessons/teacher-board-illegal-moves.mjs
node --check lessons/lesson-presentation.js
node --check live-board-realtime.js
node --check live-board-messages-v2.js
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
- lesson presentation scene collection, reveal/reset/navigation, fullscreen fallback, and click pulse
- Teacher Board Empty/Start/Page, independent side to move, piece placement, take-back, and normal play after setup
- Live Board teacher/student synchronization, secure student link, lock state, prepared positions, and delayed message initialization
- lesson JSON and PGN round trips

---

## 26. Architectural constraints

The current design deliberately favors zero-build deployability and direct debugging. That also creates constraints:

- `app.js` is a large orchestration module.
- State mutation is global and imperative.
- DOM structure and CSS selectors form part of the runtime contract.
- Cache-version strings must be updated when dynamically loaded assets change, including every lesson page that consumes shared Teacher Board or presentation assets.
- Teacher Board message-listener propagation order is part of the runtime contract; helper listeners must not swallow setup actions owned by the main embedded-board listener.
- Live Board room credentials may arrive after DOM readiness, so credential-dependent modules must initialize from the session-ready lifecycle and remain idempotent.
- Worker messages must be guarded against stale sessions.
- Clock ownership must remain explicit during transitions.
- Setup drag, legal-move drag, pointer drag, and annotation gestures must remain isolated from one another.

Future modularization should preserve those behavioral contracts before splitting code merely to produce a more fashionable folder tree.
