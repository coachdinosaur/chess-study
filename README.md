# Chess Lesson Study Board

A framework-free, browser-based chess teaching and study application. It combines a position editor, lesson-tree authoring, Stockfish analysis, tablebase support, practice drills, Play vs Stockfish, separate endgame and Lichess position-training modes, teacher-managed student puzzle assignments, static course lessons with classroom presentation and Teacher Board tools, a synchronized teacher/student Live Board, and an optional AI chess-help panel.

## Live app

```text
https://cddigital.top/
```

For normal use, open the deployed site in a modern browser. No installation is required.

For local Windows setup, see [LOCAL_DEPLOYMENT.md](LOCAL_DEPLOYMENT.md).

## Main features

- Build and validate custom chess positions from FEN or the piece palette.
- Move pieces by clicking or dragging.
  - Desktop uses native drag-and-drop.
  - Touch and pen use pointer-based dragging with a floating piece preview.
  - Tap-to-select and tap-to-move remain available.
- Record a lesson as a branching move tree with main lines and variations.
- Add PGN comments, lesson notes, arrows, circles, stars, and colored square highlights.
- Import and export PGN, including comments, variations, and multi-game files.
- Save and reopen lesson JSON files and multi-lesson books.
- Analyze positions with browser Stockfish and up to three principal variations.
- Probe the public Lichess tablebase for eligible endgames.
- Practice a selected line or drill any recorded branch.
- Play against Stockfish with Elo, side, speed, starting-position, and clock settings.
- Train in separate Endgame Puzzle and Lichess Position Training modes, with a current production library of 10,000 validated Lichess-derived positions.
- Review CSV/XLSX position sets in the Lesson Position Builder.
- Identify openings from the bundled ECO/opening database.
- Use static Pawn, Advanced Pawn, Bishop, and numbered endgame lesson pages in `lessons/`.
- Present supported lessons scene by scene with Previous, Reveal, Reset, Next, Exit, keyboard shortcuts, fullscreen support, and a visible click pulse for classroom projection.
- Open the floating Teacher Board from supported lesson pages to load Page, Start, Empty, or prepared CSV positions; set the side to move; place pieces; annotate; take back; flip; and reset.
- Create a secure synchronized Live Board room for a teacher and student, including student-move locking, FEN and lesson-position loading, move history, and session messages.
- Ask the optional Dyno Bot panel about the visible position and notation on supported desktop-sized layouts.

## Workspace

The single-page application is organized around six tabs:

| Tab | Purpose |
|---|---|
| Study | Board and notation with the tools panel collapsed |
| Setup | Position construction, FEN editing, scanner input, castling and en passant controls |
| Analysis | Stockfish/tablebase analysis, annotations, and practice controls |
| Play | Play vs Stockfish |
| Puzzle | Separate Endgame Puzzle and Lichess Position Training modes, including adaptive learning and Mistake Review |
| Lessons | CSV/XLSX Lesson Position Builder |

The lesson title input is intentionally hidden while the Play or Puzzle tab is active so game controls receive the available space. The title remains part of the lesson state and returns on the other tabs.

## Board interaction

### Click and tap

Click or tap a movable piece, then select a legal destination. Legal targets and captures are highlighted.

### Dragging legal moves

Legal pieces can be dragged in Analysis, Practice, Play, and Puzzle contexts.

- On desktop, the app uses HTML drag events.
- On touch and pen devices, it uses pointer events.
- A move is accepted only when the source and destination match a legal `chess.js` move.
- During Play and Puzzle sessions, only the human side can be dragged.
- Promotion opens the same promotion dialog used by click-to-move.
- Annotation mode and Setup mode keep their specialized board behavior.

### Setup dragging

The Setup tab separately supports:

- dragging pieces from the palette to the board
- moving setup pieces between squares
- deleting a setup piece by dragging it off the board
- click-to-place and eraser tools

## Play vs Stockfish

Available controls include:

- Elo from 800 to 3190
- White, Black, or Random side
- Current, Setup, or Initial starting position
- Instant, Fast, Normal, or Slow engine speed
- Bullet `1+0`
- Blitz `3+2` and `5+0`
- Rapid `10+0` and `15+10`
- Classical `30+0` and `45+45`
- No clock

### Clock behavior

The clock system is designed to avoid assigning browser-processing delay to the wrong player:

- The clock does not begin until Stockfish is ready.
- `performance.now()` is used for monotonic elapsed-time measurement.
- `state.play.activeClock` explicitly records which side owns the running clock.
- The mover's elapsed time is settled before a move is accepted.
- A player who has reached zero is flagged before increment can be added.
- The next clock starts only after the move is processed and the board is rendered.
- The display refreshes every 50 ms.
- Tenths are shown below ten seconds.
- An 8-second engine watchdog retries a stalled Stockfish request once.

