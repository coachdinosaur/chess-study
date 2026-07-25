import { Chess } from './vendor/chess.js';

const STORAGE_KEY = 'lichess-position-training-learning-v1';
const MAX_REVIEW_ITEMS = 120;
const MIN_ADAPTIVE_RATING = 400;
const MAX_ADAPTIVE_RATING = 3000;
const NON_INSTRUCTIONAL_THEMES = new Set([
  'short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM',
]);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function defaultState() {
  return {
    adaptiveRating: 1400,
    totalHints: 0,
    review: {},
    themes: {},
  };
}

function normalizeThemes(puzzle) {
  const themes = Array.isArray(puzzle?.themes) ? puzzle.themes.map(String).filter(Boolean) : [];
  const useful = themes.filter((theme) => !NON_INSTRUCTIONAL_THEMES.has(theme));
  return useful.length ? useful : themes.slice(0, 2);
}

function portablePuzzle(puzzle) {
  return {
    id: String(puzzle?.id || ''),
    sourceFen: String(puzzle?.sourceFen || ''),
    startFen: String(puzzle?.startFen || ''),
    repairMove: String(puzzle?.repairMove || ''),
    losingMoverColor: puzzle?.losingMoverColor,
    solverColor: puzzle?.solverColor,
    rating: Number.isFinite(Number(puzzle?.rating)) ? Number(puzzle.rating) : null,
    popularity: Number.isFinite(Number(puzzle?.popularity)) ? Number(puzzle.popularity) : null,
    themes: Array.isArray(puzzle?.themes) ? puzzle.themes.map(String).filter(Boolean) : [],
    gameUrl: String(puzzle?.gameUrl || ''),
    openingTags: Array.isArray(puzzle?.openingTags) ? puzzle.openingTags.map(String).filter(Boolean) : [],
  };
}

function moveToSan(fen, uci) {
  const normalized = String(uci || '').trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) return '';
  try {
    const game = new Chess(fen);
    const move = game.move({
      from: normalized.slice(0, 2),
      to: normalized.slice(2, 4),
      promotion: normalized[4] || undefined,
    });
    return move?.san || normalized;
  } catch {
    return normalized;
  }
}

function accuracy(row) {
  return row?.attempts ? row.solved / row.attempts : 0;
}

