// Integration test for puzzle-api.mjs with a stubbed Stockfish worker.
// Run with: node tools/test-puzzle-api.mjs
import { Chess } from '../vendor/chess.js';
import { createEndgamePuzzleApi, materialBalanceFromFen } from '../puzzle-api.mjs';

const sentFens = [];
let scoreLine = 'info depth 18 score cp 0 pv e2e4';

class FakeWorker {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type, data) {
    for (const fn of [...(this.listeners.get(type) || [])]) {
      fn({ data });
    }
  }
  postMessage(msg) {
    const text = String(msg);
    if (text === 'isready') {
      queueMicrotask(() => this.emit('message', 'readyok'));
    } else if (text.startsWith('position fen ')) {
      this.lastFen = text.slice('position fen '.length);
      sentFens.push(this.lastFen);
    } else if (text.startsWith('go ')) {
      queueMicrotask(() => {
        this.emit('message', scoreLine);
        this.emit('message', 'bestmove e2e4');
      });
    }
  }
  terminate() {}
}
globalThis.Worker = FakeWorker;

const api = createEndgamePuzzleApi({
  resolveWorkerPath: async () => './vendor/stockfish/stockfish-18-lite-single.js',
});

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`ok   ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label} ${detail}`);
  }
}

function validateCandidateFen(fen) {
  let game;
  try {
    game = new Chess(fen);
  } catch (error) {
    return `unparseable fen: ${fen} (${error.message})`;
  }
  const board = fen.split(/\s+/)[0];
  const mover = fen.split(/\s+/)[1];
  const whitePieces = (board.match(/[KQRBNP]/g) || []).length;
  const blackPieces = (board.match(/[kqrbnp]/g) || []).length;
  if (whitePieces > 6 || blackPieces > 6) {
    return `too many pieces (${whitePieces}w/${blackPieces}b): ${fen}`;
  }
  if ((board.match(/K/g) || []).length !== 1 || (board.match(/k/g) || []).length !== 1) {
    return `bad king count: ${fen}`;
  }
  const ranks = board.split('/');
  if (/[Pp]/.test(ranks[0]) || /[Pp]/.test(ranks[7])) {
    return `pawn on back rank: ${fen}`;
  }
  // The side NOT to move must not be capturable-in-check.
  const defender = mover === 'w' ? 'b' : 'w';
  let defenderKingSquare = '';
  for (const square of game.board().flat()) {
    if (square && square.type === 'k' && square.color === defender) {
      defenderKingSquare = square.square;
    }
  }
  if (!defenderKingSquare) {
    return `defender king missing: ${fen}`;
  }
  if (game.isAttacked(defenderKingSquare, mover)) {
    return `defender in pseudo-check (illegal): ${fen}`;
  }
  if (game.isCheck()) {
    return `solver starts in check: ${fen}`;
  }
  if (game.isGameOver()) {
    return `position already finished: ${fen}`;
  }
  return '';
}

// 1. Mate objective with a mate score reply.
scoreLine = 'info depth 18 score mate 4 pv e2e4 e7e5';
const matePuzzle = await api.generatePuzzle({ objective: 'mate' });
check('mate puzzle objective', matePuzzle.objective === 'mate', JSON.stringify(matePuzzle));
check('mate puzzle mateIn', matePuzzle.mateIn === 4);
check('mate puzzle evalLabel', matePuzzle.evalLabel === '#4');
check('mate puzzle solver matches fen turn', matePuzzle.fen.split(/\s+/)[1] === matePuzzle.solverColor);

// 2. Win objective with a winning cp score.
scoreLine = 'info depth 18 score cp 412 pv e2e4';
const winPuzzle = await api.generatePuzzle({ objective: 'win' });
check('win puzzle objective', winPuzzle.objective === 'win', JSON.stringify(winPuzzle));
check('win puzzle startBalance <= 1', winPuzzle.startBalance <= 1, String(winPuzzle.startBalance));
check('win puzzle balance matches helper', materialBalanceFromFen(winPuzzle.fen, winPuzzle.solverColor) === winPuzzle.startBalance);

// 3. Draw objective with a balanced score.
scoreLine = 'info depth 18 score cp -12 pv e2e4';
const drawPuzzle = await api.generatePuzzle({ objective: 'draw' });
check('draw puzzle objective', drawPuzzle.objective === 'draw', JSON.stringify(drawPuzzle));
check('draw puzzle solver is down material', drawPuzzle.startBalance <= -1, String(drawPuzzle.startBalance));

// 4. Random objective resolves to something valid.
scoreLine = 'info depth 18 score mate 2 pv e2e4';
const randomPuzzle = await api.generatePuzzle({ objective: 'random' });
check('random puzzle has valid objective', ['mate', 'win', 'draw'].includes(randomPuzzle.objective), randomPuzzle.objective);

// 5a. Force a full attempt budget so dozens of candidates get validated:
// a hopeless score never classifies, so generatePuzzle must throw.
scoreLine = 'info depth 18 score cp -5000 pv e2e4';
let threw = false;
try {
  await api.generatePuzzle({ objective: 'mate' });
} catch {
  threw = true;
}
check('unusable scores exhaust attempts and reject', threw);

// 5. Every candidate FEN the engine ever saw must be a legal, in-budget endgame.
let fenProblems = 0;
for (const fen of sentFens) {
  const problem = validateCandidateFen(fen);
  if (problem) {
    fenProblems += 1;
    console.error(`  candidate problem: ${problem}`);
  }
}
check(`all ${sentFens.length} candidate FENs legal and within limits`, fenProblems === 0);

// 6. materialBalanceFromFen sanity.
check('material balance KQ vs K', materialBalanceFromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'w') === 9);
check('material balance K vs KP (black solver)', materialBalanceFromFen('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1', 'b') === -1);

api.dispose();
console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
