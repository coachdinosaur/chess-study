// Integration test for puzzle-api.mjs with a stubbed Stockfish worker.
// Run with: node tools/test-puzzle-api.mjs
import { Chess } from '../vendor/chess.js';
import { createEndgamePuzzleApi, materialBalanceFromFen, pvMaterialGain } from '../puzzle-api.mjs';

const sentFens = [];
let goCount = 0;
// A string or an array of strings emitted as info lines before bestmove.
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
      goCount += 1;
      queueMicrotask(() => {
        for (const line of Array.isArray(scoreLine) ? scoreLine : [scoreLine]) {
          this.emit('message', line);
        }
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
  // Same-side bishop pairs must sit on opposite-colored squares.
  for (const bishopChar of ['B', 'b']) {
    const shades = new Set();
    for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
      let file = 0;
      for (const ch of ranks[rankIndex]) {
        if (/\d/.test(ch)) {
          file += parseInt(ch, 10);
          continue;
        }
        if (ch === bishopChar) {
          shades.add((file + (7 - rankIndex)) % 2);
        }
        file += 1;
      }
    }
    if ((board.split(bishopChar).length - 1) >= 2 && shades.size < 2) {
      return `same-shade bishop pair (${bishopChar}): ${fen}`;
    }
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

// 1. Mate objective with a mate score reply; onAttempt reports progress.
scoreLine = 'info depth 18 score mate 4 pv e2e4 e7e5';
const attemptsSeen = [];
const matePuzzle = await api.generatePuzzle({
  objective: 'mate',
  onAttempt: (info) => attemptsSeen.push(info.attempt),
});
check('mate puzzle objective', matePuzzle.objective === 'mate', JSON.stringify(matePuzzle));
check('mate puzzle mateIn', matePuzzle.mateIn === 4);
check('mate puzzle evalLabel', matePuzzle.evalLabel === '#4');
check('mate puzzle solver matches fen turn', matePuzzle.fen.split(/\s+/)[1] === matePuzzle.solverColor);
check('mate puzzle not a fallback', matePuzzle.isFallback === false && matePuzzle.requestedObjective === 'mate');
check('onAttempt reported progress', attemptsSeen.length >= 1 && attemptsSeen[0] === 1, JSON.stringify(attemptsSeen));

// 2. Win objective: a clearly winning score with a clear MultiPV gap.
scoreLine = [
  'info depth 18 multipv 1 score cp 612 pv e2e4',
  'info depth 18 multipv 2 score cp 80 pv d2d4',
];
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
check('random puzzle never flagged as fallback', randomPuzzle.isFallback === false && randomPuzzle.requestedObjective === 'random');

// 5. Requesting 'win' while the engine only finds mates yields a flagged
// fallback puzzle instead of failing or silently lying.
scoreLine = 'info depth 18 score mate 2 pv e2e4';
const fallbackPuzzle = await api.generatePuzzle({ objective: 'win' });
check('fallback puzzle delivered as mate', fallbackPuzzle.objective === 'mate', fallbackPuzzle.objective);
check('fallback puzzle flagged', fallbackPuzzle.isFallback === true && fallbackPuzzle.requestedObjective === 'win');

// 6. Shallow evals are never trusted, regardless of score.
scoreLine = 'info depth 8 score mate 3 pv e2e4';
let shallowThrew = false;
try {
  await api.generatePuzzle({ objective: 'mate', maxAttempts: 6 });
} catch {
  shallowThrew = true;
}
check('shallow eval rejected by depth gate', shallowThrew);

// 7. Ambiguous best move (second line within the clarity gap) is rejected.
scoreLine = [
  'info depth 18 multipv 1 score cp 612 pv e2e4',
  'info depth 18 multipv 2 score cp 540 pv d2d4',
];
let ambiguousThrew = false;
try {
  await api.generatePuzzle({ objective: 'win', maxAttempts: 6 });
} catch {
  ambiguousThrew = true;
}
check('ambiguous best move rejected', ambiguousThrew);

// 8. A modest cp edge with no demonstrable material gain is not a win puzzle.
scoreLine = 'info depth 18 score cp 412 pv e2e4';
let unconvertibleThrew = false;
try {
  await api.generatePuzzle({ objective: 'win', maxAttempts: 6 });
} catch {
  unconvertibleThrew = true;
}
check('unconvertible "win" eval rejected', unconvertibleThrew);

// 9. Difficulty filter on mate distance.
scoreLine = 'info depth 18 score mate 6 pv e2e4';
const hardMate = await api.generatePuzzle({ objective: 'mate', difficulty: 'hard' });
check('hard difficulty accepts a long mate', hardMate.mateIn === 6, String(hardMate.mateIn));
let easyThrew = false;
try {
  await api.generatePuzzle({ objective: 'mate', difficulty: 'easy', maxAttempts: 6 });
} catch {
  easyThrew = true;
}
check('easy difficulty rejects a long mate', easyThrew);

// 10. AbortSignal cancels generation.
const abortController = new AbortController();
abortController.abort();
let abortName = '';
try {
  await api.generatePuzzle({ objective: 'mate', signal: abortController.signal });
} catch (error) {
  abortName = error.name;
}
check('aborted generation rejects with AbortError', abortName === 'AbortError', abortName);

// 11. Prefetched puzzles are served without new engine searches.
scoreLine = 'info depth 18 score cp -12 pv e2e4';
api.prefetchPuzzle({ objective: 'draw' });
await new Promise((resolve) => setTimeout(resolve, 0));
const goCountBefore = goCount;
const prefetchedPuzzle = await api.generatePuzzle({ objective: 'draw' });
check('prefetched puzzle served', prefetchedPuzzle.objective === 'draw', prefetchedPuzzle.objective);
check('prefetched puzzle used no extra searches', goCount === goCountBefore, `${goCountBefore} -> ${goCount}`);

// 12a. Force a full attempt budget so dozens of candidates get validated:
// a hopeless score never classifies, so generatePuzzle must throw.
scoreLine = 'info depth 18 score cp -5000 pv e2e4';
let threw = false;
try {
  await api.generatePuzzle({ objective: 'mate' });
} catch {
  threw = true;
}
check('unusable scores exhaust attempts and reject', threw);

// 12b. Every candidate FEN the engine ever saw must be a legal, in-budget endgame.
let fenProblems = 0;
for (const fen of sentFens) {
  const problem = validateCandidateFen(fen);
  if (problem) {
    fenProblems += 1;
    console.error(`  candidate problem: ${problem}`);
  }
}
check(`all ${sentFens.length} candidate FENs legal and within limits`, fenProblems === 0);

// 13. materialBalanceFromFen sanity.
check('material balance KQ vs K', materialBalanceFromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'w') === 9);
check('material balance K vs KP (black solver)', materialBalanceFromFen('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1', 'b') === -1);

// 14. pvMaterialGain follows the PV on a scratch board.
const pvFen = '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1';
check('pvMaterialGain counts a queen capture', pvMaterialGain(pvFen, ['d2d5'], 'w') === 9, String(pvMaterialGain(pvFen, ['d2d5'], 'w')));
check('pvMaterialGain null for inapplicable pv', pvMaterialGain(pvFen, ['h2h4'], 'w') === null);

// 15. Opt-in Syzygy tablebase probe overrides the engine verdict for small
// positions (every draw template fits under the 7-piece limit).
let fetchCalls = 0;
let tbCategory = 'win';
globalThis.fetch = async () => {
  fetchCalls += 1;
  return { ok: true, json: async () => ({ category: tbCategory }) };
};
const tbApi = createEndgamePuzzleApi({
  resolveWorkerPath: async () => './vendor/stockfish/stockfish-18-lite-single.js',
  useTablebase: true,
});
scoreLine = 'info depth 18 score cp -12 pv e2e4';
tbCategory = 'win'; // ground truth contradicts the engine's "draw"
let tbThrew = false;
try {
  await tbApi.generatePuzzle({ objective: 'draw', maxAttempts: 8 });
} catch {
  tbThrew = true;
}
check('tablebase contradiction rejects candidates', tbThrew && fetchCalls > 0, `threw=${tbThrew} fetches=${fetchCalls}`);
tbCategory = 'draw';
const tbPuzzle = await tbApi.generatePuzzle({ objective: 'draw' });
check('tablebase confirmation accepts draw puzzle', tbPuzzle.objective === 'draw', tbPuzzle.objective);
tbApi.dispose();
delete globalThis.fetch;

api.dispose();
console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
