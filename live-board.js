import { Chess, DEFAULT_POSITION } from './vendor/chess.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_ASSETS = Object.freeze({
  wk: './assets/pieces/mpchess/wK.svg', wq: './assets/pieces/mpchess/wQ.svg',
  wr: './assets/pieces/mpchess/wR.svg', wb: './assets/pieces/mpchess/wB.svg',
  wn: './assets/pieces/mpchess/wN.svg', wp: './assets/pieces/mpchess/wP.svg',
  bk: './assets/pieces/mpchess/bK.svg', bq: './assets/pieces/mpchess/bQ.svg',
  br: './assets/pieces/mpchess/bR.svg', bb: './assets/pieces/mpchess/bB.svg',
  bn: './assets/pieces/mpchess/bN.svg', bp: './assets/pieces/mpchess/bP.svg',
});
const LESSON_STORAGE_KEY = 'live-board-prepared-lessons-v1';
const ROOM_STORAGE_PREFIX = 'live-board-room-v1:';
const SQUARE_PATTERN = /^[a-h][1-8]$/;
const ANNOTATION_CELL_SIZE = 100;
const ANNOTATION_ARROW_HEAD_LENGTH = 30;
const ANNOTATION_ARROW_HEAD_WIDTH = 40;
const ANNOTATION_COLOR_GREEN = 'green';
const ANNOTATION_COLORS = new Set(['green', 'orange', 'blue']);
const clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const elements = {
  board: document.getElementById('liveBoard'),
  statusTitle: document.getElementById('statusTitle'),
  statusPill: document.getElementById('statusPill'),
  fenInput: document.getElementById('fenInput'),
  fenMessage: document.getElementById('fenMessage'),
  moveList: document.getElementById('moveList'),
  undoButton: document.getElementById('undoButton'),
  resetButton: document.getElementById('resetButton'),
  flipButton: document.getElementById('flipButton'),
  themeButton: document.getElementById('themeButton'),
  loadFenButton: document.getElementById('loadFenButton'),
  copyFenButton: document.getElementById('copyFenButton'),
  roomSetup: document.getElementById('roomSetup'),
  roomSetupMessage: document.getElementById('roomSetupMessage'),
  roomCodeInput: document.getElementById('roomCodeInput'),
  createRoomButton: document.getElementById('createRoomButton'),
  joinRoomButton: document.getElementById('joinRoomButton'),
  sessionBar: document.getElementById('sessionBar'),
  liveBoardLayout: document.getElementById('liveBoardLayout'),
  roleLabel: document.getElementById('roleLabel'),
  roomCodeLabel: document.getElementById('roomCodeLabel'),
  modeSubtitle: document.getElementById('modeSubtitle'),
  connectionStatus: document.getElementById('connectionStatus'),
  copyStudentLinkButton: document.getElementById('copyStudentLinkButton'),
  lockStudentButton: document.getElementById('lockStudentButton'),
  studentLockMessage: document.getElementById('studentLockMessage'),
  lessonFileInput: document.getElementById('lessonFileInput'),
  importLessonButton: document.getElementById('importLessonButton'),
  clearLessonButton: document.getElementById('clearLessonButton'),
  lessonMessage: document.getElementById('lessonMessage'),
  lessonPanel: document.getElementById('lessonPanel'),
  lessonPositionSelect: document.getElementById('lessonPositionSelect'),
  lessonNote: document.getElementById('lessonNote'),
  board3d: document.getElementById('liveBoard3D'),
  annotationOverlay: document.getElementById('liveBoardAnnotationOverlay'),
  toggle3dButton: document.getElementById('toggle3dButton'),
  camera3dControls: document.getElementById('camera3dControls'),
  camAngleBtn: document.getElementById('camAngleBtn'),
  camTopBtn: document.getElementById('camTopBtn'),
  camWhiteBtn: document.getElementById('camWhiteBtn'),
  camBlackBtn: document.getElementById('camBlackBtn'),
  camResetBtn: document.getElementById('camResetBtn'),
};

let game = new Chess();
let orientation = 'white';
let selectedSquare = null;
let legalMoves = [];
let lastMove = null;
let role = '';
let roomCode = '';
let studentMovesAllowed = true;
let revision = 0;
let channel = null;
let preparedLessons = [];
let activeLessonId = '';
let is3dMode = false;
let liveBoard3DInstance = null;
let annotations = createEmptyAnnotations();
let annotationGesture = createEmptyAnnotationGesture();
let suppressBoardClickUntil = 0;
let suppressContextMenu = false;

try {
  is3dMode = localStorage.getItem('live-board:3d-mode') === 'true';
} catch {}

function normalizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function roomStorageKey() {
  return `${ROOM_STORAGE_PREFIX}${roomCode}`;
}

