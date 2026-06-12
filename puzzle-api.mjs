// Endgame Puzzle API
// Generates random, Stockfish-verified endgame puzzles entirely in the browser.
// Each puzzle has at most 6 pieces per side (kings included) and one of three
// objectives for the side to move (the solver):
//   - 'mate'  : deliver checkmate
//   - 'win'   : win material ("gain a piece")
//   - 'draw'  : hold the draw from a materially worse position
// The API owns a dedicated Stockfish worker so it never interferes with the
// app's analysis/play engine.

import { Chess } from './vendor/chess.js';

export const PUZZLE_OBJECTIVE_MATE = 'mate';
export const PUZZLE_OBJECTIVE_WIN = 'win';
export const PUZZLE_OBJECTIVE_DRAW = 'draw';
export const PUZZLE_OBJECTIVES = Object.freeze([
  PUZZLE_OBJECTIVE_MATE,
  PUZZLE_OBJECTIVE_WIN,
  PUZZLE_OBJECTIVE_DRAW,
]);

const MAX_PIECES_PER_SIDE = 6; // king included
const EVAL_DEPTH = 18;
const EVAL_STOP_MS = 1600;
const EVAL_HARD_TIMEOUT_MS = EVAL_STOP_MS + 4000;
const HANDSHAKE_TIMEOUT_MS = 20000;
const WIN_MIN_CP = 250;
const DRAW_MAX_ABS_CP = 80;
const MATE_MAX_DISTANCE = 32;

const PIECE_VALUES = Object.freeze({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 });
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Piece sets (beyond the king) biased toward each objective. The classifier
// has the final say; these only raise the acceptance rate.
const MATE_TEMPLATES = [
  { solver: ['Q'], defender: [] },
  { solver: ['R'], defender: [] },
  { solver: ['Q'], defender: ['N'] },
  { solver: ['Q'], defender: ['B'] },
  { solver: ['Q'], defender: ['P'] },
  { solver: ['R', 'R'], defender: [] },
  { solver: ['R', 'R'], defender: ['P'] },
  { solver: ['Q', 'R'], defender: ['R'] },
  { solver: ['Q', 'N'], defender: ['P', 'P'] },
  { solver: ['Q', 'P'], defender: ['R'] },
  { solver: ['B', 'B'], defender: [] },
  { solver: ['R', 'B'], defender: ['N'] },
];
const WIN_TEMPLATES = [
  { solver: ['Q'], defender: ['Q'] },
  { solver: ['Q', 'P'], defender: ['Q', 'P'] },
  { solver: ['R', 'N'], defender: ['R', 'N'] },
  { solver: ['R', 'B'], defender: ['R', 'N'] },
  { solver: ['R', 'R'], defender: ['R', 'R'] },
  { solver: ['R', 'P', 'P'], defender: ['R', 'P', 'P'] },
  { solver: ['B', 'N', 'P'], defender: ['B', 'N', 'P'] },
  { solver: ['R', 'B', 'P'], defender: ['R', 'N', 'P'] },
  { solver: ['R', 'N', 'P'], defender: ['R', 'B', 'P'] },
  { solver: ['N', 'N', 'P'], defender: ['B', 'P', 'P'] },
  { solver: ['Q', 'N'], defender: ['Q', 'B'] },
];
const DRAW_TEMPLATES = [
  { solver: [], defender: ['P'] },
  { solver: ['B'], defender: ['R'] },
  { solver: ['N'], defender: ['R'] },
  { solver: ['R'], defender: ['R', 'P'] },
  { solver: ['B'], defender: ['B', 'P'] },
  { solver: ['N'], defender: ['N', 'P'] },
  { solver: ['B'], defender: ['N', 'P'] },
  { solver: ['N', 'P'], defender: ['R', 'P'] },
  { solver: ['B', 'P'], defender: ['R', 'P'] },
];
const TEMPLATES_BY_OBJECTIVE = Object.freeze({
  [PUZZLE_OBJECTIVE_MATE]: MATE_TEMPLATES,
  [PUZZLE_OBJECTIVE_WIN]: WIN_TEMPLATES,
  [PUZZLE_OBJECTIVE_DRAW]: DRAW_TEMPLATES,
});

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function squareName(file, rank) {
  return `${FILES[file]}${rank + 1}`;
}

