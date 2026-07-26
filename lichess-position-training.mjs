import { Chess } from './vendor/chess.js';
import {
  TRAINING_OBJECTIVE_DRAW,
  classifyStudentMove,
  deriveTrainingObjective,
  isTrainingSolved,
  materialBalanceForColor,
  prepareLichessTrainingPuzzle,
  uciToMove,
} from './lichess-position-training-core.mjs';
import { PositionTrainingEvaluator } from './lichess-position-training-engine.mjs';
import { LichessPositionTrainingDataSource } from './lichess-position-training-data.mjs';
import { PositionTrainingLearning } from './lichess-position-training-learning.mjs';

const STYLE_URL = './lichess-position-training-desktop-fit.css?v=20260726-library-count1';
const STATS_KEY = 'lichess-position-training-stats-v1';
const PREFS_KEY = 'lichess-position-training-prefs-v1';
const HISTORY_KEY = 'lichess-position-training-history-v1';
const HISTORY_MAX = 200;
const PUZZLE_COUNT_FORMATTER = new Intl.NumberFormat('en-US');

const PIECE_ASSETS = Object.freeze({
  w: Object.freeze({
    k: './assets/pieces/mpchess/wK.svg',
    q: './assets/pieces/mpchess/wQ.svg',
    r: './assets/pieces/mpchess/wR.svg',
    b: './assets/pieces/mpchess/wB.svg',
    n: './assets/pieces/mpchess/wN.svg',
    p: './assets/pieces/mpchess/wP.svg',
  }),
  b: Object.freeze({
    k: './assets/pieces/mpchess/bK.svg',
    q: './assets/pieces/mpchess/bQ.svg',
    r: './assets/pieces/mpchess/bR.svg',
    b: './assets/pieces/mpchess/bB.svg',
    n: './assets/pieces/mpchess/bN.svg',
    p: './assets/pieces/mpchess/bP.svg',
  }),
});

const PIECE_NAMES = Object.freeze({
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
});

function pieceImageMarkup(color, type, className) {
  const src = PIECE_ASSETS[color]?.[type];
  if (!src) return '';
  return `<img class="${className}" src="${src}" alt="" draggable="false">`;
}

const THEME_LABELS = Object.freeze({
  endgame: 'Endgame conversion',
  mate: 'Checkmating attack',
  mateIn1: 'Mate in one',
  mateIn2: 'Mate in two',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  sacrifice: 'Sacrifice',
  defensiveMove: 'Defensive move',
  promotion: 'Promotion',
  discoveredAttack: 'Discovered attack',
  attraction: 'Attraction',
  deflection: 'Deflection',
  clearance: 'Clearance',
});

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadStats() {
  return {
    started: 0,
    solved: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
    ...safeJsonParse(localStorage.getItem(STATS_KEY), {}),
  };
}

function loadPrefs() {
  return {
    difficultyMode: 'adaptive',
    minRating: 800,
    maxRating: 2400,
    theme: 'any',
    ...safeJsonParse(localStorage.getItem(PREFS_KEY), {}),
  };
}

function saveHistory(entry) {
  const history = safeJsonParse(localStorage.getItem(HISTORY_KEY), []);
  const next = Array.isArray(history) ? history : [];
  next.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, HISTORY_MAX)));
}

function colorName(color) {
  return color === 'b' ? 'Black' : 'White';
}

