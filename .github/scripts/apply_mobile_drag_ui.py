from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected one regex match, found {count}")
    return updated


app_path = Path("app.js")
styles_path = Path("styles.css")
ai_css_path = Path("ai-help-chat.css")
ai_js_path = Path("ai-help-chat.mjs")
index_path = Path("index.html")

app = app_path.read_text(encoding="utf-8")
styles = styles_path.read_text(encoding="utf-8")
ai_css = ai_css_path.read_text(encoding="utf-8")
ai_js = ai_js_path.read_text(encoding="utf-8")
index = index_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    """  boardDragHoverSquare: null,
  setupDrag: createEmptySetupDragState(),
  play: {""",
    """  boardDragHoverSquare: null,
  setupDrag: createEmptySetupDragState(),
  boardMoveDrag: createEmptyBoardMoveDragState(),
  play: {""",
    "board move drag state",
)

app = replace_once(
    app,
    """let lessonPositionBuilder = null;
let setupDragPreviewEl = null;""",
    """let lessonPositionBuilder = null;
let setupDragPreviewEl = null;
let boardPointerDragPreviewEl = null;""",
    "board pointer preview variable",
)

app = regex_once(
    app,
    r"function createEmptySetupDragState\(\) \{.*?\n\}\n",
    """function createEmptySetupDragState() {
  return {
    active: false,
    source: '',
    piece: '',
    fromSquare: '',
    droppedOnBoard: false,
  };
}

function createEmptyBoardMoveDragState() {
  return {
    active: false,
    pointerId: null,
    fromSquare: '',
    piece: '',
    startX: 0,
    startY: 0,
    moved: false,
    previewSize: 0,
    sourceElement: null,
  };
}
""",
    "empty board move drag state factory",
)

app = replace_once(
    app,
    "function buildBoardMarkup() {",
    """function currentBoardDragMoves() {
  const game = state.analysis.game;
  if (
    state.activeTab === TAB_SETUP
    || annotateModeActive()
    || state.analysis.pendingPromotion
    || !game
    || game.isGameOver()
  ) {
    return [];
  }

  if (state.play.active) {
    if (!state.play.gameReady) {
      return [];
    }
    const humanSide = state.play.assignedSide === 'white' ? 'w' : 'b';
    if (game.turn() !== humanSide) {
      return [];
    }
  }

  return game.moves({ verbose: true });
}

function submitDraggedBoardMove(fromSquare, toSquare) {
  if (!SQUARE_PATTERN.test(fromSquare) || !SQUARE_PATTERN.test(toSquare)) {
    return false;
  }
  const matchingMoves = currentBoardDragMoves().filter(
    (move) => move.from === fromSquare && move.to === toSquare,
  );
  if (!matchingMoves.length) {
    return false;
  }

  const promotions = Array.from(new Set(matchingMoves.map((move) => move.promotion).filter(Boolean)));
  if (promotions.length > 1) {
    openPromotionDialog(matchingMoves, state.practice.active ? 'practice' : 'analysis');
  } else {
    submitPracticeMove(matchingMoves[0]);
  }
  return true;
}

function buildBoardMarkup() {""",
    "board drag move helpers",
)

app = replace_once(
    app,
    """  const legalCaptures = new Set(
    legalMoves
      .filter((move) => move.captured || String(move.flags || '').includes('e'))
      .map((move) => move.to),
  );
  let markup = '';""",
    """  const legalCaptures = new Set(
    legalMoves
      .filter((move) => move.captured || String(move.flags || '').includes('e'))
      .map((move) => move.to),
  );
  const boardDragMoves = currentBoardDragMoves();
  const draggableSources = new Set(boardDragMoves.map((move) => move.from));
  let markup = '';""",
    "board draggable source set",
)

app = replace_once(
    app,
    """      const piece = pieces[square] || '';
      const classes = ['board-square', isLight ? 'light' : 'dark'];""",
    """      const piece = pieces[square] || '';
      const pieceDraggable = Boolean(piece)
        && (state.activeTab === TAB_SETUP || draggableSources.has(square));
      const classes = ['board-square', isLight ? 'light' : 'dark'];""",
    "piece draggable flag",
)

app = replace_once(
    app,
    "if (state.boardDragHoverSquare === square && state.activeTab === TAB_SETUP) {",
    "if (state.boardDragHoverSquare === square) {",
    "drag hover in all board modes",
)

app = replace_once(
    app,
    """            <div class="board-piece-shell ${state.activeTab === TAB_SETUP ? 'is-draggable' : ''}" data-square="${square}" data-piece="${piece}" draggable="${state.activeTab === TAB_SETUP}">""",
    """            <div class="board-piece-shell ${pieceDraggable ? 'is-draggable' : ''}" data-square="${square}" data-piece="${piece}" draggable="${pieceDraggable}">""",
    "draggable board piece markup",
)

