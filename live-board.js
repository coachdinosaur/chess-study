import { Chess, DEFAULT_POSITION } from './vendor/chess.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_ASSETS = Object.freeze({
  wk: './assets/pieces/mpchess/wK.svg',
  wq: './assets/pieces/mpchess/wQ.svg',
  wr: './assets/pieces/mpchess/wR.svg',
  wb: './assets/pieces/mpchess/wB.svg',
  wn: './assets/pieces/mpchess/wN.svg',
  wp: './assets/pieces/mpchess/wP.svg',
  bk: './assets/pieces/mpchess/bK.svg',
  bq: './assets/pieces/mpchess/bQ.svg',
  br: './assets/pieces/mpchess/bR.svg',
  bb: './assets/pieces/mpchess/bB.svg',
  bn: './assets/pieces/mpchess/bN.svg',
  bp: './assets/pieces/mpchess/bP.svg',
});

const boardElement = document.getElementById('liveBoard');
const statusTitle = document.getElementById('statusTitle');
const statusPill = document.getElementById('statusPill');
const fenInput = document.getElementById('fenInput');
const fenMessage = document.getElementById('fenMessage');
const moveList = document.getElementById('moveList');
const undoButton = document.getElementById('undoButton');
const resetButton = document.getElementById('resetButton');
const flipButton = document.getElementById('flipButton');
const themeButton = document.getElementById('themeButton');
const loadFenButton = document.getElementById('loadFenButton');
const copyFenButton = document.getElementById('copyFenButton');

let game = new Chess();
let orientation = 'white';
let selectedSquare = null;
let legalMoves = [];
let lastMove = null;

function squareName(fileIndex, rankIndex) {
  return `${FILES[fileIndex]}${rankIndex + 1}`;
}

function visibleSquares() {
  const ranks = orientation === 'white'
    ? [8, 7, 6, 5, 4, 3, 2, 1]
    : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

function pieceAt(square) {
  if (typeof game.get === 'function') return game.get(square);
  const board = game.board();
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return board[8 - rank]?.[file] || null;
}

function pieceLabel(piece) {
  const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  return `${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.type]}`;
}

function getLegalMoves(square) {
  try {
    return game.moves({ square, verbose: true });
  } catch {
    return [];
  }
}

function isPromotionMove(from, to) {
  return legalMoves.some((move) => move.from === from && move.to === to && move.promotion);
}

function tryMove(from, to) {
  const moveData = { from, to };
  if (isPromotionMove(from, to)) moveData.promotion = 'q';

  try {
    const move = game.move(moveData);
    if (!move) return false;
    lastMove = { from: move.from, to: move.to };
    selectedSquare = null;
    legalMoves = [];
    render();
    return true;
  } catch {
    return false;
  }
}

function handleSquareClick(square) {
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
}

function gameStatus() {
  if (typeof game.isCheckmate === 'function' && game.isCheckmate()) return ['Checkmate', 'Finished'];
  if (typeof game.isStalemate === 'function' && game.isStalemate()) return ['Stalemate', 'Draw'];
  if (typeof game.isDraw === 'function' && game.isDraw()) return ['Draw', 'Finished'];
  const side = game.turn() === 'w' ? 'White' : 'Black';
  const inCheck = typeof game.inCheck === 'function' ? game.inCheck() : (typeof game.isCheck === 'function' && game.isCheck());
  return [`${side} to move${inCheck ? ' · Check' : ''}`, inCheck ? 'Check' : 'Ready'];
}

function renderBoard() {
  const squares = visibleSquares();
  boardElement.replaceChildren();

  squares.forEach((square, visibleIndex) => {
    const fileIndex = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    const squareButton = document.createElement('button');
    const dark = (fileIndex + rank) % 2 === 1;
    const legalMove = legalMoves.find((move) => move.to === square);

    squareButton.type = 'button';
    squareButton.className = `square${dark ? ' dark' : ''}`;
    squareButton.dataset.square = square;
    squareButton.setAttribute('role', 'gridcell');
    squareButton.setAttribute('aria-label', square);

    if (selectedSquare === square) squareButton.classList.add('selected');
    if (lastMove && (lastMove.from === square || lastMove.to === square)) squareButton.classList.add('last-move');
    if (legalMove) {
      squareButton.classList.add('legal');
      if (pieceAt(square)) squareButton.classList.add('capture');
    }

    const piece = pieceAt(square);
    if (piece) {
      const image = document.createElement('img');
      image.className = 'piece';
      image.src = PIECE_ASSETS[`${piece.color}${piece.type}`];
      image.alt = pieceLabel(piece);
      image.draggable = false;
      squareButton.appendChild(image);
      squareButton.setAttribute('aria-label', `${square}, ${pieceLabel(piece)}`);
    }

    const visibleRow = Math.floor(visibleIndex / 8);
    const visibleColumn = visibleIndex % 8;
    if (visibleColumn === 0) {
      const rankLabel = document.createElement('span');
      rankLabel.className = 'coordinate rank';
      rankLabel.textContent = square[1];
      squareButton.appendChild(rankLabel);
    }
    if (visibleRow === 7) {
      const fileLabel = document.createElement('span');
      fileLabel.className = 'coordinate file';
      fileLabel.textContent = square[0];
      squareButton.appendChild(fileLabel);
    }

    squareButton.addEventListener('click', () => handleSquareClick(square));
    boardElement.appendChild(squareButton);
  });
}

function renderMoveList() {
  const history = game.history();
  moveList.replaceChildren();

  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-moves';
    empty.textContent = 'No moves yet.';
    moveList.appendChild(empty);
    return;
  }

  for (let i = 0; i < history.length; i += 2) {
    const item = document.createElement('li');
    item.textContent = history[i + 1] ? `${history[i]} ${history[i + 1]}` : history[i];
    moveList.appendChild(item);
  }
}

function render() {
  renderBoard();
  renderMoveList();
  fenInput.value = game.fen();
  const [title, pill] = gameStatus();
  statusTitle.textContent = title;
  statusPill.textContent = pill;
  undoButton.disabled = game.history().length === 0;
}

function loadFen() {
  const fen = fenInput.value.trim();
  if (!fen) return;

  try {
    const nextGame = new Chess();
    const loaded = nextGame.load(fen);
    if (loaded === false) throw new Error('Invalid FEN');
    game = nextGame;
    selectedSquare = null;
    legalMoves = [];
    lastMove = null;
    fenMessage.textContent = 'Position loaded.';
    fenMessage.classList.remove('error');
    render();
  } catch {
    fenMessage.textContent = 'That FEN is not a valid chess position.';
    fenMessage.classList.add('error');
  }
}

undoButton.addEventListener('click', () => {
  const move = game.undo();
  if (!move) return;
  lastMove = null;
  selectedSquare = null;
  legalMoves = [];
  render();
});

resetButton.addEventListener('click', () => {
  game = new Chess(DEFAULT_POSITION);
  selectedSquare = null;
  legalMoves = [];
  lastMove = null;
  fenMessage.textContent = '';
  render();
});

flipButton.addEventListener('click', () => {
  orientation = orientation === 'white' ? 'black' : 'white';
  renderBoard();
});

themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('color-theme-v1', next); } catch {}
});

loadFenButton.addEventListener('click', loadFen);
fenInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') loadFen();
});

copyFenButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(game.fen());
    fenMessage.textContent = 'FEN copied.';
    fenMessage.classList.remove('error');
  } catch {
    fenInput.select();
    fenMessage.textContent = 'FEN selected. Copy it manually.';
  }
});

render();
