from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "20260725-teacher-board-setup1"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


# Parent lesson-side Teacher Board controls.
path = ROOT / "lessons/pawn-teacher-board.js"
text = path.read_text(encoding="utf-8")
text = text.replace('var TEACHER_CACHE_VERSION = "20260710-teacher-lesson-csv1";', f'var TEACHER_CACHE_VERSION = "{VERSION}";')
text = replace_once(
    text,
    '  var setupColor = "w";\n',
    '  var setupColor = "w";\n  var setupSideToMove = fenSideToMove(teacherFen());\n',
    "setup-side state",
)
text = replace_once(
    text,
    '''  function normalizeFenText(value) {
    return String(value == null ? "" : value).trim().replace(/\\s+/g, " ");
  }
''',
    '''  function normalizeFenText(value) {
    return String(value == null ? "" : value).trim().replace(/\\s+/g, " ");
  }

  function fenSideToMove(value) {
    var parts = normalizeFenText(value).split(" ");
    return parts[1] === "b" ? "b" : "w";
  }

  function currentTeacherBoardFen() {
    try {
      var fenElement = iframe && iframe.contentDocument
        ? iframe.contentDocument.getElementById("currentFenCode")
        : null;
      var current = normalizeFenText(fenElement ? fenElement.textContent : "");
      return current || teacherFen();
    } catch (error) {
      return teacherFen();
    }
  }

  function syncSetupSideToMoveFromFen(value) {
    setupSideToMove = fenSideToMove(value || currentTeacherBoardFen());
    syncSelectedPieceButtons();
  }
''',
    "fen helpers",
)
text = replace_once(
    text,
    '''  function setupPieceRow() {
    return [
      '<div class="teacher-piece-row" aria-label="' + (setupColor === "w" ? "White" : "Black") + ' pieces">',
      PIECES.map(function (piece) {
        return setupPieceButton(setupColor === "w" ? piece : piece.toLowerCase());
      }).join(""),
      '</div>'
    ].join("");
  }

  function setupBoardMenu() {
''',
    '''  function setupPieceRow() {
    return [
      '<div class="teacher-piece-row" aria-label="' + (setupColor === "w" ? "White" : "Black") + ' pieces">',
      PIECES.map(function (piece) {
        return setupPieceButton(setupColor === "w" ? piece : piece.toLowerCase());
      }).join(""),
      '</div>'
    ].join("");
  }

  function setupSideToMoveControl() {
    return [
      '<div class="teacher-side-to-move" role="group" aria-label="Side to move">',
      '  <span class="teacher-side-to-move-label">Side to move</span>',
      '  <button type="button" data-teacher-action="side-to-move" data-teacher-side="w" aria-pressed="' + (setupSideToMove === "w" ? "true" : "false") + '">White</button>',
      '  <button type="button" data-teacher-action="side-to-move" data-teacher-side="b" aria-pressed="' + (setupSideToMove === "b" ? "true" : "false") + '">Black</button>',
      '</div>'
    ].join("");
  }

  function setupBoardMenu() {
''',
    "side control markup",
)
text = replace_once(
    text,
    '''       setupColorToggle(),
       setupPieceRow(),
       '    <button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>',
''',
    '''       setupColorToggle(),
       setupPieceRow(),
       '    <button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>',
       setupSideToMoveControl(),
''',
    "initial tray side control",
)
text = replace_once(
    text,
    '''       setupColorToggle(),
       setupPieceRow(),
       '<button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>'
''',
    '''       setupColorToggle(),
       setupPieceRow(),
       '<button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>',
       setupSideToMoveControl()
''',
    "rerender tray side control",
)
text = replace_once(
    text,
    '''    if (boardMenu) {
      boardMenu.hidden = !boardMenuOpen;
    }
    panel.querySelectorAll("[data-teacher-piece]").forEach(function (button) {
''',
    '''    if (boardMenu) {
      boardMenu.hidden = !boardMenuOpen;
    }
    panel.querySelectorAll('[data-teacher-action="side-to-move"]').forEach(function (button) {
      var active = button.getAttribute("data-teacher-side") === setupSideToMove;
      setButtonState(button, active);
    });
    panel.querySelectorAll("[data-teacher-piece]").forEach(function (button) {
''',
    "sync side buttons",
)
text = replace_once(
    text,
    '''    if (data.type === "teacherBoardReady") {
      iframeReady = true;
      observeTeacherGameStatus();
      sendPendingLessonLoad();
      return;
    }
''',
    '''    if (data.type === "teacherBoardReady") {
      iframeReady = true;
      observeTeacherGameStatus();
      syncSetupSideToMoveFromFen();
      sendPendingLessonLoad();
      return;
    }
''',
    "ready side sync",
)
text = replace_once(
    text,
    '''    if (pending.kind === "lesson") {
      var position = lessonPositionById(pending.positionId);
''',
    '''    syncSetupSideToMoveFromFen(data.fen || pending.fen);

    if (pending.kind === "lesson") {
      var position = lessonPositionById(pending.positionId);
''',
    "successful load side sync",
)
text = replace_once(
    text,
    '''    if (action === "close") {
''',
    '''    if (action === "side-to-move") {
      setupSideToMove = button.getAttribute("data-teacher-side") === "b" ? "b" : "w";
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      post("setSideToMove", { side: setupSideToMove });
      return;
    }
    if (action === "close") {
''',
    "side action",
)
text = replace_once(
    text,
    '''      post("emptyTeacherBoard");
''',
    '''      post("emptyTeacherBoard", { side: setupSideToMove });
''',
    "empty action side",
)
text = replace_once(
    text,
    '''      post("startTeacherBoard");
''',
    '''      post("startTeacherBoard", { side: setupSideToMove });
''',
    "start action side",
)
path.write_text(text, encoding="utf-8")