function visibleSquares() {
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

function pieceAt(square) {
  if (typeof game.get === 'function') return game.get(square);
  const board = game.board();
  return board[8 - Number(square[1])]?.[FILES.indexOf(square[0])] || null;
}

function pieceLabel(piece) {
  const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  return `${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.type]}`;
}

function getLegalMoves(square) {
  try { return game.moves({ square, verbose: true }); } catch { return []; }
}

function canMovePieces() {
  return role === 'teacher' || (role === 'student' && studentMovesAllowed);
}

function serializeState() {
  return {
    fen: game.fen(),
    pgn: typeof game.pgn === 'function' ? game.pgn() : '',
    orientation,
    lastMove,
    studentMovesAllowed,
    revision,
    activeLessonId,
    annotations: serializeAnnotations(),
  };
}

function persistRoomState() {
  if (!roomCode || role !== 'teacher') return;
  try { localStorage.setItem(roomStorageKey(), JSON.stringify(serializeState())); } catch {}
}

function publish(type = 'state') {
  if (!channel || !roomCode) return;
  const message = { type, roomCode, sender: clientId, state: serializeState() };
  channel.postMessage(message);
  persistRoomState();
}

function applyRemoteState(state) {
  if (!state || !state.fen || Number(state.revision) < revision) return;
  closePromotionChooser();
  try {
    const nextGame = new Chess();
    if (state.pgn) {
      const loadedPgn = nextGame.loadPgn?.(state.pgn);
      if (loadedPgn === false) nextGame.load(state.fen);
    } else {
      nextGame.load(state.fen);
    }
    game = nextGame;
    orientation = state.orientation === 'black' ? 'black' : 'white';
    lastMove = state.lastMove || null;
    studentMovesAllowed = state.studentMovesAllowed !== false;
    revision = Number(state.revision) || 0;
    activeLessonId = String(state.activeLessonId || '');
    if (state.annotations && typeof state.annotations === 'object') {
      annotations = normalizeAnnotationState(state.annotations);
    }
    selectedSquare = null;
    legalMoves = [];
    render();
  } catch (error) {
    console.warn('Ignored invalid Live Board state.', error);
  }
}

function connectRoomTransport() {
  channel?.close();
  channel = new BroadcastChannel(`cd-live-board:${roomCode}`);
  channel.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.roomCode !== roomCode || message.sender === clientId) return;
    if (message.type === 'request-state' && role === 'teacher') {
      publish('state');
      return;
    }
    applyRemoteState(message.state);
    elements.connectionStatus.textContent = 'Connected in this browser';
  });

  if (role === 'student') {
    try {
      const saved = JSON.parse(localStorage.getItem(roomStorageKey()) || 'null');
      if (saved) applyRemoteState(saved);
    } catch {}
    channel.postMessage({ type: 'request-state', roomCode, sender: clientId });
  } else {
    persistRoomState();
  }
}

function enterRoom(nextRole, nextCode) {
  role = nextRole;
  roomCode = normalizeRoomCode(nextCode);
  if (!roomCode) return;
  annotations = createEmptyAnnotations();
  annotationGesture = createEmptyAnnotationGesture();
  document.documentElement.dataset.role = role;
  elements.roomSetup.hidden = true;
  elements.sessionBar.hidden = false;
  elements.liveBoardLayout.hidden = false;
  elements.roleLabel.textContent = role === 'teacher' ? 'Teacher' : 'Student';
  elements.roomCodeLabel.textContent = roomCode;
  elements.modeSubtitle.textContent = role === 'teacher'
    ? 'Teacher controls the shared position and prepared lessons.'
    : 'Follow the teacher board and move when permission is enabled.';
  elements.connectionStatus.textContent = 'Local browser synchronization';
  connectRoomTransport();
  render();

  const url = new URL(location.href);
  url.searchParams.set('room', roomCode);
  url.searchParams.set('role', role);
  history.replaceState(null, '', url);
  if (role === 'teacher') publish('state');
}

function gameStatus() {
  if (game.isCheckmate?.()) return ['Checkmate', 'Finished'];
  if (game.isStalemate?.()) return ['Stalemate', 'Draw'];
  if (game.isDraw?.()) return ['Draw', 'Finished'];
  const side = game.turn() === 'w' ? 'White' : 'Black';
  const inCheck = game.inCheck?.() || game.isCheck?.();
  return [`${side} to move${inCheck ? ' · Check' : ''}`, inCheck ? 'Check' : 'Ready'];
}

function renderBoard() {
  elements.board.replaceChildren();
  visibleSquares().forEach((square, visibleIndex) => {
    const fileIndex = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    const button = document.createElement('button');
    const legalMove = legalMoves.find((move) => move.to === square);
    button.type = 'button';
    button.className = `square${(fileIndex + rank) % 2 === 1 ? ' dark' : ''}`;
    button.dataset.square = square;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', square);
    button.disabled = !canMovePieces();

    if (selectedSquare === square) button.classList.add('selected');
    if (lastMove && (lastMove.from === square || lastMove.to === square)) button.classList.add('last-move');
    if (legalMove) {
      button.classList.add('legal');
      if (pieceAt(square)) button.classList.add('capture');
    }

    appendAnnotationMarkup(button, square);

    const piece = pieceAt(square);
    if (piece) {
      const image = document.createElement('img');
      image.className = 'piece';
      image.src = PIECE_ASSETS[`${piece.color}${piece.type}`];
      image.alt = pieceLabel(piece);
      image.draggable = false;
      button.appendChild(image);
      button.setAttribute('aria-label', `${square}, ${pieceLabel(piece)}`);
    }

    if (visibleIndex % 8 === 0) {
      const label = document.createElement('span');
      label.className = 'coordinate rank';
      label.textContent = square[1];
      button.appendChild(label);
    }
    if (Math.floor(visibleIndex / 8) === 7) {
      const label = document.createElement('span');
      label.className = 'coordinate file';
      label.textContent = square[0];
      button.appendChild(label);
    }
    button.addEventListener('click', () => handleSquareClick(square));
    elements.board.appendChild(button);
  });
  renderAnnotationOverlay();
}

