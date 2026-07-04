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
export const PUZZLE_DIFFICULTIES = Object.freeze(['any', 'easy', 'hard']);

const MAX_PIECES_PER_SIDE = 6; // king included
const EVAL_DEPTH = 18;
const EVAL_STOP_MS = 1600;
const EVAL_HARD_TIMEOUT_MS = EVAL_STOP_MS + 4000;
// The single accepted candidate gets two deeper confirmation searches. A
// second search at a higher depth catches positions where the initial eval
// turned out to be a horizon-effect mirage.
const VERIFY_DEPTH = 24;
const VERIFY_FOLLOWUP_DEPTH = 28;
const VERIFY_STOP_MS = 4000;
const VERIFY_HARD_TIMEOUT_MS = VERIFY_STOP_MS + 4000;
const HANDSHAKE_TIMEOUT_MS = 20000;
const WIN_MIN_CP = 250;
// Above this eval, material conversion is inevitable even when the PV shows
// no capture yet; below it the PV itself must demonstrate the gain.
const WIN_CLEAR_CP = 500;
const WIN_MIN_MATERIAL_GAIN = 3; // mirrors the app's "gain a piece" success rule
const DRAW_MAX_ABS_CP = 80;
const MATE_MAX_DISTANCE = 32;
// Shallow endgame evals lie (fortress draws, wrong-bishop positions); never
// classify from anything below this depth.
const MIN_ACCEPT_DEPTH = 16;
// The best move must beat the second-best line by this margin (or be the only
// mate) for the position to count as having a clear solution.
const CLARITY_MIN_GAP_CP = 200;
// Abort an eval early once a reasonably deep score sits outside every
// acceptance band — it can only get more hopeless.
const EARLY_ABORT_MIN_DEPTH = 10;
const EARLY_ABORT_CP = 500;
const EASY_MATE_MAX_DISTANCE = 4;
const EASY_MAX_TOTAL_PIECES = 6;
// Opt-in online Syzygy probe: ground truth for small positions, at the cost
// of the fully-offline guarantee.
const TABLEBASE_ENDPOINT = 'https://tablebase.lichess.ovh/standard';
const TABLEBASE_MAX_PIECES = 7;
const TABLEBASE_TIMEOUT_MS = 4000;

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