function objectiveLabel(objective) {
  return objective === TRAINING_OBJECTIVE_DRAW ? 'Hold the position' : 'Convert the advantage';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureStyles() {
  if (document.querySelector('link[href^="./lichess-position-training.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  document.head.appendChild(link);
}

function boardSquares(orientation) {
  const files = orientation === 'b' ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = orientation === 'b' ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

function humanTheme(theme) {
  return THEME_LABELS[theme] || String(theme || '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

class PositionTrainingController {
  constructor() {
    this.dataSource = new LichessPositionTrainingDataSource();
    this.evaluator = new PositionTrainingEvaluator();
    this.learning = new PositionTrainingLearning();
    this.stats = loadStats();
    this.prefs = loadPrefs();
    this.game = null;
    this.current = null;
    this.objective = null;
    this.turnBaseline = null;
    this.initialBaseline = null;
    this.startMaterial = 0;
    this.solverMoves = 0;
    this.selectedSquare = '';
    this.hintSquare = '';
    this.hintFrom = '';
    this.hintTo = '';
    this.hintLevel = 0;
    this.explanation = null;
    this.reviewMode = false;
    this.lastAcceptedMove = '';
    this.lastVerdict = null;
    this.pendingPromotion = null;
    this.busy = false;
    this.libraryCount = null;
    this.libraryCountStatus = 'loading';
    this.libraryMetadataPromise = null;
    this.completed = false;
    this.feedback = { kind: 'info', text: 'Choose a position to begin.' };
    this.overlay = null;
    this.board = null;
    this.boundKeydown = (event) => this.#handleKeydown(event);
  }

  ensureOverlay() {
    if (this.overlay) return;
    const overlay = document.createElement('div');
    overlay.className = 'position-training-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="position-training-dialog" role="dialog" aria-modal="true" aria-labelledby="positionTrainingTitle">
        <header class="position-training-header">
          <div>
            <p class="position-training-eyebrow">Separate puzzle mode</p>
            <h2 id="positionTrainingTitle">Lichess Position Training</h2>
            <p class="position-training-library-count" data-pt-library-count data-state="loading" aria-live="polite">Loading puzzle library…</p>
          </div>
          <button type="button" class="position-training-icon-button" data-pt-action="close" aria-label="Close position training">×</button>
        </header>
        <div class="position-training-content">
          <main class="position-training-main">
            <div class="position-training-board-wrap">
              <div class="position-training-board" data-pt-board aria-label="Chessboard"></div>
              <div class="position-training-promotion" data-pt-promotion hidden></div>
            </div>
            <div class="position-training-feedback info" data-pt-feedback aria-live="polite"></div>
            <section class="position-training-explanation" data-pt-explanation hidden></section>
            <div class="position-training-actions">
              <button type="button" data-pt-action="hint">Hint 1 of 4</button>
              <button type="button" data-pt-action="reset">Reset position</button>
              <button type="button" class="primary" data-pt-action="next">Next position</button>
            </div>
          </main>
          <aside class="position-training-sidebar">
            <section class="position-training-card">
              <h3>Current objective</h3>
              <div data-pt-current></div>
            </section>
            <section class="position-training-card">
              <h3>Filters</h3>
              <label>Difficulty
                <select data-pt-pref="difficultyMode">
                  <option value="adaptive">Adaptive</option>
                  <option value="fixed">Fixed range</option>
                </select>
              </label>
              <label>Minimum rating
                <input type="number" min="400" max="3200" step="100" data-pt-pref="minRating">
              </label>
              <label>Maximum rating
                <input type="number" min="400" max="3200" step="100" data-pt-pref="maxRating">
              </label>
              <label>Theme
                <select data-pt-pref="theme">
                  <option value="any">Any theme</option>
                  <option value="weakest">Weakest theme</option>
                  <option value="endgame">Endgame</option>
                  <option value="mate">Mate</option>
                  <option value="fork">Fork</option>
                  <option value="pin">Pin</option>
                  <option value="skewer">Skewer</option>
                  <option value="sacrifice">Sacrifice</option>
                  <option value="defensiveMove">Defence</option>
                  <option value="promotion">Promotion</option>
                </select>
              </label>
            </section>
            <section class="position-training-card">
              <h3>Separate statistics</h3>
              <div class="position-training-stats" data-pt-stats></div>
            </section>
            <section class="position-training-card">
              <h3>Learning progress</h3>
              <div data-pt-learning></div>
              <button type="button" class="position-training-review-button" data-pt-action="review">Review mistakes</button>
              <p class="position-training-mode-note" data-pt-mode-note></p>
            </section>
            <section class="position-training-card">
              <h3>Theme performance</h3>
              <div data-pt-theme-dashboard></div>
            </section>
          </aside>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.board = overlay.querySelector('[data-pt-board]');
    overlay.addEventListener('click', (event) => this.#handleClick(event));
    overlay.addEventListener('change', (event) => this.#handlePreferenceChange(event));
    this.#syncPreferenceInputs();
    this.render();
  }

  async open() {
    this.ensureOverlay();
    this.loadLibraryMetadata();
    this.overlay.hidden = false;
    document.body.classList.add('position-training-open');
    document.addEventListener('keydown', this.boundKeydown);
    if (!this.current) await this.loadNext();
  }

  async loadLibraryMetadata() {
    if (this.libraryCountStatus === 'ready') {
      this.#renderLibraryCount();
      return this.libraryCount;
    }
    if (this.libraryMetadataPromise) return this.libraryMetadataPromise;

    this.libraryCountStatus = 'loading';
    this.#renderLibraryCount();
    this.libraryMetadataPromise = this.dataSource.initialize()
      .then((manifest) => {
        const declaredCount = Number(manifest?.count);
        const shardCount = Array.isArray(manifest?.shards)
          ? manifest.shards.reduce((total, shard) => total + Math.max(0, Number(shard?.count) || 0), 0)
          : 0;
        this.libraryCount = Number.isFinite(declaredCount) && declaredCount > 0 ? declaredCount : shardCount;
        this.libraryCountStatus = this.libraryCount > 0 ? 'ready' : 'unavailable';
        return this.libraryCount;
      })
      .catch(() => {
        this.libraryCount = null;
        this.libraryCountStatus = 'unavailable';
        return null;
      })
      .finally(() => {
        this.libraryMetadataPromise = null;
        this.#renderLibraryCount();
      });
    return this.libraryMetadataPromise;
  }

  close() {
    if (!this.overlay) return;
    this.overlay.hidden = true;
    document.body.classList.remove('position-training-open');
    document.removeEventListener('keydown', this.boundKeydown);
  }

  async loadNext() {
    if (this.busy) return;
    this.busy = true;
    this.completed = false;
    this.selectedSquare = '';
    this.hintSquare = '';
    this.hintFrom = '';
    this.hintTo = '';
    this.hintLevel = 0;
    this.explanation = null;
    this.lastAcceptedMove = '';
    this.lastVerdict = null;
    this.pendingPromotion = null;
    this.feedback = { kind: 'info', text: 'Loading and validating a position…' };
    this.render();

    try {
      let accepted = null;
      const reviewRecord = this.reviewMode ? this.learning.nextReview() : null;
      if (this.reviewMode && !reviewRecord) {
        this.reviewMode = false;
        throw new Error('No saved mistakes are available for review.');
      }
      const effectiveFilters = this.learning.effectiveFilters(this.prefs);
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const raw = reviewRecord || await this.dataSource.next(effectiveFilters);
        let prepared;
        try {
          prepared = prepareLichessTrainingPuzzle(raw);
        } catch {
          continue;
        }
        const baseline = await this.evaluator.evaluate(prepared.startFen, prepared.solverColor, { movetime: 650 });
        const objective = deriveTrainingObjective(baseline);
        if (!objective) continue;
        accepted = { prepared, baseline, objective };
        break;
      }
      if (!accepted) throw new Error('No valid position was found after checking the available records.');

      this.current = accepted.prepared;
      this.game = new Chess(this.current.startFen);
      this.objective = accepted.objective;
      this.turnBaseline = accepted.baseline;
      this.initialBaseline = accepted.baseline;
      this.startMaterial = materialBalanceForColor(this.game, this.current.solverColor);
      this.solverMoves = 0;
      this.learning.beginPuzzle(this.current, { reviewMode: this.reviewMode });
      this.stats.started += 1;
      this.#saveStats();
      this.feedback = {
        kind: 'info',
        text: `${colorName(this.current.solverColor)} to move. ${objectiveLabel(this.objective)} against dynamic defence.`,
      };
    } catch (error) {
      this.feedback = { kind: 'danger', text: error.message || 'The next position could not be loaded.' };
    } finally {
      this.busy = false;
      this.render();
    }
  }

  async resetCurrent() {
    if (!this.current || this.busy) return;
    this.game = new Chess(this.current.startFen);
    this.turnBaseline = this.initialBaseline;
    this.solverMoves = 0;
    this.selectedSquare = '';
    this.hintSquare = '';
    this.hintFrom = '';
    this.hintTo = '';
    this.explanation = null;
    this.pendingPromotion = null;
    this.completed = false;
    this.feedback = { kind: 'info', text: 'Position reset. Find your own continuation.' };
    this.render();
  }

  async toggleReviewMode() {
    if (this.busy) return;
    if (!this.learning.reviewCount()) {
      this.feedback = { kind: 'info', text: 'No mistakes are saved for review yet.' };
      this.render();
      return;
    }
    this.reviewMode = !this.reviewMode;
    await this.loadNext();
  }

  async showHint() {
    if (!this.current || this.busy || this.completed) return;
    const hint = this.learning.nextHint({
      puzzle: this.current,
      bestMove: this.turnBaseline?.bestMove || this.initialBaseline?.bestMove || '',
      objectiveText: objectiveLabel(this.objective),
      humanTheme,
    });
    this.hintLevel = hint.level;
    this.hintFrom = hint.from || '';
    this.hintTo = hint.to || '';
    this.hintSquare = this.hintFrom;
    this.feedback = { kind: 'info', text: hint.text };
    this.render();
  }

  #handleKeydown(event) {
    if (event.key === 'Escape') this.close();
  }

  #handlePreferenceChange(event) {
    const field = event.target.closest('[data-pt-pref]');
    if (!field) return;
    const key = field.dataset.ptPref;
    this.prefs[key] = ['theme', 'difficultyMode'].includes(key) ? field.value : Number(field.value);
    if (this.prefs.minRating > this.prefs.maxRating) {
      [this.prefs.minRating, this.prefs.maxRating] = [this.prefs.maxRating, this.prefs.minRating];
      this.#syncPreferenceInputs();
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    this.render();
  }

  #handleClick(event) {
    const action = event.target.closest('[data-pt-action]')?.dataset.ptAction;
    if (action === 'close') return this.close();
    if (action === 'next') return this.loadNext();
    if (action === 'reset') return this.resetCurrent();
    if (action === 'hint') return this.showHint();
    if (action === 'review') return this.toggleReviewMode();

    const promotion = event.target.closest('[data-pt-promotion-piece]')?.dataset.ptPromotionPiece;
    if (promotion) return this.#commitPendingPromotion(promotion);

    const square = event.target.closest('[data-square]')?.dataset.square;
    if (square) this.#handleSquare(square);
  }

  #handleSquare(square) {
    if (!this.game || this.busy || this.completed || this.game.turn() !== this.current.solverColor) return;
    const piece = this.game.get(square);
    if (!this.selectedSquare) {
      if (piece?.color !== this.current.solverColor) return;
      this.selectedSquare = square;
      this.render();
      return;
    }

    if (square === this.selectedSquare) {
      this.selectedSquare = '';
      this.feedback = { kind: 'info', text: 'Selection cleared.' };
      this.render();
      return;
    }

    if (piece?.color === this.current.solverColor) {
      this.selectedSquare = square;
      this.render();
      return;
    }

    const candidates = this.game.moves({ square: this.selectedSquare, verbose: true }).filter((move) => move.to === square);
    if (!candidates.length) {
      this.selectedSquare = '';
      this.feedback = { kind: 'warning', text: 'That is not a legal move.' };
      this.render();
      return;
    }
    if (candidates.length > 1 && candidates.some((move) => move.promotion)) {
      this.pendingPromotion = { from: this.selectedSquare, to: square, candidates };
      this.render();
      return;
    }
    this.#playStudentMove(candidates[0]);
  }

  #commitPendingPromotion(piece) {
    if (!this.pendingPromotion) return;
    const move = this.pendingPromotion.candidates.find((candidate) => candidate.promotion === piece);
    this.pendingPromotion = null;
    if (move) this.#playStudentMove(move);
  }

  async #playStudentMove(candidate) {
    if (this.busy) return;
    const beforeFen = this.game.fen();
    const applied = this.game.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion });
    if (!applied) return;

    this.busy = true;
    this.selectedSquare = '';
    this.hintSquare = '';
    this.hintFrom = '';
    this.hintTo = '';
    this.feedback = { kind: 'info', text: `Checking ${applied.san} against the position objective…` };
    this.render();

    try {
      const afterMove = await this.evaluator.evaluate(this.game.fen(), this.current.solverColor, { movetime: 750 });
      const verdict = classifyStudentMove({
        objective: this.objective,
        baseline: this.turnBaseline,
        afterMove,
      });
      if (!verdict.accepted) {
        this.game = new Chess(beforeFen);
        this.stats.mistakes += 1;
        this.stats.streak = 0;
        this.learning.recordMistake({ puzzle: this.current, moveSan: applied.san, reason: verdict.reason });
        this.explanation = this.learning.buildMistakeExplanation({ puzzle: this.current, moveSan: applied.san, reason: verdict.reason });
        this.#saveStats();
        this.feedback = { kind: 'danger', text: `${verdict.reason} Try another move.` };
        return;
      }

      this.solverMoves += 1;
      this.lastAcceptedMove = applied.san;
      this.lastVerdict = verdict;
      if (isTrainingSolved({
        game: this.game,
        objective: this.objective,
        solverColor: this.current.solverColor,
        solverMoves: this.solverMoves,
        startMaterial: this.startMaterial,
        evaluation: afterMove,
        themes: this.current.themes,
      })) {
        this.#complete(`Solved with ${applied.san}. ${verdict.reason}`);
        return;
      }

      this.feedback = { kind: verdict.grade === 'inaccuracy' ? 'warning' : 'success', text: `${verdict.reason} Opponent is finding a defence…` };
      this.render();
      await new Promise((resolve) => setTimeout(resolve, 260));

      const replyUci = afterMove.bestMove || await this.evaluator.bestReply(this.game.fen(), { movetime: 700 });
      const reply = uciToMove(replyUci);
      const opponentMove = reply ? this.game.move(reply) : null;
      if (!opponentMove) {
        if (this.game.isGameOver()) {
          const terminalEvaluation = await this.evaluator.evaluate(this.game.fen(), this.current.solverColor, { movetime: 300 }).catch(() => afterMove);
          if (isTrainingSolved({
            game: this.game,
            objective: this.objective,
            solverColor: this.current.solverColor,
            solverMoves: this.solverMoves,
            startMaterial: this.startMaterial,
            evaluation: terminalEvaluation,
            themes: this.current.themes,
          })) {
            this.#complete('Solved. The opponent has no successful continuation.');
          } else {
            this.feedback = { kind: 'danger', text: 'The position ended without meeting the objective.' };
          }
          return;
        }
        throw new Error('The defensive engine did not return a legal move.');
      }

      this.turnBaseline = await this.evaluator.evaluate(this.game.fen(), this.current.solverColor, { movetime: 650 });
      if (isTrainingSolved({
        game: this.game,
        objective: this.objective,
        solverColor: this.current.solverColor,
        solverMoves: this.solverMoves,
        startMaterial: this.startMaterial,
        evaluation: this.turnBaseline,
        themes: this.current.themes,
      })) {
        this.#complete(`Solved after ${applied.san} ${opponentMove.san}. The objective is securely converted.`);
        return;
      }

      this.feedback = {
        kind: verdict.grade === 'inaccuracy' ? 'warning' : 'success',
        text: `${applied.san} was accepted. The opponent replied ${opponentMove.san}. Continue from the new position.`,
      };
    } catch (error) {
      this.game = new Chess(beforeFen);
      this.feedback = { kind: 'danger', text: error.message || 'The move could not be evaluated.' };
    } finally {
      this.busy = false;
      this.render();
    }
  }

  #complete(message) {
    this.completed = true;
    this.stats.solved += 1;
    this.stats.streak += 1;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
    this.#saveStats();
    this.explanation = this.learning.recordSolved({
      puzzle: this.current,
      moveSan: this.lastAcceptedMove,
      objectiveText: objectiveLabel(this.objective),
      verdictReason: this.lastVerdict?.reason || message,
      bestMove: this.initialBaseline?.bestMove || '',
    });
    if (this.reviewMode && !this.learning.reviewCount()) this.reviewMode = false;
    saveHistory({
      id: this.current.id,
      solvedAt: new Date().toISOString(),
      solverColor: this.current.solverColor,
      objective: this.objective,
      solverMoves: this.solverMoves,
      rating: this.current.rating,
    });
    this.feedback = { kind: 'success', text: message };
  }

  #saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
  }

  #syncPreferenceInputs() {
    if (!this.overlay) return;
    for (const field of this.overlay.querySelectorAll('[data-pt-pref]')) {
      field.value = String(this.prefs[field.dataset.ptPref]);
    }
  }

  #renderLibraryCount() {
    let text = 'Loading puzzle library…';
    if (this.libraryCountStatus === 'ready') {
      text = `${PUZZLE_COUNT_FORMATTER.format(this.libraryCount)} Lichess puzzles available`;
    } else if (this.libraryCountStatus === 'unavailable') {
      text = 'Puzzle library count unavailable';
    }
    for (const element of document.querySelectorAll('[data-pt-library-count]')) {
      element.textContent = text;
      element.dataset.state = this.libraryCountStatus;
      element.title = this.libraryCountStatus === 'ready'
        ? 'Total validated Lichess positions installed in this app'
        : text;
    }
  }

  render() {
    this.#renderLibraryCount();
    if (!this.overlay) return;
    this.#renderBoard();
    const feedback = this.overlay.querySelector('[data-pt-feedback]');
    feedback.className = `position-training-feedback ${this.feedback.kind}`;
    feedback.textContent = this.feedback.text;

    const explanation = this.overlay.querySelector('[data-pt-explanation]');
    if (this.explanation) {
      explanation.hidden = false;
      explanation.innerHTML = `
        <h3>${escapeHtml(this.explanation.title)}</h3>
        <p>${escapeHtml(this.explanation.summary)}</p>
        <ul>${this.explanation.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      `;
    } else {
      explanation.hidden = true;
      explanation.innerHTML = '';
    }

    const current = this.overlay.querySelector('[data-pt-current]');
    if (!this.current) {
      current.innerHTML = '<p>No position loaded.</p>';
    } else {
      const themes = this.current.themes.slice(0, 4).map(humanTheme).join(', ') || 'Unspecified';
      current.innerHTML = `
        <dl class="position-training-details">
          <div><dt>Side</dt><dd>${colorName(this.current.solverColor)}</dd></div>
          <div><dt>Goal</dt><dd>${escapeHtml(objectiveLabel(this.objective))}</dd></div>
          <div><dt>Rating</dt><dd>${this.current.rating ?? '—'}</dd></div>
          <div><dt>Themes</dt><dd>${escapeHtml(themes)}</dd></div>
        </dl>
        <p class="position-training-repair-note">The database's first move was applied only to create this position. It is not used as a required continuation.</p>
      `;
    }

    this.overlay.querySelector('[data-pt-stats]').innerHTML = `
      <div><strong>${this.stats.solved}</strong><span>Solved</span></div>
      <div><strong>${this.stats.mistakes}</strong><span>Mistakes</span></div>
      <div><strong>${this.stats.streak}</strong><span>Streak</span></div>
      <div><strong>${this.stats.bestStreak}</strong><span>Best</span></div>
    `;

    const reviewCount = this.learning.reviewCount();
    this.overlay.querySelector('[data-pt-learning]').innerHTML = `
      <div class="position-training-learning-grid">
        <div class="position-training-learning-metric"><strong>${this.learning.adaptiveRating()}</strong><span>Adaptive rating</span></div>
        <div class="position-training-learning-metric"><strong>${reviewCount}</strong><span>Review queue</span></div>
      </div>
    `;
    const reviewButton = this.overlay.querySelector('[data-pt-action="review"]');
    reviewButton.textContent = this.reviewMode ? 'Leave mistake review' : `Review mistakes (${reviewCount})`;
    reviewButton.disabled = this.busy || reviewCount === 0;
    reviewButton.classList.toggle('primary', this.reviewMode);
    this.overlay.querySelector('[data-pt-mode-note]').textContent = this.reviewMode
      ? 'Review mode is active. Two clean, hint-free review solves retire a puzzle.'
      : (this.prefs.difficultyMode === 'adaptive'
        ? 'Adaptive mode selects puzzles near your current training rating.'
        : 'Fixed mode uses the selected rating range.');

    const dashboardRows = this.learning.dashboard();
    this.overlay.querySelector('[data-pt-theme-dashboard]').innerHTML = dashboardRows.length
      ? `<table class="position-training-theme-table"><thead><tr><th>Theme</th><th>Attempts</th><th>Accuracy</th></tr></thead><tbody>${dashboardRows.map((row) => `<tr><td>${escapeHtml(humanTheme(row.theme))}</td><td>${row.attempts}</td><td>${Math.round(row.accuracy * 100)}%</td></tr>`).join('')}</tbody></table>`
      : '<p class="position-training-theme-empty">Complete positions to build a theme profile.</p>';

    const adaptive = this.prefs.difficultyMode === 'adaptive';
    for (const key of ['minRating', 'maxRating']) {
      const field = this.overlay.querySelector(`[data-pt-pref="${key}"]`);
      if (field) field.disabled = adaptive;
    }
    const hintButton = this.overlay.querySelector('[data-pt-action="hint"]');
    hintButton.textContent = `Hint ${Math.min(4, this.learning.hintLevel() + 1)} of 4`;
    hintButton.disabled = this.busy || this.completed || this.learning.hintLevel() >= 4;

    for (const button of this.overlay.querySelectorAll('[data-pt-action="reset"], [data-pt-action="next"]')) {
      button.disabled = this.busy;
    }
    this.#renderPromotion();
  }

  #renderBoard() {
    if (!this.board) return;
    const orientation = this.current?.solverColor || 'w';
    const legalTargets = new Set();
    if (this.game && this.selectedSquare) {
      for (const move of this.game.moves({ square: this.selectedSquare, verbose: true })) legalTargets.add(move.to);
    }
    this.board.innerHTML = boardSquares(orientation).map((square, index) => {
      const piece = this.game?.get(square);
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square[1]) - 1;
      const row = Math.floor(index / 8);
      const col = index % 8;
      const dark = (file + rank) % 2 === 0;
      const classes = [
        'position-training-square',
        dark ? 'dark' : 'light',
        square === this.selectedSquare ? 'selected' : '',
        legalTargets.has(square) ? 'legal-target' : '',
        square === this.hintSquare ? 'hinted' : '',
        square === this.hintFrom ? 'hinted-from' : '',
        square === this.hintTo ? 'hinted-target' : '',
      ].filter(Boolean).join(' ');
      const pieceMarkup = piece ? pieceImageMarkup(piece.color, piece.type, 'position-training-piece') : '';
      const pieceLabel = piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}` : '';
      const rankLabel = col === 0
        ? `<small class="position-training-coordinate position-training-rank">${square[1]}</small>`
        : '';
      const fileLabel = row === 7
        ? `<small class="position-training-coordinate position-training-file">${square[0]}</small>`
        : '';
      return `<button type="button" class="${classes}" data-square="${square}" aria-label="${square}${pieceLabel}">${pieceMarkup}${rankLabel}${fileLabel}</button>`;
    }).join('');
    this.board.classList.toggle('is-busy', this.busy);
  }

  #renderPromotion() {
    const container = this.overlay.querySelector('[data-pt-promotion]');
    if (!this.pendingPromotion) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    const color = this.current.solverColor;
    const options = ['q', 'r', 'b', 'n'];
    container.innerHTML = `<p>Promote to:</p>${options.map((piece) => `<button type="button" data-pt-promotion-piece="${piece}" aria-label="Promote to ${PIECE_NAMES[piece]}">${pieceImageMarkup(color, piece, 'position-training-promotion-piece')}</button>`).join('')}`;
    container.hidden = false;
  }
}

const controller = new PositionTrainingController();

function installLauncher() {
  const root = document.documentElement;
  if (root.dataset.embed === '1' || root.dataset.boardOnly === '1') return;
  const panel = document.querySelector('#puzzlePanel');
  if (!panel || panel.querySelector('[data-position-training-launcher]')) return;
  const launcher = document.createElement('section');
  launcher.className = 'position-training-launcher';
  launcher.setAttribute('data-position-training-launcher', '');
  launcher.innerHTML = `
    <div>
      <p class="position-training-eyebrow">Independent mode</p>
      <h3>Lichess Position Training</h3>
      <p>Train against dynamic defence with adaptive difficulty, progressive hints, mistake review, explanations, and theme performance tracking. The existing Endgame vs Stockfish trainer remains unchanged.</p>
      <p class="position-training-library-count" data-pt-library-count data-state="loading" aria-live="polite">Loading puzzle library…</p>
    </div>
    <button type="button" class="action-button primary">Open position training</button>
  `;
  launcher.querySelector('button').addEventListener('click', () => controller.open());
  panel.prepend(launcher);
  controller.loadLibraryMetadata();
}

ensureStyles();
installLauncher();
new MutationObserver(installLauncher).observe(document.body, { childList: true, subtree: true });
window.addEventListener('beforeunload', () => controller.evaluator.dispose());
