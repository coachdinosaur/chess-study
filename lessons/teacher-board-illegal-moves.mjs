const TEACHER_QUERY_FLAG = '_teacher';
const SQUARE_PATTERN = /^[a-h][1-8]$/;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CASTLING_RIGHT_BY_ROOK_SQUARE = Object.freeze({
  a1: 'Q',
  h1: 'K',
  a8: 'q',
  h8: 'k',
});

function teacherBoardModeActive() {
  try {
    const params = new URLSearchParams(window.location.search);
    const embed = params.get('embed');
    const boardOnly = params.get('boardOnly');
    return (embed === '1' || embed === 'true')
      && (boardOnly === '1' || boardOnly === 'true')
      && params.has(TEACHER_QUERY_FLAG);
  } catch {
    return false;
  }
}

function pieceColor(piece) {
  if (!piece) {
    return '';
  }
  return piece === piece.toLowerCase() ? 'b' : 'w';
}

function colorName(color) {
  return color === 'b' ? 'Black' : 'White';
}

function pieceName(piece) {
  const names = {
    K: 'king',
    Q: 'queen',
    R: 'rook',
    B: 'bishop',
    N: 'knight',
    P: 'pawn',
  };
  return names[String(piece || '').toUpperCase()] || 'piece';
}

function parseFen(fen) {
  const parts = String(fen || '').trim().split(/\s+/);
  if (parts.length < 4) {
    return null;
  }
  const ranks = parts[0].split('/');
  if (ranks.length !== 8) {
    return null;
  }

  const pieces = Object.create(null);
  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    let fileIndex = 0;
    for (const token of ranks[rankIndex]) {
      if (/^[1-8]$/.test(token)) {
        fileIndex += Number(token);
        continue;
      }
      if (!/^[prnbqkPRNBQK]$/.test(token) || fileIndex > 7) {
        return null;
      }
      const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
      pieces[square] = token;
      fileIndex += 1;
    }
    if (fileIndex !== 8) {
      return null;
    }
  }

  return {
    pieces,
    activeColor: parts[1] === 'b' ? 'b' : 'w',
    castling: parts[2] && parts[2] !== '-' ? parts[2] : '-',
    enPassant: parts[3] || '-',
    halfmove: Number.isFinite(Number(parts[4])) ? Math.max(0, Number(parts[4])) : 0,
    fullmove: Number.isFinite(Number(parts[5])) ? Math.max(1, Number(parts[5])) : 1,
  };
}

function placementFromPieces(pieces) {
  const rows = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const square = `${String.fromCharCode(97 + file)}${rank}`;
      const piece = pieces[square] || '';
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      row += piece;
    }
    if (empty) {
      row += String(empty);
    }
    rows.push(row);
  }
  return rows.join('/');
}

function removeCastlingRight(rights, flag) {
  const index = rights.indexOf(flag);
  if (index >= 0) {
    rights.splice(index, 1);
  }
}

function castlingAfterMove(castling, piece, from, to, capturedPiece) {
  const rights = castling === '-' ? [] : castling.split('');
  const color = pieceColor(piece);
  const upper = String(piece || '').toUpperCase();

  if (upper === 'K') {
    if (color === 'w') {
      removeCastlingRight(rights, 'K');
      removeCastlingRight(rights, 'Q');
    } else {
      removeCastlingRight(rights, 'k');
      removeCastlingRight(rights, 'q');
    }
  }

  if (upper === 'R' && CASTLING_RIGHT_BY_ROOK_SQUARE[from]) {
    removeCastlingRight(rights, CASTLING_RIGHT_BY_ROOK_SQUARE[from]);
  }
  if (String(capturedPiece || '').toUpperCase() === 'R' && CASTLING_RIGHT_BY_ROOK_SQUARE[to]) {
    removeCastlingRight(rights, CASTLING_RIGHT_BY_ROOK_SQUARE[to]);
  }

  const canonicalOrder = ['K', 'Q', 'k', 'q'];
  const normalized = canonicalOrder.filter((flag) => rights.includes(flag)).join('');
  return normalized || '-';
}