function ensureLearningStyles() {
  if (typeof document === 'undefined' || document.getElementById('position-training-learning-styles')) return;
  const style = document.createElement('style');
  style.id = 'position-training-learning-styles';
  style.textContent = `
    .position-training-learning-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; }
    .position-training-learning-metric { padding: .58rem; border: 1px solid var(--section-divider-soft); border-radius: var(--radius-card, 8px); background: var(--panel-strong); text-align: center; }
    .position-training-learning-metric strong { display: block; font-size: 1.15rem; }
    .position-training-learning-metric span { color: var(--text-muted); font-size: .74rem; }
    .position-training-review-button { width: 100%; margin-top: .65rem; }
    .position-training-explanation { margin-top: .75rem; padding: .85rem 1rem; border: 1px solid var(--banner-success-border); border-radius: var(--radius-panel, 12px); background: color-mix(in srgb, var(--banner-success-bg) 82%, var(--card-bg) 18%); color: var(--text); }
    .position-training-explanation[hidden] { display: none; }
    .position-training-explanation h3 { margin: 0 0 .35rem; font-family: var(--font-display); }
    .position-training-explanation p { margin: 0; line-height: 1.45; }
    .position-training-explanation ul { margin: .55rem 0 0; padding-left: 1.15rem; }
    .position-training-explanation li + li { margin-top: .25rem; }
    .position-training-theme-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
    .position-training-theme-table th, .position-training-theme-table td { padding: .35rem .25rem; border-bottom: 1px solid var(--section-divider-soft); text-align: left; }
    .position-training-theme-table th:last-child, .position-training-theme-table td:last-child { text-align: right; }
    .position-training-theme-empty { color: var(--text-muted); font-size: .82rem; }
    .position-training-mode-note { margin: .55rem 0 0; color: var(--text-muted); font-size: .78rem; line-height: 1.35; }
    .position-training-square.hinted-target { box-shadow: inset 0 0 0 clamp(3px, .6vw, 5px) var(--focus-border); }
    .position-training-square.hinted-from::before { content: ''; position: absolute; inset: 10%; z-index: 1; border: 3px dashed var(--accent-strong); border-radius: 50%; pointer-events: none; }
    @media (max-width: 520px) { .position-training-learning-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

export class PositionTrainingLearning {
  constructor({ storage = globalThis.localStorage, now = () => Date.now() } = {}) {
    this.storage = storage;
    this.now = now;
    this.state = this.#load();
    this.attempt = null;
  }

  #load() {
    const stored = this.storage?.getItem?.(STORAGE_KEY);
    const parsed = safeParse(stored, {});
    return {
      ...defaultState(),
      ...parsed,
      review: parsed.review && typeof parsed.review === 'object' ? parsed.review : {},
      themes: parsed.themes && typeof parsed.themes === 'object' ? parsed.themes : {},
      adaptiveRating: clamp(parsed.adaptiveRating || 1400, MIN_ADAPTIVE_RATING, MAX_ADAPTIVE_RATING),
    };
  }

  #save() {
    this.storage?.setItem?.(STORAGE_KEY, JSON.stringify(this.state));
  }

  effectiveFilters(prefs = {}) {
    const theme = prefs.theme === 'weakest' ? (this.weakestTheme() || 'any') : (prefs.theme || 'any');
    if (prefs.difficultyMode !== 'adaptive') {
      return { ...prefs, theme };
    }
    const target = this.state.adaptiveRating;
    return {
      ...prefs,
      theme,
      minRating: clamp(target - 250, MIN_ADAPTIVE_RATING, MAX_ADAPTIVE_RATING),
      maxRating: clamp(target + 250, MIN_ADAPTIVE_RATING, MAX_ADAPTIVE_RATING),
    };
  }

  beginPuzzle(puzzle, { reviewMode = false } = {}) {
    const themes = normalizeThemes(puzzle);
    this.attempt = {
      puzzleId: puzzle?.id || '',
      reviewMode,
      mistakes: 0,
      hints: 0,
      startedAt: this.now(),
      themes,
    };
    for (const theme of themes) {
      const row = this.state.themes[theme] || { attempts: 0, solved: 0, mistakes: 0, hints: 0 };
      row.attempts += 1;
      this.state.themes[theme] = row;
    }
    this.#save();
  }

  nextHint({ puzzle, bestMove, objectiveText = '', humanTheme = (value) => value } = {}) {
    if (!this.attempt || this.attempt.puzzleId !== puzzle?.id) this.beginPuzzle(puzzle);
    this.attempt.hints = Math.min(4, this.attempt.hints + 1);
    this.state.totalHints += 1;
    for (const theme of this.attempt.themes) this.state.themes[theme].hints += 1;
    this.#save();

    const level = this.attempt.hints;
    const move = String(bestMove || '').trim().toLowerCase();
    const from = /^[a-h][1-8]/.test(move) ? move.slice(0, 2) : '';
    const to = /^[a-h][1-8][a-h][1-8]/.test(move) ? move.slice(2, 4) : '';
    const themes = normalizeThemes(puzzle).slice(0, 3).map(humanTheme).filter(Boolean);
    const motif = themes.length ? themes.join(', ') : 'forcing moves, loose pieces, and king safety';

    if (level === 1) {
      return { level, from: '', to: '', text: `${objectiveText || 'Preserve the objective.'} Focus on ${motif}.` };
    }
    if (level === 2) {
      return { level, from, to: '', text: from ? `The critical candidate begins with the highlighted piece on ${from}.` : `Identify the piece that best serves ${motif}.` };
    }
    if (level === 3) {
      return { level, from, to, text: to ? `The critical destination is ${to}. Calculate the consequences before moving.` : 'Calculate the most forcing destination for the highlighted piece.' };
    }
    const san = moveToSan(puzzle?.startFen, move);
    return { level, from, to, text: san ? `Full reveal: the engine's leading candidate is ${san}. Other moves may still preserve the objective.` : 'No reliable engine candidate is available for a full reveal.' };
  }

  recordMistake({ puzzle, moveSan = '', reason = '' } = {}) {
    if (!this.attempt || this.attempt.puzzleId !== puzzle?.id) this.beginPuzzle(puzzle);
    this.attempt.mistakes += 1;
    this.state.adaptiveRating = clamp(this.state.adaptiveRating - 18, MIN_ADAPTIVE_RATING, MAX_ADAPTIVE_RATING);
    for (const theme of this.attempt.themes) this.state.themes[theme].mistakes += 1;

    const id = String(puzzle?.id || '');
    if (id) {
      const previous = this.state.review[id] || { mistakes: 0, mastery: 0 };
      this.state.review[id] = {
        ...previous,
        puzzle: portablePuzzle(puzzle),
        mistakes: previous.mistakes + 1,
        mastery: 0,
        lastMove: moveSan,
        lastReason: reason,
        lastMistakeAt: this.now(),
        dueAt: this.now(),
      };
      const entries = Object.entries(this.state.review)
        .sort((left, right) => Number(right[1]?.lastMistakeAt || 0) - Number(left[1]?.lastMistakeAt || 0));
      this.state.review = Object.fromEntries(entries.slice(0, MAX_REVIEW_ITEMS));
    }
    this.#save();
  }

  recordSolved({ puzzle, moveSan = '', objectiveText = '', verdictReason = '', bestMove = '' } = {}) {
    if (!this.attempt || this.attempt.puzzleId !== puzzle?.id) this.beginPuzzle(puzzle);
    for (const theme of this.attempt.themes) this.state.themes[theme].solved += 1;

    const clean = this.attempt.mistakes === 0;
    const independent = clean && this.attempt.hints === 0;
    const delta = independent ? 55 : (clean ? 20 : -5);
    this.state.adaptiveRating = clamp(this.state.adaptiveRating + delta, MIN_ADAPTIVE_RATING, MAX_ADAPTIVE_RATING);

    const id = String(puzzle?.id || '');
    const reviewEntry = id ? this.state.review[id] : null;
    if (reviewEntry) {
      const mastery = this.attempt.reviewMode && independent ? Number(reviewEntry.mastery || 0) + 1 : 0;
      if (mastery >= 2) {
        delete this.state.review[id];
      } else {
        const delay = mastery === 1 ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
        this.state.review[id] = {
          ...reviewEntry,
          mastery,
          lastSolvedAt: this.now(),
          dueAt: this.now() + delay,
        };
      }
    }

    const explanation = this.buildSuccessExplanation({
      puzzle,
      moveSan,
      objectiveText,
      verdictReason,
      bestMove,
      mistakes: this.attempt.mistakes,
      hints: this.attempt.hints,
    });
    this.#save();
    return explanation;
  }

  buildSuccessExplanation({ puzzle, moveSan, objectiveText, verdictReason, bestMove, mistakes = 0, hints = 0 } = {}) {
    const themes = normalizeThemes(puzzle);
    const motif = themes.length ? themes.slice(0, 3).join(', ') : 'position objective';
    const engineSan = moveToSan(puzzle?.startFen, bestMove);
    const sameAsEngine = Boolean(engineSan && moveSan && engineSan.replace(/[+#]/g, '') === String(moveSan).replace(/[+#]/g, ''));
    const comparison = engineSan
      ? (sameAsEngine ? `${moveSan} matched the engine's leading candidate.` : `${moveSan} was a valid alternative; the engine's initial candidate was ${engineSan}.`)
      : `${moveSan || 'The move'} preserved the required result.`;
    const assistance = mistakes
      ? `You used ${hints} hint${hints === 1 ? '' : 's'} and made ${mistakes} rejected move${mistakes === 1 ? '' : 's'}. This position remains in Mistake Review until it is mastered cleanly.`
      : (hints
        ? `You solved with ${hints} hint${hints === 1 ? '' : 's'}, so the adaptive rating rises modestly rather than receiving full independent-solve credit.`
        : 'Solved independently on the first accepted attempt, so the adaptive difficulty will rise slightly.');
    return {
      title: 'Why the solution worked',
      summary: `${verdictReason || 'The move preserved the objective'} The central motif was ${motif}.`,
      bullets: [
        `Objective: ${objectiveText || 'preserve the required result'}.`,
        comparison,
        assistance,
      ],
    };
  }

  buildMistakeExplanation({ puzzle, moveSan, reason } = {}) {
    const themes = normalizeThemes(puzzle);
    return {
      title: 'Why the move was rejected',
      summary: `${moveSan || 'That move'} failed the position objective. ${reason || ''}`.trim(),
      bullets: [
        `Recheck ${themes.slice(0, 3).join(', ') || 'forcing moves and opponent resources'}.`,
        'The position has been added to Mistake Review.',
        'Use progressive hints only as needed; lower hint use produces stronger mastery credit.',
      ],
    };
  }

  nextReview() {
    const entries = Object.values(this.state.review);
    if (!entries.length) return null;
    const now = this.now();
    entries.sort((left, right) => {
      const leftDue = Number(left?.dueAt || 0) <= now ? 0 : 1;
      const rightDue = Number(right?.dueAt || 0) <= now ? 0 : 1;
      return leftDue - rightDue || Number(left?.dueAt || 0) - Number(right?.dueAt || 0);
    });
    return entries[0]?.puzzle || null;
  }

  reviewCount() {
    return Object.keys(this.state.review).length;
  }

  weakestTheme() {
    const rows = Object.entries(this.state.themes).filter(([, row]) => Number(row?.attempts || 0) > 0);
    rows.sort((left, right) => {
      const leftScore = accuracy(left[1]) - Math.min(0.45, Number(left[1]?.mistakes || 0) / Math.max(1, Number(left[1]?.attempts || 0)) * 0.2);
      const rightScore = accuracy(right[1]) - Math.min(0.45, Number(right[1]?.mistakes || 0) / Math.max(1, Number(right[1]?.attempts || 0)) * 0.2);
      return leftScore - rightScore || Number(right[1]?.attempts || 0) - Number(left[1]?.attempts || 0);
    });
    return rows[0]?.[0] || '';
  }

  dashboard(limit = 6) {
    return Object.entries(this.state.themes)
      .filter(([, row]) => Number(row?.attempts || 0) > 0)
      .map(([theme, row]) => ({
        theme,
        attempts: Number(row.attempts || 0),
        solved: Number(row.solved || 0),
        mistakes: Number(row.mistakes || 0),
        hints: Number(row.hints || 0),
        accuracy: accuracy(row),
      }))
      .sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts)
      .slice(0, limit);
  }

  adaptiveRating() {
    return this.state.adaptiveRating;
  }

  hintLevel() {
    return this.attempt?.hints || 0;
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }
}

ensureLearningStyles();