function randomSquare() {
  return { file: Math.floor(Math.random() * 8), rank: Math.floor(Math.random() * 8) };
}

function randomRimSquare() {
  const spot = randomSquare();
  const axis = Math.random() < 0.5 ? 'file' : 'rank';
  spot[axis] = Math.random() < 0.5 ? 0 : 7;
  return spot;
}

function kingsAdjacent(a, b) {
  return Math.abs(a.file - b.file) <= 1 && Math.abs(a.rank - b.rank) <= 1;
}

function materialPoints(pieces) {
  return pieces.reduce((sum, piece) => sum + (PIECE_VALUES[piece.toLowerCase()] || 0), 0);
}

export function materialBalanceFromFen(fen, solverColor) {
  const board = String(fen || '').split(/\s+/)[0] || '';
  let white = 0;
  let black = 0;
  for (const ch of board) {
    const value = PIECE_VALUES[ch.toLowerCase()];
    if (!value) {
      continue;
    }
    if (ch === ch.toUpperCase()) {
      white += value;
    } else {
      black += value;
    }
  }
  return solverColor === 'w' ? white - black : black - white;
}

function buildFenFromPlacement(placement, sideToMove) {
  const rows = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = placement.get(squareName(file, rank));
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
  return `${rows.join('/')} ${sideToMove} - - 0 1`;
}

// Attempt to place a template on the board. Returns a candidate {fen, ...}
// or null when the random placement turned out illegal/unusable.
function buildCandidate(templateObjective, solverColor) {
  const template = pickRandom(TEMPLATES_BY_OBJECTIVE[templateObjective] || WIN_TEMPLATES);
  if (template.solver.length + 1 > MAX_PIECES_PER_SIDE
    || template.defender.length + 1 > MAX_PIECES_PER_SIDE) {
    return null;
  }
  const defenderColor = solverColor === 'w' ? 'b' : 'w';

  // Mating nets are far more common with the defending king near the rim.
  const biasDefenderToRim = templateObjective === PUZZLE_OBJECTIVE_MATE && Math.random() < 0.7;
  const defenderKing = biasDefenderToRim ? randomRimSquare() : randomSquare();
  let solverKing = null;
  for (let i = 0; i < 32 && !solverKing; i++) {
    const spot = randomSquare();
    if (!kingsAdjacent(spot, defenderKing)) {
      solverKing = spot;
    }
  }
  if (!solverKing) {
    return null;
  }

  const placement = new Map();
  const occupy = (spot, piece) => placement.set(squareName(spot.file, spot.rank), piece);
  occupy(defenderKing, defenderColor === 'w' ? 'K' : 'k');
  occupy(solverKing, solverColor === 'w' ? 'K' : 'k');

  const placeSet = (pieces, color) => {
    for (const piece of pieces) {
      let placed = false;
      for (let i = 0; i < 48 && !placed; i++) {
        const spot = randomSquare();
        if (piece === 'P' && (spot.rank === 0 || spot.rank === 7)) {
          continue;
        }
        const square = squareName(spot.file, spot.rank);
        if (placement.has(square)) {
          continue;
        }
        placement.set(square, color === 'w' ? piece : piece.toLowerCase());
        placed = true;
      }
      if (!placed) {
        return false;
      }
    }
    return true;
  };
  if (!placeSet(template.solver, solverColor) || !placeSet(template.defender, defenderColor)) {
    return null;
  }

  const fen = buildFenFromPlacement(placement, solverColor);
  let game;
  try {
    game = new Chess(fen);
  } catch {
    return null;
  }
  // Illegal: the side to move could capture the defender's king.
  const defenderKingSquare = squareName(defenderKing.file, defenderKing.rank);
  if (game.isAttacked(defenderKingSquare, solverColor)) {
    return null;
  }
  // Keep puzzles clean: the solver should not start in check, and the
  // position must not already be finished (mate/stalemate/insufficient).
  if (game.isCheck() || game.isGameOver()) {
    return null;
  }

  return {
    fen,
    solverColor,
    startBalance: materialPoints(template.solver) - materialPoints(template.defender),
    pieceCount: {
      solver: template.solver.length + 1,
      defender: template.defender.length + 1,
    },
  };
}