// Net material the solver gains along an engine PV (UCI moves). Plays the PV
// out on a scratch board and stops at the first move that does not apply.
// Returns null when not even the first move applies.
export function pvMaterialGain(fen, pv, solverColor) {
  let game;
  try {
    game = new Chess(fen);
  } catch {
    return null;
  }
  const before = materialBalanceFromFen(fen, solverColor);
  let applied = 0;
  for (const uci of Array.isArray(pv) ? pv : []) {
    const text = String(uci || '');
    const move = { from: text.slice(0, 2), to: text.slice(2, 4) };
    if (text.length > 4) {
      move.promotion = text[4];
    }
    let result = null;
    try {
      result = game.move(move);
    } catch {
      break;
    }
    if (!result) {
      break;
    }
    applied += 1;
  }
  if (!applied) {
    return null;
  }
  return materialBalanceFromFen(game.fen(), solverColor) - before;
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
    const bishopShades = new Set();
    for (const piece of pieces) {
      let placed = false;
      for (let i = 0; i < 48 && !placed; i++) {
        const spot = randomSquare();
        if (piece === 'P' && (spot.rank === 0 || spot.rank === 7)) {
          continue;
        }
        const shade = (spot.file + spot.rank) % 2;
        // Same-side bishops on same-colored squares can never deliver mate or
        // win — those placements just burn verification attempts.
        if (piece === 'B' && bishopShades.has(shade)) {
          continue;
        }
        const square = squareName(spot.file, spot.rank);
        if (placement.has(square)) {
          continue;
        }
        placement.set(square, color === 'w' ? piece : piece.toLowerCase());
        if (piece === 'B') {
          bishopShades.add(shade);
        }
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
  // Reject illegal positions where either side's king is under attack by
  // the opposing side. The solver must not start in check, and the
  // position must not already be finished (mate/stalemate/insufficient).
  const solverKingSquare = squareName(solverKing.file, solverKing.rank);
  const defenderKingSquare = squareName(defenderKing.file, defenderKing.rank);
  if (game.isAttacked(solverKingSquare, defenderColor)) {
    return null; // solver is in check
  }
  if (game.isAttacked(defenderKingSquare, solverColor)) {
    return null; // solver could capture the defender's king (illegal)
  }
  if (game.isGameOver()) {
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

// A puzzle needs one clear best move. With MultiPV 2 the second-best line
// must be substantially worse: not a mate when the best move mates, or at
// least CLARITY_MIN_GAP_CP behind. No second line means an only move.
function isClearSolution(best, second) {
  if (!second || !second.type) {
    return true;
  }
  if (second.type === 'mate') {
    return second.value <= 0;
  }
  if (best.type === 'mate') {
    return true;
  }
  return best.value - second.value >= CLARITY_MIN_GAP_CP;
}

// For "win" puzzles the app's success condition is gaining material, not the
// engine's eval — so demand the PV demonstrate the gain unless the eval is
// overwhelming.
function winIsConvertible(candidate, score) {
  if (score.value >= WIN_CLEAR_CP) {
    return true;
  }
  const gain = pvMaterialGain(candidate.fen, score.pv, candidate.solverColor);
  return gain !== null && gain >= WIN_MIN_MATERIAL_GAIN;
}

function classifyCandidate(candidate, score) {
  if (!score || !score.type) {
    return null;
  }
  if (!Number.isFinite(score.depth) || score.depth < MIN_ACCEPT_DEPTH) {
    return null;
  }
  if (!isClearSolution(score, score.second)) {
    return null;
  }
  if (score.type === 'mate' && score.value > 0 && score.value <= MATE_MAX_DISTANCE) {
    return PUZZLE_OBJECTIVE_MATE;
  }
  if (score.type === 'cp' && score.value >= WIN_MIN_CP && candidate.startBalance <= 1
    && winIsConvertible(candidate, score)) {
    return PUZZLE_OBJECTIVE_WIN;
  }
  if (score.type === 'cp' && Math.abs(score.value) <= DRAW_MAX_ABS_CP && candidate.startBalance <= -1) {
    return PUZZLE_OBJECTIVE_DRAW;
  }
  return null;
}

function matchesDifficulty(objective, score, candidate, difficulty) {
  if (difficulty !== 'easy' && difficulty !== 'hard') {
    return true;
  }
  if (objective === PUZZLE_OBJECTIVE_MATE) {
    const mateIn = score.type === 'mate' ? score.value : MATE_MAX_DISTANCE;
    return difficulty === 'easy'
      ? mateIn <= EASY_MATE_MAX_DISTANCE
      : mateIn > EASY_MATE_MAX_DISTANCE;
  }
  const totalPieces = candidate.pieceCount.solver + candidate.pieceCount.defender;
  return difficulty === 'easy'
    ? totalPieces <= EASY_MAX_TOTAL_PIECES
    : totalPieces > EASY_MAX_TOTAL_PIECES;
}

// A score that can never classify, no matter how the search ends.
function isHopeless(score) {
  if (!score || !score.type) {
    return false;
  }
  if (score.type === 'mate') {
    return score.value < 0;
  }
  return score.value <= -EARLY_ABORT_CP;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('Puzzle generation was aborted.');
    error.name = 'AbortError';
    throw error;
  }
}

// Probe the lichess Syzygy tablebase. Returns the category string ('win',
// 'draw', 'loss', ...) from the solver's perspective, or null when the probe
// is unavailable (offline, rate limited, timed out).
async function probeTablebase(fen) {
  if (typeof fetch !== 'function') {
    return null;
  }
  try {
    const init = {};
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      init.signal = AbortSignal.timeout(TABLEBASE_TIMEOUT_MS);
    }
    const response = await fetch(`${TABLEBASE_ENDPOINT}?fen=${encodeURIComponent(fen)}`, init);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return typeof data?.category === 'string' ? data.category : null;
  } catch {
    return null;
  }
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
  const { resolveWorkerPath, useTablebase = false } = options;
  if (typeof resolveWorkerPath !== 'function') {
    throw new Error('createEndgamePuzzleApi requires a resolveWorkerPath() option.');
  }

  let worker = null;
  let workerReadyPromise = null;
  let evalChain = Promise.resolve();
  let puzzleCounter = 0;
  let disposed = false;
  let prefetch = null; // { key, promise, controller }

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
        // MultiPV 2 lets the classifier demand a clear gap between the best
        // and second-best move.
        instance.postMessage('setoption name MultiPV value 2');
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

  function evaluateFen(fen, evalOptions) {
    const run = evalChain.then(() => doEvaluate(fen, evalOptions));
    evalChain = run.catch(() => {});
    return run;
  }

  async function doEvaluate(fen, evalOptions = {}) {
    const {
      depth = EVAL_DEPTH,
      stopMs = EVAL_STOP_MS,
      hardMs = EVAL_HARD_TIMEOUT_MS,
    } = evalOptions;
    const engine = await ensureWorker();
    return new Promise((resolve) => {
      let lastScore = null;
      let secondScore = null;
      let lastDepth = null;
      let lastPv = [];
      let stopSent = false;
      const requestStop = () => {
        if (stopSent) {
          return;
        }
        stopSent = true;
        try {
          engine.postMessage('stop');
        } catch {
          // Worker may already be gone; the hard timeout will resolve.
        }
      };
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
          if (!scoreMatch) {
            return;
          }
          const score = { type: scoreMatch[1], value: parseInt(scoreMatch[2], 10) };
          const multipvMatch = /\bmultipv (\d+)/.exec(line);
          const pvIndex = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
          if (pvIndex === 2) {
            secondScore = score;
            return;
          }
          if (pvIndex !== 1) {
            return;
          }
          lastScore = score;
          const depthMatch = /\bdepth (\d+)/.exec(line);
          if (depthMatch) {
            lastDepth = parseInt(depthMatch[1], 10);
          }
          const pvMatch = /\bpv (.+)$/.exec(line);
          if (pvMatch) {
            lastPv = pvMatch[1].trim().split(/\s+/);
          }
          // A clearly lost line can never classify — stop burning time on it.
          if (lastDepth !== null && lastDepth >= EARLY_ABORT_MIN_DEPTH && isHopeless(lastScore)) {
            requestStop();
          }
          return;
        }
        if (line.startsWith('bestmove ')) {
          const bestMove = line.split(/\s+/)[1] || '';
          finish(lastScore ? {
            ...lastScore,
            depth: lastDepth,
            pv: lastPv,
            second: secondScore,
            bestMove: bestMove === '(none)' ? '' : bestMove,
          } : null);
        }
      };
      const stopTimer = setTimeout(requestStop, stopMs);
      const hardTimer = setTimeout(() => {
        // The engine may still be searching; its stale bestmove would desync
        // the next eval in the chain, so recycle the worker entirely and let
        // ensureWorker lazily restart it.
        finish(null);
        teardownWorker();
      }, hardMs);
      engine.addEventListener('message', onMessage);
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage(`go depth ${depth}`);
    });
  }

  // Confirm an accepted candidate. Uses the Syzygy tablebase as ground truth
  // when enabled and applicable; otherwise runs two deeper engine searches and
  // requires the classification to hold at both depths. This catches positions
  // where the first confirmation search happened to miss a refutation that only
  // becomes visible at higher depth (horizon-effect mirages).
  async function verifyCandidate(candidate, matched, score, signal) {
    const totalPieces = candidate.pieceCount.solver + candidate.pieceCount.defender;
    if (useTablebase && totalPieces <= TABLEBASE_MAX_PIECES) {
      const category = await probeTablebase(candidate.fen);
      throwIfAborted(signal);
      if (category) {
        const needed = matched === PUZZLE_OBJECTIVE_DRAW ? 'draw' : 'win';
        return category === needed ? score : null;
      }
      // Probe unavailable — fall through to engine verification.
    }
    const verified = await evaluateFen(candidate.fen, {
      depth: VERIFY_DEPTH,
      stopMs: VERIFY_STOP_MS,
      hardMs: VERIFY_HARD_TIMEOUT_MS,
    });
    throwIfAborted(signal);
    if (classifyCandidate(candidate, verified) !== matched) {
      return null;
    }
    // Follow-up search at higher depth. If the evaluation collapses at the
    // deeper limit the position was a mirage — reject it.
    const followUp = await evaluateFen(candidate.fen, {
      depth: VERIFY_FOLLOWUP_DEPTH,
      stopMs: VERIFY_STOP_MS,
      hardMs: VERIFY_HARD_TIMEOUT_MS,
    });
    throwIfAborted(signal);
    return classifyCandidate(candidate, followUp) === matched ? followUp : null;
  }

  function makePuzzle(candidate, objective, score, requestedObjective) {
    puzzleCounter += 1;
    return {
      id: `endgame-${Date.now()}-${puzzleCounter}`,
      fen: candidate.fen,
      objective,
      requestedObjective,
      isFallback: requestedObjective !== 'random' && objective !== requestedObjective,
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

  async function generateFresh(requestOptions = {}) {
    const {
      objective = 'random',
      maxAttempts = 48,
      difficulty = 'any',
      signal = null,
      onAttempt = null,
    } = requestOptions;
    const randomRequested = !PUZZLE_OBJECTIVES.includes(objective);
    const target = randomRequested ? pickRandom(PUZZLE_OBJECTIVES) : objective;
    const requestedObjective = randomRequested ? 'random' : objective;
    let fallback = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      throwIfAborted(signal);
      if (disposed) {
        throw new Error('The puzzle API has been disposed.');
      }
      if (typeof onAttempt === 'function') {
        try {
          onAttempt({ attempt: attempt + 1, maxAttempts });
        } catch {
          // Progress reporting must never break generation.
        }
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
      throwIfAborted(signal);
      const matched = classifyCandidate(candidate, score);
      if (!matched) {
        continue;
      }
      if (!matchesDifficulty(matched, score, candidate, difficulty)) {
        continue;
      }
      const confirmed = await verifyCandidate(candidate, matched, score, signal);
      if (!confirmed) {
        continue;
      }
      const puzzle = makePuzzle(candidate, matched, confirmed, requestedObjective);
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

  function requestKeyOf(requestOptions = {}) {
    const objective = PUZZLE_OBJECTIVES.includes(requestOptions.objective)
      ? requestOptions.objective
      : 'random';
    const difficulty = PUZZLE_DIFFICULTIES.includes(requestOptions.difficulty)
      ? requestOptions.difficulty
      : 'any';
    return `${objective}:${difficulty}`;
  }

  function cancelPrefetch() {
    if (prefetch) {
      prefetch.controller.abort();
      prefetch = null;
    }
  }

  // Start generating a puzzle in the background so the next generatePuzzle()
  // call with the same objective/difficulty resolves instantly.
  function prefetchPuzzle(requestOptions = {}) {
    if (disposed) {
      return;
    }
    const key = requestKeyOf(requestOptions);
    if (prefetch?.key === key) {
      return;
    }
    cancelPrefetch();
    const controller = new AbortController();
    const promise = generateFresh({ ...requestOptions, signal: controller.signal })
      .catch(() => null);
    prefetch = { key, promise, controller };
  }

  // Generate one verified puzzle. `objective` may be 'mate', 'win', 'draw'
  // or 'random'; `difficulty` may be 'any', 'easy' or 'hard'. Accepts an
  // AbortSignal as `signal` and a progress callback as `onAttempt`. Resolves
  // with the puzzle object (served from the prefetch cache when one matches),
  // or rejects when no valid puzzle could be produced within the attempt
  // budget.
  async function generatePuzzle(requestOptions = {}) {
    const key = requestKeyOf(requestOptions);
    if (prefetch && prefetch.key === key) {
      const pending = prefetch;
      prefetch = null;
      const puzzle = await pending.promise;
      if (puzzle) {
        return puzzle;
      }
    } else {
      // A stale prefetch only competes with this request for the worker.
      cancelPrefetch();
    }
    return generateFresh(requestOptions);
  }

  function dispose() {
    disposed = true;
    cancelPrefetch();
    teardownWorker();
  }

  return { generatePuzzle, prefetchPuzzle, dispose };
}