# Embedded app setup actions.
path = ROOT / "app.js"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''function resetBoardOnlyToStartFen() {
  commitStrictFenInput(DEFAULT_POSITION, { render: true, showError: false });
''',
    '''function resetBoardOnlyToStartFen(side = 'w') {
  const parts = String(DEFAULT_POSITION).split(/\\s+/);
  parts[1] = side === 'b' ? 'b' : 'w';
  commitStrictFenInput(parts.join(' '), { render: true, showError: false });
''',
    "start side",
)
text = replace_once(
    text,
    '''function clearBoardOnlyTeacherSetup() {
  const nextMeta = {
    ...DEFAULT_META,
    activeColor: state.setup.meta.activeColor === 'b' ? 'b' : 'w',
''',
    '''function clearBoardOnlyTeacherSetup(side = '') {
  const nextMeta = {
    ...DEFAULT_META,
    activeColor: side === 'b' ? 'b' : (side === 'w' ? 'w' : (state.setup.meta.activeColor === 'b' ? 'b' : 'w')),
''',
    "empty side",
)
text = replace_once(
    text,
    '''function selectBoardOnlyTeacherPiece(piece) {
''',
    '''function setBoardOnlySideToMove(side) {
  if (!state.boardOnlyMode) {
    return;
  }
  const parts = String(state.setupFen || DEFAULT_POSITION).trim().split(/\\s+/);
  if (parts.length < 4) {
    return;
  }
  parts[1] = side === 'b' ? 'b' : 'w';
  parts[3] = '-';
  if (parts.length < 5) parts[4] = '0';
  if (parts.length < 6) parts[5] = '1';
  commitBoardOnlyFenInput(parts.slice(0, 6).join(' '), { render: true });
  state.activeTab = state.boardOnlyTeacherSetupActive ? TAB_SETUP : TAB_ANALYSIS;
  renderAll();
}

function selectBoardOnlyTeacherPiece(piece) {
''',
    "side updater",
)
text = replace_once(
    text,
    '''    case 'emptyTeacherBoard':
      clearBoardOnlyTeacherSetup();
      break;
    case 'startTeacherBoard':
      resetBoardOnlyToStartFen();
      break;
''',
    '''    case 'emptyTeacherBoard':
      clearBoardOnlyTeacherSetup(data.side);
      break;
    case 'startTeacherBoard':
      resetBoardOnlyToStartFen(data.side);
      break;
    case 'setSideToMove':
      setBoardOnlySideToMove(data.side);
      break;
''',
    "embedded action cases",
)
path.write_text(text, encoding="utf-8")


# Illegal-move helper must reset its history without swallowing setup commands.
path = ROOT / "lessons/teacher-board-illegal-moves.mjs"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''      if (data.action === 'emptyTeacherBoard'
        || data.action === 'startTeacherBoard'
        || data.action === 'lessonTeacherBoard') {
        event.stopImmediatePropagation();
''',
    '''      if (data.action === 'emptyTeacherBoard'
        || data.action === 'startTeacherBoard'
        || data.action === 'lessonTeacherBoard'
        || data.action === 'setSideToMove') {
        // Reset this helper's history, but allow the main embedded-board
        // listener to perform the requested setup action.
''',
    "illegal helper propagation",
)
path.write_text(text, encoding="utf-8")


# Style the new Side to move control.
path = ROOT / "lessons/pawn-teacher-board.css"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''.teacher-color-toggle:focus-visible,
.teacher-piece-button:focus-visible,
''',
    '''.teacher-color-toggle:focus-visible,
.teacher-side-to-move button:focus-visible,
.teacher-piece-button:focus-visible,
''',
    "side focus style",
)
text = replace_once(
    text,
    '''.teacher-color-toggle:hover,
.teacher-color-toggle.is-active {
  background: color-mix(in srgb, var(--gold, #8ad8b7) 24%, var(--panel-strong, #1c2b30));
  color: var(--text, #f7faf5);
}

.teacher-piece-button {
''',
    '''.teacher-color-toggle:hover,
.teacher-color-toggle.is-active {
  background: color-mix(in srgb, var(--gold, #8ad8b7) 24%, var(--panel-strong, #1c2b30));
  color: var(--text, #f7faf5);
}

.teacher-side-to-move {
  display: inline-flex;
  align-items: center;
  gap: .2rem;
  border: 1px solid color-mix(in srgb, var(--line, rgba(52, 74, 78, 0.92)) 72%, transparent);
  border-radius: 999px;
  padding: .18rem;
  background: rgba(0, 0, 0, .16);
}

.teacher-side-to-move-label {
  padding: 0 .42rem 0 .5rem;
  color: var(--muted, #b9c8c5);
  font-size: .7rem;
  font-weight: 850;
  white-space: nowrap;
}

.teacher-side-to-move button {
  border: 0;
  border-radius: 999px;
  padding: .32rem .52rem;
  color: var(--muted, #b9c8c5);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: .72rem;
  font-weight: 900;
}

.teacher-side-to-move button:hover,
.teacher-side-to-move button.is-active {
  color: #071012;
  background: var(--gold, #8ad8b7);
}

.teacher-piece-button {
''',
    "side styles",
)
path.write_text(text, encoding="utf-8")


# Load the repaired illegal-move module.
path = ROOT / "text-normalization.mjs"
text = path.read_text(encoding="utf-8")
text = re.sub(
    r"teacher-board-illegal-moves\.mjs\?v=[^'\"]+",
    f"teacher-board-illegal-moves.mjs?v={VERSION}",
    text,
)
path.write_text(text, encoding="utf-8")


# Cache-bust all existing Teacher Board JS/CSS references without changing which pages use it.
for candidate in ROOT.rglob("*"):
    if not candidate.is_file() or candidate.suffix.lower() not in {".html", ".js", ".mjs"}:
        continue
    source = candidate.read_text(encoding="utf-8")
    updated = re.sub(r"pawn-teacher-board\.(js|css)\?v=[^'\"\s<>]+", rf"pawn-teacher-board.\1?v={VERSION}", source)
    if updated != source:
        candidate.write_text(updated, encoding="utf-8")

print("Teacher Board setup repair applied.")
