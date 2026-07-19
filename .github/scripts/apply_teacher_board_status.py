from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:80]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Teacher board wrapper: load chess.js, observe the embedded FEN, and render terminal status.
replace_once(
    "lessons/pawn-teacher-board.js",
    '''  var boardMenuOpen = false;\n  var maximized = false;\n\n  var lessonMenuOpen = false;''',
    '''  var boardMenuOpen = false;\n  var maximized = false;\n  var teacherGameStatusObserver = null;\n  var teacherGameStatusTimer = null;\n  var teacherGameStatusKey = "";\n  var chessModulePromise = import("../vendor/chess.js").catch(function (error) {\n    console.warn("Teacher board game-status detection is unavailable.", error);\n    return null;\n  });\n\n  var lessonMenuOpen = false;''',
)

replace_once(
    "lessons/pawn-teacher-board.js",
    '''  function normalizeFenText(value) {\n    return String(value == null ? "" : value).trim().replace(/\\s+/g, " ");\n  }\n''',
    '''  function normalizeFenText(value) {\n    return String(value == null ? "" : value).trim().replace(/\\s+/g, " ");\n  }\n\n  function clearTeacherGameStatus() {\n    teacherGameStatusKey = "";\n    if (!panel) {\n      return;\n    }\n    var status = panel.querySelector(".teacher-board-game-status");\n    if (!status) {\n      return;\n    }\n    status.hidden = true;\n    status.className = "teacher-board-game-status";\n    status.textContent = "";\n  }\n\n  function renderTeacherGameStatus(kind, message, fen) {\n    if (!panel) {\n      return;\n    }\n    var nextKey = kind + "|" + fen;\n    if (teacherGameStatusKey === nextKey) {\n      return;\n    }\n    var status = panel.querySelector(".teacher-board-game-status");\n    if (!status) {\n      return;\n    }\n    teacherGameStatusKey = nextKey;\n    status.className = "teacher-board-game-status is-" + kind;\n    status.textContent = message;\n    status.hidden = false;\n  }\n\n  async function evaluateTeacherGameStatus() {\n    if (!iframe || !iframe.contentDocument) {\n      clearTeacherGameStatus();\n      return;\n    }\n    var fenElement = iframe.contentDocument.getElementById("currentFenCode");\n    var fen = normalizeFenText(fenElement ? fenElement.textContent : "");\n    if (!fen) {\n      clearTeacherGameStatus();\n      return;\n    }\n\n    var chessModule = await chessModulePromise;\n    if (!chessModule || typeof chessModule.Chess !== "function") {\n      clearTeacherGameStatus();\n      return;\n    }\n\n    var currentFenElement = iframe && iframe.contentDocument\n      ? iframe.contentDocument.getElementById("currentFenCode")\n      : null;\n    if (normalizeFenText(currentFenElement ? currentFenElement.textContent : "") !== fen) {\n      return;\n    }\n\n    try {\n      var game = new chessModule.Chess(fen);\n      var checkmate = typeof game.isCheckmate === "function"\n        ? game.isCheckmate()\n        : typeof game.in_checkmate === "function" && game.in_checkmate();\n      var stalemate = typeof game.isStalemate === "function"\n        ? game.isStalemate()\n        : typeof game.in_stalemate === "function" && game.in_stalemate();\n\n      if (checkmate) {\n        var winner = game.turn() === "w" ? "Black" : "White";\n        renderTeacherGameStatus("checkmate", "Checkmate — " + winner + " wins.", fen);\n        return;\n      }\n      if (stalemate) {\n        renderTeacherGameStatus("stalemate", "Stalemate — the game is a draw.", fen);\n        return;\n      }\n      clearTeacherGameStatus();\n    } catch (error) {\n      clearTeacherGameStatus();\n    }\n  }\n\n  function scheduleTeacherGameStatusCheck() {\n    if (teacherGameStatusTimer) {\n      window.clearTimeout(teacherGameStatusTimer);\n    }\n    teacherGameStatusTimer = window.setTimeout(function () {\n      teacherGameStatusTimer = null;\n      evaluateTeacherGameStatus();\n    }, 60);\n  }\n\n  function disconnectTeacherGameStatusObserver() {\n    if (teacherGameStatusObserver) {\n      teacherGameStatusObserver.disconnect();\n      teacherGameStatusObserver = null;\n    }\n    if (teacherGameStatusTimer) {\n      window.clearTimeout(teacherGameStatusTimer);\n      teacherGameStatusTimer = null;\n    }\n  }\n\n  function observeTeacherGameStatus() {\n    disconnectTeacherGameStatusObserver();\n    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.documentElement) {\n      return;\n    }\n    teacherGameStatusObserver = new MutationObserver(scheduleTeacherGameStatusCheck);\n    teacherGameStatusObserver.observe(iframe.contentDocument.documentElement, {\n      childList: true,\n      characterData: true,\n      subtree: true\n    });\n    scheduleTeacherGameStatusCheck();\n  }\n''',
)