function classifyScore(startBalance, score) {
  if (!score || !score.type) {
    return null;
  }
  if (score.type === 'mate' && score.value > 0 && score.value <= MATE_MAX_DISTANCE) {
    return PUZZLE_OBJECTIVE_MATE;
  }
  if (score.type === 'cp' && score.value >= WIN_MIN_CP && startBalance <= 1) {
    return PUZZLE_OBJECTIVE_WIN;
  }
  if (score.type === 'cp' && Math.abs(score.value) <= DRAW_MAX_ABS_CP && startBalance <= -1) {
    return PUZZLE_OBJECTIVE_DRAW;
  }
  return null;
}

function formatEvalLabel(score) {
  if (!score || !score.type) {
    return '';
  }
  if (score.type === 'mate') {
    return `#${score.value}`;
  }
  return (score.value / 100).toFixed(2);
}

export function createEndgamePuzzleApi(options = {}) {
  const { resolveWorkerPath } = options;
  if (typeof resolveWorkerPath !== 'function') {
    throw new Error('createEndgamePuzzleApi requires a resolveWorkerPath() option.');
  }

  let worker = null;
  let workerReadyPromise = null;
  let evalChain = Promise.resolve();
  let puzzleCounter = 0;
  let disposed = false;

  function teardownWorker() {
    if (worker) {
      try {
        worker.terminate();
      } catch {
        // Ignore termination errors.
      }
    }
    worker = null;
    workerReadyPromise = null;
  }

  async function ensureWorker() {
    if (disposed) {
      throw new Error('The puzzle API has been disposed.');
    }
    if (workerReadyPromise) {
      return workerReadyPromise;
    }
    workerReadyPromise = (async () => {
      const workerPath = await resolveWorkerPath();
      const instance = new Worker(new URL(workerPath, import.meta.url));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('Puzzle engine timed out while loading.'));
        }, HANDSHAKE_TIMEOUT_MS);
        const onMessage = (event) => {
          const line = String(event?.data ?? '');
          if (line.startsWith('readyok')) {
            cleanup();
            resolve();
          }
        };
        const onError = (event) => {
          cleanup();
          reject(new Error(event?.message || 'Puzzle engine worker failed to start.'));
        };
        const cleanup = () => {
          clearTimeout(timer);
          instance.removeEventListener('message', onMessage);
          instance.removeEventListener('error', onError);
        };
        instance.addEventListener('message', onMessage);
        instance.addEventListener('error', onError);
        instance.postMessage('uci');
        instance.postMessage('setoption name MultiPV value 1');
        instance.postMessage('isready');
      });
      worker = instance;
      return instance;
    })();
    try {
      return await workerReadyPromise;
    } catch (error) {
      teardownWorker();
      throw error;
    }
  }

  function evaluateFen(fen) {
    const run = evalChain.then(() => doEvaluate(fen));
    evalChain = run.catch(() => {});
    return run;
  }

  async function doEvaluate(fen) {
    const engine = await ensureWorker();
    return new Promise((resolve) => {
      let lastScore = null;
      let lastDepth = null;
      let lastPv = [];
      const finish = (result) => {
        clearTimeout(stopTimer);
        clearTimeout(hardTimer);
        engine.removeEventListener('message', onMessage);
        resolve(result);
      };
      const onMessage = (event) => {
        const line = String(event?.data ?? '');
        if (line.startsWith('info ') && !/\b(?:lowerbound|upperbound)\b/.test(line)) {
          const scoreMatch = /\bscore (cp|mate) (-?\d+)/.exec(line);
          if (scoreMatch) {
            lastScore = { type: scoreMatch[1], value: parseInt(scoreMatch[2], 10) };
          }
          const depthMatch = /\bdepth (\d+)/.exec(line);
          if (depthMatch) {
            lastDepth = parseInt(depthMatch[1], 10);
          }
          const pvMatch = /\bpv (.+)$/.exec(line);
          if (pvMatch) {
            lastPv = pvMatch[1].trim().split(/\s+/);
          }
          return;
        }
        if (line.startsWith('bestmove ')) {
          const bestMove = line.split(/\s+/)[1] || '';
          finish(lastScore ? {
            ...lastScore,
            depth: lastDepth,
            pv: lastPv,
            bestMove: bestMove === '(none)' ? '' : bestMove,
          } : null);
        }
      };
      const stopTimer = setTimeout(() => {
        try {
          engine.postMessage('stop');
        } catch {
          // Worker may already be gone; the hard timeout will resolve.
        }
      }, EVAL_STOP_MS);
      const hardTimer = setTimeout(() => finish(null), EVAL_HARD_TIMEOUT_MS);
      engine.addEventListener('message', onMessage);
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage(`go depth ${EVAL_DEPTH}`);
    });
  }

  function makePuzzle(candidate, objective, score) {
    puzzleCounter += 1;
    return {
      id: `endgame-${Date.now()}-${puzzleCounter}`,
      fen: candidate.fen,
      objective,
      solverColor: candidate.solverColor,
      startBalance: candidate.startBalance,
      pieceCount: candidate.pieceCount,
      scoreType: score.type,
      scoreValue: score.value,
      mateIn: score.type === 'mate' ? score.value : null,
      evalLabel: formatEvalLabel(score),
      bestMoveUci: score.bestMove || '',
      bestLineUci: Array.isArray(score.pv) ? score.pv.slice(0, 8) : [],
      depth: score.depth ?? null,
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate one verified puzzle. `objective` may be 'mate', 'win', 'draw'
  // or 'random'. Resolves with the puzzle object, or rejects when no valid
  // puzzle could be produced within the attempt budget.
  async function generatePuzzle(requestOptions = {}) {
    const { objective = 'random', maxAttempts = 48 } = requestOptions;
    const randomRequested = !PUZZLE_OBJECTIVES.includes(objective);
    const target = randomRequested ? pickRandom(PUZZLE_OBJECTIVES) : objective;
    let fallback = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (disposed) {
        throw new Error('The puzzle API has been disposed.');
      }
      const solverColor = Math.random() < 0.5 ? 'w' : 'b';
      // Mostly aim at the target objective, but sample the others now and
      // then so a fallback puzzle is usually available.
      const templateObjective = attempt % 5 === 4 ? pickRandom(PUZZLE_OBJECTIVES) : target;
      const candidate = buildCandidate(templateObjective, solverColor);
      if (!candidate) {
        continue;
      }
      const score = await evaluateFen(candidate.fen);
      const matched = classifyScore(candidate.startBalance, score);
      if (!matched) {
        continue;
      }
      const puzzle = makePuzzle(candidate, matched, score);
      if (matched === target || randomRequested) {
        return puzzle;
      }
      if (!fallback) {
        fallback = puzzle;
      }
      if (attempt >= Math.floor(maxAttempts * 0.6)) {
        return fallback;
      }
    }
    if (fallback) {
      return fallback;
    }
    throw new Error('Could not generate a valid endgame puzzle. Please try again.');
  }

  function dispose() {
    disposed = true;
    teardownWorker();
  }

  return { generatePuzzle, dispose };
}