app = replace_once(
    app,
    """function handleBoardDragStart(event) {
  if (state.activeTab !== TAB_SETUP) {
    return;
  }
  const pieceShell = event.target.closest('[data-piece][draggable="true"]');
  if (!pieceShell) {
    return;
  }
  const piece = pieceShell.dataset.piece;
  const square = pieceShell.dataset.square || '';
  if (!piece) {
    return;
  }
  event.dataTransfer?.setData('application/x-chess-piece', JSON.stringify({
    piece,
    fromSquare: square || null,
    source: square ? 'board' : 'palette',
  }));
  setSetupDragPreview(event, piece, pieceShell);
  event.dataTransfer.effectAllowed = 'copyMove';
  state.setupDrag = {
    active: true,
    source: square ? 'board' : 'palette',
    piece,
    fromSquare: square || '',
    droppedOnBoard: false,
  };
}""",
    """function handleBoardDragStart(event) {
  const pieceShell = event.target.closest('[data-piece][draggable="true"]');
  if (!pieceShell || !event.dataTransfer) {
    return;
  }
  const piece = pieceShell.dataset.piece;
  const square = pieceShell.dataset.square || '';
  if (!piece || !SQUARE_PATTERN.test(square)) {
    return;
  }

  if (state.activeTab === TAB_SETUP) {
    event.dataTransfer.setData('application/x-chess-piece', JSON.stringify({
      piece,
      fromSquare: square,
      source: 'board',
    }));
    setSetupDragPreview(event, piece, pieceShell);
    event.dataTransfer.effectAllowed = 'copyMove';
    state.setupDrag = {
      active: true,
      source: 'board',
      piece,
      fromSquare: square,
      droppedOnBoard: false,
    };
    return;
  }

  const canMove = currentBoardDragMoves().some((move) => move.from === square);
  if (!canMove) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData('application/x-chess-piece', JSON.stringify({
    piece,
    fromSquare: square,
    source: 'move',
  }));
  setSetupDragPreview(event, piece, pieceShell);
  event.dataTransfer.effectAllowed = 'move';
  state.setupDrag = {
    active: true,
    source: 'move',
    piece,
    fromSquare: square,
    droppedOnBoard: false,
  };
}""",
    "desktop board drag start",
)

app = replace_once(
    app,
    """function handleBoardDragOver(event) {
  if (state.activeTab !== TAB_SETUP) {
    return;
  }
  const squareEl = event.target.closest('.board-square');
  if (!squareEl) {
    return;
  }
  event.preventDefault();
  updateBoardDragHover(squareEl.dataset.square || null);
}""",
    """function handleBoardDragOver(event) {
  const squareEl = event.target.closest('.board-square');
  if (!squareEl) {
    return;
  }
  const targetSquare = squareEl.dataset.square || '';

  if (state.activeTab === TAB_SETUP && state.setupDrag.active) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = state.setupDrag.source === 'palette' ? 'copy' : 'move';
    }
    updateBoardDragHover(targetSquare);
    return;
  }

  if (state.setupDrag.source !== 'move') {
    return;
  }
  const legalTarget = currentBoardDragMoves().some(
    (move) => move.from === state.setupDrag.fromSquare && move.to === targetSquare,
  );
  if (!legalTarget) {
    clearBoardDragHover();
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  updateBoardDragHover(targetSquare);
}""",
    "desktop board drag over",
)

app = replace_once(
    app,
    """function handleBoardDrop(event) {
  if (state.activeTab !== TAB_SETUP) {
    return;
  }
  const squareEl = event.target.closest('.board-square');
  if (!squareEl) {
    return;
  }
  event.preventDefault();
  const payload = extractDragPayload(event);
  updateBoardDragHover(null);
  if (!payload?.piece) {
    clearSetupDragPreview();
    state.setupDrag = createEmptySetupDragState();
    return;
  }
  state.setupDrag.droppedOnBoard = true;
  placeSetupPiece(squareEl.dataset.square, payload.piece, payload.fromSquare || null);
  clearSetupDragPreview();
  state.setupDrag = createEmptySetupDragState();
}""",
    """function handleBoardDrop(event) {
  const squareEl = event.target.closest('.board-square');
  if (!squareEl) {
    return;
  }
  const targetSquare = squareEl.dataset.square || '';
  const payload = extractDragPayload(event);

  if (payload?.source === 'move') {
    event.preventDefault();
    clearBoardDragHover();
    const moved = submitDraggedBoardMove(payload.fromSquare || '', targetSquare);
    state.setupDrag.droppedOnBoard = moved;
    clearSetupDragPreview();
    state.setupDrag = createEmptySetupDragState();
    return;
  }

  if (state.activeTab !== TAB_SETUP) {
    return;
  }
  event.preventDefault();
  clearBoardDragHover();
  if (!payload?.piece) {
    clearSetupDragPreview();
    state.setupDrag = createEmptySetupDragState();
    return;
  }
  state.setupDrag.droppedOnBoard = true;
  placeSetupPiece(targetSquare, payload.piece, payload.fromSquare || null);
  clearSetupDragPreview();
  state.setupDrag = createEmptySetupDragState();
}""",
    "desktop board drop",
)

