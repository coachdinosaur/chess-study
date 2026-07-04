# Chess Lesson Study Board

---
**Local Windows deployment:** See [LOCAL_DEPLOYMENT.md](LOCAL_DEPLOYMENT.md) for running locally with Python and PowerShell.
---

Browser-based chess setup, study, and analysis app for building positions, recording lesson lines, adding annotations, and running Stockfish in the browser.

## Live App

Use the deployed GitHub Pages version here:

```text
https://coachdinosaur.github.io/chess-study/
```

For normal use, you do not need to install anything or run a local server.

## What It Does

- build any legal chess position via the Setup tab
- play moves from that position with drag-and-drop
- create main lines and side variations in the Study tab
- run Stockfish analysis in the browser with configurable depth
- probe the Lichess tablebase for up-to-7-piece endgames
- show the top 3 engine lines for the current position
- practice either the selected lesson line or any recorded branch
- draw arrows, circles, stars, and highlighted squares
- annotate positions with PGN comments in a collapsible editor
- import and export PGN with variations and comments (multi-game PGN supported)
- write a lesson note
- save and reopen lessons as `.lesson.json` files
- manage multiple lessons with New, Duplicate, Delete, and switch actions
- **Play vs Stockfish** with Elo strength selection, time controls, clocks, and side choice
- **Endgame Puzzles** tab with queue, statistics, objectives, difficulty, and premium keys
- **Guided Review** of CSV/XLSX lesson rows with engine and tablebase context
- **Opening book** identification (ECO code and opening name) from TSV database
- keyboard navigation of the move tree (Arrow keys), Escape to close modals

## Recent Improvements

- added Lichess tablebase analysis for legal up-to-7-piece endgames, including pawns, with no backend or API key required
- tablebase results now replace Stockfish automatically for eligible positions and fall back to Stockfish if the lookup is unavailable, rate-limited, offline, or out of scope
- tablebase move output now shows numbered SAN continuation lines, such as `1. Kb4 Kc6 2. ...`, instead of only result, DTM, and DTZ fields
- tablebase and engine PV lines stay visible after a move is played when the move belongs to one of the displayed lines, matching the smoother Lichess-style analysis flow
- analysis display now maps tablebase results into the existing eval badge, eval bar, status grid, and move-line panel
- lesson title, notation, and analysis move text are larger, while move-list text uses a lighter semibold weight
- light theme background is darker and easier on the eyes
- right-click annotation green is darker in both light and dark themes

### Endgame Puzzle Quality

The built-in puzzle generation pipeline was hardened to prevent illegal or misevaluated puzzles:

- **Legality gates** — `buildCandidate` now rejects positions where the solver is in check or would be checking the opponent king, using `game.isAttacked()` in both directions. Same check added to the setup board validation.
- **Deeper verification** — Minimum accept depth raised from 14 to 16; clarity gap raised from 150cp to 200cp. A two-phase verification (depth 24 then depth 28) catches horizon-effect mirages where a shallow search misses a refutation.
- **Storage-level filtering** — `isPuzzleFenIllegal()` runs on all puzzle ingestion paths (queue/history hydration, CSV import, `addPuzzleToQueue`, `addPuzzleToHistory`) so defective puzzles are never persisted.
- **Default puzzle audit** — All built-in default puzzles were verified against the Syzygy tablebase. Invalid FENs were corrected, illegal positions removed, and 6 replacements added with legal, tablebase-confirmed positions across mate, win, and draw objectives.
- **Tablebase-assisted generation** — The puzzle API can optionally probe the Lichess tablebase during verification, accepting ground-truth wins/draws for ≤7-piece positions instead of relying solely on search depth.

## Main Workspace

The app is organized around:

- a chessboard on the left with on-screen file/rank coordinates and captured-pieces display above and below
- a lesson title, `Analyze` / `Stop` button, move tree, and navigation area on the right
- optional tools with `Setup`, `Analysis`, and `Line` tabs
- a three-dot menu with note, tools, PV-line visibility, Focus mode, theme toggle, and a mobile fullscreen toggle on supported browsers
- pill badges showing the active tab, setup validity, and engine status
- an eval bar with turn-side marker and a meta strip (context label, turn, castling, en passant tokens)

## Setup Tab

The Setup tab provides a complete position builder:

- **Piece palette** — click a piece type, then click a board square to place it. Palette color toggle (White/Black) selects which color to place.
- **Drag-and-drop** — drag pieces from the palette onto the board, or drag pieces between board squares.
- **Eraser tool** — click to arm, then click a square to remove that piece.
- **Clear Board** — removes all non-King pieces at once.
- **Flip Board** — rotates the board 180 degrees.
- **FEN field** — paste a full FEN string and it applies automatically; `Apply FEN` and `Reset Draft` buttons for manual control.
- **Scan Board** — sends a chessboard image to `http://127.0.0.1:8765/predict-fen` (requires the local scanner helper server).
- **Advanced details** — collapsible panel for side-to-move, castling rights (checkboxes), and en passant target square (dropdown).
- **Hero banner** — shows green/danger status messages indicating setup validity.

## Play vs Stockfish Tab

A complete play-against-the-engine mode:

- **Start Game** — begins a game from the chosen position with the chosen settings.
- **Time controls** — Bullet (1+0), Blitz (3+2, 5+0), Rapid (10+0, 15+10), Classical (30+0, 45+45), or No clock.
- **Engine strength** — Elo slider from 800 to 3190. Ratings 800–1100 use a beginner weakness engine that deliberately selects weaker moves (Safe, Imperfect, or Weak alternatives).
- **Side selection** — White, Black, or Random.
- **Starting position** — Current board, Setup position, or Initial position.
- **Thinking speed** — Instant (0.1–0.5s), Fast (0.25–1.0s), Normal (0.5–2.0s), Slow (1.0–4.0s).
- **Clock display** — shown for both sides with active-turn highlighting. Resign and Offer Draw buttons available.
- **Engine stall watchdog** — 8-second timeout with one automatic retry, then a panel message.
- While a Play game is active, PGN comments and PV lines are auto-hidden; restored on resign.

## Endgame Puzzles Tab

A puzzle-practice system with built-in and generated endgame puzzles:

- **Queue** — shows upcoming puzzles; persisted to localStorage.
- **Default puzzles** — 20 built-in endgame puzzles verified against the Syzygy tablebase across mate, win, and draw objectives.
- **Objectives** — Checkmate, Gain a piece, Hold the draw, or Surprise me (random).
- **Difficulty** — Any, Easier, or Harder (based on mate length or total pieces).
- **Stockfish Defense slider** — Elo for the defending side (800–3190).
- **Stockfish Reply Speed** — Instant, Fast, Normal, Slow.
- **Statistics** — Solved, Failed, Streak, Best Streak.
- **Material gain progress** — shown for "Gain a piece" puzzles; draw objective has a losing-threshold detector.
- **Generate 5 More Puzzles** — batch-generates puzzles via Stockfish verification.
- **Reset Default Puzzles** — restores the original 20 built-in puzzles.
- **Save Queue as CSV / Load CSV Puzzles** — import/export puzzle sets.
- **Replay Previous Puzzle** — cycles through the puzzle history.
- **Clear Previous Puzzles** — with confirmation dialog.
- **Premium** — activation key (`CHESS-XXXX-XXXX-CC`) removes the free daily limit. Keys validated offline with a checksum. Generate from the browser console: `window.__endgamePuzzlePremium.generateKey()`.
- **Legality filtering** — `isPuzzleFenIllegal()` rejects any puzzle where the solver would be checking the opponent king, enforced on all ingestion paths (hydration, CSV import, add-to-queue, add-to-history).

## Setup Board Validation

The app validates positions before allowing play:

- **Setup position validity** — the setup board runs `isIllegalSetupPosition()` which checks both directions: the solver must not be in check, and the solver must not be checking the opponent king.
- **`isFenInsufficientMaterialDraw()`** — detects K vs K, KB vs K, KN vs K, and same-color-Bishop insufficient-material endgames.

## Annotations

- **Drawing tools** — arrows, circles, stars, and highlighted (painted) squares, drawn directly on the board.
- **Annotation toggle** in the Analysis panel enters annotation mode. While active, board clicks draw instead of moving pieces.
- **Mouse gestures** — right-click + drag paints squares, Alt + right-click + drag draws arrows, Ctrl + right-click places a star. Left-click clears all annotations (with a 400 ms suppression delay to prevent accidental clears).
- **Annotation colors** — green (primary), configurable. Darker green in both light and dark themes.
- **Last Move Arrow** — can be toggled on/off from the menu. When on, an arrow from the last move's origin to destination square is shown.

## Focus Mode

A distraction-free board view:

- **Enter** — from the three-dot menu. Shows only the board with minimal controls.
- **Exit** — press Escape.
- Useful for teaching, presenting, or concentrating on a single position.

## Lesson Book

The app supports multiple lessons in a single browser session:

- **Lesson picker dropdown** — switch between lessons.
- **Actions button** — New (creates a blank lesson), Duplicate (copies the current lesson), Delete (removes with confirmation, minimum of 1 kept).
- **Lesson-book file format** (`.lesson-book.json`) — saves and reopens all lessons at once.
- **Legacy draft migration** — older single-lesson drafts are automatically converted to the lesson-book format on load.

## Opening Book

An embedded opening reference:

- **TSV database** loaded from `./assets/openings.tsv` (ECO code, Name, PGN, UCI, EPD).
- **Opening identification** — UCI longest-prefix match with EPD fallback. Merges PGN header info (ECO, Opening, Variation) when available.
- **Display** — ECO code and opening name shown in the lesson header next to the FEN information.

## Keyboard Shortcuts

- **Arrow Left** — navigate to the parent move in the tree
- **Arrow Right** — navigate to the next move in the tree
- **Escape** — close premium modal, PGN game picker, puzzle result, custom select dropdown, Focus mode, and header menus
- **Enter** (in premium key input) — activate premium

## Practice Mode

The app includes two student practice styles:

- `Selected line`: follows the displayed lesson line from the root position
- `Branch drill`: starts from the current position and accepts any recorded child move
- start either mode from the `Analysis` or `Line` tool panel
- future moves are hidden while practice is active
- Stockfish output is hidden until practice stops
- wrong guesses do not change the saved lesson tree

## Guided Review

A separate panel for working through lesson-row data:

- **File input** — accepts `.csv`, `.xlsx`, and `.xls` files.
- **Context panel** — shows engine and tablebase analysis for the current FEN as you step through rows.
- Useful for reviewing a batch of positions from a spreadsheet (e.g., student games, exercise sets).

## Promotion Dialog

When a pawn reaches the eighth rank with multiple promotion options, a modal appears showing Queen, Rook, Bishop, and Knight as clickable piece images. The subtitle indicates the promoting side. The dialog can be dismissed by clicking the backdrop.

## Captured Pieces

Captured pieces are displayed in a dedicated area above and below the board:

- Pieces are shown with piece-count badges (`×2`, `×3`, etc.) when multiple of the same type are captured.
- Empty slots show pieces still on the board.
- The layout swaps top/bottom when the board is flipped.

## Lesson Files and PGN

`Save lesson` downloads a JSON file named like:

```text
my-lesson.lesson.json
```

Saved lesson files include:

- lesson title
- setup FEN
- board orientation
- active tab
- lesson tree and current node
- whether PV lines are shown
- annotations
- lesson note

`Open lesson` accepts `.json` and `.lesson.json` files.

`Export PGN` downloads a `.pgn` file that includes:

- lesson title as the PGN event name
- starting FEN when the lesson does not begin from the normal chess start
- the selected main line plus all recorded side variations
- PGN comments attached to positions in the move tree

`Import PGN` accepts `.pgn` files and rebuilds the lesson tree from the PGN move text, variations, and comments.

Use JSON when you need the full app state. JSON keeps the lesson note, annotations, board orientation, active tab, and other app-specific settings that PGN does not carry.

## Browser Draft Persistence

The app also keeps one browser-local working draft under `setup-analysis-draft-v1`, including:

- title
- setup FEN
- board orientation
- active tab
- advanced-controls open state
- current lesson-tree position
- full lesson move tree, including variations
- whether PV lines are shown
- practice mode preference
- board annotations
- lesson note text and note panel state

This draft is local to one browser profile. If the lesson matters, save a lesson file.

## Mobile Fullscreen

On supported mobile browsers, the three-dot menu shows `Enter fullscreen` / `Exit fullscreen` in mobile view.

Important limit:

- this is best-effort browser fullscreen, not PWA standalone mode
- iPhone Safari in a normal browser tab does not support hiding the browser bar for this app, so the fullscreen item stays hidden there

## Sharing and Multiple Users

Different people can use the GitHub Pages app at the same time on different devices or browser profiles.

Important limits:

- the app is not real-time collaborative
- one person's browser draft does not automatically sync to another person's browser
- lesson sharing happens by sending a saved `.lesson.json`, `.json`, or `.pgn` file
- multiple tabs in the same browser profile can overwrite the same local draft

## Included Assets