function renderMoveList() {
  const history = game.history();
  elements.moveList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-moves';
    empty.textContent = 'No moves yet.';
    elements.moveList.appendChild(empty);
    return;
  }
  for (let index = 0; index < history.length; index += 2) {
    const item = document.createElement('li');
    item.textContent = history[index + 1] ? `${history[index]} ${history[index + 1]}` : history[index];
    elements.moveList.appendChild(item);
  }
}

function renderLessons() {
  elements.lessonPanel.hidden = preparedLessons.length === 0;
  elements.lessonPositionSelect.replaceChildren();
  preparedLessons.forEach((lesson) => {
    const option = document.createElement('option');
    option.value = lesson.id;
    option.textContent = lesson.title;
    option.selected = lesson.id === activeLessonId;
    elements.lessonPositionSelect.appendChild(option);
  });
  const active = preparedLessons.find((lesson) => lesson.id === activeLessonId);
  elements.lessonNote.hidden = !active?.teacherNote;
  elements.lessonNote.textContent = active?.teacherNote || '';
}

function render() {
  renderBoard();
  renderMoveList();
  renderLessons();
  elements.fenInput.value = game.fen();
  const [title, pill] = gameStatus();
  elements.statusTitle.textContent = title;
  elements.statusPill.textContent = pill;
  elements.undoButton.disabled = game.history().length === 0;
  elements.studentLockMessage.hidden = role !== 'student' || studentMovesAllowed;
  elements.lockStudentButton.textContent = studentMovesAllowed ? 'Lock student moves' : 'Allow student moves';

  if (is3dMode && liveBoard3DInstance) {
    liveBoard3DInstance.syncState({
      fen: game.fen(),
      orientation,
      lastMove,
      selectedSquare,
      legalMoves,
      canMove: canMovePieces(),
    });
  }
}

function completeMove(from, to, promotion) {
  if (!canMovePieces()) return false;
  try {
    const move = game.move({ from, to, ...(promotion ? { promotion } : {}) });
    if (!move) return false;
    lastMove = { from: move.from, to: move.to };
    revision += 1;
    selectedSquare = null;
    legalMoves = [];
    render();
    publish(role === 'student' ? 'student-move' : 'state');
    return true;
  } catch { return false; }
}

function tryMove(from, to) {
  if (!canMovePieces()) return false;
  const isPromotion = legalMoves.some((move) => move.from === from && move.to === to && move.promotion);
  if (isPromotion) {
    // Wait for an explicit piece choice; nothing is committed or published
    // until the chooser resolves, so dismissal leaves a valid position.
    openPromotionChooser(from, to);
    return true;
  }
  return completeMove(from, to);
}

const PROMOTION_CHOICES = ['q', 'r', 'b', 'n'];
const PROMOTION_NAMES = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
let pendingPromotion = null;
let promotionOverlay = null;
let promotionKeyHandler = null;
let promotionOutsideHandler = null;

function ensurePromotionOverlay() {
  if (promotionOverlay) return promotionOverlay;
  promotionOverlay = document.createElement('div');
  promotionOverlay.className = 'promotion-overlay';
  promotionOverlay.setAttribute('role', 'dialog');
  promotionOverlay.setAttribute('aria-modal', 'true');
  promotionOverlay.setAttribute('aria-label', 'Choose a promotion piece');
  promotionOverlay.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'promotion-dialog';
  const title = document.createElement('p');
  title.className = 'promotion-title';
  title.textContent = 'Promote to:';
  const options = document.createElement('div');
  options.className = 'promotion-options';
  dialog.append(title, options);
  promotionOverlay.appendChild(dialog);
  promotionOverlay.addEventListener('pointerdown', (event) => {
    // Clicks on the backdrop dismiss; clicks on piece buttons are handled by
    // their own click listeners and never reach the board squares.
    if (event.target === promotionOverlay) cancelPromotionChooser();
  });
  (elements.board.parentElement || document.body).appendChild(promotionOverlay);
  return promotionOverlay;
}

function openPromotionChooser(from, to) {
  const color = game.turn();
  closePromotionChooser();
  const overlay = ensurePromotionOverlay();
  pendingPromotion = { from, to, color };

  const options = overlay.querySelector('.promotion-options');
  options.replaceChildren();
  PROMOTION_CHOICES.forEach((piece, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `promotion-option ${color}-piece`;
    button.dataset.piece = piece;
    button.setAttribute('aria-label', `Promote to ${PROMOTION_NAMES[piece]}`);
    button.title = PROMOTION_NAMES[piece];
    const image = document.createElement('img');
    image.src = PIECE_ASSETS[`${color}${piece}`];
    image.alt = '';
    image.draggable = false;
    button.appendChild(image);
    button.addEventListener('click', () => choosePromotionPiece(piece));
    options.appendChild(button);
    if (index === 0) button.dataset.autofocus = '';
  });

  overlay.hidden = false;
  const firstOption = options.querySelector('button');
  firstOption?.focus({ preventScroll: true });

  promotionKeyHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelPromotionChooser();
    }
  };
  promotionOutsideHandler = (event) => {
    if (event.target instanceof Node && !promotionOverlay.contains(event.target)) {
      // Cancel quietly and let the outside click continue its normal board
      // handling (e.g. selecting a different piece or destination).
      closePromotionChooser();
    }
  };
  document.addEventListener('keydown', promotionKeyHandler, true);
  document.addEventListener('pointerdown', promotionOutsideHandler, true);
}