function illegalMoveFen(currentFen, from, to) {
  const parsed = parseFen(currentFen);
  if (!parsed || !SQUARE_PATTERN.test(from) || !SQUARE_PATTERN.test(to) || from === to) {
    return null;
  }

  let piece = parsed.pieces[from] || '';
  const capturedPiece = parsed.pieces[to] || '';
  if (!piece) {
    return null;
  }
  if (capturedPiece && pieceColor(capturedPiece) === pieceColor(piece)) {
    return {
      blocked: true,
      reason: 'A piece cannot capture its own piece.',
      piece,
      capturedPiece,
      parsed,
      outOfTurn: pieceColor(piece) !== parsed.activeColor,
    };
  }
  if (String(capturedPiece).toUpperCase() === 'K') {
    return {
      blocked: true,
      reason: 'The king cannot be captured.',
      piece,
      capturedPiece,
      parsed,
      outOfTurn: pieceColor(piece) !== parsed.activeColor,
    };
  }

  const nextPieces = { ...parsed.pieces };
  delete nextPieces[from];
  if (piece.toUpperCase() === 'P' && (to[1] === '1' || to[1] === '8')) {
    piece = pieceColor(piece) === 'w' ? 'Q' : 'q';
  }
  nextPieces[to] = piece;

  const castling = castlingAfterMove(parsed.castling, parsed.pieces[from], from, to, capturedPiece);

  return {
    blocked: false,
    // An illegal demonstration does not consume the turn or update move clocks.
    // Keeping the original side to move also allows positions such as a king
    // moved into check to remain loadable for teaching.
    fen: `${placementFromPieces(nextPieces)} ${parsed.activeColor} ${castling} - ${parsed.halfmove} ${parsed.fullmove}`,
    piece: parsed.pieces[from],
    capturedPiece,
    parsed,
    outOfTurn: pieceColor(parsed.pieces[from]) !== parsed.activeColor,
  };
}