The Play and Puzzle interfaces also hide the lesson title. During an active Play game, PGN comments and PV lines are temporarily hidden and restored after the game ends.

## Puzzle modes

The Puzzle tab contains two independent trainers. They share reusable chess rules, board assets, Stockfish, and tablebase infrastructure, but they keep separate solving rules, persistence, statistics, and interfaces.

### Endgame puzzles

The legacy Endgame Puzzle mode provides:

- built-in tablebase-checked endgame positions
- generated puzzle batches
- checkmate, gain-a-piece, and hold-the-draw objectives
- difficulty and Stockfish defense settings
- queue and history persistence
- solved, failed, streak, and best-streak statistics
- CSV queue import/export
- replay and reset controls
- legality filtering on every puzzle ingestion path
- optional tablebase-assisted candidate verification

Endgame sessions reuse the Play-vs-Engine move machinery but are untimed.

### Lichess Position Training

Lichess Position Training is a separate objective-preservation trainer backed by 10,000 validated Lichess-derived positions in 400 shards of 25 records. The interface reads the total from the dataset manifest, loads shards on demand, and caches successfully fetched JSON in IndexedDB.

The database's first move is applied only to reconstruct the position presented to the solver. The remaining source continuation is deliberately not stored or treated as the only correct line. A student move is accepted when it preserves the position's required result or completes the objective; alternative winning or drawing moves can therefore be valid.

The trainer includes:

- Fixed rating-range and adaptive difficulty modes
- theme filtering, including weakest-theme practice
- four progressive hint levels
- adaptive rating and theme statistics stored in the browser
- Mistake Review with spaced clean-solve retirement
- terminal checkmate and draw handling before tablebase or Stockfish evaluation
- stable desktop board sizing before and after feedback appears
- teacher-generated assignments with frozen puzzle snapshots and secure student links

See [LICHESS_POSITION_TRAINING.md](LICHESS_POSITION_TRAINING.md) for the complete user, data, evaluator, learning, and assignment reference.

## Analysis and tablebase

The app selects the best available analysis source:

1. Eligible endgames are probed through the Lichess tablebase.
2. Other positions use the strongest compatible bundled Stockfish worker.
3. If a tablebase request fails, analysis falls back to Stockfish.

Tablebase eligibility requires a legal FEN, no castling rights, no more than seven total pieces, and no more than four pieces per side.

## AI chess help

`ai-help-chat.mjs` mounts an optional floating Dyno Bot panel outside embedded and board-only mode. It can explain the visible board, plans, candidate moves, tactical ideas, lesson concepts, and supported app controls.

The browser sends bounded context to a Cloudflare Worker:

- lesson title
- current FEN and setup FEN
- opening name/ECO display
- active tab
- side-to-move and position labels
- visible notation, capped before transmission

```text
Browser → Cloudflare Worker /chat → Gemini Interactions API
```

The Gemini API key is never stored in the static site. It exists only as the Worker's `GEMINI_API_KEY` secret. The browser endpoint comes from `ai-help-config.mjs` or the local testing key `chess-study-ai-endpoint-v1`.

The Worker lives in `worker/ai-help-worker.js`, with deployment configuration in `worker/wrangler.jsonc`. It provides `POST /chat`, `GET /health`, exact-origin CORS validation, request limits, rate limiting, and normalized public errors.

Current production origins are `https://cddigital.top` and `https://www.cddigital.top`. The old GitHub Pages origin and localhost origins remain available for fallback and development.

### Deploy or update the Worker

Merging Worker code does not update the running Cloudflare deployment.

```powershell
cd worker
npx wrangler login
npx wrangler deploy
```

The existing secret normally remains attached. Set it only if Cloudflare reports it missing:

```powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Never commit the API key.

### AI Help troubleshooting

- **`NetworkError when attempting to fetch resource`**: check Worker deployment, endpoint URL, DNS/TLS, and `ALLOWED_ORIGINS`; this usually occurs before Gemini is contacted.
- **Busy or temporary error**: wait briefly; rate limiting or Gemini capacity may be involved.
- **Configuration error**: confirm the Worker secret and configured model.
- **Timeout**: the client aborts after 45 seconds.

The floating control is hidden on phone-width layouts and short coarse-pointer landscape screens so it does not cover board controls. In Focus mode it moves to the lower-left. It is disabled in `?embed=1` and board-only modes.

## Lessons and files

### Lesson JSON

Lesson files preserve app-specific state such as:

- title and setup FEN
- board orientation
- move tree and selected branches
- comments and note
- annotations
- visibility preferences
- active lesson position

The app supports individual `.lesson.json` files and multi-lesson `.lesson-book.json` files.

### PGN

PGN import/export supports:

- non-standard starting FENs
- main lines and nested variations
- comments
- multi-game browsing and selection

Use JSON when complete application state matters. Use PGN for chess notation interchange.

### Browser draft

The current lesson book is persisted locally under `setup-analysis-draft-v1`. Puzzle settings, queue, history, theme, AI endpoint, and Lesson Position Builder state use separate localStorage keys.

Browser storage is local to one browser profile and is not collaborative synchronization.

## Static course lessons and Teacher Board

Static lessons live in `lessons/` and remain printable, self-contained teaching pages. Pawn, Advanced Pawn, and Bishop lesson families share the Pawn-inspired sticky header through `lesson-header.css`, including consistent branding, navigation, theme/print controls, responsive wrapping, and print hiding.

Supported lesson pages add **Present Lesson** through `lesson-presentation.js` and `lesson-presentation.css`. Presentation mode:

- collects meaningful top-level lesson scenes and intentional position cards;
- avoids duplicate scenes and coach-only/source notes;
- provides Previous, Reveal, Reset, Next, and Exit controls;
- supports Left/Right arrows, Space, `R`, and Escape;
- requests browser fullscreen when available;
- shows a short click pulse on the lesson or same-origin embedded board so students can follow the teacher's pointer.

The floating **Teacher Board** is separate from the full SPA Setup tab. Its setup tray provides:

- **Board → Empty**: remove every piece while preserving the selected side to move;
- **Board → Start**: load all 32 starting pieces with White or Black selected to move;
- **Board → Page**: restore the exact lesson-page FEN;
- independent piece-palette color and **Side to move** controls;
- piece placement and erasing, followed by **Done** to return to normal board play;
- prepared-position CSV import, annotation, take back, mark clearing, flip, reset, and checkmate/stalemate status.

`Page` and imported positions resynchronize the side-to-move selector from their FEN. The setup commands are delivered through the embedded-board `postMessage()` protocol, while `teacher-board-illegal-moves.mjs` keeps demonstration history without swallowing those commands.

## Live Board

`live-board.html` is a separate synchronized teaching surface for one teacher and one student.

Teacher workflow:

1. Open `live-board.html` and choose **Create teacher room**.
2. Copy the generated secure student link.
3. Send that link to the student; do not send the teacher URL or teacher access token.
4. Move pieces by click/tap or drag, load a FEN, or import CSV/XLSX prepared positions.
5. Use **Lock student moves** when demonstrating, and use Undo, Reset, Flip board, Theme, or session messages as needed.

The student opens the secure link and receives the synchronized position, move list, lock state, and messages. Supabase supplies room state, realtime updates, and message storage. The message module waits for valid room credentials and the `live-board-session-ready` event instead of assuming credentials already exist at `DOMContentLoaded`.

## Mobile behavior

Mobile-specific behavior includes:

- a nearly edge-to-edge portrait board
- compact coordinates, captured pieces, and evaluation rail
- engine lines duplicated into a dedicated slot below the board
- pointer-based piece dragging
- tap-to-move support
- best-effort fullscreen where supported
- hidden floating AI-help control to prevent board obstruction

iPhone Safari in a normal tab may not expose browser fullscreen controls.

## Focus and embed modes

Focus mode hides most surrounding interface and keeps minimal Analyze/Exit controls. Pressing Analyze opens a movable analysis window that mirrors the current Lichess tablebase or Stockfish PV lines; it can be minimized, repositioned, or closed.

Embedding is enabled with:

```text
?embed=1
```

Common optional parameters include:

```text
?fen=<encoded FEN>
?boardOnly=1
?setupPanel=open
```

Embedded lesson pages communicate with the board through `window.postMessage()` for FEN loading, orientation, annotations, and teacher-board actions.

The floating Teacher Board also evaluates the embedded FEN after moves and position loads. It shows a compact, screen-reader-announced **Checkmate** or **Stalemate** overlay inside the board area, without changing the board size, until the position changes. Setup actions include independent piece color and side-to-move state, Empty/Start/Page loading, prepared-position loading, and normal play after leaving setup.

## Main files

| File | Responsibility |
|---|---|
| `index.html` | SPA shell, panels, modals, board containers, cache-versioned assets |
| `app.js` | Global state, rendering, events, board interaction, Stockfish/tablebase, Play, Puzzle, lesson management |
| `styles.css` | Layout, themes, responsive behavior, board and panel styling |
| `focus-analysis-popup.mjs` | Movable Focus-mode tablebase/PV analysis window |
| `focus-analysis-popup.css` | Focus analysis window presentation and responsive sizing |
| `pgn.mjs` | PGN parsing, multi-game splitting, lesson-tree import/export |
| `puzzle-api.mjs` | Legacy endgame puzzle generation and verification using a dedicated worker |
| `lichess-position-training.mjs` | Separate Lichess trainer controller, board, filters, feedback, history, and library-count display |
| `lichess-position-training-core.mjs` | Position reconstruction, objective derivation, move classification, and solved-state rules |
| `lichess-position-training-data.mjs` | Manifest/shard loading, rating/theme filtering, randomization, and IndexedDB fallback cache |
| `lichess-position-training-engine.mjs` | Solver-relative tablebase and Stockfish evaluation, including terminal-state handling |
| `lichess-position-training-learning.mjs` | Adaptive rating, progressive hints, theme metrics, explanations, and Mistake Review |
| `assets/puzzles/lichess-position-training/` | Production manifest and 400 immutable 25-puzzle shards (10,000 positions) |
| `lesson-position-builder.mjs` | CSV/XLSX lesson-position workflow |
| `text-normalization.mjs` | Unicode and punctuation normalization |
| `ai-help-chat.mjs` | Dyno Bot UI, context collection, request lifecycle |
| `ai-help-chat.css` | Floating chat styling and mobile auto-hide rules |
| `ai-help-config.mjs` | Default AI endpoint configuration |
| `ai-help-icon.mjs` | Embedded launcher icon data |
| `worker/ai-help-worker.js` | Cloudflare Worker CORS, validation, rate limiting, Gemini proxy, `/chat`, and `/health` |
| `worker/wrangler.jsonc` | Worker variables, production origins, model, and rate-limit binding |
| `live-board.html` | Teacher/student room shell, synchronized board, lesson/FEN controls, messages |
| `live-board.js` | Live Board position state, legal interaction, move list, lesson/FEN loading |
| `live-board-realtime.js` | Secure room bootstrap, credentials, Supabase state synchronization |
| `live-board-messages-v2.js` | Session message lifecycle, realtime subscription, polling fallback |
| `lessons/lesson-header.css` | Shared Pawn-inspired header across lesson families |
| `lessons/lesson-presentation.js` / `.css` | Classroom scene mode, reveals, navigation, fullscreen, click pulse |
| `lessons/pawn-teacher-board.js` / `.css` | Floating lesson Teacher Board UI and parent-side protocol |
| `lessons/teacher-board-illegal-moves.mjs` | Demonstration moves and Teacher Board history inside the embedded SPA |
| `vendor/chess.js` | Chess rules, legal moves, FEN, PGN support |
| `vendor/stockfish/` | Browser-compatible Stockfish bundles |
| `assets/openings.tsv` | Opening identification database |
| `lessons/` | Static published lesson pages and shared lesson helpers |

A deeper implementation map is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Local development

Serve the repository over HTTP. Do not open `index.html` through `file://`.