pointer_code = r'''function clearBoardPointerDragPreview() {
  if (!boardPointerDragPreviewEl) {
    return;
  }
  boardPointerDragPreviewEl.remove();
  boardPointerDragPreviewEl = null;
}

function updateBoardPointerDragPreview(clientX, clientY) {
  if (!boardPointerDragPreviewEl) {
    return;
  }
  boardPointerDragPreviewEl.style.left = `${clientX}px`;
  boardPointerDragPreviewEl.style.top = `${clientY}px`;
}

function showBoardPointerDragPreview(piece, size, clientX, clientY) {
  clearBoardPointerDragPreview();
  if (!PIECE_ASSETS[piece]) {
    return;
  }
  const preview = document.createElement('div');
  preview.className = 'board-pointer-drag-preview';
  preview.style.width = `${size}px`;
  preview.style.height = `${size}px`;
  const image = document.createElement('img');
  image.src = PIECE_ASSETS[piece];
  image.alt = '';
  preview.append(image);
  document.body.append(preview);
  boardPointerDragPreviewEl = preview;
  updateBoardPointerDragPreview(clientX, clientY);
}

function cancelBoardPointerDrag() {
  const drag = state.boardMoveDrag;
  if (drag.sourceElement instanceof Element) {
    drag.sourceElement.classList.remove('is-pointer-dragging');
    try {
      if (drag.pointerId !== null && drag.sourceElement.hasPointerCapture?.(drag.pointerId)) {
        drag.sourceElement.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // The browser may already have released pointer capture.
    }
  }
  clearBoardDragHover();
  clearBoardPointerDragPreview();
  state.boardMoveDrag = createEmptyBoardMoveDragState();
}

function handleBoardPointerDown(event) {
  if (event.pointerType === 'mouse' || !event.isPrimary || event.button !== 0) {
    return;
  }
  if (state.activeTab === TAB_SETUP || annotateModeActive()) {
    return;
  }
  const pieceShell = event.target.closest('.board-piece-shell.is-draggable');
  if (!pieceShell) {
    return;
  }
  const fromSquare = pieceShell.dataset.square || '';
  const piece = pieceShell.dataset.piece || '';
  if (!currentBoardDragMoves().some((move) => move.from === fromSquare)) {
    return;
  }

  const rect = pieceShell.getBoundingClientRect();
  const previewSize = Math.round(clamp(Math.min(rect.width, rect.height), 36, 96));
  state.boardMoveDrag = {
    active: true,
    pointerId: event.pointerId,
    fromSquare,
    piece,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    previewSize,
    sourceElement: pieceShell,
  };
  try {
    pieceShell.setPointerCapture?.(event.pointerId);
  } catch {
    // Pointer capture is an enhancement, not a requirement.
  }
}

function handleBoardPointerMove(event) {
  const drag = state.boardMoveDrag;
  if (!drag.active || drag.pointerId !== event.pointerId) {
    return;
  }
  const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (!drag.moved && distance < 7) {
    return;
  }

  event.preventDefault();
  if (!drag.moved) {
    drag.moved = true;
    drag.sourceElement?.classList.add('is-pointer-dragging');
    showBoardPointerDragPreview(drag.piece, drag.previewSize, event.clientX, event.clientY);
  } else {
    updateBoardPointerDragPreview(event.clientX, event.clientY);
  }

  const targetSquare = squareFromClientPoint(event.clientX, event.clientY);
  const legalTarget = currentBoardDragMoves().some(
    (move) => move.from === drag.fromSquare && move.to === targetSquare,
  );
  updateBoardDragHover(legalTarget ? targetSquare : null);
}

function handleBoardPointerUp(event) {
  const drag = state.boardMoveDrag;
  if (!drag.active || drag.pointerId !== event.pointerId) {
    return;
  }
  event.preventDefault();
  const fromSquare = drag.fromSquare;
  const moved = drag.moved;
  const targetSquare = squareFromClientPoint(event.clientX, event.clientY);
  state.annotations.suppressBoardClickUntil = Date.now() + 450;
  cancelBoardPointerDrag();

  if (!moved) {
    handleAnalysisSquareClick(fromSquare);
    return;
  }
  submitDraggedBoardMove(fromSquare, targetSquare || '');
}

function handleBoardPointerCancel(event) {
  if (!state.boardMoveDrag.active || state.boardMoveDrag.pointerId !== event.pointerId) {
    return;
  }
  state.annotations.suppressBoardClickUntil = Date.now() + 250;
  cancelBoardPointerDrag();
}

'''