function installTeacherBoardIllegalMoveSupport() {
  if (!teacherBoardModeActive()) {
    return;
  }

  const boardGrid = document.getElementById('boardGrid');
  const boardSurface = document.querySelector('.board-surface');
  if (!boardGrid || !boardSurface) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  let baselineFen = String(params.get('fen') || START_FEN).trim() || START_FEN;
  let illegalMove = null;
  let forcedSelectedSquare = '';
  let selectionMessage = '';
  let pendingIllegalFen = '';
  let markerFrame = 0;

  const style = document.createElement('style');
  style.textContent = `
    html[data-board-only="1"] .teacher-illegal-notice {
      position: absolute;
      left: 50%;
      top: clamp(.35rem, 1.4vw, .75rem);
      transform: translateX(-50%);
      z-index: 30;
      max-width: calc(100% - 1rem);
      padding: .38rem .72rem;
      border: 2px solid rgba(255,255,255,.9);
      border-radius: 999px;
      background: rgba(153, 27, 27, .96);
      color: #fff;
      box-shadow: 0 7px 22px rgba(0,0,0,.35);
      font: 800 clamp(.68rem, 1.7vw, .86rem)/1.15 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: .04em;
      text-align: center;
      text-transform: uppercase;
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    html[data-board-only="1"] .teacher-illegal-notice.is-selection {
      background: rgba(146, 64, 14, .96);
    }
    html[data-board-only="1"] .board-square.teacher-illegal-from,
    html[data-board-only="1"] .board-square.teacher-illegal-to {
      box-shadow: inset 0 0 0 clamp(3px, .65vw, 5px) rgba(220, 38, 38, .96);
    }
    html[data-board-only="1"] .board-square.teacher-forced-selected {
      box-shadow: inset 0 0 0 clamp(4px, .75vw, 6px) rgba(245, 158, 11, .98);
    }
    html[data-board-only="1"] .teacher-illegal-square-mark {
      position: absolute;
      inset: 12%;
      z-index: 18;
      border: clamp(2px, .45vw, 4px) dashed rgba(255,255,255,.94);
      border-radius: 18%;
      background: rgba(220, 38, 38, .18);
      pointer-events: none;
    }
    html[data-board-only="1"] .teacher-illegal-square-mark::before,
    html[data-board-only="1"] .teacher-illegal-square-mark::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 4%;
      width: clamp(3px, .55vw, 6px);
      height: 92%;
      border-radius: 999px;
      background: #ef4444;
      box-shadow: 0 0 0 1px rgba(255,255,255,.75), 0 2px 8px rgba(0,0,0,.45);
      transform-origin: center;
    }
    html[data-board-only="1"] .teacher-illegal-square-mark::before {
      transform: translateX(-50%) rotate(45deg);
    }
    html[data-board-only="1"] .teacher-illegal-square-mark::after {
      transform: translateX(-50%) rotate(-45deg);
    }
    html[data-board-only="1"] .teacher-illegal-from .teacher-illegal-square-mark {
      inset: 24%;
      border-style: solid;
      border-radius: 50%;
      background: rgba(220, 38, 38, .12);
    }
    html[data-board-only="1"] .teacher-illegal-from .teacher-illegal-square-mark::before,
    html[data-board-only="1"] .teacher-illegal-from .teacher-illegal-square-mark::after {
      display: none;
    }
  `;
  document.head.append(style);

  const notice = document.createElement('div');
  notice.className = 'teacher-illegal-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'assertive');
  notice.hidden = true;
  boardSurface.append(notice);

  function clearRenderedMarkers() {
    boardGrid.querySelectorAll('.teacher-illegal-from, .teacher-illegal-to, .teacher-forced-selected').forEach((square) => {
      square.classList.remove('teacher-illegal-from', 'teacher-illegal-to', 'teacher-forced-selected');
    });
    boardGrid.querySelectorAll('.teacher-illegal-square-mark').forEach((mark) => mark.remove());
  }

  function renderMarkers() {
    markerFrame = 0;
    clearRenderedMarkers();

    if (forcedSelectedSquare) {
      boardGrid.querySelector(`[data-square="${forcedSelectedSquare}"]`)?.classList.add('teacher-forced-selected');
    }

    if (illegalMove) {
      const fromSquare = boardGrid.querySelector(`[data-square="${illegalMove.from}"]`);
      const toSquare = boardGrid.querySelector(`[data-square="${illegalMove.to}"]`);
      if (fromSquare) {
        fromSquare.classList.add('teacher-illegal-from');
        const mark = document.createElement('span');
        mark.className = 'teacher-illegal-square-mark';
        mark.setAttribute('aria-hidden', 'true');
        fromSquare.append(mark);
      }
      if (toSquare) {
        toSquare.classList.add('teacher-illegal-to');
        const mark = document.createElement('span');
        mark.className = 'teacher-illegal-square-mark';
        mark.setAttribute('aria-hidden', 'true');
        toSquare.append(mark);
      }
    }

    const message = illegalMove?.message || selectionMessage;
    notice.textContent = message || '';
    notice.hidden = !message;
    notice.classList.toggle('is-selection', Boolean(selectionMessage && !illegalMove));
  }

  function scheduleMarkerRender() {
    if (markerFrame) {
      return;
    }
    markerFrame = window.requestAnimationFrame(renderMarkers);
  }

  function clearForcedSelection() {
    forcedSelectedSquare = '';
    selectionMessage = '';
  }

  function clearIllegalMove() {
    illegalMove = null;
    pendingIllegalFen = '';
    scheduleMarkerRender();
  }

  function clearTeacherIllegalState() {
    clearForcedSelection();
    clearIllegalMove();
  }

  function currentFen() {
    return String(document.getElementById('currentFenCode')?.textContent || '').trim();
  }

  function showIllegalMove(from, to, result) {
    const moverColor = colorName(pieceColor(result.piece));
    const mover = pieceName(result.piece);
    const suffix = result.outOfTurn ? ' - wrong side to move' : '';
    illegalMove = {
      from,
      to,
      message: result.blocked
        ? `Illegal move: ${result.reason}`
        : `Illegal move shown: ${moverColor} ${mover} ${from} to ${to}${suffix}`,
    };
    clearForcedSelection();
    scheduleMarkerRender();
  }

  function commitIllegalMove(from, to) {
    const result = illegalMoveFen(currentFen(), from, to);
    if (!result) {
      return false;
    }

    showIllegalMove(from, to, result);
    if (result.blocked) {
      return true;
    }

    pendingIllegalFen = result.fen;
    window.postMessage({ type: 'loadFen', fen: result.fen }, window.location.origin);
    return true;
  }

  boardGrid.addEventListener('click', (event) => {
    const targetSquare = event.target instanceof Element
      ? event.target.closest('.board-square')
      : null;
    if (!targetSquare || !boardGrid.contains(targetSquare)) {
      return;
    }

    const parsed = parseFen(currentFen());
    if (!parsed) {
      return;
    }

    const to = targetSquare.dataset.square || '';
    if (!SQUARE_PATTERN.test(to)) {
      return;
    }

    const appSelectedSquare = boardGrid.querySelector('.board-square.selected')?.dataset.square || '';
    const from = forcedSelectedSquare || appSelectedSquare;

    if (!from) {
      const selectedPiece = parsed.pieces[to] || '';
      if (selectedPiece && pieceColor(selectedPiece) !== parsed.activeColor) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearIllegalMove();
        forcedSelectedSquare = to;
        selectionMessage = `Illegal move setup: ${colorName(pieceColor(selectedPiece))} ${pieceName(selectedPiece)} selected out of turn`;
        scheduleMarkerRender();
        return;
      }
      if (illegalMove || forcedSelectedSquare) {
        clearTeacherIllegalState();
      }
      return;
    }

    if (from === to) {
      if (forcedSelectedSquare) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearTeacherIllegalState();
      }
      return;
    }

    if (!forcedSelectedSquare
      && (targetSquare.classList.contains('legal-target') || targetSquare.classList.contains('legal-capture'))) {
      clearTeacherIllegalState();
      return;
    }

    const movingPiece = parsed.pieces[from] || '';
    if (!movingPiece) {
      clearTeacherIllegalState();
      return;
    }

    // Let the normal app switch selection between pieces belonging to the legal
    // side to move. A forced out-of-turn selection remains under this module.
    const targetPiece = parsed.pieces[to] || '';
    if (!forcedSelectedSquare
      && targetPiece
      && pieceColor(targetPiece) === parsed.activeColor) {
      clearTeacherIllegalState();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    commitIllegalMove(from, to);
  }, true);

  window.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'loadFen' && typeof data.fen === 'string') {
      const nextFen = data.fen.trim();
      if (pendingIllegalFen && nextFen === pendingIllegalFen) {
        pendingIllegalFen = '';
        scheduleMarkerRender();
        return;
      }
      baselineFen = nextFen || baselineFen;
      clearTeacherIllegalState();
      return;
    }

    if ((data.type === 'teacherBoardAction' || data.type === 'boardOnlyAction') && typeof data.action === 'string') {
      if (data.action === 'reset') {
        event.stopImmediatePropagation();
        clearTeacherIllegalState();
        window.postMessage({ type: 'loadFen', fen: baselineFen }, window.location.origin);
        return;
      }
      if (data.action === 'emptyTeacherBoard'
        || data.action === 'startTeacherBoard'
        || data.action === 'lessonTeacherBoard'
        || data.action === 'enterTeacherSetup'
        || data.action === 'showSetup') {
        clearTeacherIllegalState();
      }
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (illegalMove || forcedSelectedSquare) {
      scheduleMarkerRender();
    }
  });
  observer.observe(boardGrid, { childList: true });
}

installTeacherBoardIllegalMoveSupport();