Basic static server:

```powershell
python -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

For multi-threaded Stockfish with the required cross-origin isolation headers:

```powershell
python local_server.py
```

The server must provide:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Optional board scanner

The Setup tab can send `.png`, `.jpg`, or `.jpeg` board images to:

```text
http://127.0.0.1:8765/predict-fen
```

Start the helper with:

```powershell
python scanner_server.py
```

The scanner is optional and local-only.

## Stockfish bundles

The app prefers the strongest usable installed bundle:

1. `stockfish-18.js` + `stockfish-18.wasm`
2. `stockfish-18-single.js` + `stockfish-18-single.wasm`
3. `stockfish-18-lite.js` + `stockfish-18-lite.wasm`
4. `stockfish-18-lite-single.js` + `stockfish-18-lite-single.wasm`

Multi-threaded bundles require cross-origin isolation. Mobile/coarse-pointer devices may prefer a compatible single-threaded bundle.

## Validation

Useful checks after editing JavaScript or documentation:

```powershell
node --check app.js
node --check ai-help-chat.mjs
node --check worker/ai-help-worker.js
node --check lessons/pawn-teacher-board.js
node --check lessons/teacher-board-illegal-moves.mjs
node --check lessons/lesson-presentation.js
node --check live-board-realtime.js
node --check live-board-messages-v2.js
node tools/test-puzzle-api.mjs
git diff --check
```

Because the app has no build step, browser testing remains important. Test at minimum:

- desktop click and drag moves
- mobile tap and pointer drag moves
- Play clocks near zero and with increment
- promotion by click and drag
- puzzle sessions
- analysis/tablebase fallback
- embedded board mode
- lesson presentation scene navigation, reveal/reset, and click pulse
- Teacher Board Empty, Start, Page, side-to-move, piece placement, and normal play after setup
- Live Board teacher/student synchronization, lock state, prepared positions, and delayed message initialization
- mobile AI-help hiding
- lesson JSON and PGN round trips

## Supporting documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [USER_GUIDE.md](USER_GUIDE.md)
- [LICHESS_POSITION_TRAINING.md](LICHESS_POSITION_TRAINING.md)
- [LOCAL_DEPLOYMENT.md](LOCAL_DEPLOYMENT.md)
- [Lesson index](lessons/index.html)
