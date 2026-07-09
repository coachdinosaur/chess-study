console.log("APP VERSION: board-debug-20260707");
document.body.dataset.appVersion = "board-debug-20260707";

import { Chess, DEFAULT_POSITION, validateFen } from './vendor/chess.js';
import { buildPgnFromLessonTree, parsePgnToLessonTree, splitPgnGames, extractPgnHeaders } from './pgn.mjs';
import { createGuidedReviewController } from './guided-review.mjs';
import { normalizeEditableText } from './text-normalization.mjs';
import {
  createEndgamePuzzleApi,
  materialBalanceFromFen,
  PUZZLE_OBJECTIVE_MATE,
  PUZZLE_OBJECTIVE_WIN,
  PUZZLE_OBJECTIVE_DRAW,
  PUZZLE_DIFFICULTIES,
} from './puzzle-api.mjs';

const STORAGE_KEY = 'setup-analysis-draft-v1';
const COLOR_THEME_STORAGE_KEY = 'color-theme-v1';
const PIECE_ORDER = ['K', 'Q', 'R', 'B', 'N', 'P'];
const FILE_LABELS = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
const SQUARE_PATTERN = /^[a-h][1-8]$/;
const BOARD_VIEWBOX_SIZE = 800;
const BOARD_CELL_SIZE = BOARD_VIEWBOX_SIZE / 8;
const ANNOTATION_ARROW_HEAD_LENGTH = 30;
const ANNOTATION_ARROW_HEAD_WIDTH = 40;
const LAST_MOVE_ARROW_START_INSET = 30;
const LAST_MOVE_ARROW_TIP_INSET = 30;
const LAST_MOVE_ARROW_HEAD_LENGTH = 24;
const LAST_MOVE_ARROW_HEAD_WIDTH = 34;
const ENGINE_MULTI_PV_COUNT = 3;
const ENGINE_READY_TIMEOUT_MS = 15000;
const TABLEBASE_ENDPOINT = 'https://tablebase.lichess.org/standard';
const TABLEBASE_FETCH_TIMEOUT_MS = 30000;
const TABLEBASE_MAX_TOTAL_PIECES = 7;
const TABLEBASE_MAX_PIECES_PER_SIDE = 4;
const TABLEBASE_ENDGAME_LABEL = 'up-to-7-piece endgame';
const TABLEBASE_LINE_MAX_PLIES = 80;
const TABLEBASE_LINE_MAX_REQUESTS = 80;
const DEFAULT_ANALYSIS_TARGET_DEPTH = 30;
const ANALYSIS_TARGET_DEPTH_MIN = 1;
const ANALYSIS_TARGET_DEPTH_MAX = 99;
const LESSON_ACTIONS_MENU_GAP_REM = 0.4;
const LESSON_ACTIONS_MENU_VIEWPORT_PADDING_REM = 0.5;
const MOBILE_VIEWPORT_MEDIA_QUERY = '(max-width: 760px)';
const MOBILE_PORTRAIT_VIEWPORT_MEDIA_QUERY = '(max-width: 760px) and (orientation: portrait)';
const MOBILE_COARSE_LANDSCAPE_MEDIA_QUERY = '(max-width: 1100px) and (min-width: 640px) and (orientation: landscape) and (pointer: coarse)';
const ENGINE_SEARCH_MODE_CHECKPOINT = 'checkpoint';
const ENGINE_SEARCH_MODE_CONTINUE = 'continue';
const ENGINE_BUNDLE_CANDIDATES = Object.freeze([
  Object.freeze({
    id: 'full-multi',
    label: 'full multi-threaded',
    workerPath: './vendor/stockfish/stockfish-18.js',
    wasmPath: './vendor/stockfish/stockfish-18.wasm',
    requiresCrossOriginIsolation: true,
  }),
  Object.freeze({
    id: 'full-single',
    label: 'full single-threaded',
    workerPath: './vendor/stockfish/stockfish-18-single.js',
    wasmPath: './vendor/stockfish/stockfish-18-single.wasm',
    requiresCrossOriginIsolation: false,
  }),
  Object.freeze({
    id: 'lite-multi',
    label: 'lite multi-threaded',
    workerPath: './vendor/stockfish/stockfish-18-lite.js',
    wasmPath: './vendor/stockfish/stockfish-18-lite.wasm',
    requiresCrossOriginIsolation: true,
  }),
  Object.freeze({
    id: 'lite-single',
    label: 'lite single-threaded',
    workerPath: './vendor/stockfish/stockfish-18-lite-single.js',
    wasmPath: './vendor/stockfish/stockfish-18-lite-single.wasm',
    requiresCrossOriginIsolation: false,
  }),
]);
const TAB_SETUP = 'setup';
const TAB_ANALYSIS = 'analysis';
const TAB_PLAY = 'play';
const TAB_PUZZLE = 'puzzle';
const TAB_STUDY = 'study';
const TAB_LESSONS = 'lessons';
const LEGACY_TAB_PGN = 'pgn';
const PUZZLE_PREFS_STORAGE_KEY = 'endgame-puzzle-prefs-v1';
const PUZZLE_PREMIUM_STORAGE_KEY = 'endgame-puzzle-premium-v1';
const PUZZLE_FREE_STORAGE_KEY = 'endgame-puzzle-free-v1';
const PUZZLE_QUEUE_STORAGE_KEY = 'endgame-puzzle-queue-v1';
const PUZZLE_HISTORY_STORAGE_KEY = 'endgame-puzzle-history-v1';
const PUZZLE_HISTORY_MAX = 300;
const PUZZLE_QUEUE_MAX = 100;
const PUZZLE_FREE_PER_DAY = 3;
const PUZZLE_WIN_MATERIAL_GAIN = 3;
const DRAW_OBJECTIVE_LOSING_THRESHOLD_CP = -300;


const DEFAULT_ENDGAME_PUZZLES = [
  {
    id: 'default-endgame-001',
    fen: '7k/8/6K1/8/8/8/3Q4/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 9,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 2,
    mateIn: 2,
    evalLabel: '+M2',
    bestMoveUci: 'd2h6',
    bestLineUci: ['d2h6', 'h8g8', 'h6g7'],
    title: 'Stalemate Avoidance',
    instruction: 'Avoid stalemating the Black king. Find the winning path.'
  },
  {
    id: 'default-endgame-002',
    fen: '3k4/8/8/3K4/3P4/8/8/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 1,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 8,
    mateIn: 8,
    evalLabel: '+M8',
    bestMoveUci: 'd5d6',
    bestLineUci: ['d5d6', 'd8e8', 'd5c7', 'e8e7', 'd4d5', 'e7e8', 'd5d6', 'e8f7', 'd6d7'],
    title: 'King and Pawn Opposition',
    instruction: 'Seize the opposition with the King to shepherd your pawn to promotion.'
  },
  {
    id: 'default-endgame-003',
    fen: '7k/8/5K2/8/8/8/3Q4/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 9,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 2,
    mateIn: 2,
    evalLabel: '+M2',
    bestMoveUci: 'd2h6',
    bestLineUci: ['d2h6', 'h8g8', 'h6g7'],
    title: 'Queen and King Checkmate',
    instruction: 'Deliver checkmate in two moves with your King and Queen.'
  },
  {
    id: 'default-endgame-004',
    fen: '7k/R7/5K2/8/8/8/8/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 5,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 2,
    mateIn: 2,
    evalLabel: '+M2',
    bestMoveUci: 'f6g6',
    bestLineUci: ['f6g6', 'h8g8', 'a7a8'],
    title: 'Rook and King Mate',
    instruction: 'Bring your King to support the Rook and deliver checkmate in two moves.'
  },
  {
    id: 'default-endgame-005',
    fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 0,
    pieceCount: 8,
    scoreType: 'mate',
    scoreValue: 12,
    mateIn: 12,
    evalLabel: '+M12',
    bestMoveUci: 'b5b6',
    bestLineUci: ['b5b6', 'a7b6', 'c5c6', 'b7c6', 'a5a6'],
    title: 'Pawn Breakthrough',
    instruction: 'Sacrifice pawns to create a path for one pawn to promote.'
  },
  {
    id: 'default-endgame-006',
    fen: '8/8/6k1/P7/4K2p/8/8/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 0,
    pieceCount: 4,
    scoreType: 'mate',
    scoreValue: 10,
    mateIn: 10,
    evalLabel: '+M10',
    bestMoveUci: 'a5a6',
    bestLineUci: ['a5a6', 'h4h3', 'e4f3', 'h4h3', 'f3g2', 'h3h2'],
    title: 'Passed Pawn Race',
    instruction: 'Advance your passed pawn and use your King to stop the opponent\'s pawn.'
  },
  {
    id: 'default-endgame-007',
    fen: '6K1/4k1P1/8/8/5R2/8/8/2r5 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 6,
    pieceCount: 5,
    scoreType: 'mate',
    scoreValue: 15,
    mateIn: 15,
    evalLabel: '+M15',
    bestMoveUci: 'f4e4',
    bestLineUci: ['f4e4', 'e7d7', 'g8f7', 'c1f1', 'e4f4', 'f1g1', 'f7f6'],
    title: 'Lucena Position',
    instruction: 'Build a bridge with your Rook to shield your King from checks and promote your pawn.'
  },
  {
    id: 'default-endgame-008',
    fen: '4k3/R7/8/4P3/8/1r6/8/4K3 b - - 0 1',
    objective: 'draw',
    requestedObjective: 'draw',
    isFallback: false,
    solverColor: 'b',
    startBalance: -1,
    pieceCount: 5,
    scoreType: 'cp',
    scoreValue: 0,
    mateIn: null,
    evalLabel: '0.00',
    bestMoveUci: 'b3e3',
    bestLineUci: ['b3e3', 'e1d2', 'e3e5'],
    title: 'Philidor Position',
    instruction: 'Hold the draw as Black. Keep your Rook on the third rank until the pawn advances, then attack from behind.'
  },


  {
    id: 'default-endgame-013',
    fen: '7k/8/R7/8/8/8/8/1R4K1 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 10,
    pieceCount: 4,
    scoreType: 'mate',
    scoreValue: 2,
    mateIn: 2,
    evalLabel: '+M2',
    bestMoveUci: 'b1b7',
    bestLineUci: ['b1b7', 'h8g8', 'a6a8'],
    title: 'Rook Lawnmower Mate',
    instruction: 'Use both Rooks in tandem to cut off the King and deliver checkmate.'
  },
  {
    id: 'default-endgame-014',
    fen: '8/8/P7/3k3p/5K2/8/8/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 0,
    pieceCount: 4,
    scoreType: 'mate',
    scoreValue: 8,
    mateIn: 8,
    evalLabel: '+M8',
    bestMoveUci: 'a6a7',
    bestLineUci: ['a6a7', 'h5h4', 'a7a8q'],
    title: 'Pawn Race Victory',
    instruction: 'Advance your pawn. Your opponent\'s King is too far, and your promotion will come with check.'
  },
  {
    id: 'default-endgame-015',
    fen: '8/k1P5/2K5/8/8/8/8/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 1,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 2,
    mateIn: 2,
    evalLabel: '+M2',
    bestMoveUci: 'c7c8r',
    bestLineUci: ['c7c8r', 'a7a6', 'c8a8'],
    title: 'Underpromotion',
    instruction: 'Avoid stalemate by promoting to a Rook instead of a Queen to deliver mate.'
  },

  {
    id: 'default-endgame-017',
    fen: '5k2/8/5P1P/8/8/8/8/6K1 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 2,
    pieceCount: 4,
    scoreType: 'mate',
    scoreValue: 8,
    mateIn: 8,
    evalLabel: '+M8',
    bestMoveUci: 'h6h7',
    bestLineUci: ['h6h7', 'f8f7', 'h7h8q'],
    title: 'Defensive Promotion Race',
    instruction: 'Promote your pawn with checkmate threats before the Black King can defend.'
  },
  {
    id: 'default-endgame-018',
    fen: '8/8/5B2/8/8/8/p7/1k4K1 w - - 0 1',
    objective: 'draw',
    requestedObjective: 'draw',
    isFallback: false,
    solverColor: 'w',
    startBalance: 2,
    pieceCount: 4,
    scoreType: 'cp',
    scoreValue: 0,
    mateIn: null,
    evalLabel: '0.00',
    bestMoveUci: 'f6e5',
    bestLineUci: ['f6e5', 'a2a1q', 'e5a1', 'b1a1'],
    title: 'Bishop Stop',
    instruction: 'Reposition your Bishop to control the promotion diagonal and stop the pawn.'
  },
  {
    id: 'default-endgame-019',
    fen: 'k7/8/2K5/8/8/8/7Q/8 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 9,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 2,
    mateIn: 2,
    evalLabel: '+M2',
    bestMoveUci: 'h2h7',
    bestLineUci: ['h2h7', 'a8b8', 'h7b7'],
    title: 'Queen Mate Prep',
    instruction: 'Position your Queen on the 7th rank to restrict the King and force mate.'
  },
  {
    id: 'default-endgame-023',
    fen: '8/8/8/5k2/6R1/8/8/5K2 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 5,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 28,
    mateIn: 28,
    evalLabel: '+M28',
    bestMoveUci: 'g4a4',
    bestLineUci: ['g4a4', 'f5e5', 'a4a5'],
    title: 'Rook and King Mate',
    instruction: "Use your Rook and King to drive the opponent's King to the edge and deliver checkmate."
  },
  {
    id: 'default-endgame-024',
    fen: '8/8/8/5k2/8/6Q1/8/5K2 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 9,
    pieceCount: 3,
    scoreType: 'mate',
    scoreValue: 10,
    mateIn: 10,
    evalLabel: '+M10',
    bestMoveUci: 'g3d6',
    bestLineUci: ['g3d6', 'f5e4', 'f1e2'],
    title: 'Queen King Coordination',
    instruction: 'Coordinate Queen and King to restrict the Black King and deliver checkmate.'
  },
  {
    id: 'default-endgame-025',
    fen: '8/8/8/5k2/8/8/4B3/4BK2 w - - 0 1',
    objective: 'mate',
    requestedObjective: 'mate',
    isFallback: false,
    solverColor: 'w',
    startBalance: 6,
    pieceCount: 4,
    scoreType: 'mate',
    scoreValue: 30,
    mateIn: 30,
    evalLabel: '+M30',
    bestMoveUci: 'f1f2',
    bestLineUci: ['f1f2', 'f5e4', 'e1c3'],
    title: 'Bishop Pair Mate',
    instruction: "Use your two Bishops on opposite colors to force the Black King to the edge and deliver checkmate."
  },
  {
    id: 'default-endgame-026',
    fen: '5k2/8/8/8/8/8/6r1/5KQ1 w - - 0 1',
    objective: 'win',
    requestedObjective: 'win',
    isFallback: false,
    solverColor: 'w',
    startBalance: 4,
    pieceCount: 4,
    scoreType: 'cp',
    scoreValue: 500,
    mateIn: null,
    evalLabel: '5.00',
    bestMoveUci: 'g1h2',
    bestLineUci: ['g1h2', 'f8g7', 'f1e1'],
    title: 'Queen vs Rook',
    instruction: 'The Queen is stronger than the Rook. Win material while keeping your King safe.'
  },
  {
    id: 'default-endgame-027',
    fen: '8/8/3k4/8/8/8/3p4/3K4 w - - 0 1',
    objective: 'draw',
    requestedObjective: 'draw',
    isFallback: false,
    solverColor: 'w',
    startBalance: -1,
    pieceCount: 3,
    scoreType: 'cp',
    scoreValue: 0,
    mateIn: null,
    evalLabel: '0.00',
    bestMoveUci: 'd1d2',
    bestLineUci: ['d1d2', 'd6c5', 'd2c1'],
    title: 'King Opposition',
    instruction: "Your King blocks the pawn. Maintain the opposition to hold the draw."
  },
  {
    id: 'default-endgame-028',
    fen: '8/8/8/5k2/8/2b5/6p1/6K1 w - - 0 1',
    objective: 'draw',
    requestedObjective: 'draw',
    isFallback: false,
    solverColor: 'w',
    startBalance: -4,
    pieceCount: 4,
    scoreType: 'cp',
    scoreValue: 0,
    mateIn: null,
    evalLabel: '0.00',
    bestMoveUci: 'g1g2',
    bestLineUci: ['g1g2', 'c3a1', 'g2f1'],
    title: 'Bishop Endgame Defense',
    instruction: 'Down a pawn, use your Bishop to control key diagonals and prevent promotion.'
  },

];

function createDefaultPuzzleQueue() {
  return DEFAULT_ENDGAME_PUZZLES.map(p => ({ ...p, bestLineUci: [...p.bestLineUci], source: 'default' }));
}

const DEFAULT_PUZZLE_COUNT = DEFAULT_ENDGAME_PUZZLES.length;

function addPuzzleToQueue(puzzle) {
  if (!puzzle || !puzzle.fen || isPuzzleFenIllegal(puzzle.fen)) {
    return;
  }
  if (state.puzzle.puzzleQueue.some(p => p.id === puzzle.id)) {
    return;
  }
  if (!puzzle.source) {
    puzzle.source = 'generated';
  }
  state.puzzle.puzzleQueue.push(puzzle);
}

function restoreDefaultPuzzles() {
  const nonDefaultPuzzles = state.puzzle.puzzleQueue.filter(p => p.source !== 'default');
  state.puzzle.puzzleQueue = [...createDefaultPuzzleQueue(), ...nonDefaultPuzzles];
  persistPuzzleQueue();
  renderPuzzlePanel();
}
const PRACTICE_KIND_LINE = 'line';
const PRACTICE_KIND_BRANCH = 'branch';
const DEFAULT_TITLE = '';
const LESSON_FILE_VERSION = 1;
const LESSON_BOOK_FILE_VERSION = 2;
const ROOT_NODE_ID = 'root';

function normalizeActiveTab(value, fallback = TAB_PLAY) {
  const normalized = String(value || '').trim();
  if (
    normalized === TAB_SETUP
    || normalized === TAB_ANALYSIS
    || normalized === TAB_PLAY
    || normalized === TAB_PUZZLE
    || normalized === TAB_STUDY
    || normalized === TAB_LESSONS
  ) {
    return normalized;
  }
  if (normalized === LEGACY_TAB_PGN) {
    return TAB_ANALYSIS;
  }
  return fallback;
}

const CAPTURED_PIECE_ORDER = ['Q', 'R', 'B', 'N', 'P'];
const STANDARD_PIECE_COUNTS = Object.freeze({
  Q: 1,
  R: 2,
  B: 2,
  N: 2,
  P: 8,
});
const DEFAULT_META = Object.freeze({
  activeColor: 'w',
  castling: 'KQkq',
  enPassant: '-',
  halfmove: 0,
  fullmove: 1,
});
const PIECE_LABELS = Object.freeze({
  K: 'King',
  Q: 'Queen',
  R: 'Rook',
  B: 'Bishop',
  N: 'Knight',
  P: 'Pawn',
});
const PIECE_ASSETS = Object.freeze({
  K: './assets/pieces/mpchess/wK.svg',
  Q: './assets/pieces/mpchess/wQ.svg',
  R: './assets/pieces/mpchess/wR.svg',
  B: './assets/pieces/mpchess/wB.svg',
  N: './assets/pieces/mpchess/wN.svg',
  P: './assets/pieces/mpchess/wP.svg',
  k: './assets/pieces/mpchess/bK.svg',
  q: './assets/pieces/mpchess/bQ.svg',
  r: './assets/pieces/mpchess/bR.svg',
  b: './assets/pieces/mpchess/bB.svg',
  n: './assets/pieces/mpchess/bN.svg',
  p: './assets/pieces/mpchess/bP.svg',
});

const dom = {
  rootElement: document.documentElement,
  pageShell: document.querySelector('.page-shell'),
  boardGrid: document.getElementById('boardGrid'),
  boardAnnotationOverlay: document.getElementById('boardAnnotationOverlay'),
  boardFrame: document.querySelector('.board-frame'),
  boardColumn: document.querySelector('.board-column'),
  boardTitleDisplay: document.getElementById('boardTitleDisplay'),
  modePill: document.getElementById('modePill'),
  validityPill: document.getElementById('validityPill'),
  evalBarWrap: document.getElementById('evalBarWrap'),
  evalBarWhite: document.getElementById('evalBarWhite'),
  turnSideMarker: document.getElementById('turnSideMarker'),
  capturedTop: document.getElementById('capturedTop'),
  capturedBottom: document.getElementById('capturedBottom'),
  capturedTopPieces: document.getElementById('capturedTopPieces'),
  capturedBottomPieces: document.getElementById('capturedBottomPieces'),
  boardContextLabel: document.getElementById('boardContextLabel'),
  turnToken: document.getElementById('turnToken'),
  castlingToken: document.getElementById('castlingToken'),
  enPassantToken: document.getElementById('enPassantToken'),
  currentFenCode: document.getElementById('currentFenCode'),
  setupFenCode: document.getElementById('setupFenCode'),
  engineReadyLabel: document.getElementById('engineReadyLabel'),
  titleInput: document.getElementById('titleInput'),
  headerAnalyzeButton: document.getElementById('headerAnalyzeButton'),
  lessonBookActionsButton: document.getElementById('lessonBookActionsButton'),
  lessonBookActionsMenu: document.getElementById('lessonBookActionsMenu'),
  lessonActionsButton: document.getElementById('lessonActionsButton'),
  lessonActionsMenu: document.getElementById('lessonActionsMenu'),
  openLessonButton: document.getElementById('openLessonButton'),
  saveLessonButton: document.getElementById('saveLessonButton'),
  guidedReviewButton: document.getElementById('guidedReviewButton'),
  importPgnButton: document.getElementById('importPgnButton'),
  exportPgnButton: document.getElementById('exportPgnButton'),
  togglePgnCommentsMenuButton: document.getElementById('togglePgnCommentsMenuButton'),
  toggleNoteMenuButton: document.getElementById('toggleNoteMenuButton'),
  toggleToolsMenuButton: document.getElementById('toggleToolsMenuButton'),
  togglePvLinesMenuButton: document.getElementById('togglePvLinesMenuButton'),
  toggleFullscreenMenuButton: document.getElementById('toggleFullscreenMenuButton'),
  focusModeControls: document.getElementById('focusModeControls'),
  focusModeAnalyzeButton: document.getElementById('focusModeAnalyzeButton'),
  exitFocusModeButton: document.getElementById('exitFocusModeButton'),
  toggleThemeButton: document.getElementById('toggleThemeButton'),
  toggleLastMoveArrowButton: document.getElementById('toggleLastMoveArrowButton'),
  lessonPickerButton: document.getElementById('lessonPickerButton'),
  lessonPickerValue: document.getElementById('lessonPickerValue'),
  lessonPickerMenu: document.getElementById('lessonPickerMenu'),
  newLessonButton: document.getElementById('newLessonButton'),
  duplicateLessonButton: document.getElementById('duplicateLessonButton'),
  deleteLessonButton: document.getElementById('deleteLessonButton'),
  lessonFileInput: document.getElementById('lessonFileInput'),
  pgnFileInput: document.getElementById('pgnFileInput'),
  guidedReviewFileInput: document.getElementById('guidedReviewFileInput'),
  scanBoardInput: document.getElementById('scanBoardInput'),
  puzzleCsvFileInput: document.getElementById('puzzleCsvFileInput'),
  lessonFileStatus: document.getElementById('lessonFileStatus'),
  heroBanner: document.getElementById('heroBanner'),
  controlPaneScroll: document.querySelector('.control-pane-scroll'),
  guidedReviewAnalysisPanel: document.getElementById('guidedReviewAnalysisPanel'),
  guidedReviewPanel: document.getElementById('guidedReviewPanel'),
  notationSection: document.querySelector('.lesson-notation'),
  notationSummary: document.getElementById('notationSummary'),
  notationPanel: document.getElementById('notationPanel'),
  mobileEngineLinesSlot: document.getElementById('mobileEngineLinesSlot'),
  notationStartButton: document.getElementById('notationStartButton'),
  notationPrevButton: document.getElementById('notationPrevButton'),
  notationNextButton: document.getElementById('notationNextButton'),
  notationEndButton: document.getElementById('notationEndButton'),
  workspaceTools: document.getElementById('workspaceTools'),
  setupPanel: document.getElementById('setupPanel'),
  analysisPanel: document.getElementById('analysisPanel'),
  playPanel: document.getElementById('playPanel'),
  puzzlePanel: document.getElementById('puzzlePanel'),
  puzzleBoardInstruction: document.getElementById('puzzleBoardInstruction'),
  promotionModal: document.getElementById('promotionModal'),
  promotionSubtitle: document.getElementById('promotionSubtitle'),
  promotionChoices: document.getElementById('promotionChoices'),
  gameResultModal: document.getElementById('gameResultModal'),
  gameResultMessage: document.getElementById('gameResultMessage'),
  puzzleResultModal: document.getElementById('puzzleResultModal'),
  puzzleResultTitle: document.getElementById('puzzleResultTitle'),
  puzzleResultMessage: document.getElementById('puzzleResultMessage'),
  puzzleResultActions: document.getElementById('puzzleResultActions'),
  premiumModal: document.getElementById('premiumModal'),
  premiumKeyInput: document.getElementById('premiumKeyInput'),
  premiumModalStatus: document.getElementById('premiumModalStatus'),
  pgnGamePickerModal: document.getElementById('pgnGamePickerModal'),
  pgnGamePickerList: document.getElementById('pgnGamePickerList'),
  pgnGamePickerFileName: document.getElementById('pgnGamePickerFileName'),
  importedPgnContainer: document.getElementById('importedPgnContainer'),
  importedPgnFileNameText: document.getElementById('importedPgnFileNameText'),
  importedPgnStatusText: document.getElementById('importedPgnStatusText'),
  openingInfoDisplay: document.getElementById('openingInfoDisplay'),
  openingEcoText: document.getElementById('openingEcoText'),
  openingNameText: document.getElementById('openingNameText'),
  importedPgnFileNameWrapper: document.getElementById('importedPgnFileNameWrapper'),
};

const state = {
  title: DEFAULT_TITLE,
  colorTheme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  focusMode: false,
  embedMode: false,
  boardOnlyMode: false,
  boardOnlySetupVisible: false,
  boardOnlyTeacherSetupActive: false,
  boardOnlyInitialFen: DEFAULT_POSITION,
  boardOrientation: 'white',
  activeTab: TAB_PLAY,
  previousNonLessonTab: TAB_PLAY,
  pgnCommentsExpanded: false,
  lessonBook: {
    activeLessonId: '',
    nextId: 1,
    lessons: [],
  },
  setup: {
    pieces: {},
    meta: { ...DEFAULT_META },
    fenInput: DEFAULT_POSITION,
    fenError: '',
    scanStatus: '',
    scanStatusType: '',
    paletteColor: 'w',
    armedPiece: null,
    advancedOpen: false,
  },
  setupFen: DEFAULT_POSITION,
  analysis: {
    game: null,
    currentFen: DEFAULT_POSITION,
    rootId: ROOT_NODE_ID,
    currentNodeId: ROOT_NODE_ID,
    nodeCounter: 1,
    nodes: {},
    selectedSquare: null,
    legalMoves: [],
    lastMoveSquares: [],
    boardMessage: 'Open Analysis to play legal moves from this setup.',
    pendingPromotion: null,
    headers: null,
  },
  note: {
    text: '',
    expanded: false,
  },
  practicePreferenceKind: PRACTICE_KIND_LINE,
  analysisTargetDepth: DEFAULT_ANALYSIS_TARGET_DEPTH,
  practice: createEmptyPracticeState(),
  pgnCommentsVisible: true,
  lastMoveArrowVisible: true,
  toolsExpanded: true,
  guidedReview: {
    active: false,
  },
  pvLinesVisible: true,
  lessonFileStatus: '',
  boardLayoutFrame: 0,
  engine: {
    worker: null,
    workerGeneration: 0,
    ready: false,
    loading: false,
    analyzing: false,
    stopping: false,
    bundleId: '',
    bundleLabel: '',
    bundlePath: '',
    loadingPromise: null,
    readyTimer: null,
    resolveReady: null,
    rejectReady: null,
    searchFen: '',
    pendingFen: '',
    requestId: 0,
    loadingRequestId: 0,
    resumeFen: '',
    resumeEligible: false,
    resumeDepth: null,
    summary: 'Select Analyze to load Stockfish for this board.',
    pvLines: createEmptyEnginePvLines(),
    depth: null,
    nodes: 0,
    nps: 0,
    scoreType: '',
    scoreValue: null,
    evalLabel: '0.00',
    bestMove: '',
    searchMode: '',
    pendingSearchMode: '',
    searchTargetDepth: null,
    summaryPrefix: '',
    evalRailVisible: false,
  },
  tablebase: {
    probing: false,
    requestId: 0,
    fen: '',
    result: null,
    error: '',
    abortController: null,
    cache: new Map(),
  },
  annotations: {
    enabled: false,
    paintedSquares: new Set(),
    circledSquares: new Set(),
    starredSquares: new Set(),
    arrows: [],
    gesture: createEmptyAnnotationGestureState(),
    suppressBoardClickUntil: 0,
    suppressContextMenu: false,
  },
  persistTimer: null,
  boardDragHoverSquare: null,
  setupDrag: createEmptySetupDragState(),
  play: {
    active: false,
    skill: 1000,
    timeControl: 'none',
    side: 'white',
    assignedSide: 'white',
    startPosition: 'current',
    clockRunning: false,
    whiteTime: 0,
    blackTime: 0,
    whiteInc: 0,
    blackInc: 0,
    lastClockTick: 0,
    timerId: null,
    engineThinking: false,
    playSessionId: 0,
    activeEngineSessionId: null,
    playEngineWatchdog: null,
    playEngineRetryCount: 0,
    thinkingSpeed: 'normal',
    autoHiddenPgnComments: false,
    autoHiddenPvLines: false,
  },
  puzzle: {
    premium: true,
    premiumKey: '',
    freeDate: '',
    freeUsed: 0,
    generating: false,
    generatingAttempt: 0,
    generatingMaxAttempts: 0,
    sessionActive: false,
    current: null,
    startBalance: 0,
    pendingResult: null,
    lastResult: null,
    objectivePreference: 'random',
    difficultyPreference: 'any',
    skill: 2400,
    thinkingSpeed: 'fast',
    solvedCount: 0,
    failedCount: 0,
    streak: 0,
    bestStreak: 0,
    savedPlaySettings: null,
    apiError: '',
    puzzleQueue: [],
    puzzleHistory: [],
    historyCursor: 0,
    isGeneratingPuzzleBatch: false,
    puzzleBatchStatus: '',
  },
  pendingPgnGames: null,
  pendingPgnFileName: '',
  loadedPgnGameIndex: null,
  openingBook: {
    loaded: false,
    loading: false,
    failed: false,
    rows: [],
    byUci: new Map(),
    byEpd: new Map()
  },
};

let guidedReviewController = null;
let setupDragPreviewEl = null;

function isFenInsufficientMaterialDraw(fen) {
  try {
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');
    const nonKingPieces = [];

    for (let r = 0; r < 8; r++) {
      const row = rows[r] || '';
      let f = 0;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (/[1-8]/.test(char)) {
          f += parseInt(char, 10);
        } else {
          const upper = char.toUpperCase();
          if (upper === 'P' || upper === 'R' || upper === 'Q') {
            return false;
          }
          if (upper !== 'K') {
            nonKingPieces.push({
              type: upper,
              squareColor: (r + f) % 2,
            });
          }
          f++;
        }
      }
    }

    if (nonKingPieces.length === 0) {
      return true; // King vs King
    }
    if (nonKingPieces.length === 1) {
      if (nonKingPieces[0].type === 'B' || nonKingPieces[0].type === 'N') {
        return true; // KB vs K or KN vs K
      }
    }
    if (nonKingPieces.length > 1) {
      if (nonKingPieces.every(p => p.type === 'B')) {
        const firstColor = nonKingPieces[0].squareColor;
        if (nonKingPieces.every(p => p.squareColor === firstColor)) {
          return true; // Bishops on same color squares
        }
      }
    }
    return false;
  } catch (e) {
    console.error('Error checking insufficient material draw from FEN:', e);
    return false;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function remToPx(rem) {
  return rem * Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || '16');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNodeUciMove(node) {
  if (!node || !node.from || !node.to) return '';
  return node.from + node.to + (node.promotion || '');
}

function normalizeEpdString(epd) {
  if (!epd) return '';
  const parts = epd.trim().split(/\s+/);
  const first4 = parts.slice(0, 4);
  return first4.join(' ').toLowerCase();
}

function parseOpeningRows(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  const headerLine = lines[0];
  const headers = headerLine.split('\t').map(h => h.trim().toLowerCase());
  
  const ecoIdx = headers.indexOf('eco');
  const nameIdx = headers.indexOf('name');
  const pgnIdx = headers.indexOf('pgn');
  const uciIdx = headers.indexOf('uci');
  const epdIdx = headers.indexOf('epd');
  
  if (ecoIdx === -1 || nameIdx === -1 || pgnIdx === -1 || uciIdx === -1 || epdIdx === -1) {
    console.warn("TSV header is missing one of the required columns:", headers);
    return [];
  }
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = lines[i].split('\t');
    if (cols.length < headers.length) {
      continue;
    }
    const eco = cols[ecoIdx]?.trim() || '';
    const name = cols[nameIdx]?.trim() || '';
    const pgn = cols[pgnIdx]?.trim() || '';
    const uci = cols[uciIdx]?.trim() || '';
    const epd = cols[epdIdx]?.trim() || '';
    
    if (!eco || !name || !uci) {
      continue;
    }
    
    const normalizedUci = uci.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedEpd = epd ? normalizeEpdString(epd) : '';
    
    rows.push({
      eco,
      name,
      pgn,
      uci: normalizedUci,
      epd: normalizedEpd
    });
  }
  return rows;
}

function buildUciIndex(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.uci) {
      map.set(row.uci, row);
    }
  }
  return map;
}

function buildEpdIndex(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.epd) {
      const existing = map.get(row.epd);
      if (!existing || row.uci.split(' ').length > existing.uci.split(' ').length) {
        map.set(row.epd, row);
      }
    }
  }
  return map;
}

async function loadOpeningBook() {
  try {
    state.openingBook.loading = true;
    syncOpeningInfoDisplay();
    
    const response = await fetch("./assets/openings.tsv");
    if (!response.ok) throw new Error("Opening book not found");
    const text = await response.text();
    const rows = parseOpeningRows(text);

    state.openingBook.rows = rows;
    state.openingBook.byUci = buildUciIndex(rows);
    state.openingBook.byEpd = buildEpdIndex(rows);
    state.openingBook.loaded = true;
    state.openingBook.failed = false;
  } catch (error) {
    console.warn("Opening book unavailable:", error);
    state.openingBook.loaded = false;
    state.openingBook.failed = true;
    state.openingBook.rows = [];
  } finally {
    state.openingBook.loading = false;
    syncOpeningInfoDisplay();
  }
}

function getGameMovesAndEpds() {
  const pathNodes = getAnalysisPathNodes();
  const uciMoves = [];
  const epds = [];
  
  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i];
    if (i > 0) {
      const uci = getNodeUciMove(node);
      if (uci) uciMoves.push(uci);
    }
    if (node.fen) {
      epds.push(node.fen);
    }
  }
  
  return {
    uciMoves,
    epds
  };
}

function identifyOpeningFromMoves(uciMoves, epds) {
  if (!state.openingBook.loaded) return null;
  if (!uciMoves || uciMoves.length === 0) return null;
  
  // 1. UCI longest-prefix match
  const moves = [...uciMoves];
  while (moves.length > 0) {
    const path = moves.join(' ').toLowerCase();
    const match = state.openingBook.byUci.get(path);
    if (match) {
      return match;
    }
    moves.pop();
  }
  
  // 2. Fall back to EPD matching
  if (epds && epds.length > 0 && state.openingBook.byEpd && state.openingBook.byEpd.size > 0) {
    for (let i = epds.length - 1; i >= 0; i--) {
      const epd = normalizeEpdString(epds[i]);
      if (epd) {
        const match = state.openingBook.byEpd.get(epd);
        if (match) {
          return match;
        }
      }
    }
  }
  
  return null;
}

function selectBestOpening(dbMatch, headers) {
  const headerEco = (headers?.ECO && headers.ECO.trim()) || '';
  const headerOpening = (headers?.Opening && headers.Opening.trim()) || '';
  const headerVariation = (headers?.Variation && headers.Variation.trim()) || '';
  
  let headerName = headerOpening;
  if (headerName && headerVariation) {
    headerName += `: ${headerVariation}`;
  }
  
  if (dbMatch) {
    if (headerName && !dbMatch.name.toLowerCase().includes(headerOpening.toLowerCase()) && headerOpening.toLowerCase().includes(dbMatch.name.toLowerCase())) {
      return { eco: headerEco || dbMatch.eco, name: headerName };
    }
    return dbMatch;
  } else {
    if (headerName || headerEco) {
      return { eco: headerEco, name: headerName || 'Unclassified' };
    }
    return null;
  }
}

function syncOpeningInfoDisplay() {
  if (!dom.openingInfoDisplay) return;
  
  if (state.openingBook.loading) {
    if (dom.openingEcoText) {
      dom.openingEcoText.textContent = '';
      dom.openingEcoText.style.display = 'none';
    }
    if (dom.openingNameText) {
      dom.openingNameText.textContent = 'Opening book loading...';
      dom.openingNameText.title = 'Opening book loading...';
    }
    dom.openingInfoDisplay.title = 'Opening book loading...';
    dom.openingInfoDisplay.hidden = false;
    dom.openingInfoDisplay.setAttribute('aria-hidden', 'false');
    return;
  }
  
  const headers = state.analysis.headers;
  const isPgnLoaded = !!headers;
  
  if (!isPgnLoaded) {
    dom.openingInfoDisplay.hidden = true;
    dom.openingInfoDisplay.setAttribute('aria-hidden', 'true');
    return;
  }
  
  const { uciMoves, epds } = getGameMovesAndEpds();
  const dbMatch = identifyOpeningFromMoves(uciMoves, epds);
  const bestOpening = selectBestOpening(dbMatch, headers);
  
  if (bestOpening && bestOpening.name !== 'Unclassified') {
    const eco = bestOpening.eco || '';
    const name = bestOpening.name || '';
    
    if (dom.openingEcoText) {
      dom.openingEcoText.textContent = eco;
      dom.openingEcoText.style.display = eco ? 'inline-block' : 'none';
    }
    
    if (dom.openingNameText) {
      dom.openingNameText.textContent = name;
      dom.openingNameText.title = eco ? `${eco}: ${name}` : name;
    }
    
    dom.openingInfoDisplay.title = eco ? `${eco}: ${name}` : name;
    dom.openingInfoDisplay.hidden = false;
    dom.openingInfoDisplay.setAttribute('aria-hidden', 'false');
  } else {
    if (dom.openingEcoText) {
      dom.openingEcoText.textContent = '';
      dom.openingEcoText.style.display = 'none';
    }
    if (dom.openingNameText) {
      dom.openingNameText.textContent = 'Unclassified';
      dom.openingNameText.title = 'Unclassified';
    }
    dom.openingInfoDisplay.title = 'Unclassified';
    dom.openingInfoDisplay.hidden = false;
    dom.openingInfoDisplay.setAttribute('aria-hidden', 'false');
  }
}

function normalizeTextControlValue(control) {
  const originalValue = String(control?.value ?? '');
  const normalizedValue = normalizeEditableText(originalValue);
  if (!control || normalizedValue === originalValue) {
    return normalizedValue;
  }

  const selectionStart = control.selectionStart;
  const selectionEnd = control.selectionEnd;
  control.value = normalizedValue;
  if (
    document.activeElement === control
    && typeof control.setSelectionRange === 'function'
    && Number.isInteger(selectionStart)
    && Number.isInteger(selectionEnd)
  ) {
    const nextStart = Math.min(selectionStart, normalizedValue.length);
    const nextEnd = Math.min(selectionEnd, normalizedValue.length);
    control.setSelectionRange(nextStart, nextEnd);
  }
  return normalizedValue;
}

function cloneMeta(meta) {
  return {
    activeColor: meta.activeColor,
    castling: meta.castling,
    enPassant: meta.enPassant,
    halfmove: meta.halfmove,
    fullmove: meta.fullmove,
  };
}

function createEmptyAnnotationGestureState() {
  return {
    active: false,
    button: null,
    mode: '',
    startSquare: '',
    lastSquare: '',
    dragged: false,
  };
}

function createEmptyEnginePvLine(index) {
  return {
    index,
    line: '',
    uciMoves: [],
    depth: null,
    scoreType: '',
    scoreValue: null,
    evalLabel: '',
  };
}

function createEmptyEnginePvLines() {
  return Array.from({ length: ENGINE_MULTI_PV_COUNT }, (_, index) => createEmptyEnginePvLine(index + 1));
}

function createEmptyPracticeState() {
  return {
    active: false,
    kind: PRACTICE_KIND_LINE,
    branchRootNodeId: ROOT_NODE_ID,
    lineNodeIds: [],
    positionIndex: 0,
    correctCount: 0,
    incorrectCount: 0,
    revealedCount: 0,
    feedback: '',
    feedbackKind: 'warning',
  };
}

function createEmptySetupDragState() {
  return {
    active: false,
    source: '',
    piece: '',
    fromSquare: '',
    droppedOnBoard: false,
  };
}

function normalizePracticeKind(value) {
  return value === PRACTICE_KIND_BRANCH ? PRACTICE_KIND_BRANCH : PRACTICE_KIND_LINE;
}

function normalizeAnalysisTargetDepth(value) {
  const numeric = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_ANALYSIS_TARGET_DEPTH;
  }
  return clamp(Math.trunc(numeric), ANALYSIS_TARGET_DEPTH_MIN, ANALYSIS_TARGET_DEPTH_MAX);
}

function currentAnalysisTargetDepth() {
  return normalizeAnalysisTargetDepth(state.analysisTargetDepth);
}

function normalizeFenForTablebase(fen) {
  const normalized = String(fen ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }
  try {
    return new Chess(normalized).fen();
  } catch {
    return normalized;
  }
}

function tablebaseEligibilityForFen(fen) {
  const normalizedFen = normalizeFenForTablebase(fen);
  if (!validateFen(normalizedFen).ok) {
    return { eligible: false, reason: 'invalid-fen', fen: normalizedFen };
  }
  const parsed = parseFenLike(normalizedFen);
  if (!parsed.ok) {
    return { eligible: false, reason: 'invalid-fen', fen: normalizedFen };
  }
  if (parsed.meta.castling !== '-') {
    return { eligible: false, reason: 'castling-rights', fen: normalizedFen };
  }

  let whitePieces = 0;
  let blackPieces = 0;
  let whiteKings = 0;
  let blackKings = 0;
  Object.values(parsed.pieces).forEach((piece) => {
    if (piece === piece.toUpperCase()) {
      whitePieces += 1;
    } else {
      blackPieces += 1;
    }
    if (piece === 'K') {
      whiteKings += 1;
    } else if (piece === 'k') {
      blackKings += 1;
    }
  });

  const totalPieces = whitePieces + blackPieces;
  if (whiteKings !== 1 || blackKings !== 1) {
    return { eligible: false, reason: 'king-count', fen: normalizedFen };
  }
  if (
    totalPieces > TABLEBASE_MAX_TOTAL_PIECES
    || whitePieces > TABLEBASE_MAX_PIECES_PER_SIDE
    || blackPieces > TABLEBASE_MAX_PIECES_PER_SIDE
  ) {
    return { eligible: false, reason: 'piece-count', fen: normalizedFen };
  }

  return {
    eligible: true,
    fen: normalizedFen,
    whitePieces,
    blackPieces,
    totalPieces,
  };
}

function isTablebaseEligibleFen(fen) {
  return tablebaseEligibilityForFen(fen).eligible;
}

function tablebaseResultActive() {
  return Boolean(
    currentTablebaseResultForDisplay()
    && !state.tablebase.probing,
  );
}

function currentTablebaseResultForDisplay() {
  return (
    state.tablebase.result
    && state.tablebase.result.fen
    && state.tablebase.result.fen === state.analysis.currentFen
  ) ? state.tablebase.result : null;
}

function tablebaseDisplayActive() {
  return Boolean(currentTablebaseResultForDisplay() || (state.tablebase.probing && !hasVisibleEnginePvLines()));
}

function abortTablebaseProbe() {
  if (state.tablebase.abortController) {
    state.tablebase.abortController.abort();
    state.tablebase.abortController = null;
  }
}

function clearTablebaseDisplay(options = {}) {
  const { cancelProbe = true } = options;
  if (cancelProbe) {
    state.tablebase.requestId += 1;
    abortTablebaseProbe();
  }
  state.tablebase.probing = false;
  state.tablebase.fen = '';
  state.tablebase.result = null;
  state.tablebase.error = '';
}

function tablebaseQueryUrl(fen) {
  const queryFen = normalizeFenForTablebase(fen).replace(/\s+/g, '_');
  return `${TABLEBASE_ENDPOINT}?fen=${encodeURIComponent(queryFen)}`;
}

function isTablebaseWinCategory(category) {
  return category === 'win'
    || category === 'syzygy-win'
    || category === 'maybe-win'
    || category === 'cursed-win';
}

function isTablebaseLossCategory(category) {
  return category === 'loss'
    || category === 'syzygy-loss'
    || category === 'maybe-loss'
    || category === 'blessed-loss';
}

function tablebaseWhiteOutcomeForCategory(category, sideToMove) {
  const normalized = String(category || '').trim().toLowerCase();
  if (isTablebaseWinCategory(normalized)) {
    return sideToMove === 'b' ? 'black' : 'white';
  }
  if (isTablebaseLossCategory(normalized)) {
    return sideToMove === 'b' ? 'white' : 'black';
  }
  if (normalized === 'draw') {
    return 'draw';
  }
  return 'unknown';
}

function tablebaseEvalLabelForOutcome(outcome) {
  if (outcome === 'white') {
    return 'TB +';
  }
  if (outcome === 'black') {
    return 'TB -';
  }
  if (outcome === 'draw') {
    return 'TB =';
  }
  return 'TB ?';
}

function tablebaseResultLabelForOutcome(outcome) {
  if (outcome === 'white') {
    return 'White win';
  }
  if (outcome === 'black') {
    return 'Black win';
  }
  if (outcome === 'draw') {
    return 'Draw';
  }
  return 'Unknown';
}

function tablebaseWhiteFractionForOutcome(outcome) {
  if (outcome === 'white') {
    return 0.98;
  }
  if (outcome === 'black') {
    return 0.02;
  }
  return 0.5;
}

function formatTablebaseCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (!normalized) {
    return 'Unknown';
  }
  return normalized
    .split('-')
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '')
    .join(' ');
}

function normalizeTablebaseMetric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function formatTablebaseMetric(value) {
  const normalized = normalizeTablebaseMetric(value);
  return Number.isFinite(normalized) ? String(normalized) : '—';
}

function normalizeUciMove(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized) ? normalized : '';
}

function moveToUci(move) {
  if (!move?.from || !move?.to) {
    return '';
  }
  const promotion = normalizePromotionValue(move.promotion);
  return normalizeUciMove(`${move.from}${move.to}${promotion || ''}`);
}

function moveMatchesUci(move, uci) {
  return Boolean(moveToUci(move) && moveToUci(move) === normalizeUciMove(uci));
}

function formatUciMoveLine(fen, uciMoves) {
  const normalizedMoves = Array.isArray(uciMoves)
    ? uciMoves.map(normalizeUciMove).filter(Boolean)
    : [];
  if (!normalizedMoves.length) {
    return '';
  }
  return formatTablebaseSanLine(fen, uciMovesToSan(fen, normalizedMoves));
}

function tablebaseUciMoveObject(uci) {
  const normalized = normalizeUciMove(uci);
  if (!normalized) {
    return null;
  }
  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    promotion: normalized[4] || undefined,
  };
}

function formatTablebaseSanLine(fen, sanMoves) {
  const parsed = parseFenLike(fen);
  if (!parsed.ok || !Array.isArray(sanMoves) || !sanMoves.length) {
    return '';
  }

  let sideToMove = parsed.meta.activeColor;
  let moveNumber = parsed.meta.fullmove;
  const tokens = [];
  sanMoves.forEach((san, index) => {
    if (sideToMove === 'w') {
      tokens.push(`${moveNumber}. ${san}`);
      sideToMove = 'b';
      return;
    }
    tokens.push(index === 0 ? `${moveNumber}... ${san}` : san);
    sideToMove = 'w';
    moveNumber += 1;
  });
  return tokens.join(' ');
}

function nextTablebaseLineMove(payload) {
  if (!payload || !Array.isArray(payload.moves)) {
    return null;
  }
  return payload.moves.find((move) => tablebaseUciMoveObject(move?.uci)) || null;
}

function tablebaseLineTargetPlies(move, rootResult) {
  const candidate = Math.abs(normalizeTablebaseMetric(move?.dtm) ?? normalizeTablebaseMetric(rootResult?.dtm) ?? 0) + 1;
  if (!Number.isFinite(candidate) || candidate <= 1) {
    return 1;
  }
  return clamp(candidate, 1, TABLEBASE_LINE_MAX_PLIES);
}

async function fetchTablebasePayloadWithBudget(fen, signal, budget) {
  const normalizedFen = normalizeFenForTablebase(fen);
  if (!state.tablebase.cache.has(normalizedFen)) {
    if (budget.remaining <= 0) {
      throw new Error('Tablebase line request budget exhausted.');
    }
    budget.remaining -= 1;
  }
  return fetchTablebasePayload(normalizedFen, signal);
}

async function buildTablebaseMoveLine(rootFen, rootResult, move, signal, budget) {
  const firstMove = tablebaseUciMoveObject(move.uci);
  if (!firstMove) {
    return { line: '', uciMoves: [] };
  }

  const game = new Chess(rootFen);
  const sanMoves = [];
  const uciMoves = [];
  let truncated = false;
  try {
    const applied = game.move(firstMove);
    sanMoves.push(applied.san);
    uciMoves.push(normalizeUciMove(move.uci));
    if (game.isGameOver() || move.outcome === 'draw') {
      return {
        line: formatTablebaseSanLine(rootFen, sanMoves),
        uciMoves,
      };
    }

    const targetPlies = tablebaseLineTargetPlies(move, rootResult);
    while (sanMoves.length < targetPlies && !game.isGameOver()) {
      const currentFen = game.fen();
      if (!isTablebaseEligibleFen(currentFen)) {
        break;
      }
      let payload = null;
      try {
        payload = await fetchTablebasePayloadWithBudget(currentFen, signal, budget);
      } catch {
        truncated = true;
        break;
      }
      const reply = nextTablebaseLineMove(payload);
      const replyMove = tablebaseUciMoveObject(reply?.uci);
      if (!replyMove) {
        break;
      }
      const replyApplied = game.move(replyMove);
      sanMoves.push(replyApplied.san);
      uciMoves.push(normalizeUciMove(reply.uci));
    }
  } catch {
    const fallbackUci = normalizeUciMove(move.uci);
    return {
      line: move.san || fallbackUci,
      uciMoves: fallbackUci ? [fallbackUci] : [],
    };
  }

  const line = formatTablebaseSanLine(rootFen, sanMoves);
  return {
    line: truncated && line ? `${line} ...` : line,
    uciMoves,
  };
}

async function hydrateTablebaseMoveLines(rootFen, result, signal) {
  const budget = { remaining: TABLEBASE_LINE_MAX_REQUESTS };
  for (const move of result.moves) {
    const lineResult = await buildTablebaseMoveLine(rootFen, result, move, signal, budget);
    move.line = lineResult.line;
    move.uciMoves = lineResult.uciMoves;
  }
}

function normalizeTablebaseMove(move, index, fen, nextSideToMove) {
  const category = String(move?.category || '').trim().toLowerCase();
  const outcome = tablebaseWhiteOutcomeForCategory(category, nextSideToMove);
  const uci = String(move?.uci || '').trim();
  const san = String(move?.san || '').trim() || (uci ? (uciMovesToSan(fen, [uci])[0] || uci) : '');
  return {
    index: index + 1,
    uci,
    san,
    category,
    categoryLabel: formatTablebaseCategory(category),
    outcome,
    resultLabel: tablebaseResultLabelForOutcome(outcome),
    evalLabel: tablebaseEvalLabelForOutcome(outcome),
    dtm: normalizeTablebaseMetric(move?.dtm),
    dtz: normalizeTablebaseMetric(move?.precise_dtz ?? move?.dtz),
    line: san,
    uciMoves: uci ? [normalizeUciMove(uci)].filter(Boolean) : [],
  };
}

function normalizeTablebasePayload(fen, payload) {
  const parsed = parseFenLike(fen);
  if (!parsed.ok || !payload || typeof payload !== 'object' || !Array.isArray(payload.moves)) {
    throw new Error('Tablebase returned an unexpected response.');
  }

  const category = String(payload.category || '').trim().toLowerCase();
  if (!category || category === 'unknown') {
    throw new Error('Tablebase did not solve this position.');
  }

  const outcome = tablebaseWhiteOutcomeForCategory(category, parsed.meta.activeColor);
  const nextSideToMove = parsed.meta.activeColor === 'b' ? 'w' : 'b';
  const result = {
    fen,
    category,
    categoryLabel: formatTablebaseCategory(category),
    outcome,
    resultLabel: tablebaseResultLabelForOutcome(outcome),
    evalLabel: tablebaseEvalLabelForOutcome(outcome),
    whiteFraction: tablebaseWhiteFractionForOutcome(outcome),
    dtm: normalizeTablebaseMetric(payload.dtm),
    dtz: normalizeTablebaseMetric(payload.precise_dtz ?? payload.dtz),
    moves: payload.moves
      .slice(0, ENGINE_MULTI_PV_COUNT)
      .map((move, index) => normalizeTablebaseMove(move, index, fen, nextSideToMove)),
  };
  result.summary = `Tablebase solved: ${result.resultLabel} (${result.categoryLabel}). DTM ${formatTablebaseMetric(result.dtm)}, DTZ ${formatTablebaseMetric(result.dtz)}.`;
  return result;
}

function currentEvalDisplay() {
  const tablebaseResult = currentTablebaseResultForDisplay();
  if (tablebaseResult) {
    return {
      label: tablebaseResult.evalLabel,
      whiteFraction: tablebaseResult.whiteFraction,
    };
  }
  return {
    label: state.engine.evalLabel || '0.00',
    whiteFraction: Number.isFinite(state.engine.scoreValue)
      ? scoreToWhiteFraction(state.engine.scoreType, state.engine.scoreValue)
      : 0.5,
  };
}

async function fetchTablebasePayload(fen, signal) {
  const normalizedFen = normalizeFenForTablebase(fen);
  if (state.tablebase.cache.has(normalizedFen)) {
    return state.tablebase.cache.get(normalizedFen);
  }
  const response = await window.fetch(tablebaseQueryUrl(normalizedFen), {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  if (response.status === 429) {
    throw new Error('Lichess tablebase rate limit reached.');
  }
  if (!response.ok) {
    throw new Error(`Tablebase lookup failed (${response.status}).`);
  }
  const payload = await response.json();
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.moves)) {
    throw new Error('Tablebase returned an unexpected response.');
  }
  state.tablebase.cache.set(normalizedFen, payload);
  return payload;
}

function paddedEnginePvLines(lines) {
  const normalized = lines.slice(0, ENGINE_MULTI_PV_COUNT).map((line, index) => ({
    ...line,
    index: index + 1,
  }));
  while (normalized.length < ENGINE_MULTI_PV_COUNT) {
    normalized.push(createEmptyEnginePvLine(normalized.length + 1));
  }
  return normalized;
}

function createFollowedEnginePvLines(move, nextFen) {
  const followedLines = state.engine.pvLines
    .filter((entry) => entry?.uciMoves?.length && moveMatchesUci(move, entry.uciMoves[0]))
    .map((entry) => {
      const remainingUciMoves = entry.uciMoves.slice(1).map(normalizeUciMove).filter(Boolean);
      const line = formatUciMoveLine(nextFen, remainingUciMoves) || 'Line reached.';
      return {
        ...entry,
        line,
        uciMoves: remainingUciMoves,
      };
    });
  return followedLines.length ? paddedEnginePvLines(followedLines) : null;
}

function createFollowedTablebaseResult(move, nextFen) {
  const currentResult = currentTablebaseResultForDisplay();
  if (!currentResult?.moves?.length) {
    return null;
  }
  const matchingMoves = currentResult.moves.filter((entry) => moveMatchesUci(move, entry.uci));
  if (!matchingMoves.length) {
    return null;
  }

  const normalizedNextFen = normalizeFenForTablebase(nextFen);
  const moves = matchingMoves.map((entry, index) => {
    const remainingUciMoves = Array.isArray(entry.uciMoves)
      ? entry.uciMoves.slice(1).map(normalizeUciMove).filter(Boolean)
      : [];
    return {
      ...entry,
      index: index + 1,
      uci: remainingUciMoves[0] || '',
      san: remainingUciMoves[0] ? (uciMovesToSan(normalizedNextFen, [remainingUciMoves[0]])[0] || remainingUciMoves[0]) : '',
      line: formatUciMoveLine(normalizedNextFen, remainingUciMoves) || 'Line reached.',
      uciMoves: remainingUciMoves,
    };
  });

  const followedResult = {
    ...currentResult,
    fen: normalizedNextFen,
    dtm: normalizeTablebaseMetric(matchingMoves[0]?.dtm),
    dtz: normalizeTablebaseMetric(matchingMoves[0]?.dtz),
    moves,
  };
  followedResult.summary = `Following tablebase line: ${followedResult.resultLabel}. Analyze to refresh exact DTM and DTZ.`;
  return followedResult;
}

function createFollowedAnalysisDisplay(move, nextFen) {
  const tablebaseResult = createFollowedTablebaseResult(move, nextFen);
  if (tablebaseResult) {
    return {
      source: 'tablebase',
      result: tablebaseResult,
    };
  }

  const enginePvLines = createFollowedEnginePvLines(move, nextFen);
  if (enginePvLines) {
    return {
      source: 'engine',
      pvLines: enginePvLines,
    };
  }

  return null;
}

function applyFollowedAnalysisDisplay(followedDisplay) {
  if (!followedDisplay) {
    return;
  }
  if (followedDisplay.source === 'tablebase') {
    clearEngineContinuationState();
    state.tablebase.probing = false;
    state.tablebase.abortController = null;
    state.tablebase.fen = followedDisplay.result.fen;
    state.tablebase.result = followedDisplay.result;
    state.tablebase.error = '';
    clearEngineSearchData();
    state.engine.summary = followedDisplay.result.summary;
    return;
  }
  if (followedDisplay.source === 'engine') {
    clearTablebaseDisplay();
    clearEngineContinuationState();
    state.engine.pvLines = followedDisplay.pvLines;
    state.engine.summary = 'Following displayed PV. Analyze to refresh this position.';
  }
}

function stopAnalysisWorkForFollowedDisplay() {
  state.engine.requestId += 1;
  if (state.engine.worker && state.engine.searchFen) {
    state.engine.worker.postMessage('stop');
  }
  state.engine.loading = false;
  state.engine.analyzing = false;
  state.engine.stopping = false;
  state.engine.searchFen = '';
  state.engine.pendingFen = '';
  state.engine.searchMode = '';
  state.engine.pendingSearchMode = '';
  state.engine.searchTargetDepth = null;
  state.engine.summaryPrefix = '';
  state.engine.bestMove = '';
  state.engine.evalRailVisible = true;
  clearEngineContinuationState();
  state.tablebase.requestId += 1;
  abortTablebaseProbe();
  state.tablebase.probing = false;
}

function clearEngineContinuationState() {
  state.engine.resumeFen = '';
  state.engine.resumeEligible = false;
  state.engine.resumeDepth = null;
}

function hasAnalysisContinuationAvailable() {
  return Boolean(
    state.engine.resumeEligible
    && state.engine.resumeFen
    && state.engine.resumeFen === state.analysis.currentFen,
  );
}

function clearEngineSearchData(options = {}) {
  const { preserveEval = false, preservePv = false } = options;
  if (!preservePv) {
    state.engine.pvLines = createEmptyEnginePvLines();
  }
  state.engine.depth = null;
  state.engine.nodes = 0;
  state.engine.nps = 0;
  state.engine.searchTargetDepth = null;
  if (!preserveEval) {
    state.engine.scoreType = '';
    state.engine.scoreValue = null;
    state.engine.evalLabel = '0.00';
  }
  state.engine.bestMove = '';
}

function withEngineSummaryPrefix(summary) {
  return state.engine.summaryPrefix ? `${state.engine.summaryPrefix} ${summary}` : summary;
}

function postEngineSearchCommands(worker, fen, options = {}) {
  const {
    freshGame = true,
    searchMode = ENGINE_SEARCH_MODE_CHECKPOINT,
    targetDepth = currentAnalysisTargetDepth(),
  } = options;
  worker.postMessage(`setoption name MultiPV value ${ENGINE_MULTI_PV_COUNT}`);
  worker.postMessage('setoption name Skill Level value 20');
  worker.postMessage('setoption name UCI_LimitStrength value false');
  if (freshGame) {
    worker.postMessage('ucinewgame');
  }
  worker.postMessage(`position fen ${fen}`);
  if (searchMode === ENGINE_SEARCH_MODE_CONTINUE) {
    worker.postMessage('go infinite');
    return;
  }
  worker.postMessage(`go depth ${normalizeAnalysisTargetDepth(targetDepth)}`);
}

function startEngineSearch(worker, fen, options = {}) {
  const {
    preserveDisplay = false,
    freshGame = true,
    summary = 'Analyzing current board position...',
    summaryPrefix = '',
    searchMode = ENGINE_SEARCH_MODE_CHECKPOINT,
    targetDepth = null,
  } = options;
  clearTablebaseDisplay();
  if (!preserveDisplay) {
    clearEngineSearchData({ preservePv: true });
  }
  state.engine.pendingFen = '';
  state.engine.pendingSearchMode = '';
  clearEngineContinuationState();
  state.engine.searchFen = fen;
  state.engine.analyzing = true;
  state.engine.stopping = false;
  state.engine.searchMode = searchMode;
  state.engine.searchTargetDepth = searchMode === ENGINE_SEARCH_MODE_CHECKPOINT
    ? normalizeAnalysisTargetDepth(targetDepth)
    : (Number.isFinite(targetDepth) ? Math.trunc(targetDepth) : null);
  state.engine.summaryPrefix = summaryPrefix;
  state.engine.summary = summary;
  renderNotationPanel();
  renderAnalysisPanel();
  renderBoard();
  renderHeaderMeta();
  postEngineSearchCommands(worker, fen, {
    freshGame,
    searchMode,
    targetDepth: state.engine.searchTargetDepth,
  });
}

function queueEngineSearchForFen(fen, options = {}) {
  const { preserveDisplay = false } = options;
  if (!fen || state.engine.stopping) {
    return;
  }
  const canQueueActiveSearch = Boolean(state.engine.worker && state.engine.ready && state.engine.analyzing);
  const canQueueLoadingSearch = Boolean(state.engine.loading);
  if (!canQueueActiveSearch && !canQueueLoadingSearch) {
    return;
  }
  clearTablebaseDisplay();
  state.engine.pendingFen = fen;
  state.engine.pendingSearchMode = state.engine.searchMode || ENGINE_SEARCH_MODE_CHECKPOINT;
  if (canQueueActiveSearch) {
    state.engine.searchFen = '';
  }
  clearEngineContinuationState();
  if (!preserveDisplay) {
    clearEngineSearchData({ preserveEval: true, preservePv: true });
  }
  state.engine.summary = state.engine.pendingSearchMode === ENGINE_SEARCH_MODE_CONTINUE
    ? 'Continuing analysis from the current board position...'
    : `Analyzing current board position toward depth ${currentAnalysisTargetDepth()}...`;
  renderNotationPanel();
  renderAnalysisPanel();
  renderBoard();
  renderHeaderMeta();
  if (canQueueActiveSearch) {
    state.engine.worker.postMessage('stop');
  }
}

function normalizeAnnotationSquares(value) {
  if (!Array.isArray(value)) {
    return new Set();
  }
  return new Set(
    value
      .map((square) => String(square || '').trim().toLowerCase())
      .filter((square) => SQUARE_PATTERN.test(square)),
  );
}

function normalizeAnnotationState(value) {
  return {
    paintedSquares: normalizeAnnotationSquares(value?.paintedSquares),
    circledSquares: normalizeAnnotationSquares(value?.circledSquares),
    starredSquares: normalizeAnnotationSquares(value?.starredSquares),
    arrows: normalizeAnnotationArrows(value?.arrows),
  };
}

function buildAnnotationPayload() {
  return {
    paintedSquares: Array.from(state.annotations.paintedSquares).sort(),
    circledSquares: Array.from(state.annotations.circledSquares).sort(),
    starredSquares: Array.from(state.annotations.starredSquares).sort(),
    arrows: state.annotations.arrows.map((arrow) => ({ from: arrow.from, to: arrow.to })),
  };
}

function normalizeAnnotationArrows(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const arrows = [];
  value.forEach((entry) => {
    const from = String(entry?.from || '').trim().toLowerCase();
    const to = String(entry?.to || '').trim().toLowerCase();
    if (!SQUARE_PATTERN.test(from) || !SQUARE_PATTERN.test(to) || from === to) {
      return;
    }
    const key = `${from}:${to}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    arrows.push({ from, to });
  });
  return arrows;
}

function normalizeNoteState(value) {
  return {
    text: typeof value?.text === 'string' ? normalizeEditableText(value.text) : '',
    expanded: Boolean(value?.expanded),
  };
}

function normalizeAnalysisComment(value) {
  return typeof value === 'string'
    ? normalizeEditableText(value).replace(/\r\n?/g, '\n')
    : '';
}

function createAnalysisRootNode(fen) {
  return {
    id: ROOT_NODE_ID,
    parentId: null,
    fen,
    children: [],
    selectedChildId: null,
    comment: '',
  };
}

function createEmptyAnalysisTree(fen) {
  return {
    rootId: ROOT_NODE_ID,
    currentNodeId: ROOT_NODE_ID,
    nodeCounter: 1,
    nodes: {
      [ROOT_NODE_ID]: createAnalysisRootNode(fen),
    },
  };
}

function cloneAnalysisNodes(nodes) {
  return Object.fromEntries(
    Object.entries(nodes || {}).map(([id, node]) => [
      id,
      {
        ...node,
        children: Array.isArray(node?.children) ? [...node.children] : [],
        comment: normalizeAnalysisComment(node?.comment),
      },
    ]),
  );
}

function slugifyLessonTitle(title) {
  const slug = String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled-position';
}

function normalizePromotionValue(value) {
  const promotion = String(value || '').trim().toLowerCase();
  return promotion || undefined;
}

function getAnalysisNode(nodeId) {
  return state.analysis.nodes[nodeId] || null;
}

function getCurrentAnalysisNode() {
  return getAnalysisNode(state.analysis.currentNodeId);
}

function getAnalysisDisplayedChildId(node) {
  if (!node || !Array.isArray(node.children) || !node.children.length) {
    return '';
  }
  if (node.selectedChildId && node.children.includes(node.selectedChildId)) {
    return node.selectedChildId;
  }
  return node.children[0];
}

function getAnalysisNextNodeId(nodeId = state.analysis.currentNodeId) {
  const node = getAnalysisNode(nodeId);
  return getAnalysisDisplayedChildId(node);
}

function getAnalysisPathIds(nodeId = state.analysis.currentNodeId) {
  const path = [];
  let cursor = nodeId;
  const seen = new Set();
  while (cursor) {
    if (seen.has(cursor)) {
      break;
    }
    seen.add(cursor);
    const node = getAnalysisNode(cursor);
    if (!node) {
      break;
    }
    path.push(cursor);
    cursor = node.parentId || '';
  }
  return path.reverse();
}

function getAnalysisPathNodes(nodeId = state.analysis.currentNodeId) {
  return getAnalysisPathIds(nodeId)
    .map((id) => getAnalysisNode(id))
    .filter(Boolean);
}

function getAnalysisPly(nodeId) {
  return Math.max(0, getAnalysisPathIds(nodeId).length - 1);
}

function getCurrentAnalysisPly() {
  return getAnalysisPly(state.analysis.currentNodeId);
}

function countAnalysisMoveNodes() {
  return Math.max(0, Object.keys(state.analysis.nodes).length - 1);
}

function countAnalysisBranchPoints() {
  return Object.values(state.analysis.nodes).filter((node) => Array.isArray(node.children) && node.children.length > 1).length;
}

function getAnalysisChildNodes(nodeOrId) {
  const node = typeof nodeOrId === 'string' ? getAnalysisNode(nodeOrId) : nodeOrId;
  if (!node || !Array.isArray(node.children) || !node.children.length) {
    return [];
  }
  return node.children
    .map((childId) => getAnalysisNode(childId))
    .filter(Boolean);
}

function buildDisplayedLineNodeIds(startNodeId = state.analysis.rootId) {
  const lineNodeIds = [];
  let cursorId = startNodeId;
  const seen = new Set();
  while (cursorId && !seen.has(cursorId)) {
    const node = getAnalysisNode(cursorId);
    if (!node) {
      break;
    }
    lineNodeIds.push(cursorId);
    seen.add(cursorId);
    cursorId = getAnalysisNextNodeId(cursorId);
  }
  return lineNodeIds;
}

function practiceMoveTotal() {
  return Math.max(0, state.practice.lineNodeIds.length - 1);
}

function practiceProgressCount() {
  return state.practice.kind === PRACTICE_KIND_BRANCH
    ? Math.max(0, state.practice.positionIndex)
    : clamp(state.practice.positionIndex, 0, practiceMoveTotal());
}

function getPracticeExpectedNodeId() {
  if (state.practice.kind !== PRACTICE_KIND_LINE) {
    return '';
  }
  return state.practice.lineNodeIds[state.practice.positionIndex + 1] || '';
}

function getPracticeExpectedNode() {
  return getAnalysisNode(getPracticeExpectedNodeId());
}

function getPracticePreferredChildNode(node = getCurrentAnalysisNode()) {
  if (!node) {
    return null;
  }
  if (node.selectedChildId) {
    const selectedChild = getAnalysisNode(node.selectedChildId);
    if (selectedChild && node.children.includes(selectedChild.id)) {
      return selectedChild;
    }
  }
  return getAnalysisChildNodes(node)[0] || null;
}

function getPracticeCandidateNodes() {
  if (!state.practice.active) {
    return [];
  }
  if (state.practice.kind === PRACTICE_KIND_BRANCH) {
    return getAnalysisChildNodes(getCurrentAnalysisNode());
  }
  const expectedNode = getPracticeExpectedNode();
  return expectedNode ? [expectedNode] : [];
}

function selectedLinePracticeReady() {
  return buildDisplayedLineNodeIds(state.analysis.rootId).length > 1;
}

function branchPracticeReady(startNodeId = state.analysis.currentNodeId) {
  return getAnalysisChildNodes(startNodeId).length > 0;
}

function practiceComplete() {
  if (!state.practice.active) {
    return false;
  }
  if (state.practice.kind === PRACTICE_KIND_BRANCH) {
    return getPracticeCandidateNodes().length === 0;
  }
  return !getPracticeExpectedNodeId();
}

function practiceWillCompleteAfterAdvance(nextNode) {
  if (!nextNode) {
    return true;
  }
  if (state.practice.kind === PRACTICE_KIND_BRANCH) {
    return getAnalysisChildNodes(nextNode).length === 0;
  }
  return !state.practice.lineNodeIds[state.practice.positionIndex + 1];
}

function getPracticeSolvedNodes() {
  if (!state.practice.active) {
    return [];
  }
  const pathIds = getAnalysisPathIds(state.analysis.currentNodeId);
  const startIndex = pathIds.indexOf(state.practice.branchRootNodeId);
  if (startIndex === -1) {
    return [];
  }
  return pathIds
    .slice(startIndex + 1)
    .map((nodeId) => getAnalysisNode(nodeId))
    .filter(Boolean);
}

function practicePrimaryStatusLabel() {
  return state.practice.kind === PRACTICE_KIND_BRANCH ? 'Solved' : 'Progress';
}

function practicePrimaryStatusValue() {
  return state.practice.kind === PRACTICE_KIND_BRANCH
    ? String(practiceProgressCount())
    : `${practiceProgressCount()} / ${practiceMoveTotal()}`;
}

function currentPracticePrompt() {
  if (!state.practice.active) {
    return '';
  }
  if (practiceComplete()) {
    return `Practice complete. ${pluralize(state.practice.correctCount, 'correct move')}, ${pluralize(state.practice.incorrectCount, 'mistake')}, ${pluralize(state.practice.revealedCount, 'reveal')}.`;
  }
  const sideToMove = state.analysis.game?.turn() === 'b' ? 'Black' : 'White';
  if (state.practice.kind === PRACTICE_KIND_BRANCH) {
    return `Branch drill from the selected position. ${sideToMove} to play.`;
  }
  return `Practice move ${practiceProgressCount() + 1} of ${practiceMoveTotal()}. ${sideToMove} to play.`;
}

function currentPracticeFeedback() {
  if (!state.practice.active) {
    return '';
  }
  return state.practice.feedback || (
    state.practice.kind === PRACTICE_KIND_BRANCH
      ? 'Play any recorded continuation from this position.'
      : 'Play the next recorded move from the selected lesson line.'
  );
}

function syncPracticeBoardMessage() {
  if (!state.practice.active) {
    return;
  }
  state.analysis.boardMessage = currentPracticePrompt();
}

function isBlackMoveForPly(ply) {
  const startsBlack = state.setup.meta.activeColor === 'b';
  return startsBlack ? ply % 2 === 1 : ply % 2 === 0;
}

function moveNumberForPly(ply) {
  const startsBlack = state.setup.meta.activeColor === 'b';
  return state.setup.meta.fullmove + Math.floor((ply - (startsBlack ? 0 : 1)) / 2);
}

function applyAnalysisPathSelection(nodeId) {
  const pathIds = getAnalysisPathIds(nodeId);
  for (let index = 0; index < pathIds.length - 1; index += 1) {
    const parent = getAnalysisNode(pathIds[index]);
    const childId = pathIds[index + 1];
    if (parent && parent.children.includes(childId)) {
      parent.selectedChildId = childId;
    }
  }
}

function syncLessonFileStatus(message) {
  state.lessonFileStatus = String(message || '');
  if (dom.lessonFileStatus) {
    dom.lessonFileStatus.textContent = state.lessonFileStatus;
  }
}

function renderLessonBookControls() {
  if (!dom.lessonPickerButton || !dom.lessonPickerMenu) {
    return;
  }
  ensureLessonBookInitialized();

  // Find the active lesson title to display on the trigger button
  const activeEntry = activeLessonBookEntry();
  const activeIndex = lessonBookEntryIndex();
  const activeState = lessonStateForDisplay(activeEntry);
  const activeTitle = lessonDisplayTitle(activeState, activeIndex);
  if (dom.lessonPickerValue) {
    dom.lessonPickerValue.textContent = activeTitle;
  }

  // Generate the custom dropdown items list
  const itemsMarkup = state.lessonBook.lessons.map((entry, index) => {
    const lessonState = lessonStateForDisplay(entry);
    const label = lessonDisplayTitle(lessonState, index);
    const isActive = entry.id === state.lessonBook.activeLessonId;
    const activeClass = isActive ? ' is-selected' : '';
    const ariaSelected = isActive ? 'true' : 'false';

    // Count moves in this lesson
    let movesText = '0 moves';
    if (lessonState?.analysis?.nodes) {
      const movesCount = Math.max(0, Object.keys(lessonState.analysis.nodes).length - 1);
      movesText = `${movesCount} move${movesCount === 1 ? '' : 's'}`;
    }

    // Orientation
    const orientation = lessonState?.boardOrientation || 'white';

    return `
      <button
        type="button"
        class="lesson-overflow-item lesson-picker-item${activeClass}"
        role="option"
        data-action="select-lesson"
        data-value="${escapeHtml(entry.id)}"
        aria-selected="${ariaSelected}"
      >
        <span class="lesson-picker-item-content">
          <span class="lesson-picker-item-title">${escapeHtml(label)}</span>
          <span class="lesson-picker-item-meta">${movesText} • orientation: ${orientation}</span>
        </span>
        ${isActive ? `
          <span class="lesson-picker-item-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        ` : ''}
      </button>
    `;
  }).join('') + `
    <div class="lesson-overflow-divider" role="separator"></div>
    <button
      type="button"
      class="lesson-overflow-item lesson-picker-item lesson-picker-add-item"
      data-action="select-lesson"
      data-value="add-lesson"
      role="option"
    >
      <span class="lesson-picker-item-content">
        <span class="lesson-picker-item-title">+ Add new lesson...</span>
      </span>
    </button>
  `;

  if (dom.lessonPickerMenu.innerHTML !== itemsMarkup) {
    dom.lessonPickerMenu.innerHTML = itemsMarkup;
  }

  if (dom.deleteLessonButton) {
    dom.deleteLessonButton.disabled = state.lessonBook.lessons.length <= 1;
  }
}

function createDefaultLessonState(title = DEFAULT_TITLE) {
  const parsed = parseFenLike(DEFAULT_POSITION);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const sanitized = sanitizeSetupState(parsed.pieces, parsed.meta);
  const setupFen = buildFenFromPiecesAndMeta(sanitized.pieces, sanitized.meta);
  return {
    title: normalizeEditableText(title),
    analysisTargetDepth: currentAnalysisTargetDepth(),
    boardOrientation: state.boardOrientation === 'black' ? 'black' : 'white',
    activeTab: TAB_SETUP,
    advancedOpen: false,
    toolsExpanded: Boolean(state.toolsExpanded),
    pgnCommentsVisible: state.pgnCommentsVisible !== false,
    pvLinesVisible: state.pvLinesVisible !== false,
    setupFen,
    setup: sanitized,
    analysis: createEmptyAnalysisTree(setupFen),
    annotations: normalizeAnnotationState(null),
    note: normalizeNoteState(null),
  };
}

function duplicateLessonTitle(title) {
  const normalized = normalizeEditableText(title).trim();
  return normalized ? `${normalized} copy` : 'Untitled lesson copy';
}

function activateLessonById(lessonId) {
  ensureLessonBookInitialized();
  if (!lessonId || lessonId === state.lessonBook.activeLessonId) {
    renderLessonBookControls();
    return;
  }
  storeCurrentLessonInBook();
  const nextEntry = state.lessonBook.lessons.find((entry) => entry.id === lessonId);
  if (!nextEntry) {
    renderLessonBookControls();
    return;
  }
  state.guidedReview.active = false;
  state.lessonBook.activeLessonId = nextEntry.id;
  applyLessonState(cloneLessonState(nextEntry.lessonState));
  syncAnalysisGameFromTree();
  renderAll();
  schedulePersist();
  syncLessonFileStatus(`Switched to ${lessonDisplayTitle(nextEntry.lessonState, lessonBookEntryIndex(nextEntry.id))}.`);
}

function addLessonToBook(lessonState) {
  storeCurrentLessonInBook();
  const lessonId = allocateLessonBookId();
  state.lessonBook.lessons.push({
    id: lessonId,
    lessonState: cloneLessonState(lessonState),
  });
  state.lessonBook.activeLessonId = lessonId;
  state.guidedReview.active = false;
  applyLessonState(cloneLessonState(lessonState));
  syncAnalysisGameFromTree();
  renderAll();
  schedulePersist();
}

function createNewLesson() {
  addLessonToBook(createDefaultLessonState());
  syncLessonFileStatus(`Added ${lessonDisplayTitle(createCurrentLessonStateSnapshot(), lessonBookEntryIndex())}.`);
}

function duplicateCurrentLesson() {
  const currentSnapshot = createCurrentLessonStateSnapshot();
  currentSnapshot.title = duplicateLessonTitle(currentSnapshot.title);
  addLessonToBook(currentSnapshot);
  syncLessonFileStatus(`Duplicated the current lesson into ${lessonDisplayTitle(currentSnapshot, lessonBookEntryIndex())}.`);
}

function deleteCurrentLesson() {
  ensureLessonBookInitialized();
  if (state.lessonBook.lessons.length <= 1) {
    syncLessonFileStatus('At least one lesson must remain in the menu.');
    renderLessonBookControls();
    return;
  }
  const currentIndex = lessonBookEntryIndex();
  const currentEntry = activeLessonBookEntry();
  if (currentIndex < 0 || !currentEntry) {
    return;
  }
  const currentTitle = lessonDisplayTitle(lessonStateForDisplay(currentEntry), currentIndex);
  if (!window.confirm(`Delete "${currentTitle}" from this lesson menu?`)) {
    return;
  }
  state.lessonBook.lessons.splice(currentIndex, 1);
  const nextIndex = Math.min(currentIndex, state.lessonBook.lessons.length - 1);
  const nextEntry = state.lessonBook.lessons[nextIndex];
  state.guidedReview.active = false;
  state.lessonBook.activeLessonId = nextEntry.id;
  applyLessonState(cloneLessonState(nextEntry.lessonState));
  syncAnalysisGameFromTree();
  renderAll();
  schedulePersist();
  syncLessonFileStatus(`Deleted ${currentTitle}.`);
}

async function copyCurrentFenToClipboard() {
  const fen = currentBoardFenLabel();
  closeLessonActionsMenu({ restoreFocus: true });
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fen);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = fen;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (!copied) {
        throw new Error('Clipboard copy command was rejected.');
      }
    }
    syncLessonFileStatus('Current board FEN copied.');
  } catch (error) {
    console.warn('Unable to copy current FEN.', error);
    syncLessonFileStatus('Unable to copy FEN in this browser.');
  }
}

function normalizeColorTheme(value) {
  return value === 'dark' ? 'dark' : 'light';
}

function readStoredColorTheme() {
  try {
    return normalizeColorTheme(window.localStorage.getItem(COLOR_THEME_STORAGE_KEY));
  } catch (error) {
    console.warn('Unable to read color theme preference.', error);
    return 'light';
  }
}

function persistColorTheme(theme) {
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Unable to persist color theme preference.', error);
  }
}

function syncColorThemeMenuState() {
  if (dom.toggleThemeButton) {
    const isDark = state.colorTheme === 'dark';
    dom.toggleThemeButton.setAttribute('aria-checked', isDark ? 'true' : 'false');
    dom.toggleThemeButton.classList.toggle('is-selected', isDark);
  }
  if (dom.toggleLastMoveArrowButton) {
    dom.toggleLastMoveArrowButton.setAttribute('aria-checked', state.lastMoveArrowVisible ? 'true' : 'false');
    dom.toggleLastMoveArrowButton.classList.toggle('is-selected', state.lastMoveArrowVisible);
  }
}

function syncLessonVisibilityMenuState() {
  if (dom.togglePgnCommentsMenuButton) {
    dom.togglePgnCommentsMenuButton.textContent = state.pgnCommentsVisible ? 'Hide PGN comments' : 'Show PGN comments';
  }
  if (dom.toggleNoteMenuButton) {
    dom.toggleNoteMenuButton.textContent = state.note.expanded ? 'Hide note' : 'Show note';
  }
  if (dom.toggleToolsMenuButton) {
    dom.toggleToolsMenuButton.textContent = state.toolsExpanded ? 'Hide tools' : 'Show tools';
  }
  if (dom.togglePvLinesMenuButton) {
    dom.togglePvLinesMenuButton.textContent = state.pvLinesVisible ? 'Hide PV lines' : 'Show PV lines';
  }
}

function matchesMediaQuery(query) {
  if (!query || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}

function fullscreenTargetElement() {
  return dom.rootElement || document.documentElement;
}

function isMobileLessonViewport() {
  return matchesMediaQuery(MOBILE_VIEWPORT_MEDIA_QUERY) || matchesMediaQuery(MOBILE_COARSE_LANDSCAPE_MEDIA_QUERY);
}

function fullscreenElement() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.webkitCurrentFullScreenElement
    || null;
}

function isFullscreenActive() {
  return Boolean(fullscreenElement() || document.webkitIsFullScreen);
}

function canRequestDocumentFullscreen() {
  const target = fullscreenTargetElement();
  return Boolean(
    target
    && (
      typeof target.requestFullscreen === 'function'
      || typeof target.webkitRequestFullscreen === 'function'
    )
  );
}

function shouldShowFullscreenMenuItem() {
  return isMobileLessonViewport() && canRequestDocumentFullscreen();
}

function syncFullscreenMenuState() {
  if (!dom.toggleFullscreenMenuButton) {
    return;
  }
  const visible = shouldShowFullscreenMenuItem();
  dom.toggleFullscreenMenuButton.hidden = !visible;
  dom.toggleFullscreenMenuButton.textContent = isFullscreenActive() ? 'Exit fullscreen' : 'Enter fullscreen';
}

function syncFullscreenUi() {
  syncFullscreenMenuState();
  syncOpenLessonActionsMenuLayout();
}

function reportFullscreenToggleError(error) {
  console.warn('Unable to change fullscreen mode.', error);
  syncLessonFileStatus('Unable to toggle fullscreen in this browser.');
  syncFullscreenUi();
}

async function requestDocumentFullscreen() {
  const target = fullscreenTargetElement();
  if (!target) {
    return false;
  }
  if (typeof target.requestFullscreen === 'function') {
    try {
      await target.requestFullscreen({ navigationUI: 'hide' });
      return true;
    } catch (primaryError) {
      try {
        await target.requestFullscreen();
        return true;
      } catch (fallbackError) {
        throw fallbackError || primaryError;
      }
    }
  }
  if (typeof target.webkitRequestFullscreen === 'function') {
    target.webkitRequestFullscreen();
    return true;
  }
  return false;
}

async function exitDocumentFullscreen() {
  if (typeof document.exitFullscreen === 'function') {
    await document.exitFullscreen();
    return true;
  }
  if (typeof document.webkitExitFullscreen === 'function') {
    document.webkitExitFullscreen();
    return true;
  }
  if (typeof document.webkitCancelFullScreen === 'function') {
    document.webkitCancelFullScreen();
    return true;
  }
  return false;
}

async function toggleFullscreenMode() {
  closeLessonActionsMenu();
  if (!shouldShowFullscreenMenuItem()) {
    syncFullscreenUi();
    return;
  }
  try {
    const changed = isFullscreenActive()
      ? await exitDocumentFullscreen()
      : await requestDocumentFullscreen();
    if (!changed) {
      syncLessonFileStatus('Unable to toggle fullscreen in this browser.');
      syncFullscreenUi();
    }
  } catch (error) {
    reportFullscreenToggleError(error);
  }
}

function applyColorTheme(theme, options = {}) {
  const { persist = false } = options;
  const nextTheme = normalizeColorTheme(theme);
  state.colorTheme = nextTheme;
  if (dom.rootElement) {
    dom.rootElement.dataset.theme = nextTheme;
  }
  syncColorThemeMenuState();
  if (persist) {
    persistColorTheme(nextTheme);
  }
}

function initializeColorTheme() {
  const bootTheme = dom.rootElement?.dataset.theme;
  const initialTheme = bootTheme ? normalizeColorTheme(bootTheme) : readStoredColorTheme();
  applyColorTheme(initialTheme);
}

const HEADER_MENU_NAMES = Object.freeze(['lesson-book', 'settings', 'lesson-select']);

function headerMenuElements(menuName) {
  if (menuName === 'lesson-book') {
    return {
      button: dom.lessonBookActionsButton,
      menu: dom.lessonBookActionsMenu,
    };
  }
  if (menuName === 'lesson-select') {
    return {
      button: dom.lessonPickerButton,
      menu: dom.lessonPickerMenu,
    };
  }
  return {
    button: dom.lessonActionsButton,
    menu: dom.lessonActionsMenu,
  };
}

function isHeaderMenuOpen(menuName) {
  const { menu } = headerMenuElements(menuName);
  return Boolean(menu && !menu.hidden);
}

function clearHeaderMenuLayout(menuName) {
  const { menu } = headerMenuElements(menuName);
  if (!menu) {
    return;
  }
  menu.removeAttribute('data-placement');
  menu.style.removeProperty('max-height');
}

function syncHeaderMenuLayout(menuName) {
  const { button, menu } = headerMenuElements(menuName);
  if (!button || !menu || menu.hidden) {
    return;
  }

  const menuGap = remToPx(LESSON_ACTIONS_MENU_GAP_REM);
  const viewportPadding = remToPx(LESSON_ACTIONS_MENU_VIEWPORT_PADDING_REM);
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const buttonRect = button.getBoundingClientRect();

  clearHeaderMenuLayout(menuName);
  menu.dataset.placement = 'down';

  const naturalHeight = Math.ceil(menu.getBoundingClientRect().height);
  const availableBelow = Math.max(0, viewportHeight - buttonRect.bottom - menuGap - viewportPadding);
  const availableAbove = Math.max(0, buttonRect.top - menuGap - viewportPadding);

  let placement = 'down';
  let availableSpace = availableBelow;

  if (naturalHeight <= availableBelow) {
    placement = 'down';
    availableSpace = availableBelow;
  } else if (naturalHeight <= availableAbove) {
    placement = 'up';
    availableSpace = availableAbove;
  } else if (availableAbove > availableBelow) {
    placement = 'up';
    availableSpace = availableAbove;
  }

  menu.dataset.placement = placement;
  if (availableSpace > 0) {
    menu.style.maxHeight = `${Math.floor(availableSpace)}px`;
  }
}

function syncOpenHeaderMenusLayout() {
  HEADER_MENU_NAMES.forEach((menuName) => {
    if (isHeaderMenuOpen(menuName)) {
      syncHeaderMenuLayout(menuName);
    }
  });
}

function syncOpenLessonActionsMenuLayout() {
  if (!isLessonActionsMenuOpen()) {
    return;
  }
  syncHeaderMenuLayout('settings');
}

function setHeaderMenuOpen(menuName, isOpen) {
  const { button, menu } = headerMenuElements(menuName);
  if (!button || !menu) {
    return;
  }
  const nextOpen = Boolean(isOpen);
  if (nextOpen) {
    HEADER_MENU_NAMES
      .filter((otherMenuName) => otherMenuName !== menuName)
      .forEach((otherMenuName) => setHeaderMenuOpen(otherMenuName, false));
  }
  button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  button.closest('.lesson-overflow')?.classList.toggle('is-open', nextOpen);
  if (nextOpen) {
    menu.hidden = false;
    menu.scrollTop = 0;
    syncHeaderMenuLayout(menuName);
    return;
  }
  clearHeaderMenuLayout(menuName);
  menu.hidden = true;
}

function closeHeaderMenu(menuName, options = {}) {
  const { restoreFocus = false } = options;
  const { button } = headerMenuElements(menuName);
  if (!isHeaderMenuOpen(menuName)) {
    return;
  }
  setHeaderMenuOpen(menuName, false);
  if (restoreFocus) {
    button?.focus();
  }
}

function closeHeaderMenus(options = {}) {
  HEADER_MENU_NAMES.forEach((menuName) => closeHeaderMenu(menuName, options));
}

function isLessonBookActionsMenuOpen() {
  return isHeaderMenuOpen('lesson-book');
}

function closeLessonBookActionsMenu(options = {}) {
  closeHeaderMenu('lesson-book', options);
}

function toggleLessonBookActionsMenu() {
  setHeaderMenuOpen('lesson-book', !isLessonBookActionsMenuOpen());
}

function isLessonPickerMenuOpen() {
  return isHeaderMenuOpen('lesson-select');
}

function closeLessonPickerMenu(options = {}) {
  closeHeaderMenu('lesson-select', options);
}

function toggleLessonPickerMenu() {
  setHeaderMenuOpen('lesson-select', !isLessonPickerMenuOpen());
}

function isLessonActionsMenuOpen() {
  return isHeaderMenuOpen('settings');
}

function closeLessonActionsMenu(options = {}) {
  closeHeaderMenu('settings', options);
}

function toggleLessonActionsMenu() {
  setHeaderMenuOpen('settings', !isLessonActionsMenuOpen());
}

function syncResponsiveLayout() {
  state.boardLayoutFrame = 0;
  syncBoardSize();
  syncFullscreenMenuState();
  syncOpenHeaderMenusLayout();
}

function scheduleBoardLayoutSync() {
  if (state.boardLayoutFrame) {
    return;
  }
  state.boardLayoutFrame = window.requestAnimationFrame(syncResponsiveLayout);
}

function handleViewportResize() {
  scheduleBoardLayoutSync();
}

function handleFullscreenChange() {
  syncFullscreenMenuState();
  handleViewportResize();
}

function handleFullscreenError() {
  reportFullscreenToggleError(null);
}

function syncFocusModeControls() {
  if (!dom.focusModeControls) {
    return;
  }
  dom.focusModeControls.hidden = !state.focusMode;
  syncAnalyzeButtonState(dom.focusModeAnalyzeButton, { iconOnly: true });
}

function syncFocusModeUi() {
  dom.pageShell?.classList.toggle('is-focus-mode', state.focusMode);
  syncFocusModeControls();
}

function syncBoardOnlyUi() {
  dom.rootElement?.toggleAttribute('data-board-only', state.boardOnlyMode);
  dom.rootElement?.toggleAttribute('data-board-only-setup-open', state.boardOnlyMode && state.boardOnlySetupVisible);
  dom.rootElement?.toggleAttribute('data-board-only-teacher-setup', state.boardOnlyMode && state.boardOnlyTeacherSetupActive);
  document.body?.classList.toggle('is-board-only', state.boardOnlyMode);
  dom.pageShell?.classList.toggle('is-board-only', state.boardOnlyMode);
  dom.pageShell?.classList.toggle('is-board-only-setup-open', state.boardOnlyMode && state.boardOnlySetupVisible);
  dom.pageShell?.classList.toggle('is-board-only-teacher-setup', state.boardOnlyMode && state.boardOnlyTeacherSetupActive);
}

function setFocusMode(isActive, options = {}) {
  const { restoreFocus = !isActive } = options;
  const nextFocusMode = Boolean(isActive);
  closeLessonActionsMenu();
  if (state.focusMode !== nextFocusMode) {
    state.focusMode = nextFocusMode;
  }
  syncFocusModeUi();
  renderBoard();
  window.requestAnimationFrame(() => {
    syncBoardSize();
  });
  if (nextFocusMode) {
    dom.exitFocusModeButton?.focus();
    return;
  }
  if (restoreFocus) {
    dom.lessonActionsButton?.focus();
  }
}

function cloneSetupPieces(pieces) {
  return { ...(pieces || {}) };
}

function createCurrentLessonStateSnapshot() {
  return {
    title: normalizeEditableText(state.title),
    analysisTargetDepth: currentAnalysisTargetDepth(),
    boardOrientation: state.boardOrientation === 'black' ? 'black' : 'white',
    activeTab: normalizeActiveTab(state.activeTab),
    advancedOpen: Boolean(state.setup.advancedOpen),
    toolsExpanded: Boolean(state.toolsExpanded),
    pgnCommentsVisible: state.pgnCommentsVisible !== false,
    pvLinesVisible: state.pvLinesVisible !== false,
    setupFen: state.setupFen,
    setup: {
      pieces: cloneSetupPieces(state.setup.pieces),
      meta: cloneMeta(state.setup.meta),
    },
    analysis: {
      rootId: state.analysis.rootId,
      currentNodeId: state.analysis.currentNodeId,
      nodeCounter: state.analysis.nodeCounter,
      nodes: cloneAnalysisNodes(state.analysis.nodes),
    },
    annotations: buildAnnotationPayload(),
    note: normalizeNoteState(state.note),
  };
}

function cloneLessonState(lessonState) {
  return {
    title: normalizeEditableText(lessonState?.title),
    analysisTargetDepth: normalizeAnalysisTargetDepth(lessonState?.analysisTargetDepth),
    boardOrientation: lessonState?.boardOrientation === 'black' ? 'black' : 'white',
    activeTab: normalizeActiveTab(lessonState?.activeTab),
    advancedOpen: Boolean(lessonState?.advancedOpen),
    toolsExpanded: Boolean(lessonState?.toolsExpanded),
    pgnCommentsVisible: lessonState?.pgnCommentsVisible !== false,
    pvLinesVisible: lessonState?.pvLinesVisible !== false,
    setupFen: String(lessonState?.setupFen || DEFAULT_POSITION).trim() || DEFAULT_POSITION,
    setup: {
      pieces: cloneSetupPieces(lessonState?.setup?.pieces),
      meta: cloneMeta(lessonState?.setup?.meta || DEFAULT_META),
    },
    analysis: {
      rootId: String(lessonState?.analysis?.rootId || ROOT_NODE_ID).trim() || ROOT_NODE_ID,
      currentNodeId: String(lessonState?.analysis?.currentNodeId || ROOT_NODE_ID).trim() || ROOT_NODE_ID,
      nodeCounter: Math.max(
        1,
        Number(lessonState?.analysis?.nodeCounter) || deriveAnalysisNodeCounter(lessonState?.analysis?.nodes),
      ),
      nodes: cloneAnalysisNodes(lessonState?.analysis?.nodes || {}),
    },
    annotations: normalizeAnnotationState(lessonState?.annotations),
    note: normalizeNoteState(lessonState?.note),
  };
}

function serializeLessonState(lessonState) {
  const normalized = cloneLessonState(lessonState);
  return {
    version: LESSON_FILE_VERSION,
    title: normalized.title,
    setupFen: normalized.setupFen,
    analysisTargetDepth: normalized.analysisTargetDepth,
    boardOrientation: normalized.boardOrientation,
    activeTab: normalized.activeTab,
    advancedOpen: normalized.advancedOpen,
    toolsExpanded: normalized.toolsExpanded,
    pgnCommentsVisible: normalized.pgnCommentsVisible,
    pvLinesVisible: normalized.pvLinesVisible,
    currentNodeId: normalized.analysis.currentNodeId,
    rootId: normalized.analysis.rootId,
    nodes: cloneAnalysisNodes(normalized.analysis.nodes),
    annotations: normalizeAnnotationState(normalized.annotations),
    note: normalizeNoteState(normalized.note),
  };
}

function buildLessonPayload() {
  return serializeLessonState(createCurrentLessonStateSnapshot());
}

function deriveLessonBookCounter(lessons) {
  let maxIndex = 0;
  lessons.forEach((entry) => {
    const match = /^lesson-(\d+)$/.exec(String(entry?.id || '').trim());
    if (match) {
      maxIndex = Math.max(maxIndex, Number.parseInt(match[1], 10) || 0);
    }
  });
  return maxIndex + 1;
}

function createSingleLessonBookState(lessonState = createCurrentLessonStateSnapshot()) {
  const normalizedLessonState = cloneLessonState(lessonState);
  return {
    activeLessonId: 'lesson-1',
    nextId: 2,
    lessons: [
      {
        id: 'lesson-1',
        lessonState: normalizedLessonState,
      },
    ],
  };
}

function ensureLessonBookInitialized() {
  if (Array.isArray(state.lessonBook.lessons) && state.lessonBook.lessons.length) {
    if (!state.lessonBook.activeLessonId) {
      state.lessonBook.activeLessonId = state.lessonBook.lessons[0].id;
    }
    state.lessonBook.nextId = Math.max(
      1,
      Number(state.lessonBook.nextId) || deriveLessonBookCounter(state.lessonBook.lessons),
    );
    return;
  }
  const initialBook = createSingleLessonBookState();
  state.lessonBook.activeLessonId = initialBook.activeLessonId;
  state.lessonBook.nextId = initialBook.nextId;
  state.lessonBook.lessons = initialBook.lessons;
}

function lessonBookEntryIndex(lessonId = state.lessonBook.activeLessonId) {
  return state.lessonBook.lessons.findIndex((entry) => entry.id === lessonId);
}

function activeLessonBookEntry() {
  const entryIndex = lessonBookEntryIndex();
  return entryIndex >= 0 ? state.lessonBook.lessons[entryIndex] : null;
}

function lessonStateForDisplay(entry) {
  if (!entry) {
    return createCurrentLessonStateSnapshot();
  }
  if (entry.id === state.lessonBook.activeLessonId) {
    return createCurrentLessonStateSnapshot();
  }
  return cloneLessonState(entry.lessonState);
}

function lessonDisplayTitle(lessonState, index) {
  const title = normalizeEditableText(lessonState?.title).trim();
  return title || `Lesson ${index + 1}`;
}

function storeCurrentLessonInBook() {
  ensureLessonBookInitialized();
  const snapshot = createCurrentLessonStateSnapshot();
  const entryIndex = lessonBookEntryIndex();
  if (entryIndex >= 0) {
    state.lessonBook.lessons[entryIndex] = {
      ...state.lessonBook.lessons[entryIndex],
      lessonState: snapshot,
    };
    return;
  }
  state.lessonBook.lessons.push({
    id: state.lessonBook.activeLessonId || 'lesson-1',
    lessonState: snapshot,
  });
}

function allocateLessonBookId() {
  ensureLessonBookInitialized();
  let candidate = '';
  do {
    candidate = `lesson-${Math.max(1, state.lessonBook.nextId)}`;
    state.lessonBook.nextId += 1;
  } while (state.lessonBook.lessons.some((entry) => entry.id === candidate));
  return candidate;
}

function buildLessonBookPayload() {
  ensureLessonBookInitialized();
  const lessons = state.lessonBook.lessons.map((entry) => ({
    id: entry.id,
    ...serializeLessonState(lessonStateForDisplay(entry)),
  }));
  return {
    version: LESSON_BOOK_FILE_VERSION,
    activeLessonId: state.lessonBook.activeLessonId,
    lessons,
  };
}

function buildDraftPayload() {
  return {
    ...buildLessonBookPayload(),
    practiceKindPreference: state.practicePreferenceKind,
    guidedReviewActive: state.guidedReview.active,
  };
}

function parseFenLike(fen) {
  const normalized = String(fen ?? '').trim();
  const tokens = normalized.split(/\s+/);
  if (tokens.length !== 6) {
    return { ok: false, error: 'FEN must contain 6 space-separated fields.' };
  }
  const placement = tokens[0];
  const pieces = parsePlacement(placement);
  if (!pieces.ok) {
    return pieces;
  }
  const activeColor = tokens[1];
  if (!/^(w|b)$/.test(activeColor)) {
    return { ok: false, error: 'Side to move must be w or b.' };
  }
  const castling = tokens[2];
  if (!/^(-|[KQkq]+)$/.test(castling)) {
    return { ok: false, error: 'Castling rights are invalid.' };
  }
  const enPassant = tokens[3];
  if (!/^(-|[a-h][36])$/.test(enPassant)) {
    return { ok: false, error: 'En passant square is invalid.' };
  }
  const halfmove = Number.parseInt(tokens[4], 10);
  if (!Number.isFinite(halfmove) || halfmove < 0) {
    return { ok: false, error: 'Halfmove clock must be 0 or greater.' };
  }
  const fullmove = Number.parseInt(tokens[5], 10);
  if (!Number.isFinite(fullmove) || fullmove <= 0) {
    return { ok: false, error: 'Fullmove number must be 1 or greater.' };
  }
  return {
    ok: true,
    pieces: pieces.pieces,
    meta: {
      activeColor,
      castling,
      enPassant,
      halfmove,
      fullmove,
    },
  };
}

function parsePlacement(placement) {
  const ranks = String(placement ?? '').split('/');
  if (ranks.length !== 8) {
    return { ok: false, error: 'Board placement must contain 8 ranks.' };
  }
  const pieces = {};
  for (let rankIndex = 0; rankIndex < ranks.length; rankIndex += 1) {
    let fileIndex = 0;
    for (const symbol of ranks[rankIndex]) {
      if (/^\d$/.test(symbol)) {
        fileIndex += Number.parseInt(symbol, 10);
        continue;
      }
      if (!/^[prnbqkPRNBQK]$/.test(symbol)) {
        return { ok: false, error: `Invalid piece symbol: ${symbol}` };
      }
      if (fileIndex > 7) {
        return { ok: false, error: 'Too many files in one rank.' };
      }
      const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
      pieces[square] = symbol;
      fileIndex += 1;
    }
    if (fileIndex !== 8) {
      return { ok: false, error: 'Each rank must cover exactly 8 files.' };
    }
  }
  return { ok: true, pieces };
}

function buildPlacementFromPieces(pieces) {
  const rows = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let empty = 0;
    let row = '';
    for (let file = 0; file < 8; file += 1) {
      const square = `${String.fromCharCode(97 + file)}${rank}`;
      const piece = pieces[square];
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      row += piece;
    }
    if (empty > 0) {
      row += String(empty);
    }
    rows.push(row);
  }
  return rows.join('/');
}

function buildFenFromPiecesAndMeta(pieces, meta) {
  return `${buildPlacementFromPieces(pieces)} ${meta.activeColor} ${meta.castling} ${meta.enPassant} ${meta.halfmove} ${meta.fullmove}`;
}

function parseCastlingRights(castling) {
  const rights = new Set();
  const normalized = String(castling ?? '').trim();
  if (!normalized || normalized === '-') {
    return rights;
  }
  for (const symbol of normalized) {
    if ('KQkq'.includes(symbol)) {
      rights.add(symbol);
    }
  }
  return rights;
}

function castlingStringFromRights(rights) {
  const ordered = ['K', 'Q', 'k', 'q'].filter((flag) => rights.has(flag));
  return ordered.length ? ordered.join('') : '-';
}

function allowedCastlingRightsForPieces(pieces) {
  const allowed = new Set();
  if (pieces.e1 === 'K') {
    if (pieces.h1 === 'R') {
      allowed.add('K');
    }
    if (pieces.a1 === 'R') {
      allowed.add('Q');
    }
  }
  if (pieces.e8 === 'k') {
    if (pieces.h8 === 'r') {
      allowed.add('k');
    }
    if (pieces.a8 === 'r') {
      allowed.add('q');
    }
  }
  return allowed;
}

function sanitizeCastlingForPieces(castling, pieces) {
  const rights = parseCastlingRights(castling);
  const allowed = allowedCastlingRightsForPieces(pieces);
  const sanitized = new Set();
  rights.forEach((flag) => {
    if (allowed.has(flag)) {
      sanitized.add(flag);
    }
  });
  return castlingStringFromRights(sanitized);
}

function areKingsAdjacent(whiteSquare, blackSquare) {
  const whiteFile = whiteSquare.codePointAt(0) - 97;
  const whiteRank = Number.parseInt(whiteSquare[1], 10);
  const blackFile = blackSquare.codePointAt(0) - 97;
  const blackRank = Number.parseInt(blackSquare[1], 10);
  return Math.abs(whiteFile - blackFile) <= 1 && Math.abs(whiteRank - blackRank) <= 1;
}

function isBasicPositionLegal({ pieces, activeColor, castling, halfmove, fullmove }) {
  let whiteKingCount = 0;
  let blackKingCount = 0;
  let whitePawnCount = 0;
  let blackPawnCount = 0;
  let whiteKingSquare = '';
  let blackKingSquare = '';
  let pawnOnInvalidRank = false;

  Object.entries(pieces).forEach(([square, piece]) => {
    switch (piece) {
      case 'K':
        whiteKingCount += 1;
        whiteKingSquare ||= square;
        break;
      case 'k':
        blackKingCount += 1;
        blackKingSquare ||= square;
        break;
      case 'P':
        whitePawnCount += 1;
        if (square.endsWith('1') || square.endsWith('8')) {
          pawnOnInvalidRank = true;
        }
        break;
      case 'p':
        blackPawnCount += 1;
        if (square.endsWith('1') || square.endsWith('8')) {
          pawnOnInvalidRank = true;
        }
        break;
      default:
        break;
    }
  });

  if (whiteKingCount !== 1 || blackKingCount !== 1) {
    return false;
  }
  if (whitePawnCount > 8 || blackPawnCount > 8 || pawnOnInvalidRank) {
    return false;
  }
  if (whiteKingSquare && blackKingSquare && areKingsAdjacent(whiteKingSquare, blackKingSquare)) {
    return false;
  }
  const sanitizedCastling = sanitizeCastlingForPieces(castling, pieces);
  if (sanitizedCastling !== castling) {
    return false;
  }
  const safeHalfmove = Math.max(0, halfmove);
  const safeFullmove = Math.max(1, fullmove);
  const fen = `${buildPlacementFromPieces(pieces)} ${activeColor} ${castling} - ${safeHalfmove} ${safeFullmove}`;
  return validateFen(fen).ok;
}

function legalEnPassantSquaresForPieces({ pieces, activeColor, castling, halfmove, fullmove }) {
  const safeHalfmove = Math.max(0, halfmove);
  const safeFullmove = Math.max(1, fullmove);
  if (!isBasicPositionLegal({ pieces, activeColor, castling, halfmove: safeHalfmove, fullmove: safeFullmove })) {
    return [];
  }
  const isWhiteToMove = activeColor !== 'b';
  const moverPawn = isWhiteToMove ? 'p' : 'P';
  const capturerPawn = isWhiteToMove ? 'P' : 'p';
  const pawnRank = isWhiteToMove ? 5 : 4;
  const targetRank = isWhiteToMove ? 6 : 3;
  const legalSquares = [];

  for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
    const file = String.fromCharCode(97 + fileIndex);
    const pawnSquare = `${file}${pawnRank}`;
    if (pieces[pawnSquare] !== moverPawn) {
      continue;
    }
    const targetSquare = `${file}${targetRank}`;
    if (pieces[targetSquare]) {
      continue;
    }

    let canCapture = false;
    if (fileIndex > 0) {
      const leftSquare = `${String.fromCharCode(97 + fileIndex - 1)}${pawnRank}`;
      if (pieces[leftSquare] === capturerPawn) {
        canCapture = true;
      }
    }
    if (fileIndex < 7) {
      const rightSquare = `${String.fromCharCode(97 + fileIndex + 1)}${pawnRank}`;
      if (pieces[rightSquare] === capturerPawn) {
        canCapture = true;
      }
    }
    if (!canCapture) {
      continue;
    }
    const candidateFen = `${buildPlacementFromPieces(pieces)} ${activeColor} ${castling} ${targetSquare} ${safeHalfmove} ${safeFullmove}`;
    if (validateFen(candidateFen).ok) {
      legalSquares.push(targetSquare);
    }
  }

  return legalSquares;
}

function sanitizeEnPassantForPieces(enPassant, pieces, activeColor, castling, halfmove, fullmove) {
  const normalized = String(enPassant ?? '-').trim().toLowerCase();
  if (!normalized || normalized === '-') {
    return '-';
  }
  const legalSquares = legalEnPassantSquaresForPieces({
    pieces,
    activeColor,
    castling,
    halfmove,
    fullmove,
  });
  return legalSquares.includes(normalized) ? normalized : '-';
}

function sanitizeSetupState(pieces, meta) {
  const clonedPieces = { ...pieces };
  const safeMeta = {
    activeColor: meta.activeColor === 'b' ? 'b' : 'w',
    castling: meta.castling || '-',
    enPassant: meta.enPassant || '-',
    halfmove: Math.max(0, Number.parseInt(meta.halfmove, 10) || 0),
    fullmove: Math.max(1, Number.parseInt(meta.fullmove, 10) || 1),
  };
  const activeColor = safeMeta.activeColor;
  const castling = sanitizeCastlingForPieces(safeMeta.castling, clonedPieces);
  const enPassant = sanitizeEnPassantForPieces(
    safeMeta.enPassant,
    clonedPieces,
    activeColor,
    castling,
    safeMeta.halfmove,
    safeMeta.fullmove,
  );
  return {
    pieces: clonedPieces,
    meta: {
      activeColor,
      castling,
      enPassant,
      halfmove: safeMeta.halfmove,
      fullmove: safeMeta.fullmove,
    },
  };
}

function isIllegalSetupPosition() {
  const { pieces, meta } = state.setup;
  const basicLegal = isBasicPositionLegal({
    pieces,
    activeColor: meta.activeColor,
    castling: meta.castling,
    halfmove: meta.halfmove,
    fullmove: meta.fullmove,
  });
  if (!basicLegal) {
    return true;
  }
  const sanitizedEnPassant = sanitizeEnPassantForPieces(
    meta.enPassant,
    pieces,
    meta.activeColor,
    meta.castling,
    meta.halfmove,
    meta.fullmove,
  );
  if (sanitizedEnPassant !== meta.enPassant) {
    return true;
  }
  // Reject positions where the side to move is checking the opponent king.
  const fen = `${buildPlacementFromPieces(pieces)} ${meta.activeColor} ${meta.castling} ${meta.enPassant} ${Math.max(0, meta.halfmove)} ${Math.max(1, meta.fullmove)}`;
  let game;
  try {
    game = new Chess(fen);
  } catch {
    return true;
  }
  const mover = meta.activeColor;
  const defender = mover === 'w' ? 'b' : 'w';
  for (const row of game.board()) {
    for (const square of row) {
      if (square && square.type === 'k' && square.color === defender) {
        if (game.isAttacked(square.square, mover)) {
          return true;
        }
      }
    }
  }
  return false;
}

function currentSetupSummary() {
  if (state.setup.fenError) {
    return {
      kind: 'danger',
      title: 'FEN needs attention',
      message: state.setup.fenError,
    };
  }
  if (isIllegalSetupPosition()) {
    return {
      kind: 'danger',
      title: 'Position is invalid',
      message: 'Fix the board or advanced fields before running analysis.',
    };
  }
  return {
    kind: 'success',
    title: 'Setup ready',
    message: 'Board, castling rights, side to move, and en passant are synchronized.',
  };
}

function canAnalyzeCurrentSetup() {
  if (isIllegalSetupPosition()) {
    return false;
  }
  return validateFen(state.setupFen).ok;
}

function defaultAnalysisSummary() {
  if (!state.analysis.game) {
    return 'Fix the setup in the Setup tab to enable legal-move analysis.';
  }
  if (isTablebaseEligibleFen(state.analysis.currentFen)) {
    return `Select Analyze to probe the Lichess tablebase for this ${TABLEBASE_ENDGAME_LABEL}. Stockfish is used if the lookup is unavailable.`;
  }
  const targetDepth = currentAnalysisTargetDepth();
  if (state.engine.ready) {
    return state.engine.bundleLabel
      ? `Stockfish ready (${state.engine.bundleLabel}). Analyze to depth ${targetDepth} from the current board position.`
      : `Stockfish ready. Analyze to depth ${targetDepth} from the current board position.`;
  }
  return `Select Analyze to load Stockfish for this board and search to depth ${targetDepth}.`;
}

function schedulePersist() {
  window.clearTimeout(state.persistTimer);
  state.persistTimer = window.setTimeout(persistDraft, 120);
}

function withPreservedScroll(element, callback) {
  if (!element || typeof callback !== 'function') {
    callback?.();
    return;
  }
  const { scrollTop, scrollLeft } = element;
  callback();
  element.scrollTop = scrollTop;
  element.scrollLeft = scrollLeft;
}

function deriveAnalysisNodeCounter(nodes) {
  let maxIndex = 0;
  Object.keys(nodes || {}).forEach((id) => {
    const match = /^n(\d+)$/.exec(id);
    if (match) {
      maxIndex = Math.max(maxIndex, Number.parseInt(match[1], 10) || 0);
    }
  });
  return maxIndex + 1;
}

function assignAnalysisTree(tree) {
  state.analysis.rootId = tree.rootId;
  state.analysis.currentNodeId = tree.currentNodeId;
  state.analysis.nodes = cloneAnalysisNodes(tree.nodes);
  state.analysis.nodeCounter = Math.max(1, Number(tree.nodeCounter) || deriveAnalysisNodeCounter(tree.nodes));
  state.analysis.headers = tree.headers || null;
}

function buildLegacyAnalysisTree(history, cursor, setupFen) {
  const tree = createEmptyAnalysisTree(setupFen);
  if (!validateFen(setupFen).ok || !Array.isArray(history)) {
    return tree;
  }

  let parentId = tree.rootId;
  let currentNodeId = tree.rootId;
  let appliedCount = 0;
  const targetCursor = clamp(Number.isFinite(cursor) ? Math.trunc(cursor) : history.length, 0, history.length);
  const game = new Chess(setupFen);

  for (const rawMove of history) {
    try {
      const applied = game.move({
        from: rawMove.from,
        to: rawMove.to,
        promotion: normalizePromotionValue(rawMove.promotion),
      });
      const nodeId = `n${tree.nodeCounter}`;
      tree.nodeCounter += 1;
      tree.nodes[nodeId] = {
        id: nodeId,
        parentId,
        from: applied.from,
        to: applied.to,
        promotion: applied.promotion || undefined,
        san: applied.san,
        fen: game.fen(),
        children: [],
        selectedChildId: null,
        comment: '',
      };
      const parent = tree.nodes[parentId];
      parent.children.push(nodeId);
      parent.selectedChildId = nodeId;
      parentId = nodeId;
      appliedCount += 1;
      if (appliedCount <= targetCursor) {
        currentNodeId = nodeId;
      }
    } catch {
      break;
    }
  }

  tree.currentNodeId = currentNodeId;
  return tree;
}

function normalizeSetupFenForLesson(fen) {
  const parsed = parseFenLike(fen);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const sanitized = sanitizeSetupState(parsed.pieces, parsed.meta);
  const normalizedFen = buildFenFromPiecesAndMeta(sanitized.pieces, sanitized.meta);
  if (!validateFen(normalizedFen).ok) {
    throw new Error('Lesson setup FEN is invalid.');
  }
  return {
    setupFen: normalizedFen,
    setup: sanitized,
  };
}

function validateAndNormalizeLessonNodes(rawNodes, rootId, currentNodeId, setupFen) {
  if (!rawNodes || typeof rawNodes !== 'object' || Array.isArray(rawNodes)) {
    throw new Error('Lesson nodes must be an object.');
  }

  const nodes = {};
  Object.entries(rawNodes).forEach(([key, rawNode]) => {
    if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
      throw new Error(`Node ${key} is invalid.`);
    }
    const id = String(rawNode.id || key).trim();
    if (!id || id !== String(key)) {
      throw new Error(`Node ${key} has an invalid id.`);
    }
    const children = Array.isArray(rawNode.children)
      ? rawNode.children.map((childId) => String(childId || '').trim()).filter(Boolean)
      : [];
    const uniqueChildren = Array.from(new Set(children));
    if (uniqueChildren.length !== children.length) {
      throw new Error(`Node ${id} contains duplicate children.`);
    }
    const selectedChildId = rawNode.selectedChildId == null || rawNode.selectedChildId === ''
      ? null
      : String(rawNode.selectedChildId).trim();
    const baseNode = {
      id,
      parentId: rawNode.parentId == null || rawNode.parentId === '' ? null : String(rawNode.parentId).trim(),
      fen: String(rawNode.fen || '').trim(),
      children: uniqueChildren,
      selectedChildId,
      comment: normalizeAnalysisComment(rawNode.comment),
    };

    if (id === rootId) {
      if (baseNode.parentId !== null) {
        throw new Error('Root node must not have a parent.');
      }
      if (baseNode.fen !== setupFen) {
        throw new Error('Root node FEN must match the lesson setup FEN.');
      }
      nodes[id] = baseNode;
      return;
    }

    if (!/^[a-h][1-8]$/.test(String(rawNode.from || '').trim()) || !/^[a-h][1-8]$/.test(String(rawNode.to || '').trim())) {
      throw new Error(`Node ${id} has an invalid move.`);
    }
    if (!validateFen(baseNode.fen).ok) {
      throw new Error(`Node ${id} has an invalid FEN.`);
    }
    nodes[id] = {
      ...baseNode,
      from: String(rawNode.from).trim(),
      to: String(rawNode.to).trim(),
      promotion: normalizePromotionValue(rawNode.promotion),
      san: String(rawNode.san || '').trim(),
    };
  });

  if (!nodes[rootId]) {
    throw new Error('Lesson root node is missing.');
  }
  if (!nodes[currentNodeId]) {
    throw new Error('Current lesson node is missing.');
  }

  const reachable = new Set();
  const stack = [rootId];
  while (stack.length) {
    const nodeId = stack.pop();
    if (!nodeId || reachable.has(nodeId)) {
      continue;
    }
    reachable.add(nodeId);
    const node = nodes[nodeId];
    if (!node) {
      throw new Error(`Node ${nodeId} is missing.`);
    }
    if (node.selectedChildId && !node.children.includes(node.selectedChildId)) {
      throw new Error(`Node ${nodeId} points to an invalid selected variation.`);
    }
    node.children.forEach((childId) => {
      const child = nodes[childId];
      if (!child) {
        throw new Error(`Node ${nodeId} points to a missing child.`);
      }
      if (child.parentId !== nodeId) {
        throw new Error(`Node ${childId} has an invalid parent link.`);
      }
      stack.push(childId);
    });
  }

  if (reachable.size !== Object.keys(nodes).length) {
    throw new Error('Lesson nodes must form a single tree rooted at the setup position.');
  }
  if (!reachable.has(currentNodeId)) {
    throw new Error('Current lesson node is not reachable from the root.');
  }

  const normalizedNodes = cloneAnalysisNodes(nodes);
  const validationStack = [rootId];
  while (validationStack.length) {
    const nodeId = validationStack.pop();
    const parentNode = normalizedNodes[nodeId];
    for (let index = parentNode.children.length - 1; index >= 0; index -= 1) {
      const childId = parentNode.children[index];
      const childNode = normalizedNodes[childId];
      const replay = new Chess(parentNode.fen);
      let applied;
      try {
        applied = replay.move({
          from: childNode.from,
          to: childNode.to,
          promotion: childNode.promotion,
        });
      } catch {
        throw new Error(`Move ${childNode.from}${childNode.to} is illegal in node ${childId}.`);
      }
      if (replay.fen() !== childNode.fen) {
        throw new Error(`Node ${childId} has a mismatched FEN.`);
      }
      if (childNode.san && childNode.san !== applied.san) {
        throw new Error(`Node ${childId} has a mismatched SAN.`);
      }
      childNode.san = applied.san;
      childNode.promotion = applied.promotion || undefined;
      validationStack.push(childId);
    }
  }

  return {
    rootId,
    currentNodeId,
    nodeCounter: deriveAnalysisNodeCounter(normalizedNodes),
    nodes: normalizedNodes,
  };
}

function validateAndNormalizeLessonPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Lesson file must contain a JSON object.');
  }
  if (Number(payload.version) !== LESSON_FILE_VERSION) {
    throw new Error(`Unsupported lesson version: ${payload.version ?? 'unknown'}.`);
  }

  const normalizedSetup = normalizeSetupFenForLesson(String(payload.setupFen || '').trim());
  const rootId = String(payload.rootId || ROOT_NODE_ID).trim() || ROOT_NODE_ID;
  const currentNodeId = String(payload.currentNodeId || rootId).trim() || rootId;

  return {
    title: typeof payload.title === 'string' ? normalizeEditableText(payload.title) : DEFAULT_TITLE,
    analysisTargetDepth: normalizeAnalysisTargetDepth(payload.analysisTargetDepth),
    boardOrientation: payload.boardOrientation === 'black' ? 'black' : 'white',
    activeTab: normalizeActiveTab(payload.activeTab),
    advancedOpen: Boolean(payload.advancedOpen),
    toolsExpanded: Boolean(payload.toolsExpanded),
    pgnCommentsVisible: payload.pgnCommentsVisible !== false,
    pvLinesVisible: payload.pvLinesVisible !== false,
    setupFen: normalizedSetup.setupFen,
    setup: normalizedSetup.setup,
    analysis: validateAndNormalizeLessonNodes(payload.nodes, rootId, currentNodeId, normalizedSetup.setupFen),
    annotations: normalizeAnnotationState(payload.annotations),
    note: normalizeNoteState(payload.note),
  };
}

function validateAndNormalizeLessonBookPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Lesson file must contain a JSON object.');
  }
  if (Number(payload.version) !== LESSON_BOOK_FILE_VERSION) {
    throw new Error(`Unsupported lesson book version: ${payload.version ?? 'unknown'}.`);
  }
  if (!Array.isArray(payload.lessons) || !payload.lessons.length) {
    throw new Error('Lesson book must contain at least one lesson.');
  }

  const seenIds = new Set();
  const lessons = payload.lessons.map((rawLesson, index) => {
    if (!rawLesson || typeof rawLesson !== 'object' || Array.isArray(rawLesson)) {
      throw new Error(`Lesson ${index + 1} is invalid.`);
    }
    const id = String(rawLesson.id || '').trim() || `lesson-${index + 1}`;
    if (seenIds.has(id)) {
      throw new Error(`Lesson id ${id} is duplicated.`);
    }
    seenIds.add(id);
    return {
      id,
      lessonState: validateAndNormalizeLessonPayload({
        ...rawLesson,
        version: LESSON_FILE_VERSION,
      }),
    };
  });

  const activeLessonId = lessons.some((entry) => entry.id === payload.activeLessonId)
    ? String(payload.activeLessonId)
    : lessons[0].id;

  return {
    activeLessonId,
    nextId: deriveLessonBookCounter(lessons),
    lessons,
  };
}

function persistDraft() {
  const payload = buildDraftPayload();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function applyLessonState(lessonState, options = {}) {
  const { stopPlay = true } = options;
  if (stopPlay && state.play.active) {
    stopPlayGame({ reason: 'New position loaded.' });
  }
  cancelPlayEngineRequest('PGN/lesson state change');
  state.title = normalizeEditableText(lessonState.title);
  state.analysisTargetDepth = normalizeAnalysisTargetDepth(lessonState.analysisTargetDepth);
  state.boardOrientation = lessonState.boardOrientation;
  state.activeTab = normalizeActiveTab(lessonState.activeTab);
  state.setup.advancedOpen = lessonState.advancedOpen;
  state.toolsExpanded = Boolean(lessonState.toolsExpanded);
  state.pgnCommentsVisible = lessonState.pgnCommentsVisible !== false;
  state.pvLinesVisible = lessonState.pvLinesVisible !== false;
  state.setup.armedPiece = null;
  state.setup.pieces = lessonState.setup.pieces;
  state.setup.meta = lessonState.setup.meta;
  state.setupFen = lessonState.setupFen;
  state.setup.fenInput = lessonState.setupFen;
  state.setup.fenError = '';
  state.note = normalizeNoteState(lessonState.note);
  state.practice = createEmptyPracticeState();
  state.annotations.enabled = false;
  state.annotations.paintedSquares = new Set(lessonState.annotations?.paintedSquares || []);
  state.annotations.circledSquares = new Set(lessonState.annotations?.circledSquares || []);
  state.annotations.starredSquares = new Set(lessonState.annotations?.starredSquares || []);
  state.annotations.arrows = normalizeAnnotationArrows(lessonState.annotations?.arrows);
  state.annotations.suppressContextMenu = false;
  state.annotations.gesture = createEmptyAnnotationGestureState();
  state.boardDragHoverSquare = null;
  state.setupDrag = createEmptySetupDragState();
  assignAnalysisTree(lessonState.analysis);
}

function applyLessonBookState(lessonBookState) {
  state.lessonBook.activeLessonId = lessonBookState.activeLessonId;
  state.lessonBook.nextId = Math.max(
    1,
    Number(lessonBookState.nextId) || deriveLessonBookCounter(lessonBookState.lessons),
  );
  state.lessonBook.lessons = lessonBookState.lessons.map((entry) => ({
    id: entry.id,
    lessonState: cloneLessonState(entry.lessonState),
  }));
  const activeEntry = activeLessonBookEntry() || state.lessonBook.lessons[0];
  if (!activeEntry) {
    throw new Error('Lesson book is empty.');
  }
  state.lessonBook.activeLessonId = activeEntry.id;
  applyLessonState(cloneLessonState(activeEntry.lessonState));
}

function hydrateDraft() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    ensureLessonBookInitialized();
    return;
  }
  try {
    const draft = JSON.parse(raw);
    const guidedReviewActive = Boolean(draft?.guidedReviewActive);
    state.practicePreferenceKind = normalizePracticeKind(draft?.practiceKindPreference);
    if (draft?.version === LESSON_BOOK_FILE_VERSION && Array.isArray(draft?.lessons)) {
      applyLessonBookState(validateAndNormalizeLessonBookPayload(draft));
      state.guidedReview.active = guidedReviewActive;
      return;
    }
    if (draft && typeof draft === 'object' && !Array.isArray(draft) && draft.nodes && draft.rootId) {
      applyLessonState(validateAndNormalizeLessonPayload(draft));
      ensureLessonBookInitialized();
      state.guidedReview.active = guidedReviewActive;
      return;
    }

    const title = typeof draft?.title === 'string' ? normalizeEditableText(draft.title) : DEFAULT_TITLE;
    const analysisTargetDepth = normalizeAnalysisTargetDepth(draft?.analysisTargetDepth);
    const boardOrientation = draft?.boardOrientation === 'black' ? 'black' : 'white';
    const activeTab = normalizeActiveTab(draft?.activeTab);
    const advancedOpen = Boolean(draft?.advancedOpen);
    const toolsExpanded = Boolean(draft?.toolsExpanded);
    const pgnCommentsVisible = draft?.pgnCommentsVisible !== false;
    const pvLinesVisible = draft?.pvLinesVisible !== false;
    const normalizedSetup = normalizeSetupFenForLesson(typeof draft?.setupFen === 'string' ? draft.setupFen : DEFAULT_POSITION);
    const analysisHistory = Array.isArray(draft?.analysisHistory)
      ? draft.analysisHistory
          .filter((move) => move && typeof move.from === 'string' && typeof move.to === 'string')
          .map((move) => ({
            from: move.from,
            to: move.to,
            promotion: normalizePromotionValue(move.promotion),
            san: String(move.san || '').trim(),
          }))
      : [];
    const analysisCursor = Number.isFinite(draft?.analysisCursor)
      ? clamp(Math.trunc(draft.analysisCursor), 0, analysisHistory.length)
      : analysisHistory.length;

    applyLessonState({
      title,
      analysisTargetDepth,
      boardOrientation,
      activeTab,
      advancedOpen,
      toolsExpanded,
      pgnCommentsVisible,
      pvLinesVisible,
      setupFen: normalizedSetup.setupFen,
      setup: normalizedSetup.setup,
      analysis: buildLegacyAnalysisTree(analysisHistory, analysisCursor, normalizedSetup.setupFen),
      annotations: normalizeAnnotationState(draft?.annotations),
      note: normalizeNoteState(draft?.note),
    });
    ensureLessonBookInitialized();
    state.guidedReview.active = guidedReviewActive;
  } catch (error) {
    console.warn('Unable to restore draft.', error);
    ensureLessonBookInitialized();
  }
}

function downloadTextFile(fileName, text, mimeType) {
  const normalizedText = normalizeEditableText(text);
  const blobText = String(mimeType || '').toLowerCase().includes('text/csv') && !normalizedText.startsWith('\ufeff')
    ? `\ufeff${normalizedText}`
    : normalizedText;
  const blob = new Blob([blobText], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

function saveLessonFile() {
  ensureLessonBookInitialized();
  const lessonCount = state.lessonBook.lessons.length;
  const payload = lessonCount > 1 ? buildLessonBookPayload() : buildLessonPayload();
  const fileName = lessonCount > 1
    ? `${slugifyLessonTitle(state.title || 'lesson-book')}.lesson-book.json`
    : `${slugifyLessonTitle(state.title)}.lesson.json`;
  downloadTextFile(fileName, JSON.stringify(payload, null, 2), 'application/json');
  syncLessonFileStatus(`Saved ${fileName}${lessonCount > 1 ? ` with ${pluralize(lessonCount, 'lesson')}` : ''}.`);
}

async function openLessonFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Lesson file is not valid JSON.');
  }

  if (payload?.version === LESSON_BOOK_FILE_VERSION && Array.isArray(payload?.lessons)) {
    applyLessonBookState(validateAndNormalizeLessonBookPayload(payload));
  } else {
    const lessonState = validateAndNormalizeLessonPayload(payload);
    applyLessonState(lessonState);
    state.lessonBook = createSingleLessonBookState(lessonState);
  }
  state.guidedReview.active = false;
  syncAnalysisGameFromTree();
  renderAll();
  schedulePersist();
  syncLessonFileStatus(
    payload?.version === LESSON_BOOK_FILE_VERSION && Array.isArray(payload?.lessons)
      ? `Loaded ${file.name} with ${pluralize(state.lessonBook.lessons.length, 'lesson')}.`
      : `Loaded ${file.name}.`,
  );
}

function buildLessonStateFromImportedPgn(importedPgn) {
  const normalizedSetup = normalizeSetupFenForLesson(String(importedPgn?.setupFen || DEFAULT_POSITION).trim());
  const analysis = validateAndNormalizeLessonNodes(
    importedPgn?.analysis?.nodes,
    String(importedPgn?.analysis?.rootId || ROOT_NODE_ID).trim() || ROOT_NODE_ID,
    String(importedPgn?.analysis?.currentNodeId || ROOT_NODE_ID).trim() || ROOT_NODE_ID,
    normalizedSetup.setupFen,
  );
  analysis.headers = importedPgn?.headers || null;

  return {
    title: typeof importedPgn?.title === 'string' ? normalizeEditableText(importedPgn.title) : DEFAULT_TITLE,
    analysisTargetDepth: currentAnalysisTargetDepth(),
    boardOrientation: state.boardOrientation,
    activeTab: TAB_ANALYSIS,
    advancedOpen: false,
    toolsExpanded: true,
    pvLinesVisible: state.pvLinesVisible,
    setupFen: normalizedSetup.setupFen,
    setup: normalizedSetup.setup,
    analysis,
    annotations: normalizeAnnotationState(null),
    note: normalizeNoteState({ text: '', expanded: state.note.expanded }),
  };
}

function savePgnFile() {
  const fileName = `${slugifyLessonTitle(state.title)}.pgn`;
  const pgnText = buildPgnFromLessonTree({
    title: normalizeEditableText(state.title),
    setupFen: state.setupFen,
    rootId: state.analysis.rootId,
    nodes: state.analysis.nodes,
  });
  downloadTextFile(fileName, pgnText, 'application/x-chess-pgn');
  syncLessonFileStatus(`Exported ${fileName}.`);
}

async function openPgnFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  const games = splitPgnGames(text);

  if (games.length === 0) {
    throw new Error('No PGN games found.');
  }
  if (games.length === 1) {
    clearPendingPgnGames();
    const importedPgn = parsePgnToLessonTree(games[0]);
    const lessonState = buildLessonStateFromImportedPgn(importedPgn);
    applyLessonState(lessonState);
    ensureLessonBookInitialized();
    syncAnalysisGameFromTree();
    renderAll();
    schedulePersist();
    syncLessonFileStatus(`Imported ${file.name}.`);
  } else {
    state.loadedPgnGameIndex = null;
    showPgnGamePicker(games, file.name);
  }
}

function showPgnGamePicker(games, fileName) {
  state.pendingPgnGames = games;
  state.pendingPgnFileName = fileName;

  if (!dom.pgnGamePickerModal || !dom.pgnGamePickerList) {
    return;
  }

  if (dom.pgnGamePickerFileName) {
    dom.pgnGamePickerFileName.textContent = fileName || '';
  }

  // Clear previous list
  dom.pgnGamePickerList.innerHTML = '';

  games.forEach((gamePgn, index) => {
    const headers = extractPgnHeaders(gamePgn) || {};
    const whitePlayer = headers.White || '?';
    const blackPlayer = headers.Black || '?';
    const event = headers.Event || '?';
    const round = headers.Round || '?';
    const result = headers.Result || '*';
    const dateText = headers.Date && headers.Date !== '????.??.??' ? headers.Date : '';

    const isLoaded = state.loadedPgnGameIndex === index;

    const gameEl = document.createElement('div');
    gameEl.className = 'pgn-game-item';
    if (isLoaded) {
      gameEl.style.borderColor = 'var(--focus-border)';
      gameEl.style.backgroundColor = 'var(--accent-soft)';
    }

    const escapedDate = escapeHtml(dateText);
    const escapedWhite = escapeHtml(whitePlayer);
    const escapedBlack = escapeHtml(blackPlayer);
    const escapedResult = escapeHtml(result);
    const escapedEvent = escapeHtml(event);
    const escapedRound = escapeHtml(round);

    const tooltipLines = [];
    tooltipLines.push(`Game ${index + 1}`);
    tooltipLines.push(`White: ${whitePlayer}`);
    tooltipLines.push(`Black: ${blackPlayer}`);
    if (event && event !== '?') tooltipLines.push(`Event: ${event}`);
    if (round && round !== '?') tooltipLines.push(`Round: ${round}`);
    if (dateText) tooltipLines.push(`Date: ${dateText}`);
    if (result && result !== '*') tooltipLines.push(`Result: ${result}`);
    const rowTooltip = tooltipLines.join('\n');
    const escapedRowTooltip = escapeHtml(rowTooltip);

    gameEl.innerHTML = `
      <div class="pgn-game-item-content" title="${escapedRowTooltip}">
        <div class="pgn-game-title-row">
          <span class="pgn-game-title-text">
            Game ${index + 1}: ${escapedWhite} vs ${escapedBlack}
          </span>
          <span class="pgn-game-result">${escapedResult}</span>
        </div>
        <div class="pgn-game-meta-row">
          <span class="pgn-game-event-text">
            ${escapedEvent !== '?' ? escapedEvent : ''}
          </span>
          <span class="pgn-game-round-date">
            ${escapedRound !== '?' ? `Round ${escapedRound}` : ''}${escapedDate ? (escapedRound !== '?' ? ` · ${escapedDate}` : escapedDate) : ''}
          </span>
        </div>
      </div>
      <div class="pgn-game-item-actions">
        ${isLoaded 
          ? `<span class="loaded-badge" style="color: var(--accent-strong); font-weight: bold; font-size: 0.85rem; white-space: nowrap;">Currently loaded</span>` 
          : '<span></span>'}
        <button type="button" class="action-button primary load-game-btn" data-action="load-pgn-game" data-game-index="${index}" style="width: auto; margin-top: 0; flex-shrink: 0; padding: 0.35rem 0.75rem; min-height: 0; font-size: 0.85rem;">Load Game</button>
      </div>
    `;
    dom.pgnGamePickerList.appendChild(gameEl);
  });

  dom.pgnGamePickerModal.hidden = false;
  dom.pgnGamePickerModal.setAttribute('aria-hidden', 'false');
}

function closePgnGamePicker() {
  if (dom.pgnGamePickerModal) {
    dom.pgnGamePickerModal.hidden = true;
    dom.pgnGamePickerModal.setAttribute('aria-hidden', 'true');
  }
}

function clearPendingPgnGames() {
  state.pendingPgnGames = null;
  state.pendingPgnFileName = '';
  state.loadedPgnGameIndex = null;
  state.analysis.headers = null;
  closePgnGamePicker();
  syncPgnBrowseButton();
}

function syncPgnBrowseButton() {
  const hasPendingGames = Array.isArray(state.pendingPgnGames) && state.pendingPgnGames.length > 0;
  
  if (dom.importedPgnContainer) {
    dom.importedPgnContainer.style.display = hasPendingGames ? 'flex' : 'none';
  }
  
  if (hasPendingGames) {
    if (dom.importedPgnFileNameText) {
      dom.importedPgnFileNameText.textContent = state.pendingPgnFileName || '';
    }
    if (dom.importedPgnFileNameWrapper) {
      dom.importedPgnFileNameWrapper.title = state.pendingPgnFileName || '';
    }
    
    if (dom.importedPgnStatusText) {
      if (state.loadedPgnGameIndex !== null && state.pendingPgnGames[state.loadedPgnGameIndex]) {
        const gamePgn = state.pendingPgnGames[state.loadedPgnGameIndex];
        const headers = extractPgnHeaders(gamePgn) || {};
        const white = (headers.White && headers.White.trim()) || 'White';
        const black = (headers.Black && headers.Black.trim()) || 'Black';
        const resultVal = headers.Result ? headers.Result.trim() : '';
        const roundVal = headers.Round ? headers.Round.trim() : '';
        const dateVal = headers.Date ? headers.Date.trim() : '';
        const eventVal = headers.Event ? headers.Event.trim() : '';
        
        const tooltipLines = [];
        tooltipLines.push(`Game ${state.loadedPgnGameIndex + 1}`);
        tooltipLines.push(`White: ${white}`);
        tooltipLines.push(`Black: ${black}`);
        if (eventVal && eventVal !== '?') tooltipLines.push(`Event: ${eventVal}`);
        if (roundVal && roundVal !== '?' && roundVal !== '-') tooltipLines.push(`Round: ${roundVal}`);
        if (dateVal && dateVal !== '????.??.??' && dateVal !== '?') tooltipLines.push(`Date: ${dateVal}`);
        if (resultVal && resultVal !== '?' && resultVal !== '*') tooltipLines.push(`Result: ${resultVal}`);
        if (state.pendingPgnFileName) tooltipLines.push(`File: ${state.pendingPgnFileName}`);
        
        const tooltipText = tooltipLines.join('\n');
        const escapedTooltip = escapeHtml(tooltipText);
        
        const escapedWhite = escapeHtml(white);
        const escapedBlack = escapeHtml(black);
        const escapedResult = escapeHtml(resultVal || '*');
        
        dom.importedPgnStatusText.innerHTML = `
          <div class="imported-pgn-title" title="${escapedTooltip}">
            Game ${state.loadedPgnGameIndex + 1}: ${escapedWhite} vs ${escapedBlack} · ${escapedResult}
          </div>
        `;
      } else {
        const tooltipLines = [];
        tooltipLines.push(`Games Available: ${state.pendingPgnGames.length}`);
        if (state.pendingPgnFileName) tooltipLines.push(`File: ${state.pendingPgnFileName}`);
        const tooltipText = tooltipLines.join('\n');
        
        dom.importedPgnStatusText.innerHTML = `
          <div title="${escapeHtml(tooltipText)}">
            <strong>${state.pendingPgnGames.length} games imported</strong>
          </div>
          <div style="font-style: italic; color: var(--text-soft);">No game currently loaded</div>
        `;
      }
    }
  }
}

async function loadSelectedPgnGame(gamePgnText, fileName, gameNumber) {
  try {
    state.loadedPgnGameIndex = gameNumber - 1;
    const importedPgn = parsePgnToLessonTree(gamePgnText);
    const lessonState = buildLessonStateFromImportedPgn(importedPgn);
    applyLessonState(lessonState);
    ensureLessonBookInitialized();
    syncAnalysisGameFromTree();
    renderAll();
    schedulePersist();
    syncLessonFileStatus(`Imported Game ${gameNumber} from ${fileName}.`);
    closePgnGamePicker();
  } catch (error) {
    console.error('Unable to import selected PGN game.', error);
    syncLessonFileStatus(error?.message || 'Unable to import selected PGN game.');
    alert(`Failed to load Game ${gameNumber}: ${error?.message || 'Invalid PGN content'}`);
  }
}

function renderGuidedReviewVisibility() {
  const active = Boolean(state.guidedReview.active);
  renderGuidedReviewAnalysisPanel();
  if (dom.guidedReviewPanel) {
    dom.guidedReviewPanel.hidden = !active;
  }
  if (dom.notationSection) {
    dom.notationSection.hidden = active;
  }
  renderWorkspaceTools();
}

function setGuidedReviewActive(active) {
  state.guidedReview.active = Boolean(active);
  if (state.guidedReview.active) {
    if (state.activeTab !== TAB_LESSONS) {
      state.previousNonLessonTab = state.activeTab;
    }
    state.activeTab = TAB_LESSONS;
  } else {
    state.activeTab = state.previousNonLessonTab || TAB_PLAY;
  }
  renderGuidedReviewVisibility();
  schedulePersist();
  renderAll();
}

function updateGuidedReviewTitle(title) {
  state.title = normalizeEditableText(title || '');
  if (dom.titleInput) {
    dom.titleInput.value = state.title;
  }
  renderLessonBookControls();
  if (dom.boardTitleDisplay) {
    dom.boardTitleDisplay.textContent = state.title.trim() || 'Untitled position';
  }
  schedulePersist();
}

function loadGuidedReviewFenToBoard(fen) {
  const normalizedFen = String(fen || '').trim().replace(/\s+/g, ' ');
  if (!normalizedFen) {
    return { ok: false, error: 'This row has no FEN value.' };
  }

  const validation = validateFen(normalizedFen);
  if (!validation.ok) {
    return { ok: false, error: validation.error || 'FEN is invalid.' };
  }

  try {
    const game = new Chess(normalizedFen);
    const parsed = parseFenLike(game.fen());
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    state.activeTab = TAB_ANALYSIS;
    commitSetupState(parsed.pieces, parsed.meta, { syncFenInput: true, resetAnalysis: true });
    renderBoard();
    renderHeaderMeta();
    renderHeroBanner();
    renderAnalysisPanel();
    renderPromotionModal();
    return { ok: true, fen: state.setupFen };
  } catch (error) {
    return { ok: false, error: error?.message || 'Unable to load that FEN.' };
  }
}

function guidedReviewAnalysisContext(fen) {
  const rowFen = normalizeFenForTablebase(fen);
  const currentFen = normalizeFenForTablebase(state.analysis.currentFen);
  if (!rowFen || !currentFen || rowFen !== currentFen) {
    return {};
  }

  const parsed = parseFenLike(rowFen);
  const tablebaseResult = currentTablebaseResultForDisplay();
  const tablebaseLines = tablebaseResult?.moves?.length
    ? tablebaseResult.moves
      .filter((entry) => entry.line || entry.san)
      .map((entry) => `TB ${entry.index}: ${entry.line || entry.san} (${entry.evalLabel || entry.resultLabel || 'Tablebase'})`)
    : [];
  const engineLines = hasVisibleEnginePvLines()
    ? state.engine.pvLines
      .filter((entry) => entry.line)
      .map((entry) => `PV ${entry.index}: ${entry.line} (${entry.evalLabel || 'no eval'}, depth ${entry.depth ?? 'unknown'})`)
    : [];
  const stockfishBestMove = state.engine.bestMove
    ? (uciMovesToSan(rowFen, [state.engine.bestMove])[0] || state.engine.bestMove)
    : '';
  const stockfishSummary = !tablebaseResult && (engineLines.length || stockfishBestMove)
    ? [
        state.engine.summary,
        stockfishBestMove ? `Best move: ${stockfishBestMove}` : '',
        ...engineLines,
      ].filter(Boolean).join(' | ')
    : '';
  const tablebaseSummary = tablebaseResult
    ? [
        tablebaseResult.summary,
        ...tablebaseLines,
      ].filter(Boolean).join(' | ')
    : '';

  return {
    side_to_move: parsed.ok ? parsed.meta.activeColor : '',
    best_move: tablebaseResult?.moves?.[0]?.line || tablebaseResult?.moves?.[0]?.san || stockfishBestMove,
    stockfish_summary: stockfishSummary,
    tablebase_summary: tablebaseSummary,
  };
}

function initializeGuidedReviewController() {
  guidedReviewController = createGuidedReviewController({
    host: dom.guidedReviewPanel,
    fileInput: dom.guidedReviewFileInput,
    callbacks: {
      setActive: setGuidedReviewActive,
      loadFenToBoard: loadGuidedReviewFenToBoard,
      updateTitle: updateGuidedReviewTitle,
      downloadText: downloadTextFile,
      setStatus: syncLessonFileStatus,
      getAnalysisContext: guidedReviewAnalysisContext,
    },
  });
}

function commitSetupState(pieces, meta, options = {}) {
  const { syncFenInput = true, resetAnalysis = true } = options;
  const sanitized = sanitizeSetupState(pieces, meta);
  state.setup.pieces = sanitized.pieces;
  state.setup.meta = sanitized.meta;
  state.setupFen = buildFenFromPiecesAndMeta(sanitized.pieces, sanitized.meta);
  if (syncFenInput) {
    state.setup.fenInput = state.setupFen;
  }
  state.setup.fenError = '';
  if (resetAnalysis) {
    resetAnalysisToSetup({
      keepTab: true,
    });
  }
  schedulePersist();
}

function parseStrictFenInput(value) {
  const fen = String(value || '').trim().replace(/\s+/g, ' ');
  const validation = validateFen(fen);
  if (!validation.ok) {
    return { ok: false, error: validation.error || 'FEN is invalid.' };
  }
  try {
    const game = new Chess(fen);
    const parsed = parseFenLike(game.fen());
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    return { ok: true, pieces: parsed.pieces, meta: parsed.meta };
  } catch (error) {
    return { ok: false, error: error?.message || 'Unable to apply that FEN.' };
  }
}

function commitStrictFenInput(value, options = {}) {
  const { render = true, showError = true } = options;
  const parsed = parseStrictFenInput(value);
  if (!parsed.ok) {
    if (showError) {
      state.setup.fenError = parsed.error;
      renderHeroBanner();
      renderSetupPanel();
    }
    return false;
  }
  commitSetupState(parsed.pieces, parsed.meta, { syncFenInput: true, resetAnalysis: true });
  if (render) {
    renderAll();
  }
  return true;
}

function applyStrictFenInput() {
  commitStrictFenInput(state.setup.fenInput, { render: true, showError: true });
}

async function scanBoardImage(file) {
  state.setup.scanStatus = 'Scanning board...';
  state.setup.scanStatusType = 'warning';
  state.setup.fenError = '';
  renderSetupPanel();

  try {
    const response = await fetch('http://127.0.0.1:8765/predict-fen', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file
    });

    if (!response.ok) {
      let errorMsg = 'Scan failed. Please try a clearer image.';
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) {
          errorMsg = `Scan failed: ${errJson.error}`;
        }
      } catch (e) {}
      state.setup.scanStatus = errorMsg;
      state.setup.scanStatusType = 'danger';
      renderSetupPanel();
      return;
    }

    const data = await response.json();
    if (!data || !data.placement) {
      state.setup.scanStatus = 'Scan failed. Please try a clearer image.';
      state.setup.scanStatusType = 'danger';
      renderSetupPanel();
      return;
    }

    const placement = compressFen(data.placement);
    const activeColor = state.setup.meta.activeColor === 'b' ? 'b' : 'w';
    const fullFen = `${placement} ${activeColor} - - 0 1`;

    state.setup.fenInput = fullFen;
    const applied = commitStrictFenInput(fullFen, { render: true, showError: false });
    if (applied) {
      state.setup.scanStatus = 'FEN detected. Please verify the board.';
      state.setup.scanStatusType = 'success';
      state.setup.fenError = '';
    } else {
      state.setup.scanStatus = 'Scan failed. Please try a clearer image.';
      state.setup.scanStatusType = 'danger';
    }
    renderSetupPanel();
  } catch (error) {
    console.error('Scan board error:', error);
    state.setup.scanStatus = 'Scanner helper is not running. Start the local scanner server first.';
    state.setup.scanStatusType = 'danger';
    renderSetupPanel();
  }
}

function compressFen(raw) {
  const rows = raw.trim().split('/');
  const fixedRows = rows.map(row => {
    let empty = 0;
    let fixed = '';
    for (const ch of row) {
      if (ch === '1') {
        empty += 1;
      } else {
        if (empty > 0) {
          fixed += empty;
          empty = 0;
        }
        fixed += ch;
      }
    }
    if (empty > 0) {
      fixed += empty;
    }
    return fixed;
  });
  return fixedRows.join('/');
}

function autoApplyPastedFenInput() {
  if (commitStrictFenInput(state.setup.fenInput, { render: true, showError: false })) {
    syncLessonFileStatus('Pasted FEN applied.');
  }
}

function handleDocumentPaste(event) {
  if (event.target?.id !== 'fenInput') {
    return;
  }
  window.setTimeout(() => {
    const fenInput = document.getElementById('fenInput');
    if (!fenInput) {
      return;
    }
    state.setup.fenInput = fenInput.value;
    autoApplyPastedFenInput();
  }, 0);
}

function resetFenDraft() {
  state.setup.fenInput = state.setupFen;
  state.setup.fenError = '';
  state.setup.scanStatus = '';
  state.setup.scanStatusType = '';
  renderHeroBanner();
  renderSetupPanel();
}

function updateSetupFromBoardMutation(mutator) {
  state.setup.scanStatus = '';
  state.setup.scanStatusType = '';
  const nextPieces = { ...state.setup.pieces };
  mutator(nextPieces);
  commitSetupState(nextPieces, cloneMeta(state.setup.meta), { syncFenInput: true, resetAnalysis: true });
  renderAll();
}

function clearBoard() {
  updateSetupFromBoardMutation((pieces) => {
    Object.entries(pieces).forEach(([square, piece]) => {
      if (piece === 'K' || piece === 'k') {
        return;
      }
      delete pieces[square];
    });
  });
}

function resetSetupPosition() {
  const parsed = parseFenLike(DEFAULT_POSITION);
  if (!parsed.ok) {
    return;
  }
  commitSetupState(parsed.pieces, parsed.meta, { syncFenInput: true, resetAnalysis: true });
  renderAll();
}

function placeSetupPiece(square, piece, fromSquare = null) {
  updateSetupFromBoardMutation((pieces) => {
    if (fromSquare && fromSquare !== square) {
      delete pieces[fromSquare];
    }
    if (piece === 'eraser') {
      delete pieces[square];
    } else {
      pieces[square] = piece;
    }
  });
}

function removeSetupPiece(square) {
  if (!state.setup.pieces[square]) {
    return;
  }
  updateSetupFromBoardMutation((pieces) => {
    delete pieces[square];
  });
}

function flipBoard() {
  state.boardOrientation = state.boardOrientation === 'white' ? 'black' : 'white';
  renderBoard();
  renderHeaderMeta();
  schedulePersist();
}

function setPaletteColor(color) {
  if (!['w', 'b'].includes(color)) {
    return;
  }
  state.setup.paletteColor = color;
  if (state.setup.armedPiece && state.setup.armedPiece !== 'eraser') {
    const upper = state.setup.armedPiece.toUpperCase();
    state.setup.armedPiece = color === 'w' ? upper : upper.toLowerCase();
  }
  renderSetupPanel();
  schedulePersist();
}

function toggleArmedPiece(piece) {
  state.setup.scanStatus = '';
  state.setup.scanStatusType = '';
  state.setup.armedPiece = state.setup.armedPiece === piece ? null : piece;
  renderSetupPanel();
}

function currentPalettePieces() {
  return PIECE_ORDER.map((piece) => (state.setup.paletteColor === 'w' ? piece : piece.toLowerCase()));
}

function setSetupActiveColor(color) {
  const nextMeta = cloneMeta(state.setup.meta);
  nextMeta.activeColor = color === 'b' ? 'b' : 'w';
  commitSetupState({ ...state.setup.pieces }, nextMeta, { syncFenInput: true, resetAnalysis: true });
  renderAfterSetupMetaChange();
}

function updateCastlingRight(flag, enabled) {
  const rights = parseCastlingRights(state.setup.meta.castling);
  if (enabled) {
    rights.add(flag);
  } else {
    rights.delete(flag);
  }
  const nextMeta = cloneMeta(state.setup.meta);
  nextMeta.castling = castlingStringFromRights(rights);
  commitSetupState({ ...state.setup.pieces }, nextMeta, { syncFenInput: true, resetAnalysis: true });
  renderAfterSetupMetaChange();
}

function updateEnPassantSquare(square) {
  const nextMeta = cloneMeta(state.setup.meta);
  nextMeta.enPassant = square || '-';
  commitSetupState({ ...state.setup.pieces }, nextMeta, { syncFenInput: true, resetAnalysis: true });
  renderAfterSetupMetaChange();
}

function clearAnalysisSelection() {
  state.analysis.selectedSquare = null;
  state.analysis.legalMoves = [];
}

function analysisShouldFollowPositionChanges() {
  return (state.engine.analyzing && !state.engine.stopping) || state.engine.loading;
}

function resetAnalysisOutput(options = {}) {
  const { keepReady = true, summary = defaultAnalysisSummary() } = options;
  if (state.engine.worker && state.engine.analyzing) {
    state.engine.worker.postMessage('stop');
  }
  clearTablebaseDisplay();
  state.engine.loading = false;
  state.engine.analyzing = false;
  state.engine.stopping = false;
  state.engine.searchFen = '';
  state.engine.pendingFen = '';
  state.engine.searchMode = '';
  state.engine.pendingSearchMode = '';
  state.engine.summaryPrefix = '';
  clearEngineContinuationState();
  state.engine.summary = summary;
  state.engine.evalRailVisible = false;
  clearEngineSearchData();
  if (!keepReady) {
    state.engine.ready = false;
  }
}

function allocateAnalysisNodeId() {
  let candidate = `n${state.analysis.nodeCounter}`;
  while (state.analysis.nodes[candidate]) {
    state.analysis.nodeCounter += 1;
    candidate = `n${state.analysis.nodeCounter}`;
  }
  state.analysis.nodeCounter += 1;
  return candidate;
}

function syncAnalysisGameFromTree(options = {}) {
  const { resetEngine = true } = options;
  clearAnalysisSelection();
  state.analysis.pendingPromotion = null;
  if (!canAnalyzeCurrentSetup()) {
    state.analysis.game = null;
    state.analysis.currentFen = state.setupFen;
    state.analysis.lastMoveSquares = [];
    state.analysis.boardMessage = 'Fix the setup to enable legal-move analysis.';
    if (resetEngine) {
      resetAnalysisOutput({ summary: defaultAnalysisSummary() });
    }
    return;
  }

  const rootNode = getAnalysisNode(state.analysis.rootId);
  if (!rootNode || rootNode.fen !== state.setupFen) {
    assignAnalysisTree(createEmptyAnalysisTree(state.setupFen));
  }

  let currentNode = getCurrentAnalysisNode();
  if (!currentNode) {
    state.analysis.currentNodeId = state.analysis.rootId;
    currentNode = getCurrentAnalysisNode();
  }

  try {
    state.analysis.game = new Chess(currentNode.fen);
    state.analysis.currentFen = currentNode.fen;
  } catch {
    state.analysis.currentNodeId = state.analysis.rootId;
    currentNode = getCurrentAnalysisNode();
    state.analysis.game = new Chess(currentNode.fen);
    state.analysis.currentFen = currentNode.fen;
  }

  if (currentNode?.parentId) {
    state.analysis.lastMoveSquares = [currentNode.from, currentNode.to];
    state.analysis.boardMessage = `Current move: ${currentNode.san}.`;
  } else {
    state.analysis.lastMoveSquares = [];
    state.analysis.boardMessage = 'Select a piece belonging to the side to move.';
  }
  if (state.practice.active) {
    syncPracticeBoardMessage();
  }
  if (resetEngine) {
    resetAnalysisOutput({ summary: defaultAnalysisSummary() });
  }
}

function jumpToAnalysisNode(nodeId, options = {}) {
  const { syncSelection = true } = options;
  const nextNode = getAnalysisNode(nodeId);
  if (!nextNode) {
    return;
  }
  const wasAnalysisActive = analysisShouldFollowPositionChanges() || state.tablebase.probing || tablebaseResultActive();
  const shouldKeepAnalysisLive = analysisShouldFollowPositionChanges();
  if (state.activeTab === TAB_SETUP && countAnalysisMoveNodes()) {
    state.activeTab = TAB_ANALYSIS;
  }
  if (syncSelection) {
    applyAnalysisPathSelection(nodeId);
  }
  state.analysis.currentNodeId = nodeId;
  syncAnalysisGameFromTree({ resetEngine: !(shouldKeepAnalysisLive || wasAnalysisActive) });
  if (shouldKeepAnalysisLive) {
    state.analysis.boardMessage = 'Stockfish is following the selected lesson position.';
    queueEngineSearchForFen(state.analysis.currentFen, { preserveDisplay: true });
  } else if (wasAnalysisActive) {
    if (isTablebaseEligibleFen(state.analysis.currentFen)) {
      void startTablebaseAnalysisForFen(state.analysis.currentFen, { fallbackToEngine: true, preserveDisplay: false });
    } else {
      void startStockfishAnalysisForCurrentPosition();
    }
  }
  schedulePersist();
  renderAll();
}

function navigateToAnalysisStart() {
  if (state.practice.active) {
    return;
  }
  jumpToAnalysisNode(state.analysis.rootId);
}

function navigateToAnalysisParent() {
  if (state.practice.active) {
    return;
  }
  const currentNode = getCurrentAnalysisNode();
  if (!currentNode?.parentId) {
    return;
  }
  jumpToAnalysisNode(currentNode.parentId);
}

function navigateToAnalysisForward() {
  if (state.practice.active) {
    return;
  }
  const nextNodeId = getAnalysisNextNodeId();
  if (!nextNodeId) {
    return;
  }
  jumpToAnalysisNode(nextNodeId);
}

function navigateToAnalysisEnd() {
  if (state.practice.active) {
    return;
  }
  let cursorId = state.analysis.currentNodeId;
  let nextNodeId = getAnalysisNextNodeId(cursorId);
  if (!nextNodeId) {
    return;
  }

  while (nextNodeId) {
    cursorId = nextNodeId;
    nextNodeId = getAnalysisNextNodeId(cursorId);
  }

  jumpToAnalysisNode(cursorId);
}

function resetAnalysisToSetup(options = {}) {
  const { keepTab = true } = options;
  state.practice = createEmptyPracticeState();
  assignAnalysisTree(createEmptyAnalysisTree(state.setupFen));
  syncAnalysisGameFromTree();
  state.engine.evalRailVisible = true;
  if (!keepTab) {
    state.activeTab = TAB_ANALYSIS;
  }
  schedulePersist();
}

function setPracticeFeedback(message, kind = 'warning') {
  state.practice.feedback = String(message || '');
  state.practice.feedbackKind = kind;
}

function practiceMoveMatchesExpectedNode(move, expectedNode) {
  return Boolean(
    move
    && expectedNode
    && move.from === expectedNode.from
    && move.to === expectedNode.to
    && normalizePromotionValue(move.promotion) === normalizePromotionValue(expectedNode.promotion),
  );
}

function formatPracticeMoveLabel(move) {
  if (!move) {
    return 'that move';
  }
  const from = String(move.from || '').trim().toLowerCase();
  const to = String(move.to || '').trim().toLowerCase();
  const promotion = normalizePromotionValue(move.promotion);
  try {
    const replay = new Chess(state.analysis.currentFen);
    const applied = replay.move({ from, to, promotion });
    return applied?.san || `${from}${to}${promotion || ''}`;
  } catch {
    return `${from}${to}${promotion || ''}`;
  }
}

function findMatchingPracticeNode(move) {
  if (!move) {
    return null;
  }
  return getPracticeCandidateNodes().find((candidateNode) => practiceMoveMatchesExpectedNode(move, candidateNode)) || null;
}

function practiceHintTextForNode(expectedNode) {
  if (!expectedNode) {
    return 'No hint is available for this position.';
  }
  if (expectedNode.san === 'O-O' || expectedNode.san === 'O-O-O') {
    return `Hint: ${state.analysis.game?.turn() === 'b' ? 'Black' : 'White'} castles.`;
  }
  const piece = state.analysis.game?.get(expectedNode.from);
  if (!piece) {
    return `Hint: the move starts from ${expectedNode.from}.`;
  }
  return `Hint: ${state.analysis.game?.turn() === 'b' ? 'Black' : 'White'} ${PIECE_LABELS[piece.type.toUpperCase()]} from ${expectedNode.from}.`;
}

function practiceHintText() {
  const candidateNodes = getPracticeCandidateNodes();
  if (!candidateNodes.length) {
    return 'No hint is available for this position.';
  }
  if (candidateNodes.length === 1) {
    return practiceHintTextForNode(candidateNodes[0]);
  }

  const uniqueFromSquares = Array.from(new Set(candidateNodes.map((node) => node.from).filter(Boolean)));
  if (uniqueFromSquares.length === 1) {
    const fromSquare = uniqueFromSquares[0];
    const piece = state.analysis.game?.get(fromSquare);
    if (!piece) {
      return `Hint: every recorded move starts from ${fromSquare}.`;
    }
    return `Hint: every recorded move starts with ${state.analysis.game?.turn() === 'b' ? 'Black' : 'White'} ${PIECE_LABELS[piece.type.toUpperCase()]} from ${fromSquare}.`;
  }

  return getPracticePreferredChildNode()
    ? 'Hint: multiple recorded continuations are accepted here. Reveal move will follow the saved preferred branch.'
    : 'Hint: multiple recorded continuations are accepted here.';
}

function stopPracticeSession() {
  if (!state.practice.active) {
    return;
  }
  state.practice = createEmptyPracticeState();
  clearAnalysisSelection();
  dismissPromotionDialog();
  state.engine.evalRailVisible = true;
  syncAnalysisGameFromTree({ resetEngine: false });
  renderAll();
}

function startPracticeSession(options = {}) {
  const practiceKind = normalizePracticeKind(options.kind ?? state.practicePreferenceKind);
  const branchRootNodeId = String(options.branchRootNodeId || state.analysis.currentNodeId || state.analysis.rootId).trim() || state.analysis.rootId;
  const lineNodeIds = practiceKind === PRACTICE_KIND_LINE ? buildDisplayedLineNodeIds(state.analysis.rootId) : [];
  const branchReady = practiceKind === PRACTICE_KIND_BRANCH ? branchPracticeReady(branchRootNodeId) : false;
  if (practiceKind === PRACTICE_KIND_LINE && lineNodeIds.length < 2) {
    syncLessonFileStatus('Record at least one move on the selected lesson line before starting practice.');
    renderAnalysisPanel();
    return;
  }
  if (practiceKind === PRACTICE_KIND_BRANCH && !branchReady) {
    syncLessonFileStatus('Jump to a lesson position with at least one recorded continuation before starting a branch drill.');
    renderAnalysisPanel();
    return;
  }

  state.practice = createEmptyPracticeState();
  state.practice.active = true;
  state.practice.kind = practiceKind;
  state.practice.branchRootNodeId = practiceKind === PRACTICE_KIND_BRANCH ? branchRootNodeId : state.analysis.rootId;
  state.practice.lineNodeIds = lineNodeIds;
  setPracticeFeedback(
    practiceKind === PRACTICE_KIND_BRANCH
      ? 'Branch drill started. Recorded continuations stay hidden until you solve them.'
      : 'Practice started. Future moves stay hidden until you solve them.',
    'warning',
  );
  state.activeTab = TAB_ANALYSIS;
  state.toolsExpanded = true;
  clearAnalysisSelection();
  dismissPromotionDialog();
  resetAnalysisOutput({ keepReady: true, summary: defaultAnalysisSummary() });
  state.engine.evalRailVisible = false;
  state.analysis.currentNodeId = state.practice.branchRootNodeId;
  syncAnalysisGameFromTree({ resetEngine: false });
  schedulePersist();
  renderAll();
}

function restartPracticeSession() {
  startPracticeSession({
    kind: state.practice.active ? state.practice.kind : state.practicePreferenceKind,
    branchRootNodeId: state.practice.active ? state.practice.branchRootNodeId : state.analysis.currentNodeId,
  });
}

function requestPracticeHint() {
  if (!state.practice.active || practiceComplete()) {
    return;
  }
  setPracticeFeedback(practiceHintText(), 'warning');
  syncPracticeBoardMessage();
  renderNotationPanel();
  renderAnalysisPanel();
}

function revealPracticeMove() {
  if (!state.practice.active) {
    return;
  }
  const revealedNode = state.practice.kind === PRACTICE_KIND_BRANCH
    ? getPracticePreferredChildNode()
    : getPracticeExpectedNode();
  if (!revealedNode) {
    return;
  }
  state.practice.positionIndex += 1;
  state.practice.revealedCount += 1;
  const completesPractice = practiceWillCompleteAfterAdvance(revealedNode);
  setPracticeFeedback(
    completesPractice
      ? `Revealed ${revealedNode.san}. Practice complete.`
      : `Revealed ${revealedNode.san}. Continue with the next move.`,
    completesPractice ? 'success' : 'warning',
  );
  jumpToAnalysisNode(revealedNode.id, { syncSelection: state.practice.kind !== PRACTICE_KIND_BRANCH });
}

function submitPracticeMove(move) {
  if (!state.practice.active) {
    applyAnalysisMove(move);
    return;
  }
  clearAnalysisSelection();
  if (practiceComplete()) {
    setPracticeFeedback('This practice session is already complete.', 'success');
    syncPracticeBoardMessage();
    renderAll();
    return;
  }
  const matchedNode = findMatchingPracticeNode(move);
  if (matchedNode) {
    state.practice.positionIndex += 1;
    state.practice.correctCount += 1;
    const completesPractice = practiceWillCompleteAfterAdvance(matchedNode);
    setPracticeFeedback(
      completesPractice
        ? `Correct: ${matchedNode.san}. Practice complete.`
        : `Correct: ${matchedNode.san}.`,
      'success',
    );
    jumpToAnalysisNode(matchedNode.id, { syncSelection: state.practice.kind !== PRACTICE_KIND_BRANCH });
    return;
  }
  state.practice.incorrectCount += 1;
  setPracticeFeedback(
    state.practice.kind === PRACTICE_KIND_BRANCH
      ? `Not a recorded continuation: ${formatPracticeMoveLabel(move)}. Try again.`
      : `Not this line: ${formatPracticeMoveLabel(move)}. Try again.`,
    'danger',
  );
  syncPracticeBoardMessage();
  renderAll();
}

function formatScoreLabel(scoreType, scoreValue) {
  const numeric = Number(scoreValue);
  if (!Number.isFinite(numeric)) {
    return '0.00';
  }
  if (scoreType === 'mate') {
    return numeric > 0 ? `M${numeric}` : `-M${Math.abs(numeric)}`;
  }
  const pawns = (numeric / 100).toFixed(2);
  return numeric >= 0 ? `+${pawns}` : pawns;
}

function normalizeScoreToWhitePerspective(scoreType, scoreValue, fen) {
  const numeric = Number(scoreValue);
  if (!Number.isFinite(numeric)) {
    return {
      scoreType,
      scoreValue: null,
    };
  }
  const parsed = parseFenLike(fen);
  const multiplier = parsed.ok && parsed.meta.activeColor === 'b' ? -1 : 1;
  return {
    scoreType,
    scoreValue: numeric * multiplier,
  };
}

function scoreToWhiteFraction(scoreType, scoreValue) {
  const numeric = Number(scoreValue);
  if (!Number.isFinite(numeric)) {
    return 0.5;
  }
  if (scoreType === 'mate') {
    return numeric > 0 ? 0.98 : 0.02;
  }
  return clamp(0.5 + numeric / 1200, 0.06, 0.94);
}

function formatNodeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }
  if (numeric >= 1_000_000) {
    return `${(numeric / 1_000_000).toFixed(1)}M`;
  }
  if (numeric >= 1_000) {
    return `${(numeric / 1_000).toFixed(1)}k`;
  }
  return `${Math.round(numeric)}`;
}

function currentAnalyzeButtonLabel() {
  if (state.tablebase.probing) {
    return 'Probing...';
  }
  if (state.engine.loading) {
    return 'Loading...';
  }
  if (state.engine.stopping) {
    return 'Stopping...';
  }
  if (state.engine.analyzing) {
    return 'Stop';
  }
  if (tablebaseResultActive()) {
    return 'Analyze';
  }
  return hasAnalysisContinuationAvailable() ? 'Continue' : 'Analyze';
}

function analyzeButtonAccessibleLabel(label) {
  if (label === 'Stop') {
    return 'Stop analysis';
  }
  if (label === 'Continue') {
    return 'Continue analysis';
  }
  return label || 'Analyze';
}

function analysisToggleDisabled(hasBoard = Boolean(state.analysis.game)) {
  return state.practice.active || !hasBoard || state.tablebase.probing || state.engine.loading || state.engine.stopping;
}

function syncAnalyzeButtonState(button, options = {}) {
  if (!button) {
    return;
  }
  const { iconOnly = false, hasBoard = Boolean(state.analysis.game) } = options;
  const label = currentAnalyzeButtonLabel();
  const accessibleLabel = analyzeButtonAccessibleLabel(label);
  if (!iconOnly) {
    button.textContent = label;
  }
  button.disabled = analysisToggleDisabled(hasBoard);
  button.classList.toggle('primary', !state.engine.analyzing && !state.engine.stopping);
  button.classList.toggle('danger', state.engine.analyzing || state.engine.stopping);
  button.classList.toggle('is-analyzing', state.engine.analyzing || state.engine.stopping);
  button.classList.toggle('is-loading', state.tablebase.probing || state.engine.loading);
  button.setAttribute('aria-label', accessibleLabel);
  button.setAttribute('title', accessibleLabel);
  button.setAttribute('aria-pressed', state.engine.analyzing ? 'true' : 'false');
}

function currentPvPlaceholderText() {
  if (state.tablebase.probing) {
    return 'Probing tablebase moves...';
  }
  if (tablebaseResultActive()) {
    return 'No tablebase move is available.';
  }
  if (state.engine.loading) {
    return 'Loading engine line...';
  }
  if (state.engine.stopping) {
    return 'Stopping analysis...';
  }
  if (state.engine.analyzing) {
    if (state.engine.searchMode === ENGINE_SEARCH_MODE_CONTINUE) {
      return Number.isFinite(state.engine.searchTargetDepth)
        ? `Continuing analysis past depth ${state.engine.searchTargetDepth}...`
        : 'Continuing analysis from the current board position...';
    }
    return '';
  }
  return 'No principal variation yet.';
}

function hasVisibleEnginePvLines() {
  return state.engine.pvLines.some((entry) => entry.line);
}

function hasVisibleAnalysisLines() {
  if (state.tablebase.probing) {
    return true;
  }
  const tablebaseResult = currentTablebaseResultForDisplay();
  if (tablebaseResult) {
    return tablebaseResult.moves.length > 0;
  }
  return hasVisibleEnginePvLines();
}

function renderTablebaseLineListMarkup() {
  const tablebaseResult = currentTablebaseResultForDisplay();
  const moves = tablebaseResult ? tablebaseResult.moves : [];
  const entries = moves.length
    ? moves
    : Array.from({ length: ENGINE_MULTI_PV_COUNT }, (_, index) => ({
        index: index + 1,
        san: '',
        resultLabel: 'Pending',
        evalLabel: '',
        dtm: null,
        dtz: null,
        categoryLabel: 'Pending',
        line: '',
      }));
  const emptyText = currentPvPlaceholderText();
  return `
    <div class="pv-line-list">
      ${entries.map((entry) => {
        const moveText = (entry.line || entry.san)
          ? (entry.line || entry.san)
          : emptyText;
        return `
          <div class="pv-line ${entry.san ? '' : 'is-empty'}">
            <div class="pv-line-head">
              <span class="pv-line-index">TB ${entry.index}</span>
              <span class="pv-line-depth">Line</span>
              <span class="pv-line-score">${escapeHtml(entry.evalLabel || entry.resultLabel || 'Pending')}</span>
            </div>
            <div class="pv-line-text">${escapeHtml(moveText)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPvLineListMarkup() {
  if (tablebaseDisplayActive()) {
    return renderTablebaseLineListMarkup();
  }
  const emptyText = currentPvPlaceholderText();
  const isStale = !state.engine.depth || state.engine.searchFen !== state.analysis.currentFen;
  return `
    <div class="pv-line-list ${isStale ? 'is-stale' : ''}">
      ${state.engine.pvLines.map((entry) => `
        <div class="pv-line ${entry.line ? '' : 'is-empty'}">
          <div class="pv-line-head">
            <span class="pv-line-index">PV ${entry.index}</span>
            <span class="pv-line-depth">Depth ${entry.depth ?? '—'}</span>
            <span class="pv-line-score">${escapeHtml(entry.evalLabel || 'Pending')}</span>
          </div>
          <div class="pv-line-text">${escapeHtml(entry.line || emptyText)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderGuidedReviewAnalysisPanel() {
  if (!dom.guidedReviewAnalysisPanel) {
    return;
  }

  const hasBoard = Boolean(state.analysis.game);
  const shouldShow = Boolean(
    state.guidedReview.active
    && hasBoard
    && !state.practice.active
    && state.pvLinesVisible
    && (
      state.tablebase.probing
      || state.engine.loading
      || state.engine.stopping
      || state.engine.analyzing
      || hasVisibleAnalysisLines()
    ),
  );

  dom.guidedReviewAnalysisPanel.hidden = !shouldShow;
  if (!shouldShow) {
    dom.guidedReviewAnalysisPanel.innerHTML = '';
    return;
  }

  const title = tablebaseDisplayActive() ? 'Tablebase moves' : 'Engine lines';

  dom.guidedReviewAnalysisPanel.innerHTML = `
    <article class="lesson-section guided-review-analysis-card">
      <div class="lesson-section-header">
        <div>
          <h3 class="lesson-section-title">${escapeHtml(title)}</h3>
        </div>
      </div>
      ${renderAnalysisStatusGridMarkup()}
      <div class="stack-grid">
        <div class="banner ${analysisStatusBannerKind(hasBoard)}">
          <div>
            <strong>${escapeHtml(analysisStatusBannerTitle(hasBoard))}</strong>
            <div>${escapeHtml(analysisStatusSummary())}</div>
          </div>
        </div>
        ${renderPvLineListMarkup()}
      </div>
    </article>
  `;
}

function renderEmbedAnalysisPanel() {
  if (!state.embedMode) {
    return;
  }
  const hasBoard = Boolean(state.analysis.game);
  const shouldShow = Boolean(
    hasBoard
    && !state.practice.active
    && state.pvLinesVisible
    && (
      state.tablebase.probing
      || state.engine.loading
      || state.engine.stopping
      || state.engine.analyzing
      || hasVisibleAnalysisLines()
    ),
  );
  if (!shouldShow) {
    postEmbedAnalysisMessage({ visible: false });
    return;
  }
  const title = tablebaseDisplayActive() ? 'Tablebase' : 'Engine';
  postEmbedAnalysisMessage({
    visible: true,
    title: title,
    evalLabel: state.engine.evalLabel || '',
    summary: analysisStatusSummary(),
    pvHtml: renderPvLineListMarkup(),
  });
}

function postEmbedAnalysisMessage(payload) {
  try {
    window.parent.postMessage(
      Object.assign({ type: 'analysisUpdate', source: window.location.href }, payload),
      '*',
    );
  } catch (e) {}
}

function parseInfoLine(line) {
  const tokens = String(line ?? '').trim().split(/\s+/);
  if (!tokens.length || tokens[0] !== 'info') {
    return null;
  }
  const info = {
    depth: null,
    nps: null,
    scoreType: '',
    scoreValue: null,
    pv: [],
    multipv: 1,
    nodes: null,
  };
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    switch (token) {
      case 'depth':
        info.depth = Number.parseInt(tokens[index + 1], 10);
        index += 1;
        break;
      case 'multipv':
        info.multipv = Number.parseInt(tokens[index + 1], 10) || 1;
        index += 1;
        break;
      case 'score':
        info.scoreType = tokens[index + 1] || '';
        info.scoreValue = Number.parseInt(tokens[index + 2], 10);
        index += 2;
        break;
      case 'nps':
        info.nps = Number.parseInt(tokens[index + 1], 10);
        index += 1;
        break;
      case 'nodes':
        info.nodes = Number.parseInt(tokens[index + 1], 10);
        index += 1;
        break;
      case 'pv':
        info.pv = tokens.slice(index + 1);
        index = tokens.length;
        break;
      default:
        break;
    }
  }
  return info;
}

function uciMovesToSan(fen, moves) {
  if (!validateFen(fen).ok || !Array.isArray(moves)) {
    return [];
  }
  try {
    const game = new Chess(fen);
    const sanMoves = [];
    for (const rawMove of moves) {
      const move = String(rawMove ?? '').trim().toLowerCase();
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
        break;
      }
      const applied = game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move[4] || undefined,
      });
      sanMoves.push(applied.san);
    }
    return sanMoves;
  } catch {
    return [];
  }
}

async function stockfishAssetExists(path) {
  try {
    const response = await window.fetch(new URL(path, import.meta.url), {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function isStockfishBundleInstalled(candidate) {
  const [workerExists, wasmExists] = await Promise.all([
    stockfishAssetExists(candidate.workerPath),
    stockfishAssetExists(candidate.wasmPath),
  ]);
  return workerExists && wasmExists;
}

async function resolveStockfishBundleCandidate() {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || window.matchMedia('(max-width: 760px)').matches
    || ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0);

  // On mobile, prefer lite bundles first to avoid crashing/timeout due to the 113MB WASM footprint.
  const candidates = [...ENGINE_BUNDLE_CANDIDATES];
  if (isMobile) {
    candidates.sort((a, b) => {
      const aIsLite = a.id.includes('lite');
      const bIsLite = b.id.includes('lite');
      if (aIsLite && !bIsLite) return -1;
      if (!aIsLite && bIsLite) return 1;
      return 0;
    });
  }

  let sawThreadedOnlyInstall = false;
  for (const candidate of candidates) {
    if (!await isStockfishBundleInstalled(candidate)) {
      continue;
    }
    if (!candidate.requiresCrossOriginIsolation || window.crossOriginIsolated) {
      return candidate;
    }
    sawThreadedOnlyInstall = true;
  }
  if (sawThreadedOnlyInstall && !window.crossOriginIsolated) {
    throw new Error('A multi-threaded Stockfish bundle is installed, but this server is missing the headers it needs. Run python local_server.py or install a single-threaded bundle.');
  }
  throw new Error('No supported Stockfish browser bundle was found in vendor/stockfish/. Add a stockfish-18-*.js/.wasm pair there.');
}

function terminateEngineWorker() {
  if (!state.engine.worker) {
    return;
  }
  state.engine.worker.removeEventListener('message', state.engine.worker._boundOnMessage || handleWorkerMessage);
  state.engine.worker.removeEventListener('error', state.engine.worker._boundOnError || handleWorkerError);
  state.engine.worker.terminate();
  state.engine.worker = null;
}

async function createStockfishWorker(options = {}) {
  const { summaryPrefix = '' } = options;
  const candidate = await resolveStockfishBundleCandidate();
  state.engine.bundleId = candidate.id;
  state.engine.bundleLabel = candidate.label;
  state.engine.bundlePath = candidate.workerPath;
  const loadingSummary = `Loading Stockfish (${candidate.label})...`;
  state.engine.summary = summaryPrefix ? `${summaryPrefix} ${loadingSummary}` : loadingSummary;
  renderAnalysisPanel();
  renderHeaderMeta();
  state.engine.workerGeneration += 1;
  const generation = state.engine.workerGeneration;
  const worker = new Worker(new URL(candidate.workerPath, import.meta.url));
  const boundOnMessage = (event) => {
    if (state.engine.workerGeneration !== generation) {
      debugPlayEngine('ignoring message from stale worker generation', { generation, currentGeneration: state.engine.workerGeneration });
      return;
    }
    handleWorkerMessage(event);
  };
  const boundOnError = (event) => {
    if (state.engine.workerGeneration !== generation) {
      return;
    }
    handleWorkerError(event);
  };
  worker._boundOnMessage = boundOnMessage;
  worker._boundOnError = boundOnError;
  worker.addEventListener('message', boundOnMessage);
  worker.addEventListener('error', boundOnError);
  return worker;
}

function clearEngineReadyHandshake() {
  if (state.engine.readyTimer) {
    window.clearTimeout(state.engine.readyTimer);
    state.engine.readyTimer = null;
  }
  state.engine.loadingPromise = null;
  state.engine.resolveReady = null;
  state.engine.rejectReady = null;
}

function handleWorkerError(event) {
  cancelPlayEngineRequest('worker error');
  const message = event?.message || (state.engine.bundleLabel
    ? `Stockfish (${state.engine.bundleLabel}) worker failed to start.`
    : 'Stockfish worker failed to start.');
  const isStaleLoadingError = state.engine.loadingRequestId
    && state.engine.loadingRequestId !== state.engine.requestId;
  if (state.engine.rejectReady) {
    state.engine.rejectReady(new Error(message));
  }
  clearEngineReadyHandshake();
  terminateEngineWorker();
  state.engine.loadingRequestId = 0;
  state.engine.loading = false;
  if (isStaleLoadingError) {
    state.engine.ready = false;
    renderAnalysisPanel();
    renderHeaderMeta();
    return;
  }
  resetAnalysisOutput({ keepReady: false, summary: message });
  renderAll();
}

function handleWorkerMessage(event) {
  const line = String(event?.data ?? '').trim();
  if (!line) {
    return;
  }
  if (line.startsWith('option name ')) {
    console.log('[Stockfish Option]', line);
  }
  if (line.startsWith('readyok')) {
    state.engine.ready = true;
    state.engine.loading = false;
    const resolve = state.engine.resolveReady;
    clearEngineReadyHandshake();
    if (resolve) {
      resolve(state.engine.worker);
    }
    if (!state.engine.analyzing && !state.engine.stopping && !hasVisibleAnalysisLines()) {
      state.engine.summary = defaultAnalysisSummary();
    }
    renderAnalysisPanel();
    renderHeaderMeta();
    if (state.play.active && state.play.engineThinking) {
      startPlayClock();
    }
    return;
  }
  if (line.startsWith('info ')) {
    const info = parseInfoLine(line);
    if (info && info.multipv === 1 && info.scoreType) {
      const searchFen = state.play.active ? state.analysis.currentFen : state.engine.searchFen;
      if (searchFen) {
        const normalizedScore = normalizeScoreToWhitePerspective(info.scoreType, info.scoreValue, searchFen);
        state.engine.scoreType = normalizedScore.scoreType;
        state.engine.scoreValue = normalizedScore.scoreValue;
        state.engine.evalLabel = info.scoreType ? formatScoreLabel(normalizedScore.scoreType, normalizedScore.scoreValue) : state.engine.evalLabel;
      }
    }
    if (state.play.active) {
      return;
    }
  }
  if (line.startsWith('info ') && state.engine.searchFen) {
    const info = parseInfoLine(line);
    if (!info || info.multipv < 1 || info.multipv > ENGINE_MULTI_PV_COUNT) {
      return;
    }
    const normalizedScore = info.scoreType
      ? normalizeScoreToWhitePerspective(info.scoreType, info.scoreValue, state.engine.searchFen)
      : { scoreType: '', scoreValue: null };
    state.engine.depth = Number.isFinite(info.depth) ? info.depth : state.engine.depth;
    state.engine.nps = Number.isFinite(info.nps) ? info.nps : state.engine.nps;
    state.engine.nodes = Number.isFinite(info.nodes) ? info.nodes : state.engine.nodes;
    const pvIndex = info.multipv - 1;
    const existingLine = state.engine.pvLines[pvIndex] || createEmptyEnginePvLine(info.multipv);
    const uciLine = Array.isArray(info.pv) ? info.pv.map(normalizeUciMove).filter(Boolean) : [];
    const sanLine = uciMovesToSan(state.engine.searchFen, uciLine);
    const nextEvalLabel = info.scoreType
      ? formatScoreLabel(normalizedScore.scoreType, normalizedScore.scoreValue)
      : existingLine.evalLabel;
    state.engine.pvLines[pvIndex] = {
      index: info.multipv,
      line: sanLine.length ? sanLine.join(' ') : '',
      uciMoves: uciLine.slice(0, sanLine.length || uciLine.length),
      depth: Number.isFinite(info.depth) ? info.depth : existingLine.depth,
      scoreType: normalizedScore.scoreType || existingLine.scoreType,
      scoreValue: Number.isFinite(normalizedScore.scoreValue) ? normalizedScore.scoreValue : existingLine.scoreValue,
      evalLabel: nextEvalLabel,
    };
    if (info.multipv === 1 && info.scoreType) {
      state.engine.scoreType = normalizedScore.scoreType;
      state.engine.scoreValue = normalizedScore.scoreValue;
      state.engine.evalLabel = nextEvalLabel;
    }
    const summaryBits = [
      state.engine.searchMode === ENGINE_SEARCH_MODE_CONTINUE
        ? (Number.isFinite(state.engine.searchTargetDepth)
            ? `Continuing past depth ${state.engine.searchTargetDepth}`
            : 'Continuing analysis')
        : `Analyzing toward depth ${state.engine.searchTargetDepth ?? currentAnalysisTargetDepth()}`,
    ];
    if (Number.isFinite(state.engine.depth)) {
      summaryBits.push(`Depth ${state.engine.depth}`);
    }
    summaryBits.push(`Eval ${state.engine.evalLabel}`);
    if (state.engine.nps) {
      summaryBits.push(`${formatNodeCount(state.engine.nps)} nps`);
    }
    state.engine.summary = withEngineSummaryPrefix(summaryBits.join(' | '));
    renderNotationPanel();
    renderAnalysisPanel();
    renderBoard();
    renderHeaderMeta();
    return;
  }
  if (line.startsWith('bestmove ')) {
    if (state.play.active || state.play.engineThinking) {
      // If Play is no longer active but engineThinking is stale, clean up
      if (!state.play.active) {
        debugPlayEngine('bestmove received but Play is inactive, clearing stale state');
        cancelPlayEngineRequest('bestmove received after Play stopped');
        // Fall through to normal analysis bestmove handling below
      } else if (state.play.activeEngineSessionId !== state.play.playSessionId) {
        // Stale session: a bestmove from an older Play game arrived
        debugPlayEngine('bestmove ignored: stale session', {
          activeEngineSessionId: state.play.activeEngineSessionId,
          playSessionId: state.play.playSessionId,
        });
        cancelPlayEngineRequest('stale session bestmove');
        return;
      } else if (!state.play.engineThinking) {
        // Duplicate bestmove for current session but we're not expecting one
        debugPlayEngine('bestmove ignored: not expecting engine reply');
        return;
      } else {
        // Valid bestmove for the current Play session
        clearPlayEngineWatchdog();
        state.play.engineThinking = false;
        state.play.activeEngineSessionId = null;
        state.play.playEngineRetryCount = 0;
        debugPlayEngine('bestmove received', { line });
        state.engine.analyzing = false;
        state.engine.stopping = false;
        state.engine.pendingFen = '';
        state.engine.pendingSearchMode = '';
        const tokens = line.split(/\s+/);
        const bestMove = tokens[1] || '';
        if (bestMove && bestMove !== '(none)') {
          applyPlayEngineMove(bestMove);
        }
        return;
      }
    }
    if (state.engine.pendingFen && state.engine.worker) {

      const pendingSearchMode = state.engine.pendingSearchMode || ENGINE_SEARCH_MODE_CHECKPOINT;
      startEngineSearch(state.engine.worker, state.engine.pendingFen, {
        preserveDisplay: true,
        freshGame: true,
        searchMode: pendingSearchMode,
        targetDepth: pendingSearchMode === ENGINE_SEARCH_MODE_CHECKPOINT ? currentAnalysisTargetDepth() : null,
        summary: pendingSearchMode === ENGINE_SEARCH_MODE_CONTINUE
          ? 'Continuing analysis from the current board position...'
          : `Analyzing current board position toward depth ${currentAnalysisTargetDepth()}...`,
      });
      return;
    }
    if (!state.engine.searchFen && !state.engine.stopping && !state.engine.analyzing) {
      return;
    }
    const stoppedFen = state.engine.searchFen;
    const completedMode = state.engine.searchMode;
    const targetDepth = state.engine.searchTargetDepth;
    const wasStopping = state.engine.stopping;
    const tokens = line.split(/\s+/);
    state.engine.analyzing = false;
    state.engine.stopping = false;
    state.engine.pendingFen = '';
    state.engine.pendingSearchMode = '';
    state.engine.bestMove = tokens[1] || '';
    const hasBestMove = Boolean(state.engine.bestMove && state.engine.bestMove !== '(none)');
    if (hasBestMove) {
      const san = uciMovesToSan(stoppedFen, [state.engine.bestMove])[0] || state.engine.bestMove;
      if (completedMode === ENGINE_SEARCH_MODE_CHECKPOINT && !wasStopping) {
        const completedDepth = Number.isFinite(state.engine.depth) ? state.engine.depth : targetDepth;
        state.engine.summary = Number.isFinite(completedDepth)
          ? `Analysis complete at depth ${completedDepth}. Best move: ${san}.`
          : `Analysis complete. Best move: ${san}.`;
        state.engine.resumeFen = stoppedFen;
        state.engine.resumeDepth = Number.isFinite(targetDepth)
          ? targetDepth
          : (Number.isFinite(state.engine.depth) ? state.engine.depth : currentAnalysisTargetDepth());
        state.engine.resumeEligible = Boolean(stoppedFen && state.engine.ready && state.engine.worker);
      } else if (completedMode === ENGINE_SEARCH_MODE_CHECKPOINT && Number.isFinite(targetDepth)) {
        state.engine.summary = Number.isFinite(state.engine.depth)
          ? `Search stopped at depth ${state.engine.depth} before target ${targetDepth}. Best move: ${san}.`
          : `Search stopped before target ${targetDepth}. Best move: ${san}.`;
        clearEngineContinuationState();
      } else if (completedMode === ENGINE_SEARCH_MODE_CONTINUE) {
        state.engine.summary = Number.isFinite(state.engine.depth)
          ? `Search stopped at depth ${state.engine.depth}. Best move: ${san}.`
          : `Search stopped. Best move: ${san}.`;
        clearEngineContinuationState();
      } else {
        state.engine.summary = `Search stopped. Best move: ${san}.`;
        clearEngineContinuationState();
      }
    } else {
      let chessHasMoves = false;
      try {
        const tempGame = new Chess(stoppedFen);
        chessHasMoves = tempGame.moves().length > 0;
      } catch (e) { /* fall through */ }
      state.engine.summary = chessHasMoves
        ? (completedMode === ENGINE_SEARCH_MODE_CHECKPOINT && !wasStopping
            ? 'Analysis stopped. This position cannot be analyzed by the engine (unusual piece count).'
            : 'Search finished. This position cannot be analyzed by the engine (unusual piece count).')
        : (completedMode === ENGINE_SEARCH_MODE_CHECKPOINT && !wasStopping
            ? 'Analysis complete. No legal moves are available in this position.'
            : 'Search finished. No legal moves are available in this position.');
      clearEngineContinuationState();
    }
    state.engine.summary = withEngineSummaryPrefix(state.engine.summary);
    state.engine.summaryPrefix = '';
    state.engine.searchFen = '';
    state.engine.searchMode = '';
    state.engine.searchTargetDepth = null;
    renderNotationPanel();
    renderAnalysisPanel();
    renderHeaderMeta();
    return;
  }
}

async function ensureStockfishReady(options = {}) {
  const { summary = 'Loading Stockfish engine...', summaryPrefix = '' } = options;
  if (state.engine.ready && state.engine.worker) {
    return state.engine.worker;
  }
  if (state.engine.loadingPromise) {
    return state.engine.loadingPromise;
  }
  state.engine.loading = true;
  state.engine.summary = summary;
  renderNotationPanel();
  renderAnalysisPanel();
  renderHeaderMeta();
  state.engine.loadingPromise = new Promise((resolve, reject) => {
    state.engine.resolveReady = resolve;
    state.engine.rejectReady = reject;
    state.engine.readyTimer = window.setTimeout(() => {
      if (state.engine.worker && !state.engine.ready) {
        terminateEngineWorker();
      }
      reject(new Error('Stockfish readiness timed out.'));
      clearEngineReadyHandshake();
    }, ENGINE_READY_TIMEOUT_MS);
    void (async () => {
      try {
        if (!state.engine.worker) {
          state.engine.worker = await createStockfishWorker({ summaryPrefix });
        }
        state.engine.worker.postMessage('uci');
        state.engine.worker.postMessage('isready');
      } catch (error) {
        reject(error);
        clearEngineReadyHandshake();
      }
    })();
  }).finally(() => {
    state.engine.loading = false;
    renderAnalysisPanel();
    renderHeaderMeta();
  });
  return state.engine.loadingPromise;
}

function stopAnalysisSearch({ clearSummary = false, hideEvalRail = clearSummary } = {}) {
  if (state.engine.worker && state.engine.searchFen) {
    state.engine.worker.postMessage('stop');
  }
  state.engine.analyzing = false;
  state.engine.stopping = false;
  state.engine.searchFen = '';
  state.engine.pendingFen = '';
  state.engine.searchMode = '';
  state.engine.pendingSearchMode = '';
  state.engine.summaryPrefix = '';
  clearEngineContinuationState();
  if (clearSummary) {
    clearTablebaseDisplay();
    state.engine.summary = defaultAnalysisSummary();
    clearEngineSearchData();
  }
  state.engine.evalRailVisible = !hideEvalRail;
}

function renderAnalysisOutputPanels() {
  renderNotationPanel();
  renderAnalysisPanel();
  renderBoard();
  renderHeaderMeta();
}

async function startStockfishAnalysisForCurrentPosition(options = {}) {
  const { prelude = '' } = options;
  const requestId = state.engine.requestId + 1;
  state.engine.requestId = requestId;
  state.engine.loadingRequestId = requestId;
  try {
    state.engine.evalRailVisible = true;
    const currentFen = state.analysis.currentFen;
    const continuationRequested = !prelude && hasAnalysisContinuationAvailable();
    const continuationDepth = Number.isFinite(state.engine.resumeDepth) ? state.engine.resumeDepth : null;
    const requestedWarmRestart = Boolean(
      continuationRequested
      && state.engine.worker
      && state.engine.ready
    );
    if (continuationRequested) {
      state.engine.summary = state.engine.ready
        ? (Number.isFinite(continuationDepth)
            ? `Continuing analysis past depth ${continuationDepth}...`
            : 'Continuing analysis from the current board position...')
        : 'Loading Stockfish engine...';
    } else {
      clearEngineSearchData({ preservePv: true });
      const stockfishSummary = state.engine.ready
        ? `Analyzing current board position toward depth ${currentAnalysisTargetDepth()}...`
        : 'Loading Stockfish engine...';
      state.engine.summary = prelude ? `${prelude} ${stockfishSummary}` : stockfishSummary;
    }
    renderNotationPanel();
    renderBoard();
    renderAnalysisPanel();
    const worker = await ensureStockfishReady({
      summary: prelude ? `${prelude} Loading Stockfish engine...` : 'Loading Stockfish engine...',
      summaryPrefix: prelude,
    });
    if (state.engine.requestId !== requestId) {
      if (state.engine.loadingRequestId === requestId) {
        state.engine.loadingRequestId = 0;
      }
      return;
    }
    state.engine.loadingRequestId = 0;
    if (!state.analysis.game || state.analysis.currentFen !== currentFen) {
      const pendingFen = state.engine.pendingFen;
      if (
        pendingFen
        && state.analysis.game
        && state.analysis.currentFen === pendingFen
        && worker === state.engine.worker
        && !state.engine.stopping
      ) {
        const pendingSearchMode = state.engine.pendingSearchMode || ENGINE_SEARCH_MODE_CHECKPOINT;
        startEngineSearch(worker, pendingFen, {
          preserveDisplay: true,
          freshGame: true,
          searchMode: pendingSearchMode,
          targetDepth: pendingSearchMode === ENGINE_SEARCH_MODE_CHECKPOINT ? currentAnalysisTargetDepth() : null,
          summary: pendingSearchMode === ENGINE_SEARCH_MODE_CONTINUE
            ? 'Continuing analysis from the current board position...'
            : `Analyzing current board position toward depth ${currentAnalysisTargetDepth()}...`,
        });
        return;
      }
      state.engine.summary = defaultAnalysisSummary();
      renderAnalysisOutputPanels();
      return;
    }
    const canWarmRestart = Boolean(requestedWarmRestart && worker === state.engine.worker);
    const stockfishSearchSummary = continuationRequested
      ? (Number.isFinite(continuationDepth)
          ? `Continuing analysis past depth ${continuationDepth}...`
          : 'Continuing analysis from the current board position...')
      : `Analyzing current board position toward depth ${currentAnalysisTargetDepth()}...`;
    startEngineSearch(worker, currentFen, {
      preserveDisplay: continuationRequested,
      freshGame: !canWarmRestart,
      searchMode: continuationRequested ? ENGINE_SEARCH_MODE_CONTINUE : ENGINE_SEARCH_MODE_CHECKPOINT,
      targetDepth: continuationRequested ? continuationDepth : currentAnalysisTargetDepth(),
      summaryPrefix: prelude,
      summary: prelude ? `${prelude} ${stockfishSearchSummary}` : stockfishSearchSummary,
    });
  } catch (error) {
    if (state.engine.requestId !== requestId) {
      if (state.engine.loadingRequestId === requestId) {
        state.engine.loadingRequestId = 0;
      }
      return;
    }
    state.engine.loadingRequestId = 0;
    state.engine.ready = false;
    state.engine.analyzing = false;
    state.engine.stopping = false;
    state.engine.searchFen = '';
    state.engine.pendingFen = '';
    state.engine.searchMode = '';
    state.engine.pendingSearchMode = '';
    clearEngineContinuationState();
    state.engine.evalRailVisible = true;
    clearEngineSearchData();
    state.engine.summary = error?.message || 'Failed to start Stockfish.';
    renderAnalysisOutputPanels();
  }
}

function tablebaseFallbackPrelude(error) {
  const message = String(error?.message || '').trim();
  if (message.includes('rate limit')) {
    return 'Tablebase rate limited; using Stockfish.';
  }
  if (error?.name === 'AbortError') {
    return 'Tablebase lookup timed out; using Stockfish.';
  }
  return 'Tablebase unavailable; using Stockfish.';
}

async function startTablebaseAnalysisForFen(fen, options = {}) {
  const { fallbackToEngine = true, preserveDisplay = false } = options;
  const eligibility = tablebaseEligibilityForFen(fen);
  if (!eligibility.eligible) {
    return false;
  }

  if (state.engine.worker && state.engine.searchFen) {
    state.engine.worker.postMessage('stop');
  }
  state.engine.loading = false;
  state.engine.analyzing = false;
  state.engine.stopping = false;
  state.engine.searchFen = '';
  state.engine.pendingFen = '';
  state.engine.searchMode = '';
  state.engine.pendingSearchMode = '';
  state.engine.summaryPrefix = '';
  clearEngineContinuationState();
  if (!preserveDisplay) {
    clearEngineSearchData();
  }

  abortTablebaseProbe();
  const requestId = state.tablebase.requestId + 1;
  const controller = new AbortController();
  state.tablebase.requestId = requestId;
  state.tablebase.abortController = controller;
  state.tablebase.probing = true;
  state.tablebase.fen = eligibility.fen;
  if (!preserveDisplay || state.tablebase.result?.fen !== eligibility.fen) {
    state.tablebase.result = null;
  }
  state.tablebase.error = '';
  state.engine.evalRailVisible = true;
  state.engine.summary = `Probing Lichess tablebase for this ${TABLEBASE_ENDGAME_LABEL}...`;
  renderAnalysisOutputPanels();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, TABLEBASE_FETCH_TIMEOUT_MS);

  try {
    const payload = await fetchTablebasePayload(eligibility.fen, controller.signal);
    if (state.tablebase.requestId !== requestId || state.analysis.currentFen !== eligibility.fen) {
      window.clearTimeout(timeoutId);
      return false;
    }
    const result = normalizeTablebasePayload(eligibility.fen, payload);
    await hydrateTablebaseMoveLines(eligibility.fen, result, controller.signal);
    window.clearTimeout(timeoutId);
    if (state.tablebase.requestId !== requestId || state.analysis.currentFen !== eligibility.fen) {
      return false;
    }
    state.tablebase.probing = false;
    state.tablebase.abortController = null;
    state.tablebase.fen = eligibility.fen;
    state.tablebase.result = result;
    state.tablebase.error = '';
    clearEngineContinuationState();
    clearEngineSearchData();
    state.engine.summary = result.summary;
    renderAnalysisOutputPanels();
    return true;
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (state.tablebase.requestId !== requestId || state.analysis.currentFen !== eligibility.fen) {
      return false;
    }
    const fallbackPrelude = tablebaseFallbackPrelude(error);
    state.tablebase.probing = false;
    state.tablebase.abortController = null;
    state.tablebase.fen = preserveDisplay && state.tablebase.result?.fen === eligibility.fen ? eligibility.fen : '';
    if (!preserveDisplay || state.tablebase.result?.fen !== eligibility.fen) {
      state.tablebase.result = null;
    }
    state.tablebase.error = error?.message || 'Tablebase lookup failed.';
    state.engine.summary = fallbackPrelude;
    renderAnalysisOutputPanels();
    if (fallbackToEngine && state.analysis.game && state.analysis.currentFen === eligibility.fen) {
      await startStockfishAnalysisForCurrentPosition({ prelude: fallbackPrelude });
    }
    return false;
  }
}

async function toggleAnalysis() {
  if (state.guidedReview.active) {
    state.guidedReview.active = false;
  }
  if (state.play.active) {
    stopPlayGame({ reason: 'Game ended by enabling analysis.' });
  }
  if (state.activeTab !== TAB_ANALYSIS) {
    state.activeTab = TAB_ANALYSIS;
  }
  renderAll();
  schedulePersist();
  if (state.practice.active) {
    state.engine.summary = 'Stop practice mode before re-enabling Stockfish.';
    renderAll();
    return;
  }
  if (!state.analysis.game) {
    state.engine.summary = defaultAnalysisSummary();
    renderAll();
    return;
  }
  if (state.tablebase.probing || state.engine.loading) {
    return;
  }
  if (state.engine.analyzing) {
    state.engine.stopping = true;
    state.engine.pendingFen = '';
    state.engine.pendingSearchMode = '';
    state.engine.summary = 'Stopping Stockfish search...';
    renderAll();
    if (state.engine.worker) {
      state.engine.worker.postMessage('stop');
    }
    return;
  }

  const currentFen = state.analysis.currentFen;
  if (isTablebaseEligibleFen(currentFen)) {
    await startTablebaseAnalysisForFen(currentFen, { fallbackToEngine: true });
    return;
  }

  await startStockfishAnalysisForCurrentPosition();
}

function resetAnalysisSelectionAndOutputAfterMove() {
  clearAnalysisSelection();
  stopAnalysisSearch({ clearSummary: true });
}

function findExistingAnalysisChildId(parentNode, move) {
  if (!parentNode) {
    return '';
  }
  const promotion = normalizePromotionValue(move.promotion);
  return parentNode.children.find((childId) => {
    const childNode = getAnalysisNode(childId);
    return childNode
      && childNode.from === move.from
      && childNode.to === move.to
      && normalizePromotionValue(childNode.promotion) === promotion;
  }) || '';
}

function applyAnalysisMove(move) {
  if (!state.analysis.game) {
    return;
  }
  updateClockElapsed();
  const shouldKeepAnalysisLive = analysisShouldFollowPositionChanges();
  const currentNode = getCurrentAnalysisNode();
  if (!currentNode) {
    return;
  }
  const applied = state.analysis.game.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });
  const existingChildId = findExistingAnalysisChildId(currentNode, applied);

  if (existingChildId) {
    currentNode.selectedChildId = existingChildId;
    applyAnalysisPathSelection(existingChildId);
    state.analysis.currentNodeId = existingChildId;
  } else {
    const nodeId = allocateAnalysisNodeId();
    state.analysis.nodes[nodeId] = {
      id: nodeId,
      parentId: currentNode.id,
      from: applied.from,
      to: applied.to,
      promotion: applied.promotion || undefined,
      san: applied.san,
      fen: state.analysis.game.fen(),
      children: [],
      selectedChildId: null,
      comment: '',
    };
    currentNode.children.push(nodeId);
    currentNode.selectedChildId = nodeId;
    applyAnalysisPathSelection(nodeId);
    state.analysis.currentNodeId = nodeId;
  }

  if (state.play.active) {
    clearAnalysisSelection();
    state.analysis.lastMoveSquares = [applied.from, applied.to];
    if (state.play.timeControl !== 'none') {
      const turn = state.analysis.game.turn();
      if (turn === 'b') {
        state.play.whiteTime += state.play.whiteInc;
      } else {
        state.play.blackTime += state.play.blackInc;
      }
    }
    state.analysis.currentFen = state.analysis.game.fen();
    debugPlayEngine('user move applied in Play mode', {
      san: applied.san,
      turnAfterMove: state.analysis.game.turn(),
      shouldEngineMove: shouldEngineMoveInPlay(),
    });
    if (checkPlayGameOver()) {
      return;
    }
    schedulePersist();
    renderAll();
    window.setTimeout(() => {
      if (shouldEngineMoveInPlay()) {
        void triggerEngineMove();
      }
    }, 50);
    return;
  }

  const wasAnalysisActive = analysisShouldFollowPositionChanges() || state.tablebase.probing || tablebaseResultActive();
  const nextFen = state.analysis.game.fen();
  const followedDisplay = createFollowedAnalysisDisplay(applied, nextFen);
  syncAnalysisGameFromTree({ resetEngine: !(shouldKeepAnalysisLive || wasAnalysisActive || followedDisplay) });
  if (followedDisplay) {
    stopAnalysisWorkForFollowedDisplay();
    applyFollowedAnalysisDisplay(followedDisplay);
    state.analysis.boardMessage = followedDisplay.source === 'tablebase'
      ? `Current move: ${applied.san}. Following displayed tablebase line.`
      : `Current move: ${applied.san}. Following displayed PV line.`;
    schedulePersist();
    renderAll();
    return;
  }
  state.analysis.boardMessage = shouldKeepAnalysisLive
      ? `Current move: ${applied.san}. Stockfish is following the new board position.`
      : `Current move: ${applied.san}. Analyze the current board position for fresh evaluation.`;
  if (shouldKeepAnalysisLive && !state.engine.stopping) {
    queueEngineSearchForFen(state.analysis.currentFen);
  } else if (wasAnalysisActive) {
    if (isTablebaseEligibleFen(state.analysis.currentFen)) {
      void startTablebaseAnalysisForFen(state.analysis.currentFen, { fallbackToEngine: true, preserveDisplay: false });
    } else {
      void startStockfishAnalysisForCurrentPosition();
    }
  }
  schedulePersist();
  renderAll();
}

function openPromotionDialog(moves, mode = 'analysis') {
  state.analysis.pendingPromotion = {
    moves,
    mode,
  };
  renderPromotionModal();
}

function dismissPromotionDialog() {
  state.analysis.pendingPromotion = null;
  renderPromotionModal();
}

function choosePromotion(promotion) {
  if (!state.analysis.pendingPromotion?.moves) {
    return;
  }
  const chosenMove = state.analysis.pendingPromotion.moves.find((move) => move.promotion === promotion);
  const mode = state.analysis.pendingPromotion.mode || 'analysis';
  dismissPromotionDialog();
  if (chosenMove) {
    if (mode === 'practice') {
      submitPracticeMove(chosenMove);
    } else {
      applyAnalysisMove(chosenMove);
    }
  }
}

function handleAnalysisSquareClick(square) {
  if (!state.analysis.game) {
    return;
  }
  if (state.play.active) {
    const humanSide = state.play.assignedSide === 'white' ? 'w' : 'b';
    if (state.analysis.game.turn() !== humanSide) {
      return;
    }
  }
  if (state.analysis.selectedSquare) {
    if (square === state.analysis.selectedSquare) {
      clearAnalysisSelection();
      state.analysis.boardMessage = 'Selection cleared.';
      renderBoard();
      renderAnalysisPanel();
      return;
    }
    const matchingMoves = state.analysis.legalMoves.filter((move) => move.to === square);
    if (matchingMoves.length) {
      const promotions = Array.from(new Set(matchingMoves.map((move) => move.promotion).filter(Boolean)));
      if (promotions.length > 1) {
        openPromotionDialog(matchingMoves, state.practice.active ? 'practice' : 'analysis');
        return;
      }
      submitPracticeMove(matchingMoves[0]);
      return;
    }
  }

  const piece = state.analysis.game.get(square);
  if (piece && piece.color === state.analysis.game.turn()) {
    state.analysis.selectedSquare = square;
    state.analysis.legalMoves = state.analysis.game.moves({
      square,
      verbose: true,
    });
    state.analysis.boardMessage = state.analysis.legalMoves.length
      ? `Selected ${square}. Choose a legal target square.`
      : `No legal moves are available from ${square}.`;
    renderBoard();
    renderAnalysisPanel();
    return;
  }

  clearAnalysisSelection();
  state.analysis.boardMessage = 'Select a piece belonging to the side to move.';
  renderBoard();
  renderAnalysisPanel();
}

function currentDisplayPieces() {
  if (state.activeTab === TAB_SETUP) {
    return state.setup.pieces;
  }
  if (state.analysis.game && validateFen(state.analysis.currentFen).ok) {
    const parsed = parsePlacement(state.analysis.currentFen.split(/\s+/)[0]);
    if (parsed.ok) {
      return parsed.pieces;
    }
  }
  return state.setup.pieces;
}

function currentTurnSide() {
  const fen = currentBoardFenLabel();
  const parsed = parseFenLike(fen);
  if (parsed.ok) {
    return parsed.meta.activeColor === 'b' ? 'b' : 'w';
  }
  if (state.activeTab === TAB_SETUP || !state.analysis.game) {
    return state.setup.meta.activeColor === 'b' ? 'b' : 'w';
  }
  return state.analysis.game.turn() === 'b' ? 'b' : 'w';
}

function currentTurnLabel() {
  return currentTurnSide() === 'b' ? 'Black to move' : 'White to move';
}

function currentContextLabel() {
  if (state.practice.active) {
    return 'Practice board';
  }
  if (state.activeTab === TAB_SETUP) {
    return 'Setup editor';
  }
  return 'Analysis board';
}

function currentBoardFenLabel() {
  return state.activeTab === TAB_SETUP ? state.setupFen : state.analysis.currentFen;
}

function buildCapturedPiecesByColor(pieces) {
  const boardCounts = {
    w: { Q: 0, R: 0, B: 0, N: 0, P: 0 },
    b: { Q: 0, R: 0, B: 0, N: 0, P: 0 },
  };
  Object.values(pieces || {}).forEach((piece) => {
    const symbol = String(piece || '').trim();
    const upper = symbol.toUpperCase();
    if (!CAPTURED_PIECE_ORDER.includes(upper)) {
      return;
    }
    const color = symbol === symbol.toLowerCase() ? 'b' : 'w';
    boardCounts[color][upper] += 1;
  });

  const captured = { w: [], b: [] };
  CAPTURED_PIECE_ORDER.forEach((upper) => {
    const maxCount = STANDARD_PIECE_COUNTS[upper] || 0;
    const whiteMissing = Math.max(0, maxCount - boardCounts.w[upper]);
    const whiteOnBoard = boardCounts.w[upper];
    const blackMissing = Math.max(0, maxCount - boardCounts.b[upper]);
    const blackOnBoard = boardCounts.b[upper];
    for (let index = 0; index < whiteMissing; index += 1) {
      captured.w.push({ piece: upper, empty: false });
    }
    for (let index = 0; index < whiteOnBoard; index += 1) {
      captured.w.push({ piece: upper, empty: true });
    }
    for (let index = 0; index < blackMissing; index += 1) {
      captured.b.push({ piece: upper.toLowerCase(), empty: false });
    }
    for (let index = 0; index < blackOnBoard; index += 1) {
      captured.b.push({ piece: upper.toLowerCase(), empty: true });
    }
  });
  return captured;
}

function capturedPieceEntries(pieces) {
  const entries = [];
  const pawnCaptured = [];
  const pawnEmpty = [];

  pieces.forEach((entry) => {
    const { piece, empty } = entry;
    if (piece.toUpperCase() === 'P') {
      if (empty) {
        pawnEmpty.push(entry);
      } else {
        pawnCaptured.push(entry);
      }
      return;
    }
    entries.push({ piece, count: 1, empty });
  });

  if (pawnCaptured.length > 0) {
    entries.push({ piece: pawnCaptured[0].piece, count: pawnCaptured.length, empty: false });
  }
  if (pawnEmpty.length > 0) {
    entries.push({ piece: pawnEmpty[0].piece, count: pawnEmpty.length, empty: true });
  }

  return entries;
}

function capturedPiecesMarkup(pieces) {
  return capturedPieceEntries(pieces).map(({ piece, count, empty }) => {
    const colorLabel = piece === piece.toLowerCase() ? 'Black' : 'White';
    const pieceLabel = PIECE_LABELS[piece.toUpperCase()];
    const countLabel = count > 1 ? ` x${count}` : '';
    const emptyClass = empty ? ' is-empty-slot' : '';
    const pieceImage = empty
      ? `<span class="captured-piece-placeholder" aria-hidden="true"></span>`
      : `<img class="captured-piece" src="${PIECE_ASSETS[piece]}" alt="">`;
    return `
    <span
      class="captured-piece-shell ${piece === piece.toLowerCase() ? 'is-dark-piece' : 'is-light-piece'} ${count > 1 ? 'has-count' : ''}${emptyClass}"
      title="${escapeHtml(colorLabel)} ${escapeHtml(pieceLabel)}${escapeHtml(countLabel)}${empty ? ' (on board)' : ''}"
      aria-label="${escapeHtml(colorLabel)} ${escapeHtml(pieceLabel)}${escapeHtml(countLabel)}${empty ? ' (on board)' : ''}"
    >
      ${pieceImage}
      ${count > 1 ? `<span class="captured-piece-count" aria-hidden="true">x${count}</span>` : ''}
    </span>
  `;
  }).join('');
}

function renderCapturedPieces() {
  if (!dom.capturedTop || !dom.capturedBottom || !dom.capturedTopPieces || !dom.capturedBottomPieces) {
    return;
  }
  const captured = buildCapturedPiecesByColor(currentDisplayPieces());
  const capturedWhite = { pieces: captured.w, label: 'Captured white pieces' };
  const capturedBlack = { pieces: captured.b, label: 'Captured black pieces' };
  const topCaptured = state.boardOrientation === 'black' ? capturedBlack : capturedWhite;
  const bottomCaptured = state.boardOrientation === 'black' ? capturedWhite : capturedBlack;

  dom.capturedTopPieces.innerHTML = capturedPiecesMarkup(topCaptured.pieces);
  dom.capturedBottomPieces.innerHTML = capturedPiecesMarkup(bottomCaptured.pieces);
  dom.capturedTopPieces.setAttribute('aria-label', topCaptured.label);
  dom.capturedBottomPieces.setAttribute('aria-label', bottomCaptured.label);
  dom.capturedTop.classList.remove('is-empty');
  dom.capturedBottom.classList.remove('is-empty');
  dom.capturedTop.setAttribute('aria-hidden', 'false');
  dom.capturedBottom.setAttribute('aria-hidden', 'false');
}

function cssLengthToPx(value, fallback = 0) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallback;
  }
  if (normalized.endsWith('px')) {
    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  if (normalized.endsWith('rem')) {
    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? remToPx(numeric) : fallback;
  }
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function cssNumberToFloat(value, fallback) {
  const numeric = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(numeric) ? numeric : fallback;
}

function currentViewportWidth() {
  return window.visualViewport?.width ?? window.innerWidth ?? document.documentElement?.clientWidth ?? 0;
}

function currentViewportHeight() {
  return window.visualViewport?.height ?? window.innerHeight ?? document.documentElement?.clientHeight ?? 0;
}

function mobilePortraitLayoutActive() {
  return Boolean(window.matchMedia?.(MOBILE_PORTRAIT_VIEWPORT_MEDIA_QUERY).matches);
}

function elementPaddingInsetPx(element, axis) {
  if (!element) {
    return 0;
  }
  const styles = window.getComputedStyle(element);
  if (axis === 'x') {
    return cssLengthToPx(styles.paddingLeft, 0) + cssLengthToPx(styles.paddingRight, 0);
  }
  return cssLengthToPx(styles.paddingTop, 0) + cssLengthToPx(styles.paddingBottom, 0);
}

function capturedSizingMetricsFromStyles(styles) {
  const cellDivisor = cssNumberToFloat(styles?.getPropertyValue('--captured-cell-divisor'), 12);
  return {
    cellDivisor: cellDivisor > 0 ? cellDivisor : 12,
    cellMin: cssLengthToPx(styles?.getPropertyValue('--captured-cell-min'), remToPx(1.3)),
    cellMax: cssLengthToPx(styles?.getPropertyValue('--captured-cell-max'), remToPx(1.85)),
    rowExtraHeight: cssLengthToPx(styles?.getPropertyValue('--captured-row-extra-height'), remToPx(0.7)),
  };
}

function capturedCellSizeForBoardSize(boardSize, metrics = capturedSizingMetricsFromStyles()) {
  return clamp(boardSize / metrics.cellDivisor, metrics.cellMin, metrics.cellMax);
}

function capturedRowHeightForBoardSize(boardSize, metrics = capturedSizingMetricsFromStyles()) {
  return capturedCellSizeForBoardSize(boardSize, metrics) + metrics.rowExtraHeight + 2;
}

function capturedRowGapForBoardSize(boardSize) {
  return clamp(boardSize / 140, remToPx(0.24), remToPx(0.4));
}

function focusModeSideOffsetForBoardSize(boardSize) {
  const viewportWidth = currentViewportWidth();
  const evalRailWidth = clamp(viewportWidth * 0.011, remToPx(0.78), remToPx(1));
  const evalRailGap = clamp(viewportWidth * 0.01, remToPx(0.55), remToPx(0.8));
  const turnMarkerSize = clamp(boardSize / 34, remToPx(0.9), remToPx(1.3));
  const turnMarkerGap = clamp(boardSize / 52, remToPx(0.5), remToPx(0.82));
  return evalRailWidth + evalRailGap + turnMarkerSize + turnMarkerGap;
}

function annotationsVisible() {
  return state.activeTab !== TAB_SETUP;
}

function annotateModeActive() {
  return annotationsVisible() && state.annotations.enabled;
}

function squareFromEventTarget(target) {
  if (!(target instanceof Element)) {
    return '';
  }
  const squareEl = target.closest('.board-square');
  if (!squareEl || !dom.boardGrid.contains(squareEl)) {
    return '';
  }
  return squareEl.dataset.square || '';
}

function squareFromClientPoint(clientX, clientY) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return '';
  }
  return squareFromEventTarget(document.elementFromPoint(clientX, clientY));
}

function annotationMarkupForSquare(square) {
  if (!annotationsVisible()) {
    return '';
  }
  const layers = [];
  if (state.annotations.paintedSquares.has(square)) {
    layers.push('<span class="board-annotation board-annotation-paint" aria-hidden="true"></span>');
  }
  if (state.annotations.circledSquares.has(square)) {
    layers.push('<span class="board-annotation board-annotation-circle" aria-hidden="true"></span>');
  }
  if (state.annotations.starredSquares.has(square)) {
    layers.push('<span class="board-annotation board-annotation-star" aria-hidden="true"></span>');
  }
  return layers.join('');
}

function annotationArrowKey(from, to) {
  return `${from}:${to}`;
}

function squareCenterPoint(square, orientation = state.boardOrientation) {
  if (!SQUARE_PATTERN.test(square)) {
    return null;
  }

  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number.parseInt(square[1], 10) - 1;
  const col = orientation === 'black' ? 7 - fileIndex : fileIndex;
  const row = orientation === 'black' ? rankIndex : 7 - rankIndex;

  return {
    x: (col * BOARD_CELL_SIZE) + (BOARD_CELL_SIZE / 2),
    y: (row * BOARD_CELL_SIZE) + (BOARD_CELL_SIZE / 2),
  };
}

function buildAnnotationArrowMarkup(from, to, options = {}) {
  const { preview = false } = options;
  const start = squareCenterPoint(from);
  const end = squareCenterPoint(to);
  if (!start || !end || (start.x === end.x && start.y === end.y)) {
    return '';
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= ANNOTATION_ARROW_HEAD_LENGTH) {
    return '';
  }

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
  const className = `board-annotation-arrow ${preview ? 'is-preview' : ''}`.trim();
  const headClassName = `board-annotation-arrow-head ${preview ? 'is-preview' : ''}`.trim();
  return `
    <g>
      <line
        class="${className}"
        x1="${start.x}"
        y1="${start.y}"
        x2="${headBaseX}"
        y2="${headBaseY}"
      ></line>
      <polygon
        class="${headClassName}"
        points="${end.x},${end.y} ${leftX},${leftY} ${rightX},${rightY}"
      ></polygon>
    </g>
  `;
}

function buildLastMoveArrowMarkup() {
  if (state.activeTab === TAB_SETUP || !state.lastMoveArrowVisible) {
    return '';
  }
  const [from, to] = state.analysis.lastMoveSquares;
  const start = squareCenterPoint(from);
  const end = squareCenterPoint(to);
  if (!start || !end || (start.x === end.x && start.y === end.y)) {
    return '';
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  const requiredDistance = LAST_MOVE_ARROW_START_INSET
    + LAST_MOVE_ARROW_TIP_INSET
    + LAST_MOVE_ARROW_HEAD_LENGTH;
  if (distance <= requiredDistance) {
    return '';
  }

  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const startX = start.x + (unitX * LAST_MOVE_ARROW_START_INSET);
  const startY = start.y + (unitY * LAST_MOVE_ARROW_START_INSET);
  const tipX = end.x - (unitX * LAST_MOVE_ARROW_TIP_INSET);
  const tipY = end.y - (unitY * LAST_MOVE_ARROW_TIP_INSET);
  const headBaseX = tipX - (unitX * LAST_MOVE_ARROW_HEAD_LENGTH);
  const headBaseY = tipY - (unitY * LAST_MOVE_ARROW_HEAD_LENGTH);
  const perpendicularX = -unitY;
  const perpendicularY = unitX;
  const headHalfWidth = LAST_MOVE_ARROW_HEAD_WIDTH / 2;
  const leftX = headBaseX + (perpendicularX * headHalfWidth);
  const leftY = headBaseY + (perpendicularY * headHalfWidth);
  const rightX = headBaseX - (perpendicularX * headHalfWidth);
  const rightY = headBaseY - (perpendicularY * headHalfWidth);

  return `
    <svg
      class="last-move-overlay"
      viewBox="0 0 ${BOARD_VIEWBOX_SIZE} ${BOARD_VIEWBOX_SIZE}"
      aria-hidden="true"
      focusable="false"
    >
      <g>
        <line
          class="last-move-arrow-outline"
          x1="${startX}"
          y1="${startY}"
          x2="${headBaseX}"
          y2="${headBaseY}"
        ></line>
        <line
          class="last-move-arrow"
          x1="${startX}"
          y1="${startY}"
          x2="${headBaseX}"
          y2="${headBaseY}"
        ></line>
        <polygon
          class="last-move-arrow-head-outline"
          points="${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}"
        ></polygon>
        <polygon
          class="last-move-arrow-head"
          points="${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}"
        ></polygon>
      </g>
    </svg>
  `;
}

function currentPreviewArrow() {
  const { gesture } = state.annotations;
  if (!gesture.active || gesture.mode !== 'arrow') {
    return null;
  }
  if (!SQUARE_PATTERN.test(gesture.startSquare) || !SQUARE_PATTERN.test(gesture.lastSquare) || gesture.startSquare === gesture.lastSquare) {
    return null;
  }
  return {
    from: gesture.startSquare,
    to: gesture.lastSquare,
  };
}

function renderAnnotationOverlay() {
  if (!dom.boardAnnotationOverlay) {
    return;
  }
  if (!annotationsVisible()) {
    dom.boardAnnotationOverlay.innerHTML = '';
    return;
  }

  const savedArrows = state.annotations.arrows
    .map((arrow) => buildAnnotationArrowMarkup(arrow.from, arrow.to))
    .join('');
  const previewArrow = currentPreviewArrow();
  const previewMarkup = previewArrow
    ? buildAnnotationArrowMarkup(previewArrow.from, previewArrow.to, { preview: true })
    : '';

  if (!savedArrows && !previewMarkup) {
    dom.boardAnnotationOverlay.innerHTML = '';
    return;
  }

  dom.boardAnnotationOverlay.innerHTML = `
    ${savedArrows}
    ${previewMarkup}
  `;
}

function hasAnyAnnotations() {
  return state.annotations.paintedSquares.size > 0
    || state.annotations.circledSquares.size > 0
    || state.annotations.starredSquares.size > 0
    || state.annotations.arrows.length > 0;
}

function resetAnnotationGesture() {
  state.annotations.gesture = createEmptyAnnotationGestureState();
}

function cancelAnnotationGesture() {
  const shouldRefreshOverlay = state.annotations.gesture.active && state.annotations.gesture.mode === 'arrow';
  resetAnnotationGesture();
  state.annotations.suppressBoardClickUntil = 0;
  state.annotations.suppressContextMenu = false;
  if (shouldRefreshOverlay) {
    renderAnnotationOverlay();
  }
}

function paintAnnotationSquare(square) {
  if (!SQUARE_PATTERN.test(square) || state.annotations.paintedSquares.has(square)) {
    return false;
  }
  state.annotations.paintedSquares.add(square);
  return true;
}

function clearAllAnnotations() {
  if (!hasAnyAnnotations()) {
    return false;
  }
  state.annotations.paintedSquares.clear();
  state.annotations.circledSquares.clear();
  state.annotations.starredSquares.clear();
  state.annotations.arrows = [];
  return true;
}

function toggleAnnotationCircle(square) {
  if (!SQUARE_PATTERN.test(square)) {
    return false;
  }
  if (state.annotations.circledSquares.has(square)) {
    state.annotations.circledSquares.delete(square);
  } else {
    state.annotations.circledSquares.add(square);
  }
  return true;
}

function toggleAnnotationStar(square) {
  if (!SQUARE_PATTERN.test(square)) {
    return false;
  }
  if (state.annotations.starredSquares.has(square)) {
    state.annotations.starredSquares.delete(square);
  } else {
    state.annotations.starredSquares.add(square);
  }
  return true;
}

function addAnnotationArrow(from, to) {
  if (!SQUARE_PATTERN.test(from) || !SQUARE_PATTERN.test(to) || from === to) {
    return false;
  }
  const arrowExists = state.annotations.arrows.some((arrow) => annotationArrowKey(arrow.from, arrow.to) === annotationArrowKey(from, to));
  if (arrowExists) {
    return false;
  }
  state.annotations.arrows = [...state.annotations.arrows, { from, to }];
  return true;
}

function commitAnnotationRender(changed) {
  if (!changed) {
    return false;
  }
  renderBoard();
  schedulePersist();
  return true;
}

function setAnnotateMode(enabled) {
  const nextEnabled = Boolean(enabled);
  if (state.annotations.enabled === nextEnabled) {
    return;
  }
  cancelAnnotationGesture();
  state.annotations.enabled = nextEnabled;
  if (nextEnabled) {
    clearAnalysisSelection();
  }
  renderBoard();
  renderAnalysisPanel();
}

function applyAnnotationGestureSquare(square) {
  const { gesture } = state.annotations;
  if (!gesture.active || !SQUARE_PATTERN.test(square) || square === gesture.lastSquare) {
    return;
  }

  let changed = false;
  if (gesture.button === 2) {
    if (gesture.mode === 'paint') {
      if (!gesture.dragged) {
        gesture.dragged = true;
        changed = paintAnnotationSquare(gesture.startSquare) || changed;
      }
      changed = paintAnnotationSquare(square) || changed;
    } else if (gesture.mode === 'arrow') {
      gesture.dragged = true;
    } else if (gesture.mode === 'star') {
      gesture.dragged = true;
    }
  }

  gesture.lastSquare = square;
  if (gesture.mode === 'arrow') {
    renderAnnotationOverlay();
    return;
  }
  commitAnnotationRender(changed);
}

function squareAtDisplayCell(row, col, orientation) {
  if (orientation === 'black') {
    return `${String.fromCharCode(104 - col)}${row + 1}`;
  }
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

function boardLightAtCell(row, col) {
  return (row + col) % 2 === 0;
}

function buildBoardMarkup() {
  const pieces = currentDisplayPieces();
  const selectedSquare = state.activeTab === TAB_SETUP ? null : state.analysis.selectedSquare;
  const legalMoves = state.activeTab === TAB_SETUP ? [] : state.analysis.legalMoves;
  const legalTargets = new Set(legalMoves.map((move) => move.to));
  const legalCaptures = new Set(
    legalMoves
      .filter((move) => move.captured || String(move.flags || '').includes('e'))
      .map((move) => move.to),
  );
  let markup = '';
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = squareAtDisplayCell(row, col, state.boardOrientation);
      const isLight = boardLightAtCell(row, col);
      const piece = pieces[square] || '';
      const classes = ['board-square', isLight ? 'light' : 'dark'];
      if (state.activeTab === TAB_SETUP) {
        classes.push('is-setup');
      } else {
        classes.push('is-playable');
      }
      if (square === selectedSquare) {
        classes.push('selected');
      }
      if (legalTargets.has(square)) {
        classes.push(legalCaptures.has(square) ? 'legal-capture' : 'legal-target');
      }
      if (state.boardDragHoverSquare === square && state.activeTab === TAB_SETUP) {
        classes.push('drag-hover');
      }
      const fileLabel = row === 7 ? square[0] : '';
      const rankLabel = col === 0 ? square[1] : '';
      const labelClass = isLight ? 'coord-light' : 'coord-dark';
      markup += `
        <div class="${classes.join(' ')}" data-square="${square}" data-piece="${piece}">
          ${annotationMarkupForSquare(square)}
          ${rankLabel ? `<span class="coord-rank ${labelClass}">${rankLabel}</span>` : ''}
          ${fileLabel ? `<span class="coord-file ${labelClass}">${fileLabel}</span>` : ''}
          ${piece ? `
            <div class="board-piece-shell ${state.activeTab === TAB_SETUP ? 'is-draggable' : ''}" data-square="${square}" data-piece="${piece}" draggable="${state.activeTab === TAB_SETUP}">
              <img class="board-piece" src="${PIECE_ASSETS[piece]}" alt="">
            </div>
          ` : ''}
        </div>
      `;
    }
  }
  return `${buildLastMoveArrowMarkup()}${markup}`;
}

function renderBoard() {
  dom.boardGrid.innerHTML = buildBoardMarkup();
  renderAnnotationOverlay();
  renderCapturedPieces();
  syncBoardSize();

  const showEvalRail = state.engine.evalRailVisible || state.focusMode;
  const turnSide = currentTurnSide();
  if (dom.evalBarWrap) {
    dom.evalBarWrap.dataset.turnSide = turnSide;
  }
  if (dom.turnSideMarker) {
    dom.turnSideMarker.dataset.side = turnSide;
    dom.turnSideMarker.title = turnSide === 'b' ? 'Black to move' : 'White to move';
  }
  if (showEvalRail) {
    dom.evalBarWrap?.classList.remove('is-hidden');
    dom.evalBarWrap?.setAttribute('aria-hidden', 'false');
    if (dom.evalBarWrap) {
      dom.evalBarWrap.dataset.orientation = state.boardOrientation;
    }
    const evalDisplay = state.engine.evalRailVisible
      ? currentEvalDisplay()
      : { label: '0.00', whiteFraction: 0.5 };
    const whiteFraction = Number.isFinite(evalDisplay.whiteFraction) ? evalDisplay.whiteFraction : 0.5;
    if (dom.evalBarWhite) {
      dom.evalBarWhite.style.height = `${(whiteFraction * 100).toFixed(1)}%`;
      dom.evalBarWhite.style.width = '100%';
    }
    return;
  }
  dom.evalBarWrap?.classList.add('is-hidden');
  dom.evalBarWrap?.setAttribute('aria-hidden', 'true');
}

function syncBoardSize() {
  if (!dom.rootElement || !dom.boardFrame || !dom.boardColumn) {
    return;
  }

  dom.rootElement.style.setProperty('--board-side-gap', '0px');

  const stageCard = dom.boardColumn.closest('.board-stage-card');
  const stageRect = stageCard?.getBoundingClientRect();
  let stageHeight = stageRect?.height || 0;
  const isMobilePortrait = !state.focusMode && mobilePortraitLayoutActive();

  let containerWidth = dom.boardColumn.clientWidth;
  if (state.focusMode) {
    containerWidth = stageRect?.width || dom.boardColumn.parentElement?.clientWidth || dom.boardColumn.clientWidth;
    const focusHeightBudget = Math.max(0, currentViewportHeight() - elementPaddingInsetPx(dom.pageShell, 'y'));
    const focusWidthBudget = Math.max(0, currentViewportWidth() - elementPaddingInsetPx(dom.pageShell, 'x'));
    stageHeight = focusHeightBudget || stageHeight;
    containerWidth = focusWidthBudget
      ? Math.min(containerWidth || focusWidthBudget, focusWidthBudget)
      : containerWidth;
  } else if (!isMobilePortrait && window.innerWidth > 1100) {
    const pageShellWidth = dom.pageShell?.clientWidth || window.innerWidth;
    const pageShellStyles = dom.pageShell ? window.getComputedStyle(dom.pageShell) : null;
    const pageShellPaddingX = pageShellStyles
      ? cssLengthToPx(pageShellStyles.paddingLeft, remToPx(0.75)) + cssLengthToPx(pageShellStyles.paddingRight, remToPx(0.75))
      : remToPx(1.5);

    const workspace = dom.boardColumn.closest('.workspace');
    const workspaceStyles = workspace ? window.getComputedStyle(workspace) : null;
    const gapPx = workspaceStyles ? (cssLengthToPx(workspaceStyles.getPropertyValue('column-gap'), null) || cssLengthToPx(workspaceStyles.getPropertyValue('gap'), remToPx(0.9))) : remToPx(0.9);

    const maxWorkspaceWidth = workspaceStyles ? cssLengthToPx(workspaceStyles.getPropertyValue('max-width'), remToPx(72)) : remToPx(72);
    const controlPane = workspace?.querySelector('.control-pane');
    const controlPaneWidth = controlPane?.clientWidth || remToPx(29);

    const availableWorkspaceWidth = Math.min(maxWorkspaceWidth, pageShellWidth - pageShellPaddingX);
    containerWidth = Math.max(0, availableWorkspaceWidth - controlPaneWidth - gapPx);
  }
  if (!containerWidth || (!stageHeight && !isMobilePortrait)) {
    return;
  }

  const columnStyles = window.getComputedStyle(dom.boardColumn);
  const framePadding = cssLengthToPx(columnStyles.getPropertyValue('--board-frame-padding'), remToPx(0.5));
  if (isMobilePortrait) {
    const vw = currentViewportWidth();
    const evalRailWidth = cssLengthToPx(columnStyles.getPropertyValue('--eval-rail-track-width'), remToPx(0.8));
    const turnSize = cssLengthToPx(columnStyles.getPropertyValue('--turn-marker-size'), remToPx(1.0));
    const turnGap = cssLengthToPx(columnStyles.getPropertyValue('--turn-marker-gap'), remToPx(0.5));
    // Only the eval rail reserves space beside the board; the turn marker
    // is hidden in portrait (display: none), so its size + gap are excluded.
    const mobileBoardSize = Math.floor(Math.max(0, vw - evalRailWidth));
    console.log('[DEBUG syncBoardSize]', {
      vw,
      evalRailWidth,
      turnSize,
      turnGap,
      framePadding,
      mobileBoardSize,
      boardSizeVar: dom.boardColumn.style.getPropertyValue('--board-size'),
      containerWidth,
      isMobilePortrait
    });
    if (mobileBoardSize > 0) {
      dom.boardColumn.style.setProperty('--board-size', `${mobileBoardSize}px`);
      dom.rootElement.style.setProperty('--board-side-gap', '0px');
    }
    // DEBUG: show formula values as a badge beside the board
    const dbgId = 'board-size-debug';
    let dbgEl = document.getElementById(dbgId);
    if (!dbgEl) {
      dbgEl = document.createElement('div');
      dbgEl.id = dbgId;
      dbgEl.style.cssText = 'position:fixed;bottom:4px;right:4px;z-index:9999;background:#000;color:#0f0;font:12px monospace;padding:4px 8px;border-radius:4px;pointer-events:none;opacity:0.9';
      document.body.appendChild(dbgEl);
    }
    dbgEl.textContent = `board=${mobileBoardSize} vw=${vw} eval=${evalRailWidth} framePad=${framePadding}`;
    return;
  }

  const puzzleInstruction = dom.puzzleBoardInstruction;
  if (puzzleInstruction && !puzzleInstruction.hidden) {
    stageHeight = Math.max(0, stageHeight - (puzzleInstruction.offsetHeight || 80));
  }

  const capturedSizingMetrics = capturedSizingMetricsFromStyles(columnStyles);
  const maxBoardSize = state.focusMode ? remToPx(56) : remToPx(42);
  let boardSize = Math.min(containerWidth, stageHeight, maxBoardSize);

  for (let index = 0; index < 6; index += 1) {
    const rowHeight = capturedRowHeightForBoardSize(boardSize, capturedSizingMetrics);
    const rowGap = capturedRowGapForBoardSize(boardSize);
    const frameBorderWidth = 2;
    const frameShellWidth = (framePadding * 2) + frameBorderWidth;
    const heightBudget = Math.max(0, stageHeight - (rowHeight * 2) - (rowGap * 2) - frameShellWidth);
    const sideOffset = state.focusMode ? focusModeSideOffsetForBoardSize(boardSize) : 0;
    const widthBudget = Math.max(0, containerWidth - sideOffset - frameShellWidth);
    const nextBoardSize = Math.floor(Math.min(widthBudget, heightBudget, maxBoardSize));
    if (Math.abs(nextBoardSize - boardSize) < 1) {
      boardSize = nextBoardSize;
      break;
    }
    boardSize = nextBoardSize;
  }

  if (boardSize > 0) {
    dom.boardColumn.style.setProperty('--board-size', `${boardSize}px`);
  }

  const boardWidth = dom.boardFrame.offsetWidth;
  const boardSideGap = state.focusMode ? 0 : Math.max(0, (containerWidth - boardWidth) / 2);
  dom.rootElement.style.setProperty('--board-side-gap', `${boardSideGap}px`);
}

function renderHeaderMeta() {
  const setupSummary = currentSetupSummary();
  const engineLabel = state.practice.active
    ? 'Practice mode'
    : state.tablebase.probing
      ? 'Tablebase lookup'
      : tablebaseResultActive()
        ? 'Tablebase solved'
        : state.engine.loading
          ? 'Stockfish loading'
          : state.engine.analyzing
            ? 'Stockfish live'
            : state.engine.ready
              ? 'Stockfish ready'
              : 'Stockfish idle';

  dom.boardTitleDisplay.textContent = state.title.trim() || 'Untitled position';
  dom.modePill.textContent = state.practice.active ? 'Practice' : state.activeTab === TAB_SETUP ? 'Setup' : state.activeTab === TAB_PUZZLE ? 'Puzzle' : 'Analysis';
  dom.validityPill.textContent = state.activeTab === TAB_SETUP ? setupSummary.title : engineLabel;
  dom.validityPill.className = `pill ${state.activeTab === TAB_SETUP && setupSummary.kind === 'success' ? 'pill-primary' : ''}`.trim();
  dom.boardContextLabel.textContent = currentContextLabel();
  dom.turnToken.textContent = currentTurnLabel();
  dom.castlingToken.textContent = `Castling ${state.setup.meta.castling === '-' ? 'none' : state.setup.meta.castling}`;
  dom.enPassantToken.textContent = `En passant ${state.setup.meta.enPassant === '-' ? 'none' : state.setup.meta.enPassant}`;
  dom.currentFenCode.textContent = currentBoardFenLabel();
  dom.setupFenCode.textContent = state.setupFen;
  dom.engineReadyLabel.textContent = engineLabel;
  syncAnalyzeButtonState(dom.headerAnalyzeButton);
  renderLessonBookControls();
  syncFocusModeControls();
  if (document.activeElement !== dom.titleInput) {
    dom.titleInput.value = state.title;
  }
}

function renderHeroBanner() {
  const summary = currentSetupSummary();
  dom.heroBanner.innerHTML = `
    <div class="banner ${summary.kind}">
      <div>
        <strong>${escapeHtml(summary.title)}</strong>
        <div>${escapeHtml(summary.message)}</div>
      </div>
    </div>
  `;
}

function commentPreviewText(comment) {
  const normalized = normalizeAnalysisComment(comment).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.length > 140
    ? `${normalized.slice(0, 137).trimEnd()}...`
    : normalized;
}

function renderNotationInlineComment(comment) {
  if (!state.pgnCommentsVisible) {
    return '';
  }
  const preview = commentPreviewText(comment);
  if (!preview) {
    return '';
  }
  return `<span class="notation-inline-comment">{${escapeHtml(preview)}}</span>`;
}

function currentAnalysisCommentContext() {
  const currentNode = getCurrentAnalysisNode() || getAnalysisNode(state.analysis.rootId);
  if (!currentNode || currentNode.id === state.analysis.rootId) {
    return {
      value: currentNode?.comment || '',
    };
  }
  return {
    value: currentNode.comment || '',
  };
}

function renderNotationRootComment() {
  if (!state.pgnCommentsVisible) {
    return '';
  }
  const rootNode = getAnalysisNode(state.analysis.rootId);
  const preview = commentPreviewText(rootNode?.comment);
  if (!preview) {
    return '';
  }
  return `
    <div class="notation-root-comment">
      <span class="notation-inline-comment">{${escapeHtml(preview)}}</span>
    </div>
  `;
}

function renderNotationCommentEditor() {
  if (!state.pgnCommentsVisible) {
    return '';
  }
  const commentState = currentAnalysisCommentContext();
  const expanded = state.pgnCommentsExpanded;
  return `
    <section class="notation-note pgn-comment-section" aria-label="PGN comment">
      <button type="button" class="pgn-comment-toggle" data-action="toggle-pgn-comment-collapse" aria-expanded="${expanded}">
        <span class="pgn-comment-arrow">${expanded ? '▼' : '▶'}</span>
        <span class="pgn-comment-title">PGN Comment</span>
      </button>
      <div class="pgn-comment-content" ${expanded ? '' : 'hidden'}>
        <label class="sr-only" for="notationCommentInput">PGN comment</label>
        <textarea
          id="notationCommentInput"
          class="field-textarea notation-note-input"
          placeholder="Add a PGN comment for this position..."
          spellcheck="true"
        >${escapeHtml(commentState.value)}</textarea>
      </div>
    </section>
  `;
}

function renderNotationMoveToken(node, forceLeadingNumber = false) {
  const ply = getAnalysisPly(node.id);
  const isBlackMove = isBlackMoveForPly(ply);
  const inlineCommentMarkup = renderNotationInlineComment(node.comment);
  let moveNumberMarkup = '';

  if (!isBlackMove) {
    moveNumberMarkup = `<span class="notation-move-number">${moveNumberForPly(ply)}.</span>`;
  } else if (forceLeadingNumber) {
    moveNumberMarkup = `<span class="notation-move-number">${moveNumberForPly(ply)}...</span>`;
  }

  return `${moveNumberMarkup}<button
      type="button"
      class="notation-move ${state.analysis.currentNodeId === node.id ? 'is-current' : ''}"
      data-action="jump-node"
      data-node-id="${node.id}"
    >${escapeHtml(node.san)}</button>${inlineCommentMarkup ? ` ${inlineCommentMarkup}` : ''}`;
}

function renderNotationStaticMoveToken(node, forceLeadingNumber = false) {
  const ply = getAnalysisPly(node.id);
  const isBlackMove = isBlackMoveForPly(ply);
  let moveNumberMarkup = '';

  if (!isBlackMove) {
    moveNumberMarkup = `<span class="notation-move-number">${moveNumberForPly(ply)}.</span>`;
  } else if (forceLeadingNumber) {
    moveNumberMarkup = `<span class="notation-move-number">${moveNumberForPly(ply)}...</span>`;
  }

  return `${moveNumberMarkup}<span class="notation-move ${state.analysis.currentNodeId === node.id ? 'is-current' : ''}">${escapeHtml(node.san)}</span>`;
}

function renderNotationVariation(parentId, childId) {
  return `
    <div class="notation-variation">
      ${renderNotationBranchSequence(parentId, { forcedChildId: childId, skipInitialSiblings: true })}
    </div>
  `;
}

function renderNotationBranchSequence(parentId, options = {}) {
  const { forcedChildId = '', skipInitialSiblings = false } = options;
  let currentParentId = parentId;
  let overrideChildId = forcedChildId;
  let suppressSiblings = skipInitialSiblings;
  let forceLeadingNumber = true;
  const segments = [];
  let tokens = [];
  const seenParents = new Set();

  while (currentParentId && !seenParents.has(currentParentId)) {
    seenParents.add(currentParentId);
    const parentNode = getAnalysisNode(currentParentId);
    if (!parentNode) {
      break;
    }

    const childId = overrideChildId || getAnalysisDisplayedChildId(parentNode);
    overrideChildId = '';
    if (!childId) {
      break;
    }

    const childNode = getAnalysisNode(childId);
    if (!childNode) {
      break;
    }

    tokens.push(renderNotationMoveToken(childNode, forceLeadingNumber));
    forceLeadingNumber = false;

    const siblingIds = suppressSiblings ? [] : parentNode.children.filter((id) => id !== childId);
    suppressSiblings = false;
    if (siblingIds.length) {
      segments.push(`
        <div class="notation-segment">
          <div class="notation-text notation-line">${tokens.join(' ')}</div>
          <div class="notation-variation-list">
            ${siblingIds.map((siblingId) => renderNotationVariation(parentNode.id, siblingId)).join('')}
          </div>
        </div>
      `);
      tokens = [];
      forceLeadingNumber = true;
    }

    currentParentId = childId;
  }

  if (tokens.length) {
    segments.push(`
      <div class="notation-segment">
        <div class="notation-text notation-line">${tokens.join(' ')}</div>
      </div>
    `);
  }

  return segments.join('');
}

function notationSummaryText() {
  if (state.practice.active) {
    return currentPracticePrompt();
  }
  if (!countAnalysisMoveNodes()) {
    return 'Play moves on the board to build the lesson tree.';
  }
  const currentNode = getCurrentAnalysisNode();
  if (!currentNode || currentNode.id === state.analysis.rootId) {
    return 'At the start position.';
  }
  return currentNode?.san
    ? `Current move: ${currentNode.san}.`
    : 'Jump to any point in the lesson tree.';
}

function renderNotationNote() {
  if (!state.note.expanded) {
    return '';
  }

  return `
    <section class="notation-note" aria-label="Lesson note">
      <div>
        <label class="sr-only" for="notationNoteInput">Lesson note</label>
        <textarea
          id="notationNoteInput"
          class="field-textarea notation-note-input"
          placeholder="Add a note for this lesson..."
          spellcheck="true"
        >${escapeHtml(state.note.text)}</textarea>
      </div>
    </section>
  `;
}

function renderNotationPvBlock() {
  if (state.embedMode) {
    return '';
  }
  if (state.practice.active) {
    return '';
  }
  if (!state.pvLinesVisible) {
    return '';
  }
  if (!state.engine.loading && !state.engine.stopping && !state.engine.analyzing && !hasVisibleAnalysisLines()) {
    return '';
  }
  const title = tablebaseDisplayActive() ? 'Tablebase moves' : 'Engine lines';
  return `
    <section class="notation-pv" aria-label="${escapeHtml(title)}">
      <div class="notation-pv-head">
        <div>
          <h3 class="notation-pv-title">${escapeHtml(title)}</h3>
        </div>
      </div>
      ${renderPvLineListMarkup()}
    </section>
  `;
}

function renderPracticeStatusGridMarkup() {
  return `
    <div class="status-grid">
      <div class="status-tile">
        <span class="status-tile-label">${practicePrimaryStatusLabel()}</span>
        <span class="status-tile-value">${practicePrimaryStatusValue()}</span>
      </div>
      <div class="status-tile">
        <span class="status-tile-label">Correct</span>
        <span class="status-tile-value">${state.practice.correctCount}</span>
      </div>
      <div class="status-tile">
        <span class="status-tile-label">Mistakes</span>
        <span class="status-tile-value">${state.practice.incorrectCount}</span>
      </div>
      <div class="status-tile">
        <span class="status-tile-label">Reveals</span>
        <span class="status-tile-value">${state.practice.revealedCount}</span>
      </div>
    </div>
  `;
}

function renderPracticeNotationBlock() {
  if (!state.practice.active) {
    return '';
  }
  const solvedNodes = getPracticeSolvedNodes();
  let forceLeadingNumber = true;
  const solvedMarkup = solvedNodes.length
    ? solvedNodes.map((node) => {
      const markup = renderNotationStaticMoveToken(node, forceLeadingNumber);
      forceLeadingNumber = false;
      return markup;
    }).join(' ')
    : '<p class="notation-empty">No moves solved yet.</p>';
  return `
    <section class="notation-note" aria-label="Practice mode">
      <div class="notation-note-head">
        <div>
          <h3 class="notation-note-title">Practice mode</h3>
        </div>
      </div>
      ${renderPracticeStatusGridMarkup()}
      <div class="banner ${state.practice.feedbackKind}">
        <div>
          <strong>${practiceComplete() ? 'Practice complete' : 'Next move hidden'}</strong>
          <div>${escapeHtml(currentPracticeFeedback())}</div>
        </div>
      </div>
      <div class="notation-text notation-line">${solvedMarkup}</div>
    </section>
  `;
}

function renderNotationPanel() {
  const hasHistory = countAnalysisMoveNodes() > 0;
  const currentNode = getCurrentAnalysisNode();
  const atStart = !currentNode || currentNode.id === state.analysis.rootId;
  const atEnd = !getAnalysisNextNodeId();

  dom.notationSummary.textContent = notationSummaryText();
  dom.notationStartButton.disabled = state.practice.active || !hasHistory || atStart;
  dom.notationPrevButton.disabled = state.practice.active || !hasHistory || atStart;
  dom.notationNextButton.disabled = state.practice.active || !hasHistory || atEnd;
  dom.notationEndButton.disabled = state.practice.active || !hasHistory || atEnd;

  if (state.practice.active) {
    dom.notationPanel.innerHTML = `
      <div class="notation-content-stack">
        ${renderPracticeNotationBlock()}
        ${renderNotationCommentEditor()}
        ${renderNotationNote()}
      </div>
    `;
    // No engine lines during practice mode
    if (dom.mobileEngineLinesSlot) dom.mobileEngineLinesSlot.innerHTML = '';
    return;
  }

  if (!hasHistory) {
    dom.notationPanel.innerHTML = `
      <div class="notation-content-stack">
        <p class="notation-empty">Play on the board to record the lesson tree.</p>
        ${renderNotationCommentEditor()}
        ${renderNotationPvBlock()}
        ${renderNotationNote()}
      </div>
    `;
    if (dom.mobileEngineLinesSlot) dom.mobileEngineLinesSlot.innerHTML = state.embedMode ? '' : renderNotationPvBlock();
    return;
  }

  dom.notationPanel.innerHTML = `
    <div class="notation-content-stack">
      <div class="notation-tree">
        ${renderNotationRootComment()}
        ${renderNotationBranchSequence(state.analysis.rootId)}
      </div>
      ${renderNotationCommentEditor()}
      ${renderNotationPvBlock()}
      ${renderNotationNote()}
    </div>
  `;
  if (dom.mobileEngineLinesSlot) dom.mobileEngineLinesSlot.innerHTML = state.embedMode ? '' : renderNotationPvBlock();
}

function customSelectMarkup(id, selectedValue, options, selectAttributes = '') {
  const selectedOption = options.find((o) => o.value === selectedValue) || options[0];
  const triggerText = selectedOption ? selectedOption.label : '';

  const itemsHtml = options.map((option) => {
    const isSelected = option.value === selectedValue;
    const activeClass = isSelected ? ' is-selected' : '';
    const ariaSelected = isSelected ? 'true' : 'false';
    return `
      <button
        type="button"
        class="custom-select-item${activeClass}"
        role="option"
        data-action="select-custom-option"
        data-select-id="${id}"
        data-value="${escapeHtml(option.value)}"
        aria-selected="${ariaSelected}"
      >
        <span class="custom-select-item-title">${escapeHtml(option.label)}</span>
        ${isSelected ? `
          <span class="custom-select-item-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        ` : ''}
      </button>
    `;
  }).join('');

  return `
    <div class="custom-select-wrapper" data-select-id="${id}">
      <select id="${id}-native" style="display: none;" ${selectAttributes}>
        ${options.map((option) => `
          <option value="${option.value}" ${option.value === selectedValue ? 'selected' : ''}>
            ${option.label}
          </option>
        `).join('')}
      </select>
      <button
        type="button"
        id="${id}"
        class="custom-select-trigger field-select"
        data-action="toggle-custom-select"
        data-select-id="${id}"
        aria-haspopup="listbox"
        aria-expanded="false"
        ${selectAttributes.includes('disabled') ? 'disabled' : ''}
      >
        <span class="custom-select-value">${escapeHtml(triggerText)}</span>
        <span class="custom-select-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>
      <div class="custom-select-menu" role="listbox" hidden>
        ${itemsHtml}
      </div>
    </div>
  `;
}

function closeCustomSelects() {
  document.querySelectorAll('.custom-select-wrapper.is-open').forEach((wrapper) => {
    wrapper.classList.remove('is-open');
    const trigger = wrapper.querySelector('.custom-select-trigger');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
    const menu = wrapper.querySelector('.custom-select-menu');
    if (menu) {
      menu.hidden = true;
    }
  });
}

function sideSelectorMarkup(keyPrefix, selectedValue, labels) {
  return `
    <div class="segment-group">
      ${labels.map((entry) => {
        const isSelected = selectedValue === entry.value;
        const isSideOption = entry.value === 'w' || entry.value === 'b';
        const selectedText = isSelected && entry.selectedText ? String(entry.selectedText) : '';
        const sideClass = isSideOption ? ` side-segment side-${entry.value}` : '';
        return `
        <button
          type="button"
          class="segmented-button${sideClass} ${isSelected ? 'is-selected' : ''}"
          data-action="${keyPrefix}"
          data-value="${entry.value}"
          aria-pressed="${isSelected ? 'true' : 'false'}"
        >
          <span class="segmented-button-main">
            ${isSideOption ? `<span class="side-segment-swatch ${entry.value === 'b' ? 'is-black' : 'is-white'}" aria-hidden="true"></span>` : ''}
            <span class="segmented-button-label">${escapeHtml(entry.label)}</span>
          </span>
          ${selectedText ? `<span class="segmented-button-status">${escapeHtml(selectedText)}</span>` : ''}
        </button>
        `;
      }).join('')}
    </div>
  `;
}

function practiceKindSelectorMarkup() {
  return sideSelectorMarkup('set-practice-kind', state.practicePreferenceKind, [
    { value: PRACTICE_KIND_LINE, label: 'Selected line' },
    { value: PRACTICE_KIND_BRANCH, label: 'Branch drill' },
  ]);
}

function practiceAvailabilityMessage(practiceKind) {
  if (practiceKind === PRACTICE_KIND_BRANCH) {
    return branchPracticeReady()
      ? 'The session starts from the current position and accepts any recorded child move.'
      : 'Jump to a lesson position with at least one recorded child move to start a branch drill.';
  }
  return selectedLinePracticeReady()
    ? 'The session follows the displayed lesson line from the setup position.'
    : 'Record at least one move on the selected lesson line before starting practice mode.';
}

function advancedControlsMarkup() {
  const rights = parseCastlingRights(state.setup.meta.castling);
  const whiteKingReady = state.setup.pieces.e1 === 'K';
  const whiteKingSideEnabled = whiteKingReady && state.setup.pieces.h1 === 'R';
  const whiteQueenSideEnabled = whiteKingReady && state.setup.pieces.a1 === 'R';
  const blackKingReady = state.setup.pieces.e8 === 'k';
  const blackKingSideEnabled = blackKingReady && state.setup.pieces.h8 === 'r';
  const blackQueenSideEnabled = blackKingReady && state.setup.pieces.a8 === 'r';
  const enPassantSquares = legalEnPassantSquaresForPieces({
    pieces: state.setup.pieces,
    activeColor: state.setup.meta.activeColor,
    castling: sanitizeCastlingForPieces(state.setup.meta.castling, state.setup.pieces),
    halfmove: state.setup.meta.halfmove,
    fullmove: state.setup.meta.fullmove,
  });
  const activeValue = state.setup.meta.activeColor;
  const activeLabel = activeValue === 'b' ? 'Black to move' : 'White to move';

  return `
    <div class="details-body">
      <div class="stack-grid">
        <div class="field-row">
          <label class="field-label">Side to move (next turn)</label>
          ${sideSelectorMarkup('set-active-color', activeValue, [
            { value: 'w', label: 'White', selectedText: 'To move' },
            { value: 'b', label: 'Black', selectedText: 'To move' },
          ])}
          <p class="setup-turn-indicator">
            <span class="setup-turn-swatch ${activeValue === 'b' ? 'is-black' : 'is-white'}" aria-hidden="true"></span>
            <span>${activeLabel}</span>
          </p>
        </div>

        <div class="castling-grid">
          <div class="castling-column">
            <label class="field-label">White castling</label>
            <label class="checkbox-chip">
              <input type="checkbox" data-action="toggle-castling" data-flag="K" ${rights.has('K') ? 'checked' : ''} ${whiteKingSideEnabled ? '' : 'disabled'}>
              <span>O-O</span>
            </label>
            <label class="checkbox-chip">
              <input type="checkbox" data-action="toggle-castling" data-flag="Q" ${rights.has('Q') ? 'checked' : ''} ${whiteQueenSideEnabled ? '' : 'disabled'}>
              <span>O-O-O</span>
            </label>
          </div>
          <div class="castling-column">
            <label class="field-label">Black castling</label>
            <label class="checkbox-chip">
              <input type="checkbox" data-action="toggle-castling" data-flag="k" ${rights.has('k') ? 'checked' : ''} ${blackKingSideEnabled ? '' : 'disabled'}>
              <span>O-O</span>
            </label>
            <label class="checkbox-chip">
              <input type="checkbox" data-action="toggle-castling" data-flag="q" ${rights.has('q') ? 'checked' : ''} ${blackQueenSideEnabled ? '' : 'disabled'}>
              <span>O-O-O</span>
            </label>
          </div>
        </div>

        <div class="field-row">
          <label class="field-label" for="enPassantSelect">En passant</label>
          ${customSelectMarkup(
            'enPassantSelect',
            state.setup.meta.enPassant || '-',
            [
              { value: '-', label: 'None' },
              ...enPassantSquares.map((square) => ({ value: square, label: square }))
            ],
            'data-action="set-en-passant"'
          )}
        </div>
      </div>
    </div>
  `;
}

function renderSetupPanel() {
  const currentPalette = currentPalettePieces();
  const paletteIsBlack = state.setup.paletteColor === 'b';
  const paletteLabel = paletteIsBlack ? 'Placing black pieces' : 'Placing white pieces';
  const sideToMoveValue = state.setup.meta.activeColor;
  const sideToMoveLabel = sideToMoveValue === 'b' ? 'Black to move' : 'White to move';
  const markup = `
    <article class="lesson-section setup-board-section">
      <div class="lesson-section-header">
        <div>
          <h3 class="lesson-section-title">Board setup</h3>
        </div>
      </div>

      <div class="action-row action-row-compact setup-board-actions">
        <button type="button" class="action-button tonal" data-action="reset-setup">Reset</button>
        <button type="button" class="action-button danger" data-action="clear-board">Clear</button>
        <button type="button" class="action-button" data-action="flip-board">Flip</button>
      </div>

      <div class="section-divider setup-board-divider"></div>

      <div class="panel-grid setup-palette-panel">
        <div class="field-row setup-palette-color">
          ${sideSelectorMarkup('set-palette-color', state.setup.paletteColor, [
            { value: 'w', label: 'White', selectedText: 'Placing' },
            { value: 'b', label: 'Black', selectedText: 'Placing' },
          ])}
        </div>

        <div class="setup-active-summary">
          <span class="setup-turn-swatch ${paletteIsBlack ? 'is-black' : 'is-white'}" aria-hidden="true"></span>
          <strong>${paletteLabel}</strong>
        </div>

        <div class="piece-palette setup-piece-palette">
          ${currentPalette.map((piece) => `
            <div class="piece-tool">
              <button
                type="button"
                class="piece-tool-button ${state.setup.armedPiece === piece ? 'is-armed' : ''} ${piece === piece.toLowerCase() ? 'is-black-piece' : ''}"
                data-action="toggle-piece-tool"
                data-piece="${piece}"
                data-drag-piece="${piece}"
                draggable="true"
                aria-label="${piece === piece.toLowerCase() ? 'Black' : 'White'} ${PIECE_LABELS[piece.toUpperCase()]}"
              >
                <img class="piece-tool-icon" src="${PIECE_ASSETS[piece]}" alt="">
              </button>
              <span class="piece-tool-label">${PIECE_LABELS[piece.toUpperCase()]}</span>
            </div>
          `).join('')}
          <div class="piece-tool">
            <button
              type="button"
              class="piece-tool-button ${state.setup.armedPiece === 'eraser' ? 'is-armed' : ''}"
              data-action="toggle-piece-tool"
              data-piece="eraser"
              aria-label="Eraser"
            >
              <svg class="piece-tool-icon eraser-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="m20 20-5-5"></path>
                <path d="m3 16 5 5c.9.9 2 1 3 0l9-9c.9-.9 1-2 0-3L15 4c-.9-.9-2-.9-3 0L3 13c-.9.9-.9 2 0 3Z"></path>
                <path d="m7 12 5 5"></path>
              </svg>
            </button>
            <span class="piece-tool-label">Erase</span>
          </div>
        </div>
      </div>
    </article>

    <article class="lesson-section">
      <div class="stack-grid">
        <div class="field-row">
          <label class="field-label" for="fenInput">FEN</label>
          <textarea id="fenInput" class="field-textarea" spellcheck="false">${escapeHtml(state.setup.fenInput)}</textarea>
        </div>

        <div class="action-row">
          <button type="button" class="action-button action-button-static primary" data-action="apply-fen">Apply FEN</button>
          <button type="button" class="action-button action-button-static tonal" data-action="reset-fen">Reset draft</button>
          <button type="button" class="action-button action-button-static tonal" data-action="scan-board">Scan board</button>
        </div>

        ${state.setup.scanStatus ? `
          <div class="banner ${state.setup.scanStatusType || 'warning'}">
            <div>
              <strong>Board Scan</strong>
              <div>${escapeHtml(state.setup.scanStatus)}</div>
            </div>
          </div>
        ` : ''}

        ${state.setup.fenError ? `
          <div class="banner danger">
            <div>
              <strong>FEN blocked</strong>
              <div>${escapeHtml(state.setup.fenError)}</div>
            </div>
          </div>
        ` : ''}
      </div>
    </article>

    <article class="lesson-section lesson-section-compact">
      <button type="button" class="details-toggle" data-action="toggle-advanced">
        <span class="details-toggle-main">
          <span>Advanced position details</span>
          <span class="details-toggle-status">Side to move: ${sideToMoveLabel}</span>
        </span>
        <span class="details-toggle-copy">${state.setup.advancedOpen ? 'Hide' : 'Show'}</span>
      </button>
      ${state.setup.advancedOpen ? advancedControlsMarkup() : ''}
    </article>
  `;
  withPreservedScroll(dom.controlPaneScroll, () => {
    dom.setupPanel.innerHTML = markup;
  });
}

function renderPracticeToolSection() {
  const practiceReady = state.practicePreferenceKind === PRACTICE_KIND_BRANCH
    ? branchPracticeReady()
    : selectedLinePracticeReady();
  if (!state.practice.active) {
    return `
      <article class="lesson-section">
        <div class="lesson-section-header">
          <div>
            <h3 class="lesson-section-title">Practice mode</h3>
          </div>
        </div>
        <div class="stack-grid">
          <div class="field-row">
            <label class="field-label">Practice type</label>
            ${practiceKindSelectorMarkup()}
          </div>
          <div class="banner ${practiceReady ? 'warning' : 'danger'}">
            <div>
              <strong>${practiceReady ? 'Ready to practice' : 'Practice unavailable'}</strong>
              <div>${escapeHtml(practiceAvailabilityMessage(state.practicePreferenceKind))}</div>
            </div>
          </div>
          <div class="action-row action-row-compact">
            <button type="button" class="action-button primary" data-action="start-practice" ${practiceReady ? '' : 'disabled'}>Start practice</button>
          </div>
        </div>
      </article>
    `;
  }
  return `
    <article class="lesson-section">
      <div class="lesson-section-header">
        <div>
          <h3 class="lesson-section-title">Practice mode</h3>
        </div>
      </div>
      ${renderPracticeStatusGridMarkup()}
      <div class="stack-grid">
        <div class="banner ${state.practice.feedbackKind}">
          <div>
            <strong>${practiceComplete() ? 'Practice complete' : 'Practice active'}</strong>
            <div>${escapeHtml(currentPracticeFeedback())}</div>
          </div>
        </div>
        <div class="action-row action-row-compact">
          <button type="button" class="action-button tonal" data-action="practice-hint" ${practiceComplete() ? 'disabled' : ''}>Hint</button>
          <button type="button" class="action-button tonal" data-action="practice-reveal" ${practiceComplete() ? 'disabled' : ''}>Reveal move</button>
          <button type="button" class="action-button" data-action="restart-practice">Restart</button>
          <button type="button" class="action-button danger" data-action="stop-practice">Stop practice</button>
        </div>
      </div>
    </article>
  `;
}

function renderAnalysisStatusGridMarkup() {
  const tablebaseResult = currentTablebaseResultForDisplay();
  if (state.tablebase.probing || tablebaseResult) {
    const result = tablebaseResult || null;
    return `
      <div class="status-grid">
        <div class="status-tile">
          <span class="status-tile-label">Result</span>
          <span class="status-tile-value">${escapeHtml(result?.resultLabel || 'Probing')}</span>
        </div>
        <div class="status-tile">
          <span class="status-tile-label">DTM</span>
          <span class="status-tile-value">${escapeHtml(formatTablebaseMetric(result?.dtm))}</span>
        </div>
        <div class="status-tile">
          <span class="status-tile-label">DTZ</span>
          <span class="status-tile-value">${escapeHtml(formatTablebaseMetric(result?.dtz))}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="status-grid">
      <div class="status-tile">
        <span class="status-tile-label">Evaluation</span>
        <span class="status-tile-value">${escapeHtml(state.engine.evalLabel || '0.00')}</span>
      </div>
      <div class="status-tile">
        <span class="status-tile-label">Depth</span>
        <span class="status-tile-value">${state.engine.depth ?? '—'}</span>
      </div>
      <div class="status-tile">
        <span class="status-tile-label">Nodes</span>
        <span class="status-tile-value">${escapeHtml(formatNodeCount(state.engine.nodes))}</span>
      </div>
    </div>
  `;
}

function analysisStatusBannerKind(hasBoard) {
  if (!hasBoard) {
    return 'danger';
  }
  if (state.tablebase.probing || state.engine.analyzing) {
    return 'warning';
  }
  return 'success';
}

function analysisStatusBannerTitle(hasBoard) {
  if (!hasBoard) {
    return 'Analysis unavailable';
  }
  return tablebaseDisplayActive() ? 'Tablebase status' : 'Engine status';
}

function analysisStatusSummary() {
  if (state.tablebase.probing) {
    return state.engine.summary || `Probing Lichess tablebase for this ${TABLEBASE_ENDGAME_LABEL}...`;
  }
  const tablebaseResult = currentTablebaseResultForDisplay();
  if (tablebaseResult) {
    return tablebaseResult.summary;
  }
  return state.engine.summary;
}

function renderAnalysisPanel() {
  const hasBoard = Boolean(state.analysis.game);
  const analyzeButtonLabel = currentAnalyzeButtonLabel();
  const analysisButtonDisabled = analysisToggleDisabled(hasBoard);
  const depthInputDisabled = state.practice.active || !hasBoard || state.tablebase.probing || state.engine.loading || state.engine.analyzing || state.engine.stopping;
  const analyzeButtonTone = state.engine.analyzing || state.engine.stopping ? 'danger' : 'primary';
  const pvLineMarkup = !state.practice.active && state.pvLinesVisible ? renderPvLineListMarkup() : '';
  dom.analysisPanel.innerHTML = `
    <article class="lesson-section">
      <div class="lesson-section-header">
        <div>
          <h3 class="lesson-section-title">Analysis</h3>
        </div>
      </div>
      <div class="action-row action-row-compact">
        <button type="button" class="action-button ${analyzeButtonTone}" data-action="toggle-analysis" ${analysisButtonDisabled ? 'disabled' : ''}>
          ${escapeHtml(analyzeButtonLabel)}
        </button>
      </div>
      <div class="analysis-target-depth-row">
        <label class="field-label" for="analysisTargetDepthInput">Target depth</label>
        <div class="analysis-target-depth-control">
          <input
            id="analysisTargetDepthInput"
            class="field-input analysis-target-depth-input"
            type="number"
            min="${ANALYSIS_TARGET_DEPTH_MIN}"
            max="${ANALYSIS_TARGET_DEPTH_MAX}"
            step="1"
            inputmode="numeric"
            value="${currentAnalysisTargetDepth()}"
            ${depthInputDisabled ? 'disabled' : ''}
          >
        </div>
      </div>
    </article>
    ${renderLineNavigationSection()}
    ${renderPracticeToolSection()}
  `;
  renderGuidedReviewAnalysisPanel();
  renderEmbedAnalysisPanel();
}

function renderLineNavigationSection() {
  const hasBoard = Boolean(state.analysis.game);
  const totalPly = countAnalysisMoveNodes();
  const branchPoints = countAnalysisBranchPoints();
  const lineSummary = totalPly
    ? `${totalPly} ply recorded in the lesson tree with ${branchPoints || 0} branch point${branchPoints === 1 ? '' : 's'}.`
    : 'No moves recorded yet. Use Analysis to start building the lesson tree.';
  const annotateButtonClass = `action-button tonal ${state.annotations.enabled ? 'is-active' : ''}`.trim();
  return `
    <article class="lesson-section">
      <div class="lesson-section-header">
        <div>
          <h3 class="lesson-section-title">Line navigation</h3>
        </div>
      </div>
      <div class="action-row action-row-compact">
        <button type="button" class="action-button tonal" data-action="navigate-start" ${(hasBoard && !state.practice.active) ? '' : 'disabled'}>Back to start</button>
        <button type="button" class="action-button tonal" data-action="reset-analysis" ${hasBoard ? '' : 'disabled'}>Reset to setup</button>
        <button type="button" class="${annotateButtonClass}" data-action="toggle-annotate" aria-pressed="${state.annotations.enabled ? 'true' : 'false'}">Annotate</button>
        <button type="button" class="action-button" data-action="flip-board">Flip board</button>
      </div>
      <div class="stack-grid line-navigation-meta">
        <p class="muted-copy">${escapeHtml(lineSummary)}</p>
        <div class="banner ${hasBoard ? 'success' : 'warning'}">
          <div>
            <strong>${hasBoard ? 'Current board' : 'Line waiting'}</strong>
            <div>${escapeHtml(state.analysis.boardMessage)}</div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderPromotionModal() {
  const pending = state.analysis.pendingPromotion;
  if (!pending?.moves?.length) {
    dom.promotionModal.hidden = true;
    dom.promotionModal.setAttribute('aria-hidden', 'true');
    dom.promotionChoices.innerHTML = '';
    return;
  }
  const moveColor = pending.moves[0]?.color === 'b' ? 'b' : 'w';
  dom.promotionModal.hidden = false;
  dom.promotionModal.setAttribute('aria-hidden', 'false');
  dom.promotionSubtitle.textContent = `${moveColor === 'w' ? 'White' : 'Black'} pawn promotion choices`;
  dom.promotionChoices.innerHTML = ['q', 'r', 'b', 'n'].map((promotion) => {
    const key = moveColor === 'w' ? promotion.toUpperCase() : promotion;
    const name = PIECE_LABELS[promotion.toUpperCase()];
    return `
      <button type="button" class="promotion-choice" data-action="choose-promotion" data-promotion="${promotion}">
        <img src="${PIECE_ASSETS[key]}" alt="">
        <span>${name}</span>
      </button>
    `;
  }).join('');
}

function renderTabs() {
  state.activeTab = normalizeActiveTab(state.activeTab);
  if (dom.rootElement) {
    dom.rootElement.dataset.activeTab = state.activeTab;
  }
  document.querySelectorAll('.tab-chip').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === state.activeTab);
  });

  const panels = [
    [dom.setupPanel, TAB_SETUP],
    [dom.analysisPanel, TAB_ANALYSIS],
    [dom.playPanel, TAB_PLAY],
    [dom.puzzlePanel, TAB_PUZZLE],
  ];
  panels.forEach(([panel, tab]) => {
    if (!panel) {
      return;
    }
    const active = tab === state.activeTab;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
}

function renderActiveToolPanel() {
  state.activeTab = normalizeActiveTab(state.activeTab);
  if (state.activeTab === TAB_SETUP) {
    renderSetupPanel();
    return;
  }
  if (state.activeTab === TAB_PLAY) {
    renderPlayPanel();
    return;
  }
  if (state.activeTab === TAB_PUZZLE) {
    renderPuzzlePanel();
    return;
  }
  renderAnalysisPanel();
}

function renderWorkspaceTools() {
  if (!dom.workspaceTools) {
    return;
  }
  if (state.boardOnlyMode) {
    dom.workspaceTools.hidden = !state.boardOnlySetupVisible;
    return;
  }
  dom.workspaceTools.hidden = state.guidedReview.active || !state.toolsExpanded;
}

function renderAll() {
  syncFocusModeUi();
  syncBoardOnlyUi();
  renderPuzzleBoardInstruction();
  renderBoard();
  renderHeaderMeta();
  renderHeroBanner();
  renderNotationPanel();
  renderTabs();
  renderActiveToolPanel();
  renderWorkspaceTools();
  renderGuidedReviewVisibility();
  renderEmbedAnalysisPanel();
  syncLessonVisibilityMenuState();
  syncFullscreenMenuState();
  renderPromotionModal();
  syncPgnBrowseButton();
  syncOpeningInfoDisplay();
}

function renderAfterSetupMetaChange() {
  withPreservedScroll(dom.controlPaneScroll, () => {
    renderHeaderMeta();
    renderHeroBanner();
    renderNotationPanel();
    renderActiveToolPanel();
    renderPromotionModal();
  });
}

function handleBoardClick(event) {
  if (Date.now() < state.annotations.suppressBoardClickUntil) {
    event.preventDefault();
    state.annotations.suppressBoardClickUntil = 0;
    return;
  }
  const squareEl = event.target.closest('.board-square');
  if (!squareEl) {
    return;
  }
  const square = squareEl.dataset.square;
  if (!square) {
    return;
  }

  if (annotateModeActive()) {
    event.preventDefault();
    return;
  }

  if (state.activeTab === TAB_SETUP) {
    if (state.setup.armedPiece) {
      placeSetupPiece(square, state.setup.armedPiece);
      return;
    }
    if (state.setup.pieces[square]) {
      const piece = state.setup.pieces[square];
      state.setup.armedPiece = piece;
      state.setup.paletteColor = piece === piece.toLowerCase() ? 'b' : 'w';
      if (state.boardOnlyMode && state.boardOnlyTeacherSetupActive) {
        renderBoard();
      } else {
        renderSetupPanel();
      }
    }
    return;
  }

  handleAnalysisSquareClick(square);
}

function handleBoardContextMenu(event) {
  if (annotationsVisible()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (state.activeTab !== TAB_SETUP) {
    return;
  }
  const square = squareFromEventTarget(event.target);
  if (!square) {
    return;
  }
  event.preventDefault();
  removeSetupPiece(square);
}

function annotationGestureModeFromEvent(event) {
  if (event.button === 2 && event.altKey) {
    return 'arrow';
  }
  if (event.button === 2 && event.ctrlKey) {
    return 'star';
  }
  return 'paint';
}

function handleBoardMouseDown(event) {
  if (event.button !== 0 && event.button !== 2) {
    return;
  }
  if (event.button === 2) {
    if (!annotationsVisible()) {
      return;
    }
  } else {
    if (!annotationsVisible()) {
      return;
    }
    if (hasAnyAnnotations()) {
      event.preventDefault();
      state.annotations.suppressBoardClickUntil = Date.now() + 400;
      commitAnnotationRender(clearAllAnnotations());
      return;
    }
    if (annotateModeActive()) {
      event.preventDefault();
      state.annotations.suppressBoardClickUntil = Date.now() + 400;
      return;
    }
    return;
  }

  const squareEl = event.target.closest('.board-square');
  if (!squareEl) {
    return;
  }
  const square = squareEl.dataset.square || '';
  if (!SQUARE_PATTERN.test(square)) {
    return;
  }

  event.preventDefault();
  state.annotations.gesture = {
    active: true,
    button: event.button,
    mode: annotationGestureModeFromEvent(event),
    startSquare: square,
    lastSquare: square,
    dragged: false,
  };
  state.annotations.suppressContextMenu = event.button === 2;
}

function handleDocumentMouseMove(event) {
  if (!state.annotations.gesture.active) {
    return;
  }
  if (event.buttons === 0) {
    cancelAnnotationGesture();
    return;
  }
  applyAnnotationGestureSquare(squareFromClientPoint(event.clientX, event.clientY));
}

function handleDocumentMouseUp(event) {
  const { gesture } = state.annotations;
  if (!gesture.active) {
    return;
  }

  const releaseSquare = squareFromClientPoint(event.clientX, event.clientY);
  let changed = false;
  if (gesture.button === 2) {
    if (gesture.mode === 'paint' && !gesture.dragged && releaseSquare === gesture.startSquare) {
      changed = toggleAnnotationCircle(gesture.startSquare);
    } else if (gesture.mode === 'star' && !gesture.dragged && releaseSquare === gesture.startSquare) {
      changed = toggleAnnotationStar(gesture.startSquare);
    } else if (gesture.mode === 'arrow' && releaseSquare && releaseSquare !== gesture.startSquare) {
      changed = addAnnotationArrow(gesture.startSquare, releaseSquare);
    }
  }

  const shouldRefreshOverlay = gesture.mode === 'arrow';
  resetAnnotationGesture();
  if (changed) {
    commitAnnotationRender(true);
  } else if (shouldRefreshOverlay) {
    renderAnnotationOverlay();
  }
  if (gesture.button === 2) {
    window.setTimeout(() => {
      state.annotations.suppressContextMenu = false;
    }, 250);
  } else {
    state.annotations.suppressContextMenu = false;
  }
}

function handleDocumentContextMenu(event) {
  const square = squareFromEventTarget(event.target);
  if (annotationsVisible() && square) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!state.annotations.suppressContextMenu) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  state.annotations.suppressContextMenu = false;
}

function extractDragPayload(event) {
  const text = event.dataTransfer?.getData('application/x-chess-piece');
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clearSetupDragPreview() {
  if (!setupDragPreviewEl) {
    return;
  }
  setupDragPreviewEl.remove();
  setupDragPreviewEl = null;
}

function setSetupDragPreview(event, piece, sourceEl) {
  if (!event.dataTransfer?.setDragImage || !PIECE_ASSETS[piece]) {
    return;
  }
  clearSetupDragPreview();
  const rect = sourceEl?.getBoundingClientRect?.();
  const sourceSize = Math.min(rect?.width || 72, rect?.height || 72);
  const size = Math.round(clamp(sourceSize, 40, 92));
  const preview = document.createElement('div');
  preview.className = 'setup-drag-preview';
  preview.style.width = `${size}px`;
  preview.style.height = `${size}px`;

  const image = document.createElement('img');
  image.src = PIECE_ASSETS[piece];
  image.alt = '';
  preview.append(image);
  document.body.append(preview);
  event.dataTransfer.setDragImage(preview, size / 2, size / 2);
  setupDragPreviewEl = preview;
}

function handleBoardDragStart(event) {
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
}

function handlePaletteDragStart(event) {
  const dragSource = event.target.closest('[data-drag-piece]');
  if (!dragSource) {
    return;
  }
  const piece = dragSource.dataset.dragPiece;
  if (!piece) {
    return;
  }
  event.dataTransfer?.setData('application/x-chess-piece', JSON.stringify({
    piece,
    fromSquare: null,
    source: 'palette',
  }));
  setSetupDragPreview(event, piece, dragSource);
  event.dataTransfer.effectAllowed = 'copy';
  state.setupDrag = {
    active: true,
    source: 'palette',
    piece,
    fromSquare: '',
    droppedOnBoard: false,
  };
}

function handleBoardDragOver(event) {
  if (state.activeTab !== TAB_SETUP) {
    return;
  }
  const squareEl = event.target.closest('.board-square');
  if (!squareEl) {
    return;
  }
  event.preventDefault();
  updateBoardDragHover(squareEl.dataset.square || null);
}

function handleBoardDrop(event) {
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
}

function updateBoardDragHover(square) {
  if (state.boardDragHoverSquare === square) {
    return;
  }
  if (state.boardDragHoverSquare) {
    const previous = dom.boardGrid.querySelector(`[data-square="${state.boardDragHoverSquare}"]`);
    previous?.classList.remove('drag-hover');
  }
  state.boardDragHoverSquare = square;
  if (state.boardDragHoverSquare) {
    const next = dom.boardGrid.querySelector(`[data-square="${state.boardDragHoverSquare}"]`);
    next?.classList.add('drag-hover');
  }
}

function clearBoardDragHover() {
  updateBoardDragHover(null);
}

function handleBoardDragEnd() {
  clearBoardDragHover();
  clearSetupDragPreview();
  const dragState = state.setupDrag;
  state.setupDrag = createEmptySetupDragState();
  if (!dragState.active) {
    return;
  }
  const droppedOutsideBoard = !dragState.droppedOnBoard;
  const shouldDelete = state.activeTab === TAB_SETUP
    && dragState.source === 'board'
    && SQUARE_PATTERN.test(dragState.fromSquare)
    && droppedOutsideBoard;
  if (shouldDelete) {
    removeSetupPiece(dragState.fromSquare);
  }
}

function handleDocumentClick(event) {
  const clickTarget = event.target;
  const clickedInsideHeaderMenu = clickTarget instanceof Element && Boolean(clickTarget.closest('.lesson-overflow'));
  if (!clickedInsideHeaderMenu) {
    closeHeaderMenus();
  }

  const clickedInsideCustomSelect = clickTarget instanceof Element && Boolean(clickTarget.closest('.custom-select-wrapper'));
  if (!clickedInsideCustomSelect) {
    closeCustomSelects();
  }

  const actionEl = clickTarget instanceof Element ? clickTarget.closest('[data-action]') : null;
  if (!actionEl) {
    return;
  }
  if (guidedReviewController?.handleAction(actionEl)) {
    return;
  }
  const { action } = actionEl.dataset;
  switch (action) {
    case 'toggle-custom-select': {
      const wrapper = actionEl.closest('.custom-select-wrapper');
      if (wrapper) {
        const isOpen = wrapper.classList.contains('is-open');
        closeCustomSelects();
        if (!isOpen) {
          wrapper.classList.add('is-open');
          const trigger = wrapper.querySelector('.custom-select-trigger');
          if (trigger) {
            trigger.setAttribute('aria-expanded', 'true');
          }
          const menu = wrapper.querySelector('.custom-select-menu');
          if (menu) {
            menu.hidden = false;
            // Let's decide placement based on space
            const rect = trigger.getBoundingClientRect();
            const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
            const menuHeight = menu.offsetHeight || 180; // approximate
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;
            if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
              menu.dataset.placement = 'up';
              menu.style.top = 'auto';
              menu.style.bottom = 'calc(100% + 0.4rem)';
            } else {
              menu.dataset.placement = 'down';
              menu.style.top = 'calc(100% + 0.4rem)';
              menu.style.bottom = 'auto';
            }
          }
        }
      }
      break;
    }
    case 'select-custom-option': {
      const wrapper = actionEl.closest('.custom-select-wrapper');
      if (wrapper) {
        const value = actionEl.dataset.value;
        const nativeSelect = wrapper.querySelector('select');
        if (nativeSelect) {
          nativeSelect.value = value;
          nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeCustomSelects();
      }
      break;
    }
    case 'toggle-lesson-picker':
      toggleLessonPickerMenu();
      break;
    case 'select-lesson':
      closeLessonPickerMenu();
      const lessonId = actionEl.dataset.value;
      if (lessonId === 'add-lesson') {
        createNewLesson();
      } else {
        activateLessonById(lessonId);
      }
      break;
    case 'toggle-lesson-book-actions':
      toggleLessonBookActionsMenu();
      break;
    case 'toggle-lesson-actions':
      toggleLessonActionsMenu();
      break;
    case 'new-lesson':
      closeLessonBookActionsMenu();
      createNewLesson();
      break;
    case 'duplicate-lesson':
      closeLessonBookActionsMenu();
      duplicateCurrentLesson();
      break;
    case 'delete-lesson':
      closeLessonBookActionsMenu();
      deleteCurrentLesson();
      break;
    case 'set-tab': {
      const targetTab = actionEl.dataset.tab;

      // Capture puzzle position before stopPlayGame/finishPuzzleSession clears the session flag
      const puzzleFenForSetup = targetTab === TAB_SETUP && state.puzzle.sessionActive
        ? state.analysis.currentFen : null;

      if (state.practice.active && targetTab === TAB_SETUP) {
        stopPracticeSession();
      }
      if (state.play.active && targetTab !== (state.puzzle.sessionActive ? TAB_PUZZLE : TAB_PLAY)) {
        stopPlayGame({ reason: 'Game abandoned by switching tabs.' });
      }
      if ((state.puzzle.generating || state.puzzle.isGeneratingPuzzleBatch) && targetTab !== TAB_PUZZLE) {
        cancelPuzzleGeneration();
      }

      // Handle transition to/from lessons (Guided Review)
      if (targetTab === TAB_LESSONS) {
        if (!state.guidedReview.active) {
          guidedReviewController?.openGuidedReviewMode();
        }
      } else {
        if (state.guidedReview.active) {
          guidedReviewController?.closeGuidedReviewMode();
        }
        state.previousNonLessonTab = targetTab;
      }

      // Handle tools expanded state
      if (targetTab === TAB_STUDY) {
        state.toolsExpanded = false;
      } else if (targetTab !== TAB_LESSONS) {
        state.toolsExpanded = true;
      }

      // Sync puzzle position into setup state so the Setup tab shows the puzzle position
      if (puzzleFenForSetup) {
        const parsed = parseFenLike(puzzleFenForSetup);
        if (parsed.ok) {
          const sanitized = sanitizeSetupState(parsed.pieces, parsed.meta);
          state.setup.pieces = sanitized.pieces;
          state.setup.meta = sanitized.meta;
          state.setupFen = buildFenFromPiecesAndMeta(sanitized.pieces, sanitized.meta);
          state.setup.fenInput = state.setupFen;
        }
      }

      state.activeTab = normalizeActiveTab(targetTab, TAB_PLAY);
      renderAll();
      schedulePersist();
      break;
    }
    case 'start-play':
      void startPlayGame();
      break;
    case 'stop-play':
      stopPlayGame({ reason: 'Resigned.' });
      break;
    case 'offer-draw':
      offerDraw();
      break;
    case 'flip-board':
      flipBoard();
      break;
    case 'reset-setup':
      resetSetupPosition();
      break;
    case 'clear-board':
      clearBoard();
      break;
    case 'toggle-piece-tool':
      toggleArmedPiece(actionEl.dataset.piece || '');
      break;
    case 'set-palette-color':
      setPaletteColor(actionEl.dataset.value || 'w');
      break;
    case 'set-active-color':
      state.setup.scanStatus = '';
      state.setup.scanStatusType = '';
      setSetupActiveColor(actionEl.dataset.value || 'w');
      break;
    case 'set-palette-color':
      state.setup.scanStatus = '';
      state.setup.scanStatusType = '';
      setPaletteColor(actionEl.dataset.value || 'w');
      break;
    case 'scan-board':
      if (dom.scanBoardInput) {
        dom.scanBoardInput.value = '';
        dom.scanBoardInput.click();
      }
      break;
    case 'apply-fen':
      applyStrictFenInput();
      break;
    case 'reset-fen':
      resetFenDraft();
      break;
    case 'toggle-advanced':
      state.setup.advancedOpen = !state.setup.advancedOpen;
      renderSetupPanel();
      schedulePersist();
      break;
    case 'set-practice-kind':
      state.practicePreferenceKind = normalizePracticeKind(actionEl.dataset.value);
      renderAnalysisPanel();
      schedulePersist();
      break;
    case 'toggle-analysis':
      void toggleAnalysis();
      break;
    case 'start-practice':
      startPracticeSession();
      break;
    case 'restart-practice':
      restartPracticeSession();
      break;
    case 'stop-practice':
      stopPracticeSession();
      break;
    case 'practice-hint':
      requestPracticeHint();
      break;
    case 'practice-reveal':
      revealPracticeMove();
      break;
    case 'toggle-annotate':
      setAnnotateMode(!state.annotations.enabled);
      break;
    case 'toggle-note':
      state.note.expanded = !state.note.expanded;
      closeLessonActionsMenu({ restoreFocus: true });
      renderNotationPanel();
      syncLessonVisibilityMenuState();
      schedulePersist();
      if (state.note.expanded) {
        window.setTimeout(() => {
          document.getElementById('notationNoteInput')?.focus();
        }, 0);
      }
      break;
    case 'toggle-pgn-comments':
      state.pgnCommentsVisible = !state.pgnCommentsVisible;
      closeLessonActionsMenu({ restoreFocus: true });
      renderNotationPanel();
      syncLessonVisibilityMenuState();
      schedulePersist();
      break;
    case 'toggle-pgn-comment-collapse':
      state.pgnCommentsExpanded = !state.pgnCommentsExpanded;
      renderNotationPanel();
      break;
    case 'toggle-tools':
      state.toolsExpanded = !state.toolsExpanded;
      closeLessonActionsMenu({ restoreFocus: true });
      renderWorkspaceTools();
      syncLessonVisibilityMenuState();
      schedulePersist();
      break;
    case 'toggle-pv-lines':
      state.pvLinesVisible = !state.pvLinesVisible;
      closeLessonActionsMenu({ restoreFocus: true });
      renderNotationPanel();
      renderAnalysisPanel();
      syncLessonVisibilityMenuState();
      schedulePersist();
      break;
    case 'toggle-fullscreen':
      void toggleFullscreenMode();
      break;
    case 'enter-focus-mode':
      setFocusMode(true);
      break;
    case 'exit-focus-mode':
      setFocusMode(false);
      break;
    case 'reset-analysis':
      resetAnalysisToSetup({ keepTab: true });
      renderAll();
      break;
    case 'navigate-start':
      if (state.play.active) {
        state.analysis.boardMessage = "Navigation is locked during an active play session. Resign first.";
        renderAll();
        break;
      }
      navigateToAnalysisStart();
      break;
    case 'navigate-back':
      if (state.play.active) {
        state.analysis.boardMessage = "Navigation is locked during an active play session. Resign first.";
        renderAll();
        break;
      }
      navigateToAnalysisParent();
      break;
    case 'navigate-forward':
      if (state.play.active) {
        state.analysis.boardMessage = "Navigation is locked during an active play session. Resign first.";
        renderAll();
        break;
      }
      navigateToAnalysisForward();
      break;
    case 'navigate-end':
      if (state.play.active) {
        state.analysis.boardMessage = "Navigation is locked during an active play session. Resign first.";
        renderAll();
        break;
      }
      navigateToAnalysisEnd();
      break;
    case 'jump-node':
      if (state.play.active) {
        state.analysis.boardMessage = "Navigation is locked during an active play session. Resign first.";
        renderAll();
        break;
      }
      jumpToAnalysisNode(actionEl.dataset.nodeId || '');
      break;
    case 'open-lesson':
      closeLessonActionsMenu();
      if (dom.lessonFileInput) {
        dom.lessonFileInput.value = '';
        dom.lessonFileInput.click();
      }
      break;
    case 'save-lesson':
      closeLessonActionsMenu();
      saveLessonFile();
      break;
    case 'open-guided-review':
      closeLessonActionsMenu();
      guidedReviewController?.openGuidedReviewMode();
      break;
    case 'import-pgn':
      closeLessonActionsMenu();
      if (dom.pgnFileInput) {
        dom.pgnFileInput.value = '';
        dom.pgnFileInput.click();
      }
      break;
    case 'export-pgn':
      closeLessonActionsMenu();
      savePgnFile();
      break;
    case 'copy-fen':
      void copyCurrentFenToClipboard();
      break;
    case 'toggle-color-theme':
      const newTheme = state.colorTheme === 'dark' ? 'light' : 'dark';
      applyColorTheme(newTheme, { persist: true });
      closeLessonActionsMenu({ restoreFocus: true });
      break;
    case 'toggle-last-move-arrow':
      state.lastMoveArrowVisible = !state.lastMoveArrowVisible;
      syncColorThemeMenuState();
      renderBoard();
      schedulePersist();
      closeLessonActionsMenu({ restoreFocus: true });
      break;
    case 'choose-promotion':
      choosePromotion(actionEl.dataset.promotion || '');
      break;
    case 'dismiss-promotion':
      dismissPromotionDialog();
      break;
    case 'dismiss-game-result':
      dismissGameResultModal();
      break;
    case 'dismiss-pgn-game-picker':
      closePgnGamePicker();
      break;
    case 'clear-pgn-games':
      clearPendingPgnGames();
      break;
    case 'browse-pgn-games':
      closeLessonActionsMenu();
      if (state.pendingPgnGames && state.pendingPgnGames.length > 0) {
        showPgnGamePicker(state.pendingPgnGames, state.pendingPgnFileName);
      }
      break;
    case 'load-pgn-game': {
      const index = parseInt(actionEl.dataset.gameIndex, 10);
      if (!isNaN(index) && state.pendingPgnGames && state.pendingPgnGames[index]) {
        void loadSelectedPgnGame(state.pendingPgnGames[index], state.pendingPgnFileName, index + 1);
      }
      break;
    }
    case 'generate-batch':
    case 'generate-puzzle-batch':
      void generatePuzzleBatch(5);
      break;
    case 'cancel-batch-generation':
      cancelPuzzleGeneration();
      break;
    case 'new-puzzle':
      void requestNewPuzzle();
      break;
    case 'replay-previous-puzzle':
      void requestPreviousPuzzle();
      break;
    case 'restore-default-puzzles':
      restoreDefaultPuzzles();
      break;
    case 'clear-puzzle-history': {
      if (window.confirm('Clear saved previous puzzles on this browser?')) {
        state.puzzle.puzzleHistory = [];
        state.puzzle.historyCursor = 0;
        persistPuzzleHistory();
        renderPuzzlePanel();
      }
      break;
    }
    case 'retry-puzzle':
      void retryCurrentPuzzle();
      break;
    case 'give-up-puzzle':
      giveUpPuzzle();
      break;
    case 'skip-puzzle':
      void skipPuzzle();
      break;
    case 'puzzle-next':
      dismissPuzzleResultModal();
      void requestNewPuzzle();
      break;
    case 'dismiss-puzzle-result':
      dismissPuzzleResultModal();
      break;
    case 'save-puzzle-csv':
      savePuzzleQueueCsv();
      break;
    case 'load-puzzle-csv':
      if (dom.puzzleCsvFileInput) {
        dom.puzzleCsvFileInput.value = '';
        dom.puzzleCsvFileInput.click();
      }
      break;
    case 'open-premium-modal':
      openPremiumModal();
      break;
    case 'dismiss-premium-modal':
      dismissPremiumModal();
      break;
    case 'activate-premium':
      activatePremiumFromInput();
      break;
    default:
      break;
  }
}

function handleDocumentInput(event) {
  const inputAction = event.target?.dataset?.action;
  if (inputAction === 'set-play-skill') {
    updatePlaySkill(event.target.value, { skipRender: true });
    return;
  }
  if (inputAction === 'set-puzzle-skill') {
    updatePuzzleSkill(event.target.value, { skipRender: true });
    return;
  }
  if (dom.guidedReviewPanel?.contains(event.target) && guidedReviewController?.handleInput(event)) {
    return;
  }
  if (event.target === dom.titleInput) {
    state.title = normalizeTextControlValue(dom.titleInput);
    dom.boardTitleDisplay.textContent = state.title.trim() || 'Untitled position';
    renderLessonBookControls();
    schedulePersist();
    return;
  }
  if (event.target?.id === 'analysisTargetDepthInput') {
    if (event.target.value !== '') {
      state.analysisTargetDepth = normalizeAnalysisTargetDepth(event.target.value);
      schedulePersist();
    }
    return;
  }
  if (event.target?.id === 'notationNoteInput') {
    state.note.text = normalizeTextControlValue(event.target);
    schedulePersist();
    return;
  }
  if (event.target?.id === 'notationCommentInput') {
    const currentNode = getCurrentAnalysisNode() || getAnalysisNode(state.analysis.rootId);
    if (currentNode) {
      currentNode.comment = normalizeAnalysisComment(normalizeTextControlValue(event.target));
      schedulePersist();
    }
    return;
  }
  if (event.target.id === 'fenInput') {
    state.setup.fenInput = event.target.value;
    state.setup.scanStatus = '';
    state.setup.scanStatusType = '';
  }
}

function handleDocumentChange(event) {
  if (event.target === dom.guidedReviewFileInput) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    Promise.resolve(guidedReviewController?.importLessonRows(file)).finally(() => {
      if (dom.guidedReviewFileInput) {
        dom.guidedReviewFileInput.value = '';
      }
    });
    return;
  }
  if (event.target === dom.puzzleCsvFileInput) {
    const file = event.target.files?.[0];
    if (file) {
      void loadPuzzleQueueCsv(file);
    }
    return;
  }
  if (event.target === dom.scanBoardInput) {
    const file = event.target.files?.[0];
    if (file) {
      void scanBoardImage(file);
    }
    return;
  }
  if (event.target === dom.lessonFileInput) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    openLessonFile(file).catch((error) => {
      console.error('Unable to open lesson file.', error);
      syncLessonFileStatus(error?.message || 'Unable to open lesson file.');
    }).finally(() => {
      if (dom.lessonFileInput) {
        dom.lessonFileInput.value = '';
      }
    });
    return;
  }
  if (event.target === dom.pgnFileInput) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    openPgnFile(file).catch((error) => {
      console.error('Unable to import PGN file.', error);
      syncLessonFileStatus(error?.message || 'Unable to import PGN file.');
    }).finally(() => {
      if (dom.pgnFileInput) {
        dom.pgnFileInput.value = '';
      }
    });
    return;
  }

  if (event.target?.id === 'analysisTargetDepthInput') {
    state.analysisTargetDepth = normalizeAnalysisTargetDepth(event.target.value);
    event.target.value = String(state.analysisTargetDepth);
    if (!state.engine.analyzing && !state.engine.stopping && !hasAnalysisContinuationAvailable()) {
      state.engine.summary = defaultAnalysisSummary();
    }
    renderAnalysisPanel();
    renderHeaderMeta();
    schedulePersist();
    return;
  }

  const action = event.target?.dataset?.action;
  if (!action) {
    return;
  }
  switch (action) {
    case 'toggle-castling':
      updateCastlingRight(event.target.dataset.flag || '', Boolean(event.target.checked));
      break;
    case 'set-en-passant':
      updateEnPassantSquare(event.target.value || '-');
      break;
    case 'set-play-time':
      updatePlayTime(event.target.value);
      break;
    case 'set-play-side':
      updatePlaySide(event.target.value);
      break;
    case 'set-play-speed':
      updatePlaySpeed(event.target.value);
      break;
    case 'set-play-start-position':
      updatePlayStartPosition(event.target.value);
      break;
    case 'set-puzzle-objective':
      updatePuzzleObjective(event.target.value);
      break;
    case 'set-puzzle-difficulty':
      updatePuzzleDifficulty(event.target.value);
      break;
    case 'set-puzzle-speed':
      updatePuzzleSpeed(event.target.value);
      break;
    default:
      break;
  }
}

function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function handleDocumentKeydown(event) {
  if (event.key === 'Enter' && dom.premiumKeyInput && event.target === dom.premiumKeyInput) {
    event.preventDefault();
    activatePremiumFromInput();
    return;
  }
  if (event.key === 'Escape' && dom.premiumModal && !dom.premiumModal.hidden) {
    event.preventDefault();
    dismissPremiumModal();
    return;
  }
  if (event.key === 'Escape' && dom.pgnGamePickerModal && !dom.pgnGamePickerModal.hidden) {
    event.preventDefault();
    closePgnGamePicker();
    return;
  }
  if (event.key === 'Escape' && dom.puzzleResultModal && !dom.puzzleResultModal.hidden) {
    event.preventDefault();
    dismissPuzzleResultModal();
    return;
  }
  if (event.key === 'Escape') {
    const openSelect = document.querySelector('.custom-select-wrapper.is-open');
    if (openSelect) {
      event.preventDefault();
      closeCustomSelects();
      const trigger = openSelect.querySelector('.custom-select-trigger');
      trigger?.focus();
      return;
    }
  }
  if (event.key === 'Escape' && state.focusMode) {
    event.preventDefault();
    setFocusMode(false);
    return;
  }
  if (event.key === 'Escape' && (isLessonBookActionsMenuOpen() || isLessonActionsMenuOpen() || isLessonPickerMenuOpen())) {
    event.preventDefault();
    closeHeaderMenus({ restoreFocus: true });
    return;
  }
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  if (state.practice.active || state.play.active) {
    return;
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }
  if (isTypingTarget(event.target) || !dom.promotionModal.hidden || !state.analysis.game || !countAnalysisMoveNodes()) {
    return;
  }

  const currentNode = getCurrentAnalysisNode();
  if (!currentNode) {
    return;
  }

  const targetNodeId = event.key === 'ArrowLeft'
    ? (currentNode.parentId || '')
    : getAnalysisNextNodeId(currentNode.id);
  if (!targetNodeId) {
    return;
  }

  event.preventDefault();
  jumpToAnalysisNode(targetNodeId);
}

// Functions related to playing against Stockfish
function updatePlaySkill(value, { skipRender = false } = {}) {
  const elo = parseInt(value, 10);
  state.play.skill = clamp(elo, 800, 3190);
  if (state.play.active && state.engine.worker && state.engine.ready) {
    applyEngineSkillLevel(state.play.skill);
  }
  if (skipRender) {
    const labelEl = document.querySelector('label[for="engineSkillSlider"]');
    if (labelEl) {
      labelEl.textContent = `Engine Strength (${state.play.skill < 1320 ? '~Elo' : 'Elo'})`;
    }
    const sliderEl = document.getElementById('engineSkillSlider');
    if (sliderEl) {
      const valueEl = sliderEl.parentElement?.querySelector('.field-value');
      if (valueEl) {
        valueEl.textContent = `${state.play.skill}${state.play.skill < 1320 ? '*' : ''}`;
      }
    }
  } else {
    renderPlayPanel();
  }
}

function applyEngineSkillLevel(elo) {
  if (!state.engine.worker || !state.engine.ready) {
    return;
  }
  const worker = state.engine.worker;
  if (elo >= 1320) {
    // Use UCI_LimitStrength + UCI_Elo for accurate ELO targeting (1320–3190).
    const clampedElo = clamp(elo, 1320, 3190);
    worker.postMessage('setoption name UCI_LimitStrength value true');
    worker.postMessage(`setoption name UCI_Elo value ${clampedElo}`);
    console.log(`[Stockfish] Set UCI_Elo to ${clampedElo} (requested: ${elo})`);
  } else {
    // Below 1320: UCI_Elo is unsupported. Use Skill Level (0–10) mapped from 800–1319.
    // Skill Level 0 ≈ 800 Elo, Skill Level 10 ≈ 1319 Elo.
    const skillLevel = Math.round(clamp((elo - 800) / (1319 - 800), 0, 1) * 10);
    worker.postMessage('setoption name UCI_LimitStrength value false');
    worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
    console.log(`[Stockfish] Set Skill Level to ${skillLevel} for ~${elo} Elo (below UCI_Elo range)`);
  }
}

function updatePlayTime(value) {
  state.play.timeControl = value;
  renderPlayPanel();
}

function updatePlaySide(value) {
  state.play.side = value;
  if (value === 'white' || value === 'black') {
    state.boardOrientation = value;
  }
  renderAll();
}

function updatePlaySpeed(value) {
  state.play.thinkingSpeed = value;
  renderPlayPanel();
}

function updatePlayStartPosition(value) {
  if (value === 'current' || value === 'setup' || value === 'initial') {
    state.play.startPosition = value;
  }
  renderPlayPanel();
  renderBoardForPlayPreview();
}

function renderBoardForPlayPreview() {
  // Only preview the start position on the board when no game is active
  if (state.play.active) {
    return;
  }
  const previewFen = resolvePlayStartFen();
  if (!previewFen || previewFen === state.analysis.currentFen) {
    return;
  }
  try {
    new Chess(previewFen); // validate FEN
    state.analysis.currentFen = previewFen;
    state.analysis.selectedSquare = null;
    state.analysis.legalMoves = [];
    state.analysis.lastMoveSquares = [];
    renderBoard();
    renderHeaderMeta();
  } catch {
    // If FEN is invalid, skip preview update
  }
}

function resolvePlayStartFen() {
  const pos = state.play.startPosition;
  if (pos === 'setup') {
    return state.setupFen;
  }
  if (pos === 'initial') {
    return DEFAULT_POSITION;
  }
  // 'current' (default): use the current analysis board position
  return state.analysis.currentFen || state.setupFen;
}

async function startPlayGame(options = {}) {
  // Increment play session and cancel any stale engine request from a previous game
  state.play.playSessionId += 1;
  cancelPlayEngineRequest('starting new play game');
  state.play.playEngineRetryCount = 0;
  debugPlayEngine('startPlayGame', { playSessionId: state.play.playSessionId });

  // Clear any old play clock interval and reset play clock/timer states
  stopPlayClock();
  state.play.clockRunning = false;
  state.play.engineThinking = false;
  state.play.lastClockTick = 0;
  state.play.whiteTime = 0;
  state.play.blackTime = 0;
  state.play.whiteInc = 0;
  state.play.blackInc = 0;

  // Clear any old game-over modal/result
  dismissGameResultModal();

  // Reset practice state so it doesn't interfere
  state.practice = createEmptyPracticeState();

  // Clear analysis selection and pending promotion to avoid stale visual selections or promotion flows
  clearAnalysisSelection();
  state.analysis.pendingPromotion = null;
  state.analysis.headers = null;

  const { ownerTab = TAB_PLAY } = options;
  const startFen = resolvePlayStartFen();

  // Guard: do not start if the chosen FEN is already a finished position.
  const probe = new Chess(startFen);
  if (probe.isGameOver()) {
    state.analysis.boardMessage = 'The selected starting position is already game over. Choose a different starting position.';
    renderAll();
    return;
  }

  stopAnalysisSearch({ clearSummary: true });
  state.play.active = true;

  state.play.autoHiddenPgnComments = false;
  state.play.autoHiddenPvLines = false;
  if (state.pgnCommentsVisible) {
    state.pgnCommentsVisible = false;
    state.play.autoHiddenPgnComments = true;
  }
  if (state.pvLinesVisible) {
    state.pvLinesVisible = false;
    state.play.autoHiddenPvLines = true;
  }
  syncLessonVisibilityMenuState();
  schedulePersist();

  if (state.play.side === 'random') {
    state.play.assignedSide = Math.random() < 0.5 ? 'white' : 'black';
  } else {
    state.play.assignedSide = state.play.side;
  }

  state.boardOrientation = state.play.assignedSide;

  const game = new Chess(startFen);
  state.analysis.game = game;
  state.analysis.currentFen = startFen;
  state.analysis.currentNodeId = ROOT_NODE_ID;
  state.analysis.nodes = {
    [ROOT_NODE_ID]: {
      id: ROOT_NODE_ID,
      parentId: null,
      fen: startFen,
      children: [],
      selectedChildId: null,
      comment: '',
    }
  };
  state.analysis.boardMessage = `Game started! You are playing as ${state.play.assignedSide === 'white' ? 'White' : 'Black'}.`;
  state.analysis.lastMoveSquares = [];

  if (state.play.timeControl !== 'none') {
    const [minsStr, incStr] = state.play.timeControl.split('+');
    const mins = parseInt(minsStr, 10);
    const inc = parseInt(incStr, 10);
    const ms = mins * 60 * 1000;
    const incMs = inc * 1000;

    state.play.whiteTime = ms;
    state.play.blackTime = ms;
    state.play.whiteInc = incMs;
    state.play.blackInc = incMs;
    state.play.clockRunning = false;
  } else {
    state.play.clockRunning = false;
  }

  state.activeTab = ownerTab;
  renderAll();

  state.engine.summary = 'Loading Stockfish engine...';
  renderActiveToolPanel();

  let worker;
  try {
    worker = await ensureStockfishReady({
      summary: 'Loading Stockfish for game play...',
    });
  } catch (error) {
    // Stopping the game while the engine is still loading rejects the ready
    // promise on purpose; that is not a load failure worth reporting.
    if (error?.isIntentionalStop) {
      return;
    }
    console.error('Failed to load Stockfish', error);
    if (state.play.active) {
      stopPlayGame({ reason: 'Stockfish worker failed to load' });
    }
    return;
  }

  if (!state.play.active) {
    return;
  }

  applyEngineSkillLevel(state.play.skill);
  worker.postMessage('ucinewgame');

  if (state.play.timeControl !== 'none') {
    state.play.clockRunning = true;
    startPlayClock();
  }

  const turn = game.turn();
  const humanSideLetter = state.play.assignedSide === 'white' ? 'w' : 'b';
  if (turn !== humanSideLetter) {
    void triggerEngineMove();
  }
}

function showGameResultModal(reason) {
  const modal = dom.gameResultModal;
  const messageEl = dom.gameResultMessage;
  if (modal && messageEl) {
    messageEl.textContent = reason;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
}

function dismissGameResultModal() {
  const modal = dom.gameResultModal;
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

function stopPlayGame(options = {}) {
  const { reason = 'Resigned' } = options;
  if (!state.play.active) {
    return;
  }

  debugPlayEngine('stopPlayGame', { reason, playSessionId: state.play.playSessionId });
  state.play.playSessionId += 1;
  cancelPlayEngineRequest('stopping play game');
  state.play.active = false;
  state.play.engineThinking = false;
  stopPlayClock();

  let visibilityRestored = false;
  if (state.play.autoHiddenPgnComments && !state.pgnCommentsVisible) {
    state.pgnCommentsVisible = true;
    visibilityRestored = true;
  }
  if (state.play.autoHiddenPvLines && !state.pvLinesVisible) {
    state.pvLinesVisible = true;
    visibilityRestored = true;
  }
  state.play.autoHiddenPgnComments = false;
  state.play.autoHiddenPvLines = false;

  if (visibilityRestored) {
    syncLessonVisibilityMenuState();
    schedulePersist();
  }

  if (state.engine.loading) {
    if (state.engine.rejectReady) {
      const stopError = new Error('Game play stopped.');
      stopError.isIntentionalStop = true;
      state.engine.rejectReady(stopError);
    }
    clearEngineReadyHandshake();
  }

  if (state.engine.worker) {
    try {
      state.engine.worker.postMessage('stop');
    } catch (error) {
      // Ignore worker messaging errors during shutdown.
    }
    terminateEngineWorker();
    state.engine.ready = false;
  }

  state.engine.analyzing = false;
  state.engine.stopping = false;
  state.engine.searchFen = '';
  state.engine.pendingFen = '';
  state.engine.pendingSearchMode = '';
  state.engine.resumeFen = '';
  state.engine.resumeEligible = false;
  state.engine.resumeDepth = null;

  state.analysis.boardMessage = `Game ended. ${reason}`;

  if (state.puzzle.sessionActive) {
    finishPuzzleSession(reason);
    return;
  }

  renderAll();

  // Show premium popup modal for game result
  showGameResultModal(reason);
}

function offerDraw() {
  if (!state.play.active || !state.analysis.game) {
    return;
  }
  const game = state.analysis.game;

  if (state.puzzle.sessionActive) {
    const legallyDrawn =
      game.isDraw?.() ||
      game.isInsufficientMaterial?.() ||
      isFenInsufficientMaterialDraw(game.fen());

    if (legallyDrawn) {
      stopPlayGame({ reason: 'Draw secured.' });
    } else {
      state.analysis.boardMessage = "Draw not secured yet.";
      renderAll();
    }
    return;
  }

  const score = state.engine.scoreValue;
  const scoreType = state.engine.scoreType;
  
  const stockfishSide = state.play.assignedSide === 'white' ? 'b' : 'w';
  const scoreMultiplier = stockfishSide === 'b' ? -1 : 1;
  const stockfishScore = score !== null ? (score * scoreMultiplier) : 0;

  const moveCount = Math.floor(game.history().length / 2);
  
  if (moveCount < 8) {
    state.analysis.boardMessage = "Stockfish declined the draw offer. It is too early in the game.";
    renderAll();
    return;
  }

  let accept = false;
  let declineReason = "It believes it has an advantage.";
  
  if (scoreType === 'mate') {
    if (stockfishScore < 0) {
      accept = true;
    } else {
      declineReason = "It sees a checkmate path!";
    }
  } else {
    if (stockfishScore <= 30) {
      accept = true;
    } else if (stockfishScore > 150) {
      declineReason = "It has a winning advantage.";
    } else {
      declineReason = "It wants to keep playing for a win.";
    }
  }

  if (accept) {
    stopPlayGame({ reason: 'Draw by agreement.' });
  } else {
    state.analysis.boardMessage = `Stockfish declined the draw offer. ${declineReason}`;
    renderAll();
  }
}

// ── Play Engine Lifecycle Helpers ──────────────────────────────────────────────

function debugPlayEngine(label, detail = {}) {
  console.log(`[PlayEngine] ${label}`, {
    active: state.play.active,
    engineThinking: state.play.engineThinking,
    playSessionId: state.play.playSessionId,
    activeEngineSessionId: state.play.activeEngineSessionId,
    turn: state.analysis.game?.turn?.() ?? '?',
    ...detail,
  });
}

function clearPlayEngineWatchdog() {
  if (state.play.playEngineWatchdog) {
    window.clearTimeout(state.play.playEngineWatchdog);
    state.play.playEngineWatchdog = null;
  }
}

function cancelPlayEngineRequest(reason) {
  clearPlayEngineWatchdog();
  if (state.play.engineThinking || state.play.activeEngineSessionId !== null) {
    debugPlayEngine('cancelPlayEngineRequest', { reason });
  }
  state.play.engineThinking = false;
  state.play.activeEngineSessionId = null;
}

function startPlayEngineWatchdog(sessionId) {
  clearPlayEngineWatchdog();
  state.play.playEngineWatchdog = window.setTimeout(() => {
    // Only act if this watchdog is still relevant
    if (!state.play.active || !state.play.engineThinking || state.play.playSessionId !== sessionId) {
      debugPlayEngine('watchdog fired but conditions no longer match, ignoring', { sessionId });
      return;
    }
    debugPlayEngine('watchdog: engine stall detected', { sessionId, retryCount: state.play.playEngineRetryCount });

    // Reset stale engine thinking state
    state.play.engineThinking = false;
    state.play.activeEngineSessionId = null;

    if (state.play.playEngineRetryCount === 0) {
      // First retry: try to reinitialize and retry once
      state.play.playEngineRetryCount += 1;
      debugPlayEngine('watchdog: attempting one retry');

      // Send stop to the worker in case it's stuck, then retry
      if (state.engine.worker) {
        try {
          state.engine.worker.postMessage('stop');
        } catch (_e) { /* ignore */ }
      }

      // Retry if it's still Stockfish's turn
      if (shouldEngineMoveInPlay()) {
        void triggerEngineMove();
      }
    } else {
      // Already retried once — give up to prevent infinite loops
      debugPlayEngine('watchdog: hard engine stall, giving up retry');
      state.analysis.boardMessage = 'Stockfish engine stalled. Try making another move or restart the game.';
      renderAll();
    }
  }, 8000);
}

function shouldEngineMoveInPlay() {
  if (!state.play.active) {
    return false;
  }
  if (!state.analysis.game) {
    return false;
  }
  const humanSideLetter = state.play.assignedSide === 'white' ? 'w' : 'b';
  const currentTurn = state.analysis.game.turn();
  if (currentTurn === humanSideLetter) {
    // It's the human's turn, not the engine's
    return false;
  }
  if (state.analysis.game.isGameOver() || isFenInsufficientMaterialDraw(state.analysis.game.fen())) {
    return false;
  }
  return true;
}

async function triggerEngineMove() {
  if (!shouldEngineMoveInPlay()) {
    return;
  }

  if (state.play.engineThinking) {
    debugPlayEngine('triggerEngineMove: already thinking, skipping duplicate request');
    return;
  }

  const worker = state.engine.worker;
  if (!worker) {
    debugPlayEngine('triggerEngineMove: no worker available');
    return;
  }

  const sessionId = state.play.playSessionId;
  state.play.engineThinking = true;
  state.play.activeEngineSessionId = sessionId;
  state.analysis.boardMessage = "Stockfish is thinking...";
  debugPlayEngine('triggerEngineMove: sending engine request', { sessionId, fen: state.analysis.currentFen });
  renderActiveToolPanel();

  const cmd = (msg) => worker.postMessage(msg);
  cmd(`position fen ${state.analysis.currentFen}`);

  const isEngineWhite = state.play.assignedSide === 'black';
  const engineTime = isEngineWhite ? state.play.whiteTime : state.play.blackTime;
  const engineInc = isEngineWhite ? state.play.whiteInc : state.play.blackInc;

  let thinkTime;
  if (state.play.timeControl !== 'none') {
    // Clock mode: base think time is (remaining / 40) + increment
    const calculatedTime = (engineTime / 40) + engineInc;
    
    // Clamp by thinking speed limits
    let maxThinkTime = 2000; // default for normal
    if (state.play.thinkingSpeed === 'instant') {
      maxThinkTime = 500;
    } else if (state.play.thinkingSpeed === 'fast') {
      maxThinkTime = 1000;
    } else if (state.play.thinkingSpeed === 'slow') {
      maxThinkTime = 4000;
    }
    
    thinkTime = Math.min(calculatedTime, maxThinkTime);
    // Safety buffer: ensure we do not flag or overrun remaining time (leave 100ms safety buffer)
    thinkTime = clamp(thinkTime, 100, Math.max(100, engineTime - 100));
  } else {
    // No clock mode: pure thinking speed delay
    if (state.play.thinkingSpeed === 'instant') {
      thinkTime = clamp(100 + (state.play.skill - 700) * 0.15, 100, 500);
    } else if (state.play.thinkingSpeed === 'fast') {
      thinkTime = clamp(250 + (state.play.skill - 700) * 0.3, 250, 1000);
    } else if (state.play.thinkingSpeed === 'slow') {
      thinkTime = clamp(1000 + (state.play.skill - 700) * 1.0, 1000, 4000);
    } else {
      // normal
      thinkTime = clamp(500 + (state.play.skill - 700) * 0.5, 500, 2000);
    }
  }

  cmd(`go movetime ${Math.trunc(thinkTime)}`);
  startPlayEngineWatchdog(sessionId);
}

function chooseBeginnerMove(bestMoveUci) {
  if (!state.play.active || !state.analysis.game) {
    return bestMoveUci;
  }

  const rating = state.play.skill;
  if (rating > 1100) {
    return bestMoveUci;
  }

  // 1. Get the legal move list
  const legalMoves = state.analysis.game.moves({ verbose: true });
  const moveCount = legalMoves.length;
  if (moveCount === 0) {
    return bestMoveUci;
  }

  // 2. Compute mistake probability based on rating (800 -> 45%, 900 -> 30%, 1000 -> 18%, 1100 -> 8%)
  const elo = clamp(rating, 800, 1100);
  let pMistake = 0.45;
  if (elo <= 900) {
    pMistake = 0.45 - ((elo - 800) / 100) * (0.45 - 0.30);
  } else if (elo <= 1000) {
    pMistake = 0.30 - ((elo - 900) / 100) * (0.30 - 0.18);
  } else {
    pMistake = 0.18 - ((elo - 1000) / 100) * (0.18 - 0.08);
  }

  // Safety adjustments
  // - If side to move is in check: Reduce mistake probability by 75%
  if (state.analysis.game.inCheck()) {
    pMistake *= 0.25;
  }

  // - If legal move count <= 3: Reduce mistake probability significantly
  if (moveCount <= 1) {
    pMistake = 0;
  } else if (moveCount === 2) {
    pMistake *= 0.1;
  } else if (moveCount === 3) {
    pMistake *= 0.3;
  }

  // Probability check
  if (Math.random() >= pMistake) {
    return bestMoveUci;
  }

  // 3. Remove Stockfish move from candidate alternatives
  const normBest = bestMoveUci.toLowerCase();
  const alternatives = legalMoves.filter(move => {
    const moveUci = (move.from + move.to + (move.promotion || '')).toLowerCase();
    return moveUci !== normBest;
  });

  if (alternatives.length === 0) {
    return bestMoveUci;
  }

  // 4. Classify alternative moves into Safe (A), Imperfect (B), Weak (C)
  const categoryA = [];
  const categoryB = [];
  const categoryC = [];

  const opponentColor = state.analysis.game.turn() === 'w' ? 'b' : 'w';
  const ourColor = state.analysis.game.turn();
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

  for (const move of alternatives) {
    let givesCheck = false;
    let deliversMate = false;
    let allowsMateIn1 = false;
    let hangsMaterial = false;

    // We clone the game to inspect the position after the move is made
    const tempGame = new Chess(state.analysis.game.fen());
    try {
      tempGame.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      });

      givesCheck = tempGame.inCheck();
      deliversMate = tempGame.isCheckmate();

      // Check if opponent attacks the target square and if we defend it
      const isAttacked = tempGame.isAttacked(move.to, opponentColor);
      const isDefended = tempGame.isAttacked(move.to, ourColor);
      const val = pieceValues[move.piece] || 0;

      if (isAttacked) {
        if (!isDefended) {
          // If undefended and not a pawn, or any piece that is hanging
          if (val >= 3) {
            hangsMaterial = true;
          }
        } else {
          // Defended, but moving a valuable piece (Rook, Queen) to a square attacked by opponent
          if (val >= 5) {
            hangsMaterial = true;
          }
        }
      }

      // Check if this move allows opponent checkmate in 1
      const opponentMoves = tempGame.moves({ verbose: true });
      for (const opMove of opponentMoves) {
        const replyGame = new Chess(tempGame.fen());
        try {
          replyGame.move({
            from: opMove.from,
            to: opMove.to,
            promotion: opMove.promotion,
          });
          if (replyGame.isCheckmate()) {
            allowsMateIn1 = true;
            break;
          }
        } catch (err) {}
      }
    } catch (err) {}

    const isCapture = Boolean(move.captured);

    // Classify into categories:
    // C. Weak alternatives: hangs material or allows checkmate in 1
    if (hangsMaterial || allowsMateIn1) {
      categoryC.push({ ...move, allowsMateIn1, hangsMaterial });
    }
    // B. Imperfect alternatives: captures or checks, but safe
    else if (isCapture || givesCheck || deliversMate) {
      categoryB.push({ ...move, allowsMateIn1, hangsMaterial });
    }
    // A. Safe alternatives: quiet developing moves
    else {
      categoryA.push({ ...move, allowsMateIn1, hangsMaterial });
    }
  }

  // 5. Select category based on rating weighting
  // Weightings at key ratings:
  // 1100: 80% A, 20% B, 0% C
  // 1000: 60% A, 40% B, 0% C
  // 900:  0% A,  40% B, 60% C
  // 800:  0% A,  5% B,  95% C
  let wA = 0;
  let wB = 0;
  let wC = 0;

  if (elo <= 900) {
    const t = (elo - 800) / 100;
    wA = 0;
    wB = 0.05 + t * (0.40 - 0.05);
    wC = 0.95 - t * (0.95 - 0.60);
  } else if (elo <= 1000) {
    const t = (elo - 900) / 100;
    wA = t * 0.60;
    wB = 0.40;
    wC = 0.60 - t * 0.60;
  } else {
    const t = (elo - 1000) / 100;
    wA = 0.60 + t * (0.80 - 0.60);
    wB = 0.40 - t * (0.40 - 0.20);
    wC = 0;
  }

  const roll = Math.random();
  let targetCategory = 'C';
  if (roll < wA) {
    targetCategory = 'A';
  } else if (roll < wA + wB) {
    targetCategory = 'B';
  } else {
    targetCategory = 'C';
  }

  // Selection with fallback
  let choices = [];
  if (targetCategory === 'A') {
    choices = categoryA;
    if (choices.length === 0) choices = categoryB;
    if (choices.length === 0) choices = categoryC;
  } else if (targetCategory === 'B') {
    choices = categoryB;
    if (choices.length === 0) choices = categoryA;
    if (choices.length === 0) choices = categoryC;
  } else {
    choices = categoryC;
    // Prefer moves that don't allow checkmate in 1 if possible, even for weak moves
    if (choices.length > 0) {
      const nonMateC = choices.filter(m => !m.allowsMateIn1);
      if (nonMateC.length > 0) {
        choices = nonMateC;
      }
    }
    if (choices.length === 0) choices = categoryB;
    if (choices.length === 0) choices = categoryA;
  }

  if (choices.length > 0) {
    const pick = choices[Math.floor(Math.random() * choices.length)];
    const chosenUci = pick.from + pick.to + (pick.promotion || '');
    console.log(`[Beginner Weakness] Intercepted Stockfish bestmove ${bestMoveUci} -> Played beginner alternative: ${chosenUci} (Rating: ${rating}, Category: ${targetCategory})`);
    return chosenUci;
  }

  return bestMoveUci;
}

function applyPlayEngineMove(bestMoveUci) {
  if (!state.play.active || !state.analysis.game) {
    return;
  }
  updateClockElapsed();
  bestMoveUci = chooseBeginnerMove(bestMoveUci);
  const parsedMove = tablebaseUciMoveObject(bestMoveUci);
  if (!parsedMove) {
    stopPlayGame({ reason: 'Stockfish returned an invalid move.' });
    return;
  }

  let applied;
  try {
    applied = state.analysis.game.move({
      from: parsedMove.from,
      to: parsedMove.to,
      promotion: parsedMove.promotion,
    });
  } catch (error) {
    console.error('Stockfish move failed to apply', error);
    stopPlayGame({ reason: 'Stockfish attempted an illegal move.' });
    return;
  }

  const currentNode = getCurrentAnalysisNode();
  if (currentNode) {
    const nodeId = allocateAnalysisNodeId();
    state.analysis.nodes[nodeId] = {
      id: nodeId,
      parentId: currentNode.id,
      from: applied.from,
      to: applied.to,
      promotion: applied.promotion || undefined,
      san: applied.san,
      fen: state.analysis.game.fen(),
      children: [],
      selectedChildId: null,
      comment: '',
    };
    currentNode.children.push(nodeId);
    currentNode.selectedChildId = nodeId;
    applyAnalysisPathSelection(nodeId);
    state.analysis.currentNodeId = nodeId;
  }

  state.analysis.currentFen = state.analysis.game.fen();
  state.analysis.lastMoveSquares = [applied.from, applied.to];
  state.analysis.boardMessage = state.puzzle.sessionActive
    ? `Stockfish played ${applied.san}. Continue toward the objective.`
    : `Stockfish played ${applied.san}. Your turn!`;

  if (state.play.timeControl !== 'none') {
    const turn = state.analysis.game.turn();
    if (turn === 'w') {
      state.play.blackTime += state.play.blackInc;
    } else {
      state.play.whiteTime += state.play.whiteInc;
    }
  }

  if (checkPlayGameOver()) {
    return;
  }

  if (checkPuzzleMaterialObjective()) {
    return;
  }

  renderAll();
}

function checkPlayGameOver() {
  const game = state.analysis.game;
  if (!game) {
    return false;
  }
  const isDrawFromFen = isFenInsufficientMaterialDraw(game.fen());
  if (game.isGameOver() || isDrawFromFen) {
    let reason = 'Game over.';
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'Black' : 'White';
      reason = `Checkmate! ${winner} wins.`;
    } else if (game.isDraw() || isDrawFromFen) {
      if (game.isStalemate()) {
        reason = 'Draw by stalemate.';
      } else if (game.isThreefoldRepetition()) {
        reason = 'Draw by threefold repetition.';
      } else if (game.isInsufficientMaterial() || isDrawFromFen) {
        reason = 'Draw by insufficient material.';
      } else {
        reason = 'Draw by 50-move rule.';
      }
    }
    stopPlayGame({ reason });
    return true;
  }
  return false;
}

function startPlayClock() {
  stopPlayClock();
  if (state.play.timeControl === 'none') {
    return;
  }
  state.play.lastClockTick = Date.now();
  state.play.timerId = window.setInterval(tickPlayClock, 100);
}

function stopPlayClock() {
  if (state.play.timerId) {
    window.clearInterval(state.play.timerId);
    state.play.timerId = null;
  }
}

function updateClockElapsed() {
  if (!state.play.active || !state.play.clockRunning || !state.analysis.game) {
    return;
  }
  const now = Date.now();
  const elapsed = now - state.play.lastClockTick;
  state.play.lastClockTick = now;

  const turn = state.analysis.game.turn();
  if (turn === 'w') {
    state.play.whiteTime = Math.max(0, state.play.whiteTime - elapsed);
  } else {
    state.play.blackTime = Math.max(0, state.play.blackTime - elapsed);
  }
}

function tickPlayClock() {
  if (!state.play.active || !state.analysis.game) {
    stopPlayClock();
    return;
  }

  // If Time Control is "none" or clock is not running, stop the clock and do not flag or run clock logic.
  if (state.play.timeControl === 'none' || !state.play.clockRunning) {
    stopPlayClock();
    return;
  }

  // Puzzle mode: do not tick or flag the clock.
  if (state.puzzle.sessionActive) {
    return;
  }

  updateClockElapsed();

  if (state.play.whiteTime === 0) {
    stopPlayGame({ reason: 'Black wins on time (White flagged).' });
    return;
  }
  if (state.play.blackTime === 0) {
    stopPlayGame({ reason: 'White wins on time (Black flagged).' });
    return;
  }

  if (dom.playPanel) {
    const clocks = dom.playPanel.querySelectorAll('.play-clock-time');
    if (clocks.length === 2) {
      const formatTime = (ms) => {
        if (ms <= 0) return '0:00';
        const totalSecs = Math.ceil(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };
      clocks[0].textContent = formatTime(state.play.whiteTime);
      clocks[1].textContent = formatTime(state.play.blackTime);
    } else {
      renderPlayPanel();
    }
  }
}

function renderPlayPanel() {
  if (!dom.playPanel) {
    return;
  }
  const { skill, timeControl, side, active, whiteTime, blackTime, thinkingSpeed, startPosition } = state.play;
  const gameActive = active;

  const formatTime = (ms) => {
    if (ms <= 0) return '0:00';
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statusText = `Playing as ${state.play.assignedSide === 'white' ? 'White' : 'Black'}. Engine Elo: ${skill}`;
  const activePlayActionsMarkup = gameActive ? `
    <div class="action-row play-action-row">
      <button type="button" class="action-button danger" data-action="stop-play">Resign</button>
      <button type="button" class="action-button tonal" data-action="offer-draw">Offer Draw</button>
    </div>
  ` : '';

  const playMarkup = `
    <article class="lesson-section">
      <div class="lesson-section-header">
        <div class="play-section-heading">
          <h3 class="lesson-section-title play-section-title">Play vs Stockfish</h3>
          ${!gameActive ? `
            <div class="action-row play-start-action-row">
              <button type="button" class="action-button primary" data-action="start-play">Start Game</button>
            </div>
          ` : ''}
          ${gameActive ? `<p class="section-copy">${escapeHtml(statusText)}</p>` : ''}
        </div>
      </div>

      ${gameActive && timeControl !== 'none' ? `
        <div class="play-clocks-container">
          <div class="play-clock ${state.analysis.game?.turn() === 'w' ? 'is-active' : ''}">
            <span class="play-clock-label">White</span>
            <span class="play-clock-time">${formatTime(whiteTime)}</span>
          </div>
          <div class="play-clock ${state.analysis.game?.turn() === 'b' ? 'is-active' : ''}">
            <span class="play-clock-label">Black</span>
            <span class="play-clock-time">${formatTime(blackTime)}</span>
          </div>
        </div>
        ${activePlayActionsMarkup}
        <div class="section-divider"></div>
      ` : ''}
      ${gameActive && timeControl === 'none' ? activePlayActionsMarkup : ''}

      <div class="stack-grid">
        <div class="field-row">
          <label class="field-label" for="engineSkillSlider">Engine Strength (${skill < 1320 ? '~Elo' : 'Elo'})</label>
          <div class="range-control-wrap">
            <input
              type="range"
              id="engineSkillSlider"
              min="800"
              max="3190"
              step="50"
              value="${skill}"
              data-action="set-play-skill"
              ${gameActive ? 'disabled' : ''}
            >
            <span class="field-value">${skill}${skill < 1320 ? '*' : ''}</span>
          </div>
        </div>

        <div class="two-col play-options-grid">
          <div class="field-row">
            <label class="field-label" for="playStartPositionSelect">Starting Position</label>
            ${customSelectMarkup(
              'playStartPositionSelect',
              startPosition || 'current',
              [
                { value: 'current', label: 'Current board' },
                { value: 'setup', label: 'Setup position' },
                { value: 'initial', label: 'Initial position' }
              ],
              `data-action="set-play-start-position" ${gameActive ? 'disabled' : ''}`
            )}
          </div>

          <div class="field-row">
            <label class="field-label" for="playSideSelect">Your Color</label>
            ${customSelectMarkup(
              'playSideSelect',
              side || 'white',
              [
                { value: 'white', label: 'White' },
                { value: 'black', label: 'Black' },
                { value: 'random', label: 'Random' }
              ],
              `data-action="set-play-side" ${gameActive ? 'disabled' : ''}`
            )}
          </div>

          <div class="field-row">
            <label class="field-label" for="playTimeSelect">Time Control</label>
            ${customSelectMarkup(
              'playTimeSelect',
              timeControl || 'none',
              [
                { value: 'none', label: 'No clock' },
                { value: '1+0', label: '1+0 (Bullet)' },
                { value: '3+2', label: '3+2 (Blitz)' },
                { value: '5+0', label: '5+0 (Blitz)' },
                { value: '10+0', label: '10+0 (Rapid)' },
                { value: '15+10', label: '15+10 (Rapid)' },
                { value: '30+0', label: '30+0 (Classical)' },
                { value: '45+45', label: '45+45 (Classical)' }
              ],
              `data-action="set-play-time" ${gameActive ? 'disabled' : ''}`
            )}
          </div>

          <div class="field-row">
            <label class="field-label" for="playSpeedSelect">Thinking Speed</label>
            ${customSelectMarkup(
              'playSpeedSelect',
              thinkingSpeed || 'normal',
              [
                { value: 'instant', label: 'Instant (0.1s - 0.5s)' },
                { value: 'fast', label: 'Fast (0.25s - 1.0s)' },
                { value: 'normal', label: 'Normal (0.5s - 2.0s)' },
                { value: 'slow', label: 'Slow / Thorough (1.0s - 4.0s)' }
              ],
              `data-action="set-play-speed" ${gameActive ? 'disabled' : ''}`
            )}
          </div>
        </div>

      </div>
    </article>
  `;

  withPreservedScroll(dom.controlPaneScroll, () => {
    dom.playPanel.innerHTML = playMarkup;
  });
}

// --- Endgame Puzzles (premium feature) -------------------------------------
// Random Stockfish-verified endgame puzzles served by the local puzzle API
// (puzzle-api.mjs). The solving session itself rides on the Play-vs-Stockfish
// machinery: the puzzle FEN becomes the start position and the solver always
// has the move. Free plan: PUZZLE_FREE_PER_DAY puzzles per day; an activation
// key unlocks unlimited puzzles.

let puzzleApi = null;
let puzzleGenerationController = null;

function ensurePuzzleApi() {
  if (!puzzleApi) {
    puzzleApi = createEndgamePuzzleApi({
      resolveWorkerPath: async () => (await resolveStockfishBundleCandidate()).workerPath,
    });
  }
  return puzzleApi;
}

function puzzleTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function persistPuzzlePrefs() {
  try {
    window.localStorage.setItem(PUZZLE_PREFS_STORAGE_KEY, JSON.stringify({
      objectivePreference: state.puzzle.objectivePreference,
      difficultyPreference: state.puzzle.difficultyPreference,
      skill: state.puzzle.skill,
      thinkingSpeed: state.puzzle.thinkingSpeed,
      solvedCount: state.puzzle.solvedCount,
      failedCount: state.puzzle.failedCount,
      streak: state.puzzle.streak,
      bestStreak: state.puzzle.bestStreak,
    }));
  } catch {
    // localStorage may be unavailable; preferences just won't persist.
  }
}

function persistPuzzleFreeUsage() {
  try {
    window.localStorage.setItem(PUZZLE_FREE_STORAGE_KEY, JSON.stringify({
      date: state.puzzle.freeDate,
      used: state.puzzle.freeUsed,
    }));
  } catch {
    // Ignore storage failures.
  }
}

function puzzleFreeRemaining() {
  return Infinity;
}

// Activation keys are validated offline: CHESS-XXXX-XXXX-CC where CC is a
// checksum of the first three groups. Keys can be issued with
// window.__endgamePuzzlePremium.generateKey().
function puzzleKeyChecksum(seed) {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1296).toString(36).toUpperCase().padStart(2, '0');
}

function validatePremiumKey(raw) {
  const key = String(raw || '').trim().toUpperCase();
  const match = /^CHESS-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})$/.exec(key);
  if (!match) {
    return '';
  }
  return puzzleKeyChecksum(`CHESS-${match[1]}-${match[2]}`) === match[3] ? key : '';
}

function generatePremiumKey() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const group = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const body = `CHESS-${group()}-${group()}`;
  return `${body}-${puzzleKeyChecksum(body)}`;
}

function persistPuzzleQueue() {
  try {
    window.localStorage.setItem(PUZZLE_QUEUE_STORAGE_KEY, JSON.stringify(state.puzzle.puzzleQueue));
  } catch {
    // Ignore storage failures.
  }
}

function persistPuzzleHistory() {
  try {
    window.localStorage.setItem(PUZZLE_HISTORY_STORAGE_KEY, JSON.stringify(state.puzzle.puzzleHistory));
  } catch {
    // Ignore storage failures.
  }
}

function savePuzzleQueueCsv() {
  const puzzles = state.puzzle.puzzleQueue;
  if (puzzles.length === 0) {
    state.puzzle.apiError = 'No puzzles in queue to export.';
    renderPuzzlePanel();
    return;
  }

  const headers = ['id','fen','objective','requestedObjective','isFallback','solverColor','startBalance','pieceCount','scoreType','scoreValue','mateIn','evalLabel','bestMoveUci','bestLineUci','title','instruction','source','difficulty'];
  const rows = puzzles.map(p => [
    p.id,
    p.fen,
    p.objective || '',
    p.requestedObjective || '',
    p.isFallback ? 'true' : '',
    p.solverColor || '',
    String(p.startBalance ?? ''),
    String(p.pieceCount ?? ''),
    p.scoreType || '',
    String(p.scoreValue ?? ''),
    p.mateIn != null ? String(p.mateIn) : '',
    p.evalLabel || '',
    p.bestMoveUci || '',
    Array.isArray(p.bestLineUci) ? p.bestLineUci.join(' ') : (p.bestLineUci || ''),
    p.title || '',
    p.instruction || '',
    p.source || '',
    p.difficulty || '',
  ]);

  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const escaped = row.map(v => {
      if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    });
    csvRows.push(escaped.join(','));
  }

  downloadTextFile('puzzles.csv', csvRows.join('\n'), 'text/csv');
  state.puzzle.apiError = '';
  renderPuzzlePanel();
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else if (ch === '\r') {
        // skip carriage returns
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

async function loadPuzzleQueueCsv(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 2) {
    state.puzzle.apiError = 'CSV file is empty or has no data rows.';
    renderPuzzlePanel();
    return;
  }

  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  let added = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const puzzle = {};
    for (let j = 0; j < headers.length; j++) {
      puzzle[headers[j]] = values[j] || '';
    }

    if (!puzzle.fen) continue;
    if (isPuzzleFenIllegal(puzzle.fen)) continue;

    puzzle.isFallback = puzzle.isFallback === 'true';
    puzzle.startBalance = parseInt(puzzle.startBalance, 10) || 0;
    puzzle.pieceCount = parseInt(puzzle.pieceCount, 10) || 0;
    puzzle.scoreValue = parseInt(puzzle.scoreValue, 10) || 0;
    puzzle.mateIn = puzzle.mateIn !== '' ? parseInt(puzzle.mateIn, 10) : null;

    if (typeof puzzle.bestLineUci === 'string' && puzzle.bestLineUci) {
      puzzle.bestLineUci = puzzle.bestLineUci.split(/\s+/).filter(Boolean);
    } else {
      puzzle.bestLineUci = [];
    }

    if (!puzzle.id) {
      puzzle.id = 'imported-' + Date.now() + '-' + added;
    }
    puzzle.source = puzzle.source || 'imported';

    addPuzzleToQueue(puzzle);
    added++;
  }

  persistPuzzleQueue();
  state.puzzle.apiError = added > 0 ? `Loaded ${added} puzzle(s) from CSV.` : 'No valid puzzles found in CSV.';
  renderPuzzlePanel();
}

// Filter out puzzles where the side to move is checking the opponent king.
function isPuzzleFenIllegal(fen) {
  if (!fen) {
    return true;
  }
  let game;
  try {
    game = new Chess(fen);
  } catch {
    return true;
  }
  const mover = game.turn();
  const defender = mover === 'w' ? 'b' : 'w';
  for (const row of game.board()) {
    for (const sq of row) {
      if (sq && sq.type === 'k') {
        if (sq.color === defender && game.isAttacked(sq.square, mover)) {
          return true; // solver checking opponent's king
        }
        if (sq.color === mover && game.isAttacked(sq.square, defender)) {
          return true; // solver is in check
        }
      }
    }
  }
  return false;
}

function hydratePuzzleHistory() {
  try {
    const rawHistory = window.localStorage.getItem(PUZZLE_HISTORY_STORAGE_KEY);
    if (rawHistory) {
      const history = JSON.parse(rawHistory);
      if (Array.isArray(history)) {
        state.puzzle.puzzleHistory = history.filter(p => !isPuzzleFenIllegal(p.fen));
      }
    }
  } catch {
    // Corrupt history record is ignored, preserving existing state.puzzle.puzzleHistory
  }
}

function addPuzzleToHistory(puzzle) {
  if (!puzzle || !puzzle.fen || isPuzzleFenIllegal(puzzle.fen)) {
    return;
  }
  const key = (p) => `${p.fen}::${p.objective || ''}::${p.solverColor || ''}`;
  const targetKey = key(puzzle);
  const exists = state.puzzle.puzzleHistory.some(p => key(p) === targetKey);
  if (exists) {
    return;
  }
  state.puzzle.puzzleHistory.unshift(puzzle);
  if (state.puzzle.puzzleHistory.length > PUZZLE_HISTORY_MAX) {
    state.puzzle.puzzleHistory = state.puzzle.puzzleHistory.slice(0, PUZZLE_HISTORY_MAX);
  }
  persistPuzzleHistory();
}

function hydratePuzzleState() {
  try {
    const prefs = JSON.parse(window.localStorage.getItem(PUZZLE_PREFS_STORAGE_KEY) || 'null');
    if (prefs && typeof prefs === 'object') {
      const objectives = ['random', PUZZLE_OBJECTIVE_MATE, PUZZLE_OBJECTIVE_WIN, PUZZLE_OBJECTIVE_DRAW];
      if (objectives.includes(prefs.objectivePreference)) {
        state.puzzle.objectivePreference = prefs.objectivePreference;
      }
      if (PUZZLE_DIFFICULTIES.includes(prefs.difficultyPreference)) {
        state.puzzle.difficultyPreference = prefs.difficultyPreference;
      }
      if (Number.isFinite(prefs.skill)) {
        state.puzzle.skill = clamp(Math.round(prefs.skill), 800, 3190);
      }
      if (['instant', 'fast', 'normal', 'slow'].includes(prefs.thinkingSpeed)) {
        state.puzzle.thinkingSpeed = prefs.thinkingSpeed;
      }
      for (const field of ['solvedCount', 'failedCount', 'streak', 'bestStreak']) {
        if (Number.isInteger(prefs[field]) && prefs[field] >= 0) {
          state.puzzle[field] = prefs[field];
        }
      }
    }
  } catch {
    // Corrupt prefs are ignored.
  }
  try {
    const premium = JSON.parse(window.localStorage.getItem(PUZZLE_PREMIUM_STORAGE_KEY) || 'null');
    if (premium?.unlocked && validatePremiumKey(premium.key)) {
      state.puzzle.premium = true;
      state.puzzle.premiumKey = String(premium.key);
    }
  } catch {
    // Corrupt premium record is ignored.
  }
  try {
    const free = JSON.parse(window.localStorage.getItem(PUZZLE_FREE_STORAGE_KEY) || 'null');
    if (free && typeof free === 'object') {
      state.puzzle.freeDate = typeof free.date === 'string' ? free.date : '';
      state.puzzle.freeUsed = Number.isInteger(free.used) && free.used >= 0 ? free.used : 0;
    }
  } catch {
    // Corrupt usage record is ignored.
  }
  try {
    const rawQueue = window.localStorage.getItem(PUZZLE_QUEUE_STORAGE_KEY);
    if (rawQueue === null) {
      state.puzzle.puzzleQueue = createDefaultPuzzleQueue();
    } else {
      const queue = JSON.parse(rawQueue);
      if (Array.isArray(queue)) {
        // Migrate old puzzles that lack a source property
        for (const p of queue) {
          if (!p.source) {
            p.source = (typeof p.id === 'string' && p.id.startsWith('default-endgame-')) ? 'default' : 'generated';
          }
        }
        state.puzzle.puzzleQueue = queue.filter(p => !isPuzzleFenIllegal(p.fen));
      }
    }
  } catch {
    // Corrupt queue record is ignored, preserving existing state.puzzle.puzzleQueue
  }
  hydratePuzzleHistory();
}

function updatePuzzleObjective(value) {
  const objectives = ['random', PUZZLE_OBJECTIVE_MATE, PUZZLE_OBJECTIVE_WIN, PUZZLE_OBJECTIVE_DRAW];
  if (objectives.includes(value)) {
    state.puzzle.objectivePreference = value;
    persistPuzzlePrefs();
  }
  renderPuzzlePanel();
}

function updatePuzzleDifficulty(value) {
  if (PUZZLE_DIFFICULTIES.includes(value)) {
    state.puzzle.difficultyPreference = value;
    persistPuzzlePrefs();
  }
  renderPuzzlePanel();
}

function updatePuzzleSkill(value, { skipRender = false } = {}) {
  const elo = clamp(parseInt(value, 10) || 0, 800, 3190);
  state.puzzle.skill = elo;
  if (state.puzzle.sessionActive && state.play.active) {
    state.play.skill = elo;
    if (state.engine.worker && state.engine.ready) {
      applyEngineSkillLevel(elo);
    }
  }
  persistPuzzlePrefs();
  if (skipRender) {
    const labelEl = document.querySelector('label[for="puzzleSkillSlider"]');
    if (labelEl) {
      labelEl.textContent = `Stockfish Defense (${elo < 1320 ? '~Elo' : 'Elo'})`;
    }
    const sliderEl = document.getElementById('puzzleSkillSlider');
    const valueEl = sliderEl?.parentElement?.querySelector('.field-value');
    if (valueEl) {
      valueEl.textContent = `${elo}${elo < 1320 ? '*' : ''}`;
    }
  } else {
    renderPuzzlePanel();
  }
}

function updatePuzzleSpeed(value) {
  if (['instant', 'fast', 'normal', 'slow'].includes(value)) {
    state.puzzle.thinkingSpeed = value;
    if (state.puzzle.sessionActive && state.play.active) {
      state.play.thinkingSpeed = value;
    }
    persistPuzzlePrefs();
  }
  renderPuzzlePanel();
}

function puzzleObjectiveLabel(objective) {
  if (objective === PUZZLE_OBJECTIVE_MATE) {
    return 'Checkmate';
  }
  if (objective === PUZZLE_OBJECTIVE_WIN) {
    return 'Gain a piece';
  }
  if (objective === PUZZLE_OBJECTIVE_DRAW) {
    return 'Hold the draw';
  }
  return 'Surprise me';
}

function puzzleSpeedLabel(speed) {
  if (speed === 'instant') {
    return 'Instant';
  }
  if (speed === 'fast') {
    return 'Fast';
  }
  if (speed === 'slow') {
    return 'Slow';
  }
  return 'Normal';
}

function puzzleObjectiveInstruction(puzzle) {
  const sideLabel = puzzle.solverColor === 'w' ? 'White' : 'Black';
  let text;
  if (puzzle.objective === PUZZLE_OBJECTIVE_MATE) {
    text = puzzle.mateIn
      ? `You play ${sideLabel}. Checkmate Stockfish — mate in ${puzzle.mateIn} is available.`
      : `You play ${sideLabel}. Checkmate Stockfish.`;
  } else if (puzzle.objective === PUZZLE_OBJECTIVE_WIN) {
    text = `You play ${sideLabel}. Win material — gain at least a minor piece (+${PUZZLE_WIN_MATERIAL_GAIN} points).`;
  } else {
    text = `You play ${sideLabel}. You are down material — hold the draw against Stockfish.`;
  }
  if (puzzle.isFallback) {
    text = `No "${puzzleObjectiveLabel(puzzle.requestedObjective)}" puzzle verified in time, so here is a "${puzzleObjectiveLabel(puzzle.objective)}" puzzle instead. ${text}`;
  }
  return text;
}

function puzzleGeneratingDetail() {
  return state.puzzle.generatingAttempt > 0
    ? `Stockfish is verifying candidate ${state.puzzle.generatingAttempt} of ${state.puzzle.generatingMaxAttempts}…`
    : 'The puzzle API is building a random endgame and verifying it with Stockfish.';
}

function handlePuzzleGenerationAttempt({ attempt, maxAttempts }) {
  state.puzzle.generatingAttempt = attempt;
  state.puzzle.generatingMaxAttempts = maxAttempts;
  const detail = dom.puzzlePanel?.querySelector('.puzzle-generating-detail');
  if (detail) {
    detail.textContent = puzzleGeneratingDetail();
  }
}

async function generatePuzzleBatch(count = 5) {
  if (state.puzzle.isGeneratingPuzzleBatch) {
    return;
  }
  if (state.puzzle.puzzleQueue.length >= PUZZLE_QUEUE_MAX) {
    state.puzzle.apiError = `Queue is full (maximum ${PUZZLE_QUEUE_MAX} puzzles). Solve some puzzles first!`;
    renderPuzzlePanel();
    return;
  }
  const countToGenerate = count;

  state.puzzle.isGeneratingPuzzleBatch = true;
  state.puzzle.puzzleBatchStatus = `Generating puzzles... (0/${countToGenerate})`;
  state.puzzle.apiError = '';
  renderPuzzlePanel();

  const api = ensurePuzzleApi();
  let successCount = 0;
  let attempts = 0;
  const maxRetries = 15;

  puzzleGenerationController = new AbortController();

  while (successCount < countToGenerate && attempts < maxRetries) {
    if (puzzleGenerationController.signal.aborted) {
      break;
    }
    attempts++;
    state.puzzle.puzzleBatchStatus = `Generating puzzles... (${successCount}/${countToGenerate})`;
    renderPuzzlePanel();

    try {
      state.puzzle.generatingAttempt = 0;
      state.puzzle.generatingMaxAttempts = 0;

      const puzzle = await api.generatePuzzle({
        objective: state.puzzle.objectivePreference,
        difficulty: state.puzzle.difficultyPreference,
        signal: puzzleGenerationController.signal,
        onAttempt: handlePuzzleGenerationAttempt,
      });

      if (puzzle && puzzle.fen) {
        if (state.puzzle.difficultyPreference && state.puzzle.difficultyPreference !== 'any') {
          puzzle.difficulty = state.puzzle.difficultyPreference;
        }
        puzzle.source = 'generated';
        addPuzzleToQueue(puzzle);
        persistPuzzleQueue();
        addPuzzleToHistory(puzzle);
        successCount++;
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        break;
      }
      console.error('Batch puzzle generation attempt failed', error);
    }
  }

  state.puzzle.isGeneratingPuzzleBatch = false;
  if (puzzleGenerationController?.signal?.aborted) {
    state.puzzle.puzzleBatchStatus = `Generation cancelled. ${successCount} puzzle(s) ready.`;
  } else if (successCount === countToGenerate) {
    state.puzzle.puzzleBatchStatus = `${successCount} puzzle(s) ready.`;
  } else {
    state.puzzle.puzzleBatchStatus = `Generated ${successCount} of ${countToGenerate} puzzles.`;
  }
  puzzleGenerationController = null;
  renderPuzzlePanel();
}

async function requestNewPuzzle() {
  if (state.puzzle.sessionActive && state.play.active) {
    return;
  }
  if (state.play.active) {
    stopPlayGame({ reason: 'Game abandoned to start a puzzle.' });
  }
  if (state.puzzle.puzzleQueue.length === 0) {
    state.puzzle.apiError = 'No ready puzzles. Generate 5 more.';
    renderPuzzlePanel();
    return;
  }
  dismissPuzzleResultModal();
  
  const puzzle = state.puzzle.puzzleQueue.shift();
  persistPuzzleQueue();
  state.puzzle.apiError = '';
  state.puzzle.lastResult = null;
  state.activeTab = TAB_PUZZLE;
  renderAll();

  try {
    await startPuzzleSession(puzzle);
  } catch (error) {
    console.error('Failed to start puzzle session', error);
    state.puzzle.apiError = error?.message || 'Failed to load puzzle.';
    renderPuzzlePanel();
  }
}

async function requestPreviousPuzzle() {
  if (!state.puzzle.puzzleHistory || state.puzzle.puzzleHistory.length === 0) {
    state.puzzle.apiError = 'No previous puzzles saved yet.';
    renderPuzzlePanel();
    return;
  }
  const puzzle = state.puzzle.puzzleHistory[state.puzzle.historyCursor];
  state.puzzle.historyCursor = (state.puzzle.historyCursor + 1) % state.puzzle.puzzleHistory.length;
  dismissPuzzleResultModal();
  state.puzzle.apiError = '';
  state.puzzle.lastResult = null;
  state.activeTab = TAB_PUZZLE;
  renderAll();

  try {
    await startPuzzleSession(puzzle);
  } catch (error) {
    console.error('Failed to replay puzzle session', error);
    state.puzzle.apiError = error?.message || 'Failed to load puzzle.';
    renderPuzzlePanel();
  }
}

function cancelPuzzleGeneration() {
  puzzleGenerationController?.abort();
}

async function startPuzzleSession(puzzle) {
  if (!puzzle) {
    return;
  }
  if (state.play.active) {
    stopPlayGame({ reason: 'Game abandoned to start a puzzle.' });
  }
  // Reset practice state so lesson/practice exact-move checks cannot interfere.
  state.practice = createEmptyPracticeState();
  state.puzzle.savedPlaySettings ??= {
    skill: state.play.skill,
    timeControl: state.play.timeControl,
    side: state.play.side,
    startPosition: state.play.startPosition,
    thinkingSpeed: state.play.thinkingSpeed,
  };
  state.puzzle.current = puzzle;
  state.puzzle.sessionActive = true;
  state.puzzle.pendingResult = null;
  state.puzzle.lastResult = null;
  state.puzzle.startBalance = materialBalanceFromFen(puzzle.fen, puzzle.solverColor);
  state.play.side = puzzle.solverColor === 'w' ? 'white' : 'black';
  state.play.timeControl = 'none';
  state.play.startPosition = 'current';
  state.play.skill = state.puzzle.skill;
  state.play.thinkingSpeed = state.puzzle.thinkingSpeed;
  state.analysis.currentFen = puzzle.fen;
  // startPlayGame runs synchronously up to its first await, so the objective
  // instruction can replace the generic "Game started" message right away
  // while Stockfish is still loading.
  const startPromise = startPlayGame({ ownerTab: TAB_PUZZLE });
  // Ensure no Play-mode clock interval keeps running in Puzzle mode.
  stopPlayClock();
  if (state.play.active && state.puzzle.sessionActive) {
    state.analysis.boardMessage = puzzleObjectiveInstruction(puzzle);
    renderAll();
  }
  await startPromise;
}

async function retryCurrentPuzzle() {
  const puzzle = state.puzzle.current;
  dismissPuzzleResultModal();
  if (!puzzle || state.puzzle.generating || state.puzzle.isGeneratingPuzzleBatch || (state.puzzle.sessionActive && state.play.active)) {
    return;
  }
  await startPuzzleSession(puzzle);
}

async function skipPuzzle() {
  if (state.puzzle.sessionActive && state.play.active) {
    state.puzzle.pendingResult = { kind: 'abandoned' };
    stopPlayGame({ reason: 'Puzzle skipped.' });
  }
  await requestNewPuzzle();
}

function giveUpPuzzle() {
  if (state.puzzle.sessionActive && state.play.active) {
    stopPlayGame({ reason: 'You gave up.' });
  }
}

// Called after each Stockfish reply: in "gain a piece" puzzles the session
// ends as solved once the solver is up the required material with the move.
function checkPuzzleMaterialObjective() {
  if (!state.puzzle.sessionActive || !state.play.active || !state.analysis.game) {
    return false;
  }
  const puzzle = state.puzzle.current;
  if (!puzzle || puzzle.objective !== PUZZLE_OBJECTIVE_WIN) {
    return false;
  }
  const balance = materialBalanceFromFen(state.analysis.game.fen(), puzzle.solverColor);
  const gain = balance - state.puzzle.startBalance;
  if (gain >= PUZZLE_WIN_MATERIAL_GAIN) {
    state.puzzle.pendingResult = {
      kind: 'solved',
      title: 'Puzzle solved!',
      message: `You won material (+${gain} points). Objective complete.`,
    };
    stopPlayGame({ reason: `You won material (+${gain}).` });
    return true;
  }
  return false;
}

function restoreSavedPlaySettings() {
  const saved = state.puzzle.savedPlaySettings;
  if (!saved) {
    return;
  }
  state.play.skill = saved.skill;
  state.play.timeControl = saved.timeControl;
  state.play.side = saved.side;
  state.play.startPosition = saved.startPosition;
  state.play.thinkingSpeed = saved.thinkingSpeed;
  state.puzzle.savedPlaySettings = null;
}

function evaluatePuzzleOutcome(puzzle, reason) {
  const game = state.analysis.game;
  const reasonText = String(reason || '');
  if (!puzzle || !game) {
    return { kind: 'abandoned' };
  }
  if (/abandoned|enabling analysis|failed to load|skipped|invalid move|illegal move/i.test(reasonText)) {
    return { kind: 'abandoned' };
  }
  // Defensively ignore timeout/flag reasons in Puzzle mode so a queued
  // timer event cannot fail the puzzle.
  if (/wins on time|flagged/i.test(reasonText)) {
    return { kind: 'abandoned' };
  }
  const objectiveLabel = puzzleObjectiveLabel(puzzle.objective);
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    if (winner === puzzle.solverColor) {
      return {
        kind: 'solved',
        title: 'Puzzle solved!',
        message: puzzle.objective === PUZZLE_OBJECTIVE_MATE
          ? 'Checkmate delivered. Well played!'
          : `Checkmate! You went beyond the "${objectiveLabel}" objective.`,
      };
    }
    return { kind: 'failed', title: 'Puzzle failed', message: 'Stockfish checkmated you.' };
  }

  const legallyDrawn =
    game.isDraw?.() ||
    game.isInsufficientMaterial?.() ||
    isFenInsufficientMaterialDraw(game.fen());

  if (puzzle.objective === PUZZLE_OBJECTIVE_DRAW) {
    if (legallyDrawn) {
      const displayReason = reasonText ? reasonText.replace(/\.+$/, '') : 'insufficient material';
      return { kind: 'solved', title: 'Puzzle solved!', message: `Draw secured (${displayReason}). Defense held!` };
    }
    
    // If the puzzle objective is draw but legallyDrawn is false:
    // - do NOT return solved
    // - do NOT show “you were able to draw”
    // - if the engine/tablebase says the player is losing, show failed
    // - otherwise continue the puzzle or show neutral/incomplete status
    let isLosing = false;
    const tbResult = currentTablebaseResultForDisplay();
    if (tbResult) {
      if (puzzle.solverColor === 'w' && tbResult.outcome === 'black') {
        isLosing = true;
      } else if (puzzle.solverColor === 'b' && tbResult.outcome === 'white') {
        isLosing = true;
      }
    } else if (state.engine.scoreValue !== null) {
      const solverSide = puzzle.solverColor === 'w' ? 'white' : 'black';
      const playerMultiplier = solverSide === 'black' ? -1 : 1;
      const playerScore = state.engine.scoreValue * playerMultiplier;
      if (state.engine.scoreType === 'mate') {
        if (playerScore < 0) {
          isLosing = true;
        }
      } else {
        if (playerScore < DRAW_OBJECTIVE_LOSING_THRESHOLD_CP) {
          isLosing = true;
        }
      }
    }

    if (isLosing) {
      return { kind: 'failed', title: 'Puzzle failed', message: 'The position is losing according to evaluation.' };
    }
    return { kind: 'incomplete', title: 'Puzzle incomplete', message: 'Draw not secured yet.' };
  }

  if (legallyDrawn) {
    return { kind: 'failed', title: 'Puzzle failed', message: `The game was drawn, but the objective was "${objectiveLabel}".` };
  }

  if (/gave up|resigned/i.test(reasonText)) {
    return { kind: 'failed', title: 'Puzzle failed', message: 'You gave up this puzzle.' };
  }
  return { kind: 'failed', title: 'Puzzle failed', message: `Objective "${objectiveLabel}" was not met. (${reasonText})` };
}

// Invoked by stopPlayGame whenever a puzzle session is running.
function finishPuzzleSession(reason) {
  const puzzle = state.puzzle.current;
  state.puzzle.sessionActive = false;
  restoreSavedPlaySettings();
  const outcome = state.puzzle.pendingResult || evaluatePuzzleOutcome(puzzle, reason);
  state.puzzle.pendingResult = null;
  if (!outcome || outcome.kind === 'abandoned') {
    state.puzzle.lastResult = null;
    renderAll();
    return;
  }
  if (outcome.kind === 'solved') {
    state.puzzle.solvedCount += 1;
    state.puzzle.streak += 1;
    state.puzzle.bestStreak = Math.max(state.puzzle.bestStreak, state.puzzle.streak);
  } else if (outcome.kind === 'failed') {
    state.puzzle.failedCount += 1;
    state.puzzle.streak = 0;
  }
  persistPuzzlePrefs();
  state.puzzle.lastResult = outcome;
  renderAll();
  showPuzzleResultModal(outcome);
}

function showPuzzleResultModal(outcome) {
  const modal = dom.puzzleResultModal;
  if (!modal || !dom.puzzleResultTitle || !dom.puzzleResultMessage || !dom.puzzleResultActions) {
    return;
  }
  dom.puzzleResultTitle.textContent = outcome.title || (outcome.kind === 'solved' ? 'Puzzle solved!' : 'Puzzle failed');
  dom.puzzleResultMessage.textContent = outcome.message || '';
  const buttons = [];
  if ((outcome.kind === 'failed' || outcome.kind === 'incomplete') && state.puzzle.current) {
    buttons.push('<button type="button" class="action-button tonal" data-action="retry-puzzle">Retry Puzzle</button>');
  }
  if (state.puzzle.puzzleQueue.length > 0) {
    buttons.push('<button type="button" class="action-button primary" data-action="puzzle-next">Next Puzzle</button>');
  }
  buttons.push('<button type="button" class="action-button" data-action="dismiss-puzzle-result">Close</button>');
  dom.puzzleResultActions.innerHTML = buttons.join('');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function dismissPuzzleResultModal() {
  const modal = dom.puzzleResultModal;
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

function openPremiumModal() {
  dismissPuzzleResultModal();
  const modal = dom.premiumModal;
  if (!modal) {
    return;
  }
  if (dom.premiumModalStatus) {
    dom.premiumModalStatus.textContent = '';
    dom.premiumModalStatus.classList.remove('is-error', 'is-success');
  }
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => dom.premiumKeyInput?.focus(), 0);
}

function dismissPremiumModal() {
  const modal = dom.premiumModal;
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

function activatePremiumFromInput() {
  const statusEl = dom.premiumModalStatus;
  const normalized = validatePremiumKey(dom.premiumKeyInput?.value);
  if (!normalized) {
    if (statusEl) {
      statusEl.textContent = 'That activation key is not valid. Keys look like CHESS-XXXX-XXXX-XX.';
      statusEl.classList.add('is-error');
      statusEl.classList.remove('is-success');
    }
    return;
  }
  state.puzzle.premium = true;
  state.puzzle.premiumKey = normalized;
  try {
    window.localStorage.setItem(PUZZLE_PREMIUM_STORAGE_KEY, JSON.stringify({ unlocked: true, key: normalized }));
  } catch {
    // Unlock still applies for this session even if persistence fails.
  }
  if (statusEl) {
    statusEl.textContent = 'Premium unlocked — enjoy unlimited endgame puzzles!';
    statusEl.classList.add('is-success');
    statusEl.classList.remove('is-error');
  }
  window.setTimeout(() => {
    dismissPremiumModal();
    renderActiveToolPanel();
  }, 900);
  renderPuzzlePanel();
}

function renderPuzzleQueueControls(pz) {
  const isGenerating = pz.isGeneratingPuzzleBatch || pz.generating;
  const historyLength = pz.puzzleHistory ? pz.puzzleHistory.length : 0;
  
  let generationStatusMarkup = '';
  if (pz.isGeneratingPuzzleBatch) {
    generationStatusMarkup = `
      <div class="banner puzzle-generating-banner" style="margin-top: 8px;">
        <span class="puzzle-spinner" aria-hidden="true"></span>
        <div>
          <strong>Generating puzzles...</strong>
          <div class="puzzle-generating-detail">${escapeHtml(pz.puzzleBatchStatus)}</div>
          ${(pz.generatingAttempt > 0) ? `
            <div style="font-size: 0.85em; color: var(--color-text-muted); margin-top: 4px;">
              ${escapeHtml(puzzleGeneratingDetail())}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="action-row play-start-action-row" style="justify-content: center; margin-top: 8px;">
        <button type="button" class="action-button danger" data-action="cancel-batch-generation">Cancel</button>
      </div>
    `;
  } else {
    generationStatusMarkup = `
      <div style="text-align: center; color: var(--color-text-muted); font-size: 0.85em; margin-top: 6px;">
        ${pz.puzzleQueue.length === 0 ? 'No ready puzzles. Generate 5 more.' : (pz.puzzleBatchStatus || `${pz.puzzleQueue.length} puzzle(s) ready.`)}
      </div>
    `;
  }

  const defaultRemaining = pz.puzzleQueue.filter(p => p.source === 'default').length;
  const generatedReady = pz.puzzleQueue.filter(p => p.source === 'generated').length;
  const totalReady = pz.puzzleQueue.length;

  const clearButtonMarkup = (pz.puzzleHistory && pz.puzzleHistory.length > 0)
    ? `<button type="button" class="action-button danger" data-action="clear-puzzle-history" style="flex: 1; min-height: 36px;">Clear Previous Puzzles</button>`
    : '';

  return `
    <div class="puzzle-queue-controls" style="display: flex; flex-direction: column; gap: 10px; background: var(--card-bg, rgba(255, 255, 255, 0.05)); border: 1px solid var(--card-border); border-radius: var(--radius-card); padding: 12px; margin-bottom: 12px;">
      <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.9em;">
        <div style="display: flex; justify-content: space-between;">
          <span>Default puzzles remaining:</span>
          <span style="font-weight: 700;">${defaultRemaining} / ${DEFAULT_PUZZLE_COUNT}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Generated puzzles ready:</span>
          <span style="font-weight: 700;">${generatedReady}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--card-border); padding-top: 3px; margin-top: 2px; font-weight: 500;">
          <span>Total ready puzzles:</span>
          <span style="font-weight: 700;">${totalReady}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: var(--color-text-muted);">
          <span>Previous puzzles saved:</span>
          <span style="font-weight: 700;">${historyLength}</span>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
        <button type="button" class="action-button tonal" data-action="generate-puzzle-batch" ${ (isGenerating || totalReady >= PUZZLE_QUEUE_MAX) ? 'disabled' : '' }>Generate 5 More Puzzles</button>
        <button type="button" class="action-button tonal" data-action="restore-default-puzzles" ${ isGenerating ? 'disabled' : '' } style="width: 100%; min-height: 36px;">Reset Default Puzzles</button>
        <div style="display: flex; gap: 8px; width: 100%;">
          <button type="button" class="action-button tonal" data-action="save-puzzle-csv" ${ pz.puzzleQueue.length === 0 ? 'disabled' : '' } style="flex: 1; min-height: 36px;">Save Queue as CSV</button>
          <button type="button" class="action-button tonal" data-action="load-puzzle-csv" ${ isGenerating ? 'disabled' : '' } style="flex: 1; min-height: 36px;">Load CSV Puzzles</button>
        </div>
        <div style="display: flex; gap: 8px; width: 100%;">
          <button type="button" class="action-button tonal" data-action="replay-previous-puzzle" ${ (historyLength === 0 || isGenerating) ? 'disabled' : '' } style="flex: 1; min-height: 36px;">Replay Previous Puzzle</button>
          ${clearButtonMarkup}
        </div>
      </div>
      ${generationStatusMarkup}
    </div>
  `;
}

function renderPuzzleBoardInstruction() {
  const container = dom.puzzleBoardInstruction;
  if (!container) {
    return;
  }
  const pz = state.puzzle;
  if (state.activeTab === TAB_PUZZLE && pz.sessionActive && pz.current) {
    const puzzle = pz.current;
    const isThinking = state.play.engineThinking;
    const titleText = isThinking ? 'Stockfish is thinking…' : 'Your move';
    const bannerClass = isThinking ? 'warning' : 'success';
    const instructionText = puzzleObjectiveInstruction(puzzle);

    container.innerHTML = `
      <div class="banner ${bannerClass}">
        <div>
          <strong>${escapeHtml(titleText)}</strong>
          <div>${escapeHtml(instructionText)}</div>
        </div>
      </div>
    `;
    container.hidden = false;
  } else {
    container.innerHTML = '';
    container.hidden = true;
  }
}

function renderPuzzlePanel() {
  if (!dom.puzzlePanel) {
    return;
  }
  const pz = state.puzzle;

  const statsMarkup = `
    <div class="puzzle-stats-row" role="group" aria-label="Puzzle statistics">
      <div class="puzzle-stat"><span class="puzzle-stat-value">${pz.solvedCount}</span><span class="puzzle-stat-label">Solved</span></div>
      <div class="puzzle-stat"><span class="puzzle-stat-value">${pz.failedCount}</span><span class="puzzle-stat-label">Failed</span></div>
      <div class="puzzle-stat"><span class="puzzle-stat-value">${pz.streak}</span><span class="puzzle-stat-label">Streak</span></div>
      <div class="puzzle-stat"><span class="puzzle-stat-value">${pz.bestStreak}</span><span class="puzzle-stat-label">Best</span></div>
    </div>
  `;

  const queueControlsMarkup = renderPuzzleQueueControls(pz);

  const showStartButton = !pz.generating && !pz.sessionActive;
  const buttonText = pz.current ? 'Next Puzzle' : 'Start Puzzle';
  const startButtonMarkup = showStartButton ? `
    <button type="button" class="action-button primary" data-action="new-puzzle" ${pz.puzzleQueue.length === 0 ? 'disabled' : ''} style="width: 100%;">${buttonText}</button>
  ` : '';

  let sessionMarkup = '';
  if (pz.generating) {
    sessionMarkup = `
      <div class="banner puzzle-generating-banner">
        <span class="puzzle-spinner" aria-hidden="true"></span>
        <div>
          <strong>Generating puzzle…</strong>
          <div class="puzzle-generating-detail">${escapeHtml(puzzleGeneratingDetail())}</div>
        </div>
      </div>
    `;
  } else if (pz.sessionActive && pz.current) {
    const puzzle = pz.current;
    let progressMarkup = '';
    if (puzzle.objective === PUZZLE_OBJECTIVE_WIN && state.analysis.game) {
      const gain = materialBalanceFromFen(state.analysis.game.fen(), puzzle.solverColor) - pz.startBalance;
      progressMarkup = `<p class="section-copy">Material gained: ${gain >= 0 ? '+' : ''}${gain} of +${PUZZLE_WIN_MATERIAL_GAIN}</p>`;
    }
    sessionMarkup = `
      ${progressMarkup}
      <div class="action-row play-action-row">
        <button type="button" class="action-button danger" data-action="give-up-puzzle">Give Up</button>
        ${puzzle.objective === PUZZLE_OBJECTIVE_DRAW ? '<button type="button" class="action-button tonal" data-action="offer-draw">Offer Draw</button>' : ''}
        <button type="button" class="action-button tonal" data-action="skip-puzzle">Skip Puzzle</button>
      </div>
    `;
  }

  let settingsMarkup = '';
  if (!pz.generating && !(pz.sessionActive && pz.current)) {
    settingsMarkup = `
      <div class="stack-grid">
        <div class="two-col play-options-grid">
          <div class="field-row">
            <label class="field-label" for="puzzleObjectiveSelect">Objective</label>
            ${customSelectMarkup(
              'puzzleObjectiveSelect',
              pz.objectivePreference,
              [
                { value: 'random', label: 'Surprise me (random)' },
                { value: PUZZLE_OBJECTIVE_MATE, label: 'Checkmate' },
                { value: PUZZLE_OBJECTIVE_WIN, label: 'Gain a piece' },
                { value: PUZZLE_OBJECTIVE_DRAW, label: 'Hold the draw' },
              ],
              'data-action="set-puzzle-objective"'
            )}
          </div>
          <div class="field-row">
            <label class="field-label" for="puzzleDifficultySelect">Difficulty</label>
            ${customSelectMarkup(
              'puzzleDifficultySelect',
              pz.difficultyPreference,
              [
                { value: 'any', label: 'Any difficulty' },
                { value: 'easy', label: 'Easier' },
                { value: 'hard', label: 'Harder' },
              ],
              'data-action="set-puzzle-difficulty"'
            )}
          </div>
          <div class="field-row">
            <label class="field-label" for="puzzleSpeedSelect">Stockfish Reply Speed</label>
            ${customSelectMarkup(
              'puzzleSpeedSelect',
              pz.thinkingSpeed,
              [
                { value: 'instant', label: 'Instant (0.1s - 0.5s)' },
                { value: 'fast', label: 'Fast (0.25s - 1.0s)' },
                { value: 'normal', label: 'Normal (0.5s - 2.0s)' },
                { value: 'slow', label: 'Slow / Thorough (1.0s - 4.0s)' },
              ],
              'data-action="set-puzzle-speed"'
            )}
          </div>
        </div>
        <div class="field-row">
          <label class="field-label" for="puzzleSkillSlider">Stockfish Defense (${pz.skill < 1320 ? '~Elo' : 'Elo'})</label>
          <div class="range-control-wrap">
            <input
              type="range"
              id="puzzleSkillSlider"
              min="800"
              max="3190"
              step="50"
              value="${pz.skill}"
              data-action="set-puzzle-skill"
            >
            <span class="field-value">${pz.skill}${pz.skill < 1320 ? '*' : ''}</span>
          </div>
        </div>
      </div>
    `;
  }

  const resultBanner = pz.lastResult ? `
    <div class="banner ${pz.lastResult.kind === 'solved' ? 'success' : (pz.lastResult.kind === 'incomplete' ? 'warning' : 'danger')}" style="margin-top: 8px;">
      <div>
        <strong>${escapeHtml(pz.lastResult.title || '')}</strong>
        <div>${escapeHtml(pz.lastResult.message || '')}</div>
      </div>
    </div>
  ` : '';

  const errorBanner = pz.apiError ? `
    <div class="banner warning" style="margin-top: 8px;">
      <div>
        <strong>Puzzle API error</strong>
        <div>${escapeHtml(pz.apiError)}</div>
      </div>
    </div>
  ` : '';

  const markup = `
    <article class="lesson-section">
      <div class="lesson-section-header">
        <div class="play-section-heading">
          <h3 class="lesson-section-title play-section-title">Endgame Puzzles</h3>
        </div>
      </div>

      <div class="section-divider"></div>
      <p class="puzzle-section-label">Statistics</p>
      ${statsMarkup}

      <div class="section-divider"></div>
      <p class="puzzle-section-label">Session</p>
      ${startButtonMarkup}
      ${sessionMarkup}

      <div class="section-divider"></div>
      <p class="puzzle-section-label">Queue</p>
      ${queueControlsMarkup}

      <div class="section-divider"></div>
      <p class="puzzle-section-label">Settings</p>
      ${settingsMarkup}

      ${resultBanner}
      ${errorBanner}
    </article>
  `;

  withPreservedScroll(dom.controlPaneScroll, () => {
    dom.puzzlePanel.innerHTML = markup;
  });
}

function setBoardOnlySetupVisible(visible) {
  if (!state.boardOnlyMode) {
    return;
  }
  state.boardOnlySetupVisible = Boolean(visible);
  state.boardOnlyTeacherSetupActive = false;
  state.activeTab = state.boardOnlySetupVisible ? TAB_SETUP : TAB_ANALYSIS;
  state.toolsExpanded = state.boardOnlySetupVisible;
  if (state.boardOnlySetupVisible) {
    setAnnotateMode(false);
  }
  renderAll();
  window.requestAnimationFrame(syncBoardSize);
}

function setBoardOnlyTeacherSetupActive(active) {
  if (!state.boardOnlyMode) {
    return;
  }
  state.boardOnlySetupVisible = false;
  state.boardOnlyTeacherSetupActive = Boolean(active);
  state.toolsExpanded = false;
  state.activeTab = state.boardOnlyTeacherSetupActive ? TAB_SETUP : TAB_ANALYSIS;
  if (state.boardOnlyTeacherSetupActive) {
    setAnnotateMode(false);
  } else {
    state.setup.armedPiece = null;
  }
  renderAll();
  window.requestAnimationFrame(syncBoardSize);
}

function commitBoardOnlyFenInput(value, options = {}) {
  const { render = true } = options;
  const parsed = parseFenLike(String(value || '').trim());
  if (!parsed.ok) {
    return false;
  }
  commitSetupState(parsed.pieces, parsed.meta, { syncFenInput: true, resetAnalysis: true });
  if (render) {
    renderAll();
  }
  return true;
}

function resetBoardOnlyToStartFen() {
  commitStrictFenInput(DEFAULT_POSITION, { render: true, showError: false });
  if (state.boardOnlyMode) {
    state.activeTab = state.boardOnlyTeacherSetupActive ? TAB_SETUP : TAB_ANALYSIS;
    renderAll();
  }
}

function resetBoardOnlyToInitialFen() {
  const fen = String(state.boardOnlyInitialFen || DEFAULT_POSITION).trim() || DEFAULT_POSITION;
  if (!commitBoardOnlyFenInput(fen, { render: true })) {
    commitStrictFenInput(DEFAULT_POSITION, { render: true, showError: false });
  }
  if (state.boardOnlyMode) {
    state.activeTab = (state.boardOnlySetupVisible || state.boardOnlyTeacherSetupActive) ? TAB_SETUP : TAB_ANALYSIS;
    renderAll();
  }
}

function clearBoardOnlyTeacherSetup() {
  const nextMeta = {
    ...DEFAULT_META,
    activeColor: state.setup.meta.activeColor === 'b' ? 'b' : 'w',
    castling: '-',
    enPassant: '-',
    halfmove: 0,
    fullmove: 1,
  };
  commitSetupState({}, nextMeta, { syncFenInput: true, resetAnalysis: true });
  if (state.boardOnlyMode) {
    state.activeTab = state.boardOnlyTeacherSetupActive ? TAB_SETUP : TAB_ANALYSIS;
    state.setup.armedPiece = null;
    renderAll();
  }
}

function selectBoardOnlyTeacherPiece(piece) {
  if (!state.boardOnlyMode || !state.boardOnlyTeacherSetupActive) {
    return;
  }
  const value = String(piece || '').trim();
  if (value !== 'eraser' && !PIECE_ASSETS[value]) {
    return;
  }
  state.setup.armedPiece = value;
  if (value !== 'eraser') {
    state.setup.paletteColor = value === value.toLowerCase() ? 'b' : 'w';
  }
  state.activeTab = TAB_SETUP;
  renderBoard();
}

function handleTeacherBoardAction(action, data = {}) {
  if (!state.boardOnlyMode) {
    return;
  }
  switch (action) {
    case 'enterTeacherSetup':
      setBoardOnlyTeacherSetupActive(true);
      break;
    case 'exitTeacherSetup':
      setBoardOnlyTeacherSetupActive(false);
      break;
    case 'selectTeacherPiece':
      selectBoardOnlyTeacherPiece(data.piece);
      break;
    case 'emptyTeacherBoard':
      clearBoardOnlyTeacherSetup();
      break;
    case 'startTeacherBoard':
      resetBoardOnlyToStartFen();
      break;
    case 'lessonTeacherBoard':
      resetBoardOnlyToInitialFen();
      break;
    case 'showSetup':
      setBoardOnlySetupVisible(true);
      break;
    case 'hideSetup':
      setBoardOnlySetupVisible(false);
      break;
    case 'toggleSetup':
      setBoardOnlySetupVisible(!state.boardOnlySetupVisible);
      break;
    case 'toggleAnnotate':
      if (state.boardOnlySetupVisible || state.boardOnlyTeacherSetupActive) {
        setBoardOnlySetupVisible(false);
        state.boardOnlyTeacherSetupActive = false;
        state.setup.armedPiece = null;
      }
      setAnnotateMode(!state.annotations.enabled);
      break;
    case 'clearAnnotations':
      commitAnnotationRender(clearAllAnnotations());
      break;
    case 'flip':
      flipBoard();
      break;
    case 'reset':
      resetBoardOnlyToInitialFen();
      break;
    default:
      break;
  }
}

function applyEmbedDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fen = (params.get('fen') || '').trim();
    const embed = (params.get('embed') || '').trim();
    const boardOnly = (params.get('boardOnly') || '').trim();
    const setupPanel = (params.get('setupPanel') || 'hidden').trim();
    if (embed === '1' || embed === 'true') {
      state.embedMode = true;
      state.boardOnlyMode = boardOnly === '1' || boardOnly === 'true';
      state.boardOnlySetupVisible = state.boardOnlyMode && setupPanel === 'open';
      state.activeTab = state.boardOnlySetupVisible ? TAB_SETUP : TAB_ANALYSIS;
      state.previousNonLessonTab = TAB_ANALYSIS;
      state.toolsExpanded = state.boardOnlySetupVisible;
      document.body?.classList.add('is-embed');
      if (state.boardOnlyMode) {
        document.body?.classList.add('is-board-only');
      }
    }
    if (fen) {
      if (state.boardOnlyMode) {
        commitBoardOnlyFenInput(fen, { render: false });
        state.boardOnlyInitialFen = state.setupFen;
      } else {
        commitStrictFenInput(fen, { render: false, showError: false });
      }
    } else if (state.boardOnlyMode) {
      state.boardOnlyInitialFen = state.setupFen;
    }
    if (state.embedMode) {
      setFocusMode(true, { restoreFocus: false });
      syncBoardOnlyUi();
    }
  } catch (error) {
    console.warn('[Embed deep-link] failed to apply', error);
  }
}

function bindEmbedMessageListener() {
  window.addEventListener('message', (event) => {
    if (!state.embedMode) {
      return;
    }
    const data = event?.data;
    if (!data || typeof data !== 'object') {
      return;
    }
    if (data.type === 'loadFen' && typeof data.fen === 'string') {
      const fen = data.fen.trim();
      if (fen) {
        if (state.boardOnlyMode) {
          commitBoardOnlyFenInput(fen, { render: true });
          state.boardOnlyInitialFen = state.setupFen;
        } else {
          commitStrictFenInput(fen, { render: true, showError: false });
        }
        if (Array.isArray(data.mark)) {
          applyEmbedAnnotations(data.mark);
        }
      }
    } else if (data.type === 'setOrientation' && (data.orientation === 'black' || data.orientation === 'white')) {
      state.boardOrientation = data.orientation;
      renderBoard();
    } else if (data.type === 'setAnnotations') {
      applyEmbedAnnotations(Array.isArray(data.mark) ? data.mark : []);
    } else if ((data.type === 'teacherBoardAction' || data.type === 'boardOnlyAction') && typeof data.action === 'string') {
      handleTeacherBoardAction(data.action, data);
    }
  });
}

function applyEmbedAnnotations(marks) {
  state.annotations.paintedSquares = new Set();
  state.annotations.circledSquares = new Set();
  state.annotations.starredSquares = new Set();
  if (Array.isArray(marks)) {
    for (const sq of marks) {
      if (typeof sq === 'string' && /^[a-h][1-8]$/.test(sq)) {
        state.annotations.paintedSquares.add(sq);
      }
    }
  }
  renderBoard();
}

function initializeDefaultSetup() {
  const parsed = parseFenLike(DEFAULT_POSITION);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const sanitized = sanitizeSetupState(parsed.pieces, parsed.meta);
  state.setup.pieces = sanitized.pieces;
  state.setup.meta = sanitized.meta;
  state.setupFen = buildFenFromPiecesAndMeta(sanitized.pieces, sanitized.meta);
  state.setup.fenInput = state.setupFen;
  state.practice = createEmptyPracticeState();
  assignAnalysisTree(createEmptyAnalysisTree(state.setupFen));
  syncAnalysisGameFromTree();
}

function bindEvents() {
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('input', handleDocumentInput);
  document.addEventListener('change', handleDocumentChange);
  document.addEventListener('paste', handleDocumentPaste);
  document.addEventListener('keydown', handleDocumentKeydown);
  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', handleDocumentMouseUp);
  document.addEventListener('contextmenu', handleDocumentContextMenu, true);
  document.addEventListener('dragstart', handlePaletteDragStart);
  dom.boardGrid.addEventListener('mousedown', handleBoardMouseDown);
  dom.boardGrid.addEventListener('click', handleBoardClick);
  dom.boardGrid.addEventListener('contextmenu', handleBoardContextMenu, true);
  dom.boardGrid.addEventListener('dragstart', handleBoardDragStart);
  dom.boardGrid.addEventListener('dragover', handleBoardDragOver);
  dom.boardGrid.addEventListener('drop', handleBoardDrop);
  dom.boardGrid.addEventListener('dragleave', (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    clearBoardDragHover();
  });
  dom.boardGrid.addEventListener('dragend', handleBoardDragEnd);
  dom.promotionModal.addEventListener('click', (event) => {
    if (event.target === dom.promotionModal) {
      dismissPromotionDialog();
    }
  });
  dom.pgnGamePickerModal.addEventListener('click', (event) => {
    if (event.target === dom.pgnGamePickerModal) {
      closePgnGamePicker();
    }
  });
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('fullscreenerror', handleFullscreenError);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenerror', handleFullscreenError);
  window.addEventListener('beforeunload', () => {
    guidedReviewController?.saveReviewProgress();
    if (!state.embedMode) {
      persistDraft();
    }
    terminateEngineWorker();
    puzzleApi?.dispose();
  });
  window.addEventListener('resize', handleViewportResize);
  window.visualViewport?.addEventListener('resize', handleViewportResize);
  window.addEventListener('blur', cancelAnnotationGesture);
  syncLessonFileStatus(state.lessonFileStatus);
  setHeaderMenuOpen('lesson-book', false);
  setHeaderMenuOpen('settings', false);
}

initializeColorTheme();
initializeDefaultSetup();
applyEmbedDeepLink();
if (!state.embedMode) {
  hydrateDraft();
}
hydratePuzzleState();
// Developer helper for issuing premium activation keys from the console.
window.__endgamePuzzlePremium = Object.freeze({ generateKey: generatePremiumKey });
syncAnalysisGameFromTree();
initializeGuidedReviewController();
bindEvents();
bindEmbedMessageListener();
loadOpeningBook();
renderAll();
if (state.guidedReview.active) {
  guidedReviewController?.openGuidedReviewMode();
}