- MPChess SVG piece set in `assets/pieces/mpchess/`
- `chess.js` in `vendor/chess.js`
- Stockfish browser worker bundle in `vendor/stockfish/`

## Stockfish Upgrades

This app uses browser-compatible Stockfish bundles, not native desktop `stockfish.exe` downloads.

Put browser bundle files in `vendor/stockfish/`. The app will automatically use the strongest installed bundle it can run in this order:

- `stockfish-18.js` + `stockfish-18.wasm`
- `stockfish-18-single.js` + `stockfish-18-single.wasm`
- `stockfish-18-lite.js` + `stockfish-18-lite.wasm`
- `stockfish-18-lite-single.js` + `stockfish-18-lite-single.wasm`

Recommended setups:

- easiest stronger upgrade: add `stockfish-18-single.js` and `stockfish-18-single.wasm`
- strongest local setup: add `stockfish-18.js` and `stockfish-18.wasm`, then run `python local_server.py`

If you only install a multi-threaded bundle, the app needs the local server above or another server that sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

## Tablebase Analysis

For legal endgames with one king per side, no castling rights, and up to 7 pieces total, `Analyze` uses the public Lichess tablebase before Stockfish. This includes 4v3 and 3v4 endgames. Pawns are included.

This works from GitHub Pages or any static deployment because the request goes directly from the browser to:

```text
https://tablebase.lichess.ovh/standard
```

Important limits:

- tablebase lookup needs internet access
- results are cached per full FEN in the browser session
- solved move lines use bounded follow-up probes to build SAN continuations
- if the lookup is unavailable, rate-limited, or returns an unexpected response, the app falls back to Stockfish
- the puzzle generation API can optionally use tablebase verification for ≤7-piece positions during its confirm phase, accepting ground-truth wins/draws in place of deeper engine searches

## Local Development

If you want to run the app from this repository locally, serve the folder over HTTP:

```powershell
python -m http.server 8000
```

For the strongest multi-threaded Stockfish builds, use the included server instead:

```powershell
python local_server.py
```

Then open:

```text
http://127.0.0.1:8000/
```

Do not open `index.html` directly over `file://`. The Stockfish worker and asset loading are intended to run from an HTTP server.

### Chessboard Image Scanner Helper (Optional)

The app includes an optional **Scan board** feature that automatically converts chessboard images (`.png`, `.jpg`, `.jpeg`) into FEN positions. It relies on a local offline Python environment in `C:\Users\Ronaldo\fen_test` utilizing `chessimg2pos`.

#### 1. Start the Scanner Helper Server
In a separate terminal window, start the local scanner helper backend:
```powershell
python scanner_server.py
```
This starts a lightweight HTTP server on `http://127.0.0.1:8765`.

#### 2. Run the Main Web App
Ensure you are running the main HTTP server:
```powershell
python local_server.py
```
And open `http://127.0.0.1:8000/` in your browser.

#### 3. Use the Scan board Button
1. In the web app, click the **Setup** tab on the right pane.
2. Click the **Scan board** button.
3. Select a valid chessboard image file.
4. The helper server will process the image offline, return the parsed chessboard placement, and the app will automatically apply the FEN to the chessboard!

## Endgame Puzzle Premium Keys

The Endgame Puzzles tab allows `PUZZLE_FREE_PER_DAY` (3) free puzzles per day. An activation key in the form `CHESS-XXXX-XXXX-CC` removes the limit. Keys are validated entirely offline with a checksum, so no server or account is involved.

Pre-generated working keys:

```text
CHESS-894P-JZ3E-4O
CHESS-EV9G-UJ4U-YG
CHESS-QABK-VT27-AD
CHESS-4BZ6-8G8V-DS
CHESS-6Z58-J4HU-KP
CHESS-CVXK-32NW-NP
CHESS-42YC-DJG3-8T
CHESS-M7B9-ZMX9-BW
```

Generate more keys from the browser console while the app is open:

```js
window.__endgamePuzzlePremium.generateKey()
```

Important limits:

- this README is published with the public repository, so anyone who reads it can use these keys
- the checksum gate is a convenience lock, not real licensing — the generator ships in the client code

## Update GitHub

After making changes, review what will be committed and push to GitHub:

```powershell
git status
git add README.md
git commit -m "Update README"
git push origin main
```

If you changed more than one file, replace `git add README.md` with the specific files you want to upload.

## Documentation

- Beginner-friendly guide: [USER_GUIDE.md](./USER_GUIDE.md)