replace_once(
    "lessons/pawn-teacher-board.js",
    '''      '<div class="teacher-board-body">',\n      '  <iframe class="teacher-board-frame" title="Interactive teacher chessboard" loading="lazy"></iframe>',\n      '</div>',\n      '<div class="teacher-board-setup-tray" hidden>',''',
    '''      '<div class="teacher-board-body">',\n      '  <iframe class="teacher-board-frame" title="Interactive teacher chessboard" loading="lazy"></iframe>',\n      '</div>',\n      '<div class="teacher-board-game-status" role="status" aria-live="assertive" hidden></div>',\n      '<div class="teacher-board-setup-tray" hidden>',''',
)

replace_once(
    "lessons/pawn-teacher-board.js",
    '''    if (data.type === "teacherBoardReady") {\n      iframeReady = true;\n      sendPendingLessonLoad();\n      return;\n    }''',
    '''    if (data.type === "teacherBoardReady") {\n      iframeReady = true;\n      observeTeacherGameStatus();\n      sendPendingLessonLoad();\n      return;\n    }''',
)

replace_once(
    "lessons/pawn-teacher-board.js",
    '''  function handleTeacherIframeLoad() {\n    iframeReady = false;\n    requestIframeReady();\n  }''',
    '''  function handleTeacherIframeLoad() {\n    disconnectTeacherGameStatusObserver();\n    clearTeacherGameStatus();\n    iframeReady = false;\n    requestIframeReady();\n  }''',
)

# Teacher board presentation.
replace_once(
    "lessons/pawn-teacher-board.css",
    '''  grid-template-rows: auto minmax(0, 1fr) auto auto auto;''',
    '''  grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;''',
)

replace_once(
    "lessons/pawn-teacher-board.css",
    '''.teacher-board-panel.is-minimized .teacher-board-body,\n.teacher-board-panel.is-minimized .teacher-board-setup-tray,''',
    '''.teacher-board-panel.is-minimized .teacher-board-body,\n.teacher-board-panel.is-minimized .teacher-board-game-status,\n.teacher-board-panel.is-minimized .teacher-board-setup-tray,''',
)

replace_once(
    "lessons/pawn-teacher-board.css",
    '''.teacher-board-frame {\n  width: 100%;\n  height: 100%;\n  display: block;\n  border: 0;\n  background: #071012;\n}\n\n.teacher-board-tools {''',
    '''.teacher-board-frame {\n  width: 100%;\n  height: 100%;\n  display: block;\n  border: 0;\n  background: #071012;\n}\n\n.teacher-board-game-status {\n  padding: .58rem .78rem;\n  border-top: 1px solid var(--line, rgba(52, 74, 78, 0.92));\n  color: var(--text, #f7faf5);\n  background: color-mix(in srgb, var(--panel-strong, #1c2b30) 90%, #000 10%);\n  font-size: .86rem;\n  font-weight: 900;\n  line-height: 1.35;\n  text-align: center;\n}\n\n.teacher-board-game-status[hidden] {\n  display: none;\n}\n\n.teacher-board-game-status.is-checkmate {\n  border-top-color: color-mix(in srgb, var(--gold, #8ad8b7) 72%, transparent);\n  color: #eafff5;\n  background: color-mix(in srgb, var(--gold, #8ad8b7) 22%, var(--panel-strong, #1c2b30));\n}\n\n.teacher-board-game-status.is-stalemate {\n  border-top-color: rgba(238, 183, 78, .72);\n  color: #ffe5aa;\n  background: color-mix(in srgb, #9a6d1f 22%, var(--panel-strong, #1c2b30));\n}\n\n.teacher-board-tools {''',
)

# README additions for Focus placement and teacher-board terminal feedback.
replace_once(
    "README.md",
    '''The feature is also disabled in `?embed=1` and board-only modes.''',
    '''In Focus mode, the AI-help launcher and panel move to the lower-left so the lower-right app watermark remains unobstructed.\n\nThe feature is also disabled in `?embed=1` and board-only modes.''',
)

replace_once(
    "README.md",
    '''Embedded lesson pages communicate with the board through `window.postMessage()` for FEN loading, orientation, annotations, and teacher-board actions.''',
    '''Embedded lesson pages communicate with the board through `window.postMessage()` for FEN loading, orientation, annotations, and teacher-board actions.\n\nThe floating Teacher Board also evaluates the embedded FEN after moves and position loads. It shows a persistent, screen-reader-announced notification for **Checkmate** (including the winning side) or **Stalemate** until the position changes.''',
)

# Architecture details for the wrapper-side detector.
replace_once(
    "ARCHITECTURE.md",
    '''Same-origin checks protect request/response operations that include request IDs.''',
    '''The teacher-board wrapper dynamically imports `vendor/chess.js`, observes changes to the embedded board's `#currentFenCode`, and evaluates each settled FEN. A persistent `aria-live="assertive"` banner reports checkmate with the winning side or stalemate as a draw. The banner clears automatically when take-back, reset, setup, or another position produces a non-terminal FEN.\n\nSame-origin checks protect request/response operations that include request IDs.''',
)
