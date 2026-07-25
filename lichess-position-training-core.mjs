import { Chess } from './vendor/chess.js';

export const TRAINING_OBJECTIVE_WIN = 'win';
export const TRAINING_OBJECTIVE_DRAW = 'draw';

export function oppositeColor(color) {
  return color === 'b' ? 'w' : 'b';
}

export function normalizeUciMove(value) {
  const text = String(value || '').trim().toLowerCase();
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text) ? text : '';
}

export function uciToMove(uci) {
  const normalized = normalizeUciMove(uci);
  if (!normalized) return null;
  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    promotion: normalized[4] || undefined,
  };
}

export function moveToUci(move) {
  if (!move?.from || !move?.to) return '';
  return `${move.from}${move.to}${move.promotion || ''}`.toLowerCase();
}

export function countPieces(fen) {
  const board = String(fen || '').split(' ')[0] || '';
  return [...board].filter((char) => /[prnbqk]/i.test(char)).length;
}

export function materialBalanceForColor(gameOrFen, color) {
  const game = typeof gameOrFen === 'string' ? new Chess(gameOrFen) : gameOrFen;
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let white = 0;
  let black = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      if (piece.color === 'w') white += values[piece.type] || 0;
      else black += values[piece.type] || 0;
    }
  }
  return color === 'b' ? black - white : white - black;
}

export function prepareLichessTrainingPuzzle(record) {
  const sourceFen = String(record?.sourceFen || record?.fen || '').trim();
  if (!sourceFen) throw new Error('Puzzle is missing a source FEN.');

  const rawMoves = Array.isArray(record?.moves)
    ? record.moves
    : String(record?.moves || record?.solution || '').trim().split(/\s+/).filter(Boolean);
  const repairMove = normalizeUciMove(record?.repairMove || rawMoves[0]);
  if (!repairMove) throw new Error('Puzzle is missing the losing side\'s repair move.');

  const game = new Chess(sourceFen);
  const losingMoverColor = game.turn();
  const move = uciToMove(repairMove);
  const applied = game.move(move);
  if (!applied) throw new Error(`Illegal repair move: ${repairMove}`);

  const solverColor = game.turn();
  if (solverColor === losingMoverColor) {
    throw new Error('Repair move did not pass the turn to the solver.');
  }

  return Object.freeze({
    id: String(record?.id || record?.puzzleId || '').trim() || `position-${Date.now()}`,
    sourceFen,
    startFen: game.fen(),
    repairMove,
    repairSan: applied.san,
    losingMoverColor,
    solverColor,
    rating: Number.isFinite(Number(record?.rating)) ? Number(record.rating) : null,
    popularity: Number.isFinite(Number(record?.popularity)) ? Number(record.popularity) : null,
    themes: Array.isArray(record?.themes)
      ? record.themes.map(String).filter(Boolean)
      : String(record?.themes || '').trim().split(/\s+/).filter(Boolean),
    gameUrl: String(record?.gameUrl || '').trim(),
    openingTags: Array.isArray(record?.openingTags)
      ? record.openingTags.map(String).filter(Boolean)
      : String(record?.openingTags || '').trim().split(/\s+/).filter(Boolean),
  });
}

export function engineScoreForSolver(score, sideToMove, solverColor) {
  if (!score || !['cp', 'mate'].includes(score.type)) return null;
  const numeric = Number(score.value);
  if (!Number.isFinite(numeric)) return null;
  const multiplier = sideToMove === solverColor ? 1 : -1;
  return { type: score.type, value: numeric * multiplier };
}

export function tablebaseOutcomeForSolver(category, sideToMove, solverColor) {
  const normalized = String(category || '').toLowerCase();
  if (!['win', 'loss', 'draw', 'cursed-win', 'blessed-loss'].includes(normalized)) return 'unknown';
  if (normalized === 'draw' || normalized === 'cursed-win' || normalized === 'blessed-loss') return 'draw';

  const sideToMoveWins = normalized === 'win';
  const solverIsSideToMove = sideToMove === solverColor;
  const solverWins = sideToMoveWins === solverIsSideToMove;
  return solverWins ? 'win' : 'loss';
}