app = replace_once(
    app,
    "function handleDocumentClick(event) {",
    pointer_code + "function handleDocumentClick(event) {",
    "touch pointer board drag handlers",
)

app = replace_once(
    app,
    """  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', handleDocumentMouseUp);""",
    """  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', handleDocumentMouseUp);
  document.addEventListener('pointermove', handleBoardPointerMove, { passive: false });
  document.addEventListener('pointerup', handleBoardPointerUp);
  document.addEventListener('pointercancel', handleBoardPointerCancel);""",
    "document pointer drag events",
)

app = replace_once(
    app,
    """  dom.boardGrid.addEventListener('mousedown', handleBoardMouseDown);
  dom.boardGrid.addEventListener('click', handleBoardClick);""",
    """  dom.boardGrid.addEventListener('mousedown', handleBoardMouseDown);
  dom.boardGrid.addEventListener('pointerdown', handleBoardPointerDown);
  dom.boardGrid.addEventListener('click', handleBoardClick);""",
    "board pointer down event",
)

app = replace_once(
    app,
    "window.addEventListener('blur', cancelAnnotationGesture);",
    """window.addEventListener('blur', () => {
    cancelAnnotationGesture();
    cancelBoardPointerDrag();
  });""",
    "blur drag cleanup",
)

styles = replace_once(
    styles,
    """.board-square.drag-hover {
  box-shadow: none;
}""",
    """.board-square.drag-hover {
  box-shadow: inset 0 0 0 4px var(--selection);
}""",
    "visible drag target",
)

styles = replace_once(
    styles,
    """.board-piece-shell.is-draggable {
  cursor: grab;
}""",
    """.board-piece-shell.is-draggable {
  cursor: grab;
  touch-action: none;
}""",
    "touch action for draggable pieces",
)

styles = replace_once(
    styles,
    """.board-piece-shell.is-draggable:active {
  cursor: grabbing;
}

.board-piece {""",
    """.board-piece-shell.is-draggable:active {
  cursor: grabbing;
}

.board-piece-shell.is-pointer-dragging {
  opacity: 0.32;
}

.board-piece {""",
    "pointer drag source styling",
)

styles = replace_once(
    styles,
    """.setup-drag-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: none;
}""",
    """.setup-drag-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: none;
}

.board-pointer-drag-preview {
  position: fixed;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: drop-shadow(0 8px 12px rgba(7, 17, 15, 0.3));
}

.board-pointer-drag-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}""",
    "pointer drag preview styling",
)

styles = replace_once(
    styles,
    """.lesson-header {
  position: relative;
  z-index: 1;
  gap: var(--space-xs);
  padding: var(--space-2xs) 0 var(--space-xs);
  border-bottom: 0;
  background: var(--header-bg);
}""",
    """.lesson-header {
  position: relative;
  z-index: 1;
  gap: var(--space-xs);
  padding: var(--space-2xs) 0 var(--space-xs);
  border-bottom: 0;
  background: var(--header-bg);
}

html[data-active-tab="play"] .lesson-title-input,
html[data-active-tab="puzzle"] .lesson-title-input {
  display: none;
}""",
    "hide lesson title in play and puzzle",
)

ai_css += """

/* Keep the floating helper from covering board controls on phones. */
@media (max-width: 760px), (max-height: 520px) and (pointer: coarse) {
  .ai-help-chat {
    display: none !important;
  }
}
"""

ai_js = replace_once(
    ai_js,
    "./ai-help-chat.css?v=20260718-ai-help3",
    "./ai-help-chat.css?v=20260719-mobile-hide1",
    "AI help stylesheet cache key",
)

index = replace_once(
    index,
    "./styles.css?v=20260710-lesson-builder1",
    "./styles.css?v=20260719-mobile-drag-ui1",
    "styles cache key",
)
index = replace_once(
    index,
    "./app.js?v=20260710-teacher-lesson-csv1",
    "./app.js?v=20260719-mobile-drag-ui1",
    "app cache key",
)

for required in (
    "function currentBoardDragMoves()",
    "function handleBoardPointerDown(event)",
    "function submitDraggedBoardMove(fromSquare, toSquare)",
    "html[data-active-tab=\"play\"] .lesson-title-input",
):
    if required not in app and required not in styles:
        raise SystemExit(f"missing expected patched marker: {required}")

app_path.write_text(app, encoding="utf-8")
styles_path.write_text(styles, encoding="utf-8")
ai_css_path.write_text(ai_css, encoding="utf-8")
ai_js_path.write_text(ai_js, encoding="utf-8")
index_path.write_text(index, encoding="utf-8")
