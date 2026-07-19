from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE | re.DOTALL)
    if count != 1:
        raise RuntimeError(f"Expected one regex match in {path}, found {count}: {pattern[:100]!r}")
    write(path, updated)


# Load the standalone Focus-mode popup assets.
replace_once(
    "index.html",
    '<link rel="stylesheet" href="./styles.css?v=20260719-mobile-drag-ui1">',
    '<link rel="stylesheet" href="./styles.css?v=20260719-mobile-drag-ui1">\n  <link rel="stylesheet" href="./focus-analysis-popup.css?v=20260719-focus-analysis1">',
)
replace_once(
    "index.html",
    '<script type="module" src="./app.js?v=20260719-mobile-drag-ui1"></script>',
    '<script type="module" src="./app.js?v=20260719-mobile-drag-ui1"></script>\n  <script type="module" src="./focus-analysis-popup.mjs?v=20260719-focus-analysis1"></script>',
)

# Make Teacher Board terminal feedback a compact overlay inside the board body.
replace_once(
    "lessons/pawn-teacher-board.js",
    '''      '<div class="teacher-board-body">',
      '  <iframe class="teacher-board-frame" title="Interactive teacher chessboard" loading="lazy"></iframe>',
      '</div>',
      '<div class="teacher-board-game-status" role="status" aria-live="assertive" hidden></div>',
      '<div class="teacher-board-setup-tray" hidden>',''',
    '''      '<div class="teacher-board-body">',
      '  <iframe class="teacher-board-frame" title="Interactive teacher chessboard" loading="lazy"></iframe>',
      '  <div class="teacher-board-game-status" role="status" aria-live="assertive" hidden></div>',
      '</div>',
      '<div class="teacher-board-setup-tray" hidden>',''',
)
replace_once(
    "lessons/pawn-teacher-board.js",
    'renderTeacherGameStatus("checkmate", "Checkmate — " + winner + " wins.", fen);',
    'renderTeacherGameStatus("checkmate", "Checkmate. " + winner + " wins.", fen);',
)
replace_once(
    "lessons/pawn-teacher-board.js",
    'renderTeacherGameStatus("stalemate", "Stalemate — the game is a draw.", fen);',
    'renderTeacherGameStatus("stalemate", "Stalemate. Draw.", fen);',
)

replace_once(
    "lessons/pawn-teacher-board.css",
    '  grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;',
    '  grid-template-rows: auto minmax(0, 1fr) auto auto auto;',
)
replace_once(
    "lessons/pawn-teacher-board.css",
    '''.teacher-board-body {
  min-height: 0;
  background: #071012;
}''',
    '''.teacher-board-body {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: #071012;
}''',
)
regex_once(
    "lessons/pawn-teacher-board.css",
    r'''\.teacher-board-game-status \{.*?\n\}\n\n\.teacher-board-game-status\[hidden\] \{.*?\n\}\n\n\.teacher-board-game-status\.is-checkmate \{.*?\n\}\n\n\.teacher-board-game-status\.is-stalemate \{.*?\n\}''',
    '''.teacher-board-game-status {
  position: absolute;
  left: 50%;
  bottom: .55rem;
  z-index: 5;
  max-width: calc(100% - 1rem);
  transform: translateX(-50%);
  border: 1px solid color-mix(in srgb, var(--line, rgba(52, 74, 78, 0.92)) 88%, transparent);
  border-radius: 999px;
  padding: .34rem .62rem;
  overflow: hidden;
  color: var(--text, #f7faf5);
  background: color-mix(in srgb, var(--panel-strong, #1c2b30) 94%, #000 6%);
  box-shadow: 0 8px 22px rgba(0, 0, 0, .36);
  font-size: .74rem;
  font-weight: 900;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.teacher-board-game-status[hidden] {
  display: none;
}

.teacher-board-game-status.is-checkmate {
  border-color: color-mix(in srgb, var(--gold, #8ad8b7) 74%, transparent);
  color: #eafff5;
}

.teacher-board-game-status.is-stalemate {
  border-color: rgba(238, 183, 78, .78);
  color: #ffe5aa;
}''',
)

# Keep the freshly updated documentation accurate.
replace_once(
    "README.md",
    'Focus mode hides most surrounding interface and keeps minimal Analyze/Exit controls.',
    'Focus mode hides most surrounding interface and keeps minimal Analyze/Exit controls. Pressing Analyze opens a movable analysis window that mirrors the current Lichess tablebase or Stockfish PV lines; it can be minimized, repositioned, or closed.',
)
replace_once(
    "README.md",
    'The floating Teacher Board also evaluates the embedded FEN after moves and position loads. It shows a persistent, screen-reader-announced notification for **Checkmate** (including the winning side) or **Stalemate** until the position changes.',
    'The floating Teacher Board also evaluates the embedded FEN after moves and position loads. It shows a compact, screen-reader-announced **Checkmate** or **Stalemate** overlay inside the board area, without changing the board size, until the position changes.',
)
replace_once(
    "README.md",
    '| `styles.css` | Layout, themes, responsive behavior, board and panel styling |',
    '| `styles.css` | Layout, themes, responsive behavior, board and panel styling |\n| `focus-analysis-popup.mjs` | Movable Focus-mode tablebase/PV analysis window |\n| `focus-analysis-popup.css` | Focus analysis window presentation and responsive sizing |',
)
replace_once(
    "ARCHITECTURE.md",
    'The teacher-board wrapper dynamically imports `vendor/chess.js`, observes changes to the embedded board\'s `#currentFenCode`, and evaluates each settled FEN. A persistent `aria-live="assertive"` banner reports checkmate with the winning side or stalemate as a draw. The banner clears automatically when take-back, reset, setup, or another position produces a non-terminal FEN.',
    'The teacher-board wrapper dynamically imports `vendor/chess.js`, observes changes to the embedded board\'s `#currentFenCode`, and evaluates each settled FEN. A compact absolutely positioned `aria-live="assertive"` overlay reports checkmate with the winning side or stalemate as a draw without adding a layout row or resizing the board. The overlay clears automatically when take-back, reset, setup, or another position produces a non-terminal FEN.',
)

print("Focus analysis popup and compact Teacher Board status applied.")