export function deriveTrainingObjective(evaluation) {
  if (evaluation?.outcome === 'win') return TRAINING_OBJECTIVE_WIN;
  if (evaluation?.outcome === 'draw') return TRAINING_OBJECTIVE_DRAW;
  if (evaluation?.outcome === 'loss') return null;

  const score = evaluation?.solverScore;
  if (!score) return null;
  if (score.type === 'mate') return score.value > 0 ? TRAINING_OBJECTIVE_WIN : null;
  if (score.value >= 120) return TRAINING_OBJECTIVE_WIN;
  if (score.value >= -60) return TRAINING_OBJECTIVE_DRAW;
  return null;
}

function numericWinningScore(score) {
  if (!score) return -Infinity;
  if (score.type === 'mate') return score.value > 0 ? 100000 - Math.min(9999, Math.abs(score.value)) : -100000;
  return Number(score.value);
}

export function classifyStudentMove({ objective, baseline, afterMove }) {
  if (afterMove?.outcome === 'loss') {
    return { accepted: false, grade: 'mistake', reason: 'The move gives up the training objective.' };
  }
  if (objective === TRAINING_OBJECTIVE_DRAW) {
    if (afterMove?.outcome === 'win') {
      return { accepted: true, grade: 'excellent', reason: 'The move improves the draw into a win.' };
    }
    if (afterMove?.outcome === 'draw') {
      return { accepted: true, grade: 'good', reason: 'The move preserves the draw.' };
    }
    const score = afterMove?.solverScore;
    const value = numericWinningScore(score);
    if (value >= -80) {
      return { accepted: true, grade: value >= 80 ? 'excellent' : 'good', reason: 'The position remains safe.' };
    }
    return { accepted: false, grade: 'mistake', reason: 'The move turns the drawable position into a loss.' };
  }

  if (afterMove?.outcome === 'win') {
    return { accepted: true, grade: 'good', reason: 'The move preserves the win.' };
  }
  if (afterMove?.outcome === 'draw') {
    return { accepted: false, grade: 'mistake', reason: 'The move throws away the win.' };
  }

  const beforeValue = numericWinningScore(baseline?.solverScore);
  const afterValue = numericWinningScore(afterMove?.solverScore);
  if (afterValue < 100) {
    return { accepted: false, grade: 'mistake', reason: 'The move no longer preserves a clear win.' };
  }
  const drop = Math.max(0, beforeValue - afterValue);
  if (drop <= 120) {
    return { accepted: true, grade: 'excellent', reason: 'The move keeps nearly all of the advantage.' };
  }
  if (drop <= 300 || afterValue >= 300) {
    return { accepted: true, grade: 'good', reason: 'The move remains winning, although a cleaner continuation existed.' };
  }
  return { accepted: true, grade: 'inaccuracy', reason: 'The move remains winning but makes conversion harder.' };
}

export function isTrainingSolved({ game, objective, solverColor, solverMoves, startMaterial, evaluation, themes = [] }) {
  if (game.isCheckmate()) {
    return game.turn() !== solverColor;
  }
  if (game.isDraw()) {
    return objective === TRAINING_OBJECTIVE_DRAW;
  }
  const requiresCheckmate = themes.some((theme) => theme === 'mate' || /^mateIn\d+$/.test(theme));
  if (requiresCheckmate) {
    return false;
  }
  if (objective === TRAINING_OBJECTIVE_DRAW) {
    return solverMoves >= 4 && (evaluation?.outcome === 'draw' || numericWinningScore(evaluation?.solverScore) >= -40);
  }

  if (solverMoves < 2) return false;
  const currentMaterial = materialBalanceForColor(game, solverColor);
  const materialGain = currentMaterial - startMaterial;
  const score = numericWinningScore(evaluation?.solverScore);
  return (materialGain >= 3 && score >= 150) || score >= 600 || (evaluation?.outcome === 'win' && solverMoves >= 4);
}