function choosePromotionPiece(piece) {
  const pending = pendingPromotion;
  if (!pending) return;
  closePromotionChooser();
  // Re-validate in case the position changed while the chooser was open.
  const stillLegal = legalMoves.some((move) => move.from === pending.from && move.to === pending.to && move.promotion);
  if (!stillLegal || !canMovePieces()) {
    render();
    return;
  }
  completeMove(pending.from, pending.to, piece);
}

function cancelPromotionChooser() {
  closePromotionChooser();
  selectedSquare = null;
  legalMoves = [];
  renderBoard();
}

function closePromotionChooser() {
  if (!pendingPromotion) return;
  const destinationSquare = pendingPromotion.to;
  pendingPromotion = null;
  if (promotionOverlay) promotionOverlay.hidden = true;
  if (promotionKeyHandler) document.removeEventListener('keydown', promotionKeyHandler, true);
  if (promotionOutsideHandler) document.removeEventListener('pointerdown', promotionOutsideHandler, true);
  promotionKeyHandler = null;
  promotionOutsideHandler = null;
  const destination = elements.board.querySelector(`.square[data-square="${destinationSquare}"]`);
  destination?.focus?.({ preventScroll: true });
}

function handleSquareClick(square) {
  if (Date.now() < suppressBoardClickUntil) return;
  if (!canMovePieces()) return;
  const clickedPiece = pieceAt(square);
  if (selectedSquare) {
    if (tryMove(selectedSquare, square)) return;
    if (clickedPiece?.color === game.turn()) {
      selectedSquare = square;
      legalMoves = getLegalMoves(square);
    } else {
      selectedSquare = null;
      legalMoves = [];
    }
  } else if (clickedPiece?.color === game.turn()) {
    selectedSquare = square;
    legalMoves = getLegalMoves(square);
  }
  renderBoard();
  if (is3dMode && liveBoard3DInstance) {
    liveBoard3DInstance.syncState({
      fen: game.fen(),
      orientation,
      lastMove,
      selectedSquare,
      legalMoves,
      canMove: canMovePieces(),
    });
  }
}

function createEmptyAnnotations() {
  return {
    paintedSquares: new Map(),
    circledSquares: new Map(),
    starredSquares: new Map(),
    arrows: [],
  };
}

function createEmptyAnnotationGesture() {
  return {
    active: false,
    mode: '',
    color: ANNOTATION_COLOR_GREEN,
    startSquare: '',
    lastSquare: '',
    dragged: false,
  };
}

function normalizeAnnotationColor(value) {
  const color = String(value || '').trim().toLowerCase();
  return ANNOTATION_COLORS.has(color) ? color : ANNOTATION_COLOR_GREEN;
}

function annotationColorFromEvent(event) {
  if (event.shiftKey) return 'blue';
  if (event.ctrlKey) return 'orange';
  return ANNOTATION_COLOR_GREEN;
}

function annotationGestureModeFromEvent(event) {
  if (event.ctrlKey && event.shiftKey) return 'star';
  if (event.altKey) return 'arrow';
  return 'paint';
}

function normalizeAnnotationSquares(value) {
  const entries = value instanceof Map
    ? Array.from(value.entries()).map(([square, color]) => ({ square, color }))
    : value instanceof Set
      ? Array.from(value)
      : Array.isArray(value) ? value : [];
  const squares = new Map();
  entries.forEach((entry) => {
    const square = String(typeof entry === 'string' ? entry : entry?.square || '').trim().toLowerCase();
    if (!SQUARE_PATTERN.test(square)) return;
    squares.set(square, normalizeAnnotationColor(entry?.color));
  });
  return squares;
}

