import { Chess } from './vendor/chess.js';
import {
  countPieces,
  engineScoreForSolver,
  tablebaseOutcomeForSolver,
} from './lichess-position-training-core.mjs';

const TABLEBASE_ENDPOINT = 'https://tablebase.lichess.org/standard';
const ENGINE_CANDIDATES = [
  './vendor/stockfish/stockfish-18-lite-single.js',
  './vendor/stockfish/stockfish-18-single.js',
];

function withTimeout(promise, milliseconds, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseInfoLine(line) {
  if (!line.startsWith('info ') || !line.includes(' score ')) return null;
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (!scoreMatch) return null;
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const pvMatch = line.match(/\bpv\s+(.+)$/);
  return {
    depth: depthMatch ? Number(depthMatch[1]) : 0,
    score: { type: scoreMatch[1], value: Number(scoreMatch[2]) },
    pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : [],
  };
}

export class StockfishPositionEvaluator {
  constructor() {
    this.worker = null;
    this.readyPromise = null;
    this.pending = null;
    this.enginePath = '';
  }

  async ensureReady() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.#startWorker().catch((error) => {
      this.readyPromise = null;
      throw error;
    });
    return this.readyPromise;
  }

  async #startWorker() {
    let lastError = null;
    for (const path of ENGINE_CANDIDATES) {
      let worker = null;
      try {
        worker = new Worker(new URL(path, import.meta.url));
        await this.#initializeWorker(worker);
        this.worker = worker;
        this.enginePath = path;
        return;
      } catch (error) {
        worker?.terminate();
        lastError = error;
      }
    }
    throw lastError || new Error('Stockfish could not be started.');
  }

  #initializeWorker(worker) {
    return withTimeout(new Promise((resolve, reject) => {
      let uciOk = false;
      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };
      const onError = (event) => {
        cleanup();
        worker.terminate();
        reject(event.error || new Error('Stockfish worker failed.'));
      };
      const onMessage = (event) => {
        const line = String(event.data || '').trim();
        if (line === 'uciok') {
          uciOk = true;
          worker.postMessage('setoption name Threads value 1');
          worker.postMessage('setoption name Hash value 32');
          worker.postMessage('setoption name MultiPV value 1');
          worker.postMessage('isready');
        } else if (line === 'readyok' && uciOk) {
          cleanup();
          worker.addEventListener('message', (messageEvent) => this.#handleMessage(messageEvent));
          worker.addEventListener('error', () => this.#rejectPending(new Error('Stockfish worker stopped.')));
          resolve();
        }
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage('uci');
    }), 15000, 'Stockfish initialization timed out.');
  }

  #handleMessage(event) {
    if (!this.pending) return;
    const line = String(event.data || '').trim();
    const parsed = parseInfoLine(line);
    if (parsed && parsed.depth >= this.pending.latest.depth) {
      this.pending.latest = parsed;
    }
    if (!line.startsWith('bestmove ')) return;

    const match = line.match(/^bestmove\s+(\S+)/);
    const bestMove = match && match[1] !== '(none)' ? match[1] : '';
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve({
      bestMove,
      score: pending.latest.score,
      depth: pending.latest.depth,
      pv: pending.latest.pv,
    });
  }

  #rejectPending(error) {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  async analyse(fen, { movetime = 700 } = {}) {
    await this.ensureReady();
    if (this.pending) {
      this.worker.postMessage('stop');
      this.#rejectPending(new Error('Stockfish search was replaced by a newer request.'));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.worker?.postMessage('stop');
        this.#rejectPending(new Error('Stockfish analysis timed out.'));
      }, Math.max(5000, movetime + 5000));
      this.pending = {
        resolve,
        reject,
        timer,
        latest: { depth: 0, score: null, pv: [] },
      };
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${Math.max(100, Math.round(movetime))}`);
    });
  }

  dispose() {
    this.#rejectPending(new Error('Position trainer closed.'));
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
  }
}

async function fetchTablebase(fen) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${TABLEBASE_ENDPOINT}?fen=${encodeURIComponent(fen)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Tablebase request failed (${response.status}).`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export class PositionTrainingEvaluator {
  constructor() {
    this.stockfish = new StockfishPositionEvaluator();
  }

  async evaluate(fen, solverColor, options = {}) {
    const game = new Chess(fen);
    const sideToMove = game.turn();

    if (countPieces(fen) <= 7) {
      try {
        const data = await fetchTablebase(fen);
        const outcome = tablebaseOutcomeForSolver(data.category, sideToMove, solverColor);
        const solverScore = {
          type: 'cp',
          value: outcome === 'win' ? 10000 : outcome === 'loss' ? -10000 : 0,
        };
        return {
          source: 'tablebase',
          outcome,
          solverScore,
          category: data.category,
          dtz: Number.isFinite(Number(data.dtz)) ? Number(data.dtz) : null,
          bestMove: Array.isArray(data.moves) && data.moves[0]?.uci ? data.moves[0].uci : '',
        };
      } catch {
        // Network-free use should still work through the bundled engine.
      }
    }

    const result = await this.stockfish.analyse(fen, options);
    const solverScore = engineScoreForSolver(result.score, sideToMove, solverColor);
    let outcome = 'unknown';
    if (solverScore?.type === 'mate') outcome = solverScore.value > 0 ? 'win' : 'loss';
    else if (solverScore?.value >= 120) outcome = 'win';
    else if (solverScore?.value <= -120) outcome = 'loss';
    else if (solverScore) outcome = 'draw';

    return {
      source: 'stockfish',
      outcome,
      solverScore,
      bestMove: result.bestMove,
      depth: result.depth,
      pv: result.pv,
    };
  }

  async bestReply(fen, options = {}) {
    const result = await this.stockfish.analyse(fen, options);
    return result.bestMove;
  }

  dispose() {
    this.stockfish.dispose();
  }
}