function normalizeAnnotationArrows(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const arrows = [];
  value.forEach((entry) => {
    const from = String(entry?.from || '').trim().toLowerCase();
    const to = String(entry?.to || '').trim().toLowerCase();
    if (!SQUARE_PATTERN.test(from) || !SQUARE_PATTERN.test(to) || from === to) return;
    const key = `${from}:${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    arrows.push({ from, to, color: normalizeAnnotationColor(entry?.color) });
  });
  return arrows;
}

function normalizeAnnotationState(value) {
  return {
    paintedSquares: normalizeAnnotationSquares(value?.paintedSquares),
    circledSquares: normalizeAnnotationSquares(value?.circledSquares),
    starredSquares: normalizeAnnotationSquares(value?.starredSquares),
    arrows: normalizeAnnotationArrows(value?.arrows),
  };
}

function serializeAnnotations() {
  const serializeSquares = (squares) => Array.from(squares.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([square, color]) => (
      color === ANNOTATION_COLOR_GREEN ? square : { square, color }
    ));
  return {
    paintedSquares: serializeSquares(annotations.paintedSquares),
    circledSquares: serializeSquares(annotations.circledSquares),
    starredSquares: serializeSquares(annotations.starredSquares),
    arrows: annotations.arrows.map((arrow) => (
      arrow.color && arrow.color !== ANNOTATION_COLOR_GREEN
        ? { from: arrow.from, to: arrow.to, color: arrow.color }
        : { from: arrow.from, to: arrow.to }
    )),
  };
}

function hasAnyAnnotations() {
  return annotations.paintedSquares.size > 0
    || annotations.circledSquares.size > 0
    || annotations.starredSquares.size > 0
    || annotations.arrows.length > 0;
}

function canAnnotate() {
  return role === 'teacher';
}

function paintAnnotationSquare(square, color = ANNOTATION_COLOR_GREEN) {
  const normalizedColor = normalizeAnnotationColor(color);
  if (!SQUARE_PATTERN.test(square) || annotations.paintedSquares.get(square) === normalizedColor) {
    return false;
  }
  annotations.paintedSquares.set(square, normalizedColor);
  return true;
}

function toggleAnnotationCircle(square, color = ANNOTATION_COLOR_GREEN) {
  if (!SQUARE_PATTERN.test(square)) return false;
  const normalizedColor = normalizeAnnotationColor(color);
  if (annotations.circledSquares.get(square) === normalizedColor) {
    annotations.circledSquares.delete(square);
  } else {
    annotations.circledSquares.set(square, normalizedColor);
  }
  return true;
}

function toggleAnnotationStar(square, color = ANNOTATION_COLOR_GREEN) {
  if (!SQUARE_PATTERN.test(square)) return false;
  const normalizedColor = normalizeAnnotationColor(color);
  if (annotations.starredSquares.get(square) === normalizedColor) {
    annotations.starredSquares.delete(square);
  } else {
    annotations.starredSquares.set(square, normalizedColor);
  }
  return true;
}

function addAnnotationArrow(from, to, color = ANNOTATION_COLOR_GREEN) {
  if (!SQUARE_PATTERN.test(from) || !SQUARE_PATTERN.test(to) || from === to) return false;
  const normalizedColor = normalizeAnnotationColor(color);
  const key = `${from}:${to}`;
  const existing = annotations.arrows.find((arrow) => `${arrow.from}:${arrow.to}` === key);
  if (existing?.color === normalizedColor) return false;
  if (existing) {
    existing.color = normalizedColor;
  } else {
    annotations.arrows.push({ from, to, color: normalizedColor });
  }
  return true;
}

function clearAllAnnotations() {
  if (!hasAnyAnnotations()) return false;
  annotations.paintedSquares.clear();
  annotations.circledSquares.clear();
  annotations.starredSquares.clear();
  annotations.arrows = [];
  return true;
}

function cancelAnnotationGesture() {
  const hadPreview = annotationGesture.active && annotationGesture.mode === 'arrow';
  annotationGesture = createEmptyAnnotationGesture();
  suppressContextMenu = false;
  if (hadPreview) renderAnnotationOverlay();
}

function commitAnnotations(changed) {
  if (!changed) return;
  revision += 1;
  renderBoard();
  publish('state');
}

function annotationSquareCenter(square) {
  if (!SQUARE_PATTERN.test(square)) return null;
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number.parseInt(square[1], 10) - 1;
  const col = orientation === 'black' ? 7 - fileIndex : fileIndex;
  const row = orientation === 'black' ? rankIndex : 7 - rankIndex;
  return {
    x: (col * ANNOTATION_CELL_SIZE) + (ANNOTATION_CELL_SIZE / 2),
    y: (row * ANNOTATION_CELL_SIZE) + (ANNOTATION_CELL_SIZE / 2),
  };
}

function buildAnnotationArrowMarkup(from, to, { preview = false, color = ANNOTATION_COLOR_GREEN } = {}) {
  const start = annotationSquareCenter(from);
  const end = annotationSquareCenter(to);
  if (!start || !end || (start.x === end.x && start.y === end.y)) return '';

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= ANNOTATION_ARROW_HEAD_LENGTH) return '';

  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const headBaseX = end.x - (unitX * ANNOTATION_ARROW_HEAD_LENGTH);
  const headBaseY = end.y - (unitY * ANNOTATION_ARROW_HEAD_LENGTH);
  const perpendicularX = -unitY;
  const perpendicularY = unitX;
  const headHalfWidth = ANNOTATION_ARROW_HEAD_WIDTH / 2;
  const leftX = headBaseX + (perpendicularX * headHalfWidth);
  const leftY = headBaseY + (perpendicularY * headHalfWidth);
  const rightX = headBaseX - (perpendicularX * headHalfWidth);
  const rightY = headBaseY - (perpendicularY * headHalfWidth);
  const colorClass = `is-${normalizeAnnotationColor(color)}`;
  const previewClass = preview ? ' is-preview' : '';

  return `<g>`
    + `<line class="board-annotation-arrow ${colorClass}${previewClass}" x1="${start.x}" y1="${start.y}" x2="${headBaseX}" y2="${headBaseY}"></line>`
    + `<polygon class="board-annotation-arrow-head ${colorClass}${previewClass}" points="${end.x},${end.y} ${leftX},${leftY} ${rightX},${rightY}"></polygon>`
    + `</g>`;
}

function currentAnnotationPreviewArrow() {
  if (!annotationGesture.active || annotationGesture.mode !== 'arrow') return null;
  const { startSquare, lastSquare, color } = annotationGesture;
  if (!SQUARE_PATTERN.test(startSquare) || !SQUARE_PATTERN.test(lastSquare) || startSquare === lastSquare) {
    return null;
  }
  return { from: startSquare, to: lastSquare, color };
}

function renderAnnotationOverlay() {
  if (!elements.annotationOverlay) return;
  const savedArrows = annotations.arrows
    .map((arrow) => buildAnnotationArrowMarkup(arrow.from, arrow.to, { color: arrow.color }))
    .join('');
  const preview = currentAnnotationPreviewArrow();
  const previewMarkup = preview
    ? buildAnnotationArrowMarkup(preview.from, preview.to, { preview: true, color: preview.color })
    : '';
  elements.annotationOverlay.innerHTML = savedArrows || previewMarkup
    ? `${savedArrows}${previewMarkup}`
    : '';
}

function appendAnnotationMarkup(squareEl, square) {
  const layers = [
    ['paintedSquares', 'board-annotation-paint'],
    ['circledSquares', 'board-annotation-circle'],
    ['starredSquares', 'board-annotation-star'],
  ];
  layers.forEach(([key, className]) => {
    const color = annotations[key].get(square);
    if (color === undefined) return;
    const span = document.createElement('span');
    span.className = `board-annotation ${className} is-${normalizeAnnotationColor(color)}`;
    span.setAttribute('aria-hidden', 'true');
    squareEl.appendChild(span);
  });
}

function squareFromClientPoint(clientX, clientY) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || typeof document.elementFromPoint !== 'function') return '';
  const target = document.elementFromPoint(clientX, clientY);
  const squareEl = target instanceof Element ? target.closest('.square') : null;
  if (!squareEl || !elements.board.contains(squareEl)) return '';
  return squareEl.dataset.square || '';
}

function applyAnnotationGestureSquare(square) {
  if (!annotationGesture.active || !SQUARE_PATTERN.test(square) || square === annotationGesture.lastSquare) {
    return;
  }

  let changed = false;
  if (annotationGesture.mode === 'paint') {
    if (!annotationGesture.dragged) {
      annotationGesture.dragged = true;
      changed = paintAnnotationSquare(annotationGesture.startSquare, annotationGesture.color);
    }
    changed = paintAnnotationSquare(square, annotationGesture.color) || changed;
  } else {
    annotationGesture.dragged = true;
  }

  annotationGesture.lastSquare = square;
  if (annotationGesture.mode === 'arrow') {
    renderAnnotationOverlay();
  } else if (changed) {
    renderBoard();
  }
}

elements.board.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    if (canAnnotate() && hasAnyAnnotations()) {
      event.preventDefault();
      suppressBoardClickUntil = Date.now() + 400;
      commitAnnotations(clearAllAnnotations());
    }
    return;
  }
  if (event.button !== 2 || !canAnnotate()) return;
  const squareEl = event.target instanceof Element ? event.target.closest('.square') : null;
  const square = squareEl && elements.board.contains(squareEl) ? squareEl.dataset.square || '' : '';
  if (!SQUARE_PATTERN.test(square)) return;

  event.preventDefault();
  annotationGesture = {
    active: true,
    mode: annotationGestureModeFromEvent(event),
    color: annotationColorFromEvent(event),
    startSquare: square,
    lastSquare: square,
    dragged: false,
  };
  suppressContextMenu = true;
});

document.addEventListener('mousemove', (event) => {
  if (!annotationGesture.active) return;
  if (event.buttons === 0) {
    cancelAnnotationGesture();
    return;
  }
  applyAnnotationGestureSquare(squareFromClientPoint(event.clientX, event.clientY));
});

document.addEventListener('mouseup', (event) => {
  if (!annotationGesture.active) return;

  const releaseSquare = squareFromClientPoint(event.clientX, event.clientY);
  let changed = false;
  if (annotationGesture.mode === 'paint' && !annotationGesture.dragged && releaseSquare === annotationGesture.startSquare) {
    changed = toggleAnnotationCircle(annotationGesture.startSquare, annotationGesture.color);
  } else if (annotationGesture.mode === 'star' && !annotationGesture.dragged && releaseSquare === annotationGesture.startSquare) {
    changed = toggleAnnotationStar(annotationGesture.startSquare, annotationGesture.color);
  } else if (annotationGesture.mode === 'arrow' && releaseSquare && releaseSquare !== annotationGesture.startSquare) {
    changed = addAnnotationArrow(annotationGesture.startSquare, releaseSquare, annotationGesture.color);
  }

  const hadPreview = annotationGesture.mode === 'arrow';
  annotationGesture = createEmptyAnnotationGesture();
  if (changed) {
    commitAnnotations(true);
  } else if (hadPreview) {
    renderAnnotationOverlay();
  }
  window.setTimeout(() => { suppressContextMenu = false; }, 250);
});

elements.board.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

document.addEventListener('contextmenu', (event) => {
  if (!suppressContextMenu) return;
  event.preventDefault();
  suppressContextMenu = false;
});

window.addEventListener('blur', cancelAnnotationGesture);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && annotationGesture.active) cancelAnnotationGesture();
});

function replacePosition(fen, nextOrientation = orientation, lessonId = '') {
  const nextGame = new Chess();
  if (nextGame.load(fen) === false) throw new Error('Invalid FEN');
  game = nextGame;
  orientation = nextOrientation === 'black' ? 'black' : 'white';
  activeLessonId = lessonId;
  annotations = createEmptyAnnotations();
  cancelAnnotationGesture();
  selectedSquare = null;
  legalMoves = [];
  lastMove = null;
  revision += 1;
  closePromotionChooser();
  render();
  publish('state');
}

function loadFen() {
  try {
    replacePosition(elements.fenInput.value.trim());
    elements.fenMessage.textContent = 'Position loaded and shared.';
    elements.fenMessage.classList.remove('error');
  } catch {
    elements.fenMessage.textContent = 'That FEN is not a valid chess position.';
    elements.fenMessage.classList.add('error');
  }
}

function normalizeHeader(value) {
  return String(value ?? '').replace(/^\ufeff/, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function slugify(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function truthy(value) {
  return ['yes', 'true', '1', 'default'].includes(String(value ?? '').trim().toLowerCase());
}

function parseLessonRows(rows) {
  const nonBlank = rows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()));
  if (nonBlank.length < 2) throw new Error('The file must contain a header and at least one position.');
  const headers = nonBlank[0].map(normalizeHeader);
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  if (indexes.title == null || indexes.fen == null) throw new Error('The file must include title and fen columns.');
  const used = new Set();
  const lessons = nonBlank.slice(1).map((row, rowIndex) => {
    const get = (name) => String(row[indexes[name]] ?? '');
    const title = get('title').trim();
    const fen = get('fen').trim().replace(/\s+/g, ' ');
    if (!title || !fen) throw new Error(`Row ${rowIndex + 2} requires both title and FEN.`);
    const validation = new Chess();
    if (validation.load(fen) === false) throw new Error(`Row ${rowIndex + 2} contains an invalid FEN.`);
    let id = get('id').trim() || slugify(title) || `position-${rowIndex + 1}`;
    let suffix = 2;
    while (used.has(id)) id = `${slugify(title) || 'position'}-${suffix++}`;
    used.add(id);
    const order = Number(get('order'));
    return {
      id,
      title,
      fen,
      order: Number.isFinite(order) ? order : rowIndex + 1,
      orientation: get('orientation').trim().toLowerCase() === 'black' ? 'black' : 'white',
      teacherNote: get('teacher_note').replace(/\r\n/g, '\n').trim(),
      isDefault: truthy(get('is_default')),
      sourceIndex: rowIndex,
    };
  });
  lessons.sort((a, b) => a.order - b.order || a.sourceIndex - b.sourceIndex);
  if (!lessons.some((lesson) => lesson.isDefault)) lessons[0].isDefault = true;
  let foundDefault = false;
  lessons.forEach((lesson) => {
    if (lesson.isDefault && foundDefault) lesson.isDefault = false;
    if (lesson.isDefault) foundDefault = true;
    delete lesson.sourceIndex;
  });
  return lessons;
}

async function importLessonFile() {
  const file = elements.lessonFileInput.files?.[0];
  if (!file) {
    elements.lessonMessage.textContent = 'Choose a CSV or Excel file first.';
    elements.lessonMessage.classList.add('error');
    return;
  }
  try {
    if (!window.XLSX) throw new Error('Excel reader is unavailable.');
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
    preparedLessons = parseLessonRows(rows);
    const initial = preparedLessons.find((lesson) => lesson.isDefault) || preparedLessons[0];
    activeLessonId = initial.id;
    try { localStorage.setItem(LESSON_STORAGE_KEY, JSON.stringify({ fileName: file.name, lessons: preparedLessons })); } catch {}
    elements.lessonMessage.textContent = `Imported ${preparedLessons.length} prepared position${preparedLessons.length === 1 ? '' : 's'} from ${file.name}.`;
    elements.lessonMessage.classList.remove('error');
    replacePosition(initial.fen, initial.orientation, initial.id);
  } catch (error) {
    elements.lessonMessage.textContent = error.message || 'The lesson file could not be imported.';
    elements.lessonMessage.classList.add('error');
  }
}

function restoreLessons() {
  try {
    const saved = JSON.parse(localStorage.getItem(LESSON_STORAGE_KEY) || 'null');
    if (!saved?.lessons?.length) return;
    preparedLessons = saved.lessons;
    activeLessonId = preparedLessons.find((lesson) => lesson.isDefault)?.id || preparedLessons[0].id;
    elements.lessonMessage.textContent = `Restored ${preparedLessons.length} prepared position${preparedLessons.length === 1 ? '' : 's'}.`;
  } catch {}
}

elements.createRoomButton.addEventListener('click', () => enterRoom('teacher', makeRoomCode()));
elements.joinRoomButton.addEventListener('click', () => {
  const code = normalizeRoomCode(elements.roomCodeInput.value);
  if (!code) {
    elements.roomSetupMessage.textContent = 'Enter the teacher room code.';
    elements.roomSetupMessage.classList.add('error');
    return;
  }
  enterRoom('student', code);
});
elements.roomCodeInput.addEventListener('input', () => { elements.roomCodeInput.value = normalizeRoomCode(elements.roomCodeInput.value); });

elements.copyStudentLinkButton.addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', roomCode);
  url.searchParams.set('role', 'student');
  try {
    await navigator.clipboard.writeText(url.href);
    elements.connectionStatus.textContent = 'Student link copied';
  } catch {
    prompt('Copy this student link:', url.href);
  }
});

elements.lockStudentButton.addEventListener('click', () => {
  studentMovesAllowed = !studentMovesAllowed;
  revision += 1;
  render();
  publish('state');
});

elements.undoButton.addEventListener('click', () => {
  const move = game.undo();
  if (!move) return;
  lastMove = null;
  revision += 1;
  selectedSquare = null;
  legalMoves = [];
  closePromotionChooser();
  render();
  publish('state');
});

elements.resetButton.addEventListener('click', () => replacePosition(DEFAULT_POSITION, orientation));
elements.flipButton.addEventListener('click', () => {
  orientation = orientation === 'white' ? 'black' : 'white';
  revision += 1;
  render();
  publish('state');
});
elements.themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('color-theme-v1', next); } catch {}
});
elements.loadFenButton.addEventListener('click', loadFen);
elements.fenInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') loadFen();
});
elements.copyFenButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(game.fen());
    elements.fenMessage.textContent = 'FEN copied.';
    elements.fenMessage.classList.remove('error');
  } catch {
    elements.fenInput.select();
    elements.fenMessage.textContent = 'FEN selected. Copy it manually.';
  }
});
elements.importLessonButton.addEventListener('click', importLessonFile);
elements.clearLessonButton.addEventListener('click', () => {
  preparedLessons = [];
  activeLessonId = '';
  elements.lessonFileInput.value = '';
  elements.lessonMessage.textContent = 'Prepared lessons cleared.';
  try { localStorage.removeItem(LESSON_STORAGE_KEY); } catch {}
  renderLessons();
});
elements.lessonPositionSelect.addEventListener('change', () => {
  const lesson = preparedLessons.find((item) => item.id === elements.lessonPositionSelect.value);
  if (!lesson) return;
  replacePosition(lesson.fen, lesson.orientation, lesson.id);
});

function setActiveCamPreset(activeBtn) {
  const buttons = [
    elements.camAngleBtn,
    elements.camTopBtn,
    elements.camWhiteBtn,
    elements.camBlackBtn,
    elements.camResetBtn,
  ];
  buttons.forEach((btn) => btn?.classList.remove('active'));
  activeBtn?.classList.add('active');
}

let LiveBoard3DClass = null;

async function getLiveBoard3DClass() {
  if (!LiveBoard3DClass) {
    try {
      const module = await import('./live-board-3d.js');
      LiveBoard3DClass = module.LiveBoard3D;
    } catch (err) {
      console.warn('3D live board module could not be loaded.', err);
    }
  }
  return LiveBoard3DClass;
}

async function set3dMode(active) {
  is3dMode = Boolean(active);
  try { localStorage.setItem('live-board:3d-mode', String(is3dMode)); } catch {}

  elements.board.hidden = is3dMode;
  if (elements.board3d) elements.board3d.hidden = !is3dMode;
  if (elements.board?.parentElement) {
    elements.board.parentElement.classList.toggle('is-3d-active', is3dMode);
  }
  if (elements.camera3dControls) elements.camera3dControls.hidden = !is3dMode;
  if (elements.toggle3dButton) {
    elements.toggle3dButton.setAttribute('aria-pressed', String(is3dMode));
    elements.toggle3dButton.textContent = is3dMode ? '2D View' : '3D View';
    elements.toggle3dButton.classList.toggle('is-3d', is3dMode);
  }

  if (is3dMode && !liveBoard3DInstance && elements.board3d) {
    const Cls = await getLiveBoard3DClass();
    if (Cls && !liveBoard3DInstance) {
      liveBoard3DInstance = new Cls(elements.board3d, (square) => {
        handleSquareClick(square);
      });
    }
  }

  if (is3dMode && liveBoard3DInstance) {
    liveBoard3DInstance.syncState({
      fen: game.fen(),
      orientation,
      lastMove,
      selectedSquare,
      legalMoves,
      canMove: canMovePieces(),
    });
  }
}

elements.toggle3dButton?.addEventListener('click', () => {
  set3dMode(!is3dMode);
});

elements.camAngleBtn?.addEventListener('click', () => {
  liveBoard3DInstance?.setCameraView('angle');
  setActiveCamPreset(elements.camAngleBtn);
});
elements.camTopBtn?.addEventListener('click', () => {
  liveBoard3DInstance?.setCameraView('top');
  setActiveCamPreset(elements.camTopBtn);
});
elements.camWhiteBtn?.addEventListener('click', () => {
  liveBoard3DInstance?.setCameraView('white');
  setActiveCamPreset(elements.camWhiteBtn);
});
elements.camBlackBtn?.addEventListener('click', () => {
  liveBoard3DInstance?.setCameraView('black');
  setActiveCamPreset(elements.camBlackBtn);
});
elements.camResetBtn?.addEventListener('click', () => {
  liveBoard3DInstance?.resetCamera();
  setActiveCamPreset(elements.camAngleBtn);
});

set3dMode(is3dMode);
restoreLessons();
const params = new URLSearchParams(location.search);
const initialRole = params.get('role');
const initialRoom = normalizeRoomCode(params.get('room'));
if ((initialRole === 'teacher' || initialRole === 'student') && initialRoom) {
  enterRoom(initialRole, initialRoom);
} else {
  renderLessons();
}